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
| `assets/js/main.js` | Loads projects, builds WhatsApp messages, order summary, scroll animations |
| `assets/img/` | Photos, store screenshots, link-preview image, favicon |

## Add a new store

1. Upload a homepage screenshot (wide, about 1200 px) to `assets/img/`, for example `work-brand.webp`.
2. In `data/site.json`, add a block at the **end** of `projects` (the last one shows first on the site):

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

`color` is the tile colour shown if the screenshot is missing. Keep the commas between blocks.

The home page shows the 4 newest stores. **View all works** opens `work.html` with every store.

## Hide the mentor line

In `data/site.json`, set `"showMentor": false`.

## After changing CSS or JS

Raise the `?v=` number on the `style.css` and `main.js` links in both HTML files, so returning visitors get the new files.
