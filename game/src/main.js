// Cloudcutter — Island Ring Run: bootstrap, state machine and game loop.
// Title -> flying -> (rings, then land) -> complete, or crash at any point.
// The loop is the only place that moves the world; every other file owns one
// job and is called from here.
import * as THREE from '../vendor/three.module.min.js';
import { GAME_NAME, GAME_SUBTITLE, RINGS, RING_COUNT, SCORING, DIFFICULTIES, FLIGHT } from './config.js';
import { buildWorld, heightAt } from './terrain.js';
import { buildPlane } from './plane.js';
import { buildRings, checkRingPass } from './rings.js';
import { createFlight, chaseCamera, TAKEOFF_SPEED } from './physics.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // title | flight | ring | landing (screenshots)
// ?debug=1 exposes the live state for playtesting; it changes nothing in play.
const debugMode = params.get('debug') === '1';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);

const world = buildWorld(scene);
const plane = buildPlane();
scene.add(plane.group);
const rings = buildRings(scene);
const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();

let difficulty = DIFFICULTIES.calm;
let flight = createFlight(difficulty);
let screen = 'title'; // title | playing | paused | complete | crashed
let ringIndex = 0;
let score = 0;
let elapsed = 0;
let endTimer = 0;
let endShown = false;
let fuelWarned = false;
let bestScore = 0;

const camTarget = {
  position: new THREE.Vector3(300, 120, 300),
  target: new THREE.Vector3(0, 40, 0),
};
const chase = { position: new THREE.Vector3(), target: new THREE.Vector3() };

// ---- Screens (DOM) -------------------------------------------------------
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  end: document.getElementById('screen-end'),
};
const hudEl = document.getElementById('hud');
const endTitle = document.getElementById('end-title');
const endLines = document.getElementById('end-lines');
const endSub = document.getElementById('end-sub');

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
  hudEl.classList.toggle('hidden', name === 'title');
}

function setDifficulty(key) {
  difficulty = DIFFICULTIES[key];
  for (const btn of document.querySelectorAll('.diff-btn')) {
    btn.classList.toggle('active', btn.dataset.diff === key);
  }
}
for (const btn of document.querySelectorAll('.diff-btn')) {
  btn.addEventListener('click', () => {
    audio.ensure();
    audio.resume();
    setDifficulty(btn.dataset.diff);
  });
}

function startGame() {
  audio.ensure();
  audio.resume();
  flight = createFlight(difficulty);
  plane.setGearDown(true);
  rings.meshes.forEach((m) => { m.passed = false; });
  rings.setNext(0);
  ringIndex = 0;
  score = 0;
  elapsed = 0;
  endTimer = 0;
  endShown = false;
  fuelWarned = false;
  screen = 'playing';
  showScreen(null);
  hud.showMessage('Throttle up — Shift to climb out, runway 09', 4);
}

function endGame(landed) {
  screen = landed ? 'complete' : 'crashed';
  const timeBonus = landed
    ? Math.max(0, Math.round((SCORING.parTimeSeconds - elapsed) * SCORING.timeBonusPerSecond))
    : 0;
  const fuelBonus = landed ? Math.round(flight.state.fuel * SCORING.fuelBonusPerUnit) : 0;
  const landingBonus = landed ? SCORING.landingPoints : 0;
  const total = score + landingBonus + fuelBonus + timeBonus;
  bestScore = Math.max(bestScore, total);
  endTitle.textContent = landed ? 'Wheels down — sortie complete!' : 'Down in the drink';
  if (!landed) endTitle.textContent = `Crashed — ${flight.state.crashReason}`;
  endSub.textContent = landed
    ? 'You flew the course and brought her home.'
    : 'The plane is a write-off, but the pilot walked away. Fly it again.';
  endLines.innerHTML = [
    ['Rings flown', `${Math.min(ringIndex, RING_COUNT)} / ${RING_COUNT}`, `${score} pts`],
    ['Landing', landed ? 'Runway 09' : '—', landed ? `${landingBonus} pts` : '—'],
    ['Fuel left', `${Math.round(flight.state.fuel)}%`, landed ? `${fuelBonus} pts` : '—'],
    ['Time', formatTime(elapsed), landed ? `${timeBonus} pts` : '—'],
    ['Total score', '', `${total} pts`],
    ['Best this session', '', `${bestScore} pts`],
  ].map(([a, b, c]) => `<div><span>${a}</span><span>${b}</span><strong>${c}</strong></div>`).join('');
  showScreen('end');
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  screen = 'playing';
  showScreen(null);
});
document.getElementById('btn-restart').addEventListener('click', startGame);

