// Pixel Image Animation - Inspired by Magic UI
// A component that displays images with a pixelated reveal effect

class PixelImage {
  constructor(imgElement, options = {}) {
    this.imgElement = imgElement;
    this.grid = options.grid || { rows: 8, cols: 8 };
    this.grayscaleAnimation = options.grayscaleAnimation !== false;
    this.pixelFadeInDuration = options.pixelFadeInDuration || 1000;
    this.maxAnimationDelay = options.maxAnimationDelay || 1200;
    this.colorRevealDelay = options.colorRevealDelay || 1500;
    
    this.init();
  }

  init() {
    // Ensure image is loaded before starting animation
    const checkAndStart = () => {
      if (this.imgElement.complete && this.imgElement.naturalWidth > 0 && this.imgElement.naturalHeight > 0) {
        // Wait for layout to be ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.createPixelEffect();
          });
        });
      } else {
        // Wait for image to load
        this.imgElement.addEventListener('load', () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.createPixelEffect();
            });
          });
        }, { once: true });
        
        // Fallback if image fails to load
        this.imgElement.addEventListener('error', () => {
          this.imgElement.style.opacity = '1';
        }, { once: true });
      }
    };
    
    // Check if already loaded or wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAndStart);
    } else {
      checkAndStart();
    }
  }

  createPixelEffect() {
    const img = this.imgElement;
    const container = img.parentElement;
    const imgSrc = img.src;
    
    // Get actual rendered dimensions
    const rect = img.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) {
      // If dimensions are not available, show image normally
      img.style.opacity = '1';
      return;
    }
    
    // Store original styles
    const originalStyles = {
      opacity: img.style.opacity || '',
      position: img.style.position || '',
      top: img.style.top || '',
      left: img.style.left || '',
      width: img.style.width || '',
      height: img.style.height || '',
      zIndex: img.style.zIndex || ''
    };
    
    // Calculate pixel size
    const pixelWidth = width / this.grid.cols;
    const pixelHeight = height / this.grid.rows;
    
    // Ensure container is positioned
    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    
    // Create wrapper div that matches image dimensions exactly
    const wrapper = document.createElement('div');
    wrapper.className = 'pixel-image-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = width + 'px';
    wrapper.style.height = height + 'px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = window.getComputedStyle(img).borderRadius || '8px';
    
    // Hide original image initially but keep it in layout
    img.style.opacity = '0';
    img.style.position = 'relative';
    img.style.zIndex = '1';
    
    // Create pixel grid
    const pixels = [];
    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const x = col * pixelWidth;
        const y = row * pixelHeight;
        
        const pixel = document.createElement('div');
        pixel.className = 'pixel-image-pixel';
        pixel.style.position = 'absolute';
        pixel.style.left = x + 'px';
        pixel.style.top = y + 'px';
        pixel.style.width = pixelWidth + 'px';
        pixel.style.height = pixelHeight + 'px';
        pixel.style.backgroundImage = `url(${imgSrc})`;
        pixel.style.backgroundSize = `${width}px ${height}px`;
        pixel.style.backgroundPosition = `-${x}px -${y}px`;
        pixel.style.backgroundRepeat = 'no-repeat';
        pixel.style.opacity = '0';
        pixel.style.willChange = 'opacity, filter';
        pixel.style.zIndex = '2';
        
        if (this.grayscaleAnimation) {
          pixel.style.filter = 'grayscale(100%)';
        }
        
        wrapper.appendChild(pixel);
        pixels.push(pixel);
      }
    }
    
    // Insert wrapper before image in container
    container.insertBefore(wrapper, img);
    
    // Store references
    this.pixels = pixels;
    this.wrapper = wrapper;
    this.originalStyles = originalStyles;
    
    // Start animation after a small delay to ensure DOM is ready
    setTimeout(() => {
      this.animatePixels();
    }, 50);
  }
  
  animatePixels() {
    const { pixels, imgElement, grayscaleAnimation, pixelFadeInDuration, maxAnimationDelay, colorRevealDelay } = this;
    
    if (!pixels || pixels.length === 0) {
      imgElement.style.opacity = '1';
      return;
    }
    
    // Animate pixels appearing
    pixels.forEach((pixel) => {
      const delay = Math.random() * maxAnimationDelay;
      
      setTimeout(() => {
        if (pixel.parentElement) {
          pixel.style.transition = `opacity ${pixelFadeInDuration}ms ease-out`;
          pixel.style.opacity = '1';
        }
      }, delay);
    });
    
    // Reveal color after delay
    if (grayscaleAnimation) {
      setTimeout(() => {
        pixels.forEach(pixel => {
          if (pixel.parentElement) {
            pixel.style.transition = `filter ${pixelFadeInDuration}ms ease-out, opacity ${pixelFadeInDuration}ms ease-out`;
            pixel.style.filter = 'grayscale(0%)';
          }
        });
        
        // Fade out pixels and show original image
        setTimeout(() => {
          pixels.forEach(pixel => {
            if (pixel.parentElement) {
              pixel.style.transition = `opacity ${pixelFadeInDuration}ms ease-out`;
              pixel.style.opacity = '0';
            }
          });
          
          setTimeout(() => {
            imgElement.style.transition = 'opacity 500ms ease-out';
            imgElement.style.opacity = '1';
            
            // Clean up pixels and wrapper
            setTimeout(() => {
              if (this.wrapper && this.wrapper.parentElement) {
                pixels.forEach(pixel => {
                  if (pixel.parentElement) {
                    pixel.remove();
                  }
                });
                this.wrapper.remove();
              }
            }, 100);
          }, pixelFadeInDuration);
        }, pixelFadeInDuration);
      }, colorRevealDelay);
    } else {
      // Just fade out pixels and show image
      setTimeout(() => {
        pixels.forEach(pixel => {
          if (pixel.parentElement) {
            pixel.style.transition = `opacity ${pixelFadeInDuration}ms ease-out`;
            pixel.style.opacity = '0';
          }
        });
        
        setTimeout(() => {
          imgElement.style.transition = 'opacity 500ms ease-out';
          imgElement.style.opacity = '1';
          
          // Clean up pixels and wrapper
          setTimeout(() => {
            if (this.wrapper && this.wrapper.parentElement) {
              pixels.forEach(pixel => {
                if (pixel.parentElement) {
                  pixel.remove();
                }
              });
              this.wrapper.remove();
            }
          }, 100);
        }, pixelFadeInDuration);
      }, maxAnimationDelay + pixelFadeInDuration);
    }
  }
}

