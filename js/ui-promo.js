/* Paid placements ("Sponsored") on the home page, plus the shared "use my location" helper.
   Three ways to show them, picked with ?promo=a|b|c in the address (default a):
     a  Featured row: a strip of big cards between the filters and the results
     b  In the results: wide sponsored cards mixed into the grid (1st and 7th place)
     c  Spotlight: one large rotating banner right under the search bar
   Data comes from API.promoted, which matches the category/type the student picked and sorts by distance. */
const PROMO=(()=>{const v=(new URLSearchParams(location.search).get('promo')||'a').toLowerCase();return ['a','b','c'].includes(v)?v:'a'})();
const P={items:[],seq:0,slide:0,timer:null,paused:false};
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- location (shared by the filter button and the "Nearest" sort) ---------- */
function askLocation(ok,fail,btn){
  if(!navigator.geolocation){say('Your browser can’t share location.');if(fail)fail();return}
  const done=busy(btn||null,'Finding you…');
  navigator.geolocation.getCurrentPosition(p=>{
    done();setLoc({lat:Math.round(p.coords.latitude*100)/100,lng:Math.round(p.coords.longitude*100)/100});
    if(ok)ok();else loadListings();
  },()=>{done();say('Couldn’t get your location. Check your browser’s location setting.');if(fail)fail()},{maximumAge:600000,timeout:10000});
}

/* ---------- shared bits ---------- */
const sponsoredTag='<span class="spons" title="Businesses pay to appear here">Sponsored</span>';
function promoVisual(it,big){
  const c=CAT[it.cat]||CAT.Other,img=it.banner||(it.photos||[])[0];
  return `<div class="pv" style="background:${c.c}">${img?`<img src="${esc(img)}" alt="" decoding="async" loading="lazy">`:`<span class="pv-ic">${svg(ICONS[c.i],big?72:52,1.4)}</span>`}${avatar(it,big?88:64)}</div>`;
}
function promoInfo(it){
  const n=it.reviewCount||0;
  return `<span class="svc">${esc(it.sub||it.cat)}</span>
    <h3><button class="cardlink" type="button" data-detail="${esc(it.id)}">${esc(it.name)}</button></h3>
    ${whereText(it)?`<p class="near">${PIN_ICON}${esc(whereText(it))}</p>`:''}
    <div class="rate">${n&&it.rating!=null?`${stars(it.rating)}<span>${it.rating.toFixed(1)} (${n})</span>`:'<span>No reviews yet</span>'}</div>
    <p class="pdesc">${esc(it.desc)}</p>
    <div class="meta">${it.from?`<span>${esc(it.from)}</span>`:''}</div>`;
}
const whyLink='<a class="why" href="how-it-works.html#featured">What’s this?</a>';

/* ---------- option a: featured row ---------- */
function drawPromoA(){
  const el=$('promo-a');
  if(!P.items.length){el.hidden=true;el.innerHTML='';return}
  el.hidden=false;
  el.innerHTML=`<div class="pa-head"><h2>Featured${B.cat?' in '+esc(B.sub||B.cat):''}</h2>${sponsoredTag}${whyLink}</div>
    <div class="pa-row" role="list">${P.items.map(it=>`<article class="pcard" role="listitem">${promoVisual(it)}<div class="pinfo">${promoInfo(it)}</div></article>`).join('')}</div>`;
}

/* ---------- option b: wide sponsored cards inside the results ---------- */
function promoWideHTML(it){return `<article class="card pwide">${promoVisual(it,true)}<div class="pinfo">${sponsoredTag}${promoInfo(it)}</div></article>`}
/* Called by drawGrid in ui-browse.js with the normal card HTML strings. */
function promoInGrid(cards){
  if(PROMO!=='b'||B.tab!=='services'||!P.items.length)return cards;
  const out=cards.slice();
  out.splice(0,0,promoWideHTML(P.items[0]));
  if(P.items[1]&&out.length>7)out.splice(7,0,promoWideHTML(P.items[1]));
  return out;
}

