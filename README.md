# Muhammed Mijdad — Portfolio

Live site: https://mijdad.github.io

Static site hosted on GitHub Pages. No build step: every file here is served as it is.

## Files

| Path | What it is |
|---|---|
| `index.html` | Home page: banner, what I do, newest 4 stores, plans, process, mentor, contact |
| `work.html` | All work page: every store |
| `store.html` | One page per store (`store.html?s=<slug>`): page screenshots and the live-site link |
| `data/site.json` | Projects list and the mentor switch |
| `assets/css/style.css` | All styles, in the same order as the page sections |
| `admin.html`, `assets/css/admin.css`, `assets/js/admin.js` | Admin panel for adding and editing stores |
| `assets/js/main.js` | Loads projects, builds WhatsApp messages, order summary, scroll animations |
| `assets/js/store.js` | Store page: page tabs, full-size viewer, next store |
| `assets/img/` | Photos, link-preview image, favicon |
| `assets/img/stores/<slug>/` | Page screenshots for each store |

## Add, edit or remove stores (admin panel)

Open **https://mijdad.github.io/admin.html** and sign in with a GitHub access token
(fine-grained, repository `mijdad.github.io`, permission **Contents: Read and write**).
The token is saved only in that browser.

- **Add store:** fill in the form, then add desktop screenshots in **Store pages**. Home, Collection and Product have fixed slots; **+ Add page** adds any other page (About, Contact…). Press **Publish**.
- **Location:** Country and State, shown as `India · Kerala` or `UAE · Dubai`.
- **Pages:** a page without a screenshot is hidden on the website. Screenshots are resized to 1500px wide and keep their own height.
- **View / Edit / Delete / ↑ ↓:** open the store page, change a store, remove it (its screenshots are removed too) or change the order.
- **Mentor switch:** shows or hides the TBM Ecommerce Academy line.

Each change is one commit. GitHub Pages updates the site in about 1–2 minutes.
The home page shows the 4 newest stores; **View all works** opens `work.html` with every store.
**View store** on a card opens that store's own page. The link to the live website appears only there.

### Editing `data/site.json` by hand

Stores are listed oldest first; the **last** one shows first on the site.

```json
{
  "slug": "brand-name",
  "name": "Brand Name",
  "url": "https://brand.com/",
  "category": "What they sell",
  "location": "India · Kerala",
  "description": "One short sentence about the store.",
  "color": "#E8DED2",
  "pages": [
    { "label": "Home", "image": "assets/img/stores/brand-name/home.webp" },
    { "label": "Collection", "image": "assets/img/stores/brand-name/collection.webp" },
    { "label": "Product", "image": "assets/img/stores/brand-name/product.webp" },
    { "label": "About", "image": "assets/img/stores/brand-name/about.webp" }
  ]
}
```

The Home screenshot is the card image. `color` is the tile colour shown if there is no Home screenshot.

## Hide the mentor line

Use the switch in the admin panel, or set `"showMentor": false` in `data/site.json`.

## After changing CSS or JS

Raise the `?v=` number on the CSS and JS links in the HTML files, so returning visitors get the new files.
