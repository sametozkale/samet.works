import fs from "fs";

const manifest = JSON.parse(fs.readFileSync("scripts/image-manifest.json", "utf8"));
const logos = {
  "https://img.logo.dev/teb.com.tr?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/teb.png",
  "https://img.logo.dev/heybooster.ai?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/heybooster.png",
  "https://img.logo.dev/producter.co?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/producter.png",
  "https://img.logo.dev/mues.ai?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/mues.png",
  "https://img.logo.dev/analyzify.com?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/analyzify.png",
  "https://img.logo.dev/roadmape.com?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/roadmape.png",
  "https://img.logo.dev/countly.com?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/countly.png",
  "https://img.logo.dev/ekmob.com?token=pk_ZEzq3CwgSRiCk2Od_jlvBg": "/assets/logos/ekmob.png",
};

function localSrc(src) {
  const trimmed = src.trim();
  if (logos[trimmed]) return logos[trimmed];
  try {
    return decodeURIComponent(trimmed.split("?")[0]);
  } catch {
    return trimmed.split("?")[0];
  }
}

function rewrite(html) {
  return html.replace(/<img\b[\s\S]*?>/g, (tag) => {
    const srcMatch = tag.match(/\ssrc=(["'])([\s\S]*?)\1/);
    if (!srcMatch) return tag;
    const item = manifest[localSrc(srcMatch[2])];
    if (!item) return tag;
    const quote = srcMatch[1];
    let next = tag.replace(srcMatch[0], ` src=${quote}${item.webp}${quote}`);
    if (!/\swidth=/.test(next)) {
      next = next.replace("<img", `<img width="${item.width}" height="${item.height}"`);
    }
    const lcp = item.src.endsWith("/assets/portfolio/D-1.png");
    if (lcp) {
      next = next.replace(/\sloading=(["'])lazy\1/g, "");
      if (!/\sloading=/.test(next)) next = next.replace("<img", '<img loading="eager"');
      if (!/\sfetchpriority=/.test(next)) next = next.replace("<img", '<img fetchpriority="high"');
    } else {
      if (!/\sloading=/.test(next)) next = next.replace("<img", '<img loading="lazy"');
      if (!/\sdecoding=/.test(next)) next = next.replace("<img", '<img decoding="async"');
    }
    if (/selections-slider-image/.test(next) && !/aspect-ratio/.test(next)) {
      if (/style=(["'])([\s\S]*?)\1/.test(next)) {
        next = next.replace(/style=(["'])([\s\S]*?)\1/, (full, q, style) => {
          const sep = style.trim().endsWith(";") || style.trim() === "" ? "" : ";";
          return `style=${q}${style}${sep} aspect-ratio: 16/10;${q}`;
        });
      } else {
        next = next.replace("<img", '<img style="aspect-ratio: 16/10;"');
      }
    }
    return `<picture><source type="image/webp" srcset="${item.webp}?v=hq" /><source type="image/avif" srcset="${item.avif}?v=hq" />${next}</picture>`;
  });
}

const files = fs.readdirSync(".").filter((name) => name.endsWith(".html"));
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  let html = rewrite(before);
  if (file === "index.html" && !html.includes("/assets/portfolio/D-1.avif")) {
    html = html.replace(
      '<link rel="preload" href="/assets/fonts/OpenRunde-Medium.woff2" as="font" type="font/woff2" crossorigin />',
      '<link rel="preload" as="image" href="/assets/portfolio/D-1.avif" type="image/avif" fetchpriority="high" />\n    <link rel="preload" href="/assets/fonts/OpenRunde-Medium.woff2" as="font" type="font/woff2" crossorigin />'
    );
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    const count = (html.match(/<picture>/g) || []).length;
    console.log(file, count);
  }
}
