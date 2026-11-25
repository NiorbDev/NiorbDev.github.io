document.documentElement.classList.add("has-js");

const year = new Date().getFullYear();
document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = String(year); });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const navPixels = document.querySelector(".nav-pixels");
const navContext = navPixels?.getContext("2d");
if (navContext) {
  let pixelFrame = 0;
  navPixels.closest(".site-header").addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || reducedMotion.matches) return;

    cancelAnimationFrame(pixelFrame);
    const {left, top, width, height} = navPixels.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    navPixels.width = Math.round(width * scale);
    navPixels.height = Math.round(height * scale);
    navContext.setTransform(scale, 0, 0, scale, 0, 0);
    navContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--amber").trim();

    const linkRect = link.getBoundingClientRect();
    const originX = (event.detail ? event.clientX : linkRect.left + linkRect.width / 2) - left;
    const originY = (event.detail ? event.clientY : linkRect.top + linkRect.height / 2) - top;
    const pixels = [];
    const step = 10;
    for (let y = 4; y < height; y += step) {
      for (let x = 4; x < width; x += step) {
        const distance = Math.abs(x - originX) + Math.abs(y - originY) * 1.7;
        if (distance > 50 && Math.random() < 0.48) continue;
        pixels.push({
          x, y,
          delay: distance / (Math.max(originX, width - originX) + height * 1.7) * 520,
          size: Math.random() > 0.65 ? 6 : 3,
          strength: 0.36 + Math.random() * 0.57,
        });
      }
    }

    const start = performance.now();
    const drawBurst = (now) => {
      const elapsed = now - start;
      navContext.clearRect(0, 0, width, height);
      if (elapsed >= 780 || reducedMotion.matches) return;
      for (const {x, y, delay, size, strength} of pixels) {
        const age = Math.max(0, elapsed - delay);
        if (elapsed < delay || age >= 230) continue;
        navContext.globalAlpha = (1 - age / 230) * strength;
        const edge = Math.max(1, Math.round(size * (1 - age / 300)));
        navContext.fillRect(x, y, edge, edge);
      }
      navContext.globalAlpha = 1;
      pixelFrame = requestAnimationFrame(drawBurst);
    };
    pixelFrame = requestAnimationFrame(drawBurst);
  });
}

const hero = document.querySelector(".hero");
const replayIntro = new URLSearchParams(location.search).get("intro") === "1";
const reloadingPage = performance.getEntriesByType("navigation")[0]?.type === "reload";
const enteredAtHero = (!location.hash || location.hash === "#inicio") && window.scrollY < 80;
if (hero && !reducedMotion.matches && (enteredAtHero || replayIntro)) {
  let alreadyOpened = false;
  try {
    alreadyOpened = sessionStorage.getItem("niorbdev-print-intro") === "played";
    sessionStorage.setItem("niorbdev-print-intro", "played");
  } catch {
    // The entrance can still play when browser storage is unavailable.
  }

  if (!alreadyOpened || replayIntro || reloadingPage) {
    if (replayIntro) window.scrollTo({top: 0, behavior: "instant"});
    hero.classList.add("is-printing");
    const finishIntro = () => {
      hero.classList.remove("is-printing");
      window.removeEventListener("pointerdown", finishIntro, true);
      window.removeEventListener("keydown", finishIntro, true);
    };
    window.addEventListener("pointerdown", finishIntro, true);
    window.addEventListener("keydown", finishIntro, true);
    window.setTimeout(finishIntro, 1650);
  }
}