// ---- Screenshot helper (?shot=...) ---------------------------------------
// A deterministic setup for the entry's own screenshots: the same game code,
// the same flight model, just placed on the course. Not a cheat, a camera.
function applyShotMode() {
  if (!shotMode) return;
  if (shotMode === 'title') {
    screen = 'title';
    showScreen('title');
    return;
  }
  startGame();
  hud.hideMessage(); // the take-off toast is wrong for a mid-course frame
  const s = flight.state;
  if (shotMode === 'flight') {
    // Over open water east of home island, volcano and ring 3 ahead-left.
    s.pos.set(300, 220, 600);
    s.heading = 0.35;
    s.pitch = 0.06;
    s.roll = 0.08;
    s.speed = 68;
    s.throttle = 0.72;
    s.onGround = false;
    s.airborne = true;
    s.gearDown = false;
    plane.setGearDown(false);
    ringIndex = 2;
    rings.meshes[0].passed = true;
    rings.meshes[1].passed = true;
    rings.setNext(2);
    score = 200;
    elapsed = 74;
  } else if (shotMode === 'ring') {
    // South of Twin Peaks over the island's flank, ring 5 dead ahead
    // against the hills — not hidden behind them this time.
    s.pos.set(-1220, 420, 1050);
    s.heading = 5.95;
    s.pitch = 0.02;
    s.roll = -0.08;
    s.speed = 74;
    s.throttle = 0.8;
    s.onGround = false;
    s.airborne = true;
    s.gearDown = false;
    plane.setGearDown(false);
    ringIndex = 5;
    for (let i = 0; i < 5; i++) rings.meshes[i].passed = true;
    rings.setNext(5);
    score = 500;
    elapsed = 152;
  } else if (shotMode === 'landing') {
    // Short final to runway 09, gear down, slow and level, strip in sight.
    s.pos.set(380, 68, 0);
    s.heading = Math.PI * 1.5;
    s.pitch = -0.06;
    s.roll = 0;
    s.speed = 44;
    s.throttle = 0.32;
    s.gearDown = true;
    s.onGround = false;
    s.airborne = true;
    ringIndex = 8;
    for (const m of rings.meshes) m.passed = true;
    rings.setNext(8);
    score = 800;
    elapsed = 212;
  }
  // Snap the chase camera onto its target now: on a slow software renderer
  // the eased camera would still be travelling when the shot is taken.
  plane.group.position.copy(flight.state.pos);
  plane.group.rotation.set(flight.state.pitch, -flight.state.heading, -flight.state.roll, 'YXZ');
  chaseCamera(flight.state, input.orbit, chase);
  camTarget.position.copy(chase.position);
  camTarget.target.copy(chase.target);
}

// ---- Main loop ------------------------------------------------------------
const clock = new THREE.Clock();
let attractAngle = 0;
let framesRendered = 0;

