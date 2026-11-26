// Target rings: glowing hoops the pilot flies through in order. The next
// ring burns gold with a light column you can spot from miles away; later
// rings wait dim blue; a passed ring flashes green and goes quiet.
import * as THREE from '../vendor/three.module.min.js';
import { RINGS } from './config.js';

const NEXT_COLOR = 0xffb020;
const LATER_COLOR = 0x3f8cff;
const PASSED_COLOR = 0x37d67a;

export function buildRings(scene) {
  const meshes = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.09, 12, 48);
  const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 900, 8, 1, true);

  RINGS.forEach((def, i) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: i === 0 ? NEXT_COLOR : LATER_COLOR,
      transparent: true,
      opacity: 0.95,
    });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.scale.setScalar(def.r);
    group.add(ring);
    // A faint inner disc so the hoop reads at a distance.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(def.r * 0.96, 40),
      new THREE.MeshBasicMaterial({
        color: mat.color, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    group.add(disc);
    // Light column marking the next ring.
    const beamMat = new THREE.MeshBasicMaterial({
      color: NEXT_COLOR, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 450;
    group.add(beam);
    group.position.set(def.x, def.y, def.z);
    // Face the ring back along the course, towards the previous ring.
    const prev = RINGS[(i + RINGS.length - 1) % RINGS.length];
    group.lookAt(prev.x, prev.y, prev.z);
    scene.add(group);
    meshes.push({ group, mat, disc, beam, beamMat, def, index: i, passed: false });
  });

  function setNext(index) {
    meshes.forEach((m) => {
      if (m.passed) {
        m.mat.color.setHex(PASSED_COLOR);
        m.mat.opacity = 0.35;
        m.disc.material.opacity = 0.02;
        m.beamMat.opacity = 0;
      } else if (m.index === index) {
        m.mat.color.setHex(NEXT_COLOR);
        m.mat.opacity = 1;
        m.disc.material.opacity = 0.1;
        m.beamMat.opacity = 0.14;
      } else {
        m.mat.color.setHex(LATER_COLOR);
        m.mat.opacity = 0.75;
        m.disc.material.opacity = 0.05;
        m.beamMat.opacity = 0;
      }
    });
  }
  setNext(0);

  function update(time) {
    // The next ring pulses gently so it never gets lost in the terrain.
    const next = meshes.findIndex((x) => !x.passed);
    for (const m of meshes) {
      if (m.index === next) {
        const pulse = 0.85 + 0.15 * Math.sin(time * 3.2);
        m.group.scale.setScalar(pulse);
      } else {
        m.group.scale.setScalar(1);
      }
    }
  }

  return { meshes, setNext, update };
}

// Did the aircraft cross the ring's plane inside its hoop this step?
// prevPos and pos are the aircraft positions before and after the step.
export function checkRingPass(mesh, prevPos, pos) {
  if (mesh.passed) return false;
  const c = mesh.group.position;
  const normal = new THREE.Vector3();
  mesh.group.getWorldDirection(normal); // the ring faces -Z of its group
  const toPrev = new THREE.Vector3().subVectors(prevPos, c);
  const toNow = new THREE.Vector3().subVectors(pos, c);
  const dPrev = toPrev.dot(normal);
  const dNow = toNow.dot(normal);
  if (dPrev * dNow >= 0) return false; // never crossed the plane
  // Where the path crossed the plane: inside the hoop?
  const t = dPrev / (dPrev - dNow);
  const cross = new THREE.Vector3().lerpVectors(prevPos, pos, t);
  const radial = cross.distanceTo(c);
  if (radial > mesh.def.r * 0.92) return false;
  mesh.passed = true;
  return true;
}
