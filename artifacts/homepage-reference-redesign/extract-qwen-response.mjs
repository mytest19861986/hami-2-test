import { writeFile } from 'node:fs/promises';

const requested = process.argv[2];
if (!requested) throw new Error('Pass the verified Qwen chat URL fragment.');
const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.url.includes(requested) && item.url.startsWith('https://chat.qwen.ai/'));
if (!target) throw new Error('The requested Qwen chat tab is not available.');
const browserDebuggerUrl = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl);
const socket = new WebSocket(browserDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sessionId;
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const callback = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
  }
});
function send(method, params = {}, session = true) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(session && sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
  });
}
try {
  sessionId = (await send('Target.attachToTarget', { targetId: target.id, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  const result = await send('Runtime.evaluate', {
    expression: `(()=>{const user=document.querySelector('.qwen-chat-message-user');const assistant=[...document.querySelectorAll('.qwen-chat-message-assistant')].at(-1);const sendButton=document.querySelector('button[aria-label="Send"]');return{url:location.href,userLength:user?.innerText.trim().length??0,assistantText:assistant?.innerText.trim()??'',assistantLength:assistant?.innerText.trim().length??0,generationActive:[...document.querySelectorAll('button,[role=button]')].some(button=>/stop|cancel|停止|生成中/i.test((button.innerText||'')+' '+(button.getAttribute('aria-label')||''))),composerEmpty:Boolean(document.querySelector('textarea[placeholder="Ask Qwen"]')&&document.querySelector('textarea[placeholder="Ask Qwen"]').value.length===0),sendDisabled:!sendButton||sendButton.disabled}})()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  const state = result.result?.value;
  if (!state || state.userLength < 2000 || state.assistantLength < 1000 || state.generationActive || !state.composerEmpty) throw new Error(`Qwen response is not verified complete: ${JSON.stringify(state && { ...state, assistantText: undefined })}`);
  await writeFile(new URL('./QWEN-REVIEW-RESPONSE.txt', import.meta.url), state.assistantText.replace(/^Thinking completed\s*/, '') + '\n', 'utf8');
  console.log(JSON.stringify(state, null, 2));
} finally {
  if (socket.readyState === WebSocket.OPEN) socket.close();
}
