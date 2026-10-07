import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('./', import.meta.url);
await mkdir(output, { recursive: true });
const previewUrl = process.env.HAMI_PREVIEW_URL || 'http://localhost:3130/';
let targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
let target = targets.find((item) => item.url.startsWith(previewUrl));
if (!target) {
  const opener = new WebSocket(await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json()).then((item) => item.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => { opener.addEventListener('open', resolve, { once: true }); opener.addEventListener('error', reject, { once: true }); });
  const createdTarget = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out opening local preview tab.')), 10000);
    opener.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      opener.removeEventListener('message', onMessage);
      clearTimeout(timer);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result.targetId);
    });
  });
  opener.send(JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url: previewUrl } }));
  const targetId = await createdTarget;
  opener.close();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
  target = targets.find((item) => item.id === targetId);
}
if (!target) throw new Error('Local homepage preview tab was not found.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const errors = [];
const capturedScreenshots = [];
let mockLoginFailureEnabled = false;
let mockLoginFailureHit = false;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((item) => item.value || item.description || '').join(' '));
  if (message.method === 'Fetch.requestPaused') {
    const requestUrl = message.params.request.url;
    if (mockLoginFailureEnabled && requestUrl.includes('/api/v1/auth/login/password')) {
      mockLoginFailureHit = true;
      void send('Fetch.fulfillRequest', {
        requestId: message.params.requestId,
        responseCode: 401,
        responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
        body: Buffer.from(JSON.stringify({ error: 'AUTH_FAILED' })).toString('base64'),
      });
    } else {
      void send('Fetch.continueRequest', { requestId: message.params.requestId });
    }
  }
  if (message.id && pending.has(message.id)) {
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(callbacks.timer);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  }
});
function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP command timed out after 8s: ${method} (id ${id})`));
    }, 8000);
    pending.set(id, { resolve, reject, timer });
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result?.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const check = (name, pass, details = '') => checks.push({ name, pass: Boolean(pass), details });
async function capture(name) {
  await send('Page.bringToFront');
  await evaluate('(()=>{let style=document.getElementById("hami-evidence-pointer-style");if(!style){style=document.createElement("style");style.id="hami-evidence-pointer-style";style.textContent="*,*::before,*::after{cursor:none!important}";document.head.appendChild(style)}return true})()');
  try {
    const image = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(new URL(name, output), Buffer.from(image.data, 'base64'));
    capturedScreenshots.push(name);
  } finally {
    await evaluate('document.getElementById("hami-evidence-pointer-style")?.remove()');
  }
}
async function captureElement(selector, name) {
  const box = await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return null;const rect=node.getBoundingClientRect();return{x:rect.left+scrollX,y:rect.top+scrollY,width:rect.width,height:rect.height}})()`);
  if (!box || box.width < 1 || box.height < 1) throw new Error(`Evidence section is missing or empty: ${selector}`);
  await send('Page.bringToFront');
  await evaluate('(()=>{let style=document.getElementById("hami-evidence-pointer-style");if(!style){style=document.createElement("style");style.id="hami-evidence-pointer-style";style.textContent="*,*::before,*::after{cursor:none!important}";document.head.appendChild(style)}return true})()');
  try {
    const image = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { ...box, scale: 1 } });
    await writeFile(new URL(name, output), Buffer.from(image.data, 'base64'));
    capturedScreenshots.push(name);
  } finally {
    await evaluate('document.getElementById("hami-evidence-pointer-style")?.remove()');
  }
}
async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600, screenWidth: width, screenHeight: height });
  await sleep(250);
}
async function navigate(url) { await evaluate(`location.href=${JSON.stringify(url)}`); await sleep(1400); }
async function captureSection(selector, name, block = 'start') {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:${JSON.stringify(block)},behavior:'auto'})`);
  await sleep(350);
  await capture(name);
}
async function click(selector) { return evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`); }
async function typeIn(selector, text) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await send('Input.insertText', { text });
  await sleep(100);
}
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
await navigate(previewUrl);
await capture('after-desktop-1440x900.png');
check('Desktop viewport has no horizontal overflow', await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), await evaluate('`${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`'));
check('Official logo image loaded', await evaluate('[...document.querySelectorAll(".home-brand img")].every((image)=>image.complete&&image.naturalWidth>0)'));
check('Homepage sections are in reference order', await evaluate(`(()=>{const ids=['home-title','home-search','categories','providers','how-it-works'];const tops=ids.map(id=>document.getElementById(id).getBoundingClientRect().top);return tops.every((top,index)=>index===0||tops[index-1]<top)})()`));
check('All navigation/footer links have usable destinations', await evaluate('[...document.querySelectorAll("a")].length>0&&[...document.querySelectorAll("a")].every((link)=>Boolean(link.getAttribute("href")))'));
check('How-it-works content and all three steps are present', await evaluate('document.querySelectorAll("#how-it-works .home-steps > li").length===3&&Boolean(document.querySelector("#how-it-works h2"))'));
check('Footer has all reference navigation groups', await evaluate('document.querySelectorAll(".home-footer .home-footer-col").length===3&&document.querySelectorAll(".home-footer a[href]").length>=8'));
await captureSection('#how-it-works','how-it-works-1440x900.png');
await captureSection('.home-footer','footer-1440x900.png','end');
await captureElement('#how-it-works','how-it-works-section.png');
await captureElement('.home-footer','footer-section.png');
check('Dedicated how-it-works and footer screenshot evidence was captured', capturedScreenshots.includes('how-it-works-section.png') && capturedScreenshots.includes('footer-section.png'));
await evaluate('window.scrollTo(0,0)');
for (const [id, name] of [['doctor','پزشک'],['center','مرکز درمانی'],['service','خدمات و آزمایش‌ها']]) {
  await click(`#search-tab-${id}`);
  check(`Search tab ${name} selects`, await evaluate(`document.querySelector("#search-tab-${id}").getAttribute("aria-selected")==="true"`));
}
await evaluate('(()=>{const input=document.querySelector("#home-search-input");input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()})()');
await sleep(600);
await capture('search-autocomplete-default.png');
check('Default autocomplete suggestions appear', await evaluate('Boolean(document.querySelector("[role=listbox]")&&document.querySelectorAll("[role=listbox] [role=option]").length===4&&document.querySelector("#home-search-input").getAttribute("aria-expanded")==="true")'));
await typeIn('#home-search-input','MRI');
await capture('search-autocomplete-typed.png');
check('Typed autocomplete suggestion appears', (await evaluate('document.querySelectorAll("[role=option]").length')) > 0);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
check('ArrowDown updates active autocomplete choice', await evaluate('document.querySelector("#home-search-input").getAttribute("aria-activedescendant")==="home-suggestion-0"'));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
check('Enter selects active autocomplete choice', await evaluate('document.querySelector("#home-search-input").value==="MRI"&&document.querySelector("[role=listbox]")===null'));
await evaluate('document.querySelectorAll(".home-select-field select")[0].value="تصویربرداری";document.querySelectorAll(".home-select-field select")[0].dispatchEvent(new Event("change",{bubbles:true}));document.querySelectorAll(".home-select-field select")[1].value="تهران";document.querySelectorAll(".home-select-field select")[1].dispatchEvent(new Event("change",{bubbles:true}))');
check('Specialty and city dropdowns accept selections', await evaluate('[...document.querySelectorAll(".home-select-field select")].map((e)=>e.value).join("|")==="تصویربرداری|تهران"'));
await click('.home-clear-query');
check('Clear-query control clears the field', await evaluate('document.querySelector("#home-search-input").value===""'));
await typeIn('#home-search-input','MRI');
await evaluate('window.__hamiOriginalSetTimeout=window.setTimeout;window.setTimeout=function(callback,delay,...args){return window.__hamiOriginalSetTimeout(callback,delay===650?3000:delay,...args)}');
await click('.home-search-submit');
for(let index=0;index<20;index++){if(await evaluate('document.querySelector(".home-search-submit").disabled'))break;await sleep(10)}
await capture('search-loading.png');
check('Search loading state renders and disables submit', await evaluate('document.querySelector(".home-search-feedback").textContent.includes("در حال جستجو")&&document.querySelector(".home-search-submit").disabled'));
await evaluate('window.setTimeout=window.__hamiOriginalSetTimeout;delete window.__hamiOriginalSetTimeout');
await sleep(3100);
await capture('search-results.png');
check('Search results state is explicitly disclosed as demo', await evaluate('document.querySelector(".home-search-feedback").textContent.includes("نتایج جستجوی نمایشی")'));
await typeIn('#home-search-input','zzz-no-result');
await click('.home-search-submit');
await sleep(700);
await capture('search-no-results.png');
check('No-results state offers filter reset', await evaluate('document.querySelector(".home-search-feedback").textContent.includes("موردی با این مشخصات پیدا نشد")&&Boolean(document.querySelector(".home-empty-state button"))'));
await click('.home-empty-state button');
check('No-results reset restores an empty query', await evaluate('document.querySelector("#home-search-input").value===""'));
const categories = await evaluate('[...document.querySelectorAll(".home-category-copy strong")].map((label)=>label.innerText.trim())');
for (let index = 0; index < categories.length; index++) {
  await click(`.home-category-card:nth-child(${index+1})`);
  check(`Category CTA ${categories[index]} opens service search`, await evaluate(`document.querySelector("#home-search-input").value===${JSON.stringify(categories[index])}&&document.querySelector("#search-tab-service").getAttribute("aria-selected")==="true"`));
}
check('Every provider card has a directory destination', await evaluate('document.querySelectorAll(".home-provider-card a[href=\\"/providers\\"]").length===8'));
const firstProvider = await evaluate('document.querySelector(".home-provider-card h3")?.textContent');
await click('.home-provider-control--next');
check('Provider carousel next control changes visible samples', await evaluate(`document.querySelector(".home-provider-card h3")?.textContent!==${JSON.stringify(firstProvider)}`));
await click('.home-provider-control--previous');
check('Provider carousel previous control restores initial samples', await evaluate(`document.querySelector(".home-provider-card h3")?.textContent===${JSON.stringify(firstProvider)}`));
check('Login and signup header/footer CTAs point to their routes', await evaluate('document.querySelectorAll("a[href=\\"/login\\"]").length>=2&&document.querySelectorAll("a[href=\\"/register\\"]").length>=3'));
const linkInventory = await evaluate('[...document.querySelectorAll("a[href]")].map((link)=>({href:link.getAttribute("href"),label:link.innerText.trim().replace(/\\s+/g," ")||link.getAttribute("aria-label")||"brand"}))');
await evaluate('window.__homepageLinkInterceptor=(event)=>{const link=event.target.closest("a[href]");if(link){window.__activatedHref=link.getAttribute("href");event.preventDefault();event.stopImmediatePropagation()}};document.addEventListener("click",window.__homepageLinkInterceptor,true)');
for (let index = 0; index < linkInventory.length; index++) {
  const link = linkInventory[index];
  await evaluate('window.__activatedHref=""');
  await evaluate(`document.querySelectorAll("a[href]")[${index}]?.click()`);
  const actual = await evaluate('window.__activatedHref');
  check(`Link activation: ${link.label || '(unnamed)'} → ${link.href}`, actual === link.href, actual || 'activation did not reach anchor');
}
await evaluate('document.removeEventListener("click",window.__homepageLinkInterceptor,true)');
for (const route of ['/providers','/support','/plans']) {
  await navigate(new URL(route, previewUrl).href);
  const actual = await evaluate('location.pathname');
  const guarded = ['/providers','/support','/plans'].includes(route) && actual === '/login';
  check(`Route behavior: ${route}`, actual === route || guarded, guarded ? 'auth-gated redirect to /login; not publicly accessible' : actual);
}

