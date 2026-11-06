/* The Board: home page. Talks to Supabase with the public key; the database rules decide what anyone can read or change. */
"use strict";
/* ---------- icons (one stroke style) ---------- */
const ICONS={
  scissors:'M9 6a3 3 0 11-6 0 3 3 0 016 0z M9 18a3 3 0 11-6 0 3 3 0 016 0z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  sparkle:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cup:'M5 8h12v5a5 5 0 01-5 5h-2a5 5 0 01-5-5V8z M17 9h1.5a2.5 2.5 0 010 5H17 M8 3v2 M12 3v2',
  book:'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z M4 19.5V21h16',
  bolt:'M13 2L4 14h7l-1 8 9-12h-7z',
  camera:'M3 8a2 2 0 012-2h2l1.5-2.5h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z M16 13a4 4 0 11-8 0 4 4 0 018 0z',
  eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  star:'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  users:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8',
  bell:'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 003.4 0',
  pound:'M18 7a4 4 0 00-4-3c-2.5 0-4 1.6-4 4v4 M6 12h8 M6 20h12 M10 12v4c0 2-1 3-4 4'
};
const svg=(d,s=40,w=1.8)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const CAT={
  Hair:{c:'#FFB8D9',i:'scissors'}, Nails:{c:'#FFD84D',i:'sparkle'}, Lashes:{c:'#F7B8E0',i:'eye'},
  Food:{c:'#B8F2D8',i:'cup'},
  Photography:{c:'#FFC9A8',i:'camera'}, Other:{c:'#DAD6EA',i:'star'}
};
const TILES=['Hair','Nails','Lashes','Food','Photography','Other'];
const LANES=[
  {k:'services',t:'Student services',d:'Hair, nails, lashes, food and more.',c:'var(--butter)'},
  {k:'socs',t:'Societies',d:'What’s on, when it meets, how to join.',c:'var(--mint)'}
];

