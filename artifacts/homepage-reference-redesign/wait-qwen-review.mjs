import { readFile, writeFile } from 'node:fs/promises';

const targetId = process.argv[2];
if (!targetId) throw new Error('Pass the verified Qwen page target ID.');
const prompt = await readFile(new URL('./QWEN-REVIEW-PROMPT.txt', import.meta.url), 'utf8');
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
await send('Runtime.enable');

const pageState = () => evaluate(`(()=>{
  const composer=document.querySelector('textarea[placeholder="Ask Qwen"]');
  const sendButton=document.querySelector('button[aria-label="Send"]');
  const body=document.body.innerText||'';
  const text=${JSON.stringify(prompt)};
  const outsideComposer=body.includes(text.slice(0,100));
  const active=[...document.querySelectorAll('button,[role=button]')].some((button)=>/stop|cancel|停止|生成中/i.test((button.innerText||'')+' '+(button.getAttribute('aria-label')||'')));
  const choices=[...document.querySelectorAll('button,[role=button]')].filter((button)=>/I prefer this response/i.test(button.innerText||''));
  const content=[...document.querySelectorAll('.qwen-chat-message-assistant')]
    .filter((element)=>element.offsetWidth||element.offsetHeight)
    .map((element)=>element.innerText?.trim()||'').filter((value)=>value.length>80);
  const userPosition=body.lastIndexOf(text.slice(0,80));
  const afterUser=userPosition>=0?body.slice(userPosition+80).trim():'';
  const answer=content.at(-1)||afterUser;
  return{url:location.href,composerLength:composer?.value.length??-1,composerEmpty:Boolean(composer&&composer.value.length===0),sendEnabled:Boolean(sendButton&&!sendButton.disabled),outsideComposer,active,choiceCount:choices.length,lastContent:answer,lastContentLength:answer.length,bodyTail:body.slice(-1600)}
})()`);
const initial = await pageState();
if (initial.composerLength !== prompt.length) throw new Error(`Expected the staged full prompt (${prompt.length} chars); composer currently has ${initial.composerLength}.`);
if (initial.active) throw new Error('Qwen is already generating; second message is forbidden.');
if (!initial.sendEnabled) throw new Error('Qwen Send button is disabled; refusing to click.');
await evaluate('document.querySelector("button[aria-label=\\"Send\\"]").click()');
await pause(3000);
let state = await pageState();
console.log(JSON.stringify({afterSend3Seconds:{composerEmpty:state.composerEmpty,messageInHistory:state.outsideComposer,generationActive:state.active,url:state.url}}, null, 2));
if (!state.outsideComposer && !state.composerEmpty) {
  console.log('Message not confirmed after 3s; reloading the same Qwen page once and resending the identical prompt.');
  await evaluate('location.reload()');
  await pause(5000);
  const reloaded = await evaluate(`(()=>{const c=document.querySelector('textarea[placeholder="Ask Qwen"]');return{url:location.href,length:c?.value.length??-1}})()`);
  if (reloaded.length !== 0) throw new Error('After reload, composer is not empty; safe resend cannot proceed.');
  await evaluate('document.querySelector("textarea[placeholder=\\"Ask Qwen\\"]").focus()');
  await send('Input.insertText', { text: prompt });
  const resendCheck = await evaluate(`(()=>({exact:document.querySelector('textarea[placeholder="Ask Qwen"]')?.value===${JSON.stringify(prompt)},enabled:Boolean(document.querySelector('button[aria-label="Send"]')&&!document.querySelector('button[aria-label="Send"]').disabled)}))()`);
  if (!resendCheck.exact || !resendCheck.enabled) throw new Error('Identical prompt did not stage fully after one reload; stopping without a send.');
  await evaluate('document.querySelector("button[aria-label=\\"Send\\"]").click()');
  await pause(3000);
  state = await pageState();
  if (!state.outsideComposer) throw new Error('The single recovery resend is still unconfirmed.');
  console.log('Recovery resend verified in conversation history.');
}
if (!state.outsideComposer) throw new Error('Message submission was not evidenced; refusing to send a second message.');

let elapsedMs = 0;
let previousContent = '';
let stableCount = 0;
let selectedAlternative = false;
let complete = false;
while (elapsedMs < 600000) {
  if (state.choiceCount > 1 && !selectedAlternative) {
    await evaluate('(()=>{const choices=[...document.querySelectorAll("button,[role=button]")].filter((button)=>/I prefer this response/i.test(button.innerText||""));choices[0]?.click()})()');
    selectedAlternative = true;
    console.log('Qwen presented two response choices; selected one I prefer and will continue waiting.');
  }
  const text = state.lastContent;
  stableCount = text.length > 0 && text === previousContent ? stableCount + 1 : 0;
  previousContent = text;
  const chars = state.lastContentLength;
  const multipleSentences = (state.lastContent.match(/[.!?؟۔](?:\s|$)/g) || []).length >= 2;
  console.log(JSON.stringify({elapsedSeconds:elapsedMs/1000,composerEmpty:state.composerEmpty,generationActive:state.active,responseCharacters:chars,stablePolls:stableCount,choiceCount:state.choiceCount}));
  if (!state.active && stableCount >= 1 && chars >= 260 && multipleSentences) { complete = true; break; }
  await pause(30000);
  elapsedMs += 30000;
  state = await pageState();
}
if (complete) {
  const final = state.lastContent;
  await writeFile(new URL('QWEN-REVIEW-RESPONSE.txt', import.meta.url), final + '\n', 'utf8');
  console.log(JSON.stringify({status:'COMPLETE',responseCharacters:final.length,answer:final}, null, 2));
} else {
  console.log(JSON.stringify({status:'INCOMPLETE_AFTER_10_MINUTES',lastState:{composerEmpty:state.composerEmpty,generationActive:state.active,responseCharacters:state.lastContentLength,bodyTail:state.bodyTail}}, null, 2));
  process.exitCode = 2;
}
socket.close();