await setViewport(390,844);
await navigate(previewUrl);
await capture('after-mobile-390x844.png');
check('390px mobile viewport has no horizontal overflow', await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'), await evaluate('`${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`'));
check('Mobile provider cards match the reference horizontal swipe row', await evaluate('(()=>{const grid=document.querySelector(".home-provider-grid");const style=getComputedStyle(grid);return style.gridAutoFlow.includes("column")&&grid.scrollWidth>grid.clientWidth&&style.scrollSnapType!=="none"})()'));
await captureSection('.home-providers','providers-mobile-390x844.png');
const mobileMenuAvailable = await evaluate('Boolean(document.querySelector(".home-menu-button"))');
check('Mobile menu control is available at 390px', mobileMenuAvailable);
if (mobileMenuAvailable) await evaluate('(()=>{const button=document.querySelector(".home-menu-button");button.focus();button.click()})()');
await sleep(700);
await capture('mobile-drawer-390x844.png');
check('Drawer receives initial keyboard focus', await evaluate('Boolean(document.querySelector(".home-mobile-drawer")?.contains(document.activeElement))'));
const drawerPosition = await evaluate('(()=>{const drawer=document.querySelector(".home-mobile-drawer");if(!drawer)return null;return{right:getComputedStyle(drawer).right,position:getComputedStyle(drawer).position,bodyOverflow:getComputedStyle(document.body).overflow,inlineOverflow:document.body.style.overflow,rectRight:drawer.getBoundingClientRect().right}})()');
check('Drawer is right-anchored and prevents background scrolling', drawerPosition?.right === '0px' && drawerPosition?.inlineOverflow === 'hidden', JSON.stringify(drawerPosition));
check('Drawer is modal and includes four navigation links', await evaluate('document.querySelectorAll(".home-mobile-drawer[role=dialog][aria-modal=true] nav a").length===4'));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
check('Shift+Tab wraps focus to the last drawer action', await evaluate('document.activeElement===document.querySelector(".home-drawer-actions a:last-child")'));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
check('Tab wraps focus back to the first drawer control', await evaluate('document.activeElement===document.querySelector(".home-mobile-drawer .home-brand")'));
await click('.home-icon-button');
await sleep(80);
check('Close icon closes drawer', await evaluate('!document.querySelector(".home-mobile-drawer")'));
check('Closing the drawer restores focus to the menu button', await evaluate('document.activeElement.matches(".home-menu-button")'));
await click('.home-menu-button');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
check('Escape closes drawer', await evaluate('!document.querySelector(".home-mobile-drawer")'));
await click('.home-menu-button');
await click('.home-drawer-backdrop');
check('Backdrop click closes drawer', await evaluate('!document.querySelector(".home-mobile-drawer")'));
await navigate(new URL('/login', previewUrl).href);
check('Login route uses the shared branded authentication shell', await evaluate('Boolean(document.querySelector(".auth-experience .auth-stage .auth-panel"))&&Boolean(document.querySelector(".auth-visual"))'));
check('Login page stylesheet is loaded before visual capture', await evaluate('[...document.styleSheets].some((sheet)=>sheet.href?.includes("/_next/static/css/"))&&getComputedStyle(document.querySelector(".auth-stage")).display==="grid"'));
await send('Fetch.enable',{patterns:[{urlPattern:'*api/v1/auth/login/password*',requestStage:'Request'}]});
mockLoginFailureEnabled = true;
await typeIn('#phone','00000000000');
await typeIn('#password','demo-only-not-a-credential');
await click('form[aria-label="ورود"] button[type=submit]');
for(let index=0;index<30;index++){if(await evaluate('Boolean(document.querySelector(".auth-feedback")?.textContent?.trim())'))break;await sleep(150)}
mockLoginFailureEnabled = false;
await send('Fetch.disable');
await evaluate('document.activeElement?.blur()');
await capture('login-error-390x844.png');
check('Login error state is visible and announced assertively', await evaluate('Boolean(document.querySelector(".auth-feedback--error")?.textContent?.trim())&&document.querySelector(".auth-feedback--error")?.getAttribute("role")==="alert"'));
check('Login error screenshot uses the explicit local AUTH_FAILED fixture', mockLoginFailureHit);
check('Login evidence uses only an obviously synthetic phone and password', await evaluate('document.querySelector("#phone").value==="00000000000"&&document.querySelector("#password").value==="demo-only-not-a-credential"'));
check('No unexpected application console/runtime errors', errors.length===0, errors.join(' | '));
const report=checks.map((item)=>`${item.pass?'PASS':'FAIL'} | ${item.name}${item.details?` | ${item.details}`:''}`).join('\n');
await writeFile(new URL('INTERACTION-CHECKLIST.txt',output),report+'\n','utf8');
const failed=checks.filter((item)=>!item.pass);
console.log(JSON.stringify({total:checks.length,passed:checks.length-failed.length,failed,errors},null,2));
await send('Emulation.clearDeviceMetricsOverride');
socket.close();
if(failed.length)process.exitCode=1;
