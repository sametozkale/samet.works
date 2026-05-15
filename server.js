// server.js
//
// Simple Express server that:
// 1.  On each visit, looks up the visitor's IP → location via ipapi.co
// 2.  Reads the "previous" location from lastVisitor.json
// 3.  Sends back the previous location, then overwrites lastVisitor.json with current
// 4.  Serves your static files (index.html, mues-ai.html, etc.)

require("dotenv").config();
const express = require("express");
const compression = require("compression");
const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
// Node.js 18+ has built-in fetch, no need for node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Compression middleware (gzip/brotli)
app.use(compression({
  level: 6, // Compression level (1-9, 6 is a good balance)
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all text-based content
    return compression.filter(req, res);
  }
}));
const STORAGE_FILE = path.join(__dirname, "lastVisitor.json");
// Use /tmp for Lambda environments (read-only filesystem), otherwise use __dirname
const isLambda = __dirname.startsWith('/var/task') || process.env.LAMBDA_TASK_ROOT;
const RESOURCES_FILE = isLambda 
  ? path.join('/tmp', 'resources.json') 
  : path.join(__dirname, "resources.json");
const WRITINGS_FILE = isLambda 
  ? path.join('/tmp', 'writings.json') 
  : path.join(__dirname, "writings.json");

// Middleware for parsing JSON bodies
app.use(express.json());

// ============================================
// API ROUTES - Must be registered FIRST
// ============================================

// Helper function to read resources file (handles Lambda read-only filesystem)
async function readResourcesFile() {
  const sourceFile = path.join(__dirname, "resources.json");
  
  // If using /tmp (Lambda), check if file exists there, otherwise copy from source
  if (isLambda) {
    try {
      // Try reading from /tmp first
      const data = await fs.readFile(RESOURCES_FILE, "utf8");
      if (data && data.trim()) {
        return JSON.parse(data);
      }
    } catch (err) {
      // /tmp file doesn't exist, try to copy from source
      try {
        const sourceData = await fs.readFile(sourceFile, "utf8");
        await fs.writeFile(RESOURCES_FILE, sourceData, "utf8");
        return JSON.parse(sourceData);
      } catch (copyErr) {
        // Source file also doesn't exist or can't be read, return empty array
        console.log("Could not read or copy resources file, using empty array");
        return [];
      }
    }
  } else {
    // Normal environment, read from __dirname
    try {
      const data = await fs.readFile(RESOURCES_FILE, "utf8");
      if (data && data.trim()) {
        return JSON.parse(data);
      }
    } catch (err) {
      return [];
    }
  }
  return [];
}

// Helper function to read writings file (handles Lambda read-only filesystem)
async function readWritingsFile() {
  const sourceFile = path.join(__dirname, "writings.json");
  
  // If using /tmp (Lambda), check if file exists there, otherwise copy from source
  if (isLambda) {
    try {
      // Try reading from /tmp first
      const data = await fs.readFile(WRITINGS_FILE, "utf8");
      if (data && data.trim()) {
        return JSON.parse(data);
      }
    } catch (err) {
      // /tmp file doesn't exist, try to copy from source
      try {
        const sourceData = await fs.readFile(sourceFile, "utf8");
        await fs.writeFile(WRITINGS_FILE, sourceData, "utf8");
        return JSON.parse(sourceData);
      } catch (copyErr) {
        // Source file also doesn't exist or can't be read, return empty array
        console.log("Could not read or copy writings file, using empty array");
        return [];
      }
    }
  } else {
    // Normal environment, read from __dirname
    try {
      const data = await fs.readFile(WRITINGS_FILE, "utf8");
      if (data && data.trim()) {
        return JSON.parse(data);
      }
    } catch (err) {
      return [];
    }
  }
  return [];
}

// Resources API - GET all resources
app.get("/api/resources", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300");
    const resources = await readResourcesFile();
    res.json(resources);
  } catch (err) {
    console.error("Error reading resources:", err.message);
    res.status(500).json({ error: "Failed to load resources" });
  }
});

