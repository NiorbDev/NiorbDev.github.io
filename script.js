document.documentElement.classList.add("has-js");

const year = new Date().getFullYear();
document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = String(year); });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animeArtwork = [
  { src: "assets/gallery/anime/ado-live-cover.webp", alt: "Retrato editorial inspirado en Ado, con tinta noir y ámbar." },
  { src: "assets/gallery/anime/makima.webp", alt: "Lámina editorial de Makima, del universo Chainsaw Man." },
  { src: "assets/gallery/anime/one-piece.webp", alt: "Ilustración de personajes de One Piece en una composición impresa." },
  { src: "assets/gallery/anime/anime-cat.webp", alt: "Ilustración anime de una joven dormida junto a un gato." },
  { src: "assets/gallery/anime/flower-nobility.webp", alt: "Ilustración editorial de La nobleza de las flores." },
  { src: "assets/gallery/anime/goodbye-eri.webp", alt: "Ilustración de Goodbye, Eri con estética de fotocopia." },
];
const animeSlots = document.querySelectorAll("[data-anime-image]");
let previousAnimePicks = [];
try {
  const storedPicks = JSON.parse(localStorage.getItem("niorbdev-anime-art-picks") || "[]");
  if (Array.isArray(storedPicks)) previousAnimePicks = storedPicks;
} catch {
  previousAnimePicks = [];
}
const usedAnime = new Set();
const currentAnimePicks = [];
animeSlots.forEach((image, index) => {
  let choices = animeArtwork.filter((artwork) => !usedAnime.has(artwork.src) && artwork.src !== previousAnimePicks[index]);
  if (!choices.length) choices = animeArtwork.filter((artwork) => !usedAnime.has(artwork.src));
  const selectedAnime = choices[Math.floor(Math.random() * choices.length)];
  if (!selectedAnime) return;
  usedAnime.add(selectedAnime.src);
  currentAnimePicks[index] = selectedAnime.src;
  image.src = selectedAnime.src;
  image.alt = (index > 0 ? "Recorte editorial: " : "") + selectedAnime.alt;
});
try {
  localStorage.setItem("niorbdev-anime-art-picks", JSON.stringify(currentAnimePicks));
} catch {
  // La selección sigue funcionando si el navegador bloquea el almacenamiento local.
}

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

const mosaicTrack = document.querySelector(".mosaic-track");
if (mosaicTrack) {
  const source = mosaicTrack.querySelector(".mosaic-board");
  if (source) {
    const clone = source.cloneNode(true);
    clone.dataset.loopClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll(".image-slot img").forEach(watchImage);
    mosaicTrack.appendChild(clone);
    let lastBoardHeight = 0;
    const updateMosaic = () => {
      const boardHeight = source.getBoundingClientRect().height;
      if (!boardHeight || Math.abs(boardHeight - lastBoardHeight) < 1) return;
      lastBoardHeight = boardHeight;
      mosaicTrack.style.setProperty("--mosaic-duration", String(Math.max(24, boardHeight / 18)) + "s");
      if (!reducedMotion.matches) mosaicTrack.classList.add("is-running");
    };
    updateMosaic();
    if ("ResizeObserver" in window) new ResizeObserver(updateMosaic).observe(source);
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
