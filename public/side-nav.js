(function () {
  if (document.querySelector(".side-nav")) return;

  const PAGES = [
    { href: "/", label: "Home", match: (path) => path === "/" || path === "/index.html" },
    { href: "/about", label: "About", match: (path) => path.startsWith("/about") },
    { href: "/portfolio", label: "Portfolio", match: (path) => path.startsWith("/portfolio") },
    { href: "/resources", label: "Resources", match: (path) => path.startsWith("/resources") },
    { href: "/books", label: "Books", match: (path) => path.startsWith("/books") },
    { href: "/photos", label: "Photos", match: (path) => path.startsWith("/photos") },
  ];

  const DOT_FLIGHT_MS = 350;
  const DOT_IMPACT = 0.8;
  const DOT_IMPACT_MS = DOT_FLIGHT_MS * DOT_IMPACT;
  const DOT_ARC_MIN = 8;
  const DOT_ARC_MAX = 16;
  const DOT_ARC_PER_ROW = 2;
  const DOT_TOUCH_OFFSET = -5;
  const ORIGIN_KEY = "side-nav-origin";
  const MUTE_KEY = "side-nav-muted";

  let audioCtx = null;
  let audioUnlocked = false;

  function isMuted() {
    return window.localStorage.getItem(MUTE_KEY) === "true";
  }

  function bindDefaultOutput(ctx) {
    if (!ctx || typeof ctx.setSinkId !== "function") return;
    ctx.setSinkId("").catch(function () {});
  }

  function dropAudio() {
    audioUnlocked = false;
    if (!audioCtx) return;
    const old = audioCtx;
    audioCtx = null;
    old.close().catch(function () {});
  }

  function audioContext() {
    if (!audioCtx || audioCtx.state === "closed") {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      try {
        audioCtx = new AudioCtor({ latencyHint: "interactive" });
      } catch (error) {
        audioCtx = new AudioCtor();
      }
      bindDefaultOutput(audioCtx);
    }
    return audioCtx;
  }

  function unlockAudio() {
    try {
      const ctx = audioContext();
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        const pending = ctx.resume();
        if (pending && typeof pending.catch === "function") pending.catch(function () {});
      }
      audioUnlocked = ctx.state === "running";
    } catch (error) {
      audioUnlocked = false;
    }
  }

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", dropAudio);
  }

  function tone(ctx, options) {
    const start = ctx.currentTime + (options.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequency = options.detune
      ? options.frequency * Math.pow(2, options.detune / 1200)
      : options.frequency;
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(options.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.decay + options.release);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + options.decay + options.release + 0.02);
  }

  const TICK = { frequency: 1200, decay: 0.012, release: 0.004, gain: 0.12 };
  const TICK_HOLD_MS = 180;

  function playHover() {
    if (isMuted() || !audioUnlocked) return;
    try {
      const ctx = audioContext();
      if (ctx.state !== "running") return;
      tone(ctx, { frequency: 1300, decay: 0.01, release: 0.004, gain: 0.016 });
    } catch (error) {
      /* ignore */
    }
  }

  function playTick() {
    if (isMuted()) return Promise.resolve(false);
    let ctx;
    try {
      ctx = audioContext();
    } catch (error) {
      return Promise.resolve(false);
    }
    const resume = ctx.state === "running" ? null : ctx.resume();
    return Promise.resolve(resume)
      .then(function () {
        if (!ctx || ctx.state !== "running") return false;
        const start = ctx.currentTime + 0.005;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(TICK.frequency, start);
        gain.gain.setValueAtTime(TICK.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + TICK.decay + TICK.release);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + TICK.decay + TICK.release + 0.02);
        audioUnlocked = true;
        return new Promise(function (resolve) {
          let settled = false;
          const finish = function () {
            if (settled) return;
            settled = true;
            resolve(true);
          };
          osc.onended = function () {
            window.setTimeout(finish, 30);
          };
          window.setTimeout(finish, TICK_HOLD_MS);
        });
      })
      .catch(function () {
        return false;
      });
  }

  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("keydown", unlockAudio);

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const activeIndex = PAGES.findIndex((page) => page.match(path));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readOrigin() {
    try {
      const raw = sessionStorage.getItem(ORIGIN_KEY);
      if (raw == null || raw === "") return -1;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n >= PAGES.length) return -1;
      return n;
    } catch (error) {
      return -1;
    }
  }

  const nav = document.createElement("nav");
  nav.className = "side-nav";
  nav.setAttribute("aria-label", "Site");
  nav.style.setProperty("--dot-flight", DOT_FLIGHT_MS + "ms");
  nav.style.setProperty("--dot-impact", DOT_IMPACT_MS + "ms");

  const list = document.createElement("ul");
  list.className = "side-nav__list";

  const labels = [];

  PAGES.forEach((page, index) => {
    const item = document.createElement("li");
    item.className = "side-nav__item";
    const link = document.createElement("a");
    link.className = "side-nav__link";
    link.href = page.href;
    if (index === activeIndex) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
    const label = document.createElement("span");
    label.className = "side-nav__label";
    label.textContent = page.label;
    link.appendChild(label);
    item.appendChild(link);
    list.appendChild(item);
    labels.push(label);

    link.addEventListener("mouseenter", function () {
      playHover();
    });
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (index === activeIndex) {
        event.preventDefault();
        playTick();
        return;
      }
      event.preventDefault();
      try {
        sessionStorage.setItem(ORIGIN_KEY, String(activeIndex));
      } catch (error) {
        /* storage blocked — still navigate */
      }
      const go = function () {
        window.location.href = page.href;
      };
      let left = false;
      const goOnce = function () {
        if (left) return;
        left = true;
        go();
      };
      playTick().then(goOnce);
      window.setTimeout(goOnce, TICK_HOLD_MS);
    });
  });

  const dot = document.createElement("span");
  dot.className = "side-nav__dot";
  dot.setAttribute("aria-hidden", "true");
  list.appendChild(dot);
  nav.appendChild(list);
  document.body.appendChild(nav);

  function connectionAllowsPrefetch() {
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
  }

  const prefetchedDocs = new Set();
  function prefetchDocument(href) {
    if (!connectionAllowsPrefetch()) return;
    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch (error) {
      return;
    }
    if (prefetchedDocs.has(url.href) || url.pathname === window.location.pathname) return;
    prefetchedDocs.add(url.href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = url.href;
    document.head.appendChild(link);
  }

  const PROJECT_PATHS = ["/zero", "/mues-ai", "/roadmape", "/producter", "/heybooster"];

  document.addEventListener("pointerover", function (event) {
    const anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor) return;
    let pathname = "";
    try {
      pathname = new URL(anchor.getAttribute("href"), window.location.origin).pathname;
    } catch (error) {
      return;
    }
    const sideNav = anchor.classList.contains("side-nav__link");
    if (!sideNav && PROJECT_PATHS.indexOf(pathname) === -1) return;
    prefetchDocument(pathname);
  }, true);

  function warmNavTargets() {
    if (document.prerendering) return;
    if (!window.matchMedia("(min-width: 641px)").matches) return;
    if (!connectionAllowsPrefetch()) return;
    if (document.querySelector("[data-side-nav-warm]")) return;
    const urls = [];
    PAGES.forEach(function (page, index) {
      if (index === activeIndex) return;
      urls.push(new URL(page.href, window.location.origin).href);
    });
    if (!urls.length) return;
    const supportsSpeculation =
      window.HTMLScriptElement &&
      typeof HTMLScriptElement.supports === "function" &&
      HTMLScriptElement.supports("speculationrules");
    if (supportsSpeculation) {
      const rules = document.createElement("script");
      rules.type = "speculationrules";
      rules.setAttribute("data-side-nav-warm", "");
      rules.textContent = JSON.stringify({
        prefetch: [{ source: "list", urls: urls, eagerness: "moderate" }],
      });
      document.head.appendChild(rules);
    }
  }

  if (document.prerendering) {
    document.addEventListener("prerenderingchange", warmNavTargets, { once: true });
  } else {
    warmNavTargets();
  }

  function rowY(index) {
    const item = list.children[index];
    return item.offsetTop + item.offsetHeight / 2 - 2;
  }

  const FRAME_MS = 1000 / 120;

  function clampLabel(x) {
    return Math.max(0, Math.min(12, x));
  }

  function placeLabel(el, x) {
    el.style.transform = "translateX(" + clampLabel(x) + "px)";
  }

  // Fixed 8ms steps. A single 32ms step makes the 1000/60 spring explode.
  function stepSpring(state, target, stiffness, damping, dt) {
    let left = Math.min(Math.max(dt, 0), 0.05);
    let steps = 0;
    while (left >= 0.001 && steps < 8) {
      const h = Math.min(1 / 120, left);
      const a = -stiffness * (state.x - target) - damping * state.v;
      state.v += a * h;
      state.x += state.v * h;
      left -= h;
      steps += 1;
    }
  }

  function withOffsets(frames) {
    const last = frames.length - 1;
    frames.forEach(function (frame, index) {
      frame.offset = last === 0 ? 0 : index / last;
    });
    return frames;
  }

  function sampleLabel(from, to, stiffness, damping) {
    const state = { x: from, v: 0 };
    const frames = [{ transform: "translateX(" + clampLabel(from) + "px)" }];
    let guard = 0;
    while (guard < 80) {
      stepSpring(state, to, stiffness, damping, FRAME_MS / 1000);
      frames.push({ transform: "translateX(" + clampLabel(state.x) + "px)" });
      guard += 1;
      if (Math.abs(to - state.x) < 0.15 && Math.abs(state.v) < 6) break;
    }
    frames[frames.length - 1].transform = "translateX(" + clampLabel(to) + "px)";
    return { frames: withOffsets(frames), duration: Math.max(FRAME_MS, (frames.length - 1) * FRAME_MS) };
  }

  function sampleDot(startY, targetY, offset) {
    const state = { x: startY, v: 0 };
    const frames = [];
    let elapsed = 0;
    let guard = 0;
    while (guard < 120) {
      const t = Math.min(1, elapsed / DOT_FLIGHT_MS);
      frames.push({
        transform: "translate(" + arcX(t, offset).toFixed(2) + "px, " + state.x.toFixed(2) + "px)",
      });
      const settled = t >= 1 && Math.abs(targetY - state.x) < 0.4 && Math.abs(state.v) < 12;
      if (settled) break;
      stepSpring(state, targetY, 800, 52, FRAME_MS / 1000);
      elapsed += FRAME_MS;
      guard += 1;
    }
    frames[frames.length - 1].transform = "translate(0px, " + targetY.toFixed(2) + "px)";
    return { frames: withOffsets(frames), duration: Math.max(FRAME_MS, (frames.length - 1) * FRAME_MS) };
  }

  function playMotion(el, frames, duration, delay, startTime, onDone) {
    if (!frames.length || typeof el.animate !== "function") {
      if (frames.length) el.style.transform = frames[frames.length - 1].transform;
      if (onDone) onDone();
      return;
    }
    el.getAnimations().forEach(function (animation) {
      if (animation.id === "side-nav-shimmer") return;
      animation.cancel();
    });
    const animation = el.animate(frames, {
      duration: duration,
      delay: delay || 0,
      easing: "linear",
      fill: "both",
    });
    try {
      if (startTime != null) animation.startTime = startTime;
    } catch (error) {
      /* timeline not ready — play from the current time */
    }
    animation.onfinish = function () {
      el.style.transform = frames[frames.length - 1].transform;
      animation.cancel();
      if (onDone) onDone();
    };
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function arcX(t, offset) {
    const times = [0, 0.3, DOT_IMPACT, 1];
    const values = [0, offset, DOT_TOUCH_OFFSET, 0];
    const eases = [easeOut, easeInOut, easeOut];
    if (t <= 0) return values[0];
    if (t >= 1) return values[values.length - 1];
    let i = 0;
    while (i < times.length - 2 && t > times[i + 1]) i += 1;
    const local = (t - times[i]) / (times[i + 1] - times[i]);
    return values[i] + (values[i + 1] - values[i]) * eases[i](local);
  }

  function arcOffset(rows) {
    if (!rows) return 0;
    return -Math.min(DOT_ARC_MAX, DOT_ARC_MIN + (rows - 1) * DOT_ARC_PER_ROW);
  }

  function clearShimmer(label) {
    label.style.backgroundImage = "";
    label.style.backgroundSize = "";
    label.style.backgroundRepeat = "";
    label.style.backgroundPosition = "";
    label.style.webkitBackgroundClip = "";
    label.style.backgroundClip = "";
    label.style.webkitTextFillColor = "";
    label.style.color = "";
  }

  function shimmerActive(delay) {
    const label = labels[activeIndex];
    if (!label || reduceMotion || typeof label.animate !== "function") return;
    clearShimmer(label);
    label.style.backgroundImage =
      "linear-gradient(90deg, #0089FF 0%, #0089FF 40%, #7ec4ff 48%, #eaf5ff 50%, #7ec4ff 52%, #737373 60%, #737373 100%)";
    label.style.backgroundSize = "200% 100%";
    label.style.backgroundRepeat = "no-repeat";
    label.style.backgroundPosition = "100% 0";
    label.style.webkitBackgroundClip = "text";
    label.style.backgroundClip = "text";
    label.style.webkitTextFillColor = "transparent";
    label.style.color = "transparent";
    const animation = label.animate(
      [{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }],
      {
        duration: 640,
        delay: delay || 0,
        easing: "cubic-bezier(0.22, 0.8, 0.28, 1)",
        fill: "both",
      }
    );
    animation.id = "side-nav-shimmer";
    animation.onfinish = function () {
      clearShimmer(label);
      animation.cancel();
    };
  }

  function playArrival(originIndex) {
    const travelled =
      !reduceMotion &&
      originIndex >= 0 &&
      activeIndex >= 0 &&
      originIndex !== activeIndex;

    labels.forEach(function (label, index) {
      if (travelled && index === originIndex) placeLabel(label, 10);
      else placeLabel(label, index === activeIndex && !travelled ? 10 : 0);
    });

    if (activeIndex < 0) {
      dot.hidden = true;
      return;
    }

    if (!travelled) {
      dot.hidden = false;
      dot.style.transform = "translate(0px, " + rowY(activeIndex) + "px)";
      return;
    }

    const startY = rowY(originIndex);
    const targetY = rowY(activeIndex);
    dot.hidden = false;
    dot.style.willChange = "transform";
    dot.style.transform = "translate(0px, " + startY + "px)";

    const returning = sampleLabel(10, 0, 900, 45);
    const arriving = sampleLabel(0, 10, 1000, 60);
    const flight = sampleDot(startY, targetY, arcOffset(Math.abs(activeIndex - originIndex)));

    requestAnimationFrame(function (now) {
      dot.classList.add("is-travelling");
      playMotion(labels[originIndex], returning.frames, returning.duration, 0, now);
      playMotion(labels[activeIndex], arriving.frames, arriving.duration, DOT_IMPACT_MS, now);
      shimmerActive(DOT_IMPACT_MS);
      playMotion(dot, flight.frames, flight.duration, 0, now, function () {
        dot.classList.remove("is-travelling");
      });
    });
  }

  function boot() {
    const origin = readOrigin();
    try {
      if (activeIndex >= 0) sessionStorage.setItem(ORIGIN_KEY, String(activeIndex));
    } catch (error) {
      /* ignore */
    }
    playArrival(origin);
  }

  if (document.prerendering) {
    document.addEventListener("prerenderingchange", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    boot();
  });

  function mountSlidingPills() {
    const groups = [
      [".category-filter", ".category-btn"],
      [".portfolio-view-switch", ".portfolio-view-btn"],
    ];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    groups.forEach(function (pair) {
      document.querySelectorAll(pair[0]).forEach(function (root) {
        const items = root.querySelectorAll(pair[1]);
        if (!items.length || root.querySelector(":scope > .sliding-pill")) return;

        const pill = document.createElement("span");
        pill.className = "sliding-pill";
        pill.setAttribute("aria-hidden", "true");
        root.prepend(pill);

        let frame = 0;
        function place(animate) {
          const active = root.querySelector(pair[1] + ".active, " + pair[1] + ".is-active");
          if (!active) return;
          const rootRect = root.getBoundingClientRect();
          const rect = active.getBoundingClientRect();
          if (!animate || reduce) pill.style.transition = "none";
          pill.style.width = rect.width + "px";
          pill.style.height = rect.height + "px";
          pill.style.transform =
            "translate(" + (rect.left - rootRect.left) + "px, " + (rect.top - rootRect.top) + "px)";
          if (!animate || reduce) {
            pill.getBoundingClientRect();
            pill.style.transition = "";
          }
        }

        function schedule(animate) {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(function () {
            place(animate);
          });
        }

        place(false);
        requestAnimationFrame(function () {
          root.classList.add("is-pill-ready");
        });

        const observer = new MutationObserver(function () {
          schedule(true);
        });
        items.forEach(function (item) {
          observer.observe(item, { attributes: true, attributeFilter: ["class"] });
        });

        window.addEventListener("resize", function () {
          schedule(false);
        });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function () {
            schedule(false);
          });
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSlidingPills, { once: true });
  } else {
    mountSlidingPills();
  }

  function mountCaseVideos() {
    const videos = document.querySelectorAll("video.case-video__media");
    if (!videos.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = !!(connection && (connection.saveData || connection.effectiveType === "2g" || connection.effectiveType === "slow-2g"));

    function attach(video) {
      if (video.dataset.loaded === "1") return;
      const source = video.querySelector("source[data-src]");
      if (!source) return;
      source.src = source.getAttribute("data-src");
      video.dataset.loaded = "1";
      video.load();
    }

    function play(video) {
      attach(video);
      const pending = video.play();
      if (pending && typeof pending.catch === "function") pending.catch(function () {});
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const video = entry.target;
        if (!entry.isIntersecting) {
          if (video.dataset.loaded === "1") video.pause();
          return;
        }
        play(video);
      });
    }, { rootMargin: saveData ? "0px" : "240px 0px 720px 0px", threshold: 0.01 });

    videos.forEach(function (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      if (!reduce && !saveData) return;
      video.addEventListener("click", function () {
        play(video);
      });
    });

    if (reduce || saveData) return;
    requestAnimationFrame(function () {
      videos.forEach(function (video) {
        observer.observe(video);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCaseVideos, { once: true });
  } else {
    mountCaseVideos();
  }
})();