// Last location API
app.get("/api/last-location", async (req, res) => {
  try {
    // 1) Read the previous visitor's location from disk (if it exists).
    let previous = { city: "unknown", region: "", country_name: "" };
    try {
      const data = await fs.readFile(STORAGE_FILE, "utf8");
      previous = JSON.parse(data);
    } catch (err) {
      // If file doesn't exist, we'll just return "unknown"
    }

    // 2) Get the requester's IP. In a production environment behind a load
    //    balancer or reverse proxy, you may need req.headers["x-forwarded-for"]
    const visitorIp = req.headers["x-forwarded-for"] || req.ip;
    // 3) Call ipapi.co to look up the location for that IP
    const response = await fetch(`https://ipapi.co/${visitorIp}/json/`);
    const current = await response.json();
    // 4) Store the "current" visitor's location as JSON for next time
    await fs.writeFile(STORAGE_FILE, JSON.stringify(current), "utf8");

    // 5) Return the "previous" location to the client
    res.json(previous);
  } catch (err) {
    console.error("Error in /api/last-location:", err);
    res.status(500).json({ city: "unknown", region: "", country_name: "" });
  }
});

// Writings API - GET all writings from JSON file
app.get("/api/writings", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300");
    const writings = await readWritingsFile();
    
    // Sort by date descending (most recent first)
    const sortedWritings = [...writings].sort((a, b) => {
      const dateA = new Date(a.date || '1970-01-01');
      const dateB = new Date(b.date || '1970-01-01');
      return dateB - dateA;
    });
    
    // Return only title and url (remove date field)
    const writingsToReturn = sortedWritings.map(({ title, url }) => ({ title, url }));
    
    res.json(writingsToReturn);
  } catch (error) {
    console.error("Error in /api/writings:", error);
    res.status(500).json({ error: "Failed to load writings" });
  }
});

// GitHub contributions API — daily cached proxy to a public service
let ghContribCache = { ts: 0, data: null, contributions: null };
const GH_CONTRIB_TTL_MS = 24 * 60 * 60 * 1000;
const GH_USERNAME = "sametozkale";
const GH_CONTRIB_YEAR = new Date().getFullYear();

function computeGithubStats(contributions) {
  // Expecting array of { date: "YYYY-MM-DD", count: number }
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  let total = 0;
  let todayCount = 0;
  const byDate = new Map();
  for (const c of contributions) {
    total += c.count || 0;
    byDate.set(c.date, c.count || 0);
    if (c.date === todayKey) todayCount = c.count || 0;
  }

  // Streak: count back from today (or yesterday if today is empty) while count > 0
  let streak = 0;
  const cursor = new Date(today);
  // If today is empty, allow streak to start from yesterday so an active streak
  // doesn't appear broken before the user commits today.
  if ((byDate.get(todayKey) || 0) === 0) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const count = byDate.get(key) || 0;
    if (count > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { total, todayCount, streak };
}

const GH_GRID_COLS = 12;
const GH_GRID_ROWS = 10;

function mapContributionCell({ count, level }) {
  if (!count) return 0;
  if (level <= 1) return 1;
  if (level === 2) return 2;
  return 3;
}

function buildContributionGrid(contributions) {
  const size = GH_GRID_COLS * GH_GRID_ROWS;
  const todayKey = new Date().toISOString().slice(0, 10);
  const elapsed = contributions.filter((c) => c.date && c.date <= todayKey);
  const tail = elapsed.slice(-size);
  while (tail.length < size) tail.unshift({ count: 0, level: 0 });
  const grid = [];
  for (let col = 0; col < GH_GRID_COLS; col += 1) {
    for (let row = 0; row < GH_GRID_ROWS; row += 1) {
      grid.push(mapContributionCell(tail[col * GH_GRID_ROWS + row]));
    }
  }
  return grid;
}

function ensureGithubPayload(data, contributions) {
  const out = { ...data };
  if (
    !Array.isArray(out.grid) ||
    out.grid.length !== GH_GRID_COLS * GH_GRID_ROWS
  ) {
    out.grid = buildContributionGrid(contributions || []);
  }
  return out;
}

app.get("/api/github-contributions", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  const now = Date.now();

  if (
    ghContribCache.data &&
    now - ghContribCache.ts < GH_CONTRIB_TTL_MS &&
    Array.isArray(ghContribCache.data.grid) &&
    ghContribCache.data.grid.length === GH_GRID_COLS * GH_GRID_ROWS
  ) {
    return res.json(ghContribCache.data);
  }

  try {
    const upstream = `https://github-contributions-api.jogruber.de/v4/${GH_USERNAME}?y=${GH_CONTRIB_YEAR}`;
    const r = await fetch(upstream, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Upstream ${r.status}`);
    const payload = await r.json();
    const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
    const stats = computeGithubStats(contributions);
    const data = {
      ...stats,
      grid: buildContributionGrid(contributions),
      year: GH_CONTRIB_YEAR,
      username: GH_USERNAME,
      fetchedAt: new Date().toISOString(),
    };
    ghContribCache = { ts: now, data, contributions };
    res.json(data);
  } catch (err) {
    console.error("Error in /api/github-contributions:", err.message);
    if (ghContribCache.data) {
      return res.json(
        ensureGithubPayload(
          { ...ghContribCache.data, stale: true },
          ghContribCache.contributions
        )
      );
    }
    res.status(200).json({
      total: 0,
      todayCount: 0,
      streak: 0,
      grid: buildContributionGrid([]),
      fallback: true,
    });
  }
});

// Stock quote proxy — Yahoo Finance chart API (NVDA default)
const STOCK_DEFAULT_SYMBOL = "NVDA";
const stockQuoteCache = new Map(); // symbol -> { ts, data }
const STOCK_QUOTE_TTL_MS = 5 * 60 * 1000;

function buildStockSparkline(closes) {
  const values = closes.filter((v) => v != null && Number.isFinite(v));
  if (values.length < 2) return null;

  const w = 160;
  const h = 72;
  const padX = 2;
  const padY = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });

  const line = pts
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`))
    .join(" ");
  const last = pts[pts.length - 1];
  const area = `${line} L${last[0].toFixed(2)} ${h} L${pts[0][0].toFixed(2)} ${h} Z`;

  return {
    line,
    area,
    endX: last[0],
    endY: last[1],
    height: h,
  };
}

function parseYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const price = meta.regularMarketPrice;
  const prev =
    meta.chartPreviousClose ??
    meta.previousClose ??
    meta.regularMarketPreviousClose;
  if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) return null;

  const changePercent = ((price - prev) / prev) * 100;
  const quote = result.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const sparkline = buildStockSparkline(closes);

  let name = meta.shortName || meta.symbol || STOCK_DEFAULT_SYMBOL;
  if (typeof name === "string" && name.toLowerCase().includes("nvidia")) {
    name = "NVIDIA";
  }

  return {
    symbol: meta.symbol || STOCK_DEFAULT_SYMBOL,
    name,
    price,
    changePercent,
    currency: meta.currency || "USD",
    sparkline,
    marketState: meta.marketState || null,
    fetchedAt: new Date().toISOString(),
  };
}

