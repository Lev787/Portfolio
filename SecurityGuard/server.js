const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function respond(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      const statusCode = error.code === "ENOENT" ? 404 : 500;
      const message =
        statusCode === 404
          ? "File not found."
          : "Internal server error while reading the file.";

      respond(res, statusCode, message, "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    respond(res, 200, data, contentType);
  });
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const targetPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(path.join(PUBLIC_DIR, targetPath));

  if (!safePath.startsWith(PUBLIC_DIR)) {
    respond(res, 403, "Access denied.", "text/plain; charset=utf-8");
    return;
  }

  fs.stat(safePath, (error, stats) => {
    if (error) {
      respond(res, 404, "Page not found.", "text/plain; charset=utf-8");
      return;
    }

    if (stats.isDirectory()) {
      serveFile(path.join(safePath, "index.html"), res);
      return;
    }

    serveFile(safePath, res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Security Guard is running at http://${HOST}:${PORT}`);
});