/* ---------- option c: spotlight carousel ---------- */
function drawPromoC(){
  const el=$('promo-c');
  clearInterval(P.timer);
  if(!P.items.length){el.hidden=true;el.innerHTML='';return}
  if(P.slide>=P.items.length)P.slide=0;
  const it=P.items[P.slide],many=P.items.length>1;
  el.hidden=false;
  el.innerHTML=`<section class="pc" aria-roledescription="carousel" aria-label="Sponsored businesses">
    <div class="pc-slide" aria-roledescription="slide" aria-label="${P.slide+1} of ${P.items.length}">
      ${promoVisual(it,true)}
      <div class="pinfo">${sponsoredTag}${promoInfo(it)}
        <div class="pc-ctas"><button class="btn pink" type="button" data-detail="${esc(it.id)}">View profile</button><button class="btn ghost" type="button" data-dm="${esc(it.id)}">Message</button></div>
      </div>
    </div>
    ${many?`<div class="pc-nav"><button class="x" type="button" id="pc-prev" aria-label="Previous sponsored business">&#8249;</button><div class="pc-dots">${P.items.map((_,i)=>`<button type="button" data-slide="${i}" aria-label="Show ${i+1}" aria-current="${i===P.slide}"></button>`).join('')}</div><button class="x" type="button" id="pc-next" aria-label="Next sponsored business">&#8250;</button>${whyLink}</div>`:`<div class="pc-nav">${whyLink}</div>`}
  </section>`;
  if(many&&!REDUCED)P.timer=setInterval(()=>{if(!P.paused){P.slide=(P.slide+1)%P.items.length;drawPromoC()}},6000);
}

/* ---------- loading ---------- */
async function loadPromo(){
  if(!onHome)return;
  const seq=++P.seq;
  if(B.tab!=='services'){P.items=[];render();return}
  try{
    const r=await API.promoted({category:B.cat,sub:B.sub,lat:LOC&&LOC.lat,lng:LOC&&LOC.lng,limit:5});
    if(seq!==P.seq)return;
    P.items=r.items;P.slide=0;
  }catch(_){if(seq!==P.seq)return;P.items=[]}
  render();
  function render(){
    if(PROMO==='a')drawPromoA();
    if(PROMO==='c')drawPromoC();
    if(PROMO==='b')drawGrid();
  }
}

/* ---------- clicks ---------- */
function promoClick(e){
  const dm=e.target.closest('[data-dm]');if(dm){startDM(dm.dataset.dm,dm);return}
  const d=e.target.closest('[data-detail]');if(d){openDetail(d.dataset.detail,d);return}
  if(e.target.closest('#pc-prev')){P.slide=(P.slide+P.items.length-1)%P.items.length;drawPromoC();$('pc-prev').focus();return}
  if(e.target.closest('#pc-next')){P.slide=(P.slide+1)%P.items.length;drawPromoC();$('pc-next').focus();return}
  const s=e.target.closest('[data-slide]');if(s){P.slide=+s.dataset.slide;drawPromoC();const n=$('promo-c').querySelector(`[data-slide="${P.slide}"]`);if(n)n.focus()}
}
if(onHome){
  $('promo-a').addEventListener('click',promoClick);
  const pc=$('promo-c');
  pc.addEventListener('click',promoClick);
  /* pause the spotlight while someone is looking at it or using it */
  pc.addEventListener('mouseenter',()=>P.paused=true);pc.addEventListener('mouseleave',()=>P.paused=false);
  pc.addEventListener('focusin',()=>P.paused=true);pc.addEventListener('focusout',()=>P.paused=false);

  /* demo switcher so the three options can be compared */
  const sw=document.createElement('nav');
  sw.className='promo-switch';sw.setAttribute('aria-label','Sponsored placement demo');
  sw.innerHTML=`<span>Sponsored spot demo</span>${[['a','A · Featured row'],['b','B · In the results'],['c','C · Spotlight']].map(([k,t])=>`<a href="?promo=${k}#browse" ${k===PROMO?'aria-current="page"':''}>${t}</a>`).join('')}`;
  document.body.appendChild(sw);
}
