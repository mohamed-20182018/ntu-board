/* the Board: shared code for every page (header, accounts, theme, admin, dialogs).
   Talks to Supabase with the public key; the database rules decide what anyone can read or change. */
"use strict";
const PAGE=document.body.dataset.page||'home';

/* ---------- icons (one stroke style) ---------- */
const ICONS={
  scissors:'M9 6a3 3 0 11-6 0 3 3 0 016 0z M9 18a3 3 0 11-6 0 3 3 0 016 0z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  sparkle:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cup:'M5 8h12v5a5 5 0 01-5 5h-2a5 5 0 01-5-5V8z M17 9h1.5a2.5 2.5 0 010 5H17 M8 3v2 M12 3v2',
  camera:'M3 8a2 2 0 012-2h2l1.5-2.5h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z M16 13a4 4 0 11-8 0 4 4 0 018 0z',
  eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  star:'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  users:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8',
  bell:'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 003.4 0',
  pound:'M18 7a4 4 0 00-4-3c-2.5 0-4 1.6-4 4v4 M6 12h8 M6 20h12 M10 12v4c0 2-1 3-4 4',
  chat:'M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1121 12z',
  gift:'M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
  pin:'M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z M14.5 9.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  share:'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7 M16 6l-4-4-4 4 M12 2v13'
};
const svg=(d,s=40,w=1.8)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const XSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CAT={
  Hair:{c:'#FFB8D9',i:'scissors'}, Nails:{c:'#FFD84D',i:'sparkle'}, Lashes:{c:'#F7B8E0',i:'eye'},
  Food:{c:'#B8F2D8',i:'cup'}, Photography:{c:'#FFC9A8',i:'camera'}, Other:{c:'#DAD6EA',i:'star'}
};
const SOC_COLOUR='#9FE8CF';
const SUBS={Hair:['Barbers','Braids'],Nails:['Gel & BIAB','Acrylics','Nail art'],Lashes:['Lash extensions','Lash lifts','Brows'],Food:['Cakes & bakes','Meal prep','Hot meals','Snacks'],Photography:['Grad shoots','Portraits','Events']};
const SUB_TO_CAT={};
Object.entries(SUBS).forEach(([c,ss])=>ss.forEach(s=>SUB_TO_CAT[s]=c));

/* ---------- Supabase ---------- */
const SUPA='https://xvenwgfvgkdauxfkcgcg.supabase.co';
const sb=window.supabase.createClient(SUPA,'sb_publishable_BgpvbiU9CkH2y1WSS3ZPWw_6yTCivS0');
const BUCKET='listing-photos',PHOTO_BASE=SUPA+'/storage/v1/object/public/'+BUCKET+'/';
const MAXPH=4;
/* only show pictures that live in our own storage bucket */
const okImg=u=>typeof u==='string'&&u.startsWith(PHOTO_BASE)&&!/["'<>\s\\]/.test(u);
const cleanMenu=m=>Array.isArray(m)?m.slice(0,10).map(g=>({g:g&&typeof g.g==='string'?g.g.slice(0,40):null,items:Array.isArray(g&&g.items)?g.items.slice(0,30).filter(Array.isArray).map(i=>[String(i[0]||'').slice(0,80),String(i[1]||'').slice(0,30)]):[]})).filter(g=>g.items.length):[];
const cleanList=(a,n,len)=>(Array.isArray(a)?a:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,n).map(x=>x.trim().slice(0,len));
function bizFromRow(row){
  const w=row.what||'';
  /* "what" holds the type (e.g. Braids) or, if there isn't one, the category itself */
  const cat=SUB_TO_CAT[w]||(CAT[w]?w:'Other');
  const sub=SUB_TO_CAT[w]?w:'';
  return {kind:'business',id:row.id,name:row.name||'',cat,sub,desc:row.description||'',meta:[row.location].filter(Boolean),price:row.price||'',contact:row.contact||'',menu:cleanMenu(row.menu),policy:typeof row.policy==='string'&&row.policy.trim()?row.policy.slice(0,300):null,photos:(Array.isArray(row.photos)?row.photos:[]).filter(okImg).slice(0,MAXPH),avatar:okImg(row.avatar)?row.avatar:'',promoted:row.promoted===true,reviews:[],sections:[],status:row.status||'live',owner:row.owner_id,created:row.created_at};
}
function socFromRow(row){
  return {kind:'society',id:row.id,name:row.name||'',cat:row.what||'Other',desc:row.description||'',meta:(row.meet||'').split(',').map(s=>s.trim()).filter(Boolean),contact:row.contact||'',photos:(Array.isArray(row.photos)?row.photos:[]).filter(okImg).slice(0,MAXPH),membership:typeof row.membership_price==='string'?row.membership_price.trim().slice(0,40):'',perks:cleanList(row.perks,8,80),promoted:row.promoted===true,status:row.status||'live',owner:row.owner_id,created:row.created_at};
}
const fmtDate=d=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
function reviewFromRow(x){return {id:x.id,s:x.stars,t:x.body,w:x.reviewer_name||'Student',x:fmtDate(x.created_at),at:x.created_at,mine:!!USER&&x.user_id===USER.id,uid:x.user_id,status:x.status,bid:x.business_id}}
/* Live rows, plus anything the signed-in person posted themselves (the database enforces the same). */
async function rowsFor(table,ownCol,me){
  const live=sb.from(table).select('*').eq('status','live').order('created_at',{ascending:false}).limit(1000);
  const own=me?sb.from(table).select('*').eq(ownCol,me.id).order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[]});
  const [a,b]=await Promise.all([live,own]);
  if(a.error)throw a.error;
  const seen=new Set(),out=[];
  [...(a.data||[]),...(b.data||[])].forEach(x=>{if(!seen.has(String(x.id))){seen.add(String(x.id));out.push(x)}});
  return out;
}
async function sessionUser(){
  const me=((await sb.auth.getSession()).data.session||{}).user||null;
  if(me&&!USER){USER=userFrom(me);renderAuth()}
  return me;
}
/* links to a listing's own page */
const listingUrl=it=>'/listing.html?'+(it.kind==='society'?'s=':'b=')+encodeURIComponent(it.id);