app.get("/api/stock-quote", async (req, res) => {
  const symbol = String(req.query.symbol || STOCK_DEFAULT_SYMBOL)
    .toUpperCase()
    .replace(/[^A-Z0-9.^-]/g, "");
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  res.setHeader("Cache-Control", "public, max-age=300");
  const now = Date.now();
  const cached = stockQuoteCache.get(symbol);
  if (cached && now - cached.ts < STOCK_QUOTE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=1d`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; samet.works/1.0)" },
    });
    if (!r.ok) throw new Error(`Upstream ${r.status}`);
    const payload = await r.json();
    const data = parseYahooChart(payload);
    if (!data) throw new Error("Invalid chart payload");
    stockQuoteCache.set(symbol, { ts: now, data });
    res.json(data);
  } catch (err) {
    console.error("Error in /api/stock-quote:", err.message);
    if (cached?.data) {
      return res.json({ ...cached.data, stale: true });
    }
    res.status(200).json({
      symbol,
      name: "NVIDIA",
      price: null,
      changePercent: null,
      currency: "USD",
      sparkline: null,
      fallback: true,
    });
  }
});

// iTunes track preview proxy — small cache, no CORS issues on client
const iTunesCache = new Map(); // id -> { ts, data }
const ITUNES_TTL_MS = 24 * 60 * 60 * 1000;

app.get("/api/track-preview", async (req, res) => {
  const id = String(req.query.id || "").replace(/[^0-9]/g, "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  res.setHeader("Cache-Control", "public, max-age=3600");
  const cached = iTunesCache.get(id);
  if (cached && Date.now() - cached.ts < ITUNES_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
    if (!r.ok) throw new Error(`Upstream ${r.status}`);
    const payload = await r.json();
    const item = payload && Array.isArray(payload.results) ? payload.results[0] : null;
    const data = item
      ? {
          previewUrl: item.previewUrl || null,
          trackName: item.trackName || null,
          artistName: item.artistName || null,
          artworkUrl: item.artworkUrl100 || null,
        }
      : { previewUrl: null };
    iTunesCache.set(id, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error("Error in /api/track-preview:", err.message);
    if (cached) return res.json(cached.data);
    res.status(200).json({ previewUrl: null, fallback: true });
  }
});

// Email submission API
app.post("/api/submit-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@") || !email.includes(".")) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Google Sheets configuration
    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
    const SHEET_NAME = process.env.SHEET_NAME || "Emails";

    // If Google Sheets credentials are not configured, just log and return success
    if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log("Email received (Google Sheets not configured):", email);
      return res.json({ success: true, message: "Email received" });
    }

    try {
      // Parse service account key from environment variable
      const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      // Authenticate with Google Sheets API
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccountKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      // Append email to the sheet
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:B`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[email, new Date().toISOString()]],
        },
      });

      console.log("Email saved to Google Sheets:", email);
      res.json({ success: true, message: "Email saved successfully" });
    } catch (sheetsError) {
      console.error("Error saving to Google Sheets:", sheetsError.message);
      // Still return success to allow user access
      res.json({ success: true, message: "Email received (storage failed)" });
    }
  } catch (error) {
    console.error("Error in /api/submit-email:", error);
    // Return success anyway to allow access
    res.json({ success: true, message: "Email received" });
  }
});

