(function () {
  'use strict';
  var origin = 'https://rebuscandome.vercel.app';
  function openCheckout(code) {
    if (!code) return;
    var ref = new URLSearchParams(window.location.search).get('ref');
    var url = origin + '/checkout?code=' + encodeURIComponent(code);
    if (ref) url += '&ref=' + encodeURIComponent(ref);
    var backdrop = document.createElement('div');
    backdrop.setAttribute('data-rebus-checkout-modal', '');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(3,12,24,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);';
    var frame = document.createElement('iframe');
    frame.src = url;
    frame.title = 'Checkout Rebuscándome';
    frame.style.cssText = 'width:min(100%,760px);height:min(92vh,900px);border:0;border-radius:22px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35);';
    var close = document.createElement('button');
    close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','Cerrar checkout');
    close.style.cssText = 'position:absolute;top:12px;right:16px;width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#102038;font-size:28px;line-height:1;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.18);';
    function destroy(){ backdrop.remove(); document.documentElement.style.overflow=''; }
    close.addEventListener('click', destroy);
    backdrop.addEventListener('click', function(e){ if(e.target===backdrop) destroy(); });
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){destroy();document.removeEventListener('keydown',onKey);} });
    backdrop.appendChild(frame); backdrop.appendChild(close); document.body.appendChild(backdrop); document.documentElement.style.overflow='hidden';
  }
  function bind() {
    document.querySelectorAll('[data-rebus-checkout]').forEach(function (el) {
      if (el.getAttribute('data-rebus-bound') === '1') return;
      var code = el.getAttribute('data-rebus-checkout');
      el.setAttribute('data-rebus-bound','1');
      el.addEventListener('click', function(e){ e.preventDefault(); openCheckout(code); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.RebuscandomeCheckout = { open: openCheckout };
})();
