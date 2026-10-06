import { readFile, writeFile } from 'node:fs/promises';

const targetId = process.argv[2];
if (!targetId) throw new Error('Pass the verified Gemini page target ID.');
const prompt = await readFile(new URL('./GEMINI-SECOND-PASS-PROMPT.txt', import.meta.url), 'utf8');
const target = (await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json())).find((item) => item.id === targetId && item.url.startsWith('https://gemini.google.com/'));
if (!target) throw new Error('The selected target is not the verified Gemini page.');
const debuggerUrl = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl);
const socket = new WebSocket(debuggerUrl);
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
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const composerSelector = '[role="textbox"][aria-label="Enter a prompt for Gemini"]';
const promptJson = JSON.stringify(prompt);
const expression = `(()=>{const composer=document.querySelector(${JSON.stringify(composerSelector)});const body=document.body.innerText||'';const draft=composer?.innerText||'';const active=[...document.querySelectorAll('button,[role=button]')].some(button=>/stop|cancel|generating|در حال تولید/i.test((button.innerText||'')+' '+(button.getAttribute('aria-label')||'')));const nodes=[...document.querySelectorAll('model-response,model-response-text,[class*="response-content"],[class*="response-container"],[class*="model-response"],[class*="message-content"],[class*="markdown"]')].filter(node=>node.offsetWidth||node.offsetHeight).map(node=>node.innerText?.trim()||'').filter(text=>text.length>100&&!text.startsWith('You said'));const answer=nodes.at(-1)||'';return{url:location.href,draft,composerEmpty:Boolean(composer&&!(draft||'').trim()),sent:body.includes(${promptJson}.slice(0,80))&&!(draft||'').includes(${promptJson}.slice(0,80)),active,answer,answerLength:answer.length,answerLines:answer.split(/\\n+/).filter(line=>line.trim()).length,bodyTail:body.slice(-1800)}})()`;
async function state() { return evaluate(expression); }

try {
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  let before = await state();
  if (!before.composerEmpty || before.active) throw new Error(`Cannot safely recover: composer/generation state is not idle (${JSON.stringify({ composerEmpty: before.composerEmpty, active: before.active })}).`);
  await evaluate('location.reload()');
  await pause(5000);
  before = await state();
  if (!before.composerEmpty || before.active) throw new Error('After the one allowed reload, Gemini is not idle with an empty composer; recovery stopped.');
  await evaluate(`document.querySelector(${JSON.stringify(composerSelector)}).focus()`);
  await send('Input.insertText', { text: prompt });
  const staged = await evaluate(`(()=>{const composer=document.querySelector(${JSON.stringify(composerSelector)});const button=document.querySelector('button[aria-label="Send message"]');return{value:composer?.innerText||'',enabled:Boolean(button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')}})()`);
  if (normalize(staged.value) !== normalize(prompt) || !staged.enabled) throw new Error('The identical full Gemini prompt is not ready after the single recovery reload; no send was attempted.');
  await evaluate('document.querySelector("button[aria-label=\\"Send message\\"]").click()');
  await pause(3000);
  let current = await state();
  console.log(JSON.stringify({singleRecoverySend3Seconds:{composerEmpty:current.composerEmpty,promptInHistory:current.sent,generationActive:current.active,url:current.url}}));
  if (!current.composerEmpty || !current.sent) throw new Error('The one allowed recovery send is not verified.');
  let elapsed = 0;
  let previous = '';
  let stable = 0;
  let complete = false;
  while (elapsed < 600000) {
    stable = current.answerLength > 0 && current.answer === previous ? stable + 1 : 0;
    previous = current.answer;
    console.log(JSON.stringify({elapsedSeconds:elapsed/1000,generationActive:current.active,responseCharacters:current.answerLength,responseLines:current.answerLines,stablePolls:stable}));
    if (!current.active && stable >= 1 && current.answerLength >= 300 && current.answerLines >= 2) {
      await writeFile(new URL('./GEMINI-SECOND-PASS-RESPONSE.txt', import.meta.url), current.answer + '\n', 'utf8');
      console.log(JSON.stringify({status:'COMPLETE',responseCharacters:current.answerLength,responseLines:current.answerLines,answer:current.answer}));
      complete = true;
      break;
    }
    await pause(30000);
    elapsed += 30000;
    current = await state();
  }
  if (!complete) {
    const incomplete = `GEMINI_SECOND_PASS_INCOMPLETE_AFTER_SINGLE_RECOVERY\nURL: ${current.url}\nComposer empty: ${current.composerEmpty}\nPrompt in history: ${current.sent}\nGeneration active: ${current.active}\nExtracted answer characters: ${current.answerLength}\nExtracted answer lines: ${current.answerLines}\nVisible tail at timeout:\n${current.bodyTail}\n`;
    await writeFile(new URL('./GEMINI-SECOND-PASS-STATUS.txt', import.meta.url), incomplete, 'utf8');
    console.log(JSON.stringify({status:'INCOMPLETE_AFTER_SINGLE_RECOVERY',state:{url:current.url,composerEmpty:current.composerEmpty,sent:current.sent,active:current.active,answerLength:current.answerLength,answerLines:current.answerLines,bodyTail:current.bodyTail}}, null, 2));
    process.exitCode = 2;
  }
} finally {
  if (socket.readyState === WebSocket.OPEN) socket.close();
}