function frame() {
  requestAnimationFrame(frame);
  framesRendered++;
  // Screenshot driver hook: how far the renderer has got. Harmless in play.
  if (shotMode) {
    window.__cloudcutter = {
      frames: framesRendered,
      cam: camera.position.toArray(),
      plane: plane.group.position.toArray(),
    };
  }
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const edges = input.consumeEdges();

  if (edges.mute) {
    audio.setMuted(!audio.isMuted());
    hud.showMessage(audio.isMuted() ? 'Sound off (M to turn back on)' : 'Sound on');
  }

  if (screen === 'title') {
    // Attract mode: a high slow orbit so the runway plateau stays in sight
    // over the home island's hills, plane parked on it.
    attractAngle += dt * 0.05;
    const r = 520;
    camera.position.set(
      Math.sin(attractAngle) * r,
      205 + Math.sin(attractAngle * 0.6) * 25,
      Math.cos(attractAngle) * r,
    );
    camera.lookAt(0, 40, 0);
    plane.group.position.copy(flight.state.pos);
    plane.group.rotation.set(0, -flight.state.heading, 0, 'YXZ');
    plane.update(dt, 0);
    if (edges.restart) startGame();
  } else if (screen === 'playing') {
    if (edges.pause) {
      screen = 'paused';
      showScreen('pause');
    } else {
      if (edges.gear) {
        flight.state.gearDown = !flight.state.gearDown;
        plane.setGearDown(flight.state.gearDown);
        hud.showMessage(flight.state.gearDown ? 'Gear down' : 'Gear up');
      }
      const prevPos = flight.state.pos.clone();
      flight.step(dt, input.input, time);
      const s = flight.state;

      // Rings: crossing the next ring's plane inside its hoop scores.
      if (ringIndex < RING_COUNT) {
        const mesh = rings.meshes[ringIndex];
        if (checkRingPass(mesh, prevPos, s.pos)) {
          score += SCORING.ringPoints;
          audio.chime();
          ringIndex++;
          rings.setNext(ringIndex);
          if (ringIndex >= RING_COUNT) {
            hud.showMessage('All rings! Bring her home to runway 09.', 4);
          } else {
            hud.showMessage(`Ring ${ringIndex}/${RING_COUNT} — ${RINGS[ringIndex].name} next`, 2.6);
          }
        }
      }
      if (s.fuel <= 0 && !fuelWarned) {
        fuelWarned = true;
        hud.showMessage('Fuel empty — glide her home to the runway', 4);
      }
      if (s.speed < TAKEOFF_SPEED && s.onGround && !s.airborne && s.throttle > 0.6) {
        hud.showMessage('Ease back on the stick to lift off', 2);
      }

      elapsed += dt;
      audio.setEngine(s.throttle, Math.min(1, s.speed / FLIGHT.maxSpeed));

      // Plane mesh follows the flight state.
      plane.group.position.copy(s.pos);
      plane.group.rotation.set(s.pitch, -s.heading, -s.roll, 'YXZ');
      plane.update(dt, s.throttle);

      // Landing rollout, then the end screen.
      if (s.landed && !endShown) {
        endTimer += dt;
        s.speed = Math.max(0, s.speed - 14 * dt);
        s.pos.x += Math.sin(s.heading) * s.speed * dt;
        s.pos.z += -Math.cos(s.heading) * s.speed * dt;
        if (endTimer > 1.4 || s.speed <= 3) {
          endShown = true;
          audio.thud(false);
          endGame(true);
        }
      }
      if (s.crashed && !endShown) {
        endTimer += dt;
        if (endTimer > 0.9) {
          endShown = true;
          audio.thud(true);
          endGame(false);
        }
      }

      // Chase camera, eased so it never snaps.
      chaseCamera(s, input.orbit, chase);
      camTarget.position.lerp(chase.position, Math.min(1, 5.5 * dt));
      camTarget.target.lerp(chase.target, Math.min(1, 7 * dt));
      camera.position.copy(camTarget.position);
      camera.lookAt(camTarget.target);
      input.update(dt);
      hud.update(s, ringIndex, score, elapsed, dt);
    }
  } else if (screen === 'paused') {
    if (edges.pause || edges.restart) {
      screen = 'playing';
      showScreen(null);
    }
  } else if (screen === 'complete' || screen === 'crashed') {
    // The end screen holds the last frame; the prop winds down.
    plane.update(dt, 0);
    if (edges.restart) startGame();
  }

  rings.update(time);
  world.update(dt, flight.state.wind);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('game-title').textContent = GAME_NAME;
document.getElementById('game-subtitle').textContent = GAME_SUBTITLE;
setDifficulty('calm');
showScreen('title');
applyShotMode();
if (debugMode) {
  window.__game = {
    start: startGame,
    get state() { return flight.state; },
    get screen() { return screen; },
    get ringIndex() { return ringIndex; },
    get score() { return score; },
    get elapsed() { return elapsed; },
  };
}
frame();