/* ---------- small helpers ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const liveRv=it=>(it.reviews||[]).filter(r=>r.status!=='pending');
const avg=it=>{const l=liveRv(it);return l.length?l.reduce((a,r)=>a+r.s,0)/l.length:0};
const stars=(n,sz=14)=>{const r=Math.round(n);return `<span class="stars" role="img" aria-label="${n.toFixed(1)} out of 5">${[1,2,3,4,5].map(i=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${i<=r?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS.star}"/></svg>`).join('')}</span>`};
const fromPrice=it=>{const v=[].concat(...(it.menu||[]).filter(g=>g.g!=='Add-ons').map(g=>g.items.map(i=>{const m=String(i[1]).match(/\d+(\.\d+)?/);return m?parseFloat(m[0]):NaN}))).filter(x=>!isNaN(x));return v.length?'From £'+Math.min(...v):''};
const initials=n=>String(n||'').split(/\s+/).filter(w=>/^[A-Za-z0-9]/.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
const colourFor=it=>it.kind==='society'?SOC_COLOUR:(CAT[it.cat]||CAT.Other).c;
const avatar=(it,sz)=>`<span class="av" aria-hidden="true" style="--s:${sz}px;background:${colourFor(it)}">${it.avatar?`<img src="${esc(it.avatar)}" alt="" decoding="async">`:`<b>${esc(initials(it.name))}</b>`}</span>`;
const menuHTML=it=>(it.menu||[]).map(g=>`${g.g?`<h4>${esc(g.g)}</h4>`:''}${g.items.map(i=>`<div class="mrow"><span>${esc(i[0])}</span><i aria-hidden="true"></i><b>${esc(i[1])}</b></div>`).join('')}`).join('');
let tt;
function say(m,ms){const t=$('toast');if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,ms||2400)}
function copyText(v,fallbackEl){
  const fb=()=>{if(fallbackEl){const r=document.createRange();r.selectNodeContents(fallbackEl);const s=getSelection();s.removeAllRanges();s.addRange(r);say('Selected. Copy it from here')}else say('Select and copy: '+v,4000)};
  try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),fb)}catch(_){fb()}
}
/* the page only scrolls again once every pop-up is closed */
function unlockScroll(){if(![...document.querySelectorAll('.overlay')].some(o=>!o.hidden))document.body.style.overflow=''}
function makeOverlay(id,z,cls,label){
  const o=document.createElement('div');o.className='overlay';o.hidden=true;o.style.zIndex=z;
  o.innerHTML=`<div class="sheet ${cls||''}" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${label}"></div>`;
  document.body.appendChild(o);return o;
}
/* keep Tab inside an open pop-up */
function trapTab(e,box,titleId){
  const f=[...box.querySelectorAll('a[href],button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id===titleId)){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
}

/* ---------- header, phone menu and footer (same on every page) ---------- */
const SUN='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>';
const NAV=[
  {k:'browse',t:'Browse',h:'/#browse'},
  {k:'rankings',t:'Rankings',h:'/rankings.html'},
  {k:'messages',t:'Messages',h:'/messages.html',badge:true},
  {k:'how',t:'How it works',h:'/how-it-works.html'}
];
(function buildChrome(){
  const head=$('site-header');
  const listBtn=PAGE==='home'?'<button class="btn pink listbtn" type="button" data-open-register>List a business</button>':'<a class="btn pink listbtn" href="/#list">List a business</a>';
  head.className='bar';
  head.innerHTML=`<div class="wrap"><div class="pill">
    <a class="logo" href="/"><span class="pin" aria-hidden="true"></span>the Board</a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(n=>`<a class="l" href="${n.h}"${n.k===PAGE?' aria-current="page"':''}>${n.t}${n.badge?'<span class="mbadge" data-badge hidden></span>':''}</a>`).join('')}
      <span class="authnav" id="auth-nav"></span>
      ${listBtn}
      <button class="tswitch" type="button" role="switch" id="theme-t" aria-label="Dark mode" aria-checked="false"><span class="ts-i ts-sun">${SUN}</span><span class="ts-i ts-moon">${MOON}</span></button>
      <button class="x menubtn" type="button" id="menu-b" aria-label="Menu" aria-expanded="false" aria-controls="mmenu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="mbadge dot" data-badge hidden></span></button>
    </nav>
  </div>
  <div class="mmenu" id="mmenu" hidden><nav aria-label="Menu">
    ${NAV.map(n=>`<a href="${n.h}"${n.k===PAGE?' aria-current="page"':''}>${n.t}${n.badge?'<span class="mbadge" data-badge hidden></span>':''}</a>`).join('')}
    <div id="mm-auth"></div>
    ${PAGE==='home'?'<button class="btn pink" type="button" data-open-register>List a business</button>':'<a class="btn pink" href="/#list">List a business</a>'}
  </nav></div></div>`;
  const foot=$('site-footer');
  if(foot)foot.innerHTML=`<div class="wrap">
    <div class="notice"><span class="pin" aria-hidden="true"></span><div><strong>Every listing and review is posted by a student.</strong> Message a business on the Board, or use the contact details on their listing.</div></div>
    <nav class="flinks" aria-label="About the Board"><a href="/how-it-works.html">How it works</a><a href="/rankings.html">Rankings</a><a href="/rules.html">Community rules</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="mailto:daxsintech@gmail.com">Contact us</a><button type="button" id="theme-auto">Match my device’s theme</button></nav>
    <small>The Board is a listings platform only. We don't vet, endorse, or take responsibility for the quality of anyone's product or service. Not an official university or students’ union service. Run by DAXSintech, Nottingham.</small>
    <div class="big" aria-hidden="true">the Board</div>
  </div>`;
  const t=document.createElement('div');t.className='toast';t.id='toast';t.setAttribute('role','status');t.hidden=true;document.body.appendChild(t);
})();
/* phone menu */
const menuB=$('menu-b'),mmenu=$('mmenu');
function setMenu(open){mmenu.hidden=!open;menuB.setAttribute('aria-expanded',open);menuB.setAttribute('aria-label',open?'Close menu':'Menu')}
menuB.addEventListener('click',()=>setMenu(mmenu.hidden));
mmenu.addEventListener('click',e=>{if(e.target.closest('a,button'))setMenu(false)});
document.addEventListener('click',e=>{if(!mmenu.hidden&&!e.target.closest('#mmenu,#menu-b'))setMenu(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mmenu.hidden){setMenu(false);menuB.focus()}});
matchMedia('(min-width:981px)').addEventListener('change',e=>{if(e.matches)setMenu(false)});

/* ---------- light / dark switch ---------- */
const THEME_KEY='board-theme',darkMQ=matchMedia('(prefers-color-scheme: dark)');
function storedTheme(){try{return localStorage.getItem(THEME_KEY)}catch(e){return null}}
function isDark(){const s=storedTheme();return s?s==='dark':darkMQ.matches}
function paintTheme(){
  const s=storedTheme();
  if(s==='light'||s==='dark')document.documentElement.setAttribute('data-theme',s);else document.documentElement.removeAttribute('data-theme');
  $('theme-t').setAttribute('aria-checked',isDark());
  const a=$('theme-auto');if(a)a.hidden=!s;
}
$('theme-t').addEventListener('click',()=>{try{localStorage.setItem(THEME_KEY,isDark()?'light':'dark')}catch(e){}paintTheme()});
document.addEventListener('click',e=>{if(e.target.closest('#theme-auto')){try{localStorage.removeItem(THEME_KEY)}catch(_){}paintTheme();say('Now matching your device')}});
darkMQ.addEventListener('change',paintTheme);
paintTheme();

/* ---------- in-page dialog: ask({title,text,input,ok,danger}) resolves true / typed text / null ---------- */
const qov=document.createElement('div');
qov.className='overlay';qov.hidden=true;qov.style.zIndex=95;
qov.innerHTML='<div class="sheet" id="qsheet" role="alertdialog" aria-modal="true" aria-labelledby="q-title" style="max-width:440px"></div>';
document.body.appendChild(qov);
let qDone=null,qOpener=null;
function ask(o){
  if(qDone)qDone(null);
  return new Promise(res=>{
    qOpener=document.activeElement;qDone=res;
    $('qsheet').innerHTML=`<div class="sheet-head"><h2 id="q-title" tabindex="-1">${esc(o.title)}</h2></div>
      ${o.text?`<p>${esc(o.text)}</p>`:''}
      <form id="q-form" novalidate>${o.input?`<div class="f" style="margin-top:12px"><label for="q-in">${esc(o.input)}</label><textarea id="q-in" maxlength="${o.max||300}"></textarea></div><p class="err" id="q-err" role="alert" hidden></p>`:''}
      <div class="row-btns"><button class="btn ghost" type="button" id="q-no">Cancel</button><button class="btn${o.danger?' pink':''}" type="submit" id="q-ok">${esc(o.ok||'OK')}</button></div></form>`;
    qov.hidden=false;($('q-in')||$('q-title')).focus();
  });
}
function qClose(v){qov.hidden=true;const d=qDone;qDone=null;if(qOpener&&qOpener.isConnected)qOpener.focus();if(d)d(v)}
qov.addEventListener('click',e=>{if(e.target===qov||e.target.closest('#q-no'))qClose(null)});
qov.addEventListener('submit',e=>{
  e.preventDefault();const i=$('q-in');
  if(!i){qClose(true);return}
  const v=i.value.trim();
  if(!v){const er=$('q-err');er.textContent='Add a few words first.';er.hidden=false;i.focus();return}
  qClose(v);
});
window.addEventListener('keydown',e=>{
  if(qov.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();qClose(null);return}
  if(e.key!=='Tab')return;
  e.stopImmediatePropagation();
  const f=[...qov.querySelectorAll('button,textarea')],a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='q-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* ---------- photo viewer ---------- */
let lbList=[],lbI=0,lbOpener=null;
const lb=document.createElement('div');
lb.id='lb';lb.hidden=true;lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Photos');
lb.innerHTML='<button class="lbb" id="lb-x" type="button" aria-label="Close photos">&times;</button><button class="lbb" id="lb-p" type="button" aria-label="Previous photo">&#8249;</button><img id="lb-i" alt=""><button class="lbb" id="lb-n" type="button" aria-label="Next photo">&#8250;</button><div id="lb-c" aria-live="polite"></div>';
document.body.appendChild(lb);
function lbShow(){const i=$('lb-i');i.src=lbList[lbI];i.alt='Photo '+(lbI+1)+' of '+lbList.length;$('lb-c').textContent=(lbI+1)+' / '+lbList.length;const m=lbList.length<2;$('lb-p').hidden=m;$('lb-n').hidden=m}
function lbOpen(list,btn,start){lbList=list;lbI=start||0;lbOpener=btn;lb.hidden=false;lbShow();$('lb-x').focus()}
function lbClose(){lb.hidden=true;if(lbOpener&&lbOpener.focus)lbOpener.focus()}
$('lb-x').addEventListener('click',lbClose);
$('lb-p').addEventListener('click',()=>{lbI=(lbI+lbList.length-1)%lbList.length;lbShow()});
$('lb-n').addEventListener('click',()=>{lbI=(lbI+1)%lbList.length;lbShow()});
lb.addEventListener('click',e=>{if(e.target===lb)lbClose()});
document.addEventListener('keydown',e=>{
  if(lb.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();lbClose()}
  else if(e.key==='ArrowLeft'&&lbList.length>1)$('lb-p').click();
  else if(e.key==='ArrowRight'&&lbList.length>1)$('lb-n').click();
  else if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();$('lb-x').focus()}
},true);

/* ---------- accounts: sign up, log in and profile with Supabase Auth ---------- */
let USER=null,afterAuth=null,aMode='up',aOpener=null,aEmail='';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function userFrom(u){
  if(!u)return null;
  const m=u.user_metadata||{};
  return {id:u.id,email:u.email,name:m.name||String(u.email||'').split('@')[0],type:m.type||'student',created:u.created_at};
}
function friendly(err){
  const t=(err&&err.message)||'';
  if(/invalid login/i.test(t))return 'That email or password is wrong.';
  if(/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(t))return 'That code is wrong or has expired. Ask for a new one.';
  if(/rate limit|too many|security purposes/i.test(t))return 'Too many tries. Wait a minute, then try again.';
  if(/weak|password should/i.test(t))return 'Pick a stronger password.';
  return t||'Something went wrong. Try again.';
}
function renderAuth(){
  $('auth-nav').innerHTML=(IS_ADMIN&&USER?'<button class="navbtn adminbtn" type="button" data-admin>Admin</button>':'')+(USER
    ?`<button class="navbtn me" type="button" data-auth="profile" aria-label="Your profile">${avatar({name:USER.name,cat:'Other'},28)}<span>Hi, ${esc(USER.name.split(' ')[0])}</span></button>`
    :`<button class="navbtn" type="button" data-auth="in">Log in</button><button class="btn" type="button" data-auth="up">Sign up</button>`);
  $('mm-auth').innerHTML=USER
    ?`<button type="button" data-auth="profile">Your profile</button>${IS_ADMIN?'<button type="button" data-admin>Admin</button>':''}<button type="button" data-logout>Log out</button>`
    :`<button type="button" data-auth="in">Log in</button><button type="button" data-auth="up">Sign up</button>`;
}

/* auth sheet: sign up, log in, email code, forgot password */
const aov=makeOverlay('asheet',70,'','a-title');
const field=(id,label,type,extra)=>`<div class="f"><label for="${id}">${label}</label><input type="${type}" id="${id}" ${extra||''}></div>`;
const codeField=()=>field('a-code','Code from the email','text','inputmode="numeric" autocomplete="one-time-code" maxlength="8"');
function drawAuth(info){
  const m=aMode,up=m==='up';
  const titles={up:'Join the Board',in:'Welcome back',code:'Check your email',forgot:'Reset your password',reset:'Choose a new password'};
  const labels={up:'Create account',in:'Log in',code:'Confirm email',forgot:'Send code',reset:'Save new password'};
  let body='';
  if(m==='up'||m==='in'){
    body=`<div class="mtog" role="group" aria-label="Sign up or log in" style="margin:14px 0"><button type="button" data-am="up" aria-pressed="${up}">Sign up</button><button type="button" data-am="in" aria-pressed="${!up}">Log in</button></div>
      ${up?field('a-name','Your name','text','autocomplete="name" maxlength="40"'):''}
      ${field('a-email','Email','text',`inputmode="email" autocomplete="email" placeholder="you@example.com" value="${esc(aEmail)}"`)}
      ${field('a-pw','Password'+(up?' <span class="hint">at least 8 characters</span>':''),'password',`autocomplete="${up?'new-password':'current-password'}"`)}
      ${up?`<div class="f"><label for="a-type">I'm joining as</label><select id="a-type"><option value="student">A student looking for services</option><option value="business">A student running a business or society</option></select></div>
      <label class="check" for="a-agree"><input type="checkbox" id="a-agree">I agree to the <a href="/rules.html" target="_blank">community rules</a> and understand the Board is a listings platform only, not an official university or students’ union service. I’m 16 or over. See our <a href="/privacy.html" target="_blank">privacy notice</a>.</label>`
      :`<button class="link" type="button" data-am="forgot">Forgot your password?</button>`}`;
  }else if(m==='code'){
    body=`<p>We sent a code to <b>${esc(aEmail)}</b>. Type it in to confirm this is your email.</p>${codeField()}<button class="link" type="button" id="a-resend">Send a new code</button>`;
  }else if(m==='forgot'){
    body=`<p>Enter your email and we'll send you a code to reset your password.</p>${field('a-email','Email','text',`inputmode="email" autocomplete="email" value="${esc(aEmail)}"`)}<button class="link" type="button" data-am="in">Back to log in</button>`;
  }else{
    body=`<p>We sent a code to <b>${esc(aEmail)}</b>.</p>${codeField()}${field('a-pw','New password <span class="hint">at least 8 characters</span>','password','autocomplete="new-password"')}<button class="link" type="button" id="a-resend">Send a new code</button>`;
  }
  $('asheet').innerHTML=`<div class="sheet-head"><h2 id="a-title" tabindex="-1">${titles[m]}</h2><button class="x" id="a-x" type="button" aria-label="Close">${XSVG}</button></div>
    <form id="a-form" novalidate>${body}
      <p class="hint" id="a-info" role="status" ${info?'':'hidden'}>${esc(info||'')}</p>
      <p class="err" id="a-err" role="alert" hidden></p>
      <div class="row-btns"><span></span><button class="btn pink" type="submit">${labels[m]}</button></div>
    </form>`;
  $('a-title').focus();
}
function openAuth(mode,cb,btn){
  aMode=mode;afterAuth=cb||null;aOpener=btn||document.activeElement;
  aov.hidden=false;document.body.style.overflow='hidden';drawAuth();
}
function closeAuth(){aov.hidden=true;unlockScroll();if(aOpener&&aOpener.isConnected)aOpener.focus()}
function aFail(msg,btn,label){const e=$('a-err');e.textContent=msg;e.hidden=false;if(btn){btn.disabled=false;btn.textContent=label}}
/* run cb now if logged in, otherwise after logging in */
function needLogin(cb,btn,mode){if(USER){cb();return}openAuth(mode||'up',cb,btn)}
async function finishAuth(isNew,msg){
  const {data:{user}}=await sb.auth.getUser();
  USER=userFrom(user);renderAuth();
  const cb=afterAuth;afterAuth=null;aOpener=$('auth-nav');
  aov.hidden=true;unlockScroll();
  say(msg||(isNew?'Welcome to the Board, '+USER.name.split(' ')[0]:'Logged in'));
  if(cb)cb();
  else if(isNew&&USER.type==='business'&&typeof openSheet==='function')openSheet({currentTarget:$('auth-nav')});
}
aov.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('[type="submit"]'),label=btn.textContent,m=aMode;
  const val=id=>$(id)?$(id).value.trim():'';
  const email=val('a-email').toLowerCase(),pw=$('a-pw')?$('a-pw').value:'',code=val('a-code').replace(/\s/g,'');
  const miss=[];
  if(m==='up'&&!val('a-name'))miss.push('your name');
  if((m==='up'||m==='in'||m==='forgot')&&!EMAIL_RE.test(email))miss.push('a valid email address');
  if((m==='up'||m==='reset')&&pw.length<8)miss.push('a password of at least 8 characters');
  if(m==='in'&&!pw)miss.push('your password');
  if((m==='code'||m==='reset')&&!/^\d{6,8}$/.test(code))miss.push('the code from the email');
  if(m==='up'&&!$('a-agree').checked)miss.push('your agreement to continue');
  if(miss.length){aFail('Add '+miss.join(', ')+'.');return}
  btn.disabled=true;btn.textContent='One moment…';
  try{
    if(m==='up'){
      const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{name:val('a-name'),type:$('a-type').value}}});
      if(error)throw error;
      aEmail=email;
      if(data.user&&data.user.identities&&!data.user.identities.length){aMode='in';drawAuth('That email already has an account. Log in instead.');return}
      if(data.session){await finishAuth(true);return}
      aMode='code';drawAuth();
    }else if(m==='in'){
      const {error}=await sb.auth.signInWithPassword({email,password:pw});
      if(error&&/not confirmed/i.test(error.message)){
        aEmail=email;await sb.auth.resend({type:'signup',email});
        aMode='code';drawAuth('Your email isn’t confirmed yet, so we’ve sent you a new code.');return;
      }
      if(error)throw error;
      await finishAuth(false);
    }else if(m==='code'){
      const {error}=await sb.auth.verifyOtp({email:aEmail,token:code,type:'email'});
      if(error)throw error;
      await finishAuth(true);
    }else if(m==='forgot'){
      const {error}=await sb.auth.resetPasswordForEmail(email);
      if(error)throw error;
      aEmail=email;aMode='reset';drawAuth();
    }else{
      const v=await sb.auth.verifyOtp({email:aEmail,token:code,type:'recovery'});
      if(v.error)throw v.error;
      const u=await sb.auth.updateUser({password:pw});
      if(u.error)throw u.error;
      await finishAuth(false,'Password updated. You’re logged in.');
    }
  }catch(err){aFail(friendly(err),btn,label)}
});
aov.addEventListener('click',async e=>{
  if(e.target===aov||e.target.closest('#a-x')){closeAuth();return}
  const m=e.target.closest('[data-am]');
  if(m){const em=$('a-email');if(em)aEmail=em.value.trim().toLowerCase();aMode=m.dataset.am;drawAuth();return}
  if(e.target.closest('#a-resend')){
    const r=aMode==='reset'?await sb.auth.resetPasswordForEmail(aEmail):await sb.auth.resend({type:'signup',email:aEmail});
    if(r.error)aFail(friendly(r.error));
    else{const i=$('a-info');i.textContent='New code sent. Check your inbox and spam folder.';i.hidden=false}
  }
});
document.addEventListener('keydown',e=>{
  if(aov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeAuth();return}
  if(e.key==='Tab')trapTab(e,aov,'a-title');
},true);

