import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const toolsPath = path.join(root, "design-engineer-tools.json");
const scrapePath = process.argv[2] || path.join(__dirname, "designeer-scrape.json");

const CATEGORY_DESCRIPTION = {
  inspiration: "Inspiration tool for design engineers.",
  "ai-code": "AI Code tool for design engineers.",
  components: "Components tool for design engineers.",
  "web-utility": "Web Utility tool for design engineers.",
  "desktop-utility": "Desktop Utility tool for design engineers.",
  "video-capture": "Video & Capture tool for design engineers.",
  whiteboard: "Whiteboard tool for design engineers.",
  organization: "Organization tool for design engineers.",
  fonts: "Fonts tool for design engineers.",
  visual: "Visual tool for design engineers.",
  interface: "Interface tool for design engineers.",
  motion: "Motion tool for design engineers.",
  audio: "Audio tool for design engineers.",
  volumetric: "Volumetric tool for design engineers.",
  "3d": "3D tool for design engineers.",
  gltf: "glTF tool for design engineers.",
  "digital-fashion": "Digital Fashion tool for design engineers.",
  research: "Research tool for design engineers.",
  browser: "Browser tool for design engineers.",
  emoji: "Emoji tool for design engineers.",
};

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let s = u.href;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hostnameKey(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url;
  }
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return "https://www.google.com/s2/favicons?domain=example.com&sz=32";
  }
}

function describe(item) {
  const fallback = CATEGORY_DESCRIPTION[item.category] || "Tool for design engineers.";
  if (item.description && item.description.trim()) {
    const d = item.description.trim();
    return d.endsWith(".") ? d : `${d}.`;
  }
  return fallback;
}

const existing = JSON.parse(fs.readFileSync(toolsPath, "utf8"));
const scraped = JSON.parse(fs.readFileSync(scrapePath, "utf8"));

const byUrl = new Map();
const byHost = new Map();
for (const tool of existing) {
  byUrl.set(normalizeUrl(tool.url), tool);
  byHost.set(hostnameKey(tool.url), tool);
}

let nextId = Math.max(0, ...existing.map((t) => t.id)) + 1;
let added = 0;
let updated = 0;

for (const item of scraped) {
  const key = normalizeUrl(item.href);
  const host = hostnameKey(item.href);
  let cur = byUrl.get(key) || byHost.get(host);

  if (cur) {
    if (cur.category !== item.category) {
      cur.category = item.category;
      updated++;
    }
    continue;
  }

  const entry = {
    id: nextId++,
    url: item.href,
    title: item.title,
    description: describe(item),
    category: item.category,
    favicon: faviconFor(item.href),
  };

  existing.push(entry);
  byUrl.set(key, entry);
  byHost.set(host, entry);
  added++;
}

existing.sort((a, b) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" })
);

fs.writeFileSync(toolsPath, `${JSON.stringify(existing, null, 2)}\n`);
console.log(JSON.stringify({ added, updated, total: existing.length }, null, 2));
