import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = path.join(root, "node_modules/@hugeicons/core-free-icons/dist/esm");

const SERVICES = [
  ["Product Design", "PenTool02Icon.js"],
  ["Mobile Design", "SmartPhone01Icon.js"],
  ["Websites", "WebDesign01Icon.js"],
  ["UI/UX Design", "TouchInteraction01Icon.js"],
  ["Brand Design", "ColorsIcon.js"],
  ["Design Systems", "Layers01Icon.js"],
  ["User Research", "UserSearch01Icon.js"],
  ["Product Strategy", "Target02Icon.js"],
  ["AI Strategy", "AiBrain01Icon.js"],
];

function loadIcon(file) {
  const code = fs.readFileSync(path.join(iconDir, file), "utf8");
  const m = code.match(/=\s*\/\*#__PURE__\*\/\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error(`Could not parse ${file}`);
  return Function(`"use strict"; return (${m[1]});`)();
}

function renderIcon(data) {
  const inner = data
    .map(([tag, raw]) => {
      const attrs = { ...raw };
      delete attrs.key;
      const strokeWidth = attrs.strokeWidth || "1.5";
      const linecap = attrs.strokeLinecap || "round";
      const linejoin = attrs.strokeLinejoin || "round";
      const geom =
        tag === "circle"
          ? `cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}"`
          : tag === "rect"
            ? `x="${attrs.x || 0}" y="${attrs.y || 0}" width="${attrs.width}" height="${attrs.height}"${attrs.rx ? ` rx="${attrs.rx}"` : ""}`
            : `d="${attrs.d}"`;
      return `<${tag} ${geom} fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}"/>`;
    })
    .join("");
  return `<svg class="service-card-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">${inner}</svg>`;
}

const cards = SERVICES.map(([label, file]) => {
  const svg = renderIcon(loadIcon(file));
  return `          <div class="service-card">\n            ${svg}\n            <h3 class="text-base font-medium text-slate-900">${label}</h3>\n          </div>`;
}).join("\n");

process.stdout.write(cards);
