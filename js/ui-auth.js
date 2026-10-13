/* Sign up and log in. Talks to API.signup / API.login / API.logout / API.me. */
let USER=null,afterAuth=null,aMode='up',aOpener=null;
const aov=document.createElement('div');
aov.className='overlay';aov.hidden=true;aov.style.zIndex=70;
aov.innerHTML='<div class="sheet" id="asheet" role="dialog" aria-modal="true" aria-labelledby="a-title"></div>';
document.body.appendChild(aov);

function renderAuth(){
  $('auth-nav').innerHTML=USER
    ?`<a class="me" href="profile.html" title="Your profile"${document.body.dataset.page==='profile'&&!location.search.includes('u=')?' aria-current="page"':''}>${avatar({name:USER.name,cat:'Other',avatar:USER.avatar},28)}<span>${esc(USER.name.split(' ')[0])}</span></a><button class="navbtn" type="button" data-auth="out">Log out</button>`
    :`<button class="navbtn" type="button" data-auth="in">Log in</button><button class="btn" type="button" data-auth="up">Sign up</button>`;
}
function setUser(u){USER=u;renderAuth();$('open-dash').hidden=!u;if(typeof refreshBadge==='function')refreshBadge();if(typeof initMessagesPage==='function')initMessagesPage();if(typeof loadProfile==='function')loadProfile()}

function drawAuth(msg,keep){
  keep=keep||{};
  if(aMode==='forgot'){
    $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">Reset your password</h2><button class="x" id="a-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <p style="margin:12px 0">Enter the email you signed up with and we’ll send you a link to choose a new password.</p>
    <form id="a-form" novalidate>
      <div class="f"><label for="a-email">Email</label><input type="text" inputmode="email" id="a-email" autocomplete="email" placeholder="you@example.com" value="${esc(keep.email)}"></div>
      <div class="ts" id="a-ts"></div>
      <p class="err" id="a-err" role="alert" ${msg?'':'hidden'}>${esc(msg||'')}</p>
      <div class="row-btns"><button class="btn ghost" type="button" data-am="in">Back to log in</button><button class="btn pink" type="submit">Send reset link</button></div>
    </form>`;
    tsMount();
    return;
  }
  const up=aMode==='up';
  $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">${up?'Join the Board':'Welcome back'}</h2><button class="x" id="a-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <div class="mtog" role="group" aria-label="Sign up or log in" style="margin:14px 0"><button type="button" data-am="up" aria-pressed="${up}">Sign up</button><button type="button" data-am="in" aria-pressed="${!up}">Log in</button></div>
    <form id="a-form" novalidate>
      ${up?`<div class="f"><label for="a-name">Your name</label><input type="text" id="a-name" autocomplete="name" maxlength="40" value="${esc(keep.name)}"></div>`:''}
      <div class="f"><label for="a-email">Email</label><input type="text" inputmode="email" id="a-email" autocomplete="email" placeholder="you@example.com" value="${esc(keep.email)}"></div>
      <div class="f"><label for="a-pw">Password ${up?'<span class="hint">at least 8 characters</span>':''}</label><input type="password" id="a-pw" autocomplete="${up?'new-password':'current-password'}" maxlength="128">
        ${up?'':'<button class="link" type="button" data-am="forgot" style="margin-top:6px">Forgot password?</button>'}</div>
      ${up?`<div class="f"><label for="a-type">I'm joining as</label><select id="a-type"><option value="student">A student looking for services</option><option value="business" ${keep.type==='business'?'selected':''}>A student running a business or society</option></select></div>
      <label class="check" for="a-agree"><input type="checkbox" id="a-agree" ${keep.agree?'checked':''}>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of use</a> and have read the <a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a>. I understand the Board is a listings platform only and is not an official university or students’ union service.</label>
      <div class="ts" id="a-ts"></div>`:''}
      <p class="err" id="a-err" role="alert" ${msg?'':'hidden'}>${esc(msg||'')}</p>
      ${API.cfg.demoLogins&&!up?'<p class="hint" style="margin:0 0 10px">Demo: see the business side with <button class="link" type="button" id="a-demo">the demo business account</button> (owner@demo.test / demo1234).</p>':''}
      <div class="row-btns"><span class="hint" style="align-self:center">${API.isMock?'Demo: accounts stay in this browser.':''}</span><button class="btn pink" type="submit">${up?'Create account':'Log in'}</button></div>
    </form>`;
  if(up)tsMount();
}
/* Bot check (Cloudflare Turnstile) on sign-up and "forgot password". Only shown when the server has it switched on. */
const TS={key:undefined,ready:null,token:'',wid:null};
async function tsKey(){if(TS.key===undefined){try{TS.key=(await API.authConfig()).turnstileSiteKey||null}catch(_){TS.key=null}}return TS.key}
function tsLoad(){
  if(!TS.ready)TS.ready=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=res;s.onerror=()=>{TS.ready=null;rej()};document.head.appendChild(s)});
  return TS.ready;
}
async function tsMount(){
  TS.token='';
  if(TS.wid!=null&&window.turnstile){try{turnstile.remove(TS.wid)}catch(_){}TS.wid=null}
  const el=$('a-ts');if(!el)return;
  const k=await tsKey();if(!k||!el.isConnected)return;
  try{await tsLoad()}catch(_){return}
  if(!el.isConnected)return;
  TS.wid=turnstile.render(el,{sitekey:k,callback:t=>{TS.token=t},'expired-callback':()=>{TS.token=''},'error-callback':()=>{TS.token=''}});
}
const tsMissing=()=>TS.key&&!TS.token;

