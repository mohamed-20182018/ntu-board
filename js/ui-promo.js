/* Sponsored spotlight on the home page, plus the shared "use my location" helper.
   Businesses pay to appear here. It slides through them on its own (pauses on hover, focus,
   or the pause button) and matches the category the student picked, topping up with other
   sponsored businesses so there is always something to scroll through. Data: API.promoted. */
const P={items:[],seq:0,slide:0,timer:null,hover:false,stopped:false};
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLIDE_MS=5000;

/* ---------- location (shared by the filter button and the "Nearest" sort) ---------- */
function askLocation(ok,fail,btn){
  if(!navigator.geolocation){say('Your browser can’t share location.');if(fail)fail();return}
  const done=busy(btn||null,'Finding you…');
  navigator.geolocation.getCurrentPosition(p=>{
    done();setLoc({lat:Math.round(p.coords.latitude*100)/100,lng:Math.round(p.coords.longitude*100)/100});
    if(ok)ok();else loadListings();
  },()=>{done();say('Couldn’t get your location. Check your browser’s location setting.');if(fail)fail()},{maximumAge:600000,timeout:10000});
}

/* ---------- one slide ---------- */
function slideHTML(it,i,n){
  const c=CAT[it.cat]||CAT.Other,img=it.banner||(it.photos||[])[0],r=it.reviewCount||0;
  return `<div class="pc-slide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${n}: ${esc(it.name)}" ${i===P.slide?'':'aria-hidden="true" inert'}>
    <div class="pv" style="background:${c.c}">${img?`<img src="${esc(img)}" alt="" decoding="async" loading="lazy">`:`<span class="pv-ic">${svg(ICONS[c.i],72,1.4)}</span>`}${avatar(it,88)}</div>
    <div class="pinfo">
      <span class="svc">${esc(it.sub||it.cat)}</span>
      <h3>${esc(it.name)}</h3>
      ${whereText(it)?`<p class="near">${PIN_ICON}${esc(whereText(it))}</p>`:''}
      <div class="rate">${r&&it.rating!=null?`${stars(it.rating)}<span>${it.rating.toFixed(1)} (${r})</span>`:'<span>No reviews yet</span>'}</div>
      <p class="pdesc">${esc(it.desc)}</p>
      ${it.from?`<div class="meta"><span>${esc(it.from)}</span></div>`:''}
      <div class="pc-ctas"><button class="btn pink" type="button" data-detail="${esc(it.id)}">View profile</button><button class="btn ghost" type="button" data-dm="${esc(it.id)}">Message</button></div>
    </div>
  </div>`;
}

/* ---------- the carousel ---------- */
function drawPromo(){
  const el=$('promo-c');
  stopTimer();
  if(!P.items.length){el.hidden=true;el.innerHTML='';return}
  if(P.slide>=P.items.length)P.slide=0;
  const n=P.items.length,many=n>1;
  el.hidden=false;
  el.innerHTML=`<div class="pc-top"><h2 class="pc-label">Sponsored</h2><a class="why" href="how-it-works.html#featured">What’s this?</a></div>
  <section class="pc" aria-roledescription="carousel" aria-label="Sponsored businesses">
    <div class="pc-view"><div class="pc-track" id="pc-track" aria-live="${P.stopped?'polite':'off'}">${P.items.map((it,i)=>slideHTML(it,i,n)).join('')}</div></div>
    ${many?`<div class="pc-nav">
      <button class="x" type="button" id="pc-prev" aria-label="Previous">&#8249;</button>
      <div class="pc-dots">${P.items.map((it,i)=>`<button type="button" data-slide="${i}" aria-label="Show ${esc(it.name)}" aria-current="${i===P.slide}"></button>`).join('')}</div>
      <button class="x" type="button" id="pc-next" aria-label="Next">&#8250;</button>
      <button class="pc-pause" type="button" id="pc-pause" aria-pressed="${P.stopped}">${P.stopped?'Play':'Pause'}</button>
    </div>`:''}
  </section>`;
  moveTo(P.slide,false);
  startTimer();
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
function startTimer(){stopTimer();if(P.items.length>1&&!P.stopped)P.timer=setInterval(()=>{if(!P.hover&&!document.hidden)moveTo(P.slide+1,true)},SLIDE_MS)}
function stopTimer(){clearInterval(P.timer);P.timer=null}

/* ---------- loading ---------- */
async function loadPromo(){
  if(!onHome)return;
  const seq=++P.seq;
  if(B.tab!=='services'){P.items=[];drawPromo();return}
  try{
    const r=await API.promoted({category:B.cat,sub:B.sub,lat:LOC&&LOC.lat,lng:LOC&&LOC.lng,limit:6,fill:true});
    if(seq!==P.seq)return;
    P.items=r.items;P.slide=0;
  }catch(_){if(seq!==P.seq)return;P.items=[]}
  drawPromo();
}

/* ---------- interaction ---------- */
if(onHome){
  const el=$('promo-c');
  el.addEventListener('click',e=>{
    const dm=e.target.closest('[data-dm]');if(dm){startDM(dm.dataset.dm,dm);return}
    const d=e.target.closest('[data-detail]');if(d){openDetail(d.dataset.detail,d);return}
    if(e.target.closest('#pc-prev')){moveTo(P.slide-1,true);startTimer();return}
    if(e.target.closest('#pc-next')){moveTo(P.slide+1,true);startTimer();return}
    const pz=e.target.closest('#pc-pause');
    if(pz){P.stopped=!P.stopped;pz.setAttribute('aria-pressed',P.stopped);pz.textContent=P.stopped?'Play':'Pause';$('pc-track').setAttribute('aria-live',P.stopped?'polite':'off');P.stopped?stopTimer():startTimer();return}
    const s=e.target.closest('[data-slide]');if(s){moveTo(+s.dataset.slide,true);startTimer()}
  });
  /* pause while someone is looking at it or using it */
  el.addEventListener('mouseenter',()=>P.hover=true);el.addEventListener('mouseleave',()=>P.hover=false);
  el.addEventListener('focusin',()=>P.hover=true);el.addEventListener('focusout',()=>P.hover=false);
  /* swipe on phones */
  let sx=null;
  el.addEventListener('touchstart',e=>{if(e.target.closest('.pc-view'))sx=e.touches[0].clientX},{passive:true});
  el.addEventListener('touchend',e=>{if(sx==null)return;const d=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(d)>50){moveTo(P.slide+(d<0?1:-1),true);startTimer()}});
}