/* profile sheet: name, your listings, password, log out, delete account */
let pOpener=null;
const pov=makeOverlay('psheet',75,'','p-title');
function drawProfile(){
  const u=USER;if(!u)return;
  const since=new Date(u.created).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  $('psheet').innerHTML=`<div class="sheet-head"><h2 id="p-title" tabindex="-1">Your profile</h2><button class="x" id="p-x" type="button" aria-label="Close">${XSVG}</button></div>
    <div class="dprof">${avatar({name:u.name,cat:'Other'},72)}<div><b style="font-size:18px">${esc(u.name)}</b><p class="dsub">${esc(u.email)}</p><p class="hint" style="margin:4px 0 0">${u.type==='business'?'Runs a business or society':'Student'}, joined ${esc(since)}</p></div></div>
    <form class="dsec" id="p-name-f" novalidate><h3>Your name</h3><div class="f"><label class="sr" for="p-name">Your name</label><input type="text" id="p-name" maxlength="40" value="${esc(u.name)}" autocomplete="name"></div><button class="btn sm" type="submit">Save name</button></form>
    <div class="dsec"><h3>Your listings</h3><div id="p-list"><p class="hint">Loading your listings…</p></div></div>
    <form class="dsec" id="p-pw-f" novalidate><h3>Change password</h3><div class="f"><label for="p-pw">New password <span class="hint">at least 8 characters</span></label><input type="password" id="p-pw" autocomplete="new-password"></div><button class="btn sm" type="submit">Update password</button></form>
    <div class="dsec"><button class="btn ghost" type="button" id="p-out">Log out</button></div>
    <div class="dsec rvlock"><h3>Delete account</h3><p style="margin:0 0 10px">This permanently deletes your account, every listing you’ve posted and your messages. It can’t be undone.</p><div class="f"><label for="p-del">Type DELETE to confirm</label><input type="text" id="p-del" autocomplete="off"></div><button class="btn pink sm" type="button" id="p-delbtn">Delete my account</button></div>
    <p class="err" id="p-err" role="alert" hidden></p>`;
  loadMyListings();
}
async function loadMyListings(){
  const [b,s]=await Promise.all([
    sb.from('businesses').select('id,name,what,created_at,status').eq('owner_id',USER.id).order('created_at',{ascending:false}),
    sb.from('societies').select('id,name,what,created_at,status').eq('owner_id',USER.id).order('created_at',{ascending:false})
  ]);
  const rows=[...(b.data||[]).map(r=>({...r,t:'businesses',k:'Business',kind:'business'})),...(s.data||[]).map(r=>({...r,t:'societies',k:'Society',kind:'society'}))];
  const el=$('p-list');if(!el)return;
  el.innerHTML=rows.length
    ?rows.map(r=>`<div class="mrow"><span><a href="${listingUrl(r)}"><b>${esc(r.name)}</b></a><br><span class="hint">${r.k}, ${esc(r.what||'')}, posted ${new Date(r.created_at).toLocaleDateString('en-GB')}${r.status==='pending'?', waiting for approval':''}</span></span><i aria-hidden="true"></i><button class="link" type="button" data-del-t="${r.t}" data-del-id="${esc(r.id)}" data-del-n="${esc(r.name)}">Remove</button></div>`).join('')
    :'<p class="hint">You haven’t posted anything yet.</p>';
}
function openProfile(btn){pOpener=btn;pov.hidden=false;document.body.style.overflow='hidden';drawProfile();$('p-title').focus()}
function closeProfile(){pov.hidden=true;unlockScroll();const b=pOpener&&pOpener.isConnected&&pOpener.offsetParent!==null?pOpener:$('auth-nav').querySelector('button');if(b)b.focus()}
function pErr(m){const e=$('p-err');e.textContent=m;e.hidden=false;e.scrollIntoView({block:'nearest'})}
pov.addEventListener('click',async e=>{
  const t=e.target;
  if(t===pov||t.closest('#p-x')){closeProfile();return}
  if(t.closest('#p-out')){await sb.auth.signOut();closeProfile();say('Logged out');return}
  const d=t.closest('[data-del-id]');
  if(d){
    if(!await ask({title:'Remove this listing?',text:`“${d.dataset.delN}” will be taken off the Board for good.`,ok:'Remove listing',danger:true}))return;
    const {error}=await sb.from(d.dataset.delT).delete().eq('id',d.dataset.delId);
    if(error){pErr(friendly(error));return}
    loadMyListings();pageRefresh();say('Listing removed');return;
  }
  const db=t.closest('#p-delbtn');
  if(db){
    if($('p-del').value.trim()!=='DELETE'){pErr('Type DELETE in the box to confirm.');return}
    db.disabled=true;db.textContent='Deleting…';
    const {error}=await sb.functions.invoke('delete-account',{method:'POST'});
    if(error){db.disabled=false;db.textContent='Delete my account';pErr('Your account couldn’t be deleted. Try again.');return}
    await sb.auth.signOut({scope:'local'});closeProfile();say('Your account has been deleted');
  }
});
pov.addEventListener('submit',async e=>{
  e.preventDefault();
  if(e.target.id==='p-name-f'){
    const n=$('p-name').value.trim();if(!n){pErr('Your name can’t be empty.');return}
    const {data,error}=await sb.auth.updateUser({data:{name:n}});
    if(error){pErr(friendly(error));return}
    USER=userFrom(data.user);renderAuth();drawProfile();$('p-title').focus();say('Name saved');
  }else if(e.target.id==='p-pw-f'){
    const pw=$('p-pw').value;if(pw.length<8){pErr('Use at least 8 characters.');return}
    const {error}=await sb.auth.updateUser({password:pw});
    if(error){pErr(friendly(error));return}
    $('p-pw').value='';say('Password updated');
  }
});
document.addEventListener('keydown',e=>{
  if(pov.hidden||!aov.hidden||!qov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeProfile();return}
  if(e.key==='Tab')trapTab(e,pov,'p-title');
},true);

