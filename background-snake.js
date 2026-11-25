(() => {
  const canvas = document.querySelector(".background-snake");
  const context = canvas?.getContext("2d");
  const inkCanvas = document.querySelector(".gesture-ink");
  const ink = inkCanvas?.getContext("2d");
  if (!context || !ink) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = getComputedStyle(document.documentElement);
  const amber = palette.getPropertyValue("--amber").trim();
  const ivory = palette.getPropertyValue("--ivory").trim();
  const header = document.querySelector(".site-header");
  const panels = [...document.querySelectorAll(".hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ticker")];
  const cellSize = 10;
  const initialLength = 5;
  const maxLength = 18;
  let columns = 0;
  let rows = 0;
  let firstRow = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let hiddenCells;
  let body = [];
  let food;
  const queuedFood = new Set();
  let route = [];
  let layoutChanged = true;
  let timer;
  let scrollFrame = 0;
  const trails = [];
  const fadeDuration = 1000;
  let activeTrail;
  let pendingTouch;
  let trailFrame = 0;
  let suppressClick = false;

  function isBackground(event) {
    return !event.target.closest("header,a,button,input,select,textarea,h1,h2,h3,p,.hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ticker");
  }

  function canDraw(event) {
    return !event.target.closest("header,footer,a,button,input,select,textarea,label,[contenteditable]");
  }

  function neighbors(cell) {
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    const next = [];
    if (x > 0) next.push(cell - 1);
    if (x < columns - 1) next.push(cell + 1);
    if (y > firstRow) next.push(cell - columns);
    if (y < rows - 1) next.push(cell + columns);
    return next;
  }

  function readPanels() {
    rows = Math.max(1, Math.floor(document.documentElement.scrollHeight / cellSize));
    firstRow = Math.min(rows, Math.ceil((header?.offsetHeight ?? 0) / cellSize));
    hiddenCells = new Uint8Array(columns * rows);
    const scrollTop = window.scrollY;
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      const left = Math.max(0, Math.ceil(rect.left / cellSize - 0.5));
      const right = Math.min(columns, Math.ceil(rect.right / cellSize - 0.5));
      const top = Math.max(0, Math.ceil((rect.top + scrollTop) / cellSize - 0.5));
      const bottom = Math.min(rows, Math.ceil((rect.bottom + scrollTop) / cellSize - 0.5));
      for (let y = top; y < bottom; y++) {
        if (left < right) hiddenCells.fill(1, y * columns + left, y * columns + right);
      }
    }
    layoutChanged = false;
    route = [];
    const boundary = firstRow * columns;
    for (const cell of queuedFood) {
      if (cell < boundary || cell >= hiddenCells.length) queuedFood.delete(cell);
    }
    if (food < boundary || food >= hiddenCells.length || hiddenCells[food]) food = undefined;
  }

  // Breadth-first search gives the shortest route on a four-direction grid.
  function search(target, stayVisible) {
    const head = body[0];
    const blocked = new Set(body.slice(1, -1));
    const parent = new Int32Array(columns * rows).fill(-1);
    const queue = [head];
    parent[head] = head;
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (cell === target) break;
      for (const next of neighbors(cell)) {
        if (parent[next] !== -1 || blocked.has(next) || (stayVisible && hiddenCells[next])) continue;
        parent[next] = cell;
        queue.push(next);
      }
    }
    if (target === undefined) return queue;

    const path = [];
    if (parent[target] === -1) return path;
    for (let cell = target; cell !== head; cell = parent[cell]) path.push(cell);
    return path.reverse();
  }

  function placeFood() {
    const unoccupied = cell => !body.includes(cell) && !queuedFood.has(cell);
    const cells = search(undefined, true);
    const choices = cells.slice(5, 280).filter(unoccupied);
    if (!choices.length) {
      const open = search(undefined, false).filter(cell => !hiddenCells[cell] && unoccupied(cell));
      food = open[Math.floor(Math.random() * open.length)];
      return;
    }
    food = choices[Math.floor(Math.random() * choices.length)];
  }

  function seedBody() {
    const cells = [];
    for (let y = firstRow; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const head = y * columns + x;
        if (x >= initialLength - 1) cells.push([head, 1]);
        if (y >= firstRow + initialLength - 1) cells.push([head, columns]);
      }
    }
    const open = cells.filter(([head, stride]) => {
      for (let i = 0; i < initialLength; i++) {
        if (hiddenCells[head - i * stride]) return false;
      }
      return true;
    });
    const top = window.scrollY + (header?.offsetHeight ?? 0);
    const inView = open.filter(([head, stride]) => {
      const firstY = Math.floor((head - (initialLength - 1) * stride) / columns) * cellSize;
      const lastY = Math.floor(head / columns) * cellSize + cellSize;
      return firstY >= top && lastY <= window.scrollY + viewportHeight;
    });
    const candidates = inView.length ? inView : open;
    const [head, stride] = candidates[Math.floor(Math.random() * candidates.length)] || cells[0] || [firstRow * columns, 1];
    body = Array.from({length: cells.length ? initialLength : 1}, (_, i) => head - i * stride);
    route = [];
  }

  function draw() {
    const scrollTop = window.scrollY;
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.save();
    context.beginPath();
    context.rect(0, headerBottom, viewportWidth, Math.max(0, viewportHeight - headerBottom));
    context.clip();
    context.translate(0, -scrollTop);
    for (let i = body.length - 1; i >= 0; i--) {
      const cell = body[i];
      const x = cell % columns * cellSize;
      const y = Math.floor(cell / columns) * cellSize;
      context.globalAlpha = i === 0 ? 0.84 : 0.54 - i / maxLength * 0.23;
      context.fillStyle = amber;
      context.fillRect(x + 1, y + 1, 8, 8);
      if (i === 0) {
        context.globalAlpha = 0.8;
        context.fillStyle = ivory;
        context.fillRect(x + 4, y + 4, 2, 2);
      }
    }
    if (food !== undefined) drawFood(food, false);
    for (const cell of queuedFood) drawFood(cell, true);
    context.restore();
  }

  function drawTrails(now) {
    ink.clearRect(0, 0, viewportWidth, viewportHeight);
    ink.save();
    ink.translate(0, -window.scrollY);
    ink.strokeStyle = amber;
    ink.lineWidth = 3;
    ink.lineCap = "round";
    ink.lineJoin = "round";
    for (let i = trails.length - 1; i >= 0; i--) {
      const {points, length, releasedAt} = trails[i];
      if (!length) continue;
      const progress = releasedAt === undefined ? 0 : (now - releasedAt) / fadeDuration;
      if (progress >= 1) {
        trails.splice(i, 1);
        continue;
      }

      const erasedLength = progress * length;
      const start = points.findIndex(point => point.distance > erasedLength);
      if (start < 1) continue;
      const previous = points[start - 1];
      const next = points[start];
      const fraction = (erasedLength - previous.distance) / (next.distance - previous.distance);
      ink.globalAlpha = 0.94 * (1 - progress * 0.6);
      ink.beginPath();
      ink.moveTo(previous.x + (next.x - previous.x) * fraction, previous.y + (next.y - previous.y) * fraction);
      for (let j = start; j < points.length; j++) ink.lineTo(points[j].x, points[j].y);
      ink.stroke();
    }
    ink.restore();
  }

  function animateTrails() {
    trailFrame = 0;
    drawTrails(performance.now());
    if (trails.some(trail => trail.releasedAt !== undefined)) {
      trailFrame = requestAnimationFrame(animateTrails);
    }
  }

  function drawFood(cell, requested) {
    const x = cell % columns * cellSize;
    const y = Math.floor(cell / columns) * cellSize;
    context.globalAlpha = requested ? 0.95 : 0.68;
    context.fillStyle = requested ? ivory : amber;
    context.fillRect(x + 3, y + 3, 4, 4);
    if (requested) {
      context.strokeStyle = amber;
      context.strokeRect(x + 0.5, y + 0.5, 9, 9);
    }
  }

  function tick() {
    if (document.hidden) return;
    if (layoutChanged) readPanels();
    if (firstRow >= rows) {
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      return;
    }
    if (!body.length || body.some(cell => cell < firstRow * columns || cell >= hiddenCells.length)) seedBody();
    if (food === undefined) placeFood();
    const target = queuedFood.values().next().value ?? food;
    if (target !== undefined && !route.length) {
      route = search(target, true);
      if (!route.length) route = search(target, false);
    }

    const blocked = new Set(body.slice(0, -1));
    let next = route.shift();
    if (next === undefined || blocked.has(next)) {
      route = [];
      const choices = neighbors(body[0]).filter(cell => !blocked.has(cell));
      next = choices.find(cell => !hiddenCells[cell]) ?? choices[0];
    }
    if (next === undefined) {
      seedBody();
      draw();
      return;
    }

    body.unshift(next);
    const pickedRequestedFood = queuedFood.delete(next);
    const pickedRandomFood = next === food;
    if (pickedRequestedFood || pickedRandomFood) {
      route = [];
      if (body.length > maxLength) body.pop();
      if (pickedRandomFood) placeFood();
    } else {
      body.pop();
    }
    draw();
  }

  function sizeCanvases() {
    viewportWidth = document.documentElement.clientWidth;
    viewportHeight = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewportWidth * scale);
    canvas.height = Math.round(viewportHeight * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    inkCanvas.width = canvas.width;
    inkCanvas.height = canvas.height;
    ink.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function resize() {
    sizeCanvases();
    columns = Math.max(1, Math.floor(viewportWidth / cellSize));
    food = undefined;
    queuedFood.clear();
    readPanels();
    if (firstRow >= rows) return;
    seedBody();
    placeFood();
    draw();
  }

  function startTrail(event, pointerId) {
    activeTrail = {
      pointerId,
      points: [{x: event.clientX, y: event.clientY + window.scrollY, distance: 0}],
      length: 0,
    };
    trails.push(activeTrail);
  }

  window.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (event.pointerType === "touch" || event.button !== 0 || !canDraw(event)) return;
    startTrail(event, event.pointerId);
    event.preventDefault();
  });

  function extendTrail(event) {
    const point = {x: event.clientX, y: event.clientY + window.scrollY};
    const previous = activeTrail.points.at(-1);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < (activeTrail.length ? 2 : 5)) return;
    activeTrail.length += distance;
    activeTrail.points.push({...point, distance: activeTrail.length});
    drawTrails(performance.now());
  }

  window.addEventListener("pointermove", event => {
    if (activeTrail?.pointerId === event.pointerId && (event.buttons & 1)) extendTrail(event);
  }, {passive: true});

  function releaseTrail(event) {
    if (!activeTrail || (event && activeTrail.pointerId !== event.pointerId)) return;
    if (event?.type === "pointerup" && activeTrail.length) extendTrail(event);
    if (activeTrail.length) {
      suppressClick = true;
      if (reducedMotion.matches) {
        trails.splice(trails.indexOf(activeTrail), 1);
        drawTrails(performance.now());
      } else {
        activeTrail.releasedAt = performance.now();
        if (!trailFrame) trailFrame = requestAnimationFrame(animateTrails);
      }
    } else {
      trails.splice(trails.indexOf(activeTrail), 1);
    }
    activeTrail = undefined;
  }
  window.addEventListener("pointerup", releaseTrail);
  window.addEventListener("pointercancel", releaseTrail);
  window.addEventListener("blur", () => {
    pendingTouch = undefined;
    releaseTrail();
  });

  window.addEventListener("touchstart", event => {
    if (event.touches.length !== 1 || !canDraw(event)) return;
    pendingTouch = {touch: event.touches[0], startedAt: performance.now()};
  }, {passive: true});
  window.addEventListener("contextmenu", event => {
    if (pendingTouch && canDraw(event)) event.preventDefault();
  });
  window.addEventListener("touchmove", event => {
    if (!pendingTouch || event.touches.length !== 1) {
      if (pendingTouch && activeTrail?.pointerId === "touch") releaseTrail();
      pendingTouch = undefined;
      return;
    }
    const touch = event.touches[0];
    if (activeTrail?.pointerId !== "touch") {
      const origin = pendingTouch.touch;
      if (performance.now() - pendingTouch.startedAt < 260) {
        if (Math.hypot(touch.clientX - origin.clientX, touch.clientY - origin.clientY) > 7) pendingTouch = undefined;
        return;
      }
      if (!event.cancelable) return;
      startTrail(origin, "touch");
    }
    if (event.cancelable) event.preventDefault();
    extendTrail(touch);
  }, {passive: false});
  for (const type of ["touchend", "touchcancel"]) {
    window.addEventListener(type, () => {
      pendingTouch = undefined;
      if (activeTrail?.pointerId === "touch") releaseTrail();
    }, {passive: true});
  }

  window.addEventListener("click", event => {
    if (reducedMotion.matches || (event.pointerType && event.pointerType !== "mouse")) return;
    if (event.detail && suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    if (!event.detail || !isBackground(event)) return;
    const x = Math.floor(event.clientX / cellSize);
    const y = Math.floor((event.clientY + window.scrollY) / cellSize);
    if (layoutChanged) readPanels();
    if (x < 0 || x >= columns || y < 0 || y >= rows) return;
    const cell = y * columns + x;
    if (y < firstRow) return;
    if (body.includes(cell) || queuedFood.has(cell)) return;
    if (!queuedFood.size) route = [];
    if (cell === food) food = undefined;
    queuedFood.add(cell);
    draw();
  });
  window.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!reducedMotion.matches) draw();
      if (trails.length) drawTrails(performance.now());
    });
  }, {passive: true});
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => { layoutChanged = true; }).observe(document.body);
  }
  window.addEventListener("resize", () => {
    if (reducedMotion.matches) sizeCanvases();
    else resize();
    if (trails.length) drawTrails(performance.now());
  }, {passive: true});
  const syncMotion = () => {
    window.clearInterval(timer);
    cancelAnimationFrame(trailFrame);
    trailFrame = 0;
    activeTrail = undefined;
    trails.length = 0;
    if (reducedMotion.matches) {
      sizeCanvases();
      return;
    }
    resize();
    timer = window.setInterval(tick, 112);
  };
  reducedMotion.addEventListener("change", syncMotion);
  syncMotion();
})();
