/* Applies the saved light/dark theme before the page draws (kept as a file so the security policy can block inline scripts). */
(function(){try{var t=localStorage.getItem('board-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();
