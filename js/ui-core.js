/* The Board: shared UI helpers, icons and the category lists. No network calls in this file. */
/* ---------- icons (one stroke style) ---------- */
const ICONS={
  scissors:'M9 6a3 3 0 11-6 0 3 3 0 016 0z M9 18a3 3 0 11-6 0 3 3 0 016 0z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  sparkle:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cup:'M5 8h12v5a5 5 0 01-5 5h-2a5 5 0 01-5-5V8z M17 9h1.5a2.5 2.5 0 010 5H17 M8 3v2 M12 3v2',
  book:'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z M4 19.5V21h16',
  bolt:'M13 2L4 14h7l-1 8 9-12h-7z',
  camera:'M3 8a2 2 0 012-2h2l1.5-2.5h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z M16 13a4 4 0 11-8 0 4 4 0 018 0z',
  eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  star:'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  users:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8',
  bell:'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 003.4 0',
  pound:'M18 7a4 4 0 00-4-3c-2.5 0-4 1.6-4 4v4 M6 12h8 M6 20h12 M10 12v4c0 2-1 3-4 4'
};
const svg=(d,s=40,w=1.8)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const CAT={
  Hair:{c:'#FFB8D9',i:'scissors'}, Nails:{c:'#FFD84D',i:'sparkle'}, Lashes:{c:'#F7B8E0',i:'eye'},
  Food:{c:'#B8F2D8',i:'cup'}, Tutoring:{c:'#C9DDFF',i:'book'}, Repairs:{c:'#E0D4FF',i:'bolt'},
  Photography:{c:'#FFC9A8',i:'camera'}, Other:{c:'#DAD6EA',i:'star'}
};
const TILES=['Hair','Nails','Food','Photography'];
const LANES=[
  {k:'services',t:'Student services',d:'Hair, nails, food, photography and more.',c:'var(--butter)'},
  {k:'official',t:'Official notices',d:'From universities and students’ unions.',c:'var(--sky)'}
];
/* Keep these two lists in step with the backend's allowed categories (docs/API.md, POST /listings). */
const SUBS={Hair:['Barbers','Braids'],Nails:['Gel & BIAB','Acrylics','Nail art'],Food:['Cakes & bakes','Meal prep','Hot meals','Snacks'],Photography:['Grad shoots','Portraits','Events']};
/* Where a business is based. Keep in step with the backend (GET /areas). */
const AREAS=['City centre','Lenton','Radford','Beeston','West Bridgford','Sneinton','Online'];
const CATS={services:['Hair','Nails','Lashes','Food','Photography','Other'],socs:['Culture','Sport','Tech','Arts','Faith','Academic','Other'],official:['University','Students’ union']};

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let _tt;
function say(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(_tt);_tt=setTimeout(()=>t.hidden=true,2400)}
const errMsg=e=>(e&&e.message)||'Something went wrong. Try again.';

