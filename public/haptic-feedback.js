(() => {
  "use strict";

  const STORAGE_KEY = "haptics-muted";
  const BUTTON_ID = "haptic-toggle-button";
  const BURST_LINE_CLASS = "haptic-burst-line";
  const AUDIO_FLAG = "haptic-audio-unlocked";

  let audioContext = null;
  let isMuted = false;

  function readMutedState() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (_error) {
      return false;
    }
  }

  function writeMutedState(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch (_error) {
      // No-op when storage is unavailable.
    }
  }

  function ensureAudioContext() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    return audioContext;
  }

  function unlockAudio() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function playHapticClick() {
    if (isMuted) return;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + 0.005;

    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.015);

    const oscillatorGain = ctx.createGain();
    oscillatorGain.gain.setValueAtTime(0.06, now);
    oscillatorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    oscillator.connect(oscillatorGain);
    oscillatorGain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.02);

    const noiseBuffer = ctx.createBuffer(1, Math.floor(0.008 * ctx.sampleRate), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 40);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandPass = ctx.createBiquadFilter();
    bandPass.type = "bandpass";
    bandPass.frequency.value = 3200;
    bandPass.Q.value = 3;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 1;

    noise.connect(bandPass);
    bandPass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  function spawnConfettiBurst(x, y) {
    const lineCount = 6;
    const baseRotation = Math.random() * 360;

    for (let i = 0; i < lineCount; i += 1) {
      const line = document.createElement("span");
      line.className = BURST_LINE_CLASS;
      line.style.left = `${x}px`;
      line.style.top = `${y}px`;

      const angle = baseRotation + i * (360 / lineCount);
      const travel = 12 + Math.random() * 8;
      const duration = 330 + Math.random() * 110;

      line.style.setProperty("--haptic-line-angle", `${angle.toFixed(1)}deg`);
      line.style.setProperty("--haptic-line-travel", `${travel.toFixed(1)}px`);
      line.style.animationDuration = `${duration.toFixed(0)}ms`;

      document.body.appendChild(line);
      window.setTimeout(() => line.remove(), duration + 40);
    }
  }

  function isInteractiveElement(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "a, button, input, textarea, select, summary, label, [role='button'], [tabindex]"
      )
    );
  }

  function updateButtonState(button) {
    button.setAttribute("aria-pressed", String(isMuted));
    button.setAttribute("aria-label", isMuted ? "Unmute click haptics" : "Mute click haptics");
    button.classList.toggle("is-muted", isMuted);
    button.title = isMuted ? "Unmute click haptics" : "Mute click haptics";
  }

  function createToggleButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "haptic-toggle";
    button.innerHTML = [
      '<svg class="haptic-icon" viewBox="0 0 24 24" aria-hidden="true">',
      '<path d="M14 14.8135V9.18646C14 6.04126 14 4.46866 13.0747 4.0773C12.1494 3.68593 11.0603 4.79793 8.88232 7.02192C7.75439 8.17365 7.11085 8.42869 5.50604 8.42869C4.10257 8.42869 3.40084 8.42869 2.89675 8.77262C1.85035 9.48655 2.00852 10.882 2.00852 12C2.00852 13.118 1.85035 14.5134 2.89675 15.2274C3.40084 15.5713 4.10257 15.5713 5.50604 15.5713C7.11085 15.5713 7.75439 15.8264 8.88232 16.9781C11.0603 19.2021 12.1494 20.3141 13.0747 19.9227C14 19.5313 14 17.9587 14 14.8135Z"></path>',
      '<path class="haptic-wave" d="M17 9C17.6254 9.81968 18 10.8634 18 12C18 13.1366 17.6254 14.1803 17 15"></path>',
      '<path class="haptic-wave" d="M20 7C21.2508 8.36613 22 10.1057 22 12C22 13.8943 21.2508 15.6339 20 17"></path>',
      "</svg>"
    ].join("");

    updateButtonState(button);

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      isMuted = !isMuted;
      writeMutedState(isMuted);
      updateButtonState(button);
      if (!isMuted) {
        unlockAudio();
      }
    });

    document.body.appendChild(button);
  }

  function handleGlobalClick(event) {
    if (!event.isTrusted) return;
    if (event.target instanceof Element && event.target.closest(`#${BUTTON_ID}`)) return;
    const interactiveTarget = isInteractiveElement(event.target);

    unlockAudio();
    if (isMuted) return;

    if (!interactiveTarget) {
      const x = event.clientX;
      const y = event.clientY;
      spawnConfettiBurst(x, y);
    }

    playHapticClick();
  }

  function init() {
    isMuted = readMutedState();
    createToggleButton();

    document.addEventListener(
      "click",
      (event) => {
        handleGlobalClick(event);
        if (isInteractiveElement(event.target)) {
          document.documentElement.dataset.hapticLastInteractiveClick = String(Date.now());
        }
      },
      true
    );

    if (!sessionStorage.getItem(AUDIO_FLAG)) {
      const unlockOnce = () => {
        unlockAudio();
        sessionStorage.setItem(AUDIO_FLAG, "true");
        document.removeEventListener("pointerdown", unlockOnce, true);
      };
      document.addEventListener("pointerdown", unlockOnce, true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
