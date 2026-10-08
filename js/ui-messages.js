/* Messages between students and business owners.
   Reads API.threads / API.thread / API.newMessages / API.unread, writes API.sendMessage / openThread / markRead / completeAppointment / report.
   New messages arrive by polling every API.pollMs. To use WebSocket or SSE instead, replace pollTick() only. */
/* Messages has its own page (messages.html). On other pages the Messages link just navigates there. */
const mpage=$('msheet');
const mov={hidden:true};   /* kept so other screens' "is messages open?" checks still work */

/* mode 's' = I am the student (client). mode 'b' = I run the business. */
const M={draft:'',cl:false,mode:'s',th:[],cur:null,curT:null,msgs:[],owns:[],own:null,loading:false,err:'',sig:'',unread:0,seq:0,opener:null,tmp:0};
const asOf=()=>M.mode==='s'?'client':'business';
const meFrom=()=>M.mode==='s'?'client':'business';

function refreshBadgeCount(n){
  M.unread=USER?n:0;
  const b=$('msg-badge');b.hidden=!M.unread;b.textContent=M.unread;
  $('open-msg').setAttribute('aria-label','Messages'+(M.unread?`, ${M.unread} unread`:''));
}
async function refreshBadge(){
  if(!USER){refreshBadgeCount(0);return}
  try{refreshBadgeCount(await API.unread())}catch(_){}
}
function closeMsgIfOpen(){M.owns=[];M.own=null;M.th=[];M.cur=null;M.curT=null;M.msgs=[];refreshBadgeCount(0);if(mpage)drawSignedOut()}

const sigOf=()=>JSON.stringify([M.mode,M.cur,M.loading,M.cl,M.err,M.th.map(t=>[t.id,t.unread,t.lastMessage&&t.lastMessage.id]),M.msgs.map(m=>m.id+(m.sending?'~':'')),M.curT&&M.curT.appointmentCompleted]);
const other=t=>M.mode==='s'?{name:t.listingName,cat:t.listingCat,avatar:t.listingAvatar}:{name:t.clientName,cat:'Other'};

