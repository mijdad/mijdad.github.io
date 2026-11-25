/* Store page: store.html?s=<slug>
   - Shows one store from data/site.json with its page screenshots
   - Home, Collection and Product come first; pages without a screenshot are hidden
   - The live-site link appears only here */
(function () {
  'use strict';

  var PIN = '<svg class="icon icon-sm" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var MAIN = [/^home/i, /^collection/i, /^product/i];

  function $(sel) { return document.querySelector(sel); }
  function slugOf(p) {
    return p.slug || String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function domain(url) { return String(url).replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function orderPages(pages) {
    var list = (pages || []).filter(function (pg) { return pg && pg.image; });
    var rank = function (pg) {
      for (var i = 0; i < MAIN.length; i++) if (MAIN[i].test(pg.label || '')) return i;
      return MAIN.length;
    };
    return list
      .map(function (pg, i) { return { pg: pg, r: rank(pg), i: i }; })
      .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
      .map(function (x) { return x.pg; });
  }

  function notFound() {
    $('[data-store-name]').textContent = 'Store not found';
    $('[data-store-cat]').textContent = 'Oops';
    $('[data-store-missing]').hidden = false;
  }

  function render(data) {
    var slug = new URLSearchParams(location.search).get('s') || '';
    var projects = data.projects || [];
    var index = -1;
    projects.forEach(function (p, i) { if (slugOf(p) === slug) index = i; });
    if (index < 0) return notFound();

    var p = projects[index];
    var pages = orderPages(p.pages);

    document.title = p.name + ' — Muhammed Mijdad';
    $('[data-store-cat]').textContent = p.category || 'Shopify store';
    $('[data-store-name]').textContent = p.name;
    $('[data-store-desc]').textContent = p.description || '';
    $('[data-store-count]').textContent = pages.length + (pages.length === 1 ? ' page' : ' pages');

    if (p.location) {
      var loc = $('[data-store-loc]');
      loc.innerHTML = PIN;
      loc.appendChild(document.createTextNode(p.location));
      loc.hidden = false;
    }
    if (p.url) {
      var visit = $('[data-store-visit]');
      visit.href = p.url;
      visit.setAttribute('aria-label', 'Visit the live ' + p.name + ' website (opens in a new tab)');
      visit.hidden = false;
    }

    // Next store (newest first, wraps around)
    if (projects.length > 1) {
      var nextP = projects[(index - 1 + projects.length) % projects.length];
      var next = $('[data-store-next]');
      next.innerHTML = '';
      var a = document.createElement('a');
      a.href = 'store.html?s=' + encodeURIComponent(slugOf(nextP));
      a.innerHTML = '<span>Next store</span><b></b><span class="arr">→</span>';
      a.querySelector('b').textContent = nextP.name;
      next.appendChild(a);
      next.hidden = false;
    }

    if (!pages.length) return;
    $('[data-store-view]').hidden = false;
    viewer(p, pages);
  }

  function viewer(p, pages) {
    var tabs = $('[data-page-tabs]');
    var img = $('[data-frame-img]');
    var current = 0;

    pages.forEach(function (pg, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = pg.label || 'Page ' + (i + 1);
      b.addEventListener('click', function () { show(i); });
      tabs.appendChild(b);
    });

    // Warm the cache so switching tabs is instant
    pages.forEach(function (pg) { var im = new Image(); im.src = pg.image; });

    function show(i) {
      current = (i + pages.length) % pages.length;
      var pg = pages[current];
      img.src = pg.image;
      img.onload = function () {
        $('.frame-zoom').textContent = img.naturalHeight / img.naturalWidth > 0.6 ? 'Click to see the full page' : 'Click to enlarge';
      };
      img.alt = (pg.label || 'Page') + ' page of ' + p.name;
      $('[data-frame-url]').textContent = domain(p.url || '') + '  ·  ' + (pg.label || '');
      $('[data-frame-label]').textContent = pg.label || '';
      $('[data-frame-pos]').textContent = pad(current + 1) + ' / ' + pad(pages.length);
      Array.prototype.forEach.call(tabs.children, function (t, k) {
        t.setAttribute('aria-selected', k === current ? 'true' : 'false');
      });
      var multi = pages.length > 1;
      $('[data-frame-prev]').hidden = !multi;
      $('[data-frame-next]').hidden = !multi;
    }

    $('[data-frame-prev]').addEventListener('click', function () { show(current - 1); });
    $('[data-frame-next]').addEventListener('click', function () { show(current + 1); });

    // Lightbox
    var lb = $('[data-lightbox]');
    var lbImg = $('[data-lb-img]');
    function openLb() {
      lbImg.src = pages[current].image;
      lbImg.alt = img.alt;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      $('[data-lb-close]').focus();
    }
    function closeLb() {
      lb.hidden = true;
      document.body.style.overflow = '';
      $('[data-frame-open]').focus();
    }
    $('[data-frame-open]').addEventListener('click', openLb);
    $('[data-lb-close]').addEventListener('click', closeLb);
    $('[data-lb-close-area]').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.hidden) {
        if (e.key === 'Escape') closeLb();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          show(current + (e.key === 'ArrowLeft' ? -1 : 1));
          lbImg.src = pages[current].image;
        }
        return;
      }
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    show(0);
  }

  fetch('data/site.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(notFound);
})();
