/* Start-up. Everything else is defined in the other files. */
(async function boot(){
  if(!API.isMock){const n=$('demo-note');if(n)n.hidden=true}
  renderAuth();drawChrome();
  loadListings();loadMeta();loadTop();
  /* restore the session if there is a saved token */
  if(API.hasToken()){try{setUser(await API.me())}catch(_){}}
})();