/* Stars. rating is a number 0-5. */
const stars=(n,sz=14)=>{const r=Math.round(n);return `<span class="stars" role="img" aria-label="${n.toFixed(1)} out of 5">${[1,2,3,4,5].map(i=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${i<=r?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS.star}"/></svg>`).join('')}</span>`};
const initials=n=>String(n||'').split(/\s+/).filter(w=>/^[A-Za-z0-9]/.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join('');
/* Avatar. it: { name, cat, avatar (image URL or null) } */
const avatar=(it,sz)=>`<span class="av" aria-hidden="true" style="--s:${sz}px;background:${(CAT[it.cat]||CAT.Other).c}">${it.avatar?`<img src="${esc(it.avatar)}" alt="" decoding="async">`:`<b>${esc(initials(it.name))}</b>`}</span>`;

/* Times arrive as ISO strings from the API. */
function relTime(iso){
  const s=(Date.now()-new Date(iso).getTime())/1000;
  if(!(s>=0)||s<60)return 'Just now';
  if(s<3600)return Math.floor(s/60)+' min ago';
  if(s<86400){const h=Math.floor(s/3600);return h+(h===1?' hour ago':' hours ago')}
  if(s<86400*7){const d=Math.floor(s/86400);return d+(d===1?' day ago':' days ago')}
  if(s<86400*30){const w=Math.floor(s/604800);return w+(w===1?' week ago':' weeks ago')}
  const m=Math.floor(s/2592000);return m+(m===1?' month ago':' months ago');
}
function msgTime(iso){
  const d=new Date(iso),n=new Date(),hm=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),diff=(day(n)-day(d))/86400000;
  if(diff===0)return hm;if(diff===1)return 'Yesterday '+hm;
  if(diff<7)return d.toLocaleDateString('en-GB',{weekday:'short'})+' '+hm;
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+hm;
}

/* Put a button into a busy state while a request runs. Returns a function that restores it. */
function busy(btn,label){
  if(!btn)return ()=>{};
  const old=btn.textContent;btn.disabled=true;btn.setAttribute('aria-busy','true');if(label)btn.textContent=label;
  return ()=>{btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent=old};
}
/* Resize an image in the browser before upload. Returns a Blob. The server must still validate (docs/API.md). */
function canvasBlob(file,draw,w,h,q){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      const c=document.createElement('canvas');c.width=w(im);c.height=h(im);draw(c.getContext('2d'),im,c);
      URL.revokeObjectURL(u);c.toBlob(b=>b?res(b):rej(new Error('encode')),'image/jpeg',q);
    };
    im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('read'))};im.src=u;
  });
}
const shrink=f=>{const r=im=>Math.min(1,1000/Math.max(im.width,im.height));return canvasBlob(f,(g,im,c)=>g.drawImage(im,0,0,c.width,c.height),im=>Math.round(im.width*r(im)),im=>Math.round(im.height*r(im)),.82)};
const shrinkSquare=(f,sz=256)=>canvasBlob(f,(g,im)=>{const m=Math.min(im.width,im.height);g.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,sz,sz)},()=>sz,()=>sz,.85);

const X_ICON='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/* "Replies in about 16 min". seconds comes from the API (avgResponseSeconds), null when unknown. */
function fmtReply(sec){
  if(sec==null)return '';
  const m=Math.round(sec/60);
  if(sec<90)return 'under a minute';
  if(m<90)return m+' min';
  const h=Math.round(sec/3600);if(h<36)return h+(h===1?' hour':' hours');
  const d=Math.round(sec/86400);return d+(d===1?' day':' days');
}
const CLOCK_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const replyLine=sec=>sec==null?'<span class="rtime">'+CLOCK_ICON+'New here, no replies yet</span>':'<span class="rtime">'+CLOCK_ICON+'Replies in about '+fmtReply(sec)+'</span>';
/* Wide cover image for profiles. */
const shrinkBanner=f=>canvasBlob(f,(g,im,c)=>{const r=Math.max(c.width/im.width,c.height/im.height),w=im.width*r,h=im.height*r;g.drawImage(im,(c.width-w)/2,(c.height-h)/2,w,h)},()=>1200,()=>400,.82);

/* The student's location, if they chose to share it. Rounded to about 1 km and kept only in this browser. */
let LOC=null;
try{const v=JSON.parse(localStorage.getItem('board.loc'));if(v&&typeof v.lat==='number')LOC=v}catch(_){}
function setLoc(v){LOC=v;try{v?localStorage.setItem('board.loc',JSON.stringify(v)):localStorage.removeItem('board.loc')}catch(_){}}
const miles=km=>{const m=km*0.621;return m<0.2?'Right by you':m<10?m.toFixed(1)+' mi away':Math.round(m)+' mi away'};
/* "Lenton · 0.4 mi away", "Online", or just the area when we don't know where the student is */
const whereText=it=>!it.area?'':it.area==='Online'?'Online':it.distanceKm!=null?`${it.area} · ${miles(it.distanceKm)}`:it.area;
const PIN_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
