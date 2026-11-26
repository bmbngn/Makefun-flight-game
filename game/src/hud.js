// The HUD: lit instruments in DOM, so the numbers stay crisp at any size.
// Airspeed and altitude on the left, a compass strip across the top, throttle
// and fuel at the bottom, and a little attitude ball in the middle — the
// instruments a pilot actually flies by.
import { RING_COUNT } from './config.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function compassLabel(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const airspeed = el('hud-speed');
  const altitude = el('hud-alt');
  const heading = el('hud-hdg');
  const compass = el('hud-compass');
  const throttleBar = el('hud-throttle-fill');
  const throttleVal = el('hud-throttle-val');
  const fuelBar = el('hud-fuel-fill');
  const fuelVal = el('hud-fuel-val');
  const rings = el('hud-rings');
  const timer = el('hud-time');
  const score = el('hud-score');
  const message = el('hud-message');
  const stall = el('hud-stall');
  const gearLight = el('hud-gear');
  const attitude = el('hud-attitude');
  const actx = attitude.getContext('2d');

  let messageTimer = 0;
  let lastMessage = '';

  function showMessage(text, seconds = 2.6) {
    if (text === lastMessage && messageTimer > 0.4) return;
    lastMessage = text;
    message.textContent = text;
    message.classList.add('show');
    messageTimer = seconds;
  }
  function hideMessage() {
    message.classList.remove('show');
    messageTimer = 0;
    lastMessage = '';
  }

  // The attitude ball: a horizon line that rolls with the wings and pitches
  // with the nose, drawn on a small canvas.
  function drawAttitude(pitch, roll) {
    const w = attitude.width;
    const h = attitude.height;
    const cx = w / 2;
    const cy = h / 2;
    actx.clearRect(0, 0, w, h);
    actx.save();
    actx.beginPath();
    actx.arc(cx, cy, 52, 0, Math.PI * 2);
    actx.clip();
    actx.translate(cx, cy);
    actx.rotate(-roll);
    actx.translate(0, pitch * 90);
    // Sky above the line, ground below it.
    actx.fillStyle = '#2f7fc2';
    actx.fillRect(-60, -120, 120, 120);
    actx.fillStyle = '#8a6a42';
    actx.fillRect(-60, 0, 120, 120);
    actx.strokeStyle = '#ffffff';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(-60, 0);
    actx.lineTo(60, 0);
    actx.stroke();
    actx.restore();
    // Fixed wings: the little aeroplane that never moves.
    actx.strokeStyle = '#ffe14d';
    actx.lineWidth = 3;
    actx.beginPath();
    actx.moveTo(cx - 34, cy);
    actx.lineTo(cx - 10, cy);
    actx.moveTo(cx + 10, cy);
    actx.lineTo(cx + 34, cy);
    actx.moveTo(cx, cy - 2);
    actx.lineTo(cx, cy + 2);
    actx.stroke();
    actx.beginPath();
    actx.arc(cx, cy, 52, 0, Math.PI * 2);
    actx.strokeStyle = '#dfe9f2';
    actx.lineWidth = 3;
    actx.stroke();
  }

  function update(state, ringIndex, scoreValue, elapsed, dt) {
    const speedKt = Math.round(state.speed * MS_TO_KT);
    const altFt = Math.max(0, Math.round((state.pos.y - 28) * M_TO_FT));
    const hdg = ((state.heading * 180 / Math.PI) % 360 + 360) % 360;
    airspeed.textContent = String(speedKt);
    altitude.textContent = String(altFt);
    heading.textContent = `${String(Math.round(hdg)).padStart(3, '0')}° ${compassLabel(hdg)}`;
    // Compass strip: tick marks sliding with the heading.
    let strip = '';
    for (let d = -45; d <= 45; d += 15) {
      const a = Math.round((hdg + d) / 15) * 15;
      const norm = ((a % 360) + 360) % 360;
      const label = norm % 90 === 0 ? ['N', 'E', 'S', 'W'][norm / 90] : String(norm);
      const off = (a - hdg) * 1.35;
      strip += `<span style="left:${50 + off}%">${label}</span>`;
    }
    compass.innerHTML = strip;
    throttleBar.style.width = `${Math.round(state.throttle * 100)}%`;
    throttleVal.textContent = `${Math.round(state.throttle * 100)}%`;
    fuelBar.style.width = `${Math.round(state.fuel)}%`;
    fuelBar.classList.toggle('low', state.fuel < 20);
    fuelVal.textContent = `${Math.round(state.fuel)}`;
    rings.textContent = `${Math.min(ringIndex, RING_COUNT)}/${RING_COUNT}`;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    timer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    score.textContent = String(scoreValue);
    stall.classList.toggle('show', state.stalled);
    gearLight.textContent = state.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    gearLight.classList.toggle('down', state.gearDown);
    drawAttitude(state.pitch, state.roll);
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) hideMessage();
    }
  }

  return { update, showMessage, hideMessage };
}
