/* the Board: one business or society, on its own page (listing.html?b=ID or ?s=ID). */
"use strict";
const qs=new URLSearchParams(location.search);
const KIND=qs.has('s')?'society':'business',LID=qs.get(KIND==='society'?'s':'b');
const box=$('lp');
let cur=null,rvStars=0;

async function load(){
  if(!LID){notFound();return}
  await sessionUser();
  const table=KIND==='society'?'societies':'businesses';
  const {data,error}=await sb.from(table).select('*').eq('id',LID).limit(1);
  if(error){box.innerHTML=`<div class="empty" role="alert">We couldn’t load this listing. Check your connection, then <button class="link" type="button" id="retry">try again</button>.</div>`;return}
  if(!data||!data[0]){notFound();return}
  cur=KIND==='society'?socFromRow(data[0]):bizFromRow(data[0]);
  if(KIND==='business'){
    const live=sb.from('reviews').select('*').eq('business_id',cur.id).eq('status','live').order('created_at',{ascending:false}).limit(200);
    const own=USER?sb.from('reviews').select('*').eq('business_id',cur.id).eq('user_id',USER.id):Promise.resolve({data:[]});
    const [a,b]=await Promise.all([live,own]);const seen=new Set();
    cur.reviews=[...(a.data||[]),...(b.data||[])].filter(x=>!seen.has(String(x.id))&&seen.add(String(x.id))).map(reviewFromRow);
  }
  draw();
}
function notFound(){
  document.title='Not found | the Board';
  box.innerHTML=`<div class="empty"><b>This listing isn’t on the Board.</b><br>It may have been removed, or it’s still waiting for approval. <a href="/#browse">Browse the Board</a></div>`;
}
function reviewBox(it){
  const mine=USER&&it.reviews.find(r=>r.uid===USER.id);
  if(USER&&it.owner===USER.id)return `<div class="rvlock"><b>This is your business.</b> You can’t review your own listing.</div>`;
  if(mine)return `<div class="rvlock" role="status"><b>Thanks, you've reviewed this business.</b> Each person can leave one review per business.<br><button class="link" type="button" id="rv-del" data-rid="${esc(mine.id)}">Delete my review</button></div>`;
  if(!USER)return `<div class="rvlock"><b>Log in to leave a review.</b> Any signed-in user can review a business.<br><button class="btn pink sm" type="button" data-login style="margin-top:10px">Log in or sign up</button></div>`;
  if(it.status!=='live')return '';
  return `<form class="rvform" id="rvf" novalidate>
      <p style="margin:0 0 8px;font-weight:700">${rvStars?`You picked ${rvStars} star${rvStars>1?'s':''}`:'How many stars would you give?'}</p>
      <div class="rvpick" role="radiogroup" aria-label="Star rating">${[1,2,3,4,5].map(i=>`<button type="button" class="rvstar" role="radio" aria-checked="${i===rvStars}" aria-label="${i} star${i>1?'s':''}" data-star="${i}"><svg width="34" height="34" viewBox="0 0 24 24" fill="${i<=rvStars?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS.star}"/></svg></button>`).join('')}</div>
      ${rvStars?`<div class="f" style="margin-top:14px"><label for="rv-t">Why ${rvStars} star${rvStars>1?'s':''}?</label><textarea id="rv-t" maxlength="500" placeholder="Tell other students what it was like"></textarea></div>
      <p class="err" id="rv-e" role="alert" hidden></p>
      <button class="btn pink" type="submit" id="rv-go">Post review</button>`:''}
    </form>`;
}
function draw(){
  const it=cur,biz=it.kind==='business',own=USER&&it.owner===USER.id,n=biz?liveRv(it).length:0;
  const price=biz?(fromPrice(it)||it.price):'';
  document.title=it.name+' | the Board';
  const ic=biz?(CAT[it.cat]||CAT.Other).i:'users',ph=it.photos||[];
  const msgHref='/messages.html?to='+(biz?'b':'s')+':'+encodeURIComponent(it.id);
  box.innerHTML=`<a class="crumb" href="/#browse">&larr; Back to the Board</a>
  <section class="lhero">
    <div class="lban" style="background:${colourFor(it)}">${ph[0]?`<button class="lban-img" type="button" data-p="0" aria-label="View photos"><img src="${esc(ph[0])}" alt="" decoding="async"></button>`:`<span class="pv-ic">${svg(ICONS[ic],84,1.3)}</span>`}</div>
    <div class="lhead">
      ${avatar(it,112)}
      <div class="lname">
        <span class="svc">${esc(biz?(it.sub||it.cat):it.cat+' society')}</span>
        <h1>${esc(it.name)}</h1>
        ${biz?`<div class="rate">${n?`${stars(avg(it),16)}<span>${avg(it).toFixed(1)} from ${n} review${n>1?'s':''}</span>`:'<span>No reviews yet</span>'}</div>`:''}
      </div>
      <div class="lacts">
        ${own?`<span class="ex">Your listing</span>`:it.status==='live'?`<a class="btn pink" href="${msgHref}">${svg(ICONS.chat,18,2.2)}Message</a>`:''}
        ${it.contact?`<button class="btn ghost" type="button" data-copy="${esc(it.contact)}">Copy contact</button>`:''}
        <button class="btn ghost" type="button" id="share">${svg(ICONS.share,18,2.2)}Share</button>
      </div>
    </div>
  </section>
  ${it.status==='pending'?`<p class="policy" style="margin-top:16px">Waiting for approval. Only you can see this listing for now.</p>`:''}
  <div class="lgrid">
    <div class="lmain">
      <section class="dsec"><h2>About</h2><p>${esc(it.desc)}</p>
        ${(biz?[price].concat(it.meta):it.meta).filter(Boolean).length?`<div class="meta" style="margin-top:10px">${(biz?[price].concat(it.meta):it.meta).filter(Boolean).map(m=>`<span>${esc(m)}</span>`).join('')}</div>`:''}</section>
      ${!biz?`<section class="dsec"><h2>Membership</h2>
        <div class="lfee"><span>${svg(ICONS.pound,22,2)}</span><div><b>${esc(it.membership||'Ask the society')}</b><small>Membership price</small></div></div>
        ${it.perks.length?`<h3 style="margin-top:18px">Member perks</h3><ul class="perks big">${it.perks.map(p=>`<li>${svg(ICONS.gift,18,2)}<span>${esc(p)}</span></li>`).join('')}</ul>`:''}</section>`:''}
      ${ph.length?`<section class="dsec"><h2>Photos</h2><div class="dphotos lphotos">${ph.map((p,i)=>`<button type="button" data-p="${i}" aria-label="View photo ${i+1}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div></section>`:''}
      ${biz&&(it.menu||[]).some(g=>g.items.length)?`<section class="dsec"><h2>Menu and prices</h2>${menuHTML(it)}</section>`:''}
      ${biz&&it.policy?`<section class="dsec"><h2>Policy</h2><p class="policy">${esc(it.policy)}</p></section>`:''}
      ${biz?`<section class="dsec" id="reviews"><h2>Reviews</h2>
        ${n?`<div class="bars" aria-label="Rating breakdown">${[5,4,3,2,1].map(k=>{const c=liveRv(it).filter(r=>r.s===k).length;return `<div class="rbar"><span>${k}</span><i><b style="width:${Math.round(c/n*100)}%"></b></i><em>${c}</em></div>`}).join('')}</div>`:''}
        ${it.reviews.length?it.reviews.map(r=>`<div class="rv">${stars(r.s)}<p>${esc(r.t)}</p><small>${esc(r.w)} · ${esc(r.x)}${USER&&r.uid===USER.id?(r.status==='pending'?' · Your review · Waiting for approval':' · Your review'):''}</small>${USER&&r.uid!==USER.id?` <button class="link rep" type="button" data-report="review" data-rid="${esc(r.id)}">Report</button>`:''}</div>`).join(''):'<p class="hint">Be the first to leave a review.</p>'}
        ${reviewBox(it)}</section>`:''}
    </div>
    <aside class="lside">
      <div class="lcard">
        <h2>Contact</h2>
        <div class="contact" style="border:0;padding:0"><code>${esc(it.contact)}</code><button class="copy" type="button" data-copy="${esc(it.contact)}">Copy</button></div>
        ${!own&&it.status==='live'?`<a class="btn pink" href="${msgHref}" style="margin-top:12px;width:100%">${svg(ICONS.chat,18,2.2)}Message ${esc(it.name)}</a>`:''}
        ${it.meta.length?`<h2 style="margin-top:18px">${biz?'Where and when':'When and where you meet'}</h2><ul class="lmeta">${it.meta.map(m=>`<li>${svg(ICONS.pin,16,2.2)}${esc(m)}</li>`).join('')}</ul>`:''}
        ${own?'':`<button class="link rep" type="button" data-report="${biz?'business':'society'}" data-rid="${esc(it.id)}" style="margin-top:14px">Report this listing</button>`}
      </div>
    </aside>
  </div>`;
}
box.addEventListener('click',async e=>{
  const t=e.target;
  if(t.closest('#retry')){load();return}
  const c=t.closest('[data-copy]');if(c){copyText(c.dataset.copy);return}
  const p=t.closest('[data-p]');if(p){lbOpen(cur.photos,p,+p.dataset.p);return}
  if(t.closest('[data-login]')){openAuth('in',()=>load(),t.closest('[data-login]'));return}
  if(t.closest('#share')){
    const url=location.origin+listingUrl(cur);
    if(navigator.share){try{await navigator.share({title:cur.name,url})}catch(_){}}else copyText(url);
    return;
  }
  const s=t.closest('[data-star]');
  if(s){rvStars=+s.dataset.star;draw();const ta=$('rv-t');if(ta)ta.focus();return}
  const del=t.closest('#rv-del');
  if(del){
    if(!await ask({title:'Delete your review?',text:'This can’t be undone.',ok:'Delete review',danger:true}))return;
    const {error}=await sb.from('reviews').delete().eq('id',del.dataset.rid);
    if(error){say('Could not delete. Try again.');return}
    await load();say('Review deleted');
  }
});
box.addEventListener('submit',async e=>{
  if(e.target.id!=='rvf')return;
  e.preventDefault();
  const t=($('rv-t')||{value:''}).value.trim(),er=$('rv-e');
  if(!rvStars||!t){er.textContent='Tell us why you picked '+rvStars+' star'+(rvStars>1?'s':'')+'.';er.hidden=false;return}
  const go=$('rv-go');go.disabled=true;go.textContent='Posting…';
  const {data,error}=await sb.functions.invoke('submit-post',{body:{kind:'review',row:{business_id:cur.id,stars:rvStars,body:t,reviewer_name:USER.name}}});
  if(error){let m='Something went wrong. Try again.';try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}go.disabled=false;go.textContent='Post review';er.textContent=m;er.hidden=false;return}
  rvStars=0;await load();
  const r=$('reviews');if(r)r.scrollIntoView({block:'start'});
  say(data&&data.status==='pending'?'Thanks. Your review will show once our team has checked it':'Review posted');
});
Board.refresh=load;
Board.onUser=(u,first)=>{if(!first)load()};
load();
