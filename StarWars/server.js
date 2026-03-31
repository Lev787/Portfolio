const http = require("node:http");
const { promises: fs } = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const API_BASE = "https://starwars-databank-server.onrender.com/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

const CATEGORY_CONFIG = [
  {
    key: "characters",
    label: "Characters",
    blurb: "Commanders, legends, rogues, and unforgettable faces from the saga.",
    limit: 6,
  },
  {
    key: "droids",
    label: "Droids",
    blurb: "Mechanical minds, battlefield units, and our custom hover-art droids.",
    limit: 6,
  },
  {
    key: "vehicles",
    label: "Vehicles",
    blurb: "Speed demons, walkers, and warships built for galactic spectacle.",
    limit: 6,
  },
];

const CUSTOM_DROID_ART = [
  { src: "./assets/droids/holo-scout.svg", codename: "Holo Scout" },
  { src: "./assets/droids/forge-mech.svg", codename: "Forge Mech" },
  { src: "./assets/droids/pulse-repair.svg", codename: "Pulse Repair" },
  { src: "./assets/droids/orbit-sentinel.svg", codename: "Orbit Sentinel" },
  { src: "./assets/droids/nebula-navigator.svg", codename: "Nebula Navigator" },
];

const APP_FEATURES = [
  {
    id: "search-radar",
    title: "Search Radar",
    copy: "Instantly scan the live archive by name, lore, or category tags.",
  },
  {
    id: "category-warp",
    title: "Category Warp",
    copy: "Jump between characters, droids, and vehicles with one click.",
  },
  {
    id: "favorite-vault",
    title: "Favorite Vault",
    copy: "Save the best cards in local storage and filter down to your shortlist.",
  },
  {
    id: "hyperspace-surprise",
    title: "Hyperspace Surprise",
    copy: "Highlight a random record from the active signal set.",
  },
  {
    id: "droid-override",
    title: "Droid Override",
    copy: "Hover the first five droid cards to swap in original custom illustrations.",
  },
];

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const cache = {
  data: null,
  expiresAt: 0,
  promise: null,
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function isSubPath(targetPath, rootPath) {
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}${path.sep}`);
}

function createSummary(text, limit = 175) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "No databank description is available for this record yet.";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  const trimmed = normalized.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, Math.max(lastSpace, 110)).trim()}...`;
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), MIME_TYPES[".json"]);
}

function normalizeItem(rawItem, category, index) {
  const description = String(rawItem.description || "").trim();
  const customArt = category.key === "droids" ? CUSTOM_DROID_ART[index] || null : null;

  return {
    id: `${category.key}-${rawItem._id || index}`,
    name: String(rawItem.name || "Unknown record").trim(),
    description: description || "No databank description is available for this record yet.",
    summary: createSummary(description),
    image: String(rawItem.image || "").trim(),
    category: category.key,
    categoryLabel: category.label,
    hoverImage: customArt ? customArt.src : null,
    hoverLabel: customArt ? customArt.codename : null,
    hasCustomSwap: Boolean(customArt),
  };
}

async function fetchCategory(category) {
  const url = new URL(`${API_BASE}/${category.key}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(category.limit));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${category.key} with status ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.data) ? payload.data.map((item, idx) => normalizeItem(item, category, idx)) : [];

  return {
    key: category.key,
    label: category.label,
    blurb: category.blurb,
    count: items.length,
    items,
  };
}

async function buildCatalog() {
  const categories = await Promise.all(CATEGORY_CONFIG.map(fetchCategory));

  return {
    fetchedAt: new Date().toISOString(),
    stale: false,
    apiBase: API_BASE,
    features: APP_FEATURES,
    categories: categories.map(({ items, ...meta }) => meta),
    items: categories.flatMap((category) => category.items),
  };
}

async function getCatalog() {
  const now = Date.now();

  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = buildCatalog()
    .then((data) => {
      cache.data = data;
      cache.expiresAt = Date.now() + CACHE_TTL_MS;
      return data;
    })
    .catch((error) => {
      if (cache.data) {
        return {
          ...cache.data,
          stale: true,
          notice: "Live API is slow right now, so the app is showing the latest cached records.",
        };
      }
      throw error;
    })
    .finally(() => {
      cache.promise = null;
    });

  return cache.promise;
}

async function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const decodedPath = decodeURIComponent(requestPath);
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, decodedPath));

  if (!isSubPath(absolutePath, PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(absolutePath);
    const filePath = stats.isDirectory() ? path.join(absolutePath, "index.html") : absolutePath;
    const contents = await fs.readFile(filePath);
    send(res, 200, contents, getMimeType(filePath));
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    send(res, 400, "Bad request");
    return;
  }

  if (req.url.startsWith("/api/catalog")) {
    try {
      const catalog = await getCatalog();
      sendJson(res, 200, catalog);
    } catch (error) {
      sendJson(res, 502, {
        message: "Unable to load the Star Wars Databank feed right now.",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.url.startsWith("/api/health")) {
    sendJson(res, 200, { ok: true, now: new Date().toISOString() });
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Star Wars app ready at http://${HOST}:${PORT}`);
});
