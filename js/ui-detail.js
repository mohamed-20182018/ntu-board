/* Business profile dialog (menu, highlights, reviews), photo viewer and full-screen highlights.
   Loads API.listing(id) and API.reviews(id). Review rules come from the server (reviews.viewer). */
const dov=document.createElement('div');
dov.className='overlay';dov.hidden=true;
dov.innerHTML=`<div class="sheet dsheet" role="dialog" aria-modal="true" aria-labelledby="dtitle"><div class="sheet-head"><h2 id="dtitle" tabindex="-1"></h2><button class="x" id="dclose" type="button" aria-label="Close">${X_ICON}</button></div><div id="dbody"></div></div>`;
document.body.appendChild(dov);
let dcur=null,dRev=null,dopen=null,revOpen=false,dseq=0;

function menuHTML(it){
  return (it.menu||[]).map(g=>`${g.group?`<h4>${esc(g.group)}</h4>`:''}${g.items.map(i=>`<div class="mrow"><span>${esc(i.name)}</span><i aria-hidden="true"></i><b>${esc(i.price)}</b></div>`).join('')}`).join('');
}
function reviewBox(it){
  const v=dRev.viewer;
  if(v.reason==='already_reviewed')return `<div class="rvlock" role="status"><b>Thanks, you've reviewed this business.</b> Each student can leave one review per business.</div>`;
  if(v.reason==='login')return `<div class="rvlock"><b>Log in to leave a review.</b> Reviews are for signed-in students who've had an appointment with this business.<br><button class="btn pink sm" type="button" data-auth="in" style="margin-top:10px">Log in or sign up</button></div>`;
  if(v.reason==='no_appointment')return `<div class="rvlock"><b>Reviews are for students who've had an appointment.</b> Once your appointment with ${esc(it.name)} is marked complete, you can leave one review.${API.isMock?'<br><button class="link" type="button" id="demo-done">Demo only: pretend I\'ve had an appointment</button>':''}</div>`;
  return `<form class="rvform" id="rvf" novalidate>
        <p class="hint" style="margin:0 0 8px">Posting as ${esc(USER?USER.name:'you')}</p>
        <div class="f"><label for="rv-s">Rating</label><select id="rv-s"><option value="">Choose</option>${[5,4,3,2,1].map(x=>`<option value="${x}">${x} out of 5</option>`).join('')}</select></div>
        <div class="f"><label for="rv-t">Your review</label><textarea id="rv-t" maxlength="300"></textarea></div>
        <p class="err" id="rv-e" role="alert" hidden></p>
        <button class="btn pink" type="submit">Post review</button>
      </form>`;
}


