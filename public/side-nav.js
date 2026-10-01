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

  function audioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  async function unlockAudio() {
    try {
      const ctx = audioContext();
      if (ctx.state === "suspended") await ctx.resume();
      audioUnlocked = ctx.state === "running";
    } catch (error) {
      audioUnlocked = false;
    }
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

  async function playSound(name) {
    if (isMuted()) return;
    if (!audioUnlocked) {
      if (name === "hover") return;
      await unlockAudio();
      if (!audioUnlocked) return;
    }
    const ctx = audioContext();
    if (name === "hover") {
      tone(ctx, { frequency: 1300, decay: 0.01, release: 0.004, gain: 0.01 });
    } else if (name === "tick") {
      tone(ctx, { frequency: 1200, decay: 0.012, release: 0.004, gain: 0.08 });
    }
  }

  window.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });

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
      playSound("hover");
    });
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (index === activeIndex) return;
      event.preventDefault();
      playSound("tick");
      try {
        sessionStorage.setItem(ORIGIN_KEY, String(activeIndex));
      } catch (error) {
        /* storage blocked — still navigate */
      }
      window.location.href = page.href;
    });
  });

  const dot = document.createElement("span");
  dot.className = "side-nav__dot";
  dot.setAttribute("aria-hidden", "true");
  list.appendChild(dot);
  nav.appendChild(list);
  document.body.appendChild(nav);

  const fromIndex = readOrigin();
  try {
    if (activeIndex >= 0) sessionStorage.setItem(ORIGIN_KEY, String(activeIndex));
  } catch (error) {
    /* ignore */
  }

  function rowY(index) {
    const item = list.children[index];
    return item.offsetTop + item.offsetHeight / 2 - 2;
  }

  function placeLabel(el, x) {
    el.style.transform = "translateX(" + x + "px)";
  }

  function springTo(from, to, stiffness, damping, onFrame) {
    if (reduceMotion) {
      onFrame(to);
      return;
    }
    let x = from;
    let v = 0;
    let last = 0;
    function frame(now) {
      if (!last) {
        last = now;
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const a = -stiffness * (x - to) - damping * v;
      v += a * dt;
      x += v * dt;
      onFrame(x);
      if (Math.abs(to - x) < 0.15 && Math.abs(v) < 6) {
        onFrame(to);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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

  function flyDot(from, to, onImpact) {
    dot.hidden = false;
    const startY = rowY(from);
    const targetY = rowY(to);
    const rows = Math.abs(to - from);
    const offset = arcOffset(rows);
    dot.style.transform = "translate(0px, " + startY + "px)";
    if (reduceMotion || rows === 0) {
      dot.style.transform = "translate(0px, " + targetY + "px)";
      if (onImpact) onImpact();
      return;
    }
    dot.classList.add("is-travelling");
    let y = startY;
    let velocity = 0;
    let last = 0;
    let elapsed = 0;
    let impacted = false;
    function fly(now) {
      // Ignore time spent before the first paint. A late frame must not skip the arc.
      if (!last) {
        last = now;
        requestAnimationFrame(fly);
        return;
      }
      const dt = Math.min(0.016, (now - last) / 1000);
      last = now;
      elapsed += dt * 1000;
      const accel = -800 * (y - targetY) - 52 * velocity;
      velocity += accel * dt;
      y += velocity * dt;
      const t = Math.min(1, elapsed / DOT_FLIGHT_MS);
      if (!impacted && t >= DOT_IMPACT) {
        impacted = true;
        if (onImpact) onImpact();
      }
      dot.style.transform = "translate(" + arcX(t, offset) + "px, " + y + "px)";
      const settled = t >= 1 && Math.abs(targetY - y) < 0.4 && Math.abs(velocity) < 12;
      if (!settled) requestAnimationFrame(fly);
      else {
        dot.style.transform = "translate(0px, " + targetY + "px)";
        dot.classList.remove("is-travelling");
      }
    }
    requestAnimationFrame(fly);
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

    springTo(10, 0, 900, 45, function (x) {
      placeLabel(labels[originIndex], x);
    });

    flyDot(originIndex, activeIndex, function () {
      springTo(0, 10, 1000, 60, function (x) {
        placeLabel(labels[activeIndex], x);
      });
    });
  }

  playArrival(fromIndex);

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    const again = readOrigin();
    try {
      if (activeIndex >= 0) sessionStorage.setItem(ORIGIN_KEY, String(activeIndex));
    } catch (error) {
      /* ignore */
    }
    playArrival(again);
  });
})();