/* ---------- live data (Supabase-backed) ---------- */
const SUPA='https://xvenwgfvgkdauxfkcgcg.supabase.co';
const sb=window.supabase.createClient(SUPA,'sb_publishable_BgpvbiU9CkH2y1WSS3ZPWw_6yTCivS0');
const BUCKET='listing-photos',PHOTO_BASE=SUPA+'/storage/v1/object/public/'+BUCKET+'/';
/* only show pictures that live in our own storage bucket */
const okImg=u=>typeof u==='string'&&u.startsWith(PHOTO_BASE)&&!/["'<>\s\\]/.test(u);
const cleanMenu=m=>Array.isArray(m)?m.slice(0,10).map(g=>({g:g&&typeof g.g==='string'?g.g.slice(0,40):null,items:Array.isArray(g&&g.items)?g.items.slice(0,30).filter(Array.isArray).map(i=>[String(i[0]||'').slice(0,80),String(i[1]||'').slice(0,30)]):[]})).filter(g=>g.items.length):[];
const SUBS={Hair:['Barbers','Braids'],Nails:['Gel & BIAB','Acrylics','Nail art'],Lashes:['Lash extensions','Lash lifts','Brows'],Food:['Cakes & bakes','Meal prep','Hot meals','Snacks'],Photography:['Grad shoots','Portraits','Events']};
const SUB_TO_CAT={};
Object.entries(SUBS).forEach(([c,ss])=>ss.forEach(s=>SUB_TO_CAT[s]=c));
function bizFromRow(row){
  const w=row.what||'';
  /* "what" holds the type (e.g. Braids) or, if there isn't one, the category itself */
  const cat=SUB_TO_CAT[w]||(CAT[w]?w:'Other');
  const sub=SUB_TO_CAT[w]?w:'';
  return {id:row.id,name:row.name,cat,sub,desc:row.description||'',meta:[row.location].filter(Boolean),price:row.price||'',contact:row.contact||'',menu:cleanMenu(row.menu),policy:typeof row.policy==='string'&&row.policy.trim()?row.policy.slice(0,300):null,photos:(Array.isArray(row.photos)?row.photos:[]).filter(okImg).slice(0,MAXPH),avatar:okImg(row.avatar)?row.avatar:'',promoted:row.promoted===true,reviews:[],sections:[],status:row.status||'live',owner:row.owner_id};
}
function socFromRow(row){
  return {id:row.id,name:row.name,cat:row.what||'Other',desc:row.description||'',meta:(row.meet||'').split(',').map(s=>s.trim()).filter(Boolean),contact:row.contact||'',photos:(Array.isArray(row.photos)?row.photos:[]).filter(okImg).slice(0,MAXPH),status:row.status||'live',owner:row.owner_id};
}
const DATA={services:[],socs:[]};
let LOAD_ERR=false;
/* Ask the database only for live rows, plus anything the signed-in person posted themselves.
   The database rules (supabase/security.sql) enforce the same thing on the server. */
async function rowsFor(table,ownCol,me){
  const live=sb.from(table).select('*').eq('status','live').order('created_at',{ascending:false}).limit(1000);
  const own=me?sb.from(table).select('*').eq(ownCol,me.id).order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[]});
  const [a,b]=await Promise.all([live,own]);
  if(a.error)throw a.error;
  const seen=new Set(),out=[];
  [...(a.data||[]),...(b.data||[])].forEach(x=>{if(!seen.has(String(x.id))){seen.add(String(x.id));out.push(x)}});
  return out;
}
async function loadData(){
  const me=((await sb.auth.getSession()).data.session||{}).user||null;
  if(me&&!USER){USER=userFrom(me);renderAuth()}
  let b,s,r;
  try{[b,s,r]=await Promise.all([rowsFor('businesses','owner_id',me),rowsFor('societies','owner_id',me),rowsFor('reviews','user_id',me)]);LOAD_ERR=false}
  catch(_){LOAD_ERR=true;return}
  DATA.services=b.map(bizFromRow);
  r.forEach(x=>{const it=DATA.services.find(i=>String(i.id)===String(x.business_id));if(it)it.reviews.push({id:x.id,s:x.stars,t:x.body,w:x.reviewer_name||'Student',x:new Date(x.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),mine:!!me&&x.user_id===me.id,uid:x.user_id,status:x.status})});
  DATA.socs=s.map(socFromRow);
}
let sub=null;
const liveRv=it=>(it.reviews||[]).filter(r=>r.status!=='pending');
const avg=it=>{const l=liveRv(it);return l.length?l.reduce((a,r)=>a+r.s,0)/l.length:0};
const stars=(n,sz=14)=>{const r=Math.round(n);return `<span class="stars" role="img" aria-label="${n.toFixed(1)} out of 5">${[1,2,3,4,5].map(i=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${i<=r?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS.star}"/></svg>`).join('')}</span>`};
const fromPrice=it=>{const v=[].concat(...(it.menu||[]).filter(g=>g.g!=='Add-ons').map(g=>g.items.map(i=>{const m=String(i[1]).match(/\d+(\.\d+)?/);return m?parseFloat(m[0]):NaN}))).filter(x=>!isNaN(x));return v.length?'From £'+Math.min(...v):''};
const initials=n=>n.split(/\s+/).filter(w=>/^[A-Za-z0-9]/.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const avatar=(it,sz)=>`<span class="av" aria-hidden="true" style="--s:${sz}px;background:${(CAT[it.cat]||CAT.Other).c}">${it.avatar?`<img src="${it.avatar}" alt="" decoding="async">`:`<b>${esc(initials(it.name))}</b>`}</span>`;

/* ---------- state + helpers ---------- */
let tab='services', cat=null;
const $=id=>document.getElementById(id);
const grid=$('grid'), q=$('q');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tt;
function say(m,ms){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,ms||2400)}
function copyText(v,fallbackEl){
  const fb=()=>{if(fallbackEl){const r=document.createRange();r.selectNodeContents(fallbackEl);const s=getSelection();s.removeAllRanges();s.addRange(r);say('Selected. Copy it from here')}else say('Select and copy: '+v,4000)};
  try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),fb)}catch(_){fb()}
}

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

/* ---------- marquee ---------- */
function paintMarquee(){
  const top=ranked().filter(x=>liveRv(x).length).slice(0,8);
  $('marquee').hidden=!top.length;
  $('mq-list').innerHTML=top.map(x=>`<li>${esc(x.name)}, ${avg(x).toFixed(1)} stars</li>`).join('');
  $('track').innerHTML=top.length?[].concat(top,top,top,top).map(x=>`<span>${esc(x.name)} ★ ${avg(x).toFixed(1)}</span>`).join(''):'';
}

/* ---------- tiles ---------- */
$('tiles').innerHTML=TILES.map(t=>`<button class="tile" type="button" data-cat="${t}" aria-pressed="false" style="background:${CAT[t].c}">${svg(ICONS[CAT[t].i],34,2)}<b>${t}</b></button>`).join('');
$('tiles').addEventListener('click',e=>{
  const b=e.target.closest('.tile');if(!b)return;
  cat=(cat===b.dataset.cat)?null:b.dataset.cat;
  if(cat)tab='services';
  render();
});

/* ---------- lanes (tabs) ---------- */
$('lanes').innerHTML=LANES.map(l=>`<button class="lane" role="tab" id="tab-${l.k}" data-tab="${l.k}" aria-selected="false" tabindex="-1" style="--c:${l.c}"><h3>${l.t}<span class="n" id="n-${l.k}"></span></h3><p>${l.d}</p></button>`).join('');
$('lanes').addEventListener('click',e=>{
  const b=e.target.closest('.lane');if(!b)return;
  tab=b.dataset.tab;if(tab!=='services')cat=null;render();
});
$('lanes').addEventListener('keydown',e=>{
  const keys=LANES.map(l=>l.k),i=keys.indexOf(tab);
  let n=null;
  if(e.key==='ArrowRight')n=(i+1)%keys.length;
  if(e.key==='ArrowLeft')n=(i+keys.length-1)%keys.length;
  if(n===null)return;
  e.preventDefault();tab=keys[n];if(tab!=='services')cat=null;render();$('tab-'+tab).focus();
});

/* ---------- cards ---------- */
function headFor(it,kind){
  if(kind==='services'){const c=CAT[it.cat]||CAT.Other;return {bg:c.c,icon:ICONS[c.i]}}
  return {bg:'var(--mint)',icon:ICONS.users};
}
function cardHTML(it,kind){
  const h=headFor(it,kind),ph=it.photos||[];
  const own=!it.mine&&USER&&it.owner===USER.id;
  const exBadge=it.mine?`<span class="ex">Your preview</span>`:it.status==='pending'?`<span class="ex">Waiting for approval</span>`:own?`<span class="ex">Your listing</span>`:'';
  const price=kind==='services'?(fromPrice(it)||it.price||''):'';
  const head=ph.length
    ?`<div class="card-head has-photo"><button class="shot" type="button" data-lb="${it.id||''}" aria-label="View ${ph.length} photo${ph.length>1?'s':''} of ${esc(it.name)}"><img src="${ph[0]}" alt="" decoding="async" loading="lazy"></button>${ph.length>1?`<span class="pc">1/${ph.length}</span>`:''}${exBadge}</div>`
    :`<div class="card-head" style="background:${h.bg}">${svg(h.icon,44,1.7)}${exBadge}</div>`;
  return `<article class="card"${kind==='services'&&!it.mine?` data-card="${esc(it.id)}"`:''}>
    ${head}
    <div class="card-body">
      ${kind==='services'?`<div class="who">${avatar(it,64)}<span class="svc">${esc(it.sub||it.cat)}</span></div><span class="cat">${esc(it.cat)}</span>`:`<span class="cat">${esc(it.cat)}</span>`}
      <h3>${esc(it.name)}</h3>
      ${kind==='services'?`<div class="rate">${liveRv(it).length?`${stars(avg(it))}<span>${avg(it).toFixed(1)} (${liveRv(it).length})</span>`:'<span>No reviews yet</span>'}</div>`:''}
      <p>${esc(it.desc)}</p>
      <div class="meta">${(price?[price]:[]).concat(it.meta).map(m=>`<span>${esc(m)}</span>`).join('')}</div>
      ${kind==='services'?`<button class="btn dark sm" type="button" data-detail="${esc(it.id||'')}">Menu and reviews</button>`:''}
      <div class="contact"><code>${esc(it.contact)}</code><button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button></div>${kind==='socs'&&!it.mine&&!own?`<button class="link rep" type="button" data-report="society" data-rid="${esc(it.id)}">Report</button>`:''}
    </div>
  </article>`;
}
function render(){
  const term=q.value.trim().toLowerCase();
  LANES.forEach(l=>{
    const b=$('tab-'+l.k);
    b.setAttribute('aria-selected',l.k===tab);
    b.tabIndex=l.k===tab?0:-1;
    $('n-'+l.k).textContent=LOAD_ERR?'':DATA[l.k].length;
  });
  document.querySelectorAll('.tile').forEach(t=>t.setAttribute('aria-pressed',t.dataset.cat===cat));
  const note=$('filter-note');
  if(cat){note.hidden=false;note.innerHTML=`Showing ${esc(cat)} only. <button class="link" type="button" id="clear-cat">Show all services</button>`;$('clear-cat').addEventListener('click',()=>{cat=null;render()})}
  else note.hidden=true;
  if(sub&&!(SUBS[cat]||[]).includes(sub))sub=null;
  const sb=$('subs');
  if(tab==='services'&&cat&&SUBS[cat]&&SUBS[cat].length>1){sb.hidden=false;sb.innerHTML=['All'].concat(SUBS[cat]).map(x=>`<button class="chipbtn" type="button" data-sub="${esc(x)}" aria-pressed="${(x==='All'&&!sub)||x===sub}">${esc(x)}</button>`).join('')}
  else{sb.hidden=true;sb.innerHTML=''}
  grid.setAttribute('aria-labelledby','tab-'+tab);
  const items=DATA[tab].filter(it=>(!cat||it.cat===cat)&&(!sub||it.sub===sub)&&(!term||[it.name,it.cat,it.sub||'',it.desc,...it.meta,...[].concat(...(it.menu||[]).map(g=>[g.g||'',...g.items.map(i=>i[0])]))].join(' ').toLowerCase().includes(term)));
  grid.innerHTML=LOAD_ERR?`<div class="empty" role="alert">We couldn’t load the Board just now. Check your connection, then <button class="link" type="button" id="retry">try again</button>.</div>`
    :items.length?items.map(it=>cardHTML(it,tab)).join(''):`<div class="empty">Nothing matches${term?` "${esc(q.value.trim())}"`:''} here yet. If you run it, put it on the Board.</div>`;
  drawPromoIfChanged();
  $('status').textContent=items.length+(items.length===1?' listing':' listings')+' shown';
}
q.addEventListener('input',render);
$('subs').addEventListener('click',e=>{const b=e.target.closest('[data-sub]');if(!b)return;sub=b.dataset.sub==='All'?null:b.dataset.sub;render();const n=$('subs').querySelector('[aria-pressed="true"]');if(n)n.focus()});
$('search-form').addEventListener('submit',e=>{e.preventDefault();render();grid.scrollIntoView({behavior:'smooth',block:'start'})});
grid.addEventListener('click',e=>{
  if(e.target.closest('#retry')){refresh();return}
  const b=e.target.closest('[data-copy]');if(b){copyText(b.dataset.copy,b.previousElementSibling);return}
  /* the whole card opens the business; buttons and links inside it keep their own job */
  if(e.target.closest('button,a,input,textarea,select'))return;
  const c=e.target.closest('[data-card]');if(c&&!getSelection().toString())openDetail(c.dataset.card,c.querySelector('[data-detail]'));
});
async function refresh(){await loadData();paintMarquee();render()}

/* ---------- register flow ---------- */
const ov=$('overlay'),sheet=$('sheet'),stepEl=$('step'),bars=[...document.querySelectorAll('.progress i')];
let st={},opener=null;
const KINDS=[
  {k:'services',t:'A student business',s:'Hair, nails, lashes, food, photography and more',i:ICONS.pound,bg:'var(--butter)'},
  {k:'socs',t:'A society',s:'Sport, culture, faith, tech, arts and more',i:ICONS.users,bg:'var(--mint)'}
];
const CATS={services:['Hair','Nails','Lashes','Food','Photography','Other'],socs:['Culture','Sport','Tech','Arts','Faith','Academic','Other']};

function openSheet(e){
  opener=e&&e.currentTarget||document.activeElement;
  st={step:0,kind:null,name:'',cat:'',desc:'',meta:'',contact:'',agree:false,photos:[],pmsg:'',menu:'',policy:'',sub:'',avatar:''};
  ov.hidden=false;document.body.style.overflow='hidden';draw();
}
function closeSheet(){ov.hidden=true;document.body.style.overflow='';if(opener&&opener.focus)opener.focus()}
document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',openSheet));
$('close').addEventListener('click',closeSheet);
ov.addEventListener('click',e=>{if(e.target===ov)closeSheet()});
document.addEventListener('keydown',e=>{
  if(ov.hidden)return;
  if(e.key==='Escape'){closeSheet();return}
  if(e.key!=='Tab')return;
  const f=[...sheet.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});
function subOpts(){return (SUBS[st.cat]||[]).concat(['Other']).map(c=>`<option ${st.sub===c?'selected':''}>${c}</option>`).join('')}
function shrinkSquare(file,sz=256){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      const m=Math.min(im.width,im.height),c=document.createElement('canvas');c.width=c.height=sz;
      c.getContext('2d').drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,sz,sz);
      URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.85));
    };
    im.onerror=()=>{URL.revokeObjectURL(u);rej()};im.src=u;
  });
}
function parseMenu(t){
  const items=t.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,30).map(l=>{
    const m=l.match(/^(.*?)\s*[-–:]\s*(£?\s*\d[\d.,]*.*)$/);
    if(!m)return [l,''];
    let pr=m[2].trim();if(/^\d/.test(pr))pr='£'+pr;return [m[1].trim()||l,pr];
  });
  return items.length?[{g:null,items}]:[];
}
function save(){for(const k of ['name','cat','sub','desc','meta','contact','menu','policy']){const el=$('r-'+k);if(el)st[k]=el.value}}

function draw(){
  bars.forEach((b,i)=>b.classList.toggle('on',i<=st.step));
  const title=$('sheet-title');
  if(st.step===0){
    title.textContent='What are you registering?';
    stepEl.innerHTML=`<div class="choices">${KINDS.map(k=>`<button class="choice" type="button" data-kind="${k.k}" aria-pressed="${st.kind===k.k}"><span class="ic" style="background:${k.bg}">${svg(k.i,22,2)}</span><span><strong>${k.t}</strong><span class="s">${k.s}</span></span></button>`).join('')}</div>
      <div class="row-btns"><span></span><button class="btn pink" type="button" id="next0" ${st.kind?'':'disabled'}>Next</button></div>`;
    stepEl.querySelectorAll('.choice').forEach(c=>c.addEventListener('click',()=>{st.kind=c.dataset.kind;draw();stepEl.querySelector(`[data-kind="${st.kind}"]`).focus()}));
    $('next0').addEventListener('click',()=>{if(st.kind){st.step=1;draw()}});
  }else if(st.step===1){
    const soc=st.kind==='socs',off=false;
    title.textContent=soc?'Tell us about your society':off?'Your notice':'Tell us about your business';
    stepEl.innerHTML=`<form id="f" novalidate>
      <div class="f"><label for="r-name">${soc?'Society name':off?'Notice title':'Business name'}</label><input type="text" id="r-name" value="${esc(st.name)}" placeholder="${soc?'e.g. Chess Society':off?'e.g. Reading week library hours':'e.g. Lashes by Zara'}"></div>
      <div class="f"><label for="r-cat">Category</label><select id="r-cat"><option value="">Choose one</option>${CATS[st.kind].map(c=>`<option ${st.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      ${st.kind==='services'&&SUBS[st.cat]?`<div class="f"><label for="r-sub">Type of service <span class="hint">what you do, e.g. Barbers or Braids</span></label><select id="r-sub"><option value="">Choose one</option>${subOpts()}</select></div>`:''}
      ${st.kind==='services'?`<div class="f"><span class="lbl" id="av-l">Profile picture <span class="hint">optional, a logo or a face. You can add one later.</span></span>
        <div class="avpick">${avatar({name:st.name||'You',cat:st.cat||'Other',avatar:st.avatar},64)}<label class="addph"><input type="file" id="r-avatar" accept="image/jpeg,image/png,image/webp" aria-describedby="av-l"><span>${st.avatar?'Change picture':'+ Add picture'}</span></label>${st.avatar?'<button class="link" type="button" id="av-rm">Remove</button>':''}</div></div>`:''}
      <div class="f"><label for="r-desc">${soc?'What you get up to':off?'Details':'What you offer'} <span class="hint">(one or two lines)</span></label><textarea id="r-desc" maxlength="200">${esc(st.desc)}</textarea></div>
      <div class="f"><label for="r-meta">${soc?'When and where you meet':off?'Where it applies':'Where and when'} <span class="hint">separate with commas</span></label><input type="text" id="r-meta" value="${esc(st.meta)}" placeholder="${soc?'Wed 6pm, Clifton':off?'All campuses':'City campus, evenings'}"></div>
      ${st.kind==='services'?`<div class="f"><label for="r-menu">Price list <span class="hint">one per line, like Fade - £25</span></label><textarea id="r-menu" placeholder="Fade - £25&#10;Lineup - £15">${esc(st.menu)}</textarea></div><div class="f"><label for="r-policy">Policy <span class="hint">optional, e.g. late or cancellation rules</span></label><input type="text" id="r-policy" value="${esc(st.policy)}" placeholder="Over 10 minutes late and a late fee applies"></div>`:''}
      <div class="f"><label for="r-contact">${off?'Posted by':'How people reach you'} <span class="hint">${off?'your department':'Instagram, email or phone'}</span></label><input type="text" id="r-contact" value="${esc(st.contact)}" placeholder="@yourhandle"></div>
      <div class="f"><span class="lbl" id="ph-l">Photos <span class="hint">optional, up to 4. Show your work.</span></span>
        <label class="addph" ${st.photos.length>=MAXPH?'hidden':''}><input type="file" id="r-photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-describedby="ph-l"><span>+ Add photos</span></label>
        <p class="hint" id="ph-m" role="status">${esc(st.pmsg)}</p>
        <div class="photos">${st.photos.map((p,i)=>`<div class="ph"><img src="${p}" alt="Photo ${i+1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i+1}">&times;</button></div>`).join('')}</div>
      </div>
      <p class="err" id="err" role="alert" hidden></p>
      <div class="row-btns"><button type="button" class="btn ghost" id="back">Back</button><button class="btn pink" type="submit">Preview</button></div>
    </form>`;
    if(st.kind==='services'){
      $('r-cat').addEventListener('change',()=>{save();st.sub='';draw();$('r-cat').focus()});
      $('r-avatar').addEventListener('change',async e=>{
        const f=e.target.files[0];if(!f)return;save();
        if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>15e6){st.pmsg='Profile picture must be a JPG, PNG or WebP under 15MB.';draw();return}
        try{st.avatar=await shrinkSquare(f)}catch(_){st.pmsg='That picture could not be read.'}
        draw();$('r-avatar').focus();
      });
      const rm=$('av-rm');if(rm)rm.addEventListener('click',()=>{save();st.avatar='';draw();$('r-avatar').focus()});
    }
    $('r-photos').addEventListener('change',async e=>{
      save();const files=[...e.target.files];let msg='';
      for(const f of files){
        if(st.photos.length>=MAXPH){msg='Max '+MAXPH+' photos.';break}
        if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type)){msg='Only JPG, PNG, WebP or GIF images.';continue}
        if(f.size>15e6){msg='One photo was over 15MB and was skipped.';continue}
        try{st.photos.push(await shrink(f))}catch(_){msg='One photo could not be read.'}
      }
      st.pmsg=msg;draw();const n=$('r-photos');(n&&!n.closest('[hidden]')?n:stepEl.querySelector('.ph button')||$('r-name')).focus();
    });
    stepEl.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{save();st.photos.splice(+b.dataset.rm,1);st.pmsg='';draw();(stepEl.querySelector('.ph button')||$('r-photos')).focus()}));
    $('back').addEventListener('click',()=>{save();st.step=0;draw()});
    $('f').addEventListener('submit',e=>{
      e.preventDefault();save();
      const miss=[['name','a name'],['cat','a category'],['desc','a short description'],['contact',off?'who it’s from':'a way to contact you']].filter(([k])=>!st[k].trim()).map(x=>x[1]);
      const er=$('err');
      if(miss.length){er.textContent='Add '+miss.join(', ')+' to continue.';er.hidden=false;return}
      st.step=2;draw();
    });
  }else if(st.step===2){
    title.textContent='Here’s how it’ll look';
    const item={name:st.name,cat:st.cat,desc:st.desc,price:'',meta:st.meta.split(',').map(s=>s.trim()).filter(Boolean),contact:st.contact,mine:true,sub:st.sub,avatar:st.avatar,reviews:[],policy:st.policy.trim(),menu:parseMenu(st.menu),photos:st.photos.slice(),id:'u'+Date.now()};
    stepEl.innerHTML=`<div class="preview-label">Preview</div><div style="pointer-events:none">${cardHTML(item,st.kind)}</div>
      <label class="check" for="r-agree"><input type="checkbox" id="r-agree" ${st.agree?'checked':''}>I confirm these are real contact details, I agree to the <a href="/rules.html" target="_blank">community rules</a>, and I understand the Board is a listings platform only. It doesn’t vet or endorse anyone’s product or service.</label>
      <p class="err" id="err2" role="alert" hidden>Tick the box to post your listing.</p>
      <div class="row-btns"><button class="btn ghost" type="button" id="back2">Edit</button><button class="btn pink" type="button" id="post">Post to the Board</button></div>`;
    $('back2').addEventListener('click',()=>{st.step=1;draw()});
    $('r-agree').addEventListener('change',e=>{st.agree=e.target.checked});
    $('post').addEventListener('click',async()=>{
      if(!st.agree){$('err2').hidden=false;return}
      const btn=$('post');btn.disabled=true;btn.textContent='Posting…';
      let row,table;
      if(st.kind==='services'){
        table='businesses';
        row={name:st.name,what:st.sub&&st.sub!=='Other'?st.sub:st.cat,price:fromPrice(item)||'',location:item.meta.join(', '),description:st.desc,contact:st.contact};
      }else{
        table='societies';
        row={name:st.name,what:st.cat,meet:item.meta.join(', '),description:st.desc,contact:st.contact};
      }
      const res=await submitPost(table==='businesses'?'business':'society',row);
      if(res.error){btn.disabled=false;btn.textContent='Post to the Board';$('err2').textContent=res.error;$('err2').hidden=false;return}
      lastStatus=res.status;lastNote='';lastPhotos=false;
      const extras={};
      if(st.kind==='services'){const m=parseMenu(st.menu);if(m.length)extras.menu=m;if(st.policy.trim())extras.policy=st.policy.trim().slice(0,300)}
      const pics=st.photos.slice(),av=st.kind==='services'?st.avatar:'';
      if(pics.length||av||Object.keys(extras).length){
        btn.textContent=pics.length||av?'Uploading photos…':'Saving…';
        const r=await saveExtras(table,row.name,extras,pics,av);
        if(r.status)lastStatus=r.status;
        lastNote=r.note||'';lastPhotos=!!r.photos;
      }
      await loadData();
      tab=st.kind;cat=null;q.value='';render();
      st.step=3;draw();
    });
  }else{
    const held=lastStatus==='pending';
    title.textContent=held?'Sent for a quick check':'You’re on the Board';
    stepEl.innerHTML=`<div class="done"><div class="big-pin" aria-hidden="true"></div>
      <p style="margin:0 0 6px;font-weight:700;font-size:18px">${esc(st.name)} ${held?'is waiting for approval.':'is live.'}</p>
      <p style="margin:0;color:var(--muted)">${held?(lastPhotos?'Our team checks every photo before it goes up. Only you can see your listing until then, usually within a day.':'Something in your listing needs a quick look from our team. Only you can see it until it’s approved.'):'Anyone browsing the Board can see it now.'}</p>
      ${lastNote?`<p class="err" style="margin-top:12px">${esc(lastNote)}</p>`:''}
      <div class="row-btns" style="justify-content:center"><button class="btn" type="button" id="see">See my listing</button></div></div>`;
    $('see').addEventListener('click',()=>{closeSheet();$('browse').scrollIntoView({behavior:'smooth'})});
  }
  title.focus({preventScroll:true});
}

