const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(fileBuffer);
  });
}

function resolvePath(requestUrl) {
  const safePath = decodeURIComponent(requestUrl.split("?")[0]);
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(PUBLIC_DIR, normalizedPath);
}

const server = http.createServer((request, response) => {
  const filePath = resolvePath(request.url || "/");

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(response, filePath);
      return;
    }

    if (!error && stats.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (indexError, indexStats) => {
        if (!indexError && indexStats.isFile()) {
          sendFile(response, indexPath);
          return;
        }

        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
      });
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
});

server.listen(PORT, () => {
  console.log(`MusicPicture server is running on http://localhost:${PORT}`);
});
