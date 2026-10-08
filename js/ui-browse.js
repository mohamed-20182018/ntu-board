/* Browse: tiles, tabs, search, cards, "top this week" strip. Reads from API.listings / API.meta / API.top. */
/* Only the home page has the browse area. On other pages these become detached stand-ins so nothing breaks. */
const onHome=!!document.getElementById('grid');
const $$=id=>$(id)||document.createElement(id==='q'?'input':'div');
const grid=$$('grid'),q=$$('q');
const B={sort:'',minRating:0,facets:{},tab:'services',cat:null,sub:null,term:'',items:[],total:0,status:'idle',err:'',seq:0,counts:{},PAGE:24};

/* ---------- top strip ---------- */
async function loadTop(){
  if(!onHome)return;
  try{
    const r=await API.top(),names=r.items.map(x=>x.name);
    if(!names.length){$$('track').parentElement.parentElement.hidden=true;return}
    $$('track').innerHTML=names.concat(names,names,names).map(w=>`<span>${esc(w)}</span>`).join('');
  }catch(_){$$('track').parentElement.parentElement.hidden=true}
}

/* ---------- tiles + tabs ---------- */
$$('tiles').innerHTML=TILES.map(t=>`<button class="tile" type="button" data-cat="${t}" aria-pressed="false" style="background:${CAT[t].c}">${svg(ICONS[CAT[t].i],34,2)}<b>${t}</b></button>`).join('');
$$('tiles').addEventListener('click',e=>{
  const b=e.target.closest('.tile');if(!b)return;
  B.cat=(B.cat===b.dataset.cat)?null:b.dataset.cat;B.sub=null;
  if(B.cat)B.tab='services';
  loadListings();
  if(B.cat)$$('catpanel').scrollIntoView({block:'nearest',behavior:'smooth'});
});
$$('lanes').innerHTML=LANES.map(l=>`<button class="lane" role="tab" id="tab-${l.k}" data-tab="${l.k}" aria-selected="false" tabindex="-1" style="--c:${l.c}"><h3>${l.t}<span class="n" id="n-${l.k}"></span></h3><p>${l.d}</p></button>`).join('');
function switchTab(k){B.tab=k;if(k!=='services'){B.cat=null;B.sub=null}loadListings()}
$$('lanes').addEventListener('click',e=>{const b=e.target.closest('.lane');if(b)switchTab(b.dataset.tab)});
$$('lanes').addEventListener('keydown',e=>{
  const keys=LANES.map(l=>l.k),i=keys.indexOf(B.tab);let n=null;
  if(e.key==='ArrowRight')n=(i+1)%keys.length;
  if(e.key==='ArrowLeft')n=(i+keys.length-1)%keys.length;
  if(n===null)return;
  e.preventDefault();switchTab(keys[n]);$('tab-'+B.tab).focus();
});
$$('catpanel').addEventListener('click',e=>{
  if(e.target.closest('#clear-cat')){B.cat=null;B.sub=null;loadListings();const t=document.querySelector('.tile');if(t)t.focus();return}
  const b=e.target.closest('[data-sub]');if(!b)return;B.sub=b.dataset.sub==='All'?null:b.dataset.sub;loadListings();
});
$$('filters').addEventListener('change',e=>{
  if(e.target.id==='f-sort'){B.sort=e.target.value;loadListings()}
  if(e.target.id==='f-rate'){B.minRating=+e.target.value||0;loadListings()}
});
$$('filters').addEventListener('click',e=>{
  if(e.target.closest('#f-clear')){B.sort='';B.minRating=0;loadListings();$('f-sort').focus()}
});

