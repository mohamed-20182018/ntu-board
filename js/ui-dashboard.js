/* Dashboards. Students and business accounts get different screens from the same call: API.dashboard().
   The server decides the role from the account, so a student can never load the business view. */
const dsh=document.createElement('div');
dsh.className='overlay';dsh.hidden=true;dsh.style.zIndex=55;
dsh.innerHTML=`<div class="sheet dashsheet" role="dialog" aria-modal="true" aria-labelledby="dash-title"><div class="sheet-head"><h2 id="dash-title" tabindex="-1">Dashboard</h2><button class="x" id="dash-x" type="button" aria-label="Close dashboard">${X_ICON}</button></div><div id="dash-body"></div></div>`;
document.body.appendChild(dsh);
let dashOpener=null,dashSeq=0;

const stat=(v,l)=>`<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
const lastText=t=>t.lastMessage?esc((t.lastMessage.from==='system'?'':t.lastMessage.text)):'No messages yet';

function studentHTML(d){
  const s=d.stats;
  return `<span class="dash-role">Student account</span><p class="dash-hello">Hi, ${esc(USER.name.split(' ')[0])}</p>
  <div class="tiles-dash">${stat(s.conversations,'Conversations')}${stat(s.unread,'Unread messages')}${stat(s.appointments,'Appointments done')}${stat(s.reviews,'Reviews left')}</div>
  ${d.toReview.length?`<div class="dsec2"><h3>Waiting for your review</h3>${d.toReview.map(r=>`<div class="drow">${avatar(r,40)}<div class="grow"><b>${esc(r.name)}</b><small>Appointment complete. Tell others how it went.</small></div><button class="btn pink sm" type="button" data-review="${esc(r.listingId)}">Leave a review</button></div>`).join('')}</div>`:''}
  <div class="dsec2"><h3>Your conversations</h3>${d.threads.length?d.threads.map(t=>`<div class="drow">${avatar({name:t.listingName,cat:t.listingCat,avatar:t.listingAvatar},40)}<div class="grow"><b>${esc(t.listingName)}</b><small>${lastText(t)}</small></div>${t.unread?`<span class="chip live">${t.unread} new</span>`:''}<button class="btn ghost sm" type="button" data-th="${esc(t.id)}">Open</button></div>`).join(''):'<p class="hint">No conversations yet. Open a business and press Message.</p>'}</div>
  ${d.reviews.length?`<div class="dsec2"><h3>Your reviews</h3>${d.reviews.map(r=>`<div class="rv">${stars(r.rating)}<p>${esc(r.text)}</p><small>${esc(r.listingName)} · ${esc(relTime(r.createdAt))}</small></div>`).join('')}</div>`:''}
  <div class="upgrade"><p><b>Run a business?</b> Switch to a business account to list it, get a business dashboard and receive customer messages.</p><button class="btn dark sm" type="button" id="dash-upgrade">Switch to a business account</button></div>`;
}
function businessHTML(d){
  const s=d.stats;
  return `<span class="dash-role biz">Business account</span><p class="dash-hello">${esc(USER.name)}</p>
  <div class="tiles-dash">${stat(s.rating==null?'–':s.rating.toFixed(1),'Average rating')}${stat(s.reviewCount,'Reviews')}${stat(s.avgResponseSeconds==null?'–':fmtReply(s.avgResponseSeconds),'Average reply time')}${stat(s.unread,'Unread messages')}${stat(s.openChats,'Customer chats')}${stat(s.appointments,'Appointments done')}</div>
  <div class="dsec2"><h3>Needs a reply</h3>${d.needsReply.length?d.needsReply.map(t=>`<div class="drow">${avatar({name:t.clientName,cat:'Other'},40)}<div class="grow"><b>${esc(t.clientName)}</b><small>${esc(t.listingName)} · ${lastText(t)}</small></div>${t.unread?`<span class="chip live">${t.unread} new</span>`:''}<button class="btn pink sm" type="button" data-bth="${esc(t.id)}" data-lid="${esc(t.listingId)}">Reply</button></div>`).join(''):'<p class="hint">You’re all caught up.</p>'}</div>
  <div class="dsec2"><h3>Your listings</h3>${d.listings.length?d.listings.map(l=>`<div class="drow">${avatar(l,44)}<div class="grow"><b>${esc(l.name)}</b><small>${l.reviewCount?`${l.rating.toFixed(1)} stars from ${l.reviewCount} review${l.reviewCount>1?'s':''}`:'No reviews yet'}${l.kind==='services'?' · '+(l.avgResponseSeconds==null?'no replies yet':'replies in about '+fmtReply(l.avgResponseSeconds)):''}</small></div><span class="chip ${l.status==='live'?'live':'pending'}">${esc(l.status)}</span>${l.kind==='services'?`<button class="btn ghost sm" type="button" data-view="${esc(l.id)}">View profile</button>`:''}</div>`).join(''):'<p class="hint">You haven’t listed anything yet.</p>'}<button class="btn dark sm" type="button" id="dash-add">${d.listings.length?'Add another listing':'List your business'}</button></div>
  ${d.reviews.length?`<div class="dsec2"><h3>Recent reviews</h3>${d.reviews.map(r=>`<div class="rv">${stars(r.rating)}<p>${esc(r.text)}</p><small>${esc(r.author)} on ${esc(r.listingName)} · ${esc(relTime(r.createdAt))}</small></div>`).join('')}</div>`:''}`;
}

async function loadDash(){
  const seq=++dashSeq,body=$('dash-body');
  body.innerHTML='<div class="dsk" aria-hidden="true"><i class="sk" style="height:30px;width:50%;border-radius:10px"></i><i class="sk"></i><i class="sk"></i><i class="sk" style="width:70%"></i></div>';
  body.setAttribute('aria-busy','true');
  try{
    const d=await API.dashboard();if(seq!==dashSeq)return;
    body.removeAttribute('aria-busy');
    body.innerHTML=d.role==='business'?businessHTML(d):studentHTML(d);
  }catch(e){
    if(seq!==dashSeq)return;body.removeAttribute('aria-busy');
    body.innerHTML=`<div class="state err" role="alert"><p>${esc(errMsg(e))}</p><button class="btn dark sm" type="button" id="dash-retry">Try again</button></div>`;
  }
}
function openDash(btn){
  dashOpener=btn||document.activeElement;dsh.hidden=false;document.body.style.overflow='hidden';
  $('dash-title').textContent=USER&&USER.type==='business'?'Business dashboard':'Your dashboard';
  loadDash();$('dash-title').focus();
}
function closeDash(){dashSeq++;dsh.hidden=true;if(dov.hidden&&mov.hidden&&ov.hidden)document.body.style.overflow='';if(dashOpener&&dashOpener.isConnected)dashOpener.focus()}
$('open-dash').addEventListener('click',e=>requireLogin(()=>openDash($('open-dash')),e.currentTarget));
dsh.addEventListener('click',async e=>{
  if(e.target===dsh||e.target.closest('#dash-x')){closeDash();return}
  const t=e.target;
  if(t.closest('#dash-retry')){loadDash();return}
  const th=t.closest('[data-th]');if(th){const id=th.dataset.th;closeDash();openThreadById(id,'s',null,th);return}
  const bt=t.closest('[data-bth]');if(bt){const id=bt.dataset.bth,l=bt.dataset.lid;closeDash();openThreadById(id,'b',l,bt);return}
  const rv=t.closest('[data-review]');if(rv){const id=rv.dataset.review;closeDash();openDetail(id,true);return}
  const vw=t.closest('[data-view]');if(vw){const id=vw.dataset.view;closeDash();openDetail(id);return}
  if(t.closest('#dash-add')){closeDash();openSheet({currentTarget:$('open-dash')});return}
  const up=t.closest('#dash-upgrade');
  if(up){const done=busy(up,'Switching…');try{setUser(await API.upgrade());say('You now have a business account');$('dash-title').textContent='Business dashboard';loadDash()}catch(err){done();say(errMsg(err))}}
});
document.addEventListener('keydown',e=>{
  if(dsh.hidden||!aov.hidden||!mov.hidden||!dov.hidden||!ov.hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();closeDash();return}
  if(e.key!=='Tab')return;
  const f=[...dsh.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===a||document.activeElement.id==='dash-title')){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
},true);
