# Cat Atlas

Cat Atlas is a small Node.js web application that fetches cat breed data from [The Cat API](https://thecatapi.com/) and presents it as stylish, interactive cards.

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

Optional: if you have a personal API key, you can run the server with `CAT_API_KEY=your_key`.

## Run on GitHub Pages

This project can also run as a fully static app on GitHub Pages.

- The browser fetches breed data and images directly from The Cat API.
- The default frontend config uses `DEMO-API-KEY`.
- For better reliability, replace the key in [public/config.js](C:/Users/kuritsa/Documents/htmlcssjs/CatSite/public/config.js) with your own free API key from [The Cat API signup page](https://thecatapi.com/signup).
- The app stores the latest loaded payload in `localStorage` for 12 hours to reduce repeated API calls.

## Included features

1. Live search by breed, origin, and description.
2. Origin filter.
3. Temperament filter.
4. Sorting by breed name, intelligence, affection, energy, and life span.
5. Favorite cats with local persistence.
6. Favorites-only mode.
7. Theme switch.
8. Layout switch.
9. Surprise spotlight button.
10. Detailed modal window for every card.
11. Hover art swap with 5 custom illustrated cats.

## Tech

- Node.js built-in HTTP server
- Vanilla HTML, CSS, and JavaScript
- The Cat API as the external data source

## Hosting options

- GitHub Pages: use the static frontend in `public/`.
- Node hosting: `server.js` is still available if you want to run the same project with a small Node.js server.
