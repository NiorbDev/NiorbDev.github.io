document.documentElement.classList.add("has-js");

const year = new Date().getFullYear();
document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = String(year); });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const watchImage = (image) => {
  const slot = image.closest(".image-slot");
  if (!slot) return;
  const showImage = () => slot.classList.add("has-image");
  const keepPlaceholder = () => slot.classList.remove("has-image");
  image.addEventListener("load", showImage, { once: true });
  image.addEventListener("error", keepPlaceholder, { once: true });
  if (image.complete && image.naturalWidth > 0) showImage();
};
document.querySelectorAll(".image-slot img").forEach(watchImage);

const tickerTrack = document.querySelector(".ticker-track");
if (tickerTrack) {
  const setupTicker = () => {
    tickerTrack.classList.remove("is-running");
    Array.from(tickerTrack.querySelectorAll("[data-loop-clone]")).forEach((node) => node.remove());
    const source = tickerTrack.firstElementChild;
    if (!source) return;
    const groupWidth = source.getBoundingClientRect().width;
    if (!groupWidth) return;
    const viewportWidth = document.documentElement.clientWidth;
    const copies = Math.max(2, Math.ceil(viewportWidth / groupWidth) + 1);
    for (let index = 1; index < copies; index += 1) {
      const clone = source.cloneNode(true);
      clone.dataset.loopClone = "true";
      clone.setAttribute("aria-hidden", "true");
      tickerTrack.appendChild(clone);
    }
    tickerTrack.style.setProperty("--ticker-end", "-" + String(groupWidth) + "px");
    tickerTrack.style.setProperty("--ticker-duration", String(Math.max(12, groupWidth / 52)) + "s");
    if (!reducedMotion.matches) tickerTrack.classList.add("is-running");
  };

  const beginTicker = () => {
    setupTicker();
    let resizeTimer;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(setupTicker, 140);
    }, { passive: true });
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(beginTicker);
  else beginTicker();
}

const galleryTrack = document.querySelector(".gallery-track");
if (galleryTrack) {
  const source = galleryTrack.querySelector(".gallery-group");
  if (source) {
    const clone = source.cloneNode(true);
    clone.dataset.loopClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll(".image-slot img").forEach(watchImage);
    galleryTrack.appendChild(clone);
    const groupHeight = source.getBoundingClientRect().height;
    galleryTrack.style.setProperty("--gallery-duration", String(Math.max(24, groupHeight / 28)) + "s");
    if (!reducedMotion.matches) galleryTrack.classList.add("is-running");
  }
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, activeObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        activeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}