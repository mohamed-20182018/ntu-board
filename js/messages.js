/* the Board: messages between students and the businesses or societies they contact.
   Only the two people in a chat can read it (enforced by the database, see supabase/messages-and-societies.sql). */
"use strict";
const mbox=$('mbox'),mlist=$('mlist'),mthread=$('mthread');
const qp=new URLSearchParams(location.search);
let CONVS=[],UNREAD={},OPEN=null,MSGS=[],inbox=null,chat=null,poll=null,typingTimer=null,lastTypingSent=0,otherHere=false,started=false;
const TICK1='<svg class="tk" width="16" height="16" viewBox="0 0 24 24" aria-label="Sent" role="img"><circle cx="12" cy="12" r="11" fill="var(--pink)"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="#17131F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK2='<svg class="tk" width="16" height="16" viewBox="0 0 24 24" aria-label="Read" role="img"><circle cx="12" cy="12" r="11" fill="var(--pink)"/><path d="M4.5 12.5l3 3 6.5-6.5M10.5 15.5l1 1 7-7" fill="none" stroke="#17131F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOCK='<svg class="tk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-label="Sending" role="img"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const amCustomer=c=>c.customer_id===USER.id;
const titleOf=c=>amCustomer(c)?c.listing_name:c.customer_name;
const subOf=c=>amCustomer(c)?(c.listing_kind==='society'?'Society':'Business'):'About '+c.listing_name;
const convAv=c=>avatar({name:titleOf(c),kind:amCustomer(c)&&c.listing_kind==='society'?'society':'business',cat:'Other'},44);
const hhmm=d=>new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
function when(d){const t=new Date(d),n=new Date();if(t.toDateString()===n.toDateString())return hhmm(d);const y=new Date(n);y.setDate(n.getDate()-1);if(t.toDateString()===y.toDateString())return 'Yesterday';return t.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
function dayLabel(d){const t=new Date(d),n=new Date();if(t.toDateString()===n.toDateString())return 'Today';const y=new Date(n);y.setDate(n.getDate()-1);if(t.toDateString()===y.toDateString())return 'Yesterday';return t.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}

async function start(){
  if(!USER){
    mbox.classList.remove('chatting');
    mlist.innerHTML='';
    mthread.innerHTML=`<div class="mempty"><h1>Messages</h1><p>Log in to message businesses and societies, and to see replies.</p><button class="btn pink" type="button" id="m-login">Log in or sign up</button></div>`;
    mbox.classList.add('logged-out');return;
  }
  mbox.classList.remove('logged-out');
  started=true;
  const to=qp.get('to');
  if(to){
    const m=to.match(/^([bs]):(.{1,64})$/);
    if(m){
      const {data,error}=await sb.rpc('start_conversation',{p_kind:m[1]==='s'?'society':'business',p_id:m[2]});
      if(error){say(/own listing/i.test(error.message)?'That’s your own listing.':(error.message||'Could not start the chat'),4000);history.replaceState(null,'','/messages.html')}
      else{history.replaceState(null,'','/messages.html?c='+encodeURIComponent(data));qp.set('c',data)}
      qp.delete('to');
    }
  }
  await loadConvs();
  watchInbox();
  const c=qp.get('c');
  if(c&&CONVS.some(x=>x.id===c))openConv(c,false);else drawEmptyThread();
}
async function loadConvs(){
  const [a,u]=await Promise.all([
    sb.from('conversations').select('*').order('last_at',{ascending:false}).limit(100),
    sb.from('messages').select('conversation_id').is('read_at',null).neq('sender_id',USER.id).limit(1000)
  ]);
  if(a.error){mlist.innerHTML=`<div class="mempty" role="alert">We couldn’t load your messages. <button class="link" type="button" id="m-retry">Try again</button></div>`;return}
  CONVS=a.data||[];UNREAD={};
  (u.data||[]).forEach(x=>UNREAD[x.conversation_id]=(UNREAD[x.conversation_id]||0)+1);
  drawList();
}
function drawList(){
  mlist.innerHTML=`<div class="mlhead"><h1>Messages</h1></div>`+(CONVS.length?`<ul class="mconvs">${CONVS.map(c=>{const n=UNREAD[c.id]||0;const mine=c.last_sender===USER.id;return `<li><a href="/messages.html?c=${encodeURIComponent(c.id)}" data-conv="${esc(c.id)}" class="mconv${c.id===OPEN?' on':''}${n?' unread':''}"${c.id===OPEN?' aria-current="true"':''}>${convAv(c)}<span class="mc-t"><b>${esc(titleOf(c))}</b><small>${esc(subOf(c))}</small><span class="mc-p">${c.last_body?(mine?'You: ':'')+esc(c.last_body):'No messages yet'}</span></span><span class="mc-r"><small>${c.last_body?when(c.last_at):''}</small>${n?`<span class="mbadge">${n>9?'9+':n}<span class="sr"> unread</span></span>`:''}</span></a></li>`}).join('')}</ul>`
    :`<div class="mempty"><p><b>No messages yet.</b><br>Find a business or society and press <b>Message</b> on their page.</p><a class="btn" href="/#browse">Browse the Board</a></div>`);
}
function drawEmptyThread(){
  mbox.classList.remove('chatting');
  mthread.innerHTML=CONVS.length?`<div class="mempty"><p>Pick a chat to read it.</p></div>`:'';
}
async function openConv(id,push=true){
  const c=CONVS.find(x=>x.id===id);if(!c)return;
  OPEN=id;otherHere=false;
  if(push)history.pushState(null,'','/messages.html?c='+encodeURIComponent(id));
  mbox.classList.add('chatting');
  const back=`<button class="x mback" type="button" id="m-back" aria-label="Back to all chats">&#8249;</button>`;
  const link=c.listing_kind==='society'?'/listing.html?s=':'/listing.html?b=';
  mthread.innerHTML=`<div class="mthead">${back}${convAv(c)}<div class="mt-t"><b id="m-title" tabindex="-1">${esc(titleOf(c))}</b><small id="m-status" aria-live="polite">${amCustomer(c)?`<a href="${link}${encodeURIComponent(c.listing_id)}">View ${c.listing_kind==='society'?'society':'listing'}</a>`:'About <a href="'+link+encodeURIComponent(c.listing_id)+'">'+esc(c.listing_name)+'</a>'}</small></div></div>
    <div class="mmsgs" id="mmsgs" role="log" aria-label="Messages" tabindex="0"><p class="hint" style="text-align:center">Loading…</p></div>
    <form class="mcomp" id="mcomp" novalidate>
      <label class="sr" for="m-in">Write a message</label>
      <textarea id="m-in" rows="1" maxlength="1000" placeholder="Write a message"></textarea>
      <button class="btn pink" type="submit" id="m-send">Send</button>
    </form>
    <p class="mtip">Keep payments and bank details off the chat. <a href="/rules.html">Stay safe</a></p>`;
  drawList();
  const {data}=await sb.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).limit(300);
  if(OPEN!==id)return;
  MSGS=(data||[]).reverse();drawMsgs(true);
  markRead();
  joinChat(id);
  $('m-in').focus({preventScroll:true});
}
function drawMsgs(toBottom){
  const el=$('mmsgs');if(!el)return;
  const near=el.scrollHeight-el.scrollTop-el.clientHeight<80;
  let day='',html='';
  /* only the newest of my read messages needs a "read" tick label for screen readers; every bubble shows its own tick */
  MSGS.forEach(m=>{
    const d=dayLabel(m.created_at);if(d!==day){day=d;html+=`<div class="mday"><span>${esc(d)}</span></div>`}
    const mine=m.sender_id===USER.id;
    html+=`<div class="msg${mine?' me':''}${m._failed?' failed':''}"><p>${esc(m.body)}</p><span class="mt">${hhmm(m.created_at)}${mine?(m._sending?CLOCK:m.read_at?TICK2:TICK1):''}</span>${m._failed?`<button class="link" type="button" data-retry="${esc(m.id)}">Not sent. Try again</button>`:''}</div>`;
  });
  el.innerHTML=html||`<p class="hint" style="text-align:center">Say hello. Ask about prices, times or anything else.</p>`;
  if(toBottom||near)el.scrollTop=el.scrollHeight;
}
async function markRead(){
  if(!OPEN||document.hidden)return;
  if(!MSGS.some(m=>m.sender_id!==USER.id&&!m.read_at))return;
  await sb.rpc('mark_read',{p_conv:OPEN});
  MSGS.forEach(m=>{if(m.sender_id!==USER.id&&!m.read_at)m.read_at=new Date().toISOString()});
  UNREAD[OPEN]=0;drawList();paintBadge();
}
async function send(body,temp){
  const id=OPEN;
  const t=temp||{id:'tmp'+Date.now(),conversation_id:id,sender_id:USER.id,body,created_at:new Date().toISOString(),read_at:null,_sending:true};
  t._sending=true;t._failed=false;
  if(!temp)MSGS.push(t);
  drawMsgs(true);
  const {data,error}=await sb.from('messages').insert({conversation_id:id,body}).select().single();
  if(OPEN!==id)return;
  if(error){t._sending=false;t._failed=true;drawMsgs();say(/slow down/i.test(error.message)?'You’re sending messages too fast. Wait a moment.':'Message not sent. Check your connection.',3500);return}
  const i=MSGS.indexOf(t);
  if(MSGS.some(m=>m.id===data.id))MSGS.splice(i,1);else MSGS[i]=data;
  drawMsgs(true);
  const c=CONVS.find(x=>x.id===id);if(c){c.last_body=body.slice(0,120);c.last_at=data.created_at;c.last_sender=USER.id;CONVS.sort((a,b)=>String(b.last_at).localeCompare(String(a.last_at)));drawList()}
}

