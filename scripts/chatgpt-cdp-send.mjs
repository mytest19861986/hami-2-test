#!/usr/bin/env node
import process from 'node:process';

const endpoint = 'http://127.0.0.1:9222/json/list';
const args = process.argv.slice(2);
const message = args.find((a) => a.startsWith('--message='))?.slice(10) ?? '';
const verifyMessage = args.find((a) => a.startsWith('--verify='))?.slice(9) ?? '';
const sendExisting = args.includes('--send-existing');
const reload = args.includes('--reload');
const matcher = args.find((a) => a.startsWith('--url='))?.slice(6) ?? '';
const targetHost = args.find((a) => a.startsWith('--host='))?.slice(7) ?? 'chatgpt';

const targets = await (await fetch(endpoint)).json();
const hostPattern = targetHost === 'gemini' ? /gemini\.google\.com/i : targetHost === 'qwen' ? /chat\.qwen\.ai/i : targetHost === 'glm' ? /chat\.z\.ai/i : targetHost === 'claude' ? /claude\.ai/i : /chatgpt\.com|chat\.openai\.com/i;
const target = targets.find((t) => t.type === 'page' && hostPattern.test(t.url) && (!matcher || t.url.includes(matcher)));
if (!target) throw new Error('target_not_found');

let seq = 0;
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, (data) => data.error ? reject(new Error(data.error.message)) : resolve(data.result));
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
await call('Runtime.enable');
await call('Page.enable');
await call('DOM.enable');
if (reload) { await call('Page.reload', { ignoreCache: true }); await new Promise((r) => setTimeout(r, 3500)); }

const evaluate = (expression, awaitPromise = true, returnByValue = true) => call('Runtime.evaluate', { expression, awaitPromise, returnByValue });
const inspect = await evaluate(`(() => ({readyState:document.readyState,url:location.href,composer:(() => { const xs=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]; return xs.map((e,i)=>({i,tag:e.tagName,aria:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),editable:e.isContentEditable,visible:!!(e.offsetWidth||e.offsetHeight)})).filter(x=>x.visible); })(),buttons:[...document.querySelectorAll('button')].map((b,i)=>({i,text:(b.innerText||'').trim().slice(0,80),aria:b.getAttribute('aria-label'),testid:b.getAttribute('data-testid'),disabled:b.disabled,visible:!!(b.offsetWidth||b.offsetHeight)})).filter(x=>x.visible).slice(-40)}))()`);
console.log(JSON.stringify({targetUrl:target.url,connection:'ok',page:inspect.result.value}, null, 2));

if (!message) {
  if (sendExisting) {
    const existing = await evaluate(`(() => { const e=document.querySelector('[contenteditable="true"][aria-label="Ask ChatGPT"],textarea'); return {text:e?.value||e?.innerText||e?.textContent||''}; })()`);
    const text = existing.result.value.text || '';
    if (!text.trim()) { console.log(JSON.stringify({send:'not_sent',reason:'composer_empty'}, null, 2)); ws.close(); process.exit(0); }
    const send = await evaluate(`(() => { const bs=[...document.querySelectorAll('button')].filter(b=>b.offsetWidth||b.offsetHeight); return bs.find(b=>/^send$/i.test((b.getAttribute('aria-label')||'').trim()) && !b.disabled) ?? null; })()`, true, false);
    if (!send.result.objectId) throw new Error('send_button_not_found');
    await call('Runtime.callFunctionOn', { objectId: send.result.objectId, functionDeclaration: `function(){ this.click(); }` });
    console.log(JSON.stringify({send:'ok',messageLength:text.length}, null, 2)); ws.close(); process.exit(0);
  }
  if (verifyMessage) {
    const check = await evaluate(`(() => ({bodyHasMessage:document.body.innerText.includes(${JSON.stringify(verifyMessage)}),url:location.href}))()`);
    console.log(JSON.stringify({verification:check.result.value}, null, 2));
  }
  ws.close(); process.exit(0);
}
const composer = await evaluate(`(() => { const xs=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].filter(e=>(e.offsetWidth||e.offsetHeight) && (e.matches('textarea') || /ask chatgpt|write your prompt|enter a prompt|type a message|send a message|prompt/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''))); return xs.at(-1); })()`, true, false);
if (!composer.result.objectId) throw new Error('composer_not_found');
await call('Runtime.callFunctionOn', { objectId: composer.result.objectId, functionDeclaration: `function(){ this.focus(); }` });
await call('Input.insertText', { text: message });
const after = await evaluate(`(() => { const e=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].filter(x=>(x.offsetWidth||x.offsetHeight) && (x.matches('textarea') || /ask chatgpt|write your prompt|enter a prompt|type a message|send a message|prompt/i.test(x.getAttribute('aria-label')||x.getAttribute('placeholder')||''))).at(-1); return {text:e?.value||e?.innerText||e?.textContent||''}; })()`);
if (!after.result.value.text.includes(message)) throw new Error('composer_state_rejected');
const send = await evaluate(`(() => { const c=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].filter(e=>(e.offsetWidth||e.offsetHeight) && (e.matches('textarea') || /ask chatgpt|enter a prompt|type a message|prompt|send a message/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''))).at(-1); const scoped=${JSON.stringify(targetHost === 'glm')}; const scope=scoped ? (c?.closest('form') || c?.parentElement?.parentElement?.parentElement || document) : document; const bs=[...scope.querySelectorAll('button')].filter(b=>(b.offsetWidth||b.offsetHeight) && !b.disabled); return bs.find(b=>/send|submit|send message/i.test((b.getAttribute('aria-label')||'')+' '+(b.getAttribute('data-testid')||'')+' '+(b.innerText||''))) ?? (scoped ? bs.at(-1) : null) ?? null; })()`, true, false);
if (!send.result.objectId) throw new Error('send_button_not_found');
if (targetHost === 'glm') {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
} else {
  await call('Runtime.callFunctionOn', { objectId: send.result.objectId, functionDeclaration: `function(){ this.click(); }` });
}
await new Promise((r) => setTimeout(r, 1000));
const verify = await evaluate(`(() => ({composer:[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].map(e=>e.value||e.innerText||e.textContent).join(''),bodyHasMessage:document.body.innerText.includes(${JSON.stringify(message)}),url:location.href}))()`);
console.log(JSON.stringify({send:'ok',verification:verify.result.value}, null, 2));
ws.close();
