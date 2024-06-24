"use strict"

customElements.define('scrolling-sentinel',
  class extends HTMLElement {
    constructor() {
      super()

      function dispatch(evt) {
        var event = new Event(evt);
        document.dispatchEvent(event);
      }
      
      this.observer = new IntersectionObserver(entries => {
        if (entries[0].intersectionRatio <= 0) {
          return;
        }
        dispatch(entries[0].target.getAttribute("event"))

      });
      this.observer.observe(this);
    }
    
    disconnectedCallback () {
      this.observer.unobserve(this)
    }
  }
)