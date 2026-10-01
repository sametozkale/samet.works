(function () {
  function initSliderNav(snb) {
    var hoverSide = null;
    var prevHoverSide = null;
    var slideBg = snb.querySelector(".snb-js-slide-bg");
    if (!slideBg) return;

    function update() {
      var isEnter = prevHoverSide === null && hoverSide !== null;
      snb.classList.remove(
        "snb-hover-left",
        "snb-hover-right",
        "snb-exit-from-left",
        "snb-exit-from-right",
        "snb-enter-right-prep"
      );

      if (hoverSide === "left") {
        snb.classList.add("snb-hover-left");
      } else if (hoverSide === "right") {
        if (isEnter) {
          snb.classList.add("snb-enter-right-prep");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              snb.classList.remove("snb-enter-right-prep");
              if (hoverSide === "right") snb.classList.add("snb-hover-right");
            });
          });
        } else {
          snb.classList.add("snb-hover-right");
        }
      } else if (prevHoverSide === "left") {
        snb.classList.add("snb-exit-from-left");
        slideBg.addEventListener(
          "transitionend",
          function () {
            snb.classList.remove("snb-exit-from-left");
          },
          { once: true }
        );
      } else if (prevHoverSide === "right") {
        snb.classList.add("snb-exit-from-right");
        slideBg.addEventListener(
          "transitionend",
          function () {
            snb.classList.remove("snb-exit-from-right");
          },
          { once: true }
        );
      }
    }

    snb.addEventListener("mousemove", function (event) {
      var rect = snb.getBoundingClientRect();
      var side = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
      if (side === hoverSide) return;
      prevHoverSide = hoverSide;
      hoverSide = side;
      update();
    });

    snb.addEventListener("mouseleave", function () {
      prevHoverSide = hoverSide;
      hoverSide = null;
      update();
    });
  }

  function initSliderOne(so) {
    var track = so.querySelector(".so-track");
    var input = so.querySelector('input[type="range"]');
    var fill = so.querySelector(".so-fill");
    var dividerMain = so.querySelector(".so-divider-main");
    var dividerLeft = so.querySelector(".so-divider-left");
    var dividerRight = so.querySelector(".so-divider-right");
    var valueEl = so.querySelector(".so-value");
    if (!track || !input || !fill || !valueEl) return;

    var min = Number(input.min);
    var max = Number(input.max);

    function paint() {
      var value = Number(input.value);
      var percent = max <= min ? 0 : ((value - min) / (max - min)) * 100;
      fill.style.width = percent + "%";
      valueEl.textContent = String(value);

      var atEmpty = percent <= 0.5;
      var atFull = percent >= 99.5;
      var dragging = track.classList.contains("is-drag");
      var hovered = track.classList.contains("is-hover");
      var emptyHover = atEmpty && hovered && !dragging;
      var fullHover = atFull && hovered && !dragging;
      var mainVisible =
        !(percent <= (15 / 64) * 100) &&
        !(percent >= (58 / 64) * 100) &&
        !((atEmpty || atFull) && !dragging);

      if (dividerMain) {
        dividerMain.style.opacity =
          !mainVisible || emptyHover || fullHover ? "0" : "1";
      }
      if (dividerLeft) dividerLeft.style.opacity = emptyHover ? "1" : "0";
      if (dividerRight) dividerRight.style.opacity = fullHover ? "1" : "0";
    }

    input.addEventListener("input", paint);
    input.addEventListener("pointerdown", function () {
      track.classList.add("is-drag");
      paint();
    });
    window.addEventListener("pointerup", function () {
      track.classList.remove("is-drag");
      paint();
    });
    track.addEventListener("mouseenter", function () {
      track.classList.add("is-hover");
      paint();
    });
    track.addEventListener("mouseleave", function () {
      track.classList.remove("is-hover");
      paint();
    });
    paint();
  }

  function initPrompt(pi) {
    var textarea = pi.querySelector("textarea");
    var voice = pi.querySelector(".pi-voice");
    var fileInput = pi.querySelector(".pi-file");
    var attach = pi.querySelector("[data-attach]");
    var filesEl = pi.querySelector(".pi-files");
    var files = [];
    var agent = "agent";
    var model = "deep-research";
    var sourcesOn = false;
    var connectors = { "social-media": false, academic: false };
    var recording = false;
    var openPop = null;

    var agents = [
      { id: "agent", label: "Agent", placeholder: "What would you like to do?" },
      { id: "task", label: "Task", placeholder: "Describe a task to automate" },
    ];
    var models = [
      { id: "deep-research", label: "Deep Research" },
      { id: "fast", label: "Fast" },
      { id: "standard", label: "Standard" },
    ];

    function hasText() {
      return textarea.value.trim().length > 0 || files.length > 0;
    }

    function sync() {
      pi.classList.toggle("has-text", textarea.value.trim().length > 0 || files.length > 0);
      pi.classList.toggle("is-recording", recording);
      pi.classList.toggle("is-active", hasText() || openPop !== null);
      voice.setAttribute(
        "aria-label",
        recording ? "Stop voice input" : hasText() ? "Send prompt" : "Start voice input"
      );
      var agentBtn = pi.querySelector('[data-pop-toggle="agent"] .pi-tool-label');
      var modelBtn = pi.querySelector('[data-pop-toggle="model"] .pi-tool-label');
      var currentAgent = agents.filter(function (item) { return item.id === agent; })[0];
      var currentModel = models.filter(function (item) { return item.id === model; })[0];
      if (agentBtn && currentAgent) agentBtn.textContent = currentAgent.label;
      if (modelBtn && currentModel) modelBtn.textContent = currentModel.label;
      if (document.activeElement !== textarea) {
        textarea.placeholder = currentAgent ? currentAgent.placeholder : textarea.placeholder;
      }
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 88) + "px";
      pi.classList.toggle(
        "is-single-line",
        textarea.scrollHeight <= 44 && files.length === 0
      );
    }

    function closePops() {
      openPop = null;
      pi.querySelectorAll(".pi-pop").forEach(function (pop) {
        pop.classList.remove("is-open");
      });
      sync();
    }

    function renderFiles() {
      filesEl.innerHTML = "";
      filesEl.hidden = files.length === 0;
      files.forEach(function (file, index) {
        var chip = document.createElement("div");
        chip.className = "pi-chip";
        var name = document.createElement("span");
        name.textContent = file.name;
        var remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.textContent = "×";
        remove.addEventListener("click", function () {
          files.splice(index, 1);
          renderFiles();
          sync();
        });
        chip.append(name, remove);
        filesEl.appendChild(chip);
      });
    }

    function fillMenu(name) {
      var pop = pi.querySelector('[data-pop="' + name + '"]');
      pop.innerHTML = "";
      if (name === "agent") {
        agents.forEach(function (item) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "pi-option" + (item.id === agent ? " is-selected" : "");
          button.textContent = item.label;
          button.addEventListener("click", function () {
            agent = item.id;
            textarea.placeholder = item.placeholder;
            closePops();
          });
          pop.appendChild(button);
        });
      } else if (name === "model") {
        models.forEach(function (item) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "pi-option" + (item.id === model ? " is-selected" : "");
          button.textContent = item.label;
          button.addEventListener("click", function () {
            model = item.id;
            closePops();
          });
          pop.appendChild(button);
        });
      } else if (name === "sources") {
        var row = document.createElement("div");
        row.className = "pi-switch";
        var label = document.createElement("span");
        label.textContent = "Use sources";
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("aria-pressed", sourcesOn ? "true" : "false");
        toggle.setAttribute("aria-label", "Use sources");
        toggle.addEventListener("click", function () {
          sourcesOn = !sourcesOn;
          toggle.setAttribute("aria-pressed", sourcesOn ? "true" : "false");
        });
        row.append(label, toggle);
        pop.appendChild(row);
        [
          ["social-media", "Social media"],
          ["academic", "Academic"],
        ].forEach(function (entry) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "pi-check" + (connectors[entry[0]] ? " is-selected" : "");
          button.textContent = (connectors[entry[0]] ? "✓ " : "") + entry[1];
          button.addEventListener("click", function () {
            connectors[entry[0]] = !connectors[entry[0]];
            if (connectors[entry[0]]) sourcesOn = true;
            fillMenu("sources");
          });
          pop.appendChild(button);
        });
      }
    }

    function submit() {
      if (!hasText()) return;
      textarea.value = "";
      files = [];
      renderFiles();
      recording = false;
      closePops();
      sync();
    }

    textarea.addEventListener("input", sync);
    textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    voice.addEventListener("click", function () {
      if (recording) {
        recording = false;
        sync();
        return;
      }
      if (hasText()) {
        submit();
        return;
      }
      recording = true;
      sync();
    });

    attach.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      files = files.concat(Array.prototype.slice.call(fileInput.files || []));
      fileInput.value = "";
      renderFiles();
      sync();
    });

    pi.querySelectorAll("[data-pop-toggle]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var name = button.getAttribute("data-pop-toggle");
        if (openPop === name) {
          closePops();
          return;
        }
        closePops();
        openPop = name;
        fillMenu(name);
        pi.querySelector('[data-pop="' + name + '"]').classList.add("is-open");
        pi.classList.add("is-active");
      });
    });

    document.addEventListener("click", function (event) {
      if (!pi.contains(event.target)) closePops();
    });

    sync();
  }

  document.querySelectorAll(".opensource-card .snb").forEach(initSliderNav);
  document.querySelectorAll(".opensource-card .so").forEach(initSliderOne);
  document.querySelectorAll(".opensource-card .pi").forEach(initPrompt);
})();