/* header and menu buttons */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-auth]');
  if(b&&b.closest('#auth-nav,#mm-auth')){if(b.dataset.auth==='profile')openProfile(b);else openAuth(b.dataset.auth,null,b);return}
  if(e.target.closest('[data-admin]')){openAdmin(e.target.closest('[data-admin]'));return}
  if(e.target.closest('[data-logout]')){await sb.auth.signOut();say('Logged out')}
});

/* ---------- unread messages badge ---------- */
let badgeTimer=null,badgeChan=null;
async function paintBadge(){
  let n=0;
  if(USER){const {count}=await sb.from('messages').select('id',{count:'exact',head:true}).is('read_at',null).neq('sender_id',USER.id);n=count||0}
  document.querySelectorAll('[data-badge]').forEach(el=>{el.hidden=!n;if(!el.classList.contains('dot'))el.textContent=n>9?'9+':n;el.setAttribute('aria-label',n+' unread')});
}
function watchBadge(){
  clearInterval(badgeTimer);if(badgeChan){sb.removeChannel(badgeChan);badgeChan=null}
  paintBadge();
  if(!USER)return;
  badgeTimer=setInterval(()=>{if(!document.hidden)paintBadge()},60000);
  if(PAGE!=='messages')badgeChan=sb.channel('badge-'+USER.id).on('postgres_changes',{event:'*',schema:'public',table:'messages'},()=>paintBadge()).subscribe();
}