const dotCanvas = document.querySelector(".background-dots");
const dotContext = dotCanvas?.getContext("2d");
if (dotContext) {
  const spacing = 5;
  const radius = 82;
  const size = 190;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  dotCanvas.width = size * scale;
  dotCanvas.height = size * scale;
  dotCanvas.style.width = size + "px";
  dotCanvas.style.height = size + "px";
  dotContext.scale(scale, scale);
  const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--noir").trim();

  let cursorX = 0;
  let cursorY = 0;
  let strength = 0;
  let active = false;
  let frame = 0;

  const drawDots = () => {
    frame = 0;
    if (reducedMotion.matches) {
      strength = 0;
      dotCanvas.style.opacity = "0";
      return;
    }

    const target = active ? 1 : 0;
    strength += (target - strength) * 0.16;
    if (Math.abs(target - strength) < 0.01) strength = target;
    dotCanvas.style.opacity = strength === 0 ? "0" : "1";
    if (strength === 0) return;

    const left = Math.round((cursorX - size / 2) / spacing) * spacing;
    const top = Math.round((cursorY - size / 2) / spacing) * spacing;
    dotCanvas.style.transform = `translate3d(${left}px,${top}px,0)`;
    dotContext.fillStyle = backgroundColor;
    dotContext.fillRect(0, 0, size, size);
    for (let y = spacing / 2; y < size; y += spacing) {
      for (let x = spacing / 2; x < size; x += spacing) {
        const dx = left + x - cursorX;
        const dy = top + y - cursorY;
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / radius);
        const shift = 8 * influence ** 2 * strength;
        const direction = distance || 1;
        const opacity = 0.07 + 0.28 * influence * strength;
        dotContext.fillStyle = `rgba(247,246,242,${opacity})`;
        dotContext.beginPath();
        dotContext.arc(x + dx / direction * shift, y + dy / direction * shift, 0.65 + influence * strength * 0.22, 0, 2 * Math.PI);
        dotContext.fill();
      }
    }

    if (strength !== target) frame = requestAnimationFrame(drawDots);
  };

  const queueDots = () => {
    if (!frame) frame = requestAnimationFrame(drawDots);
  };
  const resetDots = () => {
    active = false;
    queueDots();
  };

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || reducedMotion.matches) return;
    cursorX = event.clientX;
    cursorY = event.clientY;
    active = true;
    queueDots();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", resetDots);
  window.addEventListener("blur", resetDots);
  reducedMotion.addEventListener("change", resetDots);
}

