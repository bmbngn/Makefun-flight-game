// The aircraft: a little high-wing bush plane built from primitives, in an
// original coral-and-cream livery with navy trim. Nose points down -Z, so the
// flight model can steer it with a YXZ euler (yaw, pitch, roll).
import * as THREE from '../vendor/three.module.min.js';

export function buildPlane() {
  const group = new THREE.Group();
  const coral = new THREE.MeshLambertMaterial({ color: 0xe8543f });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const navy = new THREE.MeshLambertMaterial({ color: 0x22345c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x182838, shininess: 160, specular: 0x88bbdd,
  });

  // Fuselage: a tapered body, nose at -Z.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 10), cream);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 10), coral);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.3;
  group.add(nose);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.57, 5.4, 10, 1, true, 0, Math.PI), navy);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.y = Math.PI;
  stripe.position.z = 0.2;
  stripe.position.y = -0.08;
  group.add(stripe);

  // Canopy: a glasshouse over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), glass);
  canopy.scale.set(0.85, 0.62, 1.7);
  canopy.position.set(0, 0.62, -0.9);
  group.add(canopy);

  // High wing, one piece with a slight dihedral, plus struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 1.9), coral);
  wing.position.set(0, 0.95, -0.4);
  wing.rotation.z = 0.045;
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.9), navy);
  wingTipL.position.set(-5.55, 1.2, -0.4);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.55;
  group.add(wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), dark);
    strut.position.set(side * 2.2, 0.1, -0.4);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser and fin, navy.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), navy);
  tailplane.position.set(0, 0.28, 2.9);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.5), navy);
  fin.position.set(0, 0.95, 2.85);
  fin.rotation.x = -0.15;
  group.add(fin);

  // Propeller: spinner plus two blades that spin around the nose.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 8), navy);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.4;
  prop.add(spinner);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.1), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  prop.position.z = -4.1;
  group.add(prop);

  // Landing gear: two fixed legs with wheels, and a tail wheel.
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 5), dark);
    leg.position.set(side * 0.85, -0.95, -0.6);
    leg.rotation.z = side * 0.35;
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.15, -1.7, -0.6);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 2.7);
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red left, green right, white tail. They blink.
  const lightMat = (color) => new THREE.MeshBasicMaterial({ color });
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), lightMat(0xff2222));
  navL.position.set(-5.7, 1.0, -0.4);
  group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), lightMat(0x22ff66));
  navR.position.set(5.7, 1.0, -0.4);
  group.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), lightMat(0xffffff));
  navT.position.set(0, 0.3, 3.55);
  group.add(navT);

  let blink = 0;
  function update(dt, throttle) {
    // Propeller spin follows the throttle.
    prop.rotation.z += dt * (4 + throttle * 55);
    // Nav lights blink once a second.
    blink += dt;
    const on = (blink % 1) < 0.12;
    navL.visible = on;
    navR.visible = on;
    navT.visible = (blink % 1) < 0.5;
  }

  function setGearDown(down) {
    gear.visible = down;
  }

  return { group, update, setGearDown };
}
