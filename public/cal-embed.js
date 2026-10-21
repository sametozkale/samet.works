(function (C, A, L) {
  var p = function (a, ar) {
    a.q.push(ar);
  };
  var d = C.document;
  C.Cal =
    C.Cal ||
    function () {
      var cal = C.Cal;
      var ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement("script")).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        var api = function () {
          p(api, arguments);
        };
        var namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
})(window, "https://app.cal.com/embed/embed.js", "init");

Cal("init", "meetwithme", { origin: "https://app.cal.com" });
Cal.config = Cal.config || {};
Cal.config.forwardQueryParams = true;

Cal.ns.meetwithme("ui", {
  cssVarsPerTheme: { light: { "cal-brand": "#0089ff" } },
  hideEventTypeDetails: false,
  layout: "month_view",
});

document.addEventListener(
  "click",
  function (event) {
    var target = event.target;
    var link =
      target && target.closest ? target.closest("[data-cal-link]") : null;
    if (!link) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!window.Cal || typeof window.Cal.fingerprint !== "string") return;
    event.preventDefault();
  },
  true
);
