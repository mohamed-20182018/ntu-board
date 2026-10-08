/* Browse: tiles, tabs, search, cards, "top this week" strip. Reads from API.listings / API.meta / API.top. */
const grid=$('grid'),q=$('q');
const B={tab:'services',cat:null,sub:null,term:'',items:[],total:0,status:'idle',err:'',seq:0,counts:{},PAGE:24};

/* ---------- top strip ---------- */
async function loadTop(){
  try{
    const r=await API.top(),names=r.items.map(x=>x.name);
    if(!names.length){$('track').parentElement.parentElement.hidden=true;return}
    $('track').innerHTML=names.concat(names,names,names).map(w=>`<span>${esc(w)}</span>`).join('');
  }catch(_){$('track').parentElement.parentElement.hidden=true}
}

/* ---------- tiles + tabs ---------- */
$('tiles').innerHTML=TILES.map(t=>`<button class="tile" type="button" data-cat="${t}" aria-pressed="false" style="background:${CAT[t].c}">${svg(ICONS[CAT[t].i],34,2)}<b>${t}</b></button>`).join('');
$('tiles').addEventListener('click',e=>{
  const b=e.target.closest('.tile');if(!b)return;
  B.cat=(B.cat===b.dataset.cat)?null:b.dataset.cat;B.sub=null;
  if(B.cat)B.tab='services';
  loadListings();
});
$('lanes').innerHTML=LANES.map(l=>`<button class="lane" role="tab" id="tab-${l.k}" data-tab="${l.k}" aria-selected="false" tabindex="-1" style="--c:${l.c}"><h3>${l.t}<span class="n" id="n-${l.k}"></span></h3><p>${l.d}</p></button>`).join('');
function switchTab(k){B.tab=k;if(k!=='services'){B.cat=null;B.sub=null}loadListings()}
$('lanes').addEventListener('click',e=>{const b=e.target.closest('.lane');if(b)switchTab(b.dataset.tab)});
$('lanes').addEventListener('keydown',e=>{
  const keys=LANES.map(l=>l.k),i=keys.indexOf(B.tab);let n=null;
  if(e.key==='ArrowRight')n=(i+1)%keys.length;
  if(e.key==='ArrowLeft')n=(i+keys.length-1)%keys.length;
  if(n===null)return;
  e.preventDefault();switchTab(keys[n]);$('tab-'+B.tab).focus();
});
$('subs').addEventListener('click',e=>{const b=e.target.closest('[data-sub]');if(!b)return;B.sub=b.dataset.sub==='All'?null:b.dataset.sub;loadListings();const n=$('subs').querySelector('[aria-pressed="true"]');if(n)n.focus()});

let searchT;
q.addEventListener('input',()=>{clearTimeout(searchT);searchT=setTimeout(()=>{if(q.value.trim()!==B.term)loadListings()},250)});
$('search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchT);loadListings();grid.scrollIntoView({behavior:'smooth',block:'start'})});

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
      ${kind==='services'&&!it.preview?`<button class="btn dark sm" type="button" data-detail="${esc(it.id)}">Menu and reviews</button>`:''}
      <div class="contact"><code>${esc(it.contact)}</code>${kind==='official'?'':`<button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button>`}</div>
    </div>
  </article>`;
}
const skeletons=n=>Array.from({length:n},()=>'<div class="skcard" aria-hidden="true"><div class="sk"></div><div class="skb"><i class="sk"></i><i class="sk"></i><i class="sk"></i><i class="sk"></i></div></div>').join('');

/* ---------- drawing ---------- */
function drawChrome(){
  LANES.forEach(l=>{
    const b=$('tab-'+l.k);b.setAttribute('aria-selected',l.k===B.tab);b.tabIndex=l.k===B.tab?0:-1;
    $('n-'+l.k).textContent=B.counts[l.k]!=null?B.counts[l.k]:'';
  });
  document.querySelectorAll('.tile').forEach(t=>t.setAttribute('aria-pressed',t.dataset.cat===B.cat));
  const note=$('filter-note');
  if(B.cat){note.hidden=false;note.innerHTML=`Showing ${esc(B.cat)} only. <button class="link" type="button" id="clear-cat">Show all services</button>`;$('clear-cat').addEventListener('click',()=>{B.cat=null;B.sub=null;loadListings()})}
  else note.hidden=true;
  const sb=$('subs');
  if(B.tab==='services'&&B.cat&&SUBS[B.cat]&&SUBS[B.cat].length>1){sb.hidden=false;sb.innerHTML=['All'].concat(SUBS[B.cat]).map(x=>`<button class="chipbtn" type="button" data-sub="${esc(x)}" aria-pressed="${(x==='All'&&!B.sub)||x===B.sub}">${esc(x)}</button>`).join('')}
  else{sb.hidden=true;sb.innerHTML=''}
  grid.setAttribute('aria-labelledby','tab-'+B.tab);
}
function drawGrid(){
  grid.setAttribute('aria-busy',B.status==='loading');
  if(B.status==='loading'&&!B.items.length){grid.innerHTML=skeletons(6);$('status').textContent='Loading listings';return}
  if(B.status==='error'&&!B.items.length){grid.innerHTML=`<div class="state err" role="alert"><p>${esc(B.err)}</p><button class="btn dark sm" type="button" id="retry">Try again</button></div>`;$('retry').addEventListener('click',()=>loadListings());$('status').textContent='Could not load listings';return}
  if(!B.items.length){grid.innerHTML=`<div class="state"><p>Nothing matches${B.term?` "${esc(B.term)}"`:''} here yet.</p><span>If you run it, put it on the Board.</span></div>`;$('status').textContent='No listings';return}
  const more=B.items.length<B.total;
  grid.innerHTML=B.items.map(cardHTML).join('')+(more?`<div class="more"><button class="btn ghost" type="button" id="more" ${B.status==='loading'?'aria-busy="true" disabled':''}>Show more (${B.total-B.items.length} left)</button></div>`:'')
    +(B.status==='error'?`<div class="state err" role="alert"><p>${esc(B.err)}</p><button class="btn dark sm" type="button" id="retry">Try again</button></div>`:'');
  const mb=$('more');if(mb)mb.addEventListener('click',()=>loadListings(true));
  const rb=$('retry');if(rb)rb.addEventListener('click',()=>loadListings(B.items.length>0));
  $('status').textContent=B.total+(B.total===1?' listing':' listings')+' shown';
}

/* ---------- loading ---------- */
async function loadListings(append){
  B.term=q.value.trim();
  const seq=++B.seq;
  if(!append){B.items=[];B.total=0}
  B.status='loading';B.err='';drawChrome();drawGrid();
  try{
    const r=await API.listings({kind:B.tab,category:B.cat,sub:B.sub,q:B.term,limit:B.PAGE,offset:append?B.items.length:0});
    if(seq!==B.seq)return;   /* a newer request replaced this one */
    B.items=append?B.items.concat(r.items):r.items;B.total=r.total;B.status='ok';
  }catch(e){
    if(seq!==B.seq)return;
    B.status='error';B.err=errMsg(e);
  }
  drawGrid();
}
async function loadMeta(){try{B.counts=(await API.meta()).counts;drawChrome()}catch(_){}}
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