// Initialize all images with data-pixel-image attribute
function initPixelImages() {
  const images = document.querySelectorAll('img[data-pixel-image]');
  
  if (images.length === 0) {
    return;
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Skip if already initialized
        if (img.dataset.pixelInitialized) {
          return;
        }
        img.dataset.pixelInitialized = 'true';
        
        const gridRows = parseInt(img.getAttribute('data-grid-rows')) || 8;
        const gridCols = parseInt(img.getAttribute('data-grid-cols')) || 8;
        const grayscaleAnimation = img.getAttribute('data-grayscale') !== 'false';
        const pixelFadeInDuration = parseInt(img.getAttribute('data-fade-duration')) || 1000;
        const maxAnimationDelay = parseInt(img.getAttribute('data-max-delay')) || 1200;
        const colorRevealDelay = parseInt(img.getAttribute('data-color-delay')) || 1500;
        
        new PixelImage(img, {
          grid: { rows: gridRows, cols: gridCols },
          grayscaleAnimation,
          pixelFadeInDuration,
          maxAnimationDelay,
          colorRevealDelay
        });
        
        observer.unobserve(img);
      }
    });
  }, { 
    threshold: 0.01,
    rootMargin: '50px'
  });
  
  images.forEach(img => {
    observer.observe(img);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPixelImages);
} else {
  // DOM is already ready
  initPixelImages();
}
