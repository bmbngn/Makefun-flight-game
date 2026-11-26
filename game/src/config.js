// Cloudcutter — Island Ring Run: every tunable number for the game lives here,
// so the flight model, the course and the HUD all read one source of truth.

export const GAME_NAME = 'Cloudcutter';
export const GAME_SUBTITLE = 'Island Ring Run';

// World: an archipelago 4200 x 4200 units across, sea level at y = 0.
export const WORLD_SIZE = 4200;
export const WORLD_HALF = WORLD_SIZE / 2;

// Runway: a flat strip on the home island, along the X axis (heading 090).
export const RUNWAY = {
  centerX: 0,
  centerZ: 0,
  elevation: 28,
  length: 420,
  width: 26,
  headingDeg: 90,
};

// The ring course: take off east, loop the islands, come home to land.
// Each ring: position, height and the direction it faces (its normal points
// back along the course, so the pilot sees its face on approach).
export const RINGS = [
  { x: 450, y: 150, z: 0, r: 26, name: 'Harbour Gate' },
  { x: 1050, y: 290, z: -480, r: 26, name: 'Coast Turn' },
  { x: 1420, y: 420, z: -920, r: 26, name: 'Volcano Crown' },
  { x: 620, y: 225, z: -1420, r: 26, name: 'North Reach' },
  { x: -620, y: 245, z: -1120, r: 26, name: 'West Water' },
  { x: -1300, y: 440, z: 820, r: 26, name: 'Twin Peaks' },
  { x: -450, y: 230, z: 1350, r: 26, name: 'South Shore' },
  { x: 240, y: 145, z: 620, r: 26, name: 'Home Straight' },
];
// Ring heights are checked against the terrain: the volcano rim rises to
// ~385 and the Twin Peaks saddle to ~382, so rings 3 and 6 fly above them —
// a ring buried in its own mountain is a course that cannot be flown.
export const RING_COUNT = RINGS.length;

// Flight model (arcade: forgiving, but throttle and bank still matter).
export const FLIGHT = {
  maxSpeed: 96, // m/s at full throttle, level flight
  minFlySpeed: 30, // below this the wing stops flying and the nose drops
  stallSpeed: 27, // below this a stall warning sounds and control fades
  accel: 14, // m/s^2 towards the throttle's target speed
  climbBleed: 0.55, // speed lost per m/s of climb
  diveGain: 0.45, // speed gained per m/s of descent
  pitchRate: 0.85, // rad/s at full elevator
  pitchMax: 0.61, // ~35 degrees
  rollRate: 1.9, // rad/s at full aileron
  rollMax: 1.15, // ~66 degrees of bank
  turnFactor: 9.81, // coordinated-turn constant (g)
  autoLevel: 0.55, // 1/s spring back to wings level with no input
  dragBrake: 26, // extra decel with the airbrake held
  gearDrag: 4, // extra drag with the gear down
  groundEffect: 0.35, // lift cushion close to the runway (forgiving landings)
};

// Fuel: a full tank flies the course with a little to spare at cruise.
export const FUEL = {
  capacity: 100,
  burnIdle: 0.22, // units/s at idle
  burnFull: 1.05, // units/s at full throttle
};

// Scoring.
export const SCORING = {
  ringPoints: 100,
  landingPoints: 500,
  fuelBonusPerUnit: 2,
  timeBonusPerSecond: 5,
  parTimeSeconds: 240,
};

// Difficulties: wind is the only difference, so every pilot flies the same course.
export const DIFFICULTIES = {
  calm: { label: 'Calm', windX: 0, windZ: 0, gust: 0, note: 'Still air. Learn the course.' },
  breezy: { label: 'Breezy', windX: 3.5, windZ: -2, gust: 1.2, note: 'A steady crosswind to correct for.' },
  stormy: { label: 'Stormy', windX: -6, windZ: 5, gust: 3.5, note: 'Gusts and a shove from the south-west.' },
};

// Camera: chase view that never fights the pilot.
export const CAMERA = {
  distance: 22,
  height: 7.5,
  lookAhead: 24,
  lerp: 5.5,
};
