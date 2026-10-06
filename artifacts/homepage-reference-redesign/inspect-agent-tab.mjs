const requested = process.argv[2];
if (!requested) throw new Error('Pass a page URL fragment or title fragment.');
const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.url.includes(requested) || item.title.includes(requested));
if (!target) throw new Error('Matching browser tab not found.');
const browserDebuggerUrl = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl);
const socket = new WebSocket(browserDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sessionId;
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const resolve = pending.get(message.id);
    pending.delete(message.id);
    resolve(message);
  }
});
function send(method, params = {}, session = true) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(session && sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
    pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message); });
  });
}
sessionId = (await send('Target.attachToTarget', { targetId: target.id, flatten: true }, false)).result.sessionId;
await send('Runtime.enable');
const expression = `JSON.stringify({url:location.href,title:document.title,ready:document.readyState,bodyTail:document.body.innerText.slice(-4500),fields:[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"],input')].map((e)=>({tag:e.tagName,role:e.getAttribute('role'),placeholder:e.getAttribute('placeholder'),ariaLabel:e.getAttribute('aria-label'),testId:e.getAttribute('data-testid'),visible:Boolean(e.offsetWidth||e.offsetHeight)})),messages:[...document.querySelectorAll('.qwen-chat-message,.qwen-markdown,[class*="message"],[class*="response"],[class*="query"],model-response')].filter((e)=>e.offsetWidth||e.offsetHeight).map((e)=>({tag:e.tagName,class:e.className?.toString().slice(0,120),length:e.innerText?.trim().length||0,start:e.innerText?.trim().slice(0,90),parent:e.parentElement?.className?.toString().slice(0,100)})).filter((e)=>e.length>50).slice(-30),buttons:[...document.querySelectorAll('button,[role="button"]')].filter((e)=>e.offsetWidth||e.offsetHeight).map((e)=>({text:e.innerText.trim().slice(0,50),ariaLabel:e.getAttribute('aria-label'),testId:e.getAttribute('data-testid'),disabled:e.disabled,html:e.outerHTML.slice(0,280)})).slice(-14)})`;
const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
console.log(result.result.result.value);
socket.close();
