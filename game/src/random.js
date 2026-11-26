// Seeded randomness: the same seed always grows the same islands, so the
// course, the screenshots and every replay agree with each other.

// Mulberry32 — a small, fast seeded PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise on a fixed grid, smoothed so hills roll instead of spike.
// gridSize cells across the world; the grid is seeded once per octave.
export function makeValueNoise(seed, gridSize) {
  const rng = makeRng(seed);
  const size = gridSize + 1;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng() * 2 - 1;

  const at = (gx, gz) => {
    const x = ((gx % gridSize) + gridSize) % gridSize;
    const z = ((gz % gridSize) + gridSize) % gridSize;
    return grid[z * size + x];
  };
  const smooth = (t) => t * t * (3 - 2 * t);

  return function noise(x, z) {
    // x, z in world units; one grid cell spans world/cell world units.
    const cell = (2 * 2100) / gridSize;
    const fx = x / cell + gridSize / 2;
    const fz = z / cell + gridSize / 2;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = smooth(fx - x0);
    const tz = smooth(fz - z0);
    const a = at(x0, z0);
    const b = at(x0 + 1, z0);
    const c = at(x0, z0 + 1);
    const d = at(x0 + 1, z0 + 1);
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz);
  };
}

// Two octaves of value noise combined: broad hills plus finer detail.
export function makeTerrainNoise(seed) {
  const coarse = makeValueNoise(seed, 14);
  const fine = makeValueNoise(seed + 101, 42);
  return (x, z) => coarse(x, z) * 0.72 + fine(x, z) * 0.28;
}
