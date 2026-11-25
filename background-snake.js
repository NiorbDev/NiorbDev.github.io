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
  const panels = [...document.querySelectorAll(".hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ai-panel,.ai-examples,.case-photo,.social-list,.ticker")];
  const cellSize = 10;
  const initialLength = 5;
  const maxLength = 18;
  let columns = 0;
  let rows = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let hiddenCells;
  const snakes = Array.from(document.querySelectorAll("main > section"), section => ({
    section, startRow: 0, endRow: 0, body: [], food: undefined, queuedFood: new Set(), route: [],
  }));
  let layoutChanged = true;
  let timer;
  let scrollFrame = 0;
  let snakePaintBounds;
  const trails = [];
  const fadeDuration = 1000;
  let activeTrail;
  let pendingTouch;
  let trailFrame = 0;
  let suppressClick = false;

  function isBackground(event) {
    return !event.target.closest("header,a,button,input,select,textarea,h1,h2,h3,p,.hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ai-panel,.ai-examples,.case-photo,.social-list,.ticker");
  }

  function canDraw(event) {
    return !event.target.closest("header,footer,a,button,input,select,textarea,label,[contenteditable]");
  }

  function neighbors(snake, cell) {
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    const next = [];
    if (x > 0) next.push(cell - 1);
    if (x < columns - 1) next.push(cell + 1);
    if (y > snake.startRow) next.push(cell - columns);
    if (y < snake.endRow - 1) next.push(cell + columns);
    return next;
  }

  function readPanels() {
    rows = Math.max(1, Math.floor(document.documentElement.scrollHeight / cellSize));
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
    for (const snake of snakes) {
      const {section} = snake;
      let top = 0;
      for (let node = section; node; node = node.offsetParent) top += node.offsetTop;
      let bottom = top + section.offsetHeight;
      const before = section.previousElementSibling;
      const after = section.nextElementSibling;
      if (before?.matches(".ticker")) top = Math.max(top, before.getBoundingClientRect().bottom + scrollTop);
      if (after?.matches(".ticker")) bottom = Math.min(bottom, after.getBoundingClientRect().top + scrollTop);
      snake.startRow = Math.max(0, Math.ceil(top / cellSize));
      snake.endRow = Math.min(rows, Math.floor(bottom / cellSize));
      const start = snake.startRow * columns;
      const end = snake.endRow * columns;
      const inside = cell => cell >= start && cell < end;
      snake.route = [];
      if (!snake.body.every(inside)) snake.body = [];
      for (const cell of snake.queuedFood) {
        if (!inside(cell) || hiddenCells[cell]) snake.queuedFood.delete(cell);
      }
      if (!inside(snake.food) || hiddenCells[snake.food]) snake.food = undefined;
    }
    layoutChanged = false;
  }

  // Limit the shortest-path search to the snake's own section.
  function search(snake, target, stayVisible) {
    const head = snake.body[0];
    const blocked = new Set(snake.body.slice(1, -1));
    const start = snake.startRow * columns;
    const parent = new Int32Array((snake.endRow - snake.startRow) * columns).fill(-1);
    const queue = [head];
    parent[head - start] = head;
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (cell === target) break;
      for (const next of neighbors(snake, cell)) {
        if (parent[next - start] !== -1 || blocked.has(next) || (stayVisible && hiddenCells[next])) continue;
        parent[next - start] = cell;
        queue.push(next);
      }
    }
    if (target === undefined) return queue;

    const path = [];
    if (parent[target - start] === -1) return path;
    for (let cell = target; cell !== head; cell = parent[cell - start]) path.push(cell);
    return path.reverse();
  }

  function placeFood(snake) {
    const unoccupied = cell => !snake.body.includes(cell) && !snake.queuedFood.has(cell);
    let choices = search(snake, undefined, true).slice(5, 280).filter(unoccupied);
    if (!choices.length) {
      choices = search(snake, undefined, false).filter(cell => !hiddenCells[cell] && unoccupied(cell));
    }
    snake.food = choices[Math.floor(Math.random() * choices.length)];
  }

  function seedBody(snake) {
    const open = [];
    const singles = [];
    const fits = (head, stride) => {
      for (let i = 1; i < initialLength; i++) {
        if (hiddenCells[head - i * stride]) return false;
      }
      return true;
    };
    for (let y = snake.startRow; y < snake.endRow; y++) {
      for (let x = 0; x < columns; x++) {
        const head = y * columns + x;
        if (hiddenCells[head]) continue;
        singles.push(head);
        if (x >= initialLength - 1 && fits(head, 1)) open.push([head, 1]);
        if (y >= snake.startRow + initialLength - 1 && fits(head, columns)) open.push([head, columns]);
      }
    }
    const top = window.scrollY + (header?.offsetHeight ?? 0);
    const bottom = window.scrollY + viewportHeight;
    const inView = open.filter(([head, stride]) =>
      Math.floor((head - (initialLength - 1) * stride) / columns) * cellSize >= top
      && (Math.floor(head / columns) + 1) * cellSize <= bottom);
    const choices = inView.length ? inView : open;
    const candidate = choices[Math.floor(Math.random() * choices.length)];
    const single = singles[Math.floor(Math.random() * singles.length)];
    snake.body = candidate
      ? Array.from({length:initialLength}, (_, i) => candidate[0] - i * candidate[1])
      : single === undefined ? [] : [single];
    snake.route = [];
  }

  function draw() {
    const scrollTop = window.scrollY;
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    if (snakePaintBounds) {
      const [left, top, right, bottom] = snakePaintBounds;
      context.clearRect(left, top, right - left, bottom - top);
    }
    let left = viewportWidth;
    let top = viewportHeight;
    let right = 0;
    let bottom = 0;
    const includeCell = (x, y) => {
      const screenY = y - scrollTop;
      if (screenY >= viewportHeight || screenY + cellSize <= headerBottom) return false;
      left = Math.min(left, x);
      top = Math.min(top, Math.floor(screenY));
      right = Math.max(right, x + cellSize);
      bottom = Math.max(bottom, Math.ceil(screenY + cellSize));
      return true;
    };
    context.save();
    context.beginPath();
    context.rect(0, headerBottom, viewportWidth, Math.max(0, viewportHeight - headerBottom));
    context.clip();
    context.translate(0, -scrollTop);
    for (const {body, food, queuedFood} of snakes) {
      for (let i = body.length - 1; i >= 0; i--) {
        const cell = body[i];
        const x = cell % columns * cellSize;
        const y = Math.floor(cell / columns) * cellSize;
        if (!includeCell(x, y)) continue;
        context.globalAlpha = i === 0 ? 0.84 : 0.54 - i / maxLength * 0.23;
        context.fillStyle = amber;
        context.fillRect(x + 1, y + 1, 8, 8);
        if (i === 0) {
          context.globalAlpha = 0.8;
          context.fillStyle = ivory;
          context.fillRect(x + 4, y + 4, 2, 2);
        }
      }
      if (food !== undefined) drawFood(food, false, includeCell);
      for (const cell of queuedFood) drawFood(cell, true, includeCell);
    }
    context.restore();
    snakePaintBounds = right > left ? [left, top, right, bottom] : undefined;
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

  function drawFood(cell, requested, includeCell) {
    const x = cell % columns * cellSize;
    const y = Math.floor(cell / columns) * cellSize;
    if (!includeCell(x, y)) return;
    context.globalAlpha = requested ? 0.95 : 0.68;
    context.fillStyle = requested ? ivory : amber;
    context.fillRect(x + 3, y + 3, 4, 4);
    if (requested) {
      context.strokeStyle = amber;
      context.strokeRect(x + 0.5, y + 0.5, 9, 9);
    }
  }

  function moveSnake(snake) {
    if (!snake.body.length) seedBody(snake);
    if (!snake.body.length) return;
    const {body, queuedFood} = snake;
    if (snake.food === undefined) placeFood(snake);
    const target = queuedFood.values().next().value ?? snake.food;
    if (target !== undefined && !snake.route.length) {
      snake.route = search(snake, target, true);
      if (!snake.route.length) snake.route = search(snake, target, false);
    }

    const blocked = new Set(body.slice(0, -1));
    let next = snake.route.shift();
    if (next === undefined || blocked.has(next)) {
      snake.route = [];
      const choices = neighbors(snake, body[0]).filter(cell => !blocked.has(cell));
      next = choices.find(cell => !hiddenCells[cell]) ?? choices[0];
    }
    if (next === undefined) {
      seedBody(snake);
      return;
    }

    body.unshift(next);
    const pickedRequestedFood = queuedFood.delete(next);
    const pickedRandomFood = next === snake.food;
    if (pickedRequestedFood || pickedRandomFood) {
      snake.route = [];
      if (body.length > maxLength) body.pop();
      if (pickedRandomFood) placeFood(snake);
    } else {
      body.pop();
    }
  }

  function tick() {
    if (document.hidden) return;
    if (layoutChanged) readPanels();
    const viewTop = window.scrollY;
    const viewBottom = viewTop + viewportHeight;
    for (const snake of snakes) {
      if (snake.queuedFood.size || (snake.endRow * cellSize > viewTop && snake.startRow * cellSize < viewBottom)) {
        moveSnake(snake);
      }
    }
    draw();
  }

  function sizeCanvases() {
    viewportWidth = document.documentElement.clientWidth;
    viewportHeight = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewportWidth * scale);
    canvas.height = Math.round(viewportHeight * scale);
    snakePaintBounds = undefined;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    inkCanvas.width = canvas.width;
    inkCanvas.height = canvas.height;
    ink.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function resize() {
    sizeCanvases();
    const previousColumns = columns;
    columns = Math.max(1, Math.floor(viewportWidth / cellSize));
    if (columns !== previousColumns) {
      const remap = cell => cell !== undefined && cell % previousColumns < columns
        ? Math.floor(cell / previousColumns) * columns + cell % previousColumns : undefined;
      for (const snake of snakes) {
        const body = snake.body.map(remap);
        snake.body = body.includes(undefined) ? [] : body;
        snake.food = remap(snake.food);
        snake.queuedFood = new Set(Array.from(snake.queuedFood, remap).filter(cell => cell !== undefined));
      }
    }
    readPanels();
    for (const snake of snakes) {
      if (!snake.body.length) seedBody(snake);
      if (snake.body.length && snake.food === undefined) placeFood(snake);
    }
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
    if (!trailFrame) trailFrame = requestAnimationFrame(animateTrails);
  }

  window.addEventListener("pointermove", event => {
    if (activeTrail?.pointerId === event.pointerId && (event.buttons & 1)) extendTrail(event);
  }, {passive: true});

  function releaseTrail(event) {
    if (!activeTrail || (event?.pointerId !== undefined && activeTrail.pointerId !== event.pointerId)) return;
    if (event?.type === "pointerup" && activeTrail.length) extendTrail(event);
    if (activeTrail.length) {
      suppressClick = true;
      if (event?.type === "pointerup" || event?.type === "touchend") {
        window.dispatchEvent(new CustomEvent("portfolio:stroke", {detail: activeTrail.points}));
      }
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
    window.addEventListener(type, event => {
      pendingTouch = undefined;
      if (activeTrail?.pointerId === "touch") releaseTrail(event);
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
    const snake = snakes.find(({startRow, endRow}) => y >= startRow && y < endRow);
    if (!snake || hiddenCells[cell] || snake.body.includes(cell) || snake.queuedFood.has(cell)) return;
    if (!snake.queuedFood.size) snake.route = [];
    if (cell === snake.food) snake.food = undefined;
    snake.queuedFood.add(cell);
    draw();
  });
  window.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!reducedMotion.matches) {
        if (layoutChanged) readPanels();
        draw();
      }
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
