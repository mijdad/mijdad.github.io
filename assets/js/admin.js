/* Portfolio admin
   Signs in with a GitHub token (kept only in this browser), edits data/site.json
   and uploads screenshots. Every save is one commit; GitHub Pages republishes the site. */
(function () {
  'use strict';

  var REPO = 'mijdad/mijdad.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + REPO;
  var DATA_PATH = 'data/site.json';
  var IMG_W = 1500, MOBILE_W = 430, IMG_MAX_H = 16000;   // page screenshots keep their own height
  var MAIN_PAGES = ['Home', 'Collection', 'Product'];
  var TOKEN_KEY = 'portfolio-admin-token';

  var token = null;
  var site = null;          // contents of data/site.json
  var editing = null;       // index in site.projects being edited, or null for new
  var draft = [];           // pages in the form: { label, fixed, d: slot, m: slot }
  var justUploaded = {};    // image path -> preview, until GitHub Pages has published it

  /* ---------- Helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function storage(action, value) {
    try {
      if (action === 'get') return localStorage.getItem(TOKEN_KEY);
      if (action === 'set') localStorage.setItem(TOKEN_KEY, value);
      if (action === 'clear') localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode: token lasts for this visit only */ }
    return null;
  }

  function toast(text, kind) {
    var t = $('[data-toast]');
    t.textContent = text;
    t.className = 'toast' + (kind ? ' toast-' + kind : '');
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, kind === 'error' ? 8000 : 6000);
  }

  function showError(name, text) {
    var e = $('[data-error="' + name + '"]');
    e.textContent = text || '';
    e.hidden = !text;
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'store';
  }

  function domain(url) { return String(url).replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    var bin = atob(b64.replace(/\n/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- GitHub API ---------- */
  function gh(path, options) {
    options = options || {};
    return fetch(API + path, {
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      if (res.ok) return res.status === 204 ? null : res.json();
      return res.json().catch(function () { return {}; }).then(function (body) {
        var err = new Error(body.message || ('GitHub error ' + res.status));
        err.status = res.status;
        throw err;
      });
    });
  }

  function loadSite() {
    return gh('/contents/' + DATA_PATH + '?ref=' + BRANCH).then(function (file) {
      site = JSON.parse(base64ToUtf8(file.content));
      site.projects = site.projects || [];
    });
  }

  /* One commit: files to write ([{ path, text }] or [{ path, base64 }]) and paths to delete */
  function commit(files, message, removals) {
    var baseCommit;
    return gh('/git/ref/heads/' + BRANCH)
      .then(function (ref) { return gh('/git/commits/' + ref.object.sha); })
      .then(function (c) {
        baseCommit = c;
        return Promise.all(files.map(function (f) {
          return gh('/git/blobs', { method: 'POST', body: f.base64 !== undefined
            ? { content: f.base64, encoding: 'base64' }
            : { content: utf8ToBase64(f.text), encoding: 'base64' } })
            .then(function (blob) { return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha }; });
        })).then(function (tree) {
          return tree.concat((removals || []).map(function (path) { return { path: path, mode: '100644', type: 'blob', sha: null }; }));
        });
      })
      .then(function (tree) { return gh('/git/trees', { method: 'POST', body: { base_tree: baseCommit.tree.sha, tree: tree } }); })
      .then(function (tree) { return gh('/git/commits', { method: 'POST', body: { message: message, tree: tree.sha, parents: [baseCommit.sha] } }); })
      .then(function (c) { return gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: c.sha } }); });
  }

  /* Screenshots we uploaded that no store uses any more */
  function imagesOf(data) {
    var out = [];
    data.projects.forEach(function (p) {
      if (p.image) out.push(p.image);
      (p.pages || []).forEach(function (pg) { if (pg.image) out.push(pg.image); if (pg.mobile) out.push(pg.mobile); });
    });
    return out;
  }

  function unusedImages(before, after) {
    var still = imagesOf(after);
    return imagesOf(before).filter(function (img, i, all) {
      return /^assets\/img\/(work-|stores\/)/.test(img) && still.indexOf(img) < 0 && all.indexOf(img) === i;
    });
  }

  function slugOf(p) { return p.slug || slug(p.name); }

  function coverOf(p) {
    var pages = (p.pages || []).filter(function (pg) { return pg.image || pg.mobile; });
    var home = pages.filter(function (pg) { return /^home$/i.test(pg.label || ''); })[0];
    var c = home || pages[0] || {};
    return c.image || c.mobile || p.image || '';
  }

  /* Re-read the latest data, apply a change, and publish it in one commit. Resolves true on success. */
  function publish(change, message, extraFiles) {
    return loadSite().then(function () {
      var before = JSON.parse(JSON.stringify(site));
      change(site);
      var json = JSON.stringify(site, null, 2) + '\n';
      return commit((extraFiles || []).concat([{ path: DATA_PATH, text: json }]), message, unusedImages(before, site));
    }).then(function () {
      render();
      toast('Published. Your site updates in about 1–2 minutes.', 'ok');
      return true;
    }).catch(function (err) {
      toast(friendly(err), 'error');
      return loadSite().then(render).catch(function () {}).then(function () { return false; });
    });
  }

  function friendly(err) {
    if (err.status === 401) return 'Your token is not valid any more. Sign out and sign in with a new one.';
    if (err.status === 403 || err.status === 404) return 'This token cannot change the portfolio. Check it has Contents: Read and write for mijdad.github.io.';
    if (err.status === 409 || err.status === 422) return 'The site changed while you were saving. Please try again.';
    return 'Could not publish: ' + err.message;
  }

  /* ---------- Sign in / out ---------- */
  function setSignedIn(on) {
    $all('[data-when="in"]').forEach(function (n) { n.hidden = !on; });
    $all('[data-when="out"]').forEach(function (n) { n.hidden = on; });
  }

  function signIn(value) {
    token = value;
    return gh('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        var e = new Error('no write access'); e.status = 403; throw e;
      }
      return loadSite();
    }).then(function () {
      storage('set', token);
      setSignedIn(true);
      render();
    });
  }

  $('[data-form="signin"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = e.target.token.value.trim();
    var button = e.target.querySelector('button');
    showError('signin', '');
    button.disabled = true;
    button.textContent = 'Checking…';
    signIn(value).catch(function (err) {
      token = null;
      showError('signin', err.status === 401 ? 'That token was not accepted. Check you copied all of it.' : friendly(err));
    }).then(function () {
      button.disabled = false;
      button.textContent = 'Sign in';
    });
  });

  $('[data-action="logout"]').addEventListener('click', function () {
    storage('clear');
    token = null;
    site = null;
    setSignedIn(false);
  });

  /* ---------- Store list ---------- */
  function render() {
    var list = $('[data-list]');
    var projects = site.projects;
    list.innerHTML = '';
    $('[data-count]').textContent = projects.length;
    $('[data-mentor]').checked = site.showMentor !== false;

    if (!projects.length) {
      list.innerHTML = '<li class="empty">No stores yet. Click “Add store” to add your first one.</li>';
      return;
    }

    /* Newest (last in the file) first, same as the website */
    for (var pos = 0; pos < projects.length; pos++) {
      var index = projects.length - 1 - pos;
      list.appendChild(storeRow(projects[index], index, pos, projects.length));
    }
  }

  function storeRow(p, index, pos, total) {
    var li = document.createElement('li');
    li.className = 'store';
    var cover = coverOf(p);
    var thumb = cover
      ? '<img src="' + (justUploaded[cover] || encodeURI(cover)) + '" alt="">'
      : '<span class="thumb-ph" style="background:' + (p.color || '#D9D4C5') + '"></span>';
    li.innerHTML =
      '<span class="pos">' + String(pos + 1).padStart(2, '0') + '</span>' +
      '<span class="thumb">' + thumb + '</span>' +
      '<span class="info"><b></b><small></small></span>' +
      '<span class="actions">' +
        '<button type="button" class="icon-btn" data-move="up" aria-label="Move up"' + (pos === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon-btn" data-move="down" aria-label="Move down"' + (pos === total - 1 ? ' disabled' : '') + '>↓</button>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" data-view>View</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-edit>Edit</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>' +
      '</span>';
    li.querySelector('b').textContent = p.name;
    var shown = (p.pages || []).filter(function (pg) { return pg.image || pg.mobile; }).length;
    li.querySelector('small').textContent = [p.category, p.location, shown + (shown === 1 ? ' page' : ' pages')].filter(Boolean).join(' · ');
    li.querySelector('[data-view]').href = 'store.html?s=' + encodeURIComponent(slugOf(p));

    li.querySelector('[data-edit]').addEventListener('click', function () { openForm(index); });
    li.querySelector('[data-delete]').addEventListener('click', function () {
      if (!window.confirm('Delete “' + p.name + '” from your portfolio?')) return;
      publish(function (s) {
        var at = s.projects.findIndex(function (x) { return x.url === p.url && x.name === p.name; });
        if (at > -1) s.projects.splice(at, 1);
      }, 'Remove ' + p.name + ' from portfolio');
    });
    li.querySelectorAll('[data-move]').forEach(function (b) {
      b.addEventListener('click', function () {
        /* "up" on screen = later in the file */
        var step = b.getAttribute('data-move') === 'up' ? 1 : -1;
        publish(function (s) {
          var at = s.projects.findIndex(function (x) { return x.url === p.url && x.name === p.name; });
          var to = at + step;
          if (at < 0 || to < 0 || to >= s.projects.length) return;
          var item = s.projects.splice(at, 1)[0];
          s.projects.splice(to, 0, item);
        }, 'Reorder portfolio: ' + p.name);
      });
    });
    return li;
  }

  $('[data-mentor]').addEventListener('change', function (e) {
    var on = e.target.checked;
    publish(function (s) { s.showMentor = on; }, (on ? 'Show' : 'Hide') + ' mentor line');
  });

  /* ---------- Add / edit form ---------- */
  var form = $('[data-form="store"]');
  var modal = $('[data-modal]');

  function openForm(index) {
    editing = typeof index === 'number' ? index : null;
    form.reset();
    showError('store', '');
    var p = editing === null ? null : site.projects[editing];
    $('[data-form-title]').textContent = p ? 'Edit ' + p.name : 'Add store';
    $('[data-submit]').textContent = p ? 'Save changes' : 'Publish';
    if (p) {
      ['name', 'url', 'category', 'description'].forEach(function (k) { form[k].value = p[k] || ''; });
      var loc = splitLocation(p.location);
      form.country.value = loc[0];
      form.state.value = loc[1];
      form.color.value = p.color || '#E8DED2';
    }
    draft = buildDraft(p);
    renderPages();
    modal.hidden = false;
    form.name.focus();
  }

  function closeForm() { modal.hidden = true; }

  /* "India · Kerala" -> ["India", "Kerala"]; older "Kochi, Kerala" -> ["", "Kochi, Kerala"] */
  function splitLocation(text) {
    text = String(text || '');
    var at = text.indexOf(' · ');
    return at > -1 ? [text.slice(0, at).trim(), text.slice(at + 3).trim()] : ['', text.trim()];
  }

  function joinLocation(country, state) {
    return [country.trim(), state.trim()].filter(Boolean).join(' · ');
  }

  function isMain(label) {
    return MAIN_PAGES.some(function (m) { return m.toLowerCase() === String(label || '').trim().toLowerCase(); });
  }

  /* Home, Collection and Product always have a slot; other pages follow in their saved order.
     Each page has a desktop (d) and a mobile (m) screenshot: { image: saved path, upload: picked file } */
  function slotOf(path) { return { image: path || '', upload: null }; }
  function hasShot(slot) { return !!(slot.upload || slot.image); }
  function srcOf(slot) {
    return slot.upload ? slot.upload.dataUrl : (slot.image ? (justUploaded[slot.image] || encodeURI(slot.image)) : '');
  }

  function buildDraft(p) {
    var pages = (p && p.pages) || [];
    if (p && !pages.length && p.image) pages = [{ label: 'Home', image: p.image }];
    var out = MAIN_PAGES.map(function (label) {
      var found = pages.filter(function (pg) { return String(pg.label || '').toLowerCase() === label.toLowerCase(); })[0] || {};
      return { label: label, fixed: true, d: slotOf(found.image), m: slotOf(found.mobile) };
    });
    pages.forEach(function (pg) {
      if (!isMain(pg.label)) out.push({ label: pg.label || '', fixed: false, d: slotOf(pg.image), m: slotOf(pg.mobile) });
    });
    return out;
  }

  function shotHtml(kind, slot) {
    var src = srcOf(slot);
    return '<div class="shot-slot shot-' + kind + '">' +
      '<label class="page-shot" title="Click or drop a ' + (kind === 'd' ? 'desktop' : 'mobile') + ' screenshot">' +
        '<input type="file" accept="image/*" data-kind="' + kind + '">' +
        (src ? '<img alt="" data-src-kind="' + kind + '">' : '<span>' + (kind === 'd' ? '+ Desktop' : '+') + '</span>') +
      '</label>' +
      (src ? '<button type="button" class="slot-x" data-clear="' + kind + '" aria-label="Remove ' + (kind === 'd' ? 'desktop' : 'mobile') + ' screenshot">✕</button>' : '') +
      '<small>' + (kind === 'd' ? 'Desktop' : 'Mobile') + '</small>' +
    '</div>';
  }

  function renderPages() {
    var list = $('[data-pages]');
    list.innerHTML = '';
    var firstExtra = MAIN_PAGES.length;
    draft.forEach(function (pg, i) {
      var li = document.createElement('li');
      li.className = 'page-row' + (pg.fixed ? ' page-main' : '');
      li.innerHTML =
        shotHtml('d', pg.d) + shotHtml('m', pg.m) +
        '<div class="page-info">' +
          (pg.fixed ? '<b></b>' : '<input class="page-label" maxlength="30" placeholder="Page name, e.g. About">') +
          '<small class="page-status"></small>' +
        '</div>' +
        '<div class="page-actions">' +
          (pg.fixed ? '' :
            '<button type="button" class="icon-btn" data-page-move="-1" aria-label="Move up"' + (i === firstExtra ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="icon-btn" data-page-move="1" aria-label="Move down"' + (i === draft.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="icon-btn icon-danger" data-page-remove aria-label="Remove page">✕</button>') +
        '</div>';

      li.querySelectorAll('img[data-src-kind]').forEach(function (img) { img.src = srcOf(pg[img.getAttribute('data-src-kind')]); });
      if (pg.fixed) li.querySelector('b').textContent = pg.label;
      else {
        var input = li.querySelector('.page-label');
        input.value = pg.label;
        input.addEventListener('input', function () { pg.label = input.value; });
      }
      var parts = [];
      if (hasShot(pg.d)) parts.push('desktop');
      if (hasShot(pg.m)) parts.push('mobile');
      li.querySelector('.page-status').textContent = parts.length
        ? 'Shown on the website: ' + parts.join(' + ') + (pg.d.upload || pg.m.upload ? ' (uploads on save)' : '')
        : 'Hidden until a screenshot is added';

      li.querySelectorAll('.page-shot').forEach(function (shot) {
        var file = shot.querySelector('input');
        var kind = file.getAttribute('data-kind');
        file.addEventListener('change', function () { pickPage(pg, kind, file.files[0]); });
        ['dragenter', 'dragover'].forEach(function (t) {
          shot.addEventListener(t, function (e) { e.preventDefault(); shot.classList.add('over'); });
        });
        ['dragleave', 'drop'].forEach(function (t) {
          shot.addEventListener(t, function () { shot.classList.remove('over'); });
        });
        shot.addEventListener('drop', function (e) { e.preventDefault(); pickPage(pg, kind, e.dataTransfer.files[0]); });
      });
      li.querySelectorAll('[data-clear]').forEach(function (b) {
        b.addEventListener('click', function () { pg[b.getAttribute('data-clear')] = slotOf(''); renderPages(); });
      });

      var remove = li.querySelector('[data-page-remove]');
      if (remove) remove.addEventListener('click', function () { draft.splice(i, 1); renderPages(); });
      li.querySelectorAll('[data-page-move]').forEach(function (b) {
        b.addEventListener('click', function () {
          var to = i + parseInt(b.getAttribute('data-page-move'), 10);
          if (to < firstExtra || to >= draft.length) return;
          var item = draft.splice(i, 1)[0];
          draft.splice(to, 0, item);
          renderPages();
        });
      });
      list.appendChild(li);
    });
  }

  function pickPage(pg, kind, file) {
    if (!file) return;
    showError('store', '');
    processImage(file, kind === 'm' ? MOBILE_W : IMG_W).then(function (out) {
      pg[kind].upload = out;
      renderPages();
    }).catch(function (err) { showError('store', err.message); });
  }

  $('[data-add-page]').addEventListener('click', function () {
    draft.push({ label: '', fixed: false, d: slotOf(''), m: slotOf('') });
    renderPages();
    var inputs = $all('.page-label');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('[data-action="new"]').addEventListener('click', function () { openForm(null); });
  $all('[data-action="close"]').forEach(function (b) { b.addEventListener('click', closeForm); });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeForm(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeForm(); });

  /* Screenshot: resize (desktop 1500px, mobile 430px wide) and keep its own height */
  function processImage(file, maxW) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type || '')) return reject(new Error('That file is not an image.'));
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not an image.')); };
        img.onload = function () {
          var scale = Math.min(1, (maxW || IMG_W) / img.naturalWidth);
          var w = Math.round(img.naturalWidth * scale);
          var h = Math.min(Math.round(img.naturalHeight * scale), IMG_MAX_H);
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, img.naturalWidth, h / scale, 0, 0, w, h);
          var webp = canvas.toDataURL('image/webp', 0.82);
          var isWebp = webp.indexOf('data:image/webp') === 0;
          var url = isWebp ? webp : canvas.toDataURL('image/jpeg', 0.85);
          resolve({ dataUrl: url, base64: url.split(',')[1], ext: isWebp ? 'webp' : 'jpg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function uniqueSlug(name, original) {
    if (original && original.slug) return original.slug;
    var base = slug(name), out = base, n = 2;
    var taken = site.projects.filter(function (x) { return x !== original; }).map(slugOf);
    while (taken.indexOf(out) > -1) out = base + '-' + n++;
    return out;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('store', '');
    var url = form.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    var name = form.name.value.trim();
    if (!name) return showError('store', 'Please add the store name.');
    try { new URL(url); } catch (err) { return showError('store', 'Please add a valid store link, like https://brand.com/'); }

    var labels = [];
    for (var i = 0; i < draft.length; i++) {
      var pg = draft[i];
      var label = String(pg.label || '').trim();
      var has = hasShot(pg.d) || hasShot(pg.m);
      if (!pg.fixed && has && !label) return showError('store', 'Please name every page you added a screenshot for.');
      if (has && label) {
        if (labels.indexOf(label.toLowerCase()) > -1) return showError('store', 'Two pages are called “' + label + '”. Please rename one.');
        labels.push(label.toLowerCase());
      }
    }

    var original = editing === null ? null : site.projects[editing];
    var storeSlug = uniqueSlug(name, original);
    var stamp = Date.now().toString(36);
    var files = [];
    var pages = [];
    function save(slot, label, suffix) {
      if (!slot.upload) return slot.image;
      var path = 'assets/img/stores/' + storeSlug + '/' + slug(label) + suffix + '-' + stamp + '.' + slot.upload.ext;
      files.push({ path: path, base64: slot.upload.base64 });
      justUploaded[path] = slot.upload.dataUrl;
      return path;
    }
    draft.forEach(function (pg) {
      var label = String(pg.label || '').trim();
      if (!label || !(hasShot(pg.d) || hasShot(pg.m))) return;
      var page = { label: label };
      var desktop = save(pg.d, label, '');
      var mobile = save(pg.m, label, '-mobile');
      if (desktop) page.image = desktop;
      if (mobile) page.mobile = mobile;
      pages.push(page);
    });

    var project = {
      slug: storeSlug,
      name: name,
      url: url,
      category: form.category.value.trim(),
      location: joinLocation(form.country.value, form.state.value),
      description: form.description.value.trim(),
      color: form.color.value,
      pages: pages
    };

    var button = $('[data-submit]');
    button.disabled = true;
    button.textContent = 'Publishing…';
    publish(function (s) {
      if (original) {
        var at = s.projects.findIndex(function (x) { return x.url === original.url && x.name === original.name; });
        if (at > -1) s.projects[at] = project; else s.projects.push(project);
      } else {
        s.projects.push(project);
      }
    }, (original ? 'Update ' + name + ' in portfolio' : 'Add ' + name + ' to portfolio'), files).then(function (ok) {
      button.disabled = false;
      button.textContent = original ? 'Save changes' : 'Publish';
      if (ok) closeForm();
    });
  });

  /* ---------- Start ---------- */
  var saved = storage('get');
  if (saved) {
    signIn(saved).catch(function () {
      token = null;
      storage('clear');
      setSignedIn(false);
    });
  } else {
    setSignedIn(false);
  }
})();
