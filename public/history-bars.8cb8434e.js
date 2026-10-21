import { animate } from "https://cdn.jsdelivr.net/npm/motion@11.15.0/+esm";

const TEXT_OUT = { duration: 0.18, ease: [0.4, 0, 1, 1] };
const TEXT_IN = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

const root = document.querySelector(".history-bars--motion");
if (root) {
  const bars = root.querySelectorAll(".history-bars__bar");
  const dateEl = document.getElementById("history-bars-detail-date");
  const bodyEl = document.getElementById("history-bars-detail-body");
  const detailInner = document.querySelector(".history-bars-detail__inner");
  const hint = document.getElementById("history-bars-hint");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let activeBar = null;
  let detailAnim = null;
  let detailGen = 0;

  function setBarStates(bar) {
    bars.forEach((b) => {
      const on = b === bar;
      b.classList.toggle("history-bars__bar--active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function resetDetailMotionStyles() {
    if (!detailInner) return;
    detailInner.style.opacity = "";
    detailInner.style.transform = "";
  }

  function setDetailText(bar) {
    if (!dateEl || !bodyEl || !bar) return;
    dateEl.textContent = bar.getAttribute("data-date") || "";
    bodyEl.textContent = bar.getAttribute("data-body") || "";
  }

  function stopDetailAnim() {
    if (!detailAnim) return;
    try {
      detailAnim.stop();
    } catch (_) {
      /* noop */
    }
    detailAnim = null;
  }

  async function waitFinished(controls) {
    if (!controls) return;
    if (controls.finished) {
      await controls.finished.catch(() => {});
      return;
    }
    if (typeof controls.then === "function") {
      await controls.catch(() => {});
    }
  }

  async function animateDetail(bar) {
    const nextDate = bar.getAttribute("data-date") || "";
    const nextBody = bar.getAttribute("data-body") || "";
    if (!dateEl || !bodyEl) return;

    if (reducedMotion || !detailInner) {
      setDetailText(bar);
      return;
    }

    const gen = ++detailGen;
    stopDetailAnim();
    resetDetailMotionStyles();

    try {
      detailAnim = animate(detailInner, { opacity: 0 }, TEXT_OUT);
      await waitFinished(detailAnim);
      if (gen !== detailGen) return;

      dateEl.textContent = nextDate;
      bodyEl.textContent = nextBody;

      detailAnim = animate(detailInner, { opacity: 1 }, TEXT_IN);
      await waitFinished(detailAnim);
    } catch (_) {
      if (gen === detailGen) setDetailText(bar);
    } finally {
      if (gen === detailGen) {
        stopDetailAnim();
        resetDetailMotionStyles();
      }
    }
  }

  function applySelection(bar) {
    if (!bar || bar === activeBar) return;
    activeBar = bar;
    setBarStates(bar);
    animateDetail(bar);
  }

  function pickDefault() {
    const d =
      root.querySelector(".history-bars__bar--active:not(.history-bars__bar--future)") ||
      bars[bars.length - 2];
    if (!d) return;
    setBarStates(d);
    activeBar = d;
    resetDetailMotionStyles();
  }

  pickDefault();

  bars.forEach((bar) => {
    bar.addEventListener("mouseenter", () => applySelection(bar));
    bar.addEventListener("focus", () => applySelection(bar));
    bar.addEventListener("click", () => {
      applySelection(bar);
      if (hint) hint.hidden = true;
    });
  });
}