/* ---------- spotlight: Sponsored (paid, marked) or, if nobody has paid, Featured (top rated) ---------- */
const P={paid:false,items:[],slide:0,timer:null,hover:false,stopped:false,key:''};
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const PIN_ICON='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
function pickPromo(){
  const live=DATA.services.filter(x=>x.status==='live');
  const match=x=>(!cat||x.cat===cat)&&(!sub||x.sub===sub);
  const paid=live.filter(x=>x.promoted);
  /* sponsored ones that match the category first, then other sponsored ones so it keeps moving */
  const p=paid.filter(match).concat(paid.filter(x=>!match(x))).slice(0,6);
  if(p.length)return {paid:true,items:p};
  const top=live.filter(x=>match(x)&&liveRv(x).length).sort((x,y)=>avg(y)-avg(x)||liveRv(y).length-liveRv(x).length).slice(0,5);
  return {paid:false,items:top};
}
function slideHTML(it,i,n){
  const c=CAT[it.cat]||CAT.Other,img=(it.photos||[])[0],r=liveRv(it).length,pr=fromPrice(it)||it.price;
  return `<div class="pc-slide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${n}: ${esc(it.name)}">
    <div class="pv" style="background:${c.c}">${img?`<img src="${esc(img)}" alt="" decoding="async" loading="lazy">`:`<span class="pv-ic">${svg(ICONS[c.i],72,1.4)}</span>`}${avatar(it,88)}</div>
    <div class="pinfo">
      <span class="svc">${esc(it.sub||it.cat)}</span>
      <h3>${esc(it.name)}</h3>
      ${it.meta[0]?`<p class="near">${PIN_ICON}${esc(it.meta[0])}</p>`:''}
      <div class="rate">${r?`${stars(avg(it))}<span>${avg(it).toFixed(1)} (${r})</span>`:'<span>No reviews yet</span>'}</div>
      <p class="pdesc">${esc(it.desc)}</p>
      ${pr?`<div class="meta"><span>${esc(pr)}</span></div>`:''}
      <div class="pc-ctas"><button class="btn pink" type="button" data-detail="${esc(it.id)}">View profile</button>${it.contact?`<button class="btn ghost" type="button" data-copy="${esc(it.contact)}">Copy contact</button>`:''}</div>
    </div>
  </div>`;
}
function drawPromoIfChanged(){
  const pk=tab==='services'&&!LOAD_ERR?pickPromo():{paid:false,items:[]};
  const key=pk.paid+'|'+pk.items.map(x=>x.id+':'+avg(x)+':'+(x.photos||[]).length).join(',');
  if(key===P.key)return;
  P.key=key;P.paid=pk.paid;P.items=pk.items;P.slide=0;drawPromo();
}
function drawPromo(){
  const el=$('promo-c');stopTimer();
  if(!P.items.length){el.hidden=true;el.innerHTML='';return}
  const n=P.items.length,many=n>1,label=P.paid?'Sponsored':'Featured';
  el.hidden=false;
  el.innerHTML=`<div class="pc-top"><h2 class="pc-label">${label}</h2><a class="why" href="/how-it-works.html#featured">${P.paid?'What’s this?':'Top rated right now'}</a></div>
  <section class="pc" aria-roledescription="carousel" aria-label="${label} businesses">
    <div class="pc-view"><div class="pc-track" id="pc-track" aria-live="${P.stopped||!many?'polite':'off'}">${P.items.map((it,i)=>slideHTML(it,i,n)).join('')}</div></div>
    ${many?`<div class="pc-nav">
      <button class="x" type="button" id="pc-prev" aria-label="Previous">&#8249;</button>
      <div class="pc-dots">${P.items.map((it,i)=>`<button type="button" data-slide="${i}" aria-label="Show ${esc(it.name)}" aria-current="${i===P.slide}"></button>`).join('')}</div>
      <button class="x" type="button" id="pc-next" aria-label="Next">&#8250;</button>
      <button class="pc-pause" type="button" id="pc-pause" aria-pressed="${P.stopped}">${P.stopped?'Play':'Pause'}</button>
    </div>`:''}
  </section>`;
  moveTo(P.slide,false);startTimer();
}
function moveTo(i,animate){
  const n=P.items.length;if(!n)return;
  P.slide=(i+n)%n;
  const t=$('pc-track');if(!t)return;
  t.style.transition=animate&&!REDUCED?'transform .6s cubic-bezier(.2,.7,.2,1)':'none';
  t.style.transform=`translateX(-${P.slide*100}%)`;
  t.querySelectorAll('.pc-slide').forEach((s,k)=>{if(k===P.slide){s.removeAttribute('aria-hidden');s.inert=false}else{s.setAttribute('aria-hidden','true');s.inert=true}});
  $('promo-c').querySelectorAll('[data-slide]').forEach((d,k)=>d.setAttribute('aria-current',k===P.slide));
}
function startTimer(){stopTimer();if(P.items.length>1&&!P.stopped&&!REDUCED)P.timer=setInterval(()=>{if(!P.hover&&!document.hidden)moveTo(P.slide+1,true)},5000)}
function stopTimer(){clearInterval(P.timer);P.timer=null}
(()=>{
  const el=$('promo-c');
  el.addEventListener('click',e=>{
    const c=e.target.closest('[data-copy]');if(c){copyText(c.dataset.copy);return}
    const d=e.target.closest('[data-detail]');if(d){openDetail(d.dataset.detail,d);return}
    if(e.target.closest('#pc-prev')){moveTo(P.slide-1,true);startTimer();return}
    if(e.target.closest('#pc-next')){moveTo(P.slide+1,true);startTimer();return}
    const pz=e.target.closest('#pc-pause');
    if(pz){P.stopped=!P.stopped;pz.setAttribute('aria-pressed',P.stopped);pz.textContent=P.stopped?'Play':'Pause';$('pc-track').setAttribute('aria-live',P.stopped?'polite':'off');P.stopped?stopTimer():startTimer();return}
    const s=e.target.closest('[data-slide]');if(s){moveTo(+s.dataset.slide,true);startTimer()}
  });
  el.addEventListener('mouseenter',()=>P.hover=true);el.addEventListener('mouseleave',()=>P.hover=false);
  el.addEventListener('focusin',()=>P.hover=true);el.addEventListener('focusout',()=>P.hover=false);
  let px=null;
  el.addEventListener('touchstart',e=>{if(e.target.closest('.pc-view'))px=e.touches[0].clientX},{passive:true});
  el.addEventListener('touchend',e=>{if(px==null)return;const d=e.changedTouches[0].clientX-px;px=null;if(Math.abs(d)>50){moveTo(P.slide+(d<0?1:-1),true);startTimer()}});
})();