// ============================================
// PAGE ROUTES - HTML pages
// ============================================

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Main page routes
app.get("/mues-ai", (req, res) => {
  res.sendFile(path.join(__dirname, "mues-ai.html"));
});

app.get("/roadmape", (req, res) => {
  res.sendFile(path.join(__dirname, "roadmape.html"));
});

app.get("/producter", (req, res) => {
  res.sendFile(path.join(__dirname, "producter.html"));
});

app.get("/heybooster", (req, res) => {
  res.sendFile(path.join(__dirname, "heybooster.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/about2", (req, res) => {
  res.redirect(301, "/about");
});

app.get("/photos", (req, res) => {
  res.sendFile(path.join(__dirname, "photos.html"));
});

app.get("/resources", (req, res) => {
  res.sendFile(path.join(__dirname, "resources.html"));
});

app.get("/books", (req, res) => {
  res.sendFile(path.join(__dirname, "books.html"));
});

app.get("/ai-glossary", (req, res) => {
  res.sendFile(path.join(__dirname, "ai-glossary.html"));
});

app.get("/portfolio", (req, res) => {
  res.sendFile(path.join(__dirname, "portfolio.html"));
});

// Sitemap route
app.get("/sitemap.xml", (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, "public", "sitemap.xml"));
});

// Robots.txt route
app.get("/robots.txt", (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, "public", "robots.txt"));
});

// LLMs.txt route (before static files to ensure proper content-type)
app.get("/llms.txt", (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(__dirname, "public", "llms.txt"));
});

// Legacy routes for backward compatibility
app.get("/paradox", (req, res) => {
  res.sendFile(path.join(__dirname, "mues-ai.html"));
});

app.get("/dump", (req, res) => {
  res.sendFile(path.join(__dirname, "roadmape.html"));
});

app.get("/hause", (req, res) => {
  res.sendFile(path.join(__dirname, "producter.html"));
});

app.get("/personal", (req, res) => {
  res.sendFile(path.join(__dirname, "heybooster.html"));
});

// 404 page route
app.get("/404", (req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

// ============================================
// STATIC FILES - Serve from public directory ONLY
// ============================================

// Static file serving with cache headers
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1y', // Cache static assets for 1 year
  etag: true, // Enable ETag support
  lastModified: true, // Enable Last-Modified headers
  setHeaders: (res, filePath) => {
    // Set appropriate cache headers based on file type
    if (filePath.endsWith('.html')) {
      // HTML files should not be cached aggressively
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
      // Images can be cached for a long time
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(css|js)$/)) {
      // CSS and JS files can be cached
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(woff|woff2|otf|ttf|eot)$/)) {
      // Font files can be cached for a long time
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(txt|xml)$/)) {
      // Text and XML files (sitemap, robots, llms.txt)
      res.setHeader('Content-Type', filePath.endsWith('.xml') ? 'application/xml' : 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    }
  }
}));

// ============================================
// 404 HANDLER - Catch all unmatched routes
// ============================================

app.use((req, res) => {
  res.redirect("/404");
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
