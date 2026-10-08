/* Sign up and log in. Talks to API.signup / API.login / API.logout / API.me. */
let USER=null,afterAuth=null,aMode='up',aOpener=null;
const aov=document.createElement('div');
aov.className='overlay';aov.hidden=true;aov.style.zIndex=70;
aov.innerHTML='<div class="sheet" id="asheet" role="dialog" aria-modal="true" aria-labelledby="a-title"></div>';
document.body.appendChild(aov);

function renderAuth(){
  $('auth-nav').innerHTML=USER
    ?`<span class="me">${avatar({name:USER.name,cat:'Other'},28)}<span>Hi, ${esc(USER.name.split(' ')[0])}</span></span><button class="navbtn" type="button" data-auth="out">Log out</button>`
    :`<button class="navbtn" type="button" data-auth="in">Log in</button><button class="btn" type="button" data-auth="up">Sign up</button>`;
}
function setUser(u){USER=u;renderAuth();$('open-dash').hidden=!u;if(typeof refreshBadge==='function')refreshBadge();if(typeof initMessagesPage==='function')initMessagesPage()}

function drawAuth(msg,keep){
  keep=keep||{};
  const up=aMode==='up';
  $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">${up?'Join the Board':'Welcome back'}</h2><button class="x" id="a-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <div class="mtog" role="group" aria-label="Sign up or log in" style="margin:14px 0"><button type="button" data-am="up" aria-pressed="${up}">Sign up</button><button type="button" data-am="in" aria-pressed="${!up}">Log in</button></div>
    <form id="a-form" novalidate>
      ${up?`<div class="f"><label for="a-name">Your name</label><input type="text" id="a-name" autocomplete="name" maxlength="40" value="${esc(keep.name)}"></div>`:''}
      <div class="f"><label for="a-email">Email</label><input type="text" inputmode="email" id="a-email" autocomplete="email" placeholder="you@example.com" value="${esc(keep.email)}"></div>
      <div class="f"><label for="a-pw">Password ${up?'<span class="hint">at least 8 characters</span>':''}</label><input type="password" id="a-pw" autocomplete="${up?'new-password':'current-password'}"></div>
      ${up?`<div class="f"><label for="a-type">I'm joining as</label><select id="a-type"><option value="student">A student looking for services</option><option value="business" ${keep.type==='business'?'selected':''}>A student running a business</option></select></div>
      <label class="check" for="a-agree"><input type="checkbox" id="a-agree" ${keep.agree?'checked':''}>I understand the Board is a listings platform only and is not an official university or students’ union service.</label>`:''}
      <p class="err" id="a-err" role="alert" ${msg?'':'hidden'}>${esc(msg||'')}</p>
      ${API.cfg.demoLogins&&!up?'<p class="hint" style="margin:0 0 10px">Demo: see the business side with <button class="link" type="button" id="a-demo">the demo business account</button> (owner@demo.test / demo1234).</p>':''}
      <div class="row-btns"><span class="hint" style="align-self:center">${API.isMock?'Demo: accounts stay in this browser.':''}</span><button class="btn pink" type="submit">${up?'Create account':'Log in'}</button></div>
    </form>`;
}
function openAuth(mode,cb,btn){
  aMode=mode;afterAuth=cb||null;aOpener=btn||document.activeElement;
  aov.hidden=false;document.body.style.overflow='hidden';drawAuth();$('a-title').focus();
}
function closeAuth(){aov.hidden=true;if(dov.hidden&&mov.hidden&&ov.hidden)document.body.style.overflow='';if(aOpener&&aOpener.isConnected)aOpener.focus()}

aov.addEventListener('click',e=>{
  if(e.target===aov||e.target.closest('#a-x')){closeAuth();return}
  const m=e.target.closest('[data-am]');if(m){aMode=m.dataset.am;drawAuth();$('a-title').focus();return}
  if(e.target.closest('#a-demo')){$('a-email').value='owner@demo.test';$('a-pw').value='demo1234';$('a-form').requestSubmit()}
  const ug=e.target.closest('#up-yes');
  if(ug)doUpgrade(ug);
  if(e.target.closest('#up-no'))closeAuth();
});
aov.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!$('a-form'))return;
  const up=aMode==='up';
  const keep={name:up?$('a-name').value.trim():'',email:$('a-email').value.trim(),type:up?$('a-type').value:'',agree:up&&$('a-agree').checked};
  const pw=$('a-pw').value;
  /* Quick checks so people get instant feedback. The server checks everything again. */
  const miss=[];
  if(up&&!keep.name)miss.push('your name');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(keep.email))miss.push('a valid email address');
  if(pw.length<8)miss.push('a password of at least 8 characters');
  if(up&&!keep.agree)miss.push('your agreement to continue');
  if(miss.length){drawAuth('Add '+miss.join(', ')+'.',keep);(up&&!keep.name?$('a-name'):$('a-email')).focus();return}
  const done=busy(e.target.querySelector('button[type=submit]'),up?'Creating…':'Logging in…');
  let user;
  try{user=up?await API.signup({name:keep.name,email:keep.email,password:pw,type:keep.type}):await API.login({email:keep.email,password:pw})}
  catch(err){done();drawAuth(errMsg(err),keep);$('a-pw').focus();return}
  setUser(user);
  const cb=afterAuth;afterAuth=null;aOpener=$('auth-nav');
  aov.hidden=true;if(dov.hidden&&mov.hidden)document.body.style.overflow='';
  say(up?'Welcome to the Board, '+user.name.split(' ')[0]:'Logged in');
  if(cb)cb();
  else if(up&&user.type==='business')openSheet({currentTarget:$('auth-nav')});
});
$('auth-nav').addEventListener('click',async e=>{
  const b=e.target.closest('[data-auth]');if(!b)return;
  if(b.dataset.auth==='out'){await API.logout();setUser(null);closeMsgIfOpen();say('Logged out');return}
  openAuth(b.dataset.auth,null,b);
});
document.addEventListener('keydown',e=>{
  if(aov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeAuth();return}
  if(e.key!=='Tab')return;
  const f=[...aov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='a-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* Called by js/api.js when the server says the session is no longer valid. */
API.onUnauthenticated(()=>{setUser(null);closeMsgIfOpen();say('Your session ended. Log in again.')});
/* Ask for login, then run `then`. */
function requireLogin(then,btn){if(USER){then();return true}openAuth('up',then,btn);return false}

/* Students can switch to a business account. Listing needs one. */
let afterUpgrade=null;
function askUpgrade(cb,btn){
  afterUpgrade=cb||null;aOpener=btn||document.activeElement;
  aov.hidden=false;document.body.style.overflow='hidden';
  $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">Listing is for business accounts</h2><button class="x" id="a-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <p style="margin:12px 0">Your account is a student account, which is for finding and messaging businesses. Switch it to a business account to list a business or notice. You will also get a business dashboard and an inbox for customer messages.</p>
    <p class="err" id="up-err" role="alert" hidden></p>
    <div class="row-btns"><button class="btn ghost" type="button" id="up-no">Not now</button><button class="btn pink" type="button" id="up-yes">Switch to a business account</button></div>`;
  $('a-title').focus();
}
async function doUpgrade(btn){
  const done=busy(btn,'Switching…');
  try{const u=await API.upgrade();setUser(u);const cb=afterUpgrade;afterUpgrade=null;aov.hidden=true;if(dov.hidden&&mov.hidden)document.body.style.overflow='';say('You now have a business account');if(cb)cb()}
  catch(e){done();const er=$('up-err');er.textContent=errMsg(e);er.hidden=false}
}
