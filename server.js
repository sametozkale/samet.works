// server.js
//
// Simple Express server that:
// 1.  On each visit, looks up the visitor's IP → location via ipapi.co
// 2.  Reads the "previous" location from lastVisitor.json
// 3.  Sends back the previous location, then overwrites lastVisitor.json with current
// 4.  Serves your static files (index.html, mues-ai.html, etc.)

require("dotenv").config();
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
// Node.js 18+ has built-in fetch, no need for node-fetch

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_FILE = path.join(__dirname, "lastVisitor.json");
const RESOURCES_FILE = path.join(__dirname, "resources.json");

// Middleware for parsing JSON bodies
app.use(express.json());

// ============================================
// API ROUTES - Must be registered FIRST
// ============================================

// Resources API - GET all resources
app.get("/api/resources", async (req, res) => {
  try {
    const data = await fs.readFile(RESOURCES_FILE, "utf8");
    const resources = JSON.parse(data);
    res.json(resources);
  } catch (err) {
    console.error("Error reading resources:", err.message);
    res.status(500).json({ error: "Failed to load resources" });
  }
});

// Resources API - POST new resource
app.post("/api/resources", async (req, res) => {
  try {
    const { url, category } = req.body;

    // Validate inputs
    if (!url || !category) {
      return res.status(400).json({ error: "URL and category are required" });
    }

    if (!["design", "development", "reading"].includes(category)) {
      return res.status(400).json({ error: "Category must be design, development, or reading" });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Read existing resources
    let resources = [];
    try {
      const data = await fs.readFile(RESOURCES_FILE, "utf8");
      resources = JSON.parse(data);
    } catch (err) {
      // File doesn't exist or is empty, start with empty array
      resources = [];
    }

    // Extract domain from URL for favicon and title
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const favicon = `${urlObj.protocol}//${domain}/favicon.ico`;
    
    // Generate title from domain (remove www. and capitalize)
    let title = domain.replace(/^www\./, "");
    title = title.split(".")[0];
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Create new resource
    const newResource = {
      id: resources.length > 0 ? Math.max(...resources.map(r => r.id)) + 1 : 1,
      url: url,
      title: title,
      description: `A resource from ${domain}`,
      category: category,
      favicon: favicon
    };

    // Add to resources array
    resources.push(newResource);

    // Write back to file
    await fs.writeFile(RESOURCES_FILE, JSON.stringify(resources, null, 2), "utf8");

    res.json({ success: true, resource: newResource });
  } catch (error) {
    console.error("Error adding resource:", error);
    res.status(500).json({ error: "Failed to add resource" });
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

app.get("/cms", (req, res) => {
  res.sendFile(path.join(__dirname, "cms.html"));
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

// ============================================
// STATIC FILES - Serve from public directory ONLY
// ============================================

app.use(express.static(path.join(__dirname, "public")));

// ============================================
// 404 HANDLER - Catch all unmatched routes
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
