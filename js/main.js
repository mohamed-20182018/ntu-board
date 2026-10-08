/* Start-up. Everything else is defined in the other files. */
(async function boot(){
  if(!API.isMock){const n=$('demo-note');if(n)n.hidden=true}
  renderAuth();
  /* The arrow on the home page glides down to Browse with an eased scroll. It stops the moment
     the visitor scrolls themselves (wheel, touch or keys), so manual scrolling always wins. */
  const cue=$('scroll-cue');
  if(cue)cue.addEventListener('click',e=>{
    e.preventDefault();
    const target=$('browse'),pad=parseFloat(getComputedStyle(target).scrollMarginTop)||0;
    const to=Math.max(0,target.getBoundingClientRect().top+scrollY-pad),from=scrollY,dist=to-from;
    const done=()=>{history.replaceState(null,'','#browse');$('q').focus({preventScroll:true})};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(dist)<2){scrollTo({top:to,behavior:'instant'});done();return}
    const dur=Math.min(1400,Math.max(700,Math.abs(dist)*0.9)),ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    let start=null,stop=false;
    const cancel=()=>{stop=true};
    ['wheel','touchstart','keydown'].forEach(ev=>addEventListener(ev,cancel,{once:true,passive:true}));
    const step=ts=>{
      if(stop)return;
      if(start===null)start=ts;
      const t=Math.min(1,(ts-start)/dur);
      scrollTo({top:from+dist*ease(t),behavior:'instant'});
      if(t<1)requestAnimationFrame(step);else{['wheel','touchstart','keydown'].forEach(ev=>removeEventListener(ev,cancel));done()}
    };
    requestAnimationFrame(step);
  });
  if(onHome){
    /* links like index.html?cat=Hair#browse or ?tab=socs open the board pre-filtered */
    const p=new URLSearchParams(location.search);
    if(p.get('tab')&&LANES.some(l=>l.k===p.get('tab')))B.tab=p.get('tab');
    if(p.get('cat')&&TILES.includes(p.get('cat'))){B.tab='services';B.cat=p.get('cat')}
    drawChrome();loadListings();loadMeta();loadTop();
  }
  /* restore the session if there is a saved token */
  let restored=false;
  if(API.hasToken()){try{setUser(await API.me());restored=true}catch(_){}}
  if(!restored&&typeof initMessagesPage==='function')initMessagesPage();
  if(!restored&&typeof loadProfile==='function')loadProfile();
})();
