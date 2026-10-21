import fs from "fs";
import path from "path";

const files = fs.readdirSync(".").filter((name) => name.endsWith(".html"));
const interOnly = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
const interAndChivo = "https://fonts.googleapis.com/css2?family=Chivo+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap";
const fontLink = /<link\s[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*>/g;
const otfPreload = /\s*<link rel="preload" href="\/assets\/fonts\/OpenRunde-(?:Regular|Medium|Semibold|Bold)\.otf" as="font" type="font\/otf" crossorigin\s*\/>/g;
const analytics = /[ \t]*<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- Hotjar Tracking Code for samet\.works -->[\s\S]*?<\/script>\s*/;

const rough = `    <script src="https://unpkg.com/rough-notation/lib/rough-notation.iife.js" defer></script>
    <script>
      window.addEventListener('load', () => {
        if (!window.RoughNotation || typeof window.RoughNotation.annotate !== 'function') return;

        const { annotate, annotationGroup } = window.RoughNotation;`;

const roughNext = `    <script>
      function startHomeAnnotations() {
        if (!window.RoughNotation || typeof window.RoughNotation.annotate !== 'function') return;

        const { annotate, annotationGroup } = window.RoughNotation;`;

for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(analytics, '    <script src="/deferred-analytics.js" defer></script>\n');
  html = html.replace(otfPreload, "");
  html = html.replace(fontLink, (tag) => {
    const href = file === "index.html" || !tag.includes("Chivo") ? interOnly : interAndChivo;
    return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'" />\n    <noscript><link rel="stylesheet" href="${href}" /></noscript>`;
  });
  if (!html.includes("OpenRunde-Medium.woff2") && html.includes('href="/fonts.css"')) {
    html = html.replace(
      '<link href="/fonts.css" rel="stylesheet" />',
      '<link rel="preload" href="/assets/fonts/OpenRunde-Medium.woff2" as="font" type="font/woff2" crossorigin />\n    <link href="/fonts.css" rel="stylesheet" />'
    );
  }
  if (file === "index.html" && html.includes(rough)) {
    html = html.replace(rough, roughNext);
    html = html.replace(
      `        if (annotations.length > 0) {
          annotationGroup(annotations).show();
        }
      });
    </script>`,
      `        if (annotations.length > 0) {
          annotationGroup(annotations).show();
        }
      }
      function scheduleHomeAnnotations() {
        var script = document.createElement("script");
        script.src = "/rough-notation.iife.js";
        script.defer = true;
        script.onload = function () {
          requestAnimationFrame(function () {
            requestAnimationFrame(startHomeAnnotations);
          });
        };
        document.body.appendChild(script);
      }
      if (document.readyState === "complete") requestAnimationFrame(scheduleHomeAnnotations);
      else window.addEventListener("load", function () { requestAnimationFrame(scheduleHomeAnnotations); }, { once: true });
    </script>`
    );
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log("patched", file);
  } else {
    console.log("unchanged", file);
  }
}
