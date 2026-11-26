// Keyboard and mouse: the keyboard flies the plane, the mouse looks around
// and works the menus. Every key is also listed on the title screen.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false,
    throttleUp: false, throttleDown: false,
    brake: false,
    gearToggle: false, // edge-triggered, consumed by the loop
    pauseToggle: false, // edge-triggered, consumed by the loop
    muteToggle: false, // edge-triggered, consumed by the loop
    restart: false, // edge-triggered, consumed by the loop
  };
  const orbit = { azimuth: 0, elevation: 0, zoom: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const KEYMAP = {
    ArrowUp: 'pitchUp', KeyW: 'pitchUp',
    ArrowDown: 'pitchDown', KeyS: 'pitchDown',
    ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
    ArrowRight: 'rollRight', KeyD: 'rollRight',
    ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp', KeyR: 'throttleUp',
    ControlLeft: 'throttleDown', ControlRight: 'throttleDown', KeyF: 'throttleDown',
    Space: 'brake',
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyG') { input.gearToggle = true; return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { input.pauseToggle = true; return; }
    if (e.code === 'KeyM') { input.muteToggle = true; return; }
    if (e.code === 'Enter') { input.restart = true; return; }
    const name = KEYMAP[e.code];
    if (name) {
      input[name] = true;
      keys.add(e.code);
    }
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) {
      input[name] = false;
      keys.delete(e.code);
    }
  }
  function onBlur() {
    for (const name of Object.values(KEYMAP)) input[name] = false;
    keys.clear();
    dragging = false;
  }

  function onPointerDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    orbit.azimuth = Math.max(-1.1, Math.min(1.1, orbit.azimuth + dx * 0.004));
    orbit.elevation = Math.max(-0.5, Math.min(0.9, orbit.elevation + dy * 0.004));
  }
  function onPointerUp() {
    dragging = false;
  }
  function onWheel(e) {
    e.preventDefault();
    orbit.zoom = Math.max(-8, Math.min(16, orbit.zoom + e.deltaY * 0.02));
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // The chase camera eases back to centre when the mouse is left alone.
  function update(dt) {
    orbit.azimuth += (0 - orbit.azimuth) * 0.35 * dt;
    orbit.elevation += (0 - orbit.elevation) * 0.35 * dt;
  }

  function consumeEdges() {
    const edges = {
      gear: input.gearToggle,
      pause: input.pauseToggle,
      mute: input.muteToggle,
      restart: input.restart,
    };
    input.gearToggle = false;
    input.pauseToggle = false;
    input.muteToggle = false;
    input.restart = false;
    return edges;
  }

  return { input, orbit, update, consumeEdges };
}