function drawMsg(force){
  const sig=sigOf();if(!force&&sig===M.sig)return;M.sig=sig;
  const sh=$('msheet'),keep=$('m-in')?$('m-in').value:'',hadFocus=document.activeElement&&document.activeElement.id==='m-in';
  const cur=M.curT;
  sh.classList.toggle('chatting',!!M.cur);
  const me=meFrom();
  let threads;
  if(M.loading&&!M.th.length)threads='<div class="mths" aria-hidden="true"><div class="sk" style="height:56px;margin:8px 0"></div><div class="sk" style="height:56px;margin:8px 0"></div></div>';
  else if(M.err&&!M.th.length)threads=`<div class="mths"><p class="mempty" role="alert">${esc(M.err)}</p><button class="btn dark sm" type="button" id="m-retry">Try again</button></div>`;
  else threads=`<div class="mths">${M.th.length?M.th.map(t=>{const o=other(t),l=t.lastMessage;return `<button class="mth" type="button" data-th="${esc(t.id)}" aria-current="${t.id===M.cur}"><span>${avatar({name:o.name,cat:o.cat,avatar:o.avatar},40)}</span><span class="mt"><b>${esc(o.name)}</b><small>${l?esc((l.from===me?'You: ':'')+l.text):'No messages yet'}</small></span>${t.unread?`<i class="udot" aria-label="${t.unread} unread"></i>`:''}</button>`}).join(''):(M.mode==='b'&&!M.owns.length?'<p class="mempty">You don’t have a listing yet. List your business and customer messages will appear here.</p>':'<p class="mempty">No conversations yet. Open a business and press Message.</p>')}</div>`;
  const listHTML=`<div class="mlist"><div class="mhead"><h1 id="m-title" tabindex="-1">Messages</h1></div>
    ${USER&&USER.type==='business'?`<div class="mtog" role="group" aria-label="Inbox"><button type="button" data-mode="b" aria-pressed="${M.mode==='b'}">Customers</button><button type="button" data-mode="s" aria-pressed="${M.mode==='s'}">My enquiries</button></div>`:''}
    ${M.mode==='b'&&M.owns.length>1?`<div class="f" style="margin:10px 0 0"><label for="m-own">Listing</label><select id="m-own">${M.owns.map(x=>`<option value="${esc(x.id)}" ${x.id===M.own?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`:''}
    ${threads}</div>`;
  let chat;
  if(!cur)chat='<div class="mchat"><div class="mnone">Pick a conversation, or open a business and press Message to start one.</div></div>';
  else{
    const o=other(cur);
    const sub=M.mode==='s'
      ?`<small>${esc(cur.listingSub||cur.listingCat)}</small><span class="mstats">${cur.listingReviewCount&&cur.listingRating!=null?`${stars(cur.listingRating,12)}<span>${cur.listingRating.toFixed(1)} (${cur.listingReviewCount})</span>`:'<span>No reviews yet</span>'}${replyLine(cur.avgResponseSeconds)}</span>`
      :`<small>Customer${cur.appointmentCompleted?' · appointment complete':''}</small>`;
    chat=`<div class="mchat"><div class="mchead rich"><button class="x mback" id="m-back" type="button" aria-label="Back to conversations">&#8249;</button>${avatar({name:o.name,cat:o.cat,avatar:o.avatar},M.mode==='s'?52:40)}<div class="mwho"><b>${esc(o.name)}</b>${sub}</div>
      ${M.mode==='s'?`<button class="btn sm ghost" type="button" id="m-prof">Profile</button>`:`<button class="btn sm" type="button" id="m-done" ${cur.appointmentCompleted?'disabled':''}>${cur.appointmentCompleted?'Appointment complete':'Mark appointment complete'}</button>`}
      <button class="link" type="button" id="m-rep">Report</button></div>
      <div class="mmsgs" id="m-log" role="log" aria-live="polite" aria-label="Conversation with ${esc(o.name)}">${M.cl?'<div class="sk" style="height:40px;width:60%;margin:8px 0" aria-hidden="true"></div><div class="sk" style="height:40px;width:45%;margin:8px 0 8px auto" aria-hidden="true"></div>':M.msgs.length?M.msgs.map(m=>m.from==='system'?`<div class="msys">${esc(m.text)}</div>`:`<div class="mb ${m.from===me?'me':'them'}${m.sending?' sending':''}"><span>${esc(m.text)}</span><small>${m.sending?'Sending…':esc(msgTime(m.createdAt))}${m.auto?' · Demo reply':''}</small></div>`).join(''):'<div class="msys">Say hello. Ask about prices, availability or booking.</div>'}</div>
      ${M.mode==='s'?`<div class="mq">${['Are you free this week?','What is your price for this?','Can I reschedule?'].map(x=>`<button type="button" class="chipbtn" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>`:''}
      <form class="mform" id="m-form"><label class="sr" for="m-in">Message</label><input type="text" id="m-in" maxlength="500" autocomplete="off" placeholder="Write a message"><button class="btn pink" type="submit">Send</button></form>
      <p class="hint mnote">Keep chats on the Board. Never share card or bank details.${API.isMock?' Demo: messages stay in this browser.':''}</p></div>`;
  }
  const atBottom=(()=>{const l=$('m-log');return !l||l.scrollHeight-l.scrollTop-l.clientHeight<60})();
  const prevTop=$('m-log')?$('m-log').scrollTop:0;
  sh.innerHTML=`<div class="mgrid">${listHTML}${chat}</div>`;
  const mi=$('m-in');if(mi){mi.value=keep||M.draft;M.draft='';if(hadFocus)mi.focus()}
  const lg=$('m-log');if(lg)lg.scrollTop=atBottom?lg.scrollHeight:prevTop;
  const rt=$('m-retry');if(rt)rt.addEventListener('click',()=>loadThreads());
}

/* ---------- data ---------- */
async function loadOwns(){
  if(M.owns.length)return;
  try{M.owns=await API.myListings()}catch(_){M.owns=[]}
  if(!M.own||!M.owns.some(x=>x.id===M.own))M.own=M.owns[0]?M.owns[0].id:null;
}
async function loadThreads(){
  const seq=++M.seq;M.loading=true;M.err='';if(!M.cur)M.cl=false;drawMsg();
  try{
    if(M.mode==='b'){await loadOwns();if(seq!==M.seq)return}
    const list=M.mode==='s'?await API.threads('client'):(M.own?await API.threads('business',M.own):[]);
    if(seq!==M.seq)return;
    M.th=list;
    if(M.cur&&!list.some(t=>t.id===M.cur)){M.cur=null;M.curT=null;M.msgs=[]}
  }catch(e){if(seq!==M.seq)return;M.err=errMsg(e)}
  M.loading=false;drawMsg();
}
async function loadChat(id){
  const seq=++M.seq;M.cur=id;M.curT=M.th.find(t=>t.id===id)||M.curT;M.msgs=[];M.cl=true;drawMsg();
  try{
    const r=await API.thread(id,asOf());
    if(seq!==M.seq||M.cur!==id)return;
    M.curT=r.thread;M.msgs=r.messages;
    if(r.thread.unread){API.markRead(id,asOf()).catch(()=>{});const t=M.th.find(x=>x.id===id);if(t)t.unread=0;M.curT.unread=0;refreshBadge()}
  }catch(e){if(seq===M.seq){say(errMsg(e));M.cur=null;M.curT=null}}
  if(seq===M.seq)M.cl=false;
  drawMsg();
  const mi=$('m-in');if(mi)mi.focus();
}
/* Called every API.pollMs. Cheap when nothing changed. */
async function pollTick(){
  if(!USER||document.hidden)return;
  if(!mpage){refreshBadge();return}
  try{
    const mode=M.mode,own=M.own,cur=M.cur;
    const list=mode==='s'?await API.threads('client'):(own?await API.threads('business',own):[]);
    if(mode!==M.mode||own!==M.own)return;
    M.th=list;
    if(cur&&M.cur===cur){
      const lastReal=[...M.msgs].reverse().find(m=>!m.sending);
      const fresh=await API.newMessages(cur,lastReal?lastReal.id:null,asOf());
      if(M.cur===cur){
        const have=new Set(M.msgs.map(m=>m.id)),add=fresh.filter(m=>!have.has(m.id));
        if(add.length){M.msgs=M.msgs.concat(add);const t=M.th.find(x=>x.id===cur);if(t&&t.unread){API.markRead(cur,asOf()).catch(()=>{});t.unread=0}}
        const t=M.th.find(x=>x.id===cur);if(t)M.curT=Object.assign({},t,{unread:0});
      }
    }
    drawMsg();refreshBadge();
  }catch(_){}
}

/* ---------- page start-up and navigation ---------- */
const msgUrl=(t,as,l)=>'messages.html'+(t?'?'+new URLSearchParams(Object.assign({t},as?{as}:{},l?{l}:{})).toString():'');
function drawSignedOut(){
  mpage.classList.remove('chatting');
  mpage.innerHTML=`<div class="mempty-page"><h1>Messages</h1><p>Log in to see your conversations with businesses, or your customer messages if you run one.</p><button class="btn pink" type="button" data-auth-page>Log in or sign up</button></div>`;
}
/* Called by main.js once the session is known. Reads ?t=thread&as=b|s&l=listing from the address. */
function initMessagesPage(){
  if(!mpage)return;
  if(!USER){drawSignedOut();if(location.search)history.replaceState(null,'','messages.html');return}
  const p=new URLSearchParams(location.search);
  M.mode=p.get('as')==='b'||(!p.get('t')&&USER.type==='business')?'b':'s';
  if(M.mode==='b'&&USER.type!=='business')M.mode='s';
  M.cur=p.get('t')||null;M.curT=null;M.msgs=[];M.th=[];M.sig='';
  if(p.get('l'))M.own=p.get('l');
  try{M.draft=sessionStorage.getItem('board.draft')||'';sessionStorage.removeItem('board.draft')}catch(_){}
  drawMsg(true);
  loadThreads().then(()=>{if(M.cur)loadChat(M.cur)});
}
async function startDM(listingId,btn,prefill){
  requireLogin(async()=>{
    const done=busy(btn&&btn.matches('.btn')?btn:null);
    try{
      const t=await API.openThread(listingId);
      if(!mpage){
        try{if(prefill)sessionStorage.setItem('board.draft',prefill)}catch(_){}
        location.href=msgUrl(t.id,'s');return;
      }
      done();M.mode='s';M.draft=prefill||'';M.cur=t.id;M.curT=t;M.msgs=[];
      if(!dov.hidden)closeDetail();
      loadThreads().then(()=>loadChat(t.id));
    }catch(e){done();say(errMsg(e))}
  },btn);
}
/* Used by the dashboards. mode: 's' my enquiry, 'b' a customer chat on my listing. */
function openThreadById(id,mode,listingId){
  if(!mpage){location.href=msgUrl(id,mode,listingId);return}
  M.mode=mode;M.cur=id;M.curT=null;M.msgs=[];M.th=[];if(mode==='b'&&listingId)M.own=listingId;
  loadThreads().then(()=>loadChat(id));
}
$('open-msg').addEventListener('click',e=>{if(!USER){e.preventDefault();openAuth('in',()=>{location.href='messages.html'},e.currentTarget)}});

/* ---------- send (optimistic: shows at once, rolls back if the server refuses) ---------- */
async function mSend(text){
  text=text.trim();if(!text||!M.cur)return;M.draft='';
  const id=M.cur,as=asOf(),tmp={id:'tmp'+(++M.tmp),from:meFrom(),text,createdAt:new Date().toISOString(),sending:true};
  M.msgs.push(tmp);drawMsg();
  try{
    const real=await API.sendMessage(id,text,as);
    if(M.cur!==id)return;
    const i=M.msgs.findIndex(m=>m.id===tmp.id);
    if(M.msgs.some(m=>m.id===real.id)){if(i>=0)M.msgs.splice(i,1)}else if(i>=0)M.msgs[i]=real;
    const t=M.th.find(x=>x.id===id);if(t)t.lastMessage={id:real.id,from:real.from,text:real.text,createdAt:real.createdAt};
  }catch(e){
    M.msgs=M.msgs.filter(m=>m.id!==tmp.id);
    if($('m-in'))$('m-in').value=text;
    say(errMsg(e));
  }
  drawMsg();
}

if(mpage)mpage.addEventListener('click',async e=>{
  const t=e.target;
  if(t.closest('[data-auth-page]')){openAuth('in',initMessagesPage,t);return}
  const th=t.closest('[data-th]');if(th){loadChat(th.dataset.th);return}
  const md=t.closest('[data-mode]');if(md){if(md.dataset.mode===M.mode)return;M.mode=md.dataset.mode;M.cur=null;M.curT=null;M.msgs=[];M.th=[];M.sig='';loadThreads();return}
  if(t.closest('#m-back')){M.cur=null;M.curT=null;drawMsg();return}
  const q=t.closest('[data-q]');if(q){$('m-in').value=q.dataset.q;$('m-in').focus();return}
  if(t.closest('#m-rep')){
    try{await API.report(M.cur,'',asOf());say('Reported. The Board team will take a look.')}catch(err){say(errMsg(err))}
    return;
  }
  if(t.closest('#m-prof')){openDetail(M.curT.listingId);return}
  const dn=t.closest('#m-done');
  if(dn){
    const id=M.cur,done=busy(dn,'Saving…');
    try{
      const nt=await API.completeAppointment(id,asOf());
      if(M.cur===id){M.curT=nt;const x=M.th.find(y=>y.id===id);if(x)x.appointmentCompleted=true;const r=await API.thread(id,asOf());M.msgs=r.messages}
      say('Appointment marked complete');
    }catch(err){say(errMsg(err))}
    drawMsg(true);return;
  }
});
if(mpage)mpage.addEventListener('change',e=>{if(e.target.id==='m-own'){M.own=e.target.value;M.cur=null;M.curT=null;M.msgs=[];M.th=[];loadThreads().then(()=>{const s=$('m-own');if(s)s.focus()})}});
if(mpage)mpage.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='m-form'){const v=$('m-in').value;$('m-in').value='';mSend(v);$('m-in').focus()}});
setInterval(pollTick,API.pollMs);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollTick()});

