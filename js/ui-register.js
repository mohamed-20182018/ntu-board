/* Register a business, society or notice. Pictures upload as soon as they are picked (API.upload);
   "Post" then sends their ids with the form (API.createListing). Needs a signed-in user. */
const ov=$('overlay'),sheet=$('sheet'),stepEl=$('step'),bars=[...document.querySelectorAll('.progress i')];
const MAXPH=4;
let st={},opener=null;
const KINDS=[
  {k:'services',t:'A student business',s:'Hair, nails, tutoring, repairs, food and more',i:ICONS.pound,bg:'var(--butter)'},
  {k:'socs',t:'A society',s:'Sport, culture, faith, tech, arts and more',i:ICONS.users,bg:'var(--mint)'},
  {k:'official',t:'An official notice',s:'For NTU and NTSU staff only',i:ICONS.bell,bg:'var(--sky)'}
];

function openSheet(e){
  const btn=e&&e.currentTarget||document.activeElement;
  if(!USER){openAuth('up',()=>openSheet({currentTarget:btn}),btn);return}
  if(USER.type!=='business'){askUpgrade(()=>openSheet({currentTarget:btn}),btn);return}
  opener=btn;
  st={step:0,kind:null,name:'',cat:'',desc:'',meta:'',contact:'',agree:false,photos:[],pmsg:'',menu:'',policy:'',sub:'',avatar:null,banner:null,up:0,posting:false,perr:'',result:null};
  ov.hidden=false;document.body.style.overflow='hidden';draw();
}
function closeSheet(){ov.hidden=true;document.body.style.overflow='';if(opener&&opener.focus)opener.focus()}
document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',openSheet));
$('close').addEventListener('click',closeSheet);
ov.addEventListener('click',e=>{if(e.target===ov)closeSheet()});
document.addEventListener('keydown',e=>{
  if(ov.hidden||!aov.hidden)return;
  if(e.key==='Escape'){closeSheet();return}
  if(e.key!=='Tab')return;
  const f=[...sheet.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});

function subOpts(){return (SUBS[st.cat]||[]).concat(['Other']).map(c=>`<option ${st.sub===c?'selected':''}>${c}</option>`).join('')}
/* "Fade - £25" per line becomes the menu the API expects: [{group, items:[{name, price}]}] */
function parseMenu(t){
  const items=t.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,30).map(l=>{
    const m=l.match(/^(.*?)\s*[-–:]\s*(£?\s*\d[\d.,]*.*)$/);
    if(!m)return {name:l,price:''};
    let pr=m[2].trim();if(/^\d/.test(pr))pr='£'+pr;return {name:m[1].trim()||l,price:pr};
  });
  return items.length?[{group:null,items}]:[];
}
const metaList=s=>s.split(',').map(x=>x.trim()).filter(Boolean);
function save(){for(const k of ['name','cat','sub','desc','meta','contact','menu','policy']){const el=$('r-'+k);if(el)st[k]=el.value}}

async function pickAvatar(f){
  save();
  if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>15e6){st.pmsg='Profile picture must be a JPG, PNG or WebP under 15MB.';draw();return}
  st.up++;st.pmsg='Uploading picture…';draw();
  try{const blob=await shrinkSquare(f);const r=await API.upload(blob,'avatar');st.avatar={id:r.id,url:r.url};st.pmsg=''}
  catch(e){st.pmsg=e&&e.status?errMsg(e):'That picture could not be read.'}
  st.up--;draw();$('r-avatar')&&$('r-avatar').focus();
}
async function pickBanner(f){
  save();
  if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>15e6){st.pmsg='Cover picture must be a JPG, PNG or WebP under 15MB.';draw();return}
  st.up++;st.pmsg='Uploading cover…';draw();
  try{const blob=await shrinkBanner(f);const r=await API.upload(blob,'banner');st.banner={id:r.id,url:r.url};st.pmsg=''}
  catch(e){st.pmsg=e&&e.status?errMsg(e):'That picture could not be read.'}
  st.up--;draw();$('r-banner')&&$('r-banner').focus();
}
async function pickPhotos(files){
  save();let msg='';st.up++;st.pmsg='Uploading…';draw();
  for(const f of files){
    if(st.photos.length>=MAXPH){msg='Max '+MAXPH+' photos.';break}
    if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type)){msg='Only JPG, PNG, WebP or GIF images.';continue}
    if(f.size>15e6){msg='One photo was over 15MB and was skipped.';continue}
    try{const blob=await shrink(f);const r=await API.upload(blob,'photo');st.photos.push({id:r.id,url:r.url})}
    catch(e){msg=e&&e.status?errMsg(e):'One photo could not be read.'}
  }
  st.up--;st.pmsg=st.up?'Uploading…':msg;draw();
  const n=$('r-photos');(n&&!n.closest('[hidden]')?n:stepEl.querySelector('.ph button')||$('r-name')).focus();
}

