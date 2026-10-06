let targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
let target = targets.find((item) => item.url === 'http://127.0.0.1:3012/');
if (!target) {
  const openingSocket = new WebSocket(await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => { openingSocket.addEventListener('open', resolve, { once: true }); openingSocket.addEventListener('error', reject, { once: true }); });
  const created = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out creating local preview tab.')), 8000);
    openingSocket.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      openingSocket.removeEventListener('message', onMessage);
      clearTimeout(timer);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result.targetId);
    });
  });
  openingSocket.send(JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url: 'http://127.0.0.1:3012/' } }));
  const targetId = await created;
  openingSocket.close();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
  target = targets.find((item) => item.id === targetId);
}
if (!target) throw new Error('The local preview tab is unavailable.');
const debuggerUrl = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl);
const socket = new WebSocket(debuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sessionId;
let id = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded', 'Network.loadingFailed'].includes(message.method)) console.log(JSON.stringify({event:message.method,details:message.params?.exceptionDetails?.text||message.params?.entry?.text||message.params?.errorText||message.params?.args?.map((item)=>item.value||item.description)||message.params}));
  if (!message.id || !pending.has(message.id)) return;
  const callback = pending.get(message.id);
  pending.delete(message.id);
  message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
});
function send(method, params = {}, session = true) {
  const requestId = ++id;
  socket.send(JSON.stringify({ id: requestId, method, params, ...(session && sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}
try {
  sessionId = (await send('Target.attachToTarget', { targetId: target.id, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  let evaluation = await send('Runtime.evaluate', { expression: `(()=>{const b=document.querySelector('.home-menu-button');const r=b?.getBoundingClientRect();return{url:location.href,width:innerWidth,buttonFound:Boolean(b),display:b&&getComputedStyle(b).display,initial:b?.getAttribute('aria-expanded'),rect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},ready:document.readyState}})()`, returnByValue: true });
  const before = evaluation.result.value;
  if (!before.buttonFound) throw new Error('Mobile drawer trigger not found.');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.rect.x + before.rect.width / 2, y: before.rect.y + before.rect.height / 2 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.rect.x + before.rect.width / 2, y: before.rect.y + before.rect.height / 2, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.rect.x + before.rect.width / 2, y: before.rect.y + before.rect.height / 2, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const events = await send('Runtime.evaluate', { expression: `(()=>{const b=document.querySelector('.home-menu-button');const props=Object.keys(b||{}).find(k=>k.startsWith('__reactProps'));return{html:b?.outerHTML,reactKeys:Object.keys(b||{}).filter(k=>k.startsWith('__react')),props:props&&{keys:Object.keys(b[props]),click:b[props].onClick?.toString()},root:document.getElementById('__next')?.innerHTML.slice(0,180),nextData:Boolean(document.querySelector('script#__NEXT_DATA__')),scripts:[...document.scripts].map(x=>x.src).filter(Boolean).slice(-5)}})()`, returnByValue: true });
  evaluation = await send('Runtime.evaluate', { expression: `(()=>{const d=document.querySelector('.home-mobile-drawer');const b=document.querySelector('.home-menu-button');return{url:location.href,expanded:b?.getAttribute('aria-expanded'),drawerFound:Boolean(d),focusedInside:Boolean(d&&d.contains(document.activeElement)),focus:document.activeElement?.outerHTML?.slice(0,180),right:d?.getBoundingClientRect().right,width:d?.getBoundingClientRect().width,overflow:document.body.style.overflow,drawerLinks:d?.querySelectorAll('nav a').length}})()`, returnByValue: true });
  console.log(JSON.stringify({before, events: events.result.value, after: evaluation.result.value}, null, 2));
} finally {
  if (socket.readyState === WebSocket.OPEN) socket.close();
}
