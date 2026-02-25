/**
 * Conversion modal: appears after 10s total visit time (cumulative across page navigations).
 * Dismissed state stored in localStorage; once closed, returning users do not see it again.
 * Non-blocking, no overlay. Accessible (Escape, aria).
 */
(function () {
  var STORAGE_KEY = 'conversionModalDismissed';
  var VISIT_START_KEY = 'conversionModalVisitStart';
  var DELAY_MS = 10000;
  var PRIMARY_LINK = 'https://cal.com/sametozkale/meetwithme';

  function getVisitStartTime() {
    try {
      var raw = sessionStorage.getItem(VISIT_START_KEY);
      if (raw) {
        var t = parseInt(raw, 10);
        if (!isNaN(t)) return t;
      }
      var now = Date.now();
      sessionStorage.setItem(VISIT_START_KEY, String(now));
      return now;
    } catch (e) {
      return Date.now();
    }
  }

  function getRemainingDelayMs(useShortDelay) {
    if (useShortDelay) return 2000;
    var start = getVisitStartTime();
    var elapsed = Date.now() - start;
    return Math.max(0, DELAY_MS - elapsed);
  }

  function isForceShowRequested() {
    try {
      return /[?&]showConversionModal=1/i.test(window.location.search);
    } catch (e) {
      return false;
    }
  }

  function shouldShow() {
    try {
      if (isForceShowRequested()) return true;
      if (localStorage.getItem(STORAGE_KEY) === 'true') return false;
      // Migrate from old timestamp-based key so previous dismissals still count
      var oldKey = 'conversionModalDismissedAt';
      if (localStorage.getItem(oldKey)) {
        localStorage.setItem(STORAGE_KEY, 'true');
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {}
  }

  function createModal() {
    var wrap = document.createElement('div');
    wrap.id = 'conversion-modal-root';
    wrap.className = 'conversion-modal';
    wrap.style.display = 'none';
    wrap.setAttribute('role', 'complementary');
    wrap.setAttribute('aria-label', 'Conversion: If you\'re a passionate founder');
    wrap.innerHTML =
      '<button type="button" class="conversion-modal-close" aria-label="Close conversion modal">\n  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>\n</button>\n' +
      '<div class="conversion-modal-eyebrow">If you\'re a passionate founder</div>\n' +
      '<h2 class="conversion-modal-headline">Discover my 3T Formula</h2>\n' +
      '<p class="conversion-modal-subtext">Build <span class="conversion-modal-keyword">trust</span> with your audience, refine your <span class="conversion-modal-keyword">taste</span> in product and positioning, and lead as a <span class="conversion-modal-keyword">trendsetter</span>.</p>\n' +
      '<a href="' + PRIMARY_LINK + '" class="book-call-button conversion-modal-cta" target="_blank" rel="noopener noreferrer">Book a free intro call →</a>\n';
    return wrap;
  }

  function showModal(el) {
    el.style.display = 'block';
    el.classList.add('conversion-modal-visible');
  }

  function hideModal(el) {
    el.classList.remove('conversion-modal-visible');
    el.style.display = 'none';
    markDismissed();
  }

  function run() {
    if (!shouldShow()) return;

    var modal = createModal();
    document.body.appendChild(modal);

    var closeBtn = modal.querySelector('.conversion-modal-close');
    function dismiss() {
      hideModal(modal);
      document.removeEventListener('keydown', onKeydown);
    }

    closeBtn.addEventListener('click', dismiss);

    function onKeydown(e) {
      if (e.key === 'Escape' && modal.classList.contains('conversion-modal-visible')) {
        dismiss();
      }
    }
    document.addEventListener('keydown', onKeydown);

    var useShortDelay = isForceShowRequested();
    var remainingMs = getRemainingDelayMs(useShortDelay);
    setTimeout(function () {
      if (!document.body.contains(modal)) document.body.appendChild(modal);
      showModal(modal);
    }, remainingMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
