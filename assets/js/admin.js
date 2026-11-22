/* Portfolio admin
   Signs in with a GitHub token (kept only in this browser), edits data/site.json
   and uploads screenshots. Every save is one commit; GitHub Pages republishes the site. */
(function () {
  'use strict';

  var REPO = 'mijdad/mijdad.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + REPO;
  var DATA_PATH = 'data/site.json';
  var IMG_W = 1200, IMG_H = 750;
  var TOKEN_KEY = 'portfolio-admin-token';

  var token = null;
  var site = null;          // contents of data/site.json
  var editing = null;       // index in site.projects being edited, or null for new
  var newImage = null;      // { base64, ext } of a picked screenshot
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
  function unusedImages(before, after) {
    var still = after.projects.map(function (p) { return p.image; });
    return before.projects.map(function (p) { return p.image; }).filter(function (img) {
      return img && /^assets\/img\/work-/.test(img) && still.indexOf(img) < 0;
    });
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
    var thumb = p.image
      ? '<img src="' + (justUploaded[p.image] || encodeURI(p.image)) + '" alt="">'
      : '<span class="thumb-ph" style="background:' + (p.color || '#D9D4C5') + '"></span>';
    li.innerHTML =
      '<span class="pos">' + String(pos + 1).padStart(2, '0') + '</span>' +
      '<span class="thumb">' + thumb + '</span>' +
      '<span class="info"><b></b><small></small></span>' +
      '<span class="actions">' +
        '<button type="button" class="icon-btn" data-move="up" aria-label="Move up"' + (pos === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon-btn" data-move="down" aria-label="Move down"' + (pos === total - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-edit>Edit</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>' +
      '</span>';
    li.querySelector('b').textContent = p.name;
    li.querySelector('small').textContent = [p.category, p.location, domain(p.url)].filter(Boolean).join(' · ');

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
    newImage = null;
    form.reset();
    showError('store', '');
    var p = editing === null ? null : site.projects[editing];
    $('[data-form-title]').textContent = p ? 'Edit ' + p.name : 'Add store';
    $('[data-submit]').textContent = p ? 'Save changes' : 'Publish';
    if (p) {
      ['name', 'url', 'category', 'location', 'description'].forEach(function (k) { form[k].value = p[k] || ''; });
      form.color.value = p.color || '#E8DED2';
    }
    setPreview(p && p.image ? p.image : null);
    modal.hidden = false;
    form.name.focus();
  }

  function closeForm() { modal.hidden = true; }

  function setPreview(src) {
    var img = $('[data-preview]');
    img.hidden = !src;
    if (src) img.src = src;
    $('[data-drop-text]').textContent = src ? 'Click or drop to replace the screenshot' : 'Click or drop a desktop screenshot of the store’s homepage';
  }

  $('[data-action="new"]').addEventListener('click', function () { openForm(null); });
  $all('[data-action="close"]').forEach(function (b) { b.addEventListener('click', closeForm); });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeForm(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeForm(); });

  /* Screenshot: crop the top of the page to 16:10 and resize to 1200 × 750 */
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not an image.')); };
        img.onload = function () {
          var scale = IMG_W / img.naturalWidth;
          var cropH = Math.min(img.naturalHeight, IMG_H / scale);
          var canvas = document.createElement('canvas');
          canvas.width = IMG_W;
          canvas.height = IMG_H;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, IMG_W, IMG_H);
          ctx.drawImage(img, 0, 0, img.naturalWidth, cropH, 0, 0, IMG_W, cropH * scale);
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

  function pickFile(file) {
    if (!file) return;
    processImage(file).then(function (out) {
      newImage = out;
      setPreview(out.dataUrl);
    }).catch(function (err) { showError('store', err.message); });
  }

  form.image.addEventListener('change', function () { pickFile(form.image.files[0]); });
  var drop = $('[data-drop]');
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function () { drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    pickFile(e.dataTransfer.files[0]);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('store', '');
    var url = form.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    var data = {
      name: form.name.value.trim(),
      url: url,
      category: form.category.value.trim(),
      location: form.location.value.trim(),
      description: form.description.value.trim(),
      color: form.color.value
    };
    if (!data.name) return showError('store', 'Please add the store name.');
    try { new URL(data.url); } catch (err) { return showError('store', 'Please add a valid store link, like https://brand.com/'); }

    var original = editing === null ? null : site.projects[editing];
    var files = [];
    if (newImage) {
      var path = 'assets/img/work-' + slug(data.name) + '-' + Date.now().toString(36) + '.' + newImage.ext;
      files.push({ path: path, base64: newImage.base64 });
      justUploaded[path] = newImage.dataUrl;
      data.image = path;
    } else if (original && original.image) {
      data.image = original.image;
    }

    var button = $('[data-submit]');
    button.disabled = true;
    button.textContent = 'Publishing…';
    publish(function (s) {
      var project = {
        name: data.name, url: data.url, category: data.category, location: data.location,
        description: data.description, image: data.image || '', color: data.color
      };
      if (!project.image) delete project.image;
      if (original) {
        var at = s.projects.findIndex(function (x) { return x.url === original.url && x.name === original.name; });
        if (at > -1) s.projects[at] = project; else s.projects.push(project);
      } else {
        s.projects.push(project);
      }
    }, (original ? 'Update ' + data.name + ' in portfolio' : 'Add ' + data.name + ' to portfolio'), files).then(function (ok) {
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
