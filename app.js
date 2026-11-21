/* GrocerX — PWA helper
   Service worker register, install button, update notice, offline notice, app shortcuts */
(function () {
  'use strict';

  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var DISMISS_KEY = 'gx-install-dismissed';
  var DISMISS_DAYS = 7;

  /* ---------- styles ---------- */
  var st = document.createElement('style');
  st.textContent =
    '.gx-pwa{position:fixed;left:50%;z-index:4000;width:calc(100% - 28px);max-width:402px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#0d2d1a;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.28);transform:translate(-50%,30px);opacity:0;pointer-events:none;transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .4s ease;font-family:inherit;}' +
    '.gx-pwa.show{transform:translate(-50%,0);opacity:1;pointer-events:auto;}' +
    '.gx-pwa.bottom{bottom:calc(92px + env(safe-area-inset-bottom,0px));}' +
    '.gx-pwa.top{top:calc(12px + env(safe-area-inset-top,0px));transform:translate(-50%,-30px);}' +
    '.gx-pwa.top.show{transform:translate(-50%,0);}' +
    '.gx-pwa img{width:42px;height:42px;border-radius:12px;object-fit:contain;background:#fff;flex-shrink:0;}' +
    '.gx-pwa .t{flex:1;min-width:0;font-size:13px;font-weight:800;line-height:1.3;}' +
    '.gx-pwa .t small{display:block;font-size:11px;font-weight:600;opacity:.75;margin-top:1px;}' +
    '.gx-pwa button{border:none;border-radius:12px;padding:9px 16px;font-size:13px;font-weight:900;font-family:inherit;background:linear-gradient(135deg,#38ef9d,#2a9d6a);color:#06301b;}' +
    '.gx-pwa button.x{background:none;color:#fff;opacity:.6;padding:6px 8px;font-size:16px;}';
  document.head.appendChild(st);

  function banner(pos, html) {
    var el = document.createElement('div');
    el.className = 'gx-pwa ' + pos;
    el.innerHTML = html;
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });
    return el;
  }
  function hide(el) {
    if (!el) return;
    el.classList.remove('show');
    setTimeout(function () { el.remove(); }, 500);
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  /* ---------- service worker + update notice ---------- */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; } // pehli install par prompt nahi
      if (reloading) return;
      var b = banner('top',
        '<img src="images/icon-192.png" alt="">' +
        '<div class="t">New version ready ✨<small>Refresh karke update lo</small></div>' +
        '<button id="gx-refresh">Refresh</button>');
      b.querySelector('#gx-refresh').onclick = function () { reloading = true; location.reload(); };
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        // app khula rahe to bhi har 30 min mein update check
        setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      }).catch(function () {});
    });
  }

  /* ---------- install button (Android / Chrome / Edge / Brave) ---------- */
  var deferred = null, installBar = null;

  function recentlyDismissed() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return t && (Date.now() - t) < DISMISS_DAYS * 864e5;
    } catch (e) { return false; }
  }
  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    hide(installBar);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (isStandalone || recentlyDismissed()) return;
    // login page / splash ke baad thoda ruk ke dikhao
    setTimeout(function () {
      if (!deferred || installBar) return;
      installBar = banner('bottom',
        '<img src="images/icon-192.png" alt="">' +
        '<div class="t">Install GrocerX<small>Home screen par app ki tarah chalao</small></div>' +
        '<button id="gx-install">Install</button><button class="x" id="gx-x" aria-label="Close">✕</button>');
      installBar.querySelector('#gx-install').onclick = window.installGrocerX;
      installBar.querySelector('#gx-x').onclick = dismiss;
    }, 4000);
  });

  // Kahin bhi button se call kar sakte ho: onclick="installGrocerX()"
  window.installGrocerX = function () {
    if (!deferred) { toast('📲 Browser menu → Add to Home screen'); return; }
    deferred.prompt();
    deferred.userChoice.then(function (r) {
      deferred = null;
      hide(installBar);
      if (r && r.outcome === 'accepted') toast('✅ GrocerX installed!');
    });
  };

  window.addEventListener('appinstalled', function () {
    deferred = null;
    hide(installBar);
  });

  /* ---------- iPhone Safari: manual "Add to Home Screen" hint ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  if (isIOS && isSafari && !isStandalone && !recentlyDismissed()) {
    setTimeout(function () {
      installBar = banner('bottom',
        '<img src="images/icon-192.png" alt="">' +
        '<div class="t">Install GrocerX<small>Share ⬆️ dabao → "Add to Home Screen"</small></div>' +
        '<button class="x" id="gx-x" aria-label="Close">✕</button>');
      installBar.querySelector('#gx-x').onclick = dismiss;
    }, 6000);
  }

  /* ---------- online / offline ---------- */
  window.addEventListener('offline', function () { toast('📵 Internet band hai'); });
  window.addEventListener('online', function () { toast('✅ Back online'); });

  /* ---------- app shortcuts (long-press icon): ?go=cart | print | profile ---------- */
  window.addEventListener('load', function () {
    var go = new URLSearchParams(location.search).get('go');
    if (go && ['cart', 'print', 'profile', 'products'].indexOf(go) > -1 && typeof window.showPage === 'function') {
      try { window.showPage(go); } catch (e) {}
    }
  });
})();
