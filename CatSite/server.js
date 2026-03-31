const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const CAT_API_URL = "https://api.thecatapi.com/v1/breeds";
const CACHE_TTL_MS = 1000 * 60 * 15;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

const cache = {
  payload: null,
  timestamp: 0
};

function parseLifeSpan(rangeText) {
  const values = String(rangeText || "")
    .split("-")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite);

  if (values.length === 0) {
    return { min: null, max: null, average: null };
  }

  if (values.length === 1) {
    return { min: values[0], max: values[0], average: values[0] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    min,
    max,
    average: Number(((min + max) / 2).toFixed(1))
  };
}

function normalizeBreed(breed, index) {
  const lifeSpan = parseLifeSpan(breed.life_span);
  const temperamentList = String(breed.temperament || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: breed.id || `breed-${index}`,
    name: breed.name || "Unknown Breed",
    altNames: breed.alt_names || "",
    origin: breed.origin || "Unknown",
    countryCode: breed.country_code || "",
    description: breed.description || "No description provided.",
    temperament: breed.temperament || "Unknown",
    temperamentList,
    lifeSpan: breed.life_span || "Unknown",
    lifeSpanMin: lifeSpan.min,
    lifeSpanMax: lifeSpan.max,
    lifeSpanAverage: lifeSpan.average,
    weightMetric: breed.weight?.metric || "Unknown",
    intelligence: Number(breed.intelligence || 0),
    affectionLevel: Number(breed.affection_level || 0),
    energyLevel: Number(breed.energy_level || 0),
    adaptability: Number(breed.adaptability || 0),
    childFriendly: Number(breed.child_friendly || 0),
    dogFriendly: Number(breed.dog_friendly || 0),
    hypoallergenic: Boolean(breed.hypoallergenic),
    rare: Boolean(breed.rare),
    indoor: Number(breed.indoor || 0),
    wikipediaUrl: breed.wikipedia_url || "",
    imageUrl: breed.image?.url || ""
  };
}

async function fetchCats(forceRefresh = false) {
  const cacheAge = Date.now() - cache.timestamp;

  if (!forceRefresh && cache.payload && cacheAge < CACHE_TTL_MS) {
    return cache.payload;
  }

  const headers = {
    Accept: "application/json"
  };

  if (process.env.CAT_API_KEY) {
    headers["x-api-key"] = process.env.CAT_API_KEY;
  }

  const response = await fetch(CAT_API_URL, { headers });

  if (!response.ok) {
    throw new Error(`The Cat API responded with ${response.status}.`);
  }

  const rawBreeds = await response.json();
  const referenceIds = [...new Set(rawBreeds.map((breed) => breed.reference_image_id).filter(Boolean))];
  const imageEntries = await Promise.all(
    referenceIds.map(async (referenceId) => {
      try {
        const imageResponse = await fetch(`https://api.thecatapi.com/v1/images/${referenceId}`, { headers });

        if (!imageResponse.ok) {
          return [referenceId, ""];
        }

        const imagePayload = await imageResponse.json();
        return [referenceId, imagePayload.url || ""];
      } catch (error) {
        return [referenceId, ""];
      }
    })
  );
  const imageByReferenceId = Object.fromEntries(imageEntries);
  const payload = rawBreeds
    .map((breed) => ({
      ...breed,
      image: {
        url: imageByReferenceId[breed.reference_image_id] || ""
      }
    }))
    .filter((breed) => breed.image?.url)
    .map(normalizeBreed)
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));

  cache.payload = payload;
  cache.timestamp = Date.now();

  return payload;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(body);
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(error.code === "ENOENT" ? "Not Found" : "Internal Server Error");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(buffer);
  });
}

function resolveStaticFile(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const normalized = path.posix.normalize(decodedPath);
  const relativePath = normalized === "/" ? "index.html" : normalized.replace(/^\/+/, "");
  const absolutePath = path.resolve(path.join(PUBLIC_DIR, relativePath));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/cats") {
    const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

    try {
      const cats = await fetchCats(forceRefresh);
      sendJson(response, 200, {
        cats,
        source: "The Cat API",
        stale: false,
        updatedAt: new Date(cache.timestamp).toISOString()
      });
    } catch (error) {
      if (cache.payload) {
        sendJson(response, 200, {
          cats: cache.payload,
          source: "The Cat API (cached)",
          stale: true,
          updatedAt: new Date(cache.timestamp).toISOString(),
          warning: error.message
        });
        return;
      }

      sendJson(response, 502, {
        error: "Unable to load cats from The Cat API right now.",
        details: error.message
      });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  const filePath = resolveStaticFile(requestUrl.pathname);

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  sendFile(response, filePath);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Cat Atlas is running on http://localhost:${PORT}`);
});
