/* the Board: rankings page. "This week" uses reviews from the last 7 days; "All time" uses every review. */
"use strict";
const WEEK=7*864e5;
let BIZ=[],view=location.hash==='#all-time'?'all':'week',ERR=false;
async function load(){
  try{
    const [b,r]=await Promise.all([
      sb.from('businesses').select('*').eq('status','live').limit(1000),
      sb.from('reviews').select('*').eq('status','live').order('created_at',{ascending:false}).limit(5000)
    ]);
    if(b.error||r.error)throw b.error||r.error;
    BIZ=(b.data||[]).map(bizFromRow);
    (r.data||[]).forEach(x=>{const it=BIZ.find(i=>String(i.id)===String(x.business_id));if(it)it.reviews.push(reviewFromRow(x))});
    ERR=false;
  }catch(_){ERR=true}
  draw();
}
const mean=l=>l.reduce((a,r)=>a+r.s,0)/l.length;
function rows(){
  if(view==='all'){
    return BIZ.filter(x=>liveRv(x).length).map(x=>({it:x,a:avg(x),n:liveRv(x).length}))
      .sort((x,y)=>y.a-x.a||y.n-x.n||x.it.name.localeCompare(y.it.name));
  }
  const since=Date.now()-WEEK;
  return BIZ.map(x=>{const w=liveRv(x).filter(r=>new Date(r.at).getTime()>=since);return {it:x,a:w.length?mean(w):0,n:w.length}})
    .filter(x=>x.n).sort((x,y)=>y.a-x.a||y.n-x.n||x.it.name.localeCompare(y.it.name));
}
function draw(){
  document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===view;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});
  const list=rows(),el=$('rk');
  $('rk-note').textContent=view==='week'
    ?'Ranked by the average star rating from reviews posted in the last 7 days. Ties go to the business with more reviews this week.'
    :'Ranked by average star rating from every review. Ties go to the business with more reviews.';
  if(ERR){el.innerHTML=`<div class="empty" role="alert">We couldn’t load the rankings. <button class="link" type="button" id="retry">Try again</button></div>`;return}
  el.innerHTML=list.length?list.map((r,i)=>`<a class="rk ${i<3?'top'+(i+1):''}" href="${esc(listingUrl(r.it))}"><span class="no">${i+1}</span>${avatar(r.it,48)}<span class="rt"><b>${esc(r.it.name)}</b><small>${esc(r.it.sub||r.it.cat)}${r.it.meta[0]?' · '+esc(r.it.meta[0]):''}</small></span><span class="rate">${stars(r.a)} ${r.a.toFixed(1)} <small>(${r.n}${view==='week'?' this week':''})</small></span></a>`).join('')
    :`<div class="empty">${view==='week'?'No reviews in the last 7 days yet. <button class="link" type="button" data-view="all">See all time</button>':'No reviews yet. Be the first to review a business.'}</div>`;
}
$('rk-tabs').addEventListener('keydown',e=>{
  if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
  e.preventDefault();view=view==='week'?'all':'week';draw();document.querySelector(`#rk-tabs [data-view="${view}"]`).focus();
});
document.addEventListener('click',e=>{
  if(e.target.closest('#retry')){load();return}
  const b=e.target.closest('[data-view]');if(!b)return;
  view=b.dataset.view;history.replaceState(null,'',view==='all'?'#all-time':location.pathname);draw();
});
Board.refresh=load;
load();