function draw(){
  bars.forEach((b,i)=>b.classList.toggle('on',i<=st.step));
  const title=$('sheet-title');
  if(st.step===0){
    title.textContent='What are you registering?';
    stepEl.innerHTML=`<div class="choices">${KINDS.map(k=>`<button class="choice" type="button" data-kind="${k.k}" aria-pressed="${st.kind===k.k}"><span class="ic" style="background:${k.bg}">${svg(k.i,22,2)}</span><span><strong>${k.t}</strong><span class="s">${k.s}</span></span></button>`).join('')}</div>
      <div class="row-btns"><span></span><button class="btn pink" type="button" id="next0" ${st.kind?'':'disabled'}>Next</button></div>`;
    stepEl.querySelectorAll('.choice').forEach(c=>c.addEventListener('click',()=>{st.kind=c.dataset.kind;draw();stepEl.querySelector(`[data-kind="${st.kind}"]`).focus()}));
    $('next0').addEventListener('click',()=>{if(st.kind){st.step=1;draw()}});
  }else if(st.step===1){
    const soc=st.kind==='socs',off=st.kind==='official',svc=st.kind==='services';
    title.textContent=soc?'Tell us about your society':off?'Your notice':'Tell us about your business';
    stepEl.innerHTML=`<form id="f" novalidate>
      <div class="f"><label for="r-name">${soc?'Society name':off?'Notice title':'Business name'}</label><input type="text" id="r-name" maxlength="80" value="${esc(st.name)}" placeholder="${soc?'e.g. NTU Chess Society':off?'e.g. Reading week library hours':'e.g. Lashes by Zara'}"></div>
      <div class="f"><label for="r-cat">Category</label><select id="r-cat"><option value="">Choose one</option>${CATS[st.kind].map(c=>`<option ${st.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      ${svc?`<div class="f"><span class="lbl" id="bn-l">Cover picture <span class="hint">optional, the wide image at the top of your profile</span></span>
        <div class="bnpick" style="background:${(CAT[st.cat]||CAT.Other).c}">${st.banner?`<img src="${esc(st.banner.url)}" alt="Your cover picture">`:''}</div>
        <div class="avpick" style="margin-top:8px"><label class="addph"><input type="file" id="r-banner" accept="image/jpeg,image/png,image/webp" aria-describedby="bn-l"><span>${st.banner?'Change cover':'+ Add cover'}</span></label>${st.banner?'<button class="link" type="button" id="bn-rm">Remove</button>':''}</div></div>
      <div class="f"><label for="r-sub">Type of service <span class="hint">what you do, e.g. Barbers or Braids</span></label><select id="r-sub"><option value="">Choose one</option>${subOpts()}</select></div>
      <div class="f"><span class="lbl" id="av-l">Profile picture <span class="hint">optional, a logo or a face. You can add one later.</span></span>
        <div class="avpick">${avatar({name:st.name||'You',cat:st.cat||'Other',avatar:st.avatar&&st.avatar.url},64)}<label class="addph"><input type="file" id="r-avatar" accept="image/jpeg,image/png,image/webp" aria-describedby="av-l"><span>${st.avatar?'Change picture':'+ Add picture'}</span></label>${st.avatar?'<button class="link" type="button" id="av-rm">Remove</button>':''}</div></div>`:''}
      <div class="f"><label for="r-desc">${soc?'What you get up to':off?'Details':'What you offer'} <span class="hint">(one or two lines)</span></label><textarea id="r-desc" maxlength="200">${esc(st.desc)}</textarea></div>
      <div class="f"><label for="r-meta">${soc?'When and where you meet':off?'Where it applies':'Where and when'} <span class="hint">separate with commas</span></label><input type="text" id="r-meta" value="${esc(st.meta)}" placeholder="${soc?'Wed 6pm, Clifton':off?'All campuses':'City campus, evenings'}"></div>
      ${svc?`<div class="f"><label for="r-menu">Price list <span class="hint">one per line, like Fade - £25</span></label><textarea id="r-menu" placeholder="Fade - £25&#10;Lineup - £15">${esc(st.menu)}</textarea></div><div class="f"><label for="r-policy">Policy <span class="hint">optional, e.g. late or cancellation rules</span></label><input type="text" id="r-policy" maxlength="400" value="${esc(st.policy)}" placeholder="Over 10 minutes late and a late fee applies"></div>`:''}
      <div class="f"><label for="r-contact">${off?'Posted by':'How people reach you'} <span class="hint">${off?'your department':'Instagram, email or phone'}</span></label><input type="text" id="r-contact" maxlength="120" value="${esc(st.contact)}" placeholder="${off?'NTSU Advice Centre':'@yourhandle'}"></div>
      <div class="f"><span class="lbl" id="ph-l">Photos <span class="hint">optional, up to 4. Show your work.</span></span>
        <label class="addph" ${st.photos.length>=MAXPH?'hidden':''}><input type="file" id="r-photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-describedby="ph-l"><span>+ Add photos</span></label>
        <p class="hint ${st.up?'upnote':''}" id="ph-m" role="status">${esc(st.pmsg)}</p>
        <div class="photos">${st.photos.map((p,i)=>`<div class="ph"><img src="${esc(p.url)}" alt="Photo ${i+1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i+1}">&times;</button></div>`).join('')}</div>
      </div>
      <p class="err" id="err" role="alert" hidden></p>
      <div class="row-btns"><button type="button" class="btn ghost" id="back">Back</button><button class="btn pink" type="submit" ${st.up?'disabled':''}>${st.up?'Uploading…':'Preview'}</button></div>
    </form>`;
    if(svc){
      $('r-cat').addEventListener('change',()=>{save();st.sub='';draw();$('r-cat').focus()});
      $('r-avatar').addEventListener('change',e=>{const f=e.target.files[0];if(f)pickAvatar(f)});
      $('r-banner').addEventListener('change',e=>{const f=e.target.files[0];if(f)pickBanner(f)});
      const brm=$('bn-rm');if(brm)brm.addEventListener('click',()=>{save();st.banner=null;draw();$('r-banner').focus()});
      const rm=$('av-rm');if(rm)rm.addEventListener('click',()=>{save();st.avatar=null;draw();$('r-avatar').focus()});
    }
    $('r-photos').addEventListener('change',e=>{const files=[...e.target.files];if(files.length)pickPhotos(files)});
    stepEl.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{save();st.photos.splice(+b.dataset.rm,1);st.pmsg='';draw();(stepEl.querySelector('.ph button')||$('r-photos')).focus()}));
    $('back').addEventListener('click',()=>{save();st.step=0;draw()});
    $('f').addEventListener('submit',e=>{
      e.preventDefault();save();
      const miss=[['name','a name'],['cat','a category'],['desc','a short description'],['contact',off?'who it’s from':'a way to contact you']].filter(([k])=>!st[k].trim()).map(x=>x[1]);
      const er=$('err');
      if(miss.length){er.textContent='Add '+miss.join(', ')+' to continue.';er.hidden=false;return}
      st.step=2;draw();
    });
  }else if(st.step===2){
    title.textContent='Here’s how it’ll look';
    const item={id:'preview',kind:st.kind,name:st.name,cat:st.cat,sub:st.sub,desc:st.desc,meta:metaList(st.meta),contact:st.contact,preview:true,avatar:st.avatar&&st.avatar.url,banner:st.banner&&st.banner.url,photos:st.photos.map(p=>p.url),rating:null,reviewCount:0};
    stepEl.innerHTML=`<div class="preview-label">Preview</div><div style="pointer-events:none">${cardHTML(item)}</div>
      <label class="check" for="r-agree"><input type="checkbox" id="r-agree" ${st.agree?'checked':''}>I confirm these are real contact details and I understand the Board is a listings platform only. It doesn’t vet or endorse anyone’s product or service.</label>
      <p class="err" id="err2" role="alert" ${st.perr?'':'hidden'}>${esc(st.perr||'Tick the box to post your listing.')}</p>
      <div class="row-btns"><button class="btn ghost" type="button" id="back2">Edit</button><button class="btn pink" type="button" id="post">Post to the Board</button></div>`;
    $('back2').addEventListener('click',()=>{st.step=1;st.perr='';draw()});
    $('r-agree').addEventListener('change',e=>{st.agree=e.target.checked});
    $('post').addEventListener('click',async e=>{
      if(!st.agree){st.perr='';$('err2').textContent='Tick the box to post your listing.';$('err2').hidden=false;return}
      const done=busy(e.currentTarget,'Posting…');$('back2').disabled=true;
      try{
        st.result=await API.createListing({kind:st.kind,name:st.name.trim(),cat:st.cat,sub:st.sub||null,desc:st.desc.trim(),meta:metaList(st.meta),contact:st.contact.trim(),
          menu:st.kind==='services'?parseMenu(st.menu):[],policy:st.policy.trim()||null,avatarId:st.avatar?st.avatar.id:null,bannerId:st.banner?st.banner.id:null,photoIds:st.photos.map(p=>p.id)});
      }catch(err){
        done();$('back2').disabled=false;st.perr=errMsg(err);const er=$('err2');er.textContent=st.perr;er.hidden=false;return;
      }
      st.perr='';st.step=3;draw();
      /* show the new listing on the Board and refresh the counts */
      B.tab=st.kind;B.cat=null;B.sub=null;q.value='';loadListings();loadMeta();
    });
  }else{
    const r=st.result||{},pending=r.status==='pending';
    title.textContent=pending?'Sent for review':'You’re on the Board';
    stepEl.innerHTML=`<div class="done"><div class="big-pin" aria-hidden="true"></div>
      <p style="margin:0 0 6px;font-weight:700;font-size:18px">${esc(r.name||st.name)} ${pending?'is waiting for approval.':'is pinned.'}</p>
      <p style="margin:0;color:var(--muted)">${pending?'Once it has been approved it will show for every NTU student.':'Students can find it now.'}${API.isMock?' Demo: it is saved in this browser only.':''}</p>
      <div class="row-btns" style="justify-content:center"><button class="btn" type="button" id="see">${pending?'Done':'See my listing'}</button></div></div>`;
    $('see').addEventListener('click',()=>{closeSheet();if(pending)return;if($('browse'))$('browse').scrollIntoView({behavior:'smooth'});else location.href='index.html#browse'});
  }
  title.focus({preventScroll:true});
}
