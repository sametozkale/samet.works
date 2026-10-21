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

    var paintFrame = 0;
    var lastValue = null;

    function paint() {
      var value = Number(input.value);
      var percent = max <= min ? 0 : ((value - min) / (max - min)) * 100;
      fill.style.width = percent + "%";
      if (value !== lastValue) {
        lastValue = value;
        valueEl.textContent = String(value);
      }

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

    function schedulePaint() {
      if (paintFrame) return;
      paintFrame = requestAnimationFrame(function () {
        paintFrame = 0;
        paint();
      });
    }

    input.addEventListener("input", schedulePaint);
    input.addEventListener("pointerdown", function () {
      track.classList.add("is-drag");
      document.documentElement.classList.add("so-dragging");
      schedulePaint();
    });
    window.addEventListener("pointerup", function () {
      if (!track.classList.contains("is-drag")) return;
      track.classList.remove("is-drag");
      document.documentElement.classList.remove("so-dragging");
      schedulePaint();
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
      var agentToggle = pi.querySelector('[data-pop-toggle="agent"]');
      var modelToggle = pi.querySelector('[data-pop-toggle="model"]');
      var sourcesToggle = pi.querySelector('[data-pop-toggle="sources"]');
      var agentBtn = agentToggle && agentToggle.querySelector(".pi-tool-label");
      var modelBtn = modelToggle && modelToggle.querySelector(".pi-tool-label");
      var sourcesBtn = sourcesToggle && sourcesToggle.querySelector(".pi-tool-label");
      var currentAgent = agents.filter(function (item) { return item.id === agent; })[0];
      var currentModel = models.filter(function (item) { return item.id === model; })[0];
      if (agentBtn && currentAgent) agentBtn.textContent = currentAgent.label;
      if (agentToggle) agentToggle.classList.toggle("is-task", agent === "task");
      if (modelBtn && currentModel) modelBtn.textContent = currentModel.label;
      if (modelToggle) modelToggle.classList.toggle("is-deep", model === "deep-research");
      var sourceCount = (sourcesOn ? 1 : 0) + (connectors["social-media"] ? 1 : 0) + (connectors.academic ? 1 : 0);
      if (sourcesBtn) sourcesBtn.textContent = sourceCount > 0 ? sourceCount + " Sources" : "Sources";
      if (sourcesToggle) sourcesToggle.classList.toggle("is-on", sourceCount > 0);
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
      pi.querySelectorAll("[data-pop-toggle]").forEach(function (button) {
        button.setAttribute("aria-expanded", "false");
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

    var checkSvg = '<svg class="pi-option-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    var boxSvg = '<span class="pi-box"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>';
    var sourceIcons = {
      web: '<svg class="pi-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
      "social-media": '<svg class="pi-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>',
      academic: '<svg class="pi-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>'
    };

    function selectOption(label, selected) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pi-option" + (selected ? " is-selected" : "");
      button.innerHTML = '<span class="pi-option-label"></span>' + checkSvg;
      button.querySelector(".pi-option-label").textContent = label;
      return button;
    }

    function sourceOption(id, label, checked) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pi-option pi-source" + (checked ? " is-selected" : "");
      button.innerHTML = sourceIcons[id] + '<span class="pi-option-label"></span>' + boxSvg;
      button.querySelector(".pi-option-label").textContent = label;
      if (checked) button.querySelector(".pi-box").classList.add("is-on");
      return button;
    }

    function fillMenu(name) {
      var pop = pi.querySelector('[data-pop="' + name + '"]');
      pop.innerHTML = "";
      if (name === "agent") {
        agents.forEach(function (item) {
          var button = selectOption(item.label, item.id === agent);
          button.addEventListener("click", function () {
            agent = item.id;
            textarea.placeholder = item.placeholder;
            closePops();
          });
          pop.appendChild(button);
        });
      } else if (name === "model") {
        models.forEach(function (item) {
          var button = selectOption(item.label, item.id === model);
          button.addEventListener("click", function () {
            model = item.id;
            closePops();
          });
          pop.appendChild(button);
        });
      } else if (name === "sources") {
        var web = sourceOption("web", "Web", sourcesOn);
        web.addEventListener("click", function (event) {
          event.stopPropagation();
          sourcesOn = !sourcesOn;
          fillMenu("sources");
          sync();
        });
        pop.appendChild(web);
        [
          ["social-media", "Social media"],
          ["academic", "Academic"],
        ].forEach(function (entry) {
          var button = sourceOption(entry[0], entry[1], connectors[entry[0]]);
          button.addEventListener("click", function (event) {
            event.stopPropagation();
            connectors[entry[0]] = !connectors[entry[0]];
            fillMenu("sources");
            sync();
          });
          pop.appendChild(button);
        });
      }
    }

    function placePop(name, button) {
      var pop = pi.querySelector('[data-pop="' + name + '"]');
      var piRect = pi.getBoundingClientRect();
      var btnRect = button.getBoundingClientRect();
      pop.style.top = (btnRect.bottom - piRect.top + 8) + "px";
      if (name === "model") {
        pop.style.left = "auto";
        pop.style.right = Math.max(0, piRect.right - btnRect.right - 4) + "px";
      } else {
        pop.style.right = "auto";
        pop.style.left = Math.max(0, btnRect.left - piRect.left - 4) + "px";
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
        placePop(name, button);
        button.setAttribute("aria-expanded", "true");
        pi.querySelector('[data-pop="' + name + '"]').classList.add("is-open");
        pi.classList.add("is-active");
      });
    });

    document.addEventListener("click", function (event) {
      if (event.composedPath().indexOf(pi) === -1) closePops();
    });

    sync();
  }

  document.querySelectorAll(".opensource-card .snb").forEach(initSliderNav);
  document.querySelectorAll(".opensource-card .so").forEach(initSliderOne);
  document.querySelectorAll(".opensource-card .pi").forEach(initPrompt);
})();
