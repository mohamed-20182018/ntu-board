/* Home page: "Recommended for you", ranked by the server using rating, number of reviews and distance.
   Location comes from the browser only when the student presses "Use my location" (or picks "Nearest"). */
const recoGrid=document.getElementById('reco-grid');
const R={items:[],seq:0};

/* Ask the browser for the student's location, then run ok(). Shared by "Use my location" and the "Nearest" sort. */
function askLocation(ok,fail,btn){
  if(!navigator.geolocation){say('Your browser can’t share location.');if(fail)fail();return}
  const done=busy(btn||null,'Finding you…');
  navigator.geolocation.getCurrentPosition(p=>{
    done();setLoc({lat:Math.round(p.coords.latitude*100)/100,lng:Math.round(p.coords.longitude*100)/100});
    drawLocBtn();loadReco();if(ok)ok();else loadListings();
  },()=>{done();say('Couldn’t get your location. Check your browser’s location setting.');if(fail)fail()},{maximumAge:600000,timeout:10000});
}
function drawLocBtn(){
  const b=$('reco-loc');if(!b)return;
  b.textContent=LOC?'Using your location':'Use my location';
  b.setAttribute('aria-pressed',!!LOC);
  $('reco-off').hidden=!LOC;
}
function drawReco(status,err){
  if(status==='loading'){recoGrid.innerHTML=skeletons(3);$('reco-status').textContent='Loading recommendations';return}
  if(status==='error'){recoGrid.innerHTML=`<div class="state err" role="alert"><p>${esc(err)}</p><button class="btn dark sm" type="button" id="reco-retry">Try again</button></div>`;return}
  $('reco-sub').textContent=R.basis==='location'?'Highly rated businesses closest to you.':'Top rated, with the most reviews. Use your location to see what’s close.';
  recoGrid.innerHTML=R.items.length?R.items.map(cardHTML).join(''):'<div class="state"><p>No businesses to recommend yet.</p></div>';
  $('reco-status').textContent=R.items.length+' recommendations';
}
async function loadReco(){
  if(!recoGrid)return;
  const seq=++R.seq;drawReco('loading');
  try{
    const r=await API.recommended({lat:LOC&&LOC.lat,lng:LOC&&LOC.lng,limit:6});
    if(seq!==R.seq)return;R.items=r.items;R.basis=r.basis;drawReco('ok');
  }catch(e){if(seq===R.seq)drawReco('error',errMsg(e))}
}
if(recoGrid){
  drawLocBtn();
  $('reco-loc').addEventListener('click',e=>{if(!LOC)askLocation(null,null,e.currentTarget)});
  $('reco-off').addEventListener('click',()=>{setLoc(null);if(B.sort==='near')B.sort='';drawLocBtn();loadReco();loadListings();$('reco-loc').focus()});
  recoGrid.addEventListener('click',e=>{
    if(e.target.closest('#reco-retry')){loadReco();return}
    const c=e.target.closest('[data-copy]');
    if(c){const v=c.dataset.copy;try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),()=>say('Select and copy it'))}catch(_){say('Select and copy it')}return}
    const s=e.target.closest('.shot');if(s){const it=R.items.find(x=>x.id===s.dataset.lb);if(it&&it.photos)lbOpen(it.photos,s);return}
    const d=e.target.closest('[data-detail]');if(d)openDetail(d.dataset.detail,d);
  });
}