/* ---------- business detail (menu, policy, reviews) ---------- */
const dov=document.createElement('div');
dov.className='overlay';dov.hidden=true;
dov.innerHTML='<div class="sheet dsheet" role="dialog" aria-modal="true" aria-labelledby="dtitle"><div class="sheet-head"><h2 id="dtitle" tabindex="-1"></h2><button class="x" id="dclose" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div id="dbody"></div></div>';
document.body.appendChild(dov);
let dcur=null,dopen=null,revOpen=false;
function menuHTML(it){
  return (it.menu||[]).map(g=>`${g.g?`<h4>${esc(g.g)}</h4>`:''}${g.items.map(i=>`<div class="mrow"><span>${esc(i[0])}</span><i aria-hidden="true"></i><b>${esc(i[1])}</b></div>`).join('')}`).join('');
}
/* ---------- posting goes through the moderation checker (Edge Function submit-post) ---------- */
async function submitPost(kind,row){
  const {data,error}=await sb.functions.invoke('submit-post',{body:{kind,row}});
  if(error){let m='Something went wrong. Try again.';try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}return {error:m}}
  return {status:data&&data.status};
}
let lastStatus='live',lastNote='',lastPhotos=false;
function blobFrom(d){const [h,b64]=d.split(',');const bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:(h.match(/^data:([^;]+)/)||[])[1]||'image/jpeg'})}
async function uploadPic(dataUrl,rowId,n){
  const path=`${USER.id}/${rowId}/${Date.now()}-${n}.jpg`;
  const {error}=await sb.storage.from(BUCKET).upload(path,blobFrom(dataUrl),{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
  if(error)throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
/* The checked post only carries the basics. Price list, policy and photos are added straight after,
   to your own row. The database only lets owners change these fields, and new photos send the
   listing back for a quick check by the team. */
async function saveExtras(table,name,extras,pics,av){
  const {data:found}=await sb.from(table).select('id').eq('owner_id',USER.id).eq('name',name).order('created_at',{ascending:false}).limit(1);
  const rowId=found&&found[0]&&found[0].id;
  if(!rowId)return {note:'Your listing is posted, but we couldn’t add your price list or photos. Contact us and we’ll sort it.'};
  const upd={...extras};let photoFail=false;
  try{
    if(pics.length){upd.photos=[];for(let i=0;i<pics.length;i++)upd.photos.push(await uploadPic(pics[i],rowId,i))}
    if(av)upd.avatar=await uploadPic(av,rowId,'avatar');
  }catch(_){delete upd.photos;delete upd.avatar;photoFail=true}
  if(!Object.keys(upd).length)return {note:'Your listing is posted, but your photos couldn’t be uploaded.'};
  const {data,error}=await sb.from(table).update(upd).eq('id',rowId).select('status');
  if(error)return {note:'Your listing is posted, but we couldn’t save your price list'+(pics.length||av?' or photos':'')+'.'};
  return {status:data&&data[0]&&data[0].status,photos:!!(upd.photos||upd.avatar),note:photoFail?'Your listing is posted, but your photos couldn’t be uploaded.':''};
}
/* ---------- reviews (saved in Supabase) ---------- */
let rvStars=0;
const ranked=()=>DATA.services.filter(x=>x.status==='live').sort((x,y)=>{const a=liveRv(x).length,b=liveRv(y).length,n=(b?1:0)-(a?1:0);if(n)return n;return avg(y)-avg(x)||b-a||x.name.localeCompare(y.name)});
function reviewBox(it){
  const mine=USER&&(it.reviews||[]).find(r=>r.mine&&r.uid===USER.id);
  if(USER&&it.owner===USER.id)return `<div class="rvlock"><b>This is your business.</b> You can’t review your own listing.</div>`;
  if(mine)return `<div class="rvlock" role="status"><b>Thanks, you've reviewed this business.</b> Each person can leave one review per business.<br><button class="link" type="button" id="rv-del" data-rid="${esc(mine.id)}">Delete my review</button></div>`;
  if(!USER)return `<div class="rvlock"><b>Log in to leave a review.</b> Any signed-in user can review a business.<br><button class="btn pink sm" type="button" data-auth="in" style="margin-top:10px">Log in or sign up</button></div>`;
  return `<form class="rvform" id="rvf" novalidate>
      <p style="margin:0 0 8px;font-weight:700">${rvStars?`You picked ${rvStars} star${rvStars>1?'s':''}`:'How many stars would you give?'}</p>
      <div class="rvpick" role="radiogroup" aria-label="Star rating">${[1,2,3,4,5].map(i=>`<button type="button" class="rvstar" role="radio" aria-checked="${i===rvStars}" aria-label="${i} star${i>1?'s':''}" data-star="${i}"><svg width="34" height="34" viewBox="0 0 24 24" fill="${i<=rvStars?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS.star}"/></svg></button>`).join('')}</div>
      ${rvStars?`<div class="f" style="margin-top:14px"><label for="rv-t">Why ${rvStars} star${rvStars>1?'s':''}?</label><textarea id="rv-t" maxlength="500" placeholder="Tell other students what it was like"></textarea></div>
      <p class="err" id="rv-e" role="alert" hidden></p>
      <button class="btn pink" type="submit" id="rv-go">Post review</button>`:''}
    </form>`;
}
const HLM={'Late fees':{i:'pound',c:'#FFD84D'},'Late policy':{i:'bell',c:'#FF6A9C'},'Hair policies':{i:'scissors',c:'#B9A8FF'}};
function hlList(it){
  const out=[];
  (it.sections||[]).forEach(x=>{
    const m=HLM[x.t]||{i:'star',c:'#6EE0BE'},n=(x.items||[]).length;
    const slides=x.k==='fees'
      ?[`<p class="st-k">${esc(x.t)}</p><h3 class="st-h">Running late?</h3>${x.rows.map(r=>`<div class="st-row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}`]
      :x.items.map((t,i)=>`<p class="st-k">${esc(x.t)} · ${i+1}/${n}</p><p class="st-t">${esc(t)}</p>`);
    out.push({t:x.t,i:m.i,c:m.c,slides});
  });
  if(it.policy)out.push({t:'Policy',i:'star',c:'#6EE0BE',slides:[`<p class="st-k">Policy</p><p class="st-t">${esc(it.policy)}</p>`]});
  return out;
}
function drawDetail(){
  const it=dcur,n=liveRv(it).length,own=USER&&it.owner===USER.id,price=fromPrice(it)||it.price;
  $('dtitle').textContent=it.name;
  $('dbody').innerHTML=`<div class="dprof">${avatar(it,84)}<div><span class="svc">${esc(it.sub||it.cat)}</span><p class="dsub">${esc(it.cat)} service</p>
    <div class="rate" style="margin-top:6px">${n?`${stars(avg(it),16)}<span>${avg(it).toFixed(1)} from ${n} review${n>1?'s':''}</span>`:'<span>No reviews yet</span>'}</div>
    ${it.contact?`<button class="btn pink sm" type="button" data-copy="${esc(it.contact)}" style="margin-top:10px">Copy contact: ${esc(it.contact)}</button>`:''}</div></div>
    <p style="margin:12px 0 0">${esc(it.desc)}</p>
    <div class="meta" style="margin-top:10px">${(price?[price]:[]).concat(it.meta).map(m=>`<span>${esc(m)}</span>`).join('')}</div>
    ${it.status==='pending'?`<p class="policy" style="margin-top:12px">Waiting for approval. Only you can see this listing for now.</p>`:''}
    ${(it.photos||[]).length?`<div class="dphotos">${it.photos.map((p,i)=>`<button type="button" data-p="${i}" aria-label="View photo ${i+1}"><img src="${p}" alt=""></button>`).join('')}</div>`:''}
    ${(it.menu||[]).some(g=>g.items.length)?`<div class="dsec"><h3>Menu and prices</h3>${menuHTML(it)}</div>`:''}
    ${hlList(it).length?`<div class="dsec"><h3>Highlights</h3><div class="hls" role="group" aria-label="Policies and fees. Opens full screen.">${hlList(it).map((h,i)=>`<button class="hlb" type="button" data-hl="${i}" aria-haspopup="dialog"><span class="ring"><span class="in" style="background:${h.c}">${svg(ICONS[h.i],26,2)}</span></span><span>${esc(h.t)}</span></button>`).join('')}</div></div>`:''}
    <div class="dsec"><h3>Contact</h3><div class="contact" style="border:0;padding:0"><code>${esc(it.contact)}</code><button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button></div>${own?'':`<button class="link rep" type="button" data-report="business" data-rid="${esc(it.id)}">Report this listing</button>`}</div>
    <div class="dsec acc"><button class="acc-h" type="button" id="rev-t" aria-expanded="${revOpen}" aria-controls="rev-p"><span class="acc-n">Reviews</span><span class="acc-s">${n?`${stars(avg(it),14)} ${avg(it).toFixed(1)} (${n})`:'No reviews yet'}</span><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="acc-p" id="rev-p" ${revOpen?'':'hidden'}>
        ${n?`<div class="bars" aria-label="Rating breakdown">${[5,4,3,2,1].map(k=>{const c=liveRv(it).filter(r=>r.s===k).length;return `<div class="rbar"><span>${k}</span><i><b style="width:${Math.round(c/n*100)}%"></b></i><em>${c}</em></div>`}).join('')}</div>`:''}
        ${(it.reviews||[]).length?it.reviews.map(r=>`<div class="rv">${stars(r.s)}<p>${esc(r.t)}</p><small>${esc(r.w)}${r.x?' · '+esc(r.x):''}${USER&&r.uid===USER.id?(r.status==='pending'?' · Your review · Waiting for approval':' · Your review'):''}</small>${USER&&r.uid!==USER.id?`<button class="link rep" type="button" data-report="review" data-rid="${esc(r.id)}">Report</button>`:''}</div>`).join(''):'<p style="color:var(--muted);margin:10px 0 0">Be the first to leave a review.</p>'}
        ${reviewBox(it)}
      </div></div>`;
  $('dbody').querySelectorAll('[data-star]').forEach(x=>x.addEventListener('click',()=>{rvStars=+x.dataset.star;revOpen=true;drawDetail();const t=$('rv-t');if(t)t.focus()}));
  const del=$('rv-del');
  if(del)del.addEventListener('click',async()=>{
    if(!await ask({title:'Delete your review?',text:'This can’t be undone.',ok:'Delete review',danger:true}))return;
    const {error}=await sb.from('reviews').delete().eq('id',del.dataset.rid);
    if(error){say('Could not delete. Try again.');return}
    const id=dcur.id;await loadData();dcur=DATA.services.find(x=>x.id===id)||dcur;revOpen=true;render();paintMarquee();drawDetail();say('Review deleted');
  });
  if($('rvf'))$('rvf').addEventListener('submit',async e=>{
    e.preventDefault();
    const t=($('rv-t')||{value:''}).value.trim(),er=$('rv-e');
    if(!rvStars||!t){er.textContent='Tell us why you picked '+rvStars+' star'+(rvStars>1?'s':'')+'.';er.hidden=false;return}
    const go=$('rv-go');go.disabled=true;go.textContent='Posting…';
    const res=await submitPost('review',{business_id:dcur.id,stars:rvStars,body:t,reviewer_name:USER.name});
    if(res.error){go.disabled=false;go.textContent='Post review';er.textContent=res.error;er.hidden=false;return}
    const id=dcur.id;rvStars=0;await loadData();dcur=DATA.services.find(x=>x.id===id)||dcur;
    revOpen=true;render();paintMarquee();drawDetail();$('rev-t').focus();say(res.status==='pending'?'Thanks. Your review will show once our team has checked it':'Review posted');
  });
}
let dOpener=null;
function openDetail(id,btn){
  const it=DATA.services.find(x=>String(x.id)===String(id));if(!it)return;
  dOpener=btn||null;dcur=it;dopen=id;revOpen=false;rvStars=0;drawDetail();dov.hidden=false;document.body.style.overflow='hidden';$('dtitle').focus();
  dov.querySelector('.sheet').scrollTop=0;
}
function closeDetail(){
  dov.hidden=true;document.body.style.overflow='';
  const b=dOpener&&dOpener.isConnected&&dOpener.offsetParent!==null?dOpener:document.querySelector(`#grid [data-detail="${CSS.escape(String(dopen))}"]`);if(b)b.focus();
}
$('dclose').addEventListener('click',closeDetail);
dov.addEventListener('click',e=>{if(e.target===dov)closeDetail();const rt=e.target.closest('#rev-t');if(rt){revOpen=!revOpen;rt.setAttribute('aria-expanded',revOpen);$('rev-p').hidden=!revOpen;if(revOpen)$('rev-p').scrollIntoView({block:'nearest',behavior:'smooth'});return}const au=e.target.closest('[data-auth]');if(au){openAuth('up',()=>{if(!dov.hidden)drawDetail()},au);return}const c=e.target.closest('[data-copy]');if(c){copyText(c.dataset.copy);return}const pb=e.target.closest('[data-p]');if(pb)lbOpen(dcur.photos,pb)});
document.addEventListener('keydown',e=>{
  if(dov.hidden||!lb.hidden||!sv.hidden||!aov.hidden)return;
  if(e.key==='Escape'){closeDetail();return}
  if(e.key!=='Tab')return;
  const f=[...dov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement===$('dtitle'))){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});
grid.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)openDetail(b.dataset.detail,b)});

/* ---------- photos ---------- */
const MAXPH=4;
function shrink(file){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      const m=1000,r=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.round(im.width*r);c.height=Math.round(im.height*r);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82));
    };
    im.onerror=()=>{URL.revokeObjectURL(u);rej()};
    im.src=u;
  });
}
let lbList=[],lbI=0,lbOpener=null;
const lb=document.createElement('div');
lb.id='lb';lb.hidden=true;lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Photos');
lb.innerHTML='<button class="lbb" id="lb-x" type="button" aria-label="Close photos">&times;</button><button class="lbb" id="lb-p" type="button" aria-label="Previous photo">&#8249;</button><img id="lb-i" alt=""><button class="lbb" id="lb-n" type="button" aria-label="Next photo">&#8250;</button><div id="lb-c" aria-live="polite"></div>';
document.body.appendChild(lb);
function lbShow(){const i=$('lb-i');i.src=lbList[lbI];i.alt='Photo '+(lbI+1)+' of '+lbList.length;$('lb-c').textContent=(lbI+1)+' / '+lbList.length;const m=lbList.length<2;$('lb-p').hidden=m;$('lb-n').hidden=m}
function lbOpen(list,btn){lbList=list;lbI=0;lbOpener=btn;lb.hidden=false;lbShow();$('lb-x').focus()}
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
grid.addEventListener('click',e=>{
  const b=e.target.closest('.shot');if(!b)return;
  const it=DATA[tab].find(x=>String(x.id)===b.dataset.lb);
  if(it&&it.photos)lbOpen(it.photos,b);
});

/* ---------- highlights viewer (full screen, story style) ---------- */
const sv=document.createElement('div');
sv.id='story';sv.hidden=true;sv.setAttribute('role','dialog');sv.setAttribute('aria-modal','true');sv.setAttribute('aria-label','Highlight');
sv.innerHTML='<button class="st-arrow" id="st-p" type="button" aria-label="Previous">&#8249;</button><div class="st-card" id="st-card"><div class="st-bars" id="st-bars"></div><div class="st-top"><span id="st-av"></span><div class="st-who"><b id="st-who"></b><small id="st-what"></small></div><button class="st-x" id="st-x" type="button" aria-label="Close highlight">&times;</button></div><div class="st-body" id="st-body" aria-live="polite"></div><button class="st-zone st-l" id="st-pz" type="button" aria-label="Previous slide" tabindex="-1"></button><button class="st-zone st-r" id="st-nz" type="button" aria-label="Next slide" tabindex="-1"></button></div><button class="st-arrow" id="st-n" type="button" aria-label="Next">&#8250;</button>';
document.body.appendChild(sv);
let stIt=null,stHs=[],stH=0,stS=0,stOpener=null;
function stDraw(){
  const h=stHs[stH];
  $('st-card').style.background=h.c;
  $('st-bars').innerHTML=h.slides.map((_,i)=>`<i class="${i<stS?'done':i===stS?'cur':''}"></i>`).join('');
  $('st-av').innerHTML=avatar(stIt,36);
  $('st-who').textContent=stIt.name;
  $('st-what').textContent=h.t+' · '+(stS+1)+' of '+h.slides.length;
  const b=$('st-body');b.innerHTML=`<div class="st-slide">${h.slides[stS]}</div>`;
  sv.setAttribute('aria-label',h.t+' from '+stIt.name);
}
function stNext(){const h=stHs[stH];if(stS<h.slides.length-1)stS++;else if(stH<stHs.length-1){stH++;stS=0}else{stClose();return}stDraw()}
function stPrev(){if(stS>0)stS--;else if(stH>0){stH--;stS=0}stDraw()}
function openStory(i,btn){stIt=dcur;stHs=hlList(dcur);stH=i;stS=0;stOpener=btn;sv.hidden=false;stDraw();$('st-x').focus()}
function stClose(){sv.hidden=true;if(stOpener&&stOpener.isConnected)stOpener.focus()}
$('st-x').addEventListener('click',stClose);
$('st-nz').addEventListener('click',stNext);$('st-pz').addEventListener('click',stPrev);
$('st-n').addEventListener('click',stNext);$('st-p').addEventListener('click',stPrev);
sv.addEventListener('click',e=>{if(e.target===sv)stClose()});
let sx=null;
$('st-card').addEventListener('touchstart',e=>{sx=e.touches[0].clientX},{passive:true});
$('st-card').addEventListener('touchend',e=>{if(sx===null)return;const d=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(d)>60){d<0?stNext():stPrev()}});
document.addEventListener('keydown',e=>{
  if(sv.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();stClose()}
  else if(e.key==='ArrowRight'){e.stopImmediatePropagation();stNext()}
  else if(e.key==='ArrowLeft'){e.stopImmediatePropagation();stPrev()}
  else if(e.key==='Tab'){
    e.stopImmediatePropagation();
    const f=[$('st-p'),$('st-x'),$('st-n')].filter(x=>x.offsetParent!==null);
    const i=f.indexOf(document.activeElement);e.preventDefault();
    f[(i+(e.shiftKey?f.length-1:1))%f.length].focus();
  }
},true);
dov.addEventListener('click',e=>{const h=e.target.closest('[data-hl]');if(h)openStory(+h.dataset.hl,h)});

