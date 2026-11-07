/* the Board: home page (browse, spotlight, listing form). Shared code is in core.js. */
"use strict";
const TILES=['Hair','Nails','Lashes','Food','Photography','Other'];
const LANES=[
  {k:'services',t:'Student services',d:'Hair, nails, lashes, food and more.',c:'var(--butter)'},
  {k:'socs',t:'Societies',d:'What’s on, membership, perks and how to join.',c:'var(--mint)'}
];
const DATA={services:[],socs:[]};
let LOAD_ERR=false,tab='services',cat=null,sub=null;
const grid=$('grid'),q=$('q');

async function loadData(){
  const me=await sessionUser();
  let b,s,r;
  try{[b,s,r]=await Promise.all([rowsFor('businesses','owner_id',me),rowsFor('societies','owner_id',me),rowsFor('reviews','user_id',me)]);LOAD_ERR=false}
  catch(_){LOAD_ERR=true;return}
  DATA.services=b.map(bizFromRow);
  r.forEach(x=>{const it=DATA.services.find(i=>String(i.id)===String(x.business_id));if(it)it.reviews.push(reviewFromRow(x))});
  DATA.socs=s.map(socFromRow);
}
const ranked=()=>DATA.services.filter(x=>x.status==='live').sort((x,y)=>{const a=liveRv(x).length,b=liveRv(y).length,n=(b?1:0)-(a?1:0);if(n)return n;return avg(y)-avg(x)||b-a||x.name.localeCompare(y.name)});

/* ---------- marquee: top rated, repeated so it always fills the strip ---------- */
function paintMarquee(){
  const top=ranked().filter(x=>liveRv(x).length).slice(0,8);
  $('marquee').hidden=!top.length;
  $('mq-list').innerHTML=top.map(x=>`<li>${esc(x.name)}, ${avg(x).toFixed(1)} stars</li>`).join('');
  if(!top.length){$('track').innerHTML='';return}
  let half=[];while(half.length<12)half=half.concat(top);
  $('track').innerHTML=half.concat(half).map(x=>`<a href="${listingUrl(x)}" tabindex="-1">${esc(x.name)} ★ ${avg(x).toFixed(1)}</a>`).join('');
}

