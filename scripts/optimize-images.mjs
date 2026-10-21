import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve("public/assets");
const manifestPath = path.resolve("scripts/image-manifest.json");
const exts = new Set([".png", ".jpg", ".jpeg"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function encode(file) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  const webpPath = `${base}.webp`;
  const avifPath = `${base}.avif`;
  const input = sharp(file, { failOn: "none" });
  const meta = await input.metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error(`No dimensions for ${file}`);
  const photo = file.includes(`${path.sep}Photos${path.sep}`) || ext.toLowerCase() !== ".png";
  for (const dest of [webpPath, avifPath]) {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  }

  if (photo) {
    await sharp(file, { failOn: "none" })
      .webp({ quality: 100, effort: 6, smartSubsample: false })
      .toFile(webpPath);
    await sharp(file, { failOn: "none" })
      .avif({ quality: 95, effort: 6, chromaSubsampling: "4:4:4" })
      .toFile(avifPath);
  } else {
    await sharp(file, { failOn: "none" })
      .webp({ lossless: true, effort: 6 })
      .toFile(webpPath);
    await sharp(file, { failOn: "none" })
      .avif({ lossless: true, effort: 6 })
      .toFile(avifPath);
  }

  const webpMeta = await sharp(webpPath).metadata();
  const avifMeta = await sharp(avifPath).metadata();
  if (webpMeta.width !== width || webpMeta.height !== height) {
    throw new Error(`WebP size changed for ${file}`);
  }
  if (avifMeta.width !== width || avifMeta.height !== height) {
    throw new Error(`AVIF size changed for ${file}`);
  }

  const rel = path.relative(path.resolve("public"), file).split(path.sep).join("/");
  return {
    src: `/${rel}`,
    width,
    height,
    webp: `/${rel.replace(/\.(png|jpe?g)$/i, ".webp")}`,
    avif: `/${rel.replace(/\.(png|jpe?g)$/i, ".avif")}`,
  };
}

const files = walk(root);
const manifest = {};
let index = 0;
const queue = files.slice();
const workers = Array.from({ length: 2 }, async () => {
  while (queue.length) {
    const file = queue.shift();
    const item = await encode(file);
    manifest[item.src] = item;
    index += 1;
    if (index % 10 === 0 || index === files.length) {
      console.log(`${index}/${files.length} ${item.src} ${item.width}x${item.height}`);
    }
  }
});

await Promise.all(workers);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`manifest ${Object.keys(manifest).length}`);