/* ---------- accounts: real sign up, log in and profile with Supabase Auth ----------
*/
let USER=null,afterAuth=null,aMode='up',aOpener=null,aEmail='';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const XSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function userFrom(u){
  if(!u)return null;
  const m=u.user_metadata||{};
  return {id:u.id,email:u.email,name:m.name||u.email.split('@')[0],type:m.type||'student',created:u.created_at};
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
  $('auth-nav').innerHTML=USER
    ?`<button class="navbtn me" type="button" data-auth="profile" aria-label="Your profile">${avatar({name:USER.name,cat:'Other'},28)}<span>Hi, ${esc(USER.name.split(' ')[0])}</span></button>`
    :`<button class="navbtn" type="button" data-auth="in">Log in</button><button class="btn" type="button" data-auth="up">Sign up</button>`;
  if(typeof addAdminBtn==='function')addAdminBtn();
}

/* ---- auth sheet: sign up, log in, email code, forgot password ---- */
const aov=document.createElement('div');
aov.className='overlay';aov.hidden=true;aov.style.zIndex=70;
aov.innerHTML='<div class="sheet" id="asheet" role="dialog" aria-modal="true" aria-labelledby="a-title"></div>';
document.body.appendChild(aov);
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
function closeAuth(){aov.hidden=true;if(dov.hidden&&ov.hidden)document.body.style.overflow='';if(aOpener&&aOpener.isConnected)aOpener.focus()}
function aFail(msg,btn,label){const e=$('a-err');e.textContent=msg;e.hidden=false;if(btn){btn.disabled=false;btn.textContent=label}}

