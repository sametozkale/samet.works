// Hyper Text Animation - Inspired by Magic UI
// A text animation that scrambles letters before revealing the final text

class HyperText {
  constructor(element, options = {}) {
    this.element = element;
    this.originalText = element.textContent.trim();
    this.duration = options.duration || 800;
    this.delay = options.delay || 0;
    this.characterSet = options.characterSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    this.animateOnHover = options.animateOnHover !== false;
    this.startOnView = options.startOnView || false;
    
    this.init();
  }

  init() {
    if (this.startOnView) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.animate();
            observer.unobserve(this.element);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(this.element);
    }

    if (this.animateOnHover) {
      this.element.addEventListener('mouseenter', () => this.animate());
    }
  }

  getRandomChar() {
    return this.characterSet[Math.floor(Math.random() * this.characterSet.length)];
  }

  async animate() {
    const text = this.originalText;
    const length = text.length;
    const iterations = Math.max(10, Math.floor(this.duration / 50));
    
    for (let i = 0; i < iterations; i++) {
      let scrambled = '';
      for (let j = 0; j < length; j++) {
        if (text[j] === ' ') {
          scrambled += ' ';
        } else {
          scrambled += this.getRandomChar();
        }
      }
      this.element.textContent = scrambled;
      await this.sleep(50);
    }
    
    // Reveal final text
    this.element.textContent = text;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize all elements with data-hyper-text attribute
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-hyper-text]').forEach(el => {
    const duration = parseInt(el.getAttribute('data-duration')) || 800;
    const delay = parseInt(el.getAttribute('data-delay')) || 0;
    const animateOnHover = el.getAttribute('data-animate-on-hover') !== 'false';
    const startOnView = el.getAttribute('data-start-on-view') === 'true';
    
    new HyperText(el, {
      duration,
      delay,
      animateOnHover,
      startOnView
    });
  });
});