/* ---------- tiles and tabs ---------- */
$('tiles').innerHTML=TILES.map(t=>`<button class="tile" type="button" data-cat="${t}" aria-pressed="false" style="background:${CAT[t].c}">${svg(ICONS[CAT[t].i],34,2)}<b>${t}</b></button>`).join('');
$('tiles').addEventListener('click',e=>{
  const b=e.target.closest('.tile');if(!b)return;
  cat=(cat===b.dataset.cat)?null:b.dataset.cat;
  if(cat)tab='services';
  render();
});
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
function cardHTML(it,kind){
  const biz=kind==='services',ph=it.photos||[];
  const c=biz?(CAT[it.cat]||CAT.Other):{c:'var(--mint)',i:'users'};
  const own=!it.mine&&USER&&it.owner===USER.id;
  const exBadge=it.mine?`<span class="ex">Your preview</span>`:it.status==='pending'?`<span class="ex">Waiting for approval</span>`:own?`<span class="ex">Your listing</span>`:'';
  const chips=biz?[fromPrice(it)||it.price].filter(Boolean).concat(it.meta):(it.membership?['Membership: '+it.membership]:[]).concat(it.meta);
  const head=ph.length
    ?`<div class="card-head has-photo"><button class="shot" type="button" data-lb="${esc(it.id)}" aria-label="View ${ph.length} photo${ph.length>1?'s':''} of ${esc(it.name)}"><img src="${esc(ph[0])}" alt="" decoding="async" loading="lazy"></button>${ph.length>1?`<span class="pc">1/${ph.length}</span>`:''}${exBadge}</div>`
    :`<div class="card-head" style="background:${c.c}">${svg(ICONS[c.i],44,1.7)}${exBadge}</div>`;
  return `<article class="card"${it.mine?'':` data-card="${esc(listingUrl(it))}"`}>
    ${head}
    <div class="card-body">
      <div class="who">${avatar(it,64)}<span class="svc">${esc(biz?(it.sub||it.cat):it.cat)}</span></div><span class="cat">${esc(biz?it.cat:'Society')}</span>
      <h3>${esc(it.name)}</h3>
      ${biz?`<div class="rate">${liveRv(it).length?`${stars(avg(it))}<span>${avg(it).toFixed(1)} (${liveRv(it).length})</span>`:'<span>No reviews yet</span>'}</div>`:''}
      <p>${esc(it.desc)}</p>
      ${!biz&&it.perks&&it.perks.length?`<ul class="perks">${it.perks.slice(0,2).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
      <div class="meta">${chips.map(m=>`<span>${esc(m)}</span>`).join('')}</div>
      ${it.mine?'':`<a class="btn dark sm" href="${esc(listingUrl(it))}">${biz?'Menu and reviews':'View society'}</a>`}
      <div class="contact"><code>${esc(it.contact)}</code><button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button></div>
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
  const sbx=$('subs');
  if(tab==='services'&&cat&&SUBS[cat]&&SUBS[cat].length>1){sbx.hidden=false;sbx.innerHTML=['All'].concat(SUBS[cat]).map(x=>`<button class="chipbtn" type="button" data-sub="${esc(x)}" aria-pressed="${(x==='All'&&!sub)||x===sub}">${esc(x)}</button>`).join('')}
  else{sbx.hidden=true;sbx.innerHTML=''}
  grid.setAttribute('aria-labelledby','tab-'+tab);
  const items=DATA[tab].filter(it=>(!cat||it.cat===cat)&&(!sub||it.sub===sub)&&(!term||[it.name,it.cat,it.sub||'',it.desc,it.membership||'',...(it.perks||[]),...it.meta,...[].concat(...(it.menu||[]).map(g=>[g.g||'',...g.items.map(i=>i[0])]))].join(' ').toLowerCase().includes(term)));
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
  const s=e.target.closest('.shot');
  if(s){const it=DATA[tab].find(x=>String(x.id)===s.dataset.lb);if(it&&it.photos.length)lbOpen(it.photos,s);return}
  /* the whole card opens the listing's page; buttons and links inside keep their own job */
  if(e.target.closest('button,a,input,textarea,select'))return;
  const c=e.target.closest('[data-card]');if(c&&!getSelection().toString())location.href=c.dataset.card;
});
async function refresh(){await loadData();paintMarquee();render()}
Board.refresh=refresh;
Board.onUser=(u,first)=>{if(!first)refresh()};

