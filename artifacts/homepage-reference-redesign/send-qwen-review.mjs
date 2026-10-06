import { readFile } from 'node:fs/promises';

const targetId = process.argv[2];
if (!targetId) throw new Error('Pass the verified Qwen page target ID.');
const promptFile = process.argv[3] || './QWEN-REVIEW-PROMPT.txt';
const prompt = await readFile(new URL(promptFile, import.meta.url), 'utf8');
const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.id === targetId);
if (!target || !target.url.startsWith('https://chat.qwen.ai/')) throw new Error('The selected target is not Qwen.');
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
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
await send('Runtime.enable');
const composer = await evaluate(`(()=>{const e=document.querySelector('textarea[placeholder="Ask Qwen"]');return e?{valueLength:e.value.length,visible:Boolean(e.offsetWidth||e.offsetHeight),stopActive:[...document.querySelectorAll('button,[role=button]')].some(b=>/stop|cancel|停止/i.test((b.innerText||'')+' '+(b.getAttribute('aria-label')||'')))}:null})()`);
if (!composer?.visible) throw new Error('Visible Qwen composer not found.');
if (composer.valueLength !== 0) throw new Error('Composer is not empty; refusing to replace existing user text.');
if (composer.stopActive) throw new Error('Qwen is still generating; refusing to send another message.');
await evaluate('document.querySelector("textarea[placeholder=\\"Ask Qwen\\"]").focus()');
await send('Input.insertText', { text: prompt });
const inserted = await evaluate(`(()=>{const e=document.querySelector('textarea[placeholder="Ask Qwen"]');return{length:e.value.length,exact:e.value===${JSON.stringify(prompt)},controls:[...document.querySelectorAll('.message-input-right-button-send [role=button],.message-input-right-button-send button,button[aria-label*="Send" i],[role=button][aria-label*="Send" i]')].map(b=>({role:b.getAttribute('role'),aria:b.getAttribute('aria-label'),test:b.getAttribute('data-testid'),disabled:b.disabled||b.getAttribute('aria-disabled')==='true',html:b.outerHTML.slice(0,500)}))}})()`);
if (!inserted.exact) throw new Error(`Prompt not fully accepted by Qwen composer (received ${inserted.length} characters).`);
console.log(JSON.stringify({targetUrl:target.url,composerLength:inserted.length,composerExact:true,sendControls:inserted.controls}, null, 2));
socket.close();