async function finishAuth(isNew,msg){
  const {data:{user}}=await sb.auth.getUser();
  USER=userFrom(user);renderAuth();
  const cb=afterAuth;afterAuth=null;aOpener=$('auth-nav');
  aov.hidden=true;if(dov.hidden)document.body.style.overflow='';
  say(msg||(isNew?'Welcome to the Board, '+USER.name.split(' ')[0]:'Logged in'));
  if(cb)cb();
  else if(isNew&&USER.type==='business')openSheet({currentTarget:$('auth-nav')});
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
  if(e.key!=='Tab')return;
  const f=[...aov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='a-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* ---- profile sheet: name, your listings, password, log out, delete account ---- */
let pOpener=null;
const pov=document.createElement('div');
pov.className='overlay';pov.hidden=true;pov.style.zIndex=75;
pov.innerHTML='<div class="sheet" id="psheet" role="dialog" aria-modal="true" aria-labelledby="p-title"></div>';
document.body.appendChild(pov);

function drawProfile(){
  const u=USER;if(!u)return;
  const since=new Date(u.created).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  $('psheet').innerHTML=`<div class="sheet-head"><h2 id="p-title" tabindex="-1">Your profile</h2><button class="x" id="p-x" type="button" aria-label="Close">${XSVG}</button></div>
    <div class="dprof">${avatar({name:u.name,cat:'Other'},72)}<div><b style="font-size:18px">${esc(u.name)}</b><p class="dsub">${esc(u.email)}</p><p class="hint" style="margin:4px 0 0">${u.type==='business'?'Runs a business or society':'Student'}, joined ${esc(since)}</p></div></div>
    <form class="dsec" id="p-name-f" novalidate><h3>Your name</h3><div class="f"><label class="sr" for="p-name">Your name</label><input type="text" id="p-name" maxlength="40" value="${esc(u.name)}" autocomplete="name"></div><button class="btn sm" type="submit">Save name</button></form>
    <div class="dsec"><h3>Your listings</h3><div id="p-list"><p class="hint">Loading your listings…</p></div></div>
    <form class="dsec" id="p-pw-f" novalidate><h3>Change password</h3><div class="f"><label for="p-pw">New password <span class="hint">at least 8 characters</span></label><input type="password" id="p-pw" autocomplete="new-password"></div><button class="btn sm" type="submit">Update password</button></form>
    <div class="dsec"><button class="btn ghost" type="button" id="p-out">Log out</button></div>
    <div class="dsec rvlock"><h3>Delete account</h3><p style="margin:0 0 10px">This permanently deletes your account and every listing you’ve posted. It can’t be undone.</p><div class="f"><label for="p-del">Type DELETE to confirm</label><input type="text" id="p-del" autocomplete="off"></div><button class="btn pink sm" type="button" id="p-delbtn">Delete my account</button></div>
    <p class="err" id="p-err" role="alert" hidden></p>`;
  loadMyListings();
}
async function loadMyListings(){
  const [b,s]=await Promise.all([
    sb.from('businesses').select('id,name,what,created_at').eq('owner_id',USER.id).order('created_at',{ascending:false}),
    sb.from('societies').select('id,name,what,created_at').eq('owner_id',USER.id).order('created_at',{ascending:false})
  ]);
  const rows=[...(b.data||[]).map(r=>({...r,t:'businesses',k:'Business'})),...(s.data||[]).map(r=>({...r,t:'societies',k:'Society'}))];
  const el=$('p-list');if(!el)return;
  el.innerHTML=rows.length
    ?rows.map(r=>`<div class="mrow"><span><b>${esc(r.name)}</b><br><span class="hint">${r.k}, ${esc(r.what||'')}, posted ${new Date(r.created_at).toLocaleDateString('en-GB')}</span></span><i aria-hidden="true"></i><button class="link" type="button" data-del-t="${r.t}" data-del-id="${esc(r.id)}" data-del-n="${esc(r.name)}">Remove</button></div>`).join('')
    :'<p class="hint">You haven’t posted anything yet.</p>';
}
function openProfile(btn){pOpener=btn;pov.hidden=false;document.body.style.overflow='hidden';drawProfile();$('p-title').focus()}
function closeProfile(){pov.hidden=true;if(ov.hidden&&dov.hidden)document.body.style.overflow='';(pOpener&&pOpener.isConnected?pOpener:$('auth-nav').querySelector('button')).focus()}
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
    await loadData();paintMarquee();render();loadMyListings();say('Listing removed');return;
  }
  const db=t.closest('#p-delbtn');
  if(db){
    if($('p-del').value.trim()!=='DELETE'){pErr('Type DELETE in the box to confirm.');return}
    db.disabled=true;db.textContent='Deleting…';
    const {error}=await sb.functions.invoke('delete-account',{method:'POST'});
    if(error){db.disabled=false;db.textContent='Delete my account';pErr('Your account couldn’t be deleted. Try again.');return}
    await sb.auth.signOut({scope:'local'});closeProfile();
    await loadData();paintMarquee();render();say('Your account has been deleted');
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
  if(pov.hidden||!aov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeProfile();return}
  if(e.key!=='Tab')return;
  const f=[...pov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='p-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* ---- nav buttons ---- */
$('auth-nav').addEventListener('click',e=>{
  const b=e.target.closest('[data-auth]');if(!b)return;
  if(b.dataset.auth==='profile'){openProfile(b);return}
  openAuth(b.dataset.auth,null,b);
});

/* ---- you must be logged in to list a business or society ---- */
document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',e=>{
  if(USER)return;
  e.stopImmediatePropagation();
  openAuth('up',()=>openSheet({currentTarget:b}),b);
},true));

