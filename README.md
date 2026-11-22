# Muhammed Mijdad — Portfolio

Live site: https://mijdad.github.io

Static site hosted on GitHub Pages. No build step: every file here is served as it is.

## Files

| Path | What it is |
|---|---|
| `index.html` | Home page: banner, what I do, newest 4 stores, plans, process, mentor, contact |
| `work.html` | All work page: every store |
| `data/site.json` | Projects list and the mentor switch |
| `assets/css/style.css` | All styles, in the same order as the page sections |
| `admin.html`, `assets/css/admin.css`, `assets/js/admin.js` | Admin panel for adding and editing stores |
| `assets/js/main.js` | Loads projects, builds WhatsApp messages, order summary, scroll animations |
| `assets/img/` | Photos, store screenshots, link-preview image, favicon |

## Add, edit or remove stores (admin panel)

Open **https://mijdad.github.io/admin.html** and sign in with a GitHub access token
(fine-grained, repository `mijdad.github.io`, permission **Contents: Read and write**).
The token is saved only in that browser.

- **Add store:** fill in the form, drop a homepage screenshot (auto-resized to 1200 × 750), press **Publish**.
- **Edit / Delete / ↑ ↓:** change a store, remove it (its screenshot is removed too) or change the order.
- **Mentor switch:** shows or hides the TBM Ecommerce Academy line.

Each change is one commit. GitHub Pages updates the site in about 1–2 minutes.
The home page shows the 4 newest stores; **View all works** opens `work.html` with every store.

### Editing `data/site.json` by hand

Stores are listed oldest first; the **last** one shows first on the site.

```json
{
  "name": "Brand Name",
  "url": "https://brand.com/",
  "category": "What they sell",
  "location": "City, State",
  "description": "One short sentence about the store.",
  "image": "assets/img/work-brand.webp",
  "color": "#E8DED2"
}
```

`color` is the tile colour shown if there is no screenshot.

## Hide the mentor line

Use the switch in the admin panel, or set `"showMentor": false` in `data/site.json`.

## After changing CSS or JS

Raise the `?v=` number on the `style.css` and `main.js` links in both HTML files, so returning visitors get the new files.
