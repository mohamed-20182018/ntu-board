/* Home page: "Recommended for you". Uses API.recommended with the student's location (if they share it)
   or an area they pick, and ranks by rating, number of reviews and distance (server side). */
const recoGrid=document.getElementById('reco-grid');
const R={items:[],lat:null,lng:null,area:'',seq:0};
const miles=km=>{const m=km*0.621;return m<0.2?'Right by you':m<10?m.toFixed(1)+' mi away':Math.round(m)+' mi away'};

function drawReco(status,err){
  const sub=$('reco-sub');
  if(status==='loading'){recoGrid.innerHTML=skeletons(3);$('reco-status').textContent='Loading recommendations';return}
  if(status==='error'){recoGrid.innerHTML=`<div class="state err" role="alert"><p>${esc(err)}</p><button class="btn dark sm" type="button" id="reco-retry">Try again</button></div>`;return}
  sub.textContent=R.basis==='location'?'Highly rated businesses closest to you.':R.basis==='area'?`Highly rated businesses near ${R.area}.`:'Top rated, with the most reviews. Share your location or pick an area to see what’s close.';
  recoGrid.innerHTML=R.items.length?R.items.map(it=>cardHTML(Object.assign({},it,{near:it.area==='Online'?'Online':it.distanceKm!=null?miles(it.distanceKm):''}))).join(''):'<div class="state"><p>No businesses to recommend yet.</p></div>';
  $('reco-status').textContent=R.items.length+' recommendations';
}
async function loadReco(){
  if(!recoGrid)return;
  const seq=++R.seq;drawReco('loading');
  try{
    const r=await API.recommended({lat:R.lat,lng:R.lng,area:R.lat==null?R.area:'',limit:6});
    if(seq!==R.seq)return;R.items=r.items;R.basis=r.basis;drawReco('ok');
  }catch(e){if(seq===R.seq)drawReco('error',errMsg(e))}
}
if(recoGrid){
  try{R.area=localStorage.getItem('board.area')||''}catch(_){}
  $('reco-area').innerHTML='<option value="">Anywhere</option>'+AREAS.filter(a=>a!=='Online').map(a=>`<option ${a===R.area?'selected':''}>${a}</option>`).join('');
  $('reco-area').addEventListener('change',e=>{
    R.area=e.target.value;R.lat=R.lng=null;$('reco-loc').textContent='Use my location';
    try{localStorage.setItem('board.area',R.area)}catch(_){}
    loadReco();
  });
  $('reco-loc').addEventListener('click',e=>{
    const btn=e.currentTarget;
    if(!navigator.geolocation){say('Your browser can’t share location. Pick an area instead.');return}
    const done=busy(btn,'Finding you…');
    navigator.geolocation.getCurrentPosition(p=>{
      done();
      /* rounded to about 1 km, which is all the ranking needs */
      R.lat=Math.round(p.coords.latitude*100)/100;R.lng=Math.round(p.coords.longitude*100)/100;
      R.area='';$('reco-area').value='';btn.textContent='Using your location';loadReco();
    },()=>{done();say('Couldn’t get your location. Pick an area instead.');$('reco-area').focus()},{maximumAge:600000,timeout:10000});
  });
  recoGrid.addEventListener('click',e=>{
    if(e.target.closest('#reco-retry')){loadReco();return}
    const c=e.target.closest('[data-copy]');
    if(c){const v=c.dataset.copy;try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),()=>say('Select and copy it'))}catch(_){say('Select and copy it')}return}
    const d=e.target.closest('[data-detail]');if(d){openDetail(d.dataset.detail,d);return}
    const s=e.target.closest('.shot');if(s){const it=R.items.find(x=>x.id===s.dataset.lb);if(it&&it.photos)lbOpen(it.photos,s)}
  });
}
