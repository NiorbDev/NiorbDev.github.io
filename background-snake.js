(() => {
  const canvas = document.querySelector(".background-snake");
  const context = canvas?.getContext("2d");
  if (!context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = getComputedStyle(document.documentElement);
  const amber = palette.getPropertyValue("--amber").trim();
  const ivory = palette.getPropertyValue("--ivory").trim();
  const panels = [...document.querySelectorAll(".hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ticker")];
  const cellSize = 10;
  const initialLength = 5;
  const maxLength = 18;
  let columns = 0;
  let rows = 0;
  let hiddenCells;
  let body = [];
  let food;
  let requested = false;
  let route = [];
  let layoutChanged = true;
  let timer;

  function neighbors(cell) {
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    const next = [];
    if (x > 0) next.push(cell - 1);
    if (x < columns - 1) next.push(cell + 1);
    if (y > 0) next.push(cell - columns);
    if (y < rows - 1) next.push(cell + columns);
    return next;
  }

  function readPanels() {
    hiddenCells = new Uint8Array(columns * rows);
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      const left = Math.max(0, Math.ceil(rect.left / cellSize - 0.5));
      const right = Math.min(columns, Math.ceil(rect.right / cellSize - 0.5));
      const top = Math.max(0, Math.ceil(rect.top / cellSize - 0.5));
      const bottom = Math.min(rows, Math.ceil(rect.bottom / cellSize - 0.5));
      for (let y = top; y < bottom; y++) {
        if (left < right) hiddenCells.fill(1, y * columns + left, y * columns + right);
      }
    }
    layoutChanged = false;
    route = [];
    if (!requested && hiddenCells[food]) food = undefined;
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
    const cells = search(undefined, true);
    const choices = cells.slice(5, 280).filter(cell => !body.includes(cell));
    if (!choices.length) {
      const open = search(undefined, false).filter(cell => !hiddenCells[cell] && !body.includes(cell));
      food = open[Math.floor(Math.random() * open.length)];
      return;
    }
    food = choices[Math.floor(Math.random() * choices.length)];
  }

  function seedBody() {
    const cells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const head = y * columns + x;
        if (x >= initialLength - 1) cells.push([head, 1]);
        if (y >= initialLength - 1) cells.push([head, columns]);
      }
    }
    const open = cells.filter(([head, stride]) => {
      for (let i = 0; i < initialLength; i++) {
        if (hiddenCells[head - i * stride]) return false;
      }
      return true;
    });
    const [head, stride] = open[Math.floor(Math.random() * open.length)] || cells[0] || [0, 1];
    body = Array.from({length: cells.length ? initialLength : 1}, (_, i) => head - i * stride);
    route = [];
  }

  function draw() {
    context.clearRect(0, 0, columns * cellSize, rows * cellSize);
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
    if (food !== undefined) {
      const x = food % columns * cellSize;
      const y = Math.floor(food / columns) * cellSize;
      context.globalAlpha = requested ? 0.95 : 0.68;
      context.fillStyle = requested ? ivory : amber;
      context.fillRect(x + 3, y + 3, 4, 4);
      if (requested) {
        context.strokeStyle = amber;
        context.strokeRect(x + 0.5, y + 0.5, 9, 9);
      }
    }
    context.globalAlpha = 1;
  }

  function tick() {
    if (document.hidden) return;
    if (layoutChanged) readPanels();
    if (food === undefined) placeFood();
    if (food !== undefined && !route.length) {
      route = search(food, true);
      if (!route.length) route = search(food, false);
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
    if (next === food) {
      requested = false;
      food = undefined;
      route = [];
      if (body.length > maxLength) body.pop();
      placeFood();
    } else {
      body.pop();
    }
    draw();
  }

  function resize() {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    columns = Math.max(1, Math.floor(width / cellSize));
    rows = Math.max(1, Math.floor(height / cellSize));
    food = undefined;
    requested = false;
    readPanels();
    seedBody();
    placeFood();
    draw();
  }

  window.addEventListener("click", event => {
    if (reducedMotion.matches || (event.pointerType && event.pointerType !== "mouse")) return;
    if (!event.detail || event.target.closest("a,button,input,select,textarea,h1,h2,h3,p,.hero-photo-panel,.hero-gallery,.project-card,.toolkit-panel,.ticker")) return;
    const x = Math.floor(event.clientX / cellSize);
    const y = Math.floor(event.clientY / cellSize);
    if (x < 0 || x >= columns || y < 0 || y >= rows) return;
    const cell = y * columns + x;
    if (layoutChanged) readPanels();
    if (body.includes(cell)) return;
    food = cell;
    requested = true;
    route = [];
    draw();
  });
  window.addEventListener("scroll", () => { layoutChanged = true; }, {passive: true});
  window.addEventListener("resize", () => { if (!reducedMotion.matches) resize(); }, {passive: true});
  const syncMotion = () => {
    window.clearInterval(timer);
    if (reducedMotion.matches) return;
    resize();
    timer = window.setInterval(tick, 112);
  };
  reducedMotion.addEventListener("change", syncMotion);
  syncMotion();
})();