/* ---------- live updates: new messages, read ticks, typing, who's in the chat ---------- */
let reloadT=null;
function soonReload(){clearTimeout(reloadT);reloadT=setTimeout(()=>{loadConvs();paintBadge()},400)}
function onRow(p){
  const m=p.new;if(!m||!m.conversation_id)return;
  if(m.conversation_id===OPEN){
    const i=MSGS.findIndex(x=>x.id===m.id);
    if(i>=0)MSGS[i]=Object.assign(MSGS[i],m);
    else if(!(m.sender_id===USER.id&&MSGS.some(x=>x._sending&&x.body===m.body))){MSGS.push(m)}
    if(m.sender_id!==USER.id)showTyping(false);
    drawMsgs();markRead();
  }
  soonReload();
}
function watchInbox(){
  if(inbox)sb.removeChannel(inbox);
  inbox=sb.channel('inbox-'+USER.id).on('postgres_changes',{event:'*',schema:'public',table:'messages'},onRow).subscribe();
  /* safety net if live updates are blocked: check every 10 seconds while the page is open */
  clearInterval(poll);
  poll=setInterval(async()=>{
    if(document.hidden)return;
    if(inbox&&inbox.state==='joined')return;
    await loadConvs();
    if(OPEN){
      const {data}=await sb.from('messages').select('*').eq('conversation_id',OPEN).order('created_at',{ascending:false}).limit(300);
      if(data){const pend=MSGS.filter(m=>m._sending||m._failed);MSGS=data.reverse().concat(pend);drawMsgs();markRead()}
    }
  },10000);
}
function joinChat(id){
  if(chat){sb.removeChannel(chat);chat=null}
  chat=sb.channel('chat:'+id,{config:{private:true,presence:{key:USER.id}}});
  chat.on('broadcast',{event:'typing'},({payload})=>{if(payload&&payload.uid!==USER.id&&OPEN===id)showTyping(true)})
    .on('presence',{event:'sync'},()=>{otherHere=Object.keys(chat.presenceState()).some(k=>k!==USER.id);paintStatus()})
    .subscribe(s=>{if(s==='SUBSCRIBED')chat.track({at:Date.now()})});
}
let typingOn=false;
function showTyping(on){
  clearTimeout(typingTimer);typingOn=on;paintStatus();
  if(on)typingTimer=setTimeout(()=>{typingOn=false;paintStatus()},3500);
}
function paintStatus(){
  const el=$('m-status');if(!el)return;
  const c=CONVS.find(x=>x.id===OPEN);if(!c)return;
  const link=c.listing_kind==='society'?'/listing.html?s=':'/listing.html?b=';
  if(typingOn){el.innerHTML='<span class="typing">typing<i>.</i><i>.</i><i>.</i></span>';return}
  el.innerHTML=(otherHere?'<span class="here">In the chat now</span> · ':'')+(amCustomer(c)?`<a href="${link}${encodeURIComponent(c.listing_id)}">View ${c.listing_kind==='society'?'society':'listing'}</a>`:'About <a href="'+link+encodeURIComponent(c.listing_id)+'">'+esc(c.listing_name)+'</a>');
}

