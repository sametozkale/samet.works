import crypto from "crypto";
import fs from "fs";
import path from "path";

const assets = [
  "public/styles.css",
  "public/output.css",
  "public/fonts.css",
  "public/side-nav.js",
  "public/haptic-feedback.js",
  "public/conversion-modal.js",
  "public/hyper-text.js",
  "public/typing-animation.js",
  "public/cal-embed.js",
  "public/harman-embeds.js",
  "public/deferred-analytics.js",
  "public/rough-notation.iife.js",
  "public/pixel-image.js",
  "public/history-bars.js",
];

const htmlFiles = fs.readdirSync(".").filter((name) => name.endsWith(".html"));
const html = Object.fromEntries(htmlFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));

for (const asset of assets) {
  const base = path.basename(asset);
  const ext = path.extname(base);
  const name = base.slice(0, -ext.length);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(asset)).digest("hex").slice(0, 8);
  const hashedName = `${name}.${hash}${ext}`;
  fs.copyFileSync(asset, path.join("public", hashedName));
  const escapedExt = ext.replace(".", "\\.");
  const stale = new RegExp(`^${name}\\.[a-f0-9]{8}${escapedExt}$`);
  for (const file of fs.readdirSync("public")) {
    if (stale.test(file) && file !== hashedName) fs.unlinkSync(path.join("public", file));
  }
  const pattern = new RegExp(
    `/(?:${name}\\.[a-f0-9]{8}${escapedExt}|${name}${escapedExt})(?:\\?[^"'\\s>]*)?`,
    "g"
  );
  for (const file of htmlFiles) html[file] = html[file].replace(pattern, `/${hashedName}`);
  console.log(`${base} -> ${hashedName}`);
}

for (const file of htmlFiles) fs.writeFileSync(file, html[file]);
