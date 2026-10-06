import { readFile, writeFile } from 'node:fs/promises';

const targetId = process.argv[2];
if (!targetId) throw new Error('Pass the verified Gemini target ID.');
const promptFile = process.argv[3] || './GEMINI-SECOND-PASS-PROMPT.txt';
const responseFile = process.argv[4] || './GEMINI-SECOND-PASS-RESPONSE.txt';
const prompt = await readFile(new URL(promptFile, import.meta.url), 'utf8');
const target = (await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json())).find((item) => item.id === targetId && item.url.startsWith('https://gemini.google.com/'));
if (!target) throw new Error('The Gemini target is unavailable.');
const socket = new WebSocket(await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl));
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sessionId;
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const callback = pending.get(message.id);
  pending.delete(message.id);
  message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
});
function send(method, params = {}, session = true) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(session && sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result?.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const promptJson = JSON.stringify(prompt);
const expression = `(()=>{const composer=document.querySelector('[role="textbox"][aria-label="Enter a prompt for Gemini"]');const body=document.body.innerText||'';const user=[...document.querySelectorAll('.user-query-container')].find(node=>node.innerText?.includes(${promptJson}.slice(0,80)));const wrapper=user?.closest('.conversation-container');let answer='';if(wrapper){const copy=wrapper.cloneNode(true);copy.querySelectorAll('.user-query-container,button,[role="button"]').forEach(node=>node.remove());answer=(copy.innerText||'').replace(/Gemini said/gi,'').trim();}const sectionCount=(answer.match(/[۰-۹0-9]+[.)]/g)||[]).length;const active=[...document.querySelectorAll('button,[role=button]')].some(button=>/stop|cancel|generating|در حال تولید/i.test((button.innerText||'')+' '+(button.getAttribute('aria-label')||'')));return{url:location.href,draft:composer?.innerText||'',composerEmpty:Boolean(composer&&!(composer.innerText||'').trim()),promptInHistory:Boolean(user),active,answer,answerLength:answer.length,answerLines:Math.max(answer.split(/\\n+/).filter(line=>line.trim()).length,sectionCount),bodyTail:body.slice(-800)}})()`;
async function state() { return evaluate(expression); }
try {
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  let current = await state();
  const normalize = (value) => value.replace(/\s+/g, ' ').trim();
  if (!current.promptInHistory && normalize(current.draft) === normalize(prompt)) {
    const sendEnabled = await evaluate('(()=>{const button=document.querySelector("button[aria-label=\\"Send message\\"]");return Boolean(button&&!button.disabled&&button.getAttribute("aria-disabled")!=="true")})()');
    if (!sendEnabled) throw new Error('Gemini Send is disabled; staged full prompt was not sent.');
    await evaluate('document.querySelector("button[aria-label=\\"Send message\\"]").click()');
    await pause(3000);
    current = await state();
    console.log(JSON.stringify({afterSend3Seconds:{composerEmpty:current.composerEmpty,promptInHistory:current.promptInHistory,generationActive:current.active,url:current.url}}));
  }
  if (!current.promptInHistory || !current.composerEmpty) throw new Error('The expected Gemini message/composer state is not verified; monitor stopped without sending another prompt.');
  let elapsed = 0;
  let previous = '';
  let stable = 0;
  while (elapsed < 600000) {
    stable = current.answerLength > 0 && current.answer === previous ? stable + 1 : 0;
    previous = current.answer;
    console.log(JSON.stringify({elapsedSeconds:elapsed/1000,composerEmpty:current.composerEmpty,promptInHistory:current.promptInHistory,generationActive:current.active,responseCharacters:current.answerLength,responseLines:current.answerLines,stablePolls:stable,answerStart:current.answer.slice(0,600)}));
    if (!current.active && stable >= 1 && current.answerLength >= 300 && current.answerLines >= 2) {
      const formattedAnswer = current.answer.replace(/(?=[۰-۹0-9]+[.)]\s)/g, '\n\n').replace(/(DEV-\d+)/g, '\n\n$1').trim();
      await writeFile(new URL(responseFile, import.meta.url), formattedAnswer + '\n', 'utf8');
      console.log(JSON.stringify({status:'COMPLETE',responseCharacters:current.answerLength,responseLines:current.answerLines,answer:current.answer}));
      break;
    }
    await pause(30000);
    elapsed += 30000;
    current = await state();
  }
  if (elapsed >= 600000) {
    const status = `GEMINI_SECOND_PASS_INCOMPLETE_AFTER_SINGLE_RECOVERY\nURL: ${current.url}\nComposer empty: ${current.composerEmpty}\nPrompt in history: ${current.promptInHistory}\nGeneration active: ${current.active}\nAssistant text characters: ${current.answerLength}\nAssistant text lines: ${current.answerLines}\nVisible tail at timeout:\n${current.bodyTail}\n`;
    await writeFile(new URL('./GEMINI-SECOND-PASS-STATUS.txt', import.meta.url), status, 'utf8');
    console.log(JSON.stringify({status:'INCOMPLETE_AFTER_SINGLE_RECOVERY',state:current}, null, 2));
    process.exitCode = 2;
  }
} finally {
  if (socket.readyState === WebSocket.OPEN) socket.close();
}