/* ---------- events ---------- */
mbox.addEventListener('click',e=>{
  const a=e.target.closest('[data-conv]');
  if(a&&!e.metaKey&&!e.ctrlKey){e.preventDefault();openConv(a.dataset.conv);return}
  if(e.target.closest('#m-back')){OPEN=null;if(chat){sb.removeChannel(chat);chat=null}history.pushState(null,'','/messages.html');drawEmptyThread();drawList();const f=mlist.querySelector('a');if(f)f.focus();return}
  if(e.target.closest('#m-login')){openAuth('in',null,e.target.closest('#m-login'));return}
  if(e.target.closest('#m-retry')){loadConvs();return}
  const r=e.target.closest('[data-retry]');
  if(r){const m=MSGS.find(x=>String(x.id)===r.dataset.retry);if(m)send(m.body,m)}
});
mbox.addEventListener('submit',e=>{
  if(e.target.id!=='mcomp')return;
  e.preventDefault();
  const i=$('m-in'),v=i.value.trim();if(!v)return;
  i.value='';i.style.height='';send(v.slice(0,1000));i.focus();
});
mbox.addEventListener('keydown',e=>{
  if(e.target.id==='m-in'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('mcomp').requestSubmit()}
});
mbox.addEventListener('input',e=>{
  if(e.target.id!=='m-in')return;
  const t=e.target;t.style.height='';t.style.height=Math.min(t.scrollHeight,160)+'px';
  if(chat&&Date.now()-lastTypingSent>2000&&t.value.trim()){lastTypingSent=Date.now();chat.send({type:'broadcast',event:'typing',payload:{uid:USER.id}})}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)markRead()});
window.addEventListener('popstate',()=>{const c=new URLSearchParams(location.search).get('c');if(c&&CONVS.some(x=>x.id===c))openConv(c,false);else{OPEN=null;drawEmptyThread();drawList()}});
Board.onUser=(u)=>{
  if(!u){started=false;clearInterval(poll);if(inbox)sb.removeChannel(inbox);if(chat)sb.removeChannel(chat);inbox=chat=null;OPEN=null;CONVS=[];}
  start();
};