/* "Check your email" after signing up (kind 'verify') or asking for a password reset (kind 'reset'). */
let aEmail='';
function drawNotice(kind,email,lead){
  aEmail=email;aMode='notice';
  const body=kind==='verify'
    ?`${lead?esc(lead)+' ':''}We’ve sent a link to <b>${esc(email)}</b>. Open it to confirm your email and you’re in. The link works once and expires in 24 hours.`
    :`If <b>${esc(email)}</b> has an account on the Board, we’ve sent it a link to choose a new password. The link works once and expires in 30 minutes.`;
  $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">${kind==='verify'&&lead?'Confirm your email first':'Check your email'}</h2><button class="x" id="a-x" type="button" aria-label="Close">${X_ICON}</button></div>
    <p style="margin:14px 0">${body}</p>
    <p class="hint" style="margin:0 0 14px">Can’t find it? Check your spam or junk folder.${API.isMock?' (Demo mode doesn’t send emails.)':''}</p>
    <div class="row-btns"><button class="btn ghost" type="button" data-am="in">Back to log in</button>${kind==='verify'?'<button class="btn" type="button" id="a-resend">Send it again</button>':''}</div>`;
  $('a-title').focus();
}
function openAuth(mode,cb,btn){
  aMode=mode;afterAuth=cb||null;aOpener=btn||document.activeElement;
  aov.hidden=false;document.body.style.overflow='hidden';drawAuth();$('a-title').focus();
}
function closeAuth(){aov.hidden=true;if(dov.hidden&&mov.hidden&&ov.hidden)document.body.style.overflow='';if(aOpener&&aOpener.isConnected)aOpener.focus()}

aov.addEventListener('click',e=>{
  if(e.target===aov||e.target.closest('#a-x')){closeAuth();return}
  const m=e.target.closest('[data-am]');if(m){const em=$('a-email')?$('a-email').value.trim():aEmail;aMode=m.dataset.am;drawAuth(null,{email:em});$('a-title').focus();return}
  const rs=e.target.closest('#a-resend');
  if(rs){
    rs.disabled=true;rs.textContent='Sending…';
    API.resendVerification(aEmail).then(()=>{rs.textContent='Sent';say('Sent again. Check your inbox.')},err=>{rs.textContent='Send it again';say(errMsg(err))})
      .finally(()=>setTimeout(()=>{if(rs.isConnected){rs.disabled=false;rs.textContent='Send it again'}},30000));
    return;
  }
  if(e.target.closest('#a-demo')){$('a-email').value='owner@demo.test';$('a-pw').value='demo1234';$('a-form').requestSubmit()}
  const ug=e.target.closest('#up-yes');
  if(ug)doUpgrade(ug);
  if(e.target.closest('#up-no'))closeAuth();
});
aov.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!$('a-form'))return;
  if(aMode==='forgot'){
    const email=$('a-email').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){drawAuth('Add a valid email address.',{email});$('a-email').focus();return}
    if(tsMissing()){const er=$('a-err');er.textContent='Please complete the “I’m human” check first.';er.hidden=false;return}
    const done=busy(e.target.querySelector('button[type=submit]'),'Sending…');
    try{await API.forgotPassword(email,TS.token||undefined)}catch(err){done();drawAuth(errMsg(err),{email});return}
    drawNotice('reset',email);return;
  }
  const up=aMode==='up';
  const keep={name:up?$('a-name').value.trim():'',email:$('a-email').value.trim(),type:up?$('a-type').value:'',agree:up&&$('a-agree').checked};
  const pw=$('a-pw').value;
  /* Quick checks so people get instant feedback. The server checks everything again. */
  const miss=[];
  if(up&&!keep.name)miss.push('your name');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(keep.email))miss.push('a valid email address');
  if(pw.length<8)miss.push('a password of at least 8 characters');
  if(up&&!keep.agree)miss.push('your agreement to continue');
  if(!miss.length&&up&&tsMissing()){const er=$('a-err');er.textContent='Please complete the “I’m human” check first.';er.hidden=false;return}
  if(miss.length){drawAuth('Add '+miss.join(', ')+'.',keep);(up&&!keep.name?$('a-name'):$('a-email')).focus();return}
  const done=busy(e.target.querySelector('button[type=submit]'),up?'Creating…':'Logging in…');
  let user;
  try{
    if(up){const r=await API.signup({name:keep.name,email:keep.email,password:pw,type:keep.type,turnstileToken:TS.token||undefined});if(r.pending){drawNotice('verify',r.email||keep.email);return}user=r.user}
    else user=await API.login({email:keep.email,password:pw});
  }
  catch(err){
    done();
    if(err.code==='email_unverified'){drawNotice('verify',keep.email,'You need to confirm your email before you can log in.');return}
    drawAuth(errMsg(err),keep);$('a-pw').focus();return;
  }
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
    <p style="margin:12px 0">Your account is a student account, which is for finding and messaging businesses. Switch it to a business account to list a business or society. You will also get a business dashboard and an inbox for customer messages.</p>
    <p class="err" id="up-err" role="alert" hidden></p>
    <div class="row-btns"><button class="btn ghost" type="button" id="up-no">Not now</button><button class="btn pink" type="button" id="up-yes">Switch to a business account</button></div>`;
  $('a-title').focus();
}
async function doUpgrade(btn){
  const done=busy(btn,'Switching…');
  try{const u=await API.upgrade();setUser(u);const cb=afterUpgrade;afterUpgrade=null;aov.hidden=true;if(dov.hidden&&mov.hidden)document.body.style.overflow='';say('You now have a business account');if(cb)cb()}
  catch(e){done();const er=$('up-err');er.textContent=errMsg(e);er.hidden=false}
}
