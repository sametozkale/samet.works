// Typing Animation - Inspired by Magic UI
// A component that displays text with a typing animation effect

class TypingAnimation {
  constructor(element, options = {}) {
    this.element = element;
    this.words = options.words || [];
    this.children = options.children || element.textContent.trim();
    this.typeSpeed = options.typeSpeed || 100;
    this.deleteSpeed = options.deleteSpeed || 50;
    this.delay = options.delay || 0;
    this.pauseDelay = options.pauseDelay || 1000;
    this.loop = options.loop !== false;
    this.showCursor = options.showCursor !== false;
    this.blinkCursor = options.blinkCursor !== false;
    this.cursorStyle = options.cursorStyle || 'line';
    this.startOnView = options.startOnView !== false;
    
    this.currentWordIndex = 0;
    this.currentText = '';
    this.isDeleting = false;
    this.isPaused = false;
    this.animationId = null;
    this.hasStarted = false;
    
    this.init();
  }

  init() {
    // Clear original text
    this.element.textContent = '';
    
    // Create cursor element
    if (this.showCursor) {
      this.cursor = document.createElement('span');
      this.cursor.className = 'typing-cursor';
      this.updateCursorStyle();
      if (this.blinkCursor) {
        this.cursor.classList.add('blink');
      }
      this.element.appendChild(this.cursor);
    }
    
    // Determine text source
    if (this.words.length > 0) {
      this.texts = this.words;
    } else {
      this.texts = [this.children];
      this.loop = false; // Single text doesn't loop by default
    }
    
    // Start animation
    if (this.startOnView) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.hasStarted) {
            this.hasStarted = true;
            setTimeout(() => this.animate(), this.delay);
            observer.unobserve(this.element);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(this.element);
    } else {
      setTimeout(() => this.animate(), this.delay);
    }
  }

  updateCursorStyle() {
    if (!this.cursor) return;
    
    switch (this.cursorStyle) {
      case 'block':
        this.cursor.textContent = '▌';
        this.cursor.style.marginLeft = '2px';
        break;
      case 'underscore':
        this.cursor.textContent = '_';
        this.cursor.style.marginLeft = '2px';
        break;
      case 'line':
      default:
        this.cursor.textContent = '|';
        this.cursor.style.marginLeft = '2px';
        break;
    }
  }

  animate() {
    const currentWord = this.texts[this.currentWordIndex];
    
    if (this.isDeleting) {
      // Delete character
      this.currentText = currentWord.substring(0, this.currentText.length - 1);
    } else {
      // Type character
      this.currentText = currentWord.substring(0, this.currentText.length + 1);
    }
    
    // Update text content
    // Remove existing text nodes
    const textNodes = [];
    this.element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node);
      }
    });
    textNodes.forEach(node => node.remove());
    
    // Add new text
    const textNode = document.createTextNode(this.currentText);
    if (this.cursor) {
      this.element.insertBefore(textNode, this.cursor);
    } else {
      this.element.appendChild(textNode);
    }
    
    // Determine next step
    if (!this.isDeleting && this.currentText === currentWord) {
      // Finished typing - remove cursor and end animation
      if (this.cursor) {
        this.cursor.remove();
        this.cursor = null;
      }
      return; // Animation complete
    } else if (this.isDeleting && this.currentText === '') {
      // Finished deleting, move to next word
      this.isDeleting = false;
      this.currentWordIndex++;
      
      if (this.currentWordIndex >= this.texts.length) {
        // Animation complete - remove cursor
        if (this.cursor) {
          this.cursor.remove();
          this.cursor = null;
        }
        return;
      }
    }
    
    // Continue animation
    const speed = this.isDeleting ? this.deleteSpeed : this.typeSpeed;
    this.animationId = setTimeout(() => this.animate(), speed);
  }

  destroy() {
    if (this.animationId) {
      clearTimeout(this.animationId);
    }
  }
}

// Initialize all elements with data-typing-animation attribute
function initTypingAnimations() {
  // Only select h1 elements with data-typing-animation (page titles)
  const elements = document.querySelectorAll('h1[data-typing-animation]');
  
  elements.forEach(el => {
    // Skip if already initialized
    if (el.dataset.typingInitialized) {
      return;
    }
    el.dataset.typingInitialized = 'true';
    
    // Parse attributes
    const wordsAttr = el.getAttribute('data-words');
    const words = wordsAttr ? JSON.parse(wordsAttr) : [];
    
    const options = {
      words: words.length > 0 ? words : undefined,
      typeSpeed: parseInt(el.getAttribute('data-type-speed')) || 100,
      deleteSpeed: parseInt(el.getAttribute('data-delete-speed')) || 50,
      delay: parseInt(el.getAttribute('data-delay')) || 0,
      pauseDelay: parseInt(el.getAttribute('data-pause-delay')) || 1000,
      loop: false, // Always false for page titles - single play
      showCursor: el.getAttribute('data-show-cursor') !== 'false',
      blinkCursor: el.getAttribute('data-blink-cursor') !== 'false',
      cursorStyle: el.getAttribute('data-cursor-style') || 'line',
      startOnView: el.getAttribute('data-start-on-view') !== 'false'
    };
    
    new TypingAnimation(el, options);
  });
}

// Add CSS for blinking cursor
const style = document.createElement('style');
style.textContent = `
  .typing-cursor {
    display: inline-block;
    color: inherit;
    font-weight: inherit;
  }
  .typing-cursor.blink {
    animation: typing-blink 1s infinite;
  }
  @keyframes typing-blink {
    0%, 50% {
      opacity: 1;
    }
    51%, 100% {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTypingAnimations);
} else {
  initTypingAnimations();
}
