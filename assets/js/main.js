/* Muhammed Mijdad portfolio: projects, cart, WhatsApp message, scroll animations.
   Projects and the mentor switch live in data/site.json, edited through Pages CMS (app.pagescms.org). */
(function () {
  'use strict';

  var WHATSAPP = '919539399658';
  var cart = { store: false, ads: false };

  /* ---------- helpers ---------- */
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function domain(url) { return String(url).replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  function pad(i) { return (i < 9 ? '0' : '') + (i + 1); }
  var pinSvg = '<svg class="icon" style="width:14px;height:14px" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  /* ---------- WhatsApp link ---------- */
  function waMessage() {
    var need = cart.store && cart.ads ? 'a Shopify store and Meta ads'
      : cart.store ? 'a Shopify store' : cart.ads ? 'Meta ads' : 'working with you';
    return 'Hi Muhammed, I saw your portfolio. I am interested in ' + need + '. My brand is: ';
  }
  function updateWa() {
    var href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(waMessage());
    $all('[data-wa]').forEach(function (a) { a.href = href; });
  }

  /* ---------- cart ---------- */
  function renderCart() {
    var count = (cart.store ? 1 : 0) + (cart.ads ? 1 : 0);
    $all('[data-cart-count]').forEach(function (n) { n.textContent = count; });
    $all('.cart').forEach(function (a) { a.setAttribute('aria-label', 'Cart, ' + count + ' service(s) selected'); });

    $all('[data-pick]').forEach(function (b) {
      var k = b.getAttribute('data-pick');
      var on = k === 'both' ? (cart.store && cart.ads) : k === 'store' ? (cart.store && !cart.ads) : (cart.ads && !cart.store);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $all('[data-toggle]').forEach(function (b) {
      var k = b.getAttribute('data-toggle');
      var on = k === 'both' ? (cart.store && cart.ads) : cart[k];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Added to cart ✓' : 'Add to cart';
    });

    var empty = document.querySelector('[data-cart-empty]');
    var lines = document.querySelector('[data-cart-lines]');
    if (empty) empty.hidden = count > 0;
    if (lines) {
      lines.innerHTML = '';
      [['store', 'Shopify store development', 'Design, build and launch'], ['ads', 'Meta ads management', 'Facebook & Instagram ads']].forEach(function (l) {
        if (!cart[l[0]]) return;
        var rm = el('button', { type: 'button', class: 'mini', 'aria-label': 'Remove ' + l[1], text: 'Remove' });
        rm.addEventListener('click', function () { cart[l[0]] = false; renderCart(); });
        lines.appendChild(el('div', { class: 'line' }, [el('span', {}, [el('b', { text: l[1] }), el('small', { text: l[2] })]), rm]));
      });
    }
    updateWa();
  }
  function bindCart() {
    $all('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-pick');
        cart.store = k === 'store' || k === 'both';
        cart.ads = k === 'ads' || k === 'both';
        renderCart();
      });
    });
    $all('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-toggle');
        if (k === 'both') { var on = cart.store && cart.ads; cart.store = !on; cart.ads = !on; }
        else cart[k] = !cart[k];
        renderCart();
      });
    });
    $all('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () { cart[b.getAttribute('data-add')] = true; renderCart(); });
    });
  }

  /* ---------- projects ---------- */
  function card(p, i) {
    var shot = el('div', { class: 'shot' }, [
      el('div', { class: 'shot-bar' }, [el('i'), el('i'), el('i'), el('span', { text: domain(p.url) })])
    ]);
    if (p.image) {
      shot.appendChild(el('img', { src: String(p.image).replace(/^\//, ''), alt: 'Homepage of ' + p.name, loading: 'lazy', width: '1200', height: '750' }));
    } else {
      var ph = el('div', { class: 'ph', text: p.name });
      ph.style.background = p.color || '#D9D4C5';
      shot.appendChild(ph);
    }
    shot.appendChild(el('span', { class: 'num', text: pad(i) }));

    var loc = el('span', { class: 'loc' });
    loc.innerHTML = pinSvg;
    loc.appendChild(document.createTextNode(p.location || ''));

    var body = el('div', { class: 'card-body' }, [
      el('span', { class: 'cat', text: p.category || '' }),
      el('h3', { text: p.name }),
      el('p', { text: p.description || '' }),
      p.location ? loc : null
    ]);
    var go = el('a', { class: 'btn btn-dark', href: p.url, target: '_blank', rel: 'noopener' });
    go.innerHTML = 'View live store <span class="arr">↗</span>';
    go.setAttribute('aria-label', 'View ' + p.name + ' live store (opens in a new tab)');
    return el('article', { class: 'card reveal' }, [shot, body, go]);
  }

  function renderProjects(data) {
    // Newest project = the last one added in the editor, so show the list in reverse.
    var projects = ((data && data.projects) || []).slice().reverse();
    $all('[data-live-count]').forEach(function (n) { n.textContent = projects.length; });

    $all('[data-work-grid]').forEach(function (grid) {
      var limit = parseInt(grid.getAttribute('data-limit') || '0', 10);
      var list = limit ? projects.slice(0, limit) : projects;
      var before = grid.querySelector('.preorder');
      list.forEach(function (p, i) { grid.insertBefore(card(p, i), before); });
    });

    if (projects[0] && projects[0].image) {
      var hi = document.querySelector('[data-hero-img]'), hd = document.querySelector('[data-hero-domain]');
      if (hi) hi.src = String(projects[0].image).replace(/^\//, '');
      if (hd) hd.textContent = domain(projects[0].url);
    }
    var viewAll = document.querySelector('[data-view-all]');
    if (viewAll) viewAll.hidden = projects.length <= 4;

    var brands = document.querySelector('[data-brands]');
    if (brands) projects.forEach(function (p) {
      var dot = el('i'); dot.style.background = p.color || '#D9D4C5';
      var a = el('a', { class: 'brand-chip', href: p.url, target: '_blank', rel: 'noopener' }, [dot]);
      a.appendChild(document.createTextNode(p.name));
      brands.appendChild(a);
    });

    var mentor = document.querySelector('[data-mentor]');
    if (mentor && data && data.showMentor === false) mentor.remove();
  }

  /* ---------- scroll animations ---------- */
  function reveal() {
    var items = $all('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n, i) { n.style.transitionDelay = Math.min(i % 4, 3) * 80 + 'ms'; io.observe(n); });
  }

  /* ---------- start ---------- */
  $all('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
  bindCart();
  renderCart();
  fetch('data/site.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(renderProjects)
    .catch(function () { /* opened as a local file: projects load once the site is online */ })
    .then(function () { updateWa(); reveal(); });
})();
