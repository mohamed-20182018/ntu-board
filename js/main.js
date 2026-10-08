/* Start-up. Everything else is defined in the other files. */
(async function boot(){
  if(!API.isMock){const n=$('demo-note');if(n)n.hidden=true}
  renderAuth();
  /* the arrow on the home page glides down to Browse; normal scrolling still works as usual */
  document.querySelectorAll('.hero a[href="#browse"]').forEach(cue=>cue.addEventListener('click',e=>{e.preventDefault();const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;$('browse').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});history.replaceState(null,'','#browse');setTimeout(()=>{$('q').focus({preventScroll:true})},reduce?0:700)}));
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
