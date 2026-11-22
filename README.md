# Muhammed Mijdad — Portfolio

Live at: https://mijdad.github.io

## Add a new project (no code)

1. **Upload the screenshot:** open the `assets/img` folder on GitHub → **Add file → Upload files** → drop your image (a wide homepage screenshot, about 1200 px wide; name it like `work-brandname.webp` or `.jpg`) → **Commit changes**.
2. **Add the project details:** open `data/site.json` → click the ✏️ pencil → copy one project block (from `{` to `},`) and paste it **at the top of the list** (newest first). Change the details:

```json
{
  "name": "Brand Name",
  "url": "https://brand.com/",
  "category": "What they sell",
  "location": "City, State",
  "description": "One short sentence about the store.",
  "image": "assets/img/work-brandname.webp",
  "color": "#E8DED2"
},
```

3. Click **Commit changes**. The site updates in 1–2 minutes.

- The home page shows the 4 newest projects. The **View all works** button appears automatically when you have more than 4.
- Every comma and quote matters in `site.json`. If projects disappear after an edit, a comma is missing or extra.

## Hide the mentor line

In `data/site.json`, change `"showMentor": true` to `"showMentor": false`.

## Files

- `index.html` — home page
- `work.html` — All work page
- `data/site.json` — your projects and settings
- `assets/css/style.css` — design
- `assets/js/main.js` — cart, WhatsApp message, animations
- `assets/img/` — photos and screenshots
