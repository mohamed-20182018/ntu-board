/* Appearance: Light / Dark / Auto. Auto follows the device's prefers-color-scheme.
   The inline script in each page's <head> applies the saved choice before first paint
   (so there's no flash); this file adds the Settings button and the sheet that changes it. */
const THEME_KEY='board-theme';
function applyTheme(mode){
  if(mode==='light'||mode==='dark')document.documentElement.setAttribute('data-theme',mode);
  else document.documentElement.removeAttribute('data-theme');
}
function currentTheme(){try{return localStorage.getItem(THEME_KEY)||'auto'}catch(e){return 'auto'}}
function setTheme(mode){
  try{mode==='auto'?localStorage.removeItem(THEME_KEY):localStorage.setItem(THEME_KEY,mode)}catch(e){}
  applyTheme(mode);drawSettings();
}
let sOpener=null;
const sov=document.createElement('div');
sov.className='overlay';sov.hidden=true;sov.style.zIndex=80;
sov.innerHTML='<div class="sheet" id="ssheet" role="dialog" aria-modal="true" aria-labelledby="s-title"></div>';
document.body.appendChild(sov);
function drawSettings(){
  const t=currentTheme();
  $('ssheet').innerHTML=`<div class="sheet-head"><h2 id="s-title" tabindex="-1">Settings</h2><button class="x" id="s-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <div class="f">
      <label id="s-appearance-label">Appearance</label>
      <div class="mtog tri" role="group" aria-labelledby="s-appearance-label">
        <button type="button" data-theme-opt="light" aria-pressed="${t==='light'}">Light</button>
        <button type="button" data-theme-opt="dark" aria-pressed="${t==='dark'}">Dark</button>
        <button type="button" data-theme-opt="auto" aria-pressed="${t==='auto'}">Auto</button>
      </div>
      <p class="hint" style="margin-top:10px">Auto matches whatever your phone or browser is set to.</p>
    </div>`;
}
function openSettings(btn){
  sOpener=btn||document.activeElement;sov.hidden=false;document.body.style.overflow='hidden';drawSettings();$('s-title').focus();
}
function closeSettings(){
  sov.hidden=true;
  if(ov.hidden&&dov.hidden&&mov.hidden&&aov.hidden&&dsh.hidden)document.body.style.overflow='';
  if(sOpener&&sOpener.isConnected)sOpener.focus();
}
sov.addEventListener('click',e=>{
  if(e.target===sov||e.target.closest('#s-x')){closeSettings();return}
  const b=e.target.closest('[data-theme-opt]');if(b)setTheme(b.dataset.themeOpt);
});
document.addEventListener('keydown',e=>{
  if(sov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeSettings();return}
  if(e.key!=='Tab')return;
  const f=[...sov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='s-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* The floating Settings button lives on every page, under the site chrome shell injects. */
const fab=document.createElement('button');
fab.className='theme-fab';fab.type='button';fab.id='open-settings';fab.setAttribute('aria-label','Settings');
fab.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .12-.64l-2-3.4a.5.5 0 0 0-.6-.22l-2.5 1a7.8 7.8 0 0 0-1.7-1l-.38-2.6a.5.5 0 0 0-.5-.44h-4a.5.5 0 0 0-.5.44l-.38 2.6a7.8 7.8 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.22l-2 3.4a.5.5 0 0 0 .12.64L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.12.64l2 3.4c.13.22.39.3.6.22l2.5-1c.5.4 1.08.74 1.7 1l.38 2.6c.04.25.26.44.5.44h4c.25 0 .46-.19.5-.44l.38-2.6c.62-.26 1.2-.6 1.7-1l2.5 1c.22.08.48 0 .6-.22l2-3.4a.5.5 0 0 0-.12-.64L19.4 13Z"/></svg>';
document.body.appendChild(fab);
fab.addEventListener('click',e=>openSettings(e.currentTarget));
