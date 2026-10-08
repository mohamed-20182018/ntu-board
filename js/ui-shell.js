/* Site chrome shared by every page: header, footer, the register sheet and the toast.
   Each page has <header id="site-header"> and <footer id="site-footer"> and sets <body data-page="...">. */
(function(){
  const page=document.body.dataset.page||'home';
  const cur=p=>page===p?' aria-current="page"':'';
  const ARROW='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  document.getElementById('site-header').outerHTML=`<header class="bar" id="site-header">
  <div class="wrap">
    <div class="pill">
      <a class="logo" href="index.html"><span class="pin" aria-hidden="true"></span>the Board</a>
      <nav class="nav" id="nav" aria-label="Main">
        <a class="l" href="index.html#browse"${cur('home')}>Browse</a>
        <a class="l" href="how-it-works.html"${cur('how')}>How it works</a>
        <a class="l" href="messages.html" id="open-msg"${cur('messages')}>Messages<span class="mbadge" id="msg-badge" hidden></span></a>
        <button class="l navbtn" type="button" id="open-dash" hidden>Dashboard</button>
        <span class="authnav" id="auth-nav"></span>
        <button class="btn pink listbtn" type="button" data-open-register>List a business</button>
      </nav>
      <button class="menu-t" type="button" id="menu-t" aria-expanded="false" aria-controls="nav" aria-label="Menu">${ARROW}</button>
    </div>
  </div>
</header>`;

  document.getElementById('site-footer').outerHTML=`<footer id="site-footer">
  <div class="wrap">
    <div class="notice" id="demo-note"><span class="pin" aria-hidden="true"></span><div><strong>This is a demo.</strong> Every listing here is an example and nothing is live yet. Try signing up, messaging a business or listing your own.</div></div>
    <div class="fcols">
      <div class="fbrand"><a class="logo" href="index.html"><span class="pin" aria-hidden="true"></span>the Board</a><p>Student businesses, societies and official notices at NTU, in one place. Made by NTU students.</p></div>
      <nav aria-label="Find things"><h3>Find</h3><a href="index.html#browse">Browse everything</a><a href="index.html?cat=Hair#browse">Hair</a><a href="index.html?cat=Food#browse">Food</a><a href="index.html?cat=Tutoring#browse">Tutoring</a><a href="index.html?tab=socs#browse">Societies</a></nav>
      <nav aria-label="For businesses"><h3>For businesses</h3><button class="flink" type="button" data-open-register>List your business</button><a href="how-it-works.html#businesses">How listing works</a><a href="how-it-works.html#reviews">How reviews work</a></nav>
      <nav aria-label="Help"><h3>Help</h3><a href="how-it-works.html">How it works</a><a href="how-it-works.html#safety">Staying safe</a><a href="how-it-works.html#faq">Questions</a><a href="mailto:hello@theboard.example">Contact us</a></nav>
    </div>
    <div class="flegal"><small>The Board is a listings platform. We don't vet, endorse, or take responsibility for anyone's product or service. Not an official NTU or NTSU service.</small><small>&copy; ${new Date().getFullYear()} the Board</small></div>
    <div class="big" aria-hidden="true">the Board</div>
  </div>
</footer>
<div class="overlay" id="overlay" hidden>
  <div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-head">
      <h2 id="sheet-title" tabindex="-1">Register</h2>
      <button class="x" id="close" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="progress" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div id="step"></div>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>`;

  /* mobile menu */
  const t=document.getElementById('menu-t'),nav=document.getElementById('nav');
  t.addEventListener('click',()=>{const o=nav.classList.toggle('open');t.setAttribute('aria-expanded',o)});
  nav.addEventListener('click',e=>{if(e.target.closest('a,button')&&nav.classList.contains('open')){nav.classList.remove('open');t.setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');t.setAttribute('aria-expanded','false');t.focus()}});
})();
