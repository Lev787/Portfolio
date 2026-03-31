const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const RECORDS_PATH = path.join(DATA_DIR, "records.json");
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/records") {
      await handleRecordsApi(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, async () => {
  await ensureRecordsFile();
  console.log(`Pixel Puzzle server running at http://localhost:${PORT}`);
});

async function handleRecordsApi(request, response) {
  await ensureRecordsFile();

  if (request.method === "GET") {
    const records = await readRecords();
    sendJson(response, 200, { records });
    return;
  }

  if (request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const record = normalizeRecord(payload);
      const records = sortRecords([...(await readRecords()), record]);
      await writeRecords(records);
      sendJson(response, 200, { records });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid record payload" });
    }
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function serveStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.resolve(ROOT, `.${safePath}`);

  if (resolvedPath !== ROOT && !resolvedPath.startsWith(`${ROOT}${path.sep}`)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    throw error;
  }
}

async function ensureRecordsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(RECORDS_PATH);
  } catch (error) {
    await fs.writeFile(RECORDS_PATH, "[]\n", "utf8");
  }
}

async function readRecords() {
  const raw = await fs.readFile(RECORDS_PATH, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return Array.isArray(parsed) ? sortRecords(parsed) : [];
}

async function writeRecords(records) {
  await fs.writeFile(RECORDS_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function normalizeRecord(payload) {
  const name = String(payload?.name || "Player").trim().slice(0, 24) || "Player";
  const timeMs = Number(payload?.timeMs);
  const difficulty = Number(payload?.difficulty);
  const shape = String(payload?.shape || "Squares").slice(0, 24);
  const imageLabel = String(payload?.imageLabel || "Uploaded image").slice(0, 80);
  const completedAt = String(payload?.completedAt || new Date().toISOString());

  if (!Number.isFinite(timeMs) || timeMs <= 0) {
    throw new Error("Invalid time");
  }

  if (!Number.isInteger(difficulty) || difficulty < 2 || difficulty > 20) {
    throw new Error("Invalid difficulty");
  }

  return {
    name,
    timeMs: Math.round(timeMs),
    difficulty,
    shape,
    imageLabel,
    completedAt,
  };
}

function sortRecords(records) {
  return [...records]
    .filter((record) => Number.isFinite(Number(record.timeMs)))
    .sort((left, right) => Number(left.timeMs) - Number(right.timeMs))
    .slice(0, 20);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