/* ---------- spotlight: Sponsored (paid, always marked) or Featured ---------- */
const P={paid:false,items:[],slide:0,timer:null,hover:false,stopped:false,key:'',kind:'services'};
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function pickPromo(){
  if(tab==='socs'){
    const live=DATA.socs.filter(x=>x.status==='live');
    const paid=live.filter(x=>x.promoted).slice(0,6);
    if(paid.length)return {paid:true,items:paid};
    /* otherwise the most complete society profiles: photos, perks, membership info */
    const score=x=>(x.photos.length?3:0)+(x.perks.length?2:0)+(x.membership?1:0);
    return {paid:false,items:live.filter(x=>score(x)).sort((a,b)=>score(b)-score(a)||String(b.created).localeCompare(String(a.created))).slice(0,5)};
  }
  const live=DATA.services.filter(x=>x.status==='live');
  const match=x=>(!cat||x.cat===cat)&&(!sub||x.sub===sub);
  const paid=live.filter(x=>x.promoted);
  const p=paid.filter(match).concat(paid.filter(x=>!match(x))).slice(0,6);
  if(p.length)return {paid:true,items:p};
  return {paid:false,items:live.filter(x=>match(x)&&liveRv(x).length).sort((x,y)=>avg(y)-avg(x)||liveRv(y).length-liveRv(x).length).slice(0,5)};
}
function slideHTML(it,i,n){
  const biz=it.kind==='business',img=(it.photos||[])[0],r=biz?liveRv(it).length:0,pr=biz?(fromPrice(it)||it.price):it.membership;
  const ic=biz?(CAT[it.cat]||CAT.Other).i:'users';
  return `<div class="pc-slide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${n}: ${esc(it.name)}">
    <div class="pv" style="background:${colourFor(it)}">${img?`<img src="${esc(img)}" alt="" decoding="async" loading="lazy">`:`<span class="pv-ic">${svg(ICONS[ic],72,1.4)}</span>`}${avatar(it,88)}</div>
    <div class="pinfo">
      <span class="svc">${esc(biz?(it.sub||it.cat):it.cat+' society')}</span>
      <h3>${esc(it.name)}</h3>
      ${it.meta[0]?`<p class="near">${svg(ICONS.pin,16,2.2)}${esc(it.meta[0])}</p>`:''}
      ${biz?`<div class="rate">${r?`${stars(avg(it))}<span>${avg(it).toFixed(1)} (${r})</span>`:'<span>No reviews yet</span>'}</div>`:''}
      <p class="pdesc">${esc(it.desc)}</p>
      ${!biz&&it.perks.length?`<ul class="perks">${it.perks.slice(0,2).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
      ${pr?`<div class="meta"><span>${biz?'':'Membership: '}${esc(pr)}</span></div>`:''}
      <div class="pc-ctas"><a class="btn pink" href="${esc(listingUrl(it))}">${biz?'View profile':'View society'}</a>${it.contact?`<button class="btn ghost" type="button" data-copy="${esc(it.contact)}">Copy contact</button>`:''}</div>
    </div>
  </div>`;
}
function drawPromoIfChanged(){
  const pk=LOAD_ERR?{paid:false,items:[]}:pickPromo();
  const key=tab+'|'+pk.paid+'|'+pk.items.map(x=>x.id+':'+(x.kind==='business'?avg(x):'')+':'+(x.photos||[]).length).join(',');
  if(key===P.key)return;
  P.key=key;P.paid=pk.paid;P.items=pk.items;P.slide=0;P.kind=tab;drawPromo();
}
function drawPromo(){
  const el=$('promo-c');stopTimer();
  if(!P.items.length){el.hidden=true;el.innerHTML='';return}
  const n=P.items.length,many=n>1,label=P.paid?'Sponsored':'Featured',socs=P.kind==='socs';
  el.hidden=false;
  el.innerHTML=`<div class="pc-top"><h2 class="pc-label">${label}${socs?' societies':''}</h2><a class="why" href="/how-it-works.html#featured">${P.paid?'What’s this?':socs?'Societies worth a look':'Top rated right now'}</a></div>
  <section class="pc" aria-roledescription="carousel" aria-label="${label} ${socs?'societies':'businesses'}">
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

/* ---------- listing form ---------- */
const ov=$('overlay'),sheet=$('sheet'),stepEl=$('step'),bars=[...document.querySelectorAll('.progress i')];
let st={},opener=null;
const KINDS=[
  {k:'services',t:'A business',s:'Hair, nails, lashes, food, photography and more',i:ICONS.pound,bg:'var(--butter)'},
  {k:'socs',t:'A society',s:'Sport, culture, faith, tech, arts and more',i:ICONS.users,bg:'var(--mint)'}
];
const CATS={services:['Hair','Nails','Lashes','Food','Photography','Other'],socs:['Culture','Sport','Tech','Arts','Faith','Academic','Other']};
function openSheet(e){
  opener=e&&e.currentTarget||document.activeElement;
  st={step:0,kind:null,name:'',cat:'',desc:'',meta:'',contact:'',agree:false,photos:[],pmsg:'',menu:'',policy:'',sub:'',avatar:'',fee:'',perks:''};
  ov.hidden=false;document.body.style.overflow='hidden';draw();
}
function closeSheet(){ov.hidden=true;unlockScroll();if(opener&&opener.focus&&opener.isConnected)opener.focus()}
$('close').addEventListener('click',closeSheet);
ov.addEventListener('click',e=>{if(e.target===ov)closeSheet()});
document.addEventListener('keydown',e=>{
  if(ov.hidden||!aov.hidden||!qov.hidden)return;
  if(e.key==='Escape'){closeSheet();return}
  if(e.key==='Tab')trapTab(e,sheet,'sheet-title');
});
/* you must be logged in to list */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-open-register]');if(!b)return;
  needLogin(()=>openSheet({currentTarget:b}),b);
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
function parseMenu(t){
  const items=t.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,30).map(l=>{
    const m=l.match(/^(.*?)\s*[-–:]\s*(£?\s*\d[\d.,]*.*)$/);
    if(!m)return [l,''];
    let pr=m[2].trim();if(/^\d/.test(pr))pr='£'+pr;return [m[1].trim()||l,pr];
  });
  return items.length?[{g:null,items}]:[];
}
const parsePerks=t=>t.split('\n').map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(Boolean).slice(0,8).map(l=>l.slice(0,80));
function save(){for(const k of ['name','cat','sub','desc','meta','contact','menu','policy','fee','perks']){const el=$('r-'+k);if(el)st[k]=el.value}}

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
    const soc=st.kind==='socs',biz=!soc;
    title.textContent=soc?'Tell us about your society':'Tell us about your business';
    stepEl.innerHTML=`<form id="f" novalidate>
      <div class="f"><label for="r-name">${soc?'Society name':'Business name'}</label><input type="text" id="r-name" maxlength="60" value="${esc(st.name)}" placeholder="${soc?'e.g. Chess Society':'e.g. Lashes by Zara'}"></div>
      <div class="f"><label for="r-cat">Category</label><select id="r-cat"><option value="">Choose one</option>${CATS[st.kind].map(c=>`<option ${st.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      ${biz&&SUBS[st.cat]?`<div class="f"><label for="r-sub">Type of service <span class="hint">what you do, e.g. Barbers or Braids</span></label><select id="r-sub"><option value="">Choose one</option>${subOpts()}</select></div>`:''}
      ${biz?`<div class="f"><span class="lbl" id="av-l">Profile picture <span class="hint">optional, a logo or a face</span></span>
        <div class="avpick">${avatar({name:st.name||'You',cat:st.cat||'Other',avatar:st.avatar},64)}<label class="addph"><input type="file" id="r-avatar" accept="image/jpeg,image/png,image/webp" aria-describedby="av-l"><span>${st.avatar?'Change picture':'+ Add picture'}</span></label>${st.avatar?'<button class="link" type="button" id="av-rm">Remove</button>':''}</div></div>`:''}
      <div class="f"><label for="r-desc">${soc?'What you get up to':'What you offer'} <span class="hint">(one or two lines)</span></label><textarea id="r-desc" maxlength="200">${esc(st.desc)}</textarea></div>
      <div class="f"><label for="r-meta">${soc?'When and where you meet':'Where and when'} <span class="hint">separate with commas</span></label><input type="text" id="r-meta" value="${esc(st.meta)}" placeholder="${soc?'Wed 6pm, Clifton':'City campus, evenings'}"></div>
      ${biz?`<div class="f"><label for="r-menu">Price list <span class="hint">one per line, like Fade - £25</span></label><textarea id="r-menu" placeholder="Fade - £25&#10;Lineup - £15">${esc(st.menu)}</textarea></div><div class="f"><label for="r-policy">Policy <span class="hint">optional, e.g. late or cancellation rules</span></label><input type="text" id="r-policy" maxlength="300" value="${esc(st.policy)}" placeholder="Over 10 minutes late and a late fee applies"></div>`
      :`<div class="f"><label for="r-fee">Membership price <span class="hint">e.g. £5 a year, or Free</span></label><input type="text" id="r-fee" maxlength="40" value="${esc(st.fee)}" placeholder="£5 a year"></div><div class="f"><label for="r-perks">Member perks <span class="hint">optional, one per line, up to 8</span></label><textarea id="r-perks" placeholder="Free entry to socials&#10;10% off at the SU bar">${esc(st.perks)}</textarea></div>`}
      <div class="f"><label for="r-contact">How people reach you <span class="hint">Instagram, email or phone</span></label><input type="text" id="r-contact" maxlength="80" value="${esc(st.contact)}" placeholder="@yourhandle"></div>
      <div class="f"><span class="lbl" id="ph-l">Photos <span class="hint">optional, up to 4. ${soc?'Show what you get up to.':'Show your work.'}</span></span>
        <label class="addph" ${st.photos.length>=MAXPH?'hidden':''}><input type="file" id="r-photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-describedby="ph-l"><span>+ Add photos</span></label>
        <p class="hint" id="ph-m" role="status">${esc(st.pmsg)}</p>
        <div class="photos">${st.photos.map((p,i)=>`<div class="ph"><img src="${p}" alt="Photo ${i+1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i+1}">&times;</button></div>`).join('')}</div>
      </div>
      <p class="err" id="err" role="alert" hidden></p>
      <div class="row-btns"><button type="button" class="btn ghost" id="back">Back</button><button class="btn pink" type="submit">Preview</button></div>
    </form>`;
    if(biz){
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
      const miss=[['name','a name'],['cat','a category'],['desc','a short description'],['contact','a way to contact you']].filter(([k])=>!st[k].trim()).map(x=>x[1]);
      const er=$('err');
      if(miss.length){er.textContent='Add '+miss.join(', ')+' to continue.';er.hidden=false;return}
      st.step=2;draw();
    });
  }else if(st.step===2){
    title.textContent='Here’s how it’ll look';
    const meta=st.meta.split(',').map(s=>s.trim()).filter(Boolean);
    const item=st.kind==='services'
      ?{kind:'business',name:st.name,cat:st.cat,desc:st.desc,price:'',meta,contact:st.contact,mine:true,sub:st.sub,avatar:st.avatar,reviews:[],policy:st.policy.trim(),menu:parseMenu(st.menu),photos:st.photos.slice(),id:'preview'}
      :{kind:'society',name:st.name,cat:st.cat,desc:st.desc,meta,contact:st.contact,mine:true,photos:st.photos.slice(),membership:st.fee.trim(),perks:parsePerks(st.perks),id:'preview'};
    stepEl.innerHTML=`<div class="preview-label">Preview</div><div style="pointer-events:none">${cardHTML(item,st.kind)}</div>
      <label class="check" for="r-agree"><input type="checkbox" id="r-agree" ${st.agree?'checked':''}>I confirm these are real contact details, I agree to the <a href="/rules.html" target="_blank">community rules</a>, and I understand the Board is a listings platform only. It doesn’t vet or endorse anyone’s product or service.</label>
      <p class="err" id="err2" role="alert" hidden>Tick the box to post your listing.</p>
      <div class="row-btns"><button class="btn ghost" type="button" id="back2">Edit</button><button class="btn pink" type="button" id="post">Post to the Board</button></div>`;
    $('back2').addEventListener('click',()=>{st.step=1;draw()});
    $('r-agree').addEventListener('change',e=>{st.agree=e.target.checked});
    $('post').addEventListener('click',async()=>{
      if(!st.agree){$('err2').hidden=false;return}
      const btn=$('post');btn.disabled=true;btn.textContent='Posting…';
      const biz=st.kind==='services',table=biz?'businesses':'societies';
      const row=biz
        ?{name:st.name,what:st.sub&&st.sub!=='Other'?st.sub:st.cat,price:fromPrice(item)||'',location:meta.join(', '),description:st.desc,contact:st.contact}
        :{name:st.name,what:st.cat,meet:meta.join(', '),description:st.desc,contact:st.contact};
      const res=await submitPost(biz?'business':'society',row);
      if(res.error){btn.disabled=false;btn.textContent='Post to the Board';$('err2').textContent=res.error;$('err2').hidden=false;return}
      lastStatus=res.status;lastNote='';lastPhotos=false;lastUrl='';
      const extras={};
      if(biz){if(item.menu.length)extras.menu=item.menu;if(item.policy)extras.policy=item.policy.slice(0,300)}
      else{if(item.membership)extras.membership_price=item.membership;if(item.perks.length)extras.perks=item.perks}
      const pics=st.photos.slice(),av=biz?st.avatar:'';
      btn.textContent=pics.length||av?'Uploading photos…':'Saving…';
      const r=await saveExtras(table,row.name,extras,pics,av);
      if(r.status)lastStatus=r.status;
      lastNote=r.note||'';lastPhotos=!!r.photos;
      if(r.id)lastUrl=listingUrl({kind:biz?'business':'society',id:r.id});
      await loadData();
      tab=st.kind;cat=null;q.value='';render();paintMarquee();
      st.step=3;draw();
    });
  }else{
    const held=lastStatus==='pending';
    title.textContent=held?'Sent for a quick check':'You’re on the Board';
    stepEl.innerHTML=`<div class="done"><div class="big-pin" aria-hidden="true"></div>
      <p style="margin:0 0 6px;font-weight:700;font-size:18px">${esc(st.name)} ${held?'is waiting for approval.':'is live.'}</p>
      <p style="margin:0;color:var(--muted)">${held?(lastPhotos?'Our team checks every photo before it goes up. Only you can see your listing until then, usually within a day.':'Something in your listing needs a quick look from our team. Only you can see it until it’s approved.'):'Anyone browsing the Board can see it now.'}</p>
      ${lastNote?`<p class="err" style="margin-top:12px">${esc(lastNote)}</p>`:''}
      <div class="row-btns" style="justify-content:center">${lastUrl?`<a class="btn" href="${esc(lastUrl)}">See my listing</a>`:'<button class="btn" type="button" id="see">See my listing</button>'}</div></div>`;
    const see=$('see');if(see)see.addEventListener('click',()=>{closeSheet();$('browse').scrollIntoView({behavior:'smooth'})});
  }
  title.focus({preventScroll:true});
}

/* posting goes through the moderation checker (Edge Function submit-post) */
async function submitPost(kind,row){
  const {data,error}=await sb.functions.invoke('submit-post',{body:{kind,row}});
  if(error){let m='Something went wrong. Try again.';try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}return {error:m}}
  return {status:data&&data.status};
}
let lastStatus='live',lastNote='',lastPhotos=false,lastUrl='';
function blobFrom(d){const [h,b64]=d.split(',');const bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:(h.match(/^data:([^;]+)/)||[])[1]||'image/jpeg'})}
async function uploadPic(dataUrl,rowId,n){
  const path=`${USER.id}/${rowId}/${Date.now()}-${n}.jpg`;
  const {error}=await sb.storage.from(BUCKET).upload(path,blobFrom(dataUrl),{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
  if(error)throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
/* The checked post only carries the basics. Price list, policy, membership, perks and photos are
   added straight after, to your own row. The database only lets owners change these fields,
   and new photos send the listing back for a quick check by the team. */
async function saveExtras(table,name,extras,pics,av){
  const {data:found}=await sb.from(table).select('id').eq('owner_id',USER.id).eq('name',name).order('created_at',{ascending:false}).limit(1);
  const rowId=found&&found[0]&&found[0].id;
  if(!rowId)return {note:Object.keys(extras).length||pics.length||av?'Your listing is posted, but we couldn’t add the extra details or photos. Contact us and we’ll sort it.':''};
  if(!Object.keys(extras).length&&!pics.length&&!av)return {id:rowId};
  const upd={...extras};let photoFail=false;
  try{
    if(pics.length){upd.photos=[];for(let i=0;i<pics.length;i++)upd.photos.push(await uploadPic(pics[i],rowId,i))}
    if(av)upd.avatar=await uploadPic(av,rowId,'avatar');
  }catch(_){delete upd.photos;delete upd.avatar;photoFail=true}
  if(!Object.keys(upd).length)return {id:rowId,note:'Your listing is posted, but your photos couldn’t be uploaded.'};
  const {data,error}=await sb.from(table).update(upd).eq('id',rowId).select('status');
  if(error)return {id:rowId,note:'Your listing is posted, but we couldn’t save the extra details'+(pics.length||av?' or photos':'')+'.'};
  return {id:rowId,status:data&&data[0]&&data[0].status,photos:!!(upd.photos||upd.avatar),note:photoFail?'Your listing is posted, but your photos couldn’t be uploaded.':''};
}

/* links from other pages: /#list opens the listing form */
const wantList=location.hash==='#list';
if(wantList)history.replaceState(null,'',location.pathname+location.search);
loadData().then(()=>{paintMarquee();render();if(wantList)document.querySelector('.hero [data-open-register]').click()});