/* ---- keep the page in sync with the session (also restores login on reload) ---- */
let lastUid;
sb.auth.onAuthStateChange((ev,session)=>{
  USER=userFrom(session&&session.user);
  renderAuth();setTimeout(checkAdmin,0);
  if(!USER&&!pov.hidden)closeProfile();
  /* show or hide your own pending listings when you log in or out */
  const uid=USER?USER.id:null;
  if(lastUid!==undefined&&uid!==lastUid)setTimeout(refresh,0);
  lastUid=uid;
});
renderAuth();

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
  addAdminBtn();
}
function addAdminBtn(){
  const old=$('open-admin');if(old)old.remove();
  if(IS_ADMIN&&USER){const b=document.createElement('button');b.className='navbtn adminbtn';b.type='button';b.id='open-admin';b.textContent='Admin';b.addEventListener('click',()=>openAdmin(b));$('auth-nav').prepend(b)}
}
const admov=document.createElement('div');
admov.className='overlay';admov.hidden=true;admov.style.zIndex=65;
admov.innerHTML='<div class="sheet dsheet" id="admsheet" role="dialog" aria-modal="true" aria-labelledby="adm-title"></div>';
document.body.appendChild(admov);
async function drawAdmin(){
  const sh=$('admsheet');
  sh.innerHTML='<div class="sheet-head"><h2 id="adm-title" tabindex="-1">Admin</h2><button class="x" id="adm-x" type="button" aria-label="Close">&times;</button></div><p class="hint">Loading…</p>';
  const [b,so,r,rep]=await Promise.all([
    sb.from('businesses').select('*').eq('status','pending'),
    sb.from('societies').select('*').eq('status','pending'),
    sb.from('reviews').select('*').eq('status','pending'),
    sb.from('reports').select('*').order('created_at',{ascending:false})
  ]);
  const pics=x=>[...(x.photos||[]),x.avatar].filter(okImg);
  const item=(kind,x,title,text)=>`<div class="adm"><b>${esc(title)}</b><p>${esc(text)}</p>${pics(x).length?`<div class="dphotos">${pics(x).map(p=>`<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="Photo to check" loading="lazy"></a>`).join('')}</div>`:''}${x.policy?`<p>Policy: ${esc(x.policy)}</p>`:''}${x.flag_reason?`<span class="why">${esc(x.flag_reason)}</span>`:''}<div class="acts"><button class="btn sm" type="button" data-approve="${kind}" data-id="${esc(x.id)}">Approve</button><button class="btn sm ghost" type="button" data-remove="${kind}" data-id="${esc(x.id)}">Remove</button></div></div>`;
  const pend=[].concat(
    (b.data||[]).map(x=>item('businesses',x,'Business: '+x.name,x.description)),
    (so.data||[]).map(x=>item('societies',x,'Society: '+x.name,x.description)),
    (r.data||[]).map(x=>item('reviews',x,'Review ('+x.stars+' stars) by '+(x.reviewer_name||'Student'),x.body)));
  const tbl={business:'businesses',society:'societies',review:'reviews'};
  const reps=(rep.data||[]).map(x=>`<div class="adm"><b>Report on a ${esc(x.kind)}</b><p>${esc(x.reason)}</p><span class="why">id ${esc(x.target_id)}</span><div class="acts"><button class="btn sm ghost" type="button" data-remove="${tbl[x.kind]}" data-id="${esc(x.target_id)}" data-rep="${esc(x.id)}">Remove the ${esc(x.kind)}</button><button class="btn sm" type="button" data-dismiss="${esc(x.id)}">Dismiss report</button></div></div>`);
  sh.innerHTML=`<div class="sheet-head"><h2 id="adm-title" tabindex="-1">Admin</h2><button class="x" id="adm-x" type="button" aria-label="Close">&times;</button></div>
    <div class="adm-sec"><h3>Waiting for approval (${pend.length})</h3>${pend.join('')||'<p class="hint">Nothing waiting.</p>'}</div>
    <div class="adm-sec"><h3>Reports (${reps.length})</h3>${reps.join('')||'<p class="hint">No reports.</p>'}</div>`;
}
function openAdmin(btn){admOpener=btn;admov.hidden=false;document.body.style.overflow='hidden';drawAdmin().then(()=>$('adm-title').focus())}
async function closeAdmin(){admov.hidden=true;document.body.style.overflow='';await loadData();paintMarquee();render();if(admOpener&&admOpener.isConnected)admOpener.focus()}
admov.addEventListener('click',async e=>{
  if(e.target===admov||e.target.closest('#adm-x')){closeAdmin();return}
  const a=e.target.closest('[data-approve]'),r=e.target.closest('[data-remove]'),d=e.target.closest('[data-dismiss]');
  if(a){const {error}=await sb.from(a.dataset.approve).update({status:'live',flag_reason:null}).eq('id',a.dataset.id);say(error?'Could not approve':'Approved');drawAdmin()}
  else if(r){if(!await ask({title:'Remove this for good?',text:'It will be deleted from the Board. This can’t be undone.',ok:'Remove',danger:true}))return;const {error}=await sb.from(r.dataset.remove).delete().eq('id',r.dataset.id);if(!error&&r.dataset.rep)await sb.from('reports').delete().eq('id',r.dataset.rep);say(error?'Could not remove':'Removed');drawAdmin()}
  else if(d){await sb.from('reports').delete().eq('id',d.dataset.dismiss);say('Report dismissed');drawAdmin()}
});
document.addEventListener('keydown',e=>{if(!admov.hidden&&e.key==='Escape'){e.stopImmediatePropagation();closeAdmin()}},true);

/* ---------- rankings: businesses ordered by their reviews ---------- */
let rOpener=null;
const rov=document.createElement('div');
rov.className='overlay';rov.hidden=true;rov.style.zIndex=55;
rov.innerHTML='<div class="sheet" id="rsheet" role="dialog" aria-modal="true" aria-labelledby="r-title"></div>';
document.body.appendChild(rov);
function drawRank(){
  const list=ranked();
  $('rsheet').innerHTML=`<div class="sheet-head"><h2 id="r-title" tabindex="-1">Top rated businesses</h2><button class="x" id="r-x" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="hint" style="margin:8px 0 0">Ranked by average star rating. Ties go to the business with more reviews.</p>
    <div class="rklist">${list.length?list.map((it,i)=>{const n=liveRv(it).length;return `<button class="rk ${i<3&&n?'top'+(i+1):''}" type="button" data-rank="${esc(it.id)}"><span class="no">${n?i+1:'–'}</span>${avatar(it,40)}<span class="rt"><b>${esc(it.name)}</b><small>${esc(it.sub||it.cat)}</small></span><span class="rate">${n?`${stars(avg(it))} ${avg(it).toFixed(1)} (${n})`:'No reviews yet'}</span></button>`}).join(''):'<p class="mempty">No businesses yet.</p>'}</div>`;
}
function openRank(btn){rOpener=btn||document.activeElement;rov.hidden=false;document.body.style.overflow='hidden';drawRank();$('r-title').focus()}
function closeRank(){rov.hidden=true;document.body.style.overflow='';if(rOpener&&rOpener.isConnected)rOpener.focus()}
$('open-rank').addEventListener('click',e=>openRank(e.currentTarget));
document.querySelectorAll('[data-open-rank]').forEach(b=>b.addEventListener('click',e=>openRank(e.currentTarget)));
rov.addEventListener('click',e=>{
  if(e.target===rov||e.target.closest('#r-x')){closeRank();return}
  const b=e.target.closest('[data-rank]');if(b){rov.hidden=true;openDetail(b.dataset.rank,b)}
});
document.addEventListener('keydown',e=>{if(!rov.hidden&&e.key==='Escape'){e.stopImmediatePropagation();closeRank()}},true);

/* ---------- settings: light / dark / auto theme ---------- */
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
  $('ssheet').innerHTML=`<div class="sheet-head"><h2 id="s-title" tabindex="-1">Settings</h2><button class="x" id="s-x" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
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
function closeSettings(){sov.hidden=true;if(ov.hidden&&dov.hidden&&aov.hidden)document.body.style.overflow='';if(sOpener&&sOpener.isConnected)sOpener.focus()}
sov.addEventListener('click',e=>{
  if(e.target===sov||e.target.closest('#s-x')){closeSettings();return}
  const b=e.target.closest('[data-theme-opt]');if(b)setTheme(b.dataset.themeOpt);
});
$('open-settings').addEventListener('click',e=>openSettings(e.currentTarget));
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
applyTheme(currentTheme());

/* links from other pages: /#list opens the listing form */
const wantList=location.hash==='#list';
if(wantList)history.replaceState(null,'',location.pathname+location.search);
loadData().then(()=>{paintMarquee();render();if(wantList)document.querySelector('[data-open-register]').click()});
