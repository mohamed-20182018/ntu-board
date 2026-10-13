/* Profile page (profile.html). Your own profile: profile.html. Someone else's: profile.html?u=<userId>.
   Shows picture, name, bio, member since, and a reliability record: appointments, reviews, late fees
   and late fee defaults (late fees that are still unpaid). Data: API.myProfile / API.userProfile / API.saveProfile. */
const pfMain=document.getElementById('profile');
const PF={data:null,editing:false,pic:null,up:false};

const memberSince=iso=>iso?'Member since '+new Date(iso).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'';
const feeStatus={unpaid:'Unpaid',paid:'Paid',waived:'Waived'};

function pfStats(st,self){
  const d=st.lateFeeDefaults;
  return `<div class="tiles-dash">
    <div class="stat"><b>${st.appointments}</b><span>Appointments done</span></div>
    <div class="stat"><b>${st.reviews}</b><span>Reviews left</span></div>
    <div class="stat"><b>${st.lateFees}</b><span>Late fees</span></div>
    <div class="stat ${d?'bad':'good'}"><b>${d}</b><span>Late fee ${d===1?'default':'defaults'}</span></div>
  </div>
  <p class="hint pf-note">${d?(self?'A default is a late fee you haven’t paid yet. Pay the business directly. Once they mark it paid it stops counting.':'Late fee defaults are late fees this student hasn’t paid yet.'):(self?'No unpaid late fees. Businesses can see this when you message them.':'No unpaid late fees.')}</p>`;
}
function drawProfile(){
  const d=PF.data,u=d.user,self=USER&&u.id===USER.id,biz=u.type==='business';
  document.title=(self?'Your profile':u.name)+' | the Board';
  if(PF.editing&&self){
    const av=PF.pic?PF.pic.url:u.avatar;
    pfMain.innerHTML=`<form class="pf-card pf-edit" id="pf-form" novalidate>
      <h1 id="pf-title" tabindex="-1">Edit your profile</h1>
      <div class="f"><span class="lbl" id="pf-pic-l">Profile picture</span>
        <div class="avpick">${avatar({name:u.name,cat:'Other',avatar:av},88)}<label class="addph"><input type="file" id="pf-pic" accept="image/jpeg,image/png,image/webp" aria-describedby="pf-pic-l"><span>${av?'Change picture':'+ Add picture'}</span></label>${av?'<button class="link" type="button" id="pf-pic-rm">Remove</button>':''}</div>
        <p class="hint" role="status">${PF.up?'Uploading…':''}</p></div>
      <div class="f"><label for="pf-name">Name</label><input type="text" id="pf-name" maxlength="40" value="${esc(u.name)}" autocomplete="name"></div>
      <div class="f"><label for="pf-bio">Bio <span class="hint">up to 300 characters</span></label><textarea id="pf-bio" maxlength="300" placeholder="${biz?'What you do, where, and how to book.':'A line about you, like your course or what you’re usually booking.'}">${esc(u.bio)}</textarea></div>
      <p class="err" id="pf-err" role="alert" hidden></p>
      <div class="row-btns"><button class="btn ghost" type="button" id="pf-cancel">Cancel</button><button class="btn pink" type="submit" ${PF.up?'disabled':''}>Save profile</button></div>
    </form>`;
    return;
  }
  pfMain.innerHTML=`<section class="pf-card">
      <div class="pf-cover ${biz?'biz':''}" aria-hidden="true"></div>
      <div class="pf-head">${avatar({name:u.name,cat:'Other',avatar:u.avatar},112)}
        <div class="pf-who"><h1 id="pf-title" tabindex="-1">${esc(u.name)}</h1>
          <p><span class="dash-role ${biz?'biz':''}">${biz?'Business account':'Student account'}</span> <span class="hint">${esc(memberSince(u.createdAt))}</span></p></div>
        ${self?'<button class="btn ghost sm" type="button" id="pf-edit">Edit profile</button>':''}
      </div>
      <p class="pf-bio ${u.bio?'':'empty'}">${u.bio?esc(u.bio):(self?'No bio yet. Add one so businesses know who they’re talking to.':'No bio yet.')}</p>
    </section>
    <section class="dsec2" aria-labelledby="pf-rel"><h2 id="pf-rel" class="pf-h">Reliability</h2>${pfStats(d.stats,self)}</section>
    ${self&&d.lateFees&&d.lateFees.length?`<section class="dsec2" aria-labelledby="pf-fees"><h2 id="pf-fees" class="pf-h">Late fees</h2>${d.lateFees.map(f=>`<div class="drow"><div class="grow"><b>£${esc(f.amount)} · ${esc(f.listingName)}</b><small>${f.minutes?esc(f.minutes)+' minutes late · ':''}${esc(relTime(f.createdAt))}</small></div><span class="chip fee-${f.status}">${feeStatus[f.status]}</span></div>`).join('')}</section>`:''}
    ${d.listings&&d.listings.length?`<section class="dsec2" aria-labelledby="pf-lst"><h2 id="pf-lst" class="pf-h">${self?'Your listings':'Listings'}</h2>${d.listings.map(l=>`<div class="drow">${avatar(l,44)}<div class="grow"><b>${esc(l.name)}</b><small>${esc(l.sub||l.cat)}${l.reviewCount?` · ${l.rating.toFixed(1)} stars (${l.reviewCount})`:''}</small></div><button class="btn ghost sm" type="button" data-view="${esc(l.id)}">View profile</button></div>`).join('')}</section>`:''}
    ${self?`<div class="pf-links"><button class="btn dark sm" type="button" id="pf-dash">${biz?'Business dashboard':'Your dashboard'}</button><a class="btn ghost sm" href="messages.html">Messages</a></div>`:''}
    ${self&&API.isMock?`<section class="dsec2" aria-labelledby="pf-data"><h2 id="pf-data" class="pf-h">Your data</h2><p class="hint pf-note">Your account is a demo kept only in this browser. Clearing this site’s data in your browser deletes it. See our <a href="privacy.html">privacy notice</a>.</p></section>`:''}
    ${self&&!API.isMock?`<section class="dsec2" aria-labelledby="pf-data"><h2 id="pf-data" class="pf-h">Your data</h2>
      <p class="hint pf-note">Download a copy of everything we hold about you, or delete your account. See our <a href="privacy.html">privacy notice</a>.</p>
      <div class="pf-links"><a class="btn ghost sm" href="${esc(API.isMock?'#':API.exportUrl())}" id="pf-export" download="the-board-my-data.json">Download my data</a><button class="btn ghost sm danger" type="button" id="pf-del" aria-expanded="${!!PF.deleting}">Delete my account</button></div>
      ${PF.deleting?`<form class="pf-del" id="pf-delform" novalidate>
        <p><b>This can’t be undone.</b> Your account, listings, conversations and pictures will be deleted. Reviews you wrote stay on businesses’ pages without your name.</p>
        <div class="f"><label for="pf-delpw">Type your password to confirm</label><input type="password" id="pf-delpw" autocomplete="current-password" maxlength="128"></div>
        <p class="err" id="pf-delerr" role="alert" hidden></p>
        <div class="pf-links"><button class="btn ghost sm" type="button" id="pf-delno">Keep my account</button><button class="btn sm danger-solid" type="submit">Delete my account for good</button></div>
      </form>`:''}</section>`:''}`;
}
async function loadProfile(){
  if(!pfMain)return;
  const id=new URLSearchParams(location.search).get('u');
  if(!USER){pfMain.innerHTML=`<div class="mempty-page"><h1>Profile</h1><p>Log in to see ${id?'this profile':'your profile'}.</p><button class="btn pink" type="button" id="pf-login">Log in or sign up</button></div>`;return}
  pfMain.innerHTML='<div class="dsk" aria-hidden="true"><i class="sk" style="width:112px;height:112px;border-radius:50%"></i><i class="sk" style="width:40%"></i><i class="sk"></i></div>';
  try{PF.data=id&&id!==USER.id?await API.userProfile(id):await API.myProfile();PF.editing=false;drawProfile()}
  catch(e){pfMain.innerHTML=`<div class="state err" role="alert"><p>${esc(errMsg(e))}</p><button class="btn dark sm" type="button" id="pf-retry">Try again</button></div>`}
}
if(pfMain){
  pfMain.addEventListener('click',async e=>{
    const t=e.target;
    if(t.closest('#pf-login')){openAuth('in',null,t);return}
    if(t.closest('#pf-retry')){loadProfile();return}
    if(t.closest('#pf-export')&&API.isMock){e.preventDefault();say('Demo mode keeps your data in this browser only.');return}
    if(t.closest('#pf-del')){PF.deleting=!PF.deleting;drawProfile();if(PF.deleting)$('pf-delpw').focus();return}
    if(t.closest('#pf-delno')){PF.deleting=false;drawProfile();$('pf-del').focus();return}
    if(t.closest('#pf-edit')){PF.editing=true;PF.pic=null;drawProfile();$('pf-title').focus();return}
    if(t.closest('#pf-cancel')){PF.editing=false;drawProfile();$('pf-edit').focus();return}
    if(t.closest('#pf-pic-rm')){PF.pic={id:'',url:''};drawProfile();return}
    if(t.closest('#pf-dash')){openDash(t);return}
    const v=t.closest('[data-view]');if(v){openDetail(v.dataset.view,v)}
  });
  pfMain.addEventListener('change',async e=>{
    if(e.target.id!=='pf-pic')return;
    const f=e.target.files[0];if(!f)return;
    const keep={name:$('pf-name').value,bio:$('pf-bio').value};
    if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>15e6){say('Profile picture must be a JPG, PNG or WebP under 15MB.');return}
    PF.up=true;drawProfile();$('pf-name').value=keep.name;$('pf-bio').value=keep.bio;
    try{const r=await API.upload(await shrinkSquare(f),'avatar');PF.pic={id:r.id,url:r.url}}catch(err){say(errMsg(err))}
    PF.up=false;drawProfile();$('pf-name').value=keep.name;$('pf-bio').value=keep.bio;$('pf-pic').focus();
  });
  pfMain.addEventListener('submit',async e=>{
    e.preventDefault();
    if(e.target.id==='pf-delform'){
      const pw=$('pf-delpw').value,er=$('pf-delerr');
      if(!pw){er.textContent='Type your password to confirm.';er.hidden=false;$('pf-delpw').focus();return}
      const done=busy(e.target.querySelector('button[type=submit]'),'Deleting…');
      try{await API.deleteAccount(pw)}catch(err){done();er.textContent=errMsg(err);er.hidden=false;$('pf-delpw').focus();return}
      PF.deleting=false;setUser(null);
      pfMain.innerHTML='<div class="mempty-page"><h1>Account deleted</h1><p>Your account and everything in it has been deleted. We’ve sent a confirmation to your email.</p><a class="btn pink" href="index.html">Back to the Board</a></div>';
      return;
    }
    const name=$('pf-name').value.trim(),bio=$('pf-bio').value.trim(),er=$('pf-err');
    if(!name){er.textContent='Add your name.';er.hidden=false;$('pf-name').focus();return}
    const done=busy(e.target.querySelector('button[type=submit]'),'Saving…');
    try{
      const body={name,bio};if(PF.pic)body.avatarId=PF.pic.id||null;
      PF.data=await API.saveProfile(body);PF.editing=false;PF.pic=null;
      setUser(Object.assign({},USER,{name:PF.data.user.name,avatar:PF.data.user.avatar,bio:PF.data.user.bio}));
      drawProfile();$('pf-title').focus();say('Profile saved');
    }catch(err){done();er.textContent=errMsg(err);er.hidden=false}
  });
}