/* ---------- reporting ---------- */
async function report(kind,id){
  if(!USER){openAuth('in',null,document.activeElement);return}
  const reason=await ask({title:'Report this '+(kind==='review'?'review':'listing'),text:'Our team will take a look. The person who posted it won’t see who reported it.',input:'What’s wrong with it?',max:300,ok:'Send report'});
  if(!reason)return;
  const {error}=await sb.from('reports').insert({kind,target_id:String(id),reason:reason.slice(0,300)});
  if(error&&error.code==='23505'){say('You have already reported this');return}
  say(error?'Could not send report. Try again.':'Thanks, our team will take a look');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-report]');if(b){e.preventDefault();report(b.dataset.report,b.dataset.rid)}});

/* ---------- admin panel (only for emails in the admins table) ---------- */
var IS_ADMIN=false,admOpener=null;
async function checkAdmin(){
  IS_ADMIN=false;
  if(USER){const {data}=await sb.rpc('is_admin');IS_ADMIN=data===true}
  renderAuth();
}
const admov=makeOverlay('admsheet',65,'dsheet','adm-title');
async function drawAdmin(){
  const sh=$('admsheet');
  sh.innerHTML=`<div class="sheet-head"><h2 id="adm-title" tabindex="-1">Admin</h2><button class="x" id="adm-x" type="button" aria-label="Close">${XSVG}</button></div><p class="hint">Loading…</p>`;
  const [b,so,r,rep]=await Promise.all([
    sb.from('businesses').select('*').eq('status','pending'),
    sb.from('societies').select('*').eq('status','pending'),
    sb.from('reviews').select('*').eq('status','pending'),
    sb.from('reports').select('*').order('created_at',{ascending:false})
  ]);
  const pics=x=>[...(x.photos||[]),x.avatar].filter(okImg);
  const item=(kind,x,title,text)=>`<div class="adm"><b>${esc(title)}</b><p>${esc(text)}</p>${pics(x).length?`<div class="dphotos">${pics(x).map(p=>`<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="Photo to check" loading="lazy"></a>`).join('')}</div>`:''}${x.policy?`<p>Policy: ${esc(x.policy)}</p>`:''}${x.membership_price?`<p>Membership: ${esc(x.membership_price)}</p>`:''}${(x.perks||[]).length?`<p>Perks: ${esc(x.perks.join(', '))}</p>`:''}${x.flag_reason?`<span class="why">${esc(x.flag_reason)}</span>`:''}<div class="acts"><button class="btn sm" type="button" data-approve="${kind}" data-id="${esc(x.id)}">Approve</button><button class="btn sm ghost" type="button" data-remove="${kind}" data-id="${esc(x.id)}">Remove</button></div></div>`;
  const pend=[].concat(
    (b.data||[]).map(x=>item('businesses',x,'Business: '+x.name,x.description)),
    (so.data||[]).map(x=>item('societies',x,'Society: '+x.name,x.description)),
    (r.data||[]).map(x=>item('reviews',x,'Review ('+x.stars+' stars) by '+(x.reviewer_name||'Student'),x.body)));
  const tbl={business:'businesses',society:'societies',review:'reviews'};
  const reps=(rep.data||[]).map(x=>`<div class="adm"><b>Report on a ${esc(x.kind)}</b><p>${esc(x.reason)}</p><span class="why">id ${esc(x.target_id)}</span><div class="acts">${tbl[x.kind]?`<button class="btn sm ghost" type="button" data-remove="${tbl[x.kind]}" data-id="${esc(x.target_id)}" data-rep="${esc(x.id)}">Remove the ${esc(x.kind)}</button>`:''}<button class="btn sm" type="button" data-dismiss="${esc(x.id)}">Dismiss report</button></div></div>`);
  sh.innerHTML=`<div class="sheet-head"><h2 id="adm-title" tabindex="-1">Admin</h2><button class="x" id="adm-x" type="button" aria-label="Close">${XSVG}</button></div>
    <div class="adm-sec"><h3>Waiting for approval (${pend.length})</h3>${pend.join('')||'<p class="hint">Nothing waiting.</p>'}</div>
    <div class="adm-sec"><h3>Reports (${reps.length})</h3>${reps.join('')||'<p class="hint">No reports.</p>'}</div>`;
}
function openAdmin(btn){admOpener=btn;admov.hidden=false;document.body.style.overflow='hidden';drawAdmin().then(()=>$('adm-title').focus())}
function closeAdmin(){admov.hidden=true;unlockScroll();pageRefresh();if(admOpener&&admOpener.isConnected)admOpener.focus()}
admov.addEventListener('click',async e=>{
  if(e.target===admov||e.target.closest('#adm-x')){closeAdmin();return}
  const a=e.target.closest('[data-approve]'),r=e.target.closest('[data-remove]'),d=e.target.closest('[data-dismiss]');
  if(a){const {error}=await sb.from(a.dataset.approve).update({status:'live',flag_reason:null}).eq('id',a.dataset.id);say(error?'Could not approve':'Approved');drawAdmin()}
  else if(r){if(!await ask({title:'Remove this for good?',text:'It will be deleted from the Board. This can’t be undone.',ok:'Remove',danger:true}))return;const {error}=await sb.from(r.dataset.remove).delete().eq('id',r.dataset.id);if(!error&&r.dataset.rep)await sb.from('reports').delete().eq('id',r.dataset.rep);say(error?'Could not remove':'Removed');drawAdmin()}
  else if(d){await sb.from('reports').delete().eq('id',d.dataset.dismiss);say('Report dismissed');drawAdmin()}
});
document.addEventListener('keydown',e=>{if(!admov.hidden&&qov.hidden&&e.key==='Escape'){e.stopImmediatePropagation();closeAdmin()}},true);

/* ---------- page hooks: each page sets Board.refresh / Board.onUser ---------- */
const Board={refresh:null,onUser:null};
function pageRefresh(){if(Board.refresh)Board.refresh()}
let lastUid;
sb.auth.onAuthStateChange((ev,session)=>{
  USER=userFrom(session&&session.user);
  renderAuth();setTimeout(checkAdmin,0);
  if(!USER&&!pov.hidden)closeProfile();
  const uid=USER?USER.id:null;
  if(uid!==lastUid){
    const first=lastUid===undefined;lastUid=uid;
    /* never call Supabase inside this callback; queue it */
    setTimeout(()=>{watchBadge();if(Board.onUser)Board.onUser(USER,first);else if(!first)pageRefresh()},0);
  }
});
renderAuth();
