/* Muhammed Mijdad portfolio
   - Loads projects from data/site.json (newest = last in the list)
   - Cards link to store.html?s=<slug>
   - Order summary and pre-written WhatsApp messages
   - Scroll-in animations */
(function () {
  'use strict';

  var WHATSAPP = '919539399658';
  var PLANS = { store: 'the Shopify store plan', both: 'the Store + ads bundle', ads: 'the Meta ads plan' };
  var LINES = {
    store: ['Shopify store development', 'Design, build and launch'],
    ads: ['Meta ads management', 'Facebook & Instagram ads']
  };
  var PIN = '<svg class="icon icon-sm" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  var picked = { store: false, ads: false };

  /* ---------- Helpers ---------- */
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key === 'class') node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function domain(url) { return String(url).replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  function number(i) { return (i < 9 ? '0' : '') + (i + 1); }
  function waLink(text) { return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text); }

  /* ---------- WhatsApp links ---------- */
  function updateWhatsApp() {
    var need = picked.store && picked.ads ? 'a Shopify store and Meta ads'
      : picked.store ? 'a Shopify store'
      : picked.ads ? 'Meta ads'
      : 'working with you';
    var href = waLink('Hi Mijdad, I saw your portfolio. I am interested in ' + need + '. My brand is: ');
    $all('[data-wa]').forEach(function (a) { a.href = href; });
  }

  function setPlanLinks() {
    $all('[data-wa-plan]').forEach(function (a) {
      var plan = PLANS[a.getAttribute('data-wa-plan')];
      a.href = waLink('Hi Mijdad, I saw your portfolio. I would like ' + plan + '. My brand is: ');
    });
  }

  /* ---------- Order summary ---------- */
  function renderSummary() {
    var count = (picked.store ? 1 : 0) + (picked.ads ? 1 : 0);
    $all('[data-cart-count]').forEach(function (n) { n.textContent = count; });

    $all('[data-pick]').forEach(function (button) {
      var key = button.getAttribute('data-pick');
      var on = key === 'both' ? picked.store && picked.ads
        : key === 'store' ? picked.store && !picked.ads
        : picked.ads && !picked.store;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var empty = document.querySelector('[data-cart-empty]');
    var lines = document.querySelector('[data-cart-lines]');
    if (empty) empty.hidden = count > 0;
    if (lines) {
      lines.innerHTML = '';
      Object.keys(LINES).forEach(function (key) {
        if (!picked[key]) return;
        var remove = el('button', { type: 'button', class: 'mini', 'aria-label': 'Remove ' + LINES[key][0], text: 'Remove' });
        remove.addEventListener('click', function () { picked[key] = false; renderSummary(); });
        lines.appendChild(el('div', { class: 'line' }, [
          el('span', {}, [el('b', { text: LINES[key][0] }), el('small', { text: LINES[key][1] })]),
          remove
        ]));
      });
    }
    updateWhatsApp();
  }

  function bindSummary() {
    $all('[data-pick]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-pick');
        picked.store = key === 'store' || key === 'both';
        picked.ads = key === 'ads' || key === 'both';
        renderSummary();
      });
    });
    $all('[data-add]').forEach(function (button) {
      button.addEventListener('click', function () {
        picked[button.getAttribute('data-add')] = true;
        renderSummary();
      });
    });
  }

  /* ---------- Projects ---------- */
  function slugOf(p) {
    return p.slug || String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function coverOf(p) {
    var pages = (p.pages || []).filter(function (pg) { return pg && (pg.image || pg.mobile); });
    var home = pages.filter(function (pg) { return /^home$/i.test(pg.label || ''); })[0];
    var c = home || pages[0] || {};
    return c.image || c.mobile || p.image || '';
  }

  function projectCard(p, i) {
    var href = 'store.html?s=' + encodeURIComponent(slugOf(p));
    var cover = coverOf(p);
    var shot = el('a', { class: 'shot', href: href, 'aria-label': 'Open ' + p.name }, [
      el('div', { class: 'shot-bar' }, [el('i'), el('i'), el('i'), el('span', { text: domain(p.url) })])
    ]);
    if (cover) {
      shot.appendChild(el('img', { src: cover, alt: 'Homepage of ' + p.name, loading: 'lazy', width: '1500', height: '722' }));
    } else {
      var placeholder = el('div', { class: 'ph', text: p.name });
      placeholder.style.background = p.color || '#D9D4C5';
      shot.appendChild(placeholder);
    }
    shot.appendChild(el('span', { class: 'num', text: number(i) }));

    var location = null;
    if (p.location) {
      location = el('span', { class: 'loc' });
      location.innerHTML = PIN;
      location.appendChild(document.createTextNode(p.location));
    }

    var body = el('div', { class: 'card-body' }, [
      el('span', { class: 'cat', text: p.category || '' }),
      el('h3', { text: p.name }),
      el('p', { text: p.description || '' }),
      location
    ]);

    var view = el('a', { class: 'btn btn-dark', href: href, 'aria-label': 'View ' + p.name + ' store pages' });
    view.innerHTML = 'View store <span class="arr">→</span>';

    return el('article', { class: 'card reveal' }, [shot, body, view]);
  }

  function renderProjects(data) {
    var projects = (data.projects || []).slice().reverse();
    $all('[data-live-count]').forEach(function (n) { n.textContent = projects.length; });

    $all('[data-work-grid]').forEach(function (grid) {
      var limit = parseInt(grid.getAttribute('data-limit') || '0', 10);
      var before = grid.querySelector('.preorder');
      (limit ? projects.slice(0, limit) : projects).forEach(function (p, i) {
        grid.insertBefore(projectCard(p, i), before);
      });
    });

    if (data.showMentor === false) {
      var mentor = document.querySelector('[data-mentor]');
      if (mentor) mentor.remove();
    }
  }

  /* ---------- Scroll animations ---------- */
  function reveal() {
    var items = $all('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n, i) {
      n.style.transitionDelay = (i % 4) * 80 + 'ms';
      observer.observe(n);
    });
  }

  /* ---------- Start ---------- */
  $all('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
  setPlanLinks();
  bindSummary();
  renderSummary();

  fetch('data/site.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(renderProjects)
    .catch(function () { /* projects load once the site is online */ })
    .then(reveal);
})();
