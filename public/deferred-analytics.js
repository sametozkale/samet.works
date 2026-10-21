(function () {
  var started = false;

  function load() {
    if (started) return;
    started = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", "G-4RLW0QHN7S");

    var gtag = document.createElement("script");
    gtag.async = true;
    gtag.src = "https://www.googletagmanager.com/gtag/js?id=G-4RLW0QHN7S";
    document.head.appendChild(gtag);

    (function (h, o, t, j, a, r) {
      h.hj = h.hj || function () {
        (h.hj.q = h.hj.q || []).push(arguments);
      };
      h._hjSettings = { hjid: 6588466, hjsv: 6 };
      a = o.getElementsByTagName("head")[0];
      r = o.createElement("script");
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, "https://static.hotjar.com/c/hotjar-", ".js?sv=");
  }

  function arm() {
    if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 5000 });
    else setTimeout(load, 1);
  }

  if (document.readyState === "complete") arm();
  else window.addEventListener("load", arm, { once: true });

  ["pointerdown", "keydown"].forEach(function (type) {
    window.addEventListener(type, load, { once: true, passive: true });
  });
})();
