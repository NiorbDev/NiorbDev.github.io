(() => {
  const fish = document.querySelector(".fish-egg");
  const sound = document.querySelector("#fih-sound");
  if (!fish || !sound) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const profiles = [
    // Oval body and a triangular tail that meet at the same point.
    [[0, 0], [18, -17], [43, -27], [68, -27], [90, -18], [100, 0], [90, 18], [68, 27], [43, 27], [18, 17], [0, 0], [-24, -23], [-24, 23], [0, 0]],
    // The same outline with the tail drawn as part of the perimeter.
    [[0, -7], [22, -20], [46, -28], [72, -25], [93, -14], [100, 0], [93, 14], [72, 25], [46, 28], [22, 20], [0, 7], [-29, 25], [-29, -25], [0, -7]],
    // A fish drawn as a single crossing loop, with an open tail.
    [[-29, -25], [0, 0], [24, 19], [50, 28], [75, 23], [97, 7], [100, 0], [94, -9], [73, -23], [50, -28], [25, -19], [0, 0], [-29, 25]],
  ].flatMap(profile => [profile, profile.map(([x, y]) => [-x, y])]);

  function sampleStrokes(strokes) {
    return strokes.flatMap(points => {
      if (points.length < 2) return points;
      const lengths = points.slice(1).map(([x, y], index) =>
        Math.hypot(x - points[index][0], y - points[index][1]));
      const step = Math.max(1, lengths.reduce((sum, length) => sum + length, 0) / 64);
      const samples = [points[0]];
      let offset = step;
      lengths.forEach((length, index) => {
        const [x, y] = points[index];
        const [endX, endY] = points[index + 1];
        while (offset < length) {
          const fraction = offset / length;
          samples.push([x + (endX - x) * fraction, y + (endY - y) * fraction]);
          offset += step;
        }
        offset -= length;
      });
      samples.push(points.at(-1));
      return samples;
    });
  }

  function normalize(samples) {
    const xs = samples.map(point => point[0]);
    const ys = samples.map(point => point[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    if (width < 36 || height < 14 || width / height < 1.15 || width / height > 5.5) return [];
    return samples.map(([x, y]) => [(x - left) / width, (y - top) / height]);
  }

  const rotations = Array.from({length: 24}, (_, index) => {
    const angle = index * Math.PI / 12;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const references = profiles.map(profile => normalize(sampleStrokes([profile])));

  function distances(source, target) {
    let total = 0;
    let furthest = 0;
    for (const [x, y] of source) {
      let nearest = Infinity;
      for (const [otherX, otherY] of target) {
        nearest = Math.min(nearest, (x - otherX) ** 2 + (y - otherY) ** 2);
      }
      total += nearest;
      furthest = Math.max(furthest, nearest);
    }
    return {average: Math.sqrt(total / source.length), furthest: Math.sqrt(furthest)};
  }

  function looksLikeFish(strokes) {
    const samples = sampleStrokes(strokes);
    if (samples.length < 20) return false;
    return rotations.some(([cos, sin]) => {
      const points = normalize(samples.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]));
      if (!points.length) return false;
      return references.some(reference => {
        const coverage = distances(reference, points);
        return coverage.average < 0.089 && coverage.furthest < 0.2
          && distances(points, reference).average < 0.116;
      });
    });
  }

  let previousStroke;
  let lastStrokeAt = 0;
  let playing = false;
  function showFish() {
    playing = true;
    fish.hidden = false;
    sound.currentTime = 0;
    sound.volume = 0.65;
    sound.play().catch(() => {});
    const landing = Math.round(window.innerHeight * 0.53 - fish.offsetHeight / 2);
    const frames = reducedMotion.matches
      ? [{transform: "translate(-50%, 30vh)", opacity: 1}, {transform: "translate(-50%, 30vh)", opacity: 1, offset: 0.8}, {transform: "translate(-50%, 30vh)", opacity: 0}]
      : [
          {transform: "translate(-50%, -115%) rotate(-24deg)", easing: "cubic-bezier(.38,0,.76,.5)"},
          {transform: `translate(-50%, ${landing}px) rotate(13deg)`, offset: 0.37},
          {transform: `translate(-50%, ${landing - 34}px) rotate(-8deg)`, offset: 0.49},
          {transform: `translate(-50%, ${landing}px) rotate(0deg)`, offset: 0.62},
          {transform: `translate(-50%, ${landing}px) rotate(0deg)`, offset: 0.79, easing: "ease-in"},
          {transform: "translate(-50%, 110vh) rotate(19deg)"},
        ];
    const animation = fish.animate(frames, {duration: 1880, fill: "both"});
    animation.addEventListener("finish", () => {
      fish.hidden = true;
      animation.cancel();
      playing = false;
    }, {once: true});
  }

  window.addEventListener("portfolio:stroke", event => {
    if (playing) return;
    const points = event.detail.map(({x, y}) => [x, y]);
    const now = performance.now();
    const matches = looksLikeFish([points])
      || (previousStroke && now - lastStrokeAt < 4500 && looksLikeFish([previousStroke, points]));
    previousStroke = matches ? undefined : points;
    lastStrokeAt = now;
    if (matches) showFish();
  });
})();
