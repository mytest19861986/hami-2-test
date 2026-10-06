import { readFile } from 'node:fs/promises';

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
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
await send('Runtime.enable');
const composer = await evaluate(`(()=>{const e=document.querySelector('[role="textbox"][aria-label="Enter a prompt for Gemini"]');return e?{text:e.innerText||'',visible:Boolean(e.offsetWidth||e.offsetHeight),stopActive:[...document.querySelectorAll('button')].some(b=>/stop|cancel/i.test((b.innerText||'')+' '+(b.getAttribute('aria-label')||'')))}:null})()`);
if (!composer?.visible) throw new Error('Visible Gemini composer not found.');
if (composer.stopActive) throw new Error('Gemini is still generating; refusing a second message.');
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
if (!composer.text.trim()) {
  await evaluate('document.querySelector("[role=\\"textbox\\"][aria-label=\\"Enter a prompt for Gemini\\"]").focus()');
  await send('Input.insertText', { text: prompt });
  await new Promise((resolve) => setTimeout(resolve, 300));
} else if (normalize(composer.text) !== normalize(prompt)) {
  throw new Error('Gemini composer contains text that is not the complete intended review prompt; refusing to send.');
}
const staged = await evaluate(`(()=>{const e=document.querySelector('[role="textbox"][aria-label="Enter a prompt for Gemini"]');const text=e.innerText||'';return{length:text.length,exact:text===${JSON.stringify(prompt)},buttons:[...document.querySelectorAll('button,[role=button]')].filter(b=>b.offsetWidth||b.offsetHeight).map(b=>({text:(b.innerText||'').trim().slice(0,40),aria:b.getAttribute('aria-label'),test:b.getAttribute('data-test-id'),disabled:b.disabled||b.getAttribute('aria-disabled')==='true',html:b.outerHTML.slice(0,280)})).slice(-10)}})()`);
if (normalize(staged.exact ? prompt : (await evaluate('document.querySelector("[role=\\"textbox\\"][aria-label=\\"Enter a prompt for Gemini\\"]").innerText')) ) !== normalize(prompt)) throw new Error(`Gemini did not accept the complete review prompt (${staged.length} characters).`);
console.log(JSON.stringify({targetUrl:target.url,composerLength:staged.length,normalizedFullPromptVerified:true,sendControls:staged.buttons}, null, 2));
socket.close();