let searchT;
q.addEventListener('input',()=>{clearTimeout(searchT);searchT=setTimeout(()=>{if(q.value.trim()!==B.term)loadListings()},250)});
$$('search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchT);loadListings();grid.scrollIntoView({behavior:'smooth',block:'start'})});

/* ---------- cards ---------- */
function headFor(it){
  if(it.kind==='services'){const c=CAT[it.cat]||CAT.Other;return {bg:c.c,icon:ICONS[c.i]}}
  if(it.kind==='socs')return {bg:'var(--mint)',icon:ICONS.users};
  return {bg:'var(--sky)',icon:ICONS.bell};
}
function cardHTML(it){
  const h=headFor(it),ph=it.photos||[],kind=it.kind;
  const tag=it.preview?'Your preview':it.example?'Example':'';
  const tagEl=tag?`<span class="ex">${tag}</span>`:'';
  const head=ph.length
    ?`<div class="card-head has-photo"><button class="shot" type="button" data-lb="${esc(it.id)}" aria-label="View ${ph.length} photo${ph.length>1?'s':''} of ${esc(it.name)}"><img src="${esc(ph[0])}" alt="" decoding="async" loading="lazy"></button>${ph.length>1?`<span class="pc">1/${ph.length}</span>`:''}${tagEl}</div>`
    :`<div class="card-head" style="background:${h.bg}">${svg(h.icon,44,1.7)}${tagEl}</div>`;
  const n=it.reviewCount||0;
  return `<article class="card">
    ${head}
    <div class="card-body">
      ${kind==='services'?`<div class="who">${avatar(it,64)}<span class="svc">${esc(it.sub||it.cat)}</span></div><span class="cat">${esc(it.cat)}</span>`:`<span class="cat">${esc(it.cat)}</span>`}
      <h3>${esc(it.name)}</h3>
      ${kind==='services'?`<div class="rate">${n&&it.rating!=null?`${stars(it.rating)}<span>${it.rating.toFixed(1)} (${n})</span>`:'<span>No reviews yet</span>'}</div>`:''}
      <p>${esc(it.desc)}</p>
      <div class="meta">${(it.from?[it.from]:[]).concat(it.meta||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</div>
      ${it.near?`<p class="near">${esc(it.near)}</p>`:''}${kind==='services'&&!it.preview?`<button class="btn dark sm" type="button" data-detail="${esc(it.id)}">Menu and reviews</button>`:''}
      <div class="contact"><code>${esc(it.contact)}</code>${kind==='official'?'':`<button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button>`}</div>
    </div>
  </article>`;
}
const skeletons=n=>Array.from({length:n},()=>'<div class="skcard" aria-hidden="true"><div class="sk"></div><div class="skb"><i class="sk"></i><i class="sk"></i><i class="sk"></i><i class="sk"></i></div></div>').join('');

/* ---------- drawing ---------- */
function drawChrome(){
  if(!onHome)return;
  LANES.forEach(l=>{
    const b=$('tab-'+l.k);b.setAttribute('aria-selected',l.k===B.tab);b.tabIndex=l.k===B.tab?0:-1;
    $('n-'+l.k).textContent=B.counts[l.k]!=null?B.counts[l.k]:'';
  });
  document.querySelectorAll('.tile').forEach(t=>t.setAttribute('aria-pressed',t.dataset.cat===B.cat));
  /* keep keyboard focus on the same control when the chips and filters are redrawn */
  const fa=document.activeElement,fkey=fa&&(fa.id||(fa.dataset&&fa.dataset.sub&&'sub:'+fa.dataset.sub));
  const cp=$$('catpanel'),fl=$$('filters'),svc=B.tab==='services';
  q.placeholder=B.cat&&svc?`Search in ${B.cat}`:'Search braids, Python, netball';
  if(svc&&B.cat){
    const c=CAT[B.cat]||CAT.Other,types=SUBS[B.cat]||[],f=B.facets.subs||{};
    const all=Object.values(f).reduce((a,n)=>a+n,0);
    cp.hidden=false;
    cp.innerHTML=`<div class="cp-head"><span class="cp-ic" style="background:${c.c}">${svg(ICONS[c.i],26,2)}</span><div><h3>${esc(B.cat)}</h3><p>${B.status==='loading'?'Loading…':`${B.total} ${B.total===1?'listing':'listings'}${B.sub?' in '+esc(B.sub):''}`}</p></div><button class="btn ghost sm" type="button" id="clear-cat">All categories</button></div>
      ${types.length?`<p class="cp-q" id="cp-q">What are you looking for?</p><div class="cp-types" role="group" aria-labelledby="cp-q">${['All'].concat(types).map(x=>{const n=x==='All'?all:(f[x]||0);return `<button class="typebtn" type="button" data-sub="${esc(x)}" aria-pressed="${(x==='All'&&!B.sub)||x===B.sub}">${esc(x==='All'?'Everything':x)}<i>${n}</i></button>`}).join('')}</div>`:''}`;
  }else{cp.hidden=true;cp.innerHTML=''}
  if(svc){
    const any=B.sort||B.minRating;
    fl.hidden=false;
    fl.innerHTML=`<label class="fsel"><span>Sort</span><select id="f-sort"><option value="">Recommended</option>${[['top','Top rated'],['price','Lowest price'],['reviews','Most reviews'],['reply','Fastest reply']].map(([v,t])=>`<option value="${v}" ${B.sort===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label class="fsel"><span>Rating</span><select id="f-rate"><option value="">Any rating</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${B.minRating===n?'selected':''}>${n===5?'5 stars only':n+' stars and up'}</option>`).join('')}</select></label>
      ${any?'<button class="link" type="button" id="f-clear">Clear filters</button>':''}`;
  }else{fl.hidden=true;fl.innerHTML=''}
  if(fkey){const n=fkey.startsWith('sub:')?cp.querySelector(`[data-sub="${CSS.escape(fkey.slice(4))}"]`):document.getElementById(fkey);if(n&&n!==fa)n.focus()}
  grid.setAttribute('aria-labelledby','tab-'+B.tab);
}
function drawGrid(){
  if(!onHome)return;
  grid.setAttribute('aria-busy',B.status==='loading');
  if(B.status==='loading'&&!B.items.length){grid.innerHTML=skeletons(6);$$('status').textContent='Loading listings';return}
  if(B.status==='error'&&!B.items.length){grid.innerHTML=`<div class="state err" role="alert"><p>${esc(B.err)}</p><button class="btn dark sm" type="button" id="retry">Try again</button></div>`;$('retry').addEventListener('click',()=>loadListings());$$('status').textContent='Could not load listings';return}
  if(!B.items.length){const filtered=B.sub||B.minRating;grid.innerHTML=`<div class="state"><p>Nothing matches${B.term?` "${esc(B.term)}"`:''}${filtered?' with these filters':''} yet.</p>${filtered?'<button class="btn ghost sm" type="button" id="empty-clear">Clear filters</button>':'<span>If you run it, put it on the Board.</span>'}</div>`;const ec=$('empty-clear');if(ec)ec.addEventListener('click',()=>{B.sub=null;B.minRating=0;B.sort='';loadListings()});$$('status').textContent='No listings';return}
  const more=B.items.length<B.total;
  grid.innerHTML=B.items.map(cardHTML).join('')+(more?`<div class="more"><button class="btn ghost" type="button" id="more" ${B.status==='loading'?'aria-busy="true" disabled':''}>Show more (${B.total-B.items.length} left)</button></div>`:'')
    +(B.status==='error'?`<div class="state err" role="alert"><p>${esc(B.err)}</p><button class="btn dark sm" type="button" id="retry">Try again</button></div>`:'');
  const mb=$('more');if(mb)mb.addEventListener('click',()=>loadListings(true));
  const rb=$('retry');if(rb)rb.addEventListener('click',()=>loadListings(B.items.length>0));
  $$('status').textContent=B.total+(B.total===1?' listing':' listings')+' shown';
}

/* ---------- loading ---------- */
async function loadListings(append){
  if(!onHome)return;
  B.term=q.value.trim();
  const seq=++B.seq;
  if(!append){B.items=[];B.total=0}
  B.status='loading';B.err='';drawChrome();drawGrid();
  try{
    const svc=B.tab==='services';
    const r=await API.listings({kind:B.tab,category:B.cat,sub:B.sub,q:B.term,limit:B.PAGE,offset:append?B.items.length:0,sort:svc?B.sort:'',minRating:svc&&B.minRating?B.minRating:''});
    if(seq!==B.seq)return;   /* a newer request replaced this one */
    B.items=append?B.items.concat(r.items):r.items;B.total=r.total;B.facets=r.facets||{};B.status='ok';drawChrome();
  }catch(e){
    if(seq!==B.seq)return;
    B.status='error';B.err=errMsg(e);
  }
  drawGrid();
}
async function loadMeta(){if(!onHome)return;try{B.counts=(await API.meta()).counts;drawChrome()}catch(_){}}
/* Update one card in place (for example after a new review) without reloading the list. */
function patchListing(id,patch){const it=B.items.find(x=>x.id===id);if(it){Object.assign(it,patch);drawGrid()}}

/* ---------- card actions ---------- */
grid.addEventListener('click',e=>{
  const c=e.target.closest('[data-copy]');
  if(c){
    const v=c.dataset.copy;
    const fallback=()=>{const r=document.createRange();r.selectNodeContents(c.previousElementSibling);const s=getSelection();s.removeAllRanges();s.addRange(r);say('Selected. Copy it from here')};
    try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),fallback)}catch(_){fallback()}
    return;
  }
  const d=e.target.closest('[data-detail]');if(d){openDetail(d.dataset.detail,d);return}
  const s=e.target.closest('.shot');
  if(s){const it=B.items.find(x=>x.id===s.dataset.lb);if(it&&it.photos)lbOpen(it.photos,s)}
});
