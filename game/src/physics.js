// The flight model: arcade on purpose — throttle sets the speed, bank turns
// the nose, pitch trades speed for height — but with a stall, a fuel tank and
// a runway that only accepts a slow, level, gear-down arrival, so flying
// well still takes decisions.
import * as THREE from '../vendor/three.module.min.js';
import { FLIGHT, FUEL, RUNWAY, CAMERA } from './config.js';
import { heightAt } from './terrain.js';

export const TAKEOFF_SPEED = 34;

export function createFlight(difficulty) {
  const state = {
    pos: new THREE.Vector3(RUNWAY.centerX - RUNWAY.length / 2 + 30, RUNWAY.elevation + 2.2, 0),
    heading: Math.PI / 2, // 090, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.capacity,
    gearDown: true,
    onGround: true,
    airborne: false,
    stalled: false,
    crashed: false,
    crashReason: '',
    landed: false,
    wind: { x: difficulty.windX, z: difficulty.windZ },
    gustPhase: Math.random() * 10,
    verticalSpeed: 0,
  };

  function step(dt, input, time) {
    if (state.crashed || state.landed) return state;
    const gust = difficulty.gust * Math.sin(time * 0.9 + state.gustPhase)
      + difficulty.gust * 0.5 * Math.sin(time * 2.3);
    const windX = state.wind.x + gust * 0.7;
    const windZ = state.wind.z + gust * 0.5;

    // Throttle: Shift/R up, Ctrl/F down; airbrake trims speed hard.
    if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.55);
    if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.55);
    if (state.fuel <= 0) state.throttle = 0;

    // Fuel burn follows the throttle.
    state.fuel = Math.max(0, state.fuel - dt * (FUEL.burnIdle + (FUEL.burnFull - FUEL.burnIdle) * state.throttle));

    // Pitch and roll answer the stick, then the wings want level again.
    const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
    const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
    const control = state.stalled ? 0.35 : 1;
    state.pitch += pitchIn * FLIGHT.pitchRate * control * dt;
    state.pitch = Math.max(-FLIGHT.pitchMax, Math.min(FLIGHT.pitchMax, state.pitch));
    if (!input.pitchUp && !input.pitchDown && !state.onGround) {
      state.pitch += (0 - state.pitch) * 0.25 * dt;
    }
    state.roll += rollIn * FLIGHT.rollRate * control * dt;
    state.roll = Math.max(-FLIGHT.rollMax, Math.min(FLIGHT.rollMax, state.roll));
    if (!input.rollLeft && !input.rollRight) {
      state.roll += (0 - state.roll) * FLIGHT.autoLevel * dt;
    }

    // Speed chases the throttle's target; climbing bleeds it, diving feeds it.
    const target = state.throttle * FLIGHT.maxSpeed;
    let accel = (target - state.speed) * 0.45;
    const climbRate = state.speed * Math.sin(state.pitch);
    accel += -climbRate * FLIGHT.climbBleed + Math.max(0, -climbRate) * FLIGHT.diveGain;
    if (input.brake) accel -= FLIGHT.dragBrake;
    if (state.gearDown && !state.onGround) accel -= FLIGHT.gearDrag;
    state.speed = Math.max(0, state.speed + accel * dt);

    // Stall: too slow and the wing quits — nose drops, controls go mushy.
    state.stalled = !state.onGround && state.speed < FLIGHT.stallSpeed;
    if (state.stalled) state.pitch -= 0.5 * dt;

    // Coordinated turn: bank turns the heading, faster when banked hard.
    const turnRate = (FLIGHT.turnFactor * Math.tan(state.roll) / Math.max(28, state.speed)) * control;
    state.heading += turnRate * dt;

    // Move: forward along the nose, plus the wind's push, plus climb.
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
    const ground = heightAt(state.pos.x, state.pos.z);
    const nearGround = state.pos.y - ground < 12;
    let lift = 1;
    if (nearGround && state.speed > 30 && Math.abs(state.pitch) < 0.3) {
      lift += FLIGHT.groundEffect * (1 - (state.pos.y - ground) / 12);
    }
    const vy = climbRate * lift;
    state.verticalSpeed = vy;
    state.pos.addScaledVector(forward, state.speed * Math.cos(state.pitch) * dt);
    state.pos.y += vy * dt;
    state.pos.x += windX * dt * 0.35;
    state.pos.z += windZ * dt * 0.35;

    // Ground and water.
    const newGround = heightAt(state.pos.x, state.pos.z);
    const overRunway = Math.abs(state.pos.x - RUNWAY.centerX) < RUNWAY.length / 2
      && Math.abs(state.pos.z - RUNWAY.centerZ) < RUNWAY.width / 2;
    if (state.pos.y <= newGround + 1.6) {
      if (overRunway && state.airborne && state.speed < 55 && Math.abs(state.pitch) < 0.16
        && Math.abs(state.roll) < 0.18 && state.gearDown) {
        // A landing: settle on the strip and roll out.
        state.landed = true;
        state.pos.y = RUNWAY.elevation + 1.6;
        state.onGround = true;
      } else if (state.onGround) {
        state.pos.y = newGround + 1.6;
      } else {
        state.crashed = true;
        state.crashReason = newGround <= 1 ? 'Ditched into the sea' : 'Flew into the ground';
        state.pos.y = newGround + 1.6;
      }
    }
    // Take-off: fast enough on the strip and the wing lifts.
    if (state.onGround && !state.airborne) {
      state.pos.y = newGround + 1.6;
      if (state.speed >= TAKEOFF_SPEED && state.pitch > 0.05) {
        state.airborne = true;
        state.onGround = false;
      }
      // Rolling: steering follows the rudder a touch, and the runway ends.
      if (!state.airborne) {
        state.heading += rollIn * 0.25 * dt * (state.speed / 40);
        if (Math.abs(state.pos.x - RUNWAY.centerX) > RUNWAY.length / 2 + 30) {
          state.crashed = true;
          state.crashReason = 'Ran off the end of the runway';
        }
      }
    }
    // Stay inside the world.
    const edge = 2050;
    state.pos.x = Math.max(-edge, Math.min(edge, state.pos.x));
    state.pos.z = Math.max(-edge, Math.min(edge, state.pos.z));
    return state;
  }

  function reset() {
    state.pos.set(RUNWAY.centerX - RUNWAY.length / 2 + 30, RUNWAY.elevation + 2.2, 0);
    state.heading = Math.PI / 2;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = FUEL.capacity;
    state.gearDown = true;
    state.onGround = true;
    state.airborne = false;
    state.stalled = false;
    state.crashed = false;
    state.crashReason = '';
    state.landed = false;
    state.verticalSpeed = 0;
  }

  return { state, step, reset };
}

// Where the aircraft sits for the camera: chase position and look target.
export function chaseCamera(state, orbit, out) {
  const forward = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
  const right = new THREE.Vector3(forward.z, 0, -forward.x).negate();
  const back = forward.clone().negate();
  const az = orbit.azimuth;
  const el = orbit.elevation;
  const dir = new THREE.Vector3(
    back.x * Math.cos(az) - right.x * Math.sin(az),
    0,
    back.z * Math.cos(az) - right.z * Math.sin(az),
  ).normalize();
  const dist = CAMERA.distance + orbit.zoom;
  out.position.copy(state.pos)
    .addScaledVector(dir, dist)
    .add(new THREE.Vector3(0, 7.5 + el * 10, 0));
  out.target.copy(state.pos).addScaledVector(forward, 24);
  out.target.y += 2 + state.pitch * 8;
  return out;
}