/* ---------- menu pop-up: pick items, see a total, send them to the business as a message ---------- */
const menuItems=it=>[].concat(...(it.menu||[]).map(g=>g.items.map(i=>({g:g.group,name:i.name,price:i.price}))));
const priceNum=p=>{const m=String(p).match(/\d+(\.\d+)?/);return m?parseFloat(m[0]):0};
const isRange=p=>(String(p).match(/\d+(\.\d+)?/g)||[]).length>1;
const mnu=document.createElement('div');
mnu.className='overlay';mnu.hidden=true;mnu.style.zIndex=80;
mnu.innerHTML='<div class="sheet msel" role="dialog" aria-modal="true" aria-labelledby="mn-title"><div class="sheet-head"><h2 id="mn-title" tabindex="-1">Menu</h2><button class="x" id="mn-x" type="button" aria-label="Close menu">'+X_ICON+'</button></div><p class="hint" style="margin:8px 0 0">Tap what you want. We will put it in a message to the business.</p><div id="mn-body"></div><div class="mn-foot"><div><small>Your selection</small><b id="mn-total">Nothing yet</b></div><button class="btn pink" type="button" id="mn-send" disabled>Message with my selection</button></div></div>';
document.body.appendChild(mnu);
let mnPick=new Set(),mnOpener=null;
function drawMenuPick(){
  const all=menuItems(dcur);let idx=0;
  $('mn-title').textContent=dcur.name+' menu';
  $('mn-body').innerHTML=(dcur.menu||[]).map(g=>`${g.group?`<h4>${esc(g.group)}</h4>`:''}${g.items.map(i=>{const k=idx++,on=mnPick.has(k);return `<button class="mpick" type="button" data-k="${k}" aria-pressed="${on}"><span class="mbox" aria-hidden="true">${on?'&#10003;':''}</span><span class="mn">${esc(i.name)}</span><b>${esc(i.price)}</b></button>`}).join('')}`).join('');
  const sel=[...mnPick].map(k=>all[k]).filter(Boolean);
  const sum=sel.reduce((a,i)=>a+priceNum(i.price),0),rng=sel.some(i=>isRange(i.price));
  $('mn-total').textContent=sel.length?`${sel.length} item${sel.length>1?'s':''} · ${rng?'from ':''}£${Number.isInteger(sum)?sum:sum.toFixed(2)}`:'Nothing yet';
  $('mn-send').disabled=!sel.length;
}
function openMenu(btn){mnPick=new Set();mnOpener=btn;mnu.hidden=false;drawMenuPick();$('mn-title').focus()}
function closeMenu(){mnu.hidden=true;if(mnOpener&&mnOpener.isConnected)mnOpener.focus()}
mnu.addEventListener('click',e=>{
  if(e.target===mnu||e.target.closest('#mn-x')){closeMenu();return}
  const p=e.target.closest('.mpick');
  if(p){const k=+p.dataset.k;mnPick.has(k)?mnPick.delete(k):mnPick.add(k);drawMenuPick();const n=$('mn-body').querySelector(`[data-k="${k}"]`);if(n)n.focus();return}
  if(e.target.closest('#mn-send')){
    const all=menuItems(dcur),sel=[...mnPick].map(k=>all[k]).filter(Boolean);
    const sum=sel.reduce((a,i)=>a+priceNum(i.price),0),rng=sel.some(i=>isRange(i.price));
    const text=`Hi! I'd like to book: ${sel.map(i=>`${i.name} (${i.price})`).join(', ')}. Total ${rng?'from ':''}£${Number.isInteger(sum)?sum:sum.toFixed(2)}. Are you free this week?`;
    const id=dcur.id;closeMenu();startDM(id,$('open-menu'),text);
  }
});
document.addEventListener('keydown',e=>{
  if(mnu.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeMenu();return}
  if(e.key!=='Tab')return;
  const f=[...mnu.querySelectorAll('button')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='mn-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);

/* Highlights (full screen pop-ups) are built from listing.sections, plus listing.policy */
const HLM={'Late fees':{i:'pound',c:'#FFD84D'},'Late policy':{i:'bell',c:'#FF6A9C'},'Hair policies':{i:'scissors',c:'#B9A8FF'}};
function hlList(it){
  const out=[];
  (it.sections||[]).forEach(x=>{
    const m=HLM[x.title]||{i:'star',c:'#6EE0BE'},n=(x.items||[]).length;
    const slides=x.type==='fees'
      ?[`<p class="st-k">${esc(x.title)}</p><h3 class="st-h">Running late?</h3>${x.rows.map(r=>`<div class="st-row"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join('')}`]
      :x.items.map((t,i)=>`<p class="st-k">${esc(x.title)} · ${i+1}/${n}</p><p class="st-t">${esc(t)}</p>`);
    out.push({t:x.title,i:m.i,c:m.c,slides});
  });
  if(it.policy)out.push({t:'Policy',i:'star',c:'#6EE0BE',slides:[`<p class="st-k">Policy</p><p class="st-t">${esc(it.policy)}</p>`]});
  return out;
}

function drawDetailLoading(){
  $('dtitle').textContent='Loading…';
  $('dbody').innerHTML='<div class="dsk" aria-hidden="true"><i class="sk"></i><i class="sk" style="width:60%"></i><i class="sk"></i><i class="sk" style="width:80%"></i><i class="sk" style="width:45%"></i></div>';
  $('dbody').setAttribute('aria-busy','true');
}
function drawDetailError(msg,id){
  $('dtitle').textContent='Could not open this listing';
  $('dbody').removeAttribute('aria-busy');
  $('dbody').innerHTML=`<div class="state err" role="alert"><p>${esc(msg)}</p><button class="btn dark sm" type="button" id="d-retry">Try again</button></div>`;
  $('d-retry').addEventListener('click',()=>loadDetail(id));
}
function drawDetail(){
  const it=dcur,s=dRev.summary,n=s.count,avg=s.avg||0;
  $('dbody').removeAttribute('aria-busy');
  $('dtitle').textContent=it.name;
  const hls=hlList(it);
  const cc=CAT[it.cat]||CAT.Other,own=USER&&it.ownerId===USER.id,items=menuItems(it);
  $('dbody').innerHTML=`<div class="dcover" style="background:${cc.c}">${it.banner?`<img src="${esc(it.banner)}" alt="" decoding="async">`:`<span class="pat">${svg(ICONS[cc.i],64,1.4)}</span>`}</div>
    <div class="dprof tw">${avatar(it,104)}<div class="dinfo"><span class="svc">${esc(it.sub||it.cat)}</span>
    <div class="stat-line">${n?`<span>${stars(avg,16)} <b>${avg.toFixed(1)}</b> from ${n} review${n>1?'s':''}</span>`:'<span>No reviews yet</span>'}${it.kind==='services'?replyLine(it.avgResponseSeconds):''}</div>
    ${own?'<p class="hint" style="margin:10px 0 0">This is your listing.</p>':`<button class="btn pink sm" type="button" data-dm="${esc(it.id)}" style="margin-top:10px">Message ${esc(it.name)}</button>`}</div></div>
    <p style="margin:12px 0 0">${esc(it.desc)}</p>
    <div class="meta" style="margin-top:10px">${(it.meta||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</div>
    ${(it.photos||[]).length?`<div class="dphotos">${it.photos.map((p,i)=>`<button type="button" data-p="${i}" aria-label="View photo ${i+1}"><img src="${esc(p)}" alt=""></button>`).join('')}</div>`:''}
    ${items.length?`<div class="dsec"><h3>Menu and prices</h3><button class="menubtn" type="button" id="open-menu" aria-haspopup="dialog"><span><b>Choose from the menu</b><small>${items.length} item${items.length>1?'s':''}${it.from?' · '+esc(it.from):''}</small></span><span class="go" aria-hidden="true">&rsaquo;</span></button></div>`:''}
    ${hls.length?`<div class="dsec"><h3>Highlights</h3><div class="hls" role="group" aria-label="Policies and fees. Opens full screen.">${hls.map((h,i)=>`<button class="hlb" type="button" data-hl="${i}" aria-haspopup="dialog"><span class="ring"><span class="in" style="background:${h.c}">${svg(ICONS[h.i],26,2)}</span></span><span>${esc(h.t)}</span></button>`).join('')}</div></div>`:''}
    <div class="dsec"><h3>Contact</h3><div class="contact" style="border:0;padding:0"><code>${esc(it.contact)}</code><button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button></div></div>
    <div class="dsec acc"><button class="acc-h" type="button" id="rev-t" aria-expanded="${revOpen}" aria-controls="rev-p"><span class="acc-n">Reviews</span><span class="acc-s">${n?`${stars(avg,14)} ${avg.toFixed(1)} (${n})`:'No reviews yet'}</span><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="acc-p" id="rev-p" ${revOpen?'':'hidden'}>
        ${n?`<div class="bars" aria-label="Rating breakdown">${[5,4,3,2,1].map(k=>{const c=s.counts[k]||0;return `<div class="rbar"><span>${k}</span><i><b style="width:${Math.round(c/n*100)}%"></b></i><em>${c}</em></div>`}).join('')}</div>`:''}
        ${n?dRev.items.map(r=>`<div class="rv">${stars(r.rating)}<p>${esc(r.text)}</p><small>${esc(r.author)} · ${esc(relTime(r.createdAt))}${r.example?' · Example':r.verified?' · Verified appointment':''}${r.mine?' · Your review':''}</small></div>`).join(''):'<p style="color:var(--muted);margin:10px 0 0">Be the first to leave a review.</p>'}
        ${reviewBox(it)}
      </div></div>`;
  const om=$('open-menu');if(om)om.addEventListener('click',()=>openMenu(om));
  const dd=$('demo-done');
  if(dd)dd.addEventListener('click',()=>requireLogin(async()=>{
    const done=busy(dd);
    try{await API.demoAppointment(dcur.id);dRev=await API.reviews(dcur.id);revOpen=true;drawDetail();$('rv-s').focus();$('rv-s').scrollIntoView({block:'center'})}
    catch(e){done();say(errMsg(e))}
  }));
  const rf=$('rvf');
  if(rf)rf.addEventListener('submit',async e=>{
    e.preventDefault();
    const sc=+$('rv-s').value,t=$('rv-t').value.trim(),er=$('rv-e');
    const miss=[!sc&&'a rating',!t&&'a few words'].filter(Boolean);
    if(miss.length){er.textContent='Add '+miss.join(', ')+' to post.';er.hidden=false;return}
    const done=busy(rf.querySelector('button[type=submit]'),'Posting…');
    try{
      await API.postReview(dcur.id,{rating:sc,text:t});
      dRev=await API.reviews(dcur.id);revOpen=true;
      patchListing(dcur.id,{rating:dRev.summary.avg,reviewCount:dRev.summary.count});
      drawDetail();$('rev-t').focus();say('Review posted');
    }catch(err){
      done();er.textContent=errMsg(err);er.hidden=false;
      if(err.status===403||err.status===409){try{dRev=await API.reviews(dcur.id);drawDetail()}catch(_){}}
    }
  });
}
async function loadDetail(id){
  const seq=++dseq;drawDetailLoading();
  try{
    const [it,rev]=await Promise.all([API.listing(id),API.reviews(id)]);
    if(seq!==dseq)return;
    dcur=it;dRev=rev;drawDetail();
  }catch(e){if(seq===dseq)drawDetailError(errMsg(e),id)}
}
function openDetail(id,openReviews){
  dopen=id;dcur=null;dRev=null;revOpen=!!openReviews;
  dov.hidden=false;document.body.style.overflow='hidden';
  dov.querySelector('.sheet').scrollTop=0;loadDetail(id);$('dtitle').focus();
}
/* Re-fetch the open profile (for example after logging in, so review eligibility updates). */
function refreshDetail(){if(!dov.hidden&&dopen){dseq++;loadDetail(dopen)}}
function closeDetail(){
  dseq++;dov.hidden=true;document.body.style.overflow='';
  const b=document.querySelector(`[data-detail="${CSS.escape(dopen||'')}"]`);if(b)b.focus();
}
$('dclose').addEventListener('click',closeDetail);
dov.addEventListener('click',e=>{
  if(e.target===dov)closeDetail();
  const rt=e.target.closest('#rev-t');
  if(rt){revOpen=!revOpen;rt.setAttribute('aria-expanded',revOpen);$('rev-p').hidden=!revOpen;if(revOpen)$('rev-p').scrollIntoView({block:'nearest',behavior:'smooth'});return}
  const au=e.target.closest('[data-auth]');if(au){openAuth('up',refreshDetail,au);return}
  const dm=e.target.closest('[data-dm]');if(dm){startDM(dm.dataset.dm,dm);return}
  const c=e.target.closest('[data-copy]');
  if(c){const v=c.dataset.copy;try{navigator.clipboard.writeText(v).then(()=>say('Copied '+v),()=>say('Select and copy it'))}catch(_){say('Select and copy it')}}
  const pb=e.target.closest('[data-p]');if(pb&&dcur)lbOpen(dcur.photos,pb);
  const h=e.target.closest('[data-hl]');if(h&&dcur)openStory(+h.dataset.hl,h);
});
document.addEventListener('keydown',e=>{
  if(dov.hidden||!lb.hidden||!sv.hidden||!mov.hidden||!aov.hidden||!mnu.hidden)return;
  if(e.key==='Escape'){closeDetail();return}
  if(e.key!=='Tab')return;
  const f=[...dov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement===$('dtitle'))){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});

/* ---------- photo viewer ---------- */
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
  $('st-body').innerHTML=`<div class="st-slide">${h.slides[stS]}</div>`;
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
