import { readFile, writeFile } from 'node:fs/promises';

const targetId = process.argv[2];
if (!targetId) throw new Error('Pass the verified Gemini page target ID.');
const prompt = await readFile(new URL('./GEMINI-SECOND-PASS-PROMPT.txt', import.meta.url), 'utf8');
const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.id === targetId);
if (!target || !target.url.startsWith('https://gemini.google.com/')) throw new Error('The selected target is not Gemini.');
const browserDebuggerUrl = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl);
const socket = new WebSocket(browserDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sessionId;
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callbacks.reject(new Error(message.error.message)) : callbacks.resolve(message.result);
  }
});
function send(method, params = {}, session = true) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(session && sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
await send('Runtime.enable');
const composerSelector = '[role="textbox"][aria-label="Enter a prompt for Gemini"]';
const stateExpression = `(()=>{
  const composer=document.querySelector(${JSON.stringify(composerSelector)});
  const body=document.body.innerText||'';
  const prompt=${JSON.stringify(prompt)};
  const draft=composer?.innerText||'';
  const sent=body.includes(prompt.slice(0,80))&&!draft.includes(prompt.slice(0,80));
  const active=[...document.querySelectorAll('button,[role=button]')].some((button)=>/stop|cancel|generating|در حال تولید/i.test((button.innerText||'')+' '+(button.getAttribute('aria-label')||'')));
  const responseNodes=[...document.querySelectorAll('model-response,.model-response-text,[class*="response-content"],[class*="message-content"],[class*="markdown"]')]
    .filter((node)=>node.offsetWidth||node.offsetHeight)
    .map((node)=>node.innerText?.trim()||'').filter((text)=>text.length>80 && !text.includes(prompt.slice(0,80)));
  const answer=responseNodes.at(-1)||'';
  return{url:location.href,composerLength:composer?.innerText.length??-1,composerEmpty:Boolean(composer&&!(composer.innerText||'').trim()),sent,active,answer,answerLength:answer.length,answerLines:answer.split(/\\n+/).filter((line)=>line.trim()).length,bodyTail:body.slice(-1400)}
})()`;
async function state() { return evaluate(stateExpression); }
async function sendPrompt() {
  const draft = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(composerSelector)});const b=document.querySelector('button[aria-label="Send message"]');return{value:e?.innerText||'',enabled:Boolean(b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'),active:[...document.querySelectorAll('button')].some(x=>/stop|cancel|generating/i.test((x.innerText||'')+' '+(x.getAttribute('aria-label')||'')))} })()`);
  if (normalize(draft.value) !== normalize(prompt)) throw new Error('Gemini composer does not contain the full intended review prompt.');
  if (draft.active) throw new Error('Gemini is still generating; refusing to send another message.');
  if (!draft.enabled) throw new Error('Gemini Send is disabled; refusing to click.');
  await evaluate('document.querySelector("button[aria-label=\\"Send message\\"]").click()');
  await pause(3000);
  const after = await state();
  console.log(JSON.stringify({afterSend3Seconds:{composerEmpty:after.composerEmpty,messageInHistory:after.sent,generationActive:after.active,url:after.url}}));
  return after;
}
let current = await state();
if (!current.sent) current = await sendPrompt();
if (!current.sent && !current.composerEmpty) {
  console.log('Gemini submission not confirmed after 3s; reloading the same page once and resending the identical prompt.');
  await evaluate('location.reload()');
  await pause(5000);
  current = await state();
  if (!current.composerEmpty) throw new Error('After refresh, Gemini composer is not empty; safe resend cannot proceed.');
  await evaluate(`document.querySelector(${JSON.stringify(composerSelector)}).focus()`);
  await send('Input.insertText', { text: prompt });
  current = await sendPrompt();
  if (!current.sent) throw new Error('The single recovery resend is still unconfirmed.');
}
if (!current.sent) throw new Error('Gemini message submission is not evidenced; no second message will be sent.');

async function waitForCompleteAnswer() {
  let elapsed = 0;
  let prior = '';
  let stable = 0;
  while (elapsed < 600000) {
    const answer = current.answer || '';
    stable = answer.length > 0 && answer === prior ? stable + 1 : 0;
    prior = answer;
    console.log(JSON.stringify({elapsedSeconds:elapsed/1000,composerEmpty:current.composerEmpty,generationActive:current.active,responseCharacters:current.answerLength,responseLines:current.answerLines,stablePolls:stable}));
    if (!current.active && stable >= 1 && current.answerLength >= 300 && current.answerLines >= 2) return current;
    await pause(30000);
    elapsed += 30000;
    current = await state();
  }
  throw new Error('Gemini response did not become complete within 10 minutes.');
}
current = await waitForCompleteAnswer();
if (current.answerLines < 2 || current.answerLength < 300) {
  console.log('Gemini response is incomplete/one-line; refreshing once and resending the identical prompt as requested.');
  await evaluate('location.reload()');
  await pause(5000);
  current = await state();
  if (!current.composerEmpty) throw new Error('After refresh, Gemini composer is not empty; recovery resend stopped.');
  await evaluate(`document.querySelector(${JSON.stringify(composerSelector)}).focus()`);
  await send('Input.insertText', { text: prompt });
  current = await sendPrompt();
  if (!current.sent) throw new Error('The recovery resend could not be verified.');
  current = await waitForCompleteAnswer();
}
await writeFile(new URL('GEMINI-SECOND-PASS-RESPONSE.txt', import.meta.url), current.answer + '\n', 'utf8');
console.log(JSON.stringify({status:'COMPLETE',responseCharacters:current.answerLength,responseLines:current.answerLines,answer:current.answer}, null, 2));
socket.close();