const animeArtwork = [
  {
    src: "assets/gallery/anime/ado-live-cover.webp",
    alt: "Retrato editorial inspirado en Ado, con tinta noir y ámbar.",
    href: "https://jpop.fandom.com/wiki/Ado",
    linkLabel: "Ado en Jpop Wiki",
  },
  {
    src: "assets/gallery/anime/makima.webp",
    alt: "Lámina editorial de Makima, del universo Chainsaw Man.",
    href: "https://chainsaw-man.fandom.com/wiki/Chainsaw_Man_%28Manga%29",
    linkLabel: "Wiki del manga Chainsaw Man",
  },
  {
    src: "assets/gallery/anime/one-piece.webp",
    alt: "Ilustración de personajes de One Piece en una composición impresa.",
    href: "https://onepiece.fandom.com/wiki/One_Piece_%28Manga%29",
    linkLabel: "Wiki del manga One Piece",
  },
  {
    src: "assets/gallery/anime/anime-cat.webp",
    alt: "Ilustración de El pecado original de Takopi.",
    href: "https://takopis-original-sin.fandom.com/wiki/Takopi%27s_Original_Sin_Wiki",
    linkLabel: "Wiki de El pecado original de Takopi",
  },
  {
    src: "assets/gallery/anime/flower-nobility.webp",
    alt: "Ilustración editorial de La nobleza de las flores.",
    href: "https://kaoruhana.fandom.com/wiki/Kaoru_Hana_wa_Rin_to_Saku_Wiki",
    linkLabel: "Wiki de La nobleza de las flores",
  },
  {
    src: "assets/gallery/anime/goodbye-eri.webp",
    alt: "Ilustración de Goodbye, Eri con estética de fotocopia.",
    href: "https://www.viz.com/goodbye-eri",
    linkLabel: "Ficha oficial de Goodbye, Eri",
  },
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
  const link = image.closest(".mosaic-art-link");
  link.href = selectedAnime.href;
  link.setAttribute("aria-label", selectedAnime.linkLabel + " (abre en otra pestaña)");
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
    clone.querySelectorAll("a").forEach((link) => { link.tabIndex = -1; });
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

const projectsSection = document.querySelector("#proyectos");
const projectsPress = document.querySelector(".projects-press");
const projectSheets = Array.from(document.querySelectorAll("[data-project-sheet]"));
const prevSheetBtn = document.querySelector("[data-sheet-prev]");
const nextSheetBtn = document.querySelector("[data-sheet-next]");
const sheetStatus = document.querySelector("[data-sheet-status]");
const sheetAside = projectsSection?.querySelector(".section-aside");
const darkroomToggles = Array.from(document.querySelectorAll("[data-darkroom-toggle]"));
const darkroomPill = document.querySelector(".darkroom-pill");
const projectCards = Array.from(document.querySelectorAll(".projects .project-card"));

if (projectsSection && projectsPress && projectSheets.length) {
  let activeSheet = 0;
  let pressTimer = 0;
  let initialPassPlayed = false;

  const triggerPressPass = () => {
    if (reducedMotion.matches) return;
    window.clearTimeout(pressTimer);
    projectsPress.classList.remove("is-printing");
    void projectsPress.offsetWidth;
    projectsPress.classList.add("is-printing");
    pressTimer = window.setTimeout(() => {
      projectsPress.classList.remove("is-printing");
    }, 1050);
  };

  const renderSheet = (nextIndex, animatePass) => {
    activeSheet = Math.max(0, Math.min(projectSheets.length - 1, nextIndex));
    projectSheets.forEach((sheet, index) => {
      const isCurrent = index === activeSheet;
      sheet.hidden = !isCurrent;
      sheet.classList.toggle("is-active-sheet", isCurrent);
    });
    const currentSheet = projectSheets[activeSheet];
    if (sheetAside && currentSheet.dataset.sheetNote) {
      sheetAside.textContent = currentSheet.dataset.sheetNote;
    }
    if (sheetStatus) {
      const cur = String(activeSheet + 1).padStart(2, "0");
      const tot = String(projectSheets.length).padStart(2, "0");
      sheetStatus.textContent = `PLIEGO ${cur} / ${tot}`;
    }
    if (prevSheetBtn) prevSheetBtn.disabled = activeSheet === 0;
    if (nextSheetBtn) nextSheetBtn.disabled = activeSheet === projectSheets.length - 1;
    if (animatePass) triggerPressPass();
  };

  prevSheetBtn?.addEventListener("click", () => renderSheet(activeSheet - 1, true));
  nextSheetBtn?.addEventListener("click", () => renderSheet(activeSheet + 1, true));
  renderSheet(0, false);

  if ("IntersectionObserver" in window) {
    const pressObserver = new IntersectionObserver((entries, activeObserver) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (!initialPassPlayed) {
          initialPassPlayed = true;
          triggerPressPass();
        }
        activeObserver.disconnect();
      }
    }, { threshold: 0.16 });
    pressObserver.observe(projectsPress);
  }

  const setDarkroom = (enabled) => {
    document.documentElement.classList.toggle("is-darkroom", enabled);
    darkroomToggles.forEach((button) => {
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    if (darkroomPill) darkroomPill.hidden = !enabled;
  };

  darkroomToggles.forEach((button) => {
    button.addEventListener("click", () => {
      setDarkroom(!document.documentElement.classList.contains("is-darkroom"));
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.documentElement.classList.contains("is-darkroom")) {
      setDarkroom(false);
    }
  });

  projectCards.forEach((card) => {
    const plateButtons = Array.from(card.querySelectorAll("[data-plate-src]"));
    const xrayImg = card.querySelector("[data-xray-img]");
    if (xrayImg && plateButtons.length) {
      plateButtons.forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          xrayImg.src = btn.dataset.plateSrc;
          plateButtons.forEach((other) => other.classList.toggle("is-selected", other === btn));
        });
      });
    }
  });
}
