// Cloudcutter terrain: one height function grows the whole archipelago, and
// the mesh, the physics and the runway all read that same function, so the
// ground you see is the ground you can hit.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD_SIZE, WORLD_HALF, RUNWAY } from './config.js';
import { makeTerrainNoise, makeRng } from './random.js';

const noise = makeTerrainNoise(1337);

// Islands: [centerX, centerZ, radius, peakHeight]. The volcano gets a crater.
const ISLANDS = [
  [0, 0, 980, 135], // home island, with the runway
  [1420, -920, 740, 430], // volcano island
  [-1460, 700, 520, 300], // twin peaks, west
  [-1120, 960, 480, 285], // twin peaks, east
  [920, 1320, 320, 65], // south-east islet
  [-420, -1620, 280, 48], // north islet
  [1820, 620, 340, 72], // east islet
  [-1820, -420, 300, 58], // west islet
];

function islandHeight(x, z) {
  let h = -14; // sea floor
  for (const [cx, cz, r, peak] of ISLANDS) {
    const dx = x - cx;
    const dz = z - cz;
    const d2 = (dx * dx + dz * dz) / (r * r);
    if (d2 > 4) continue;
    h += peak * Math.exp(-2.1 * d2);
  }
  // Volcano crater: a dip at the summit.
  const cvx = x - 1420;
  const cvz = z + 920;
  const cd2 = (cvx * cvx + cvz * cvz) / (170 * 170);
  if (cd2 < 4) h -= 150 * Math.exp(-1.6 * cd2);
  return h;
}

// The one height function: islands + rolling detail, flattened along the runway.
export function heightAt(x, z) {
  const base = islandHeight(x, z);
  const mask = Math.max(0, Math.min(1, (base + 14) / 55));
  let h = base + noise(x, z) * 26 * mask;
  // Runway corridor: blend to the runway's flat elevation.
  const along = Math.abs(x - RUNWAY.centerX);
  const across = Math.abs(z - RUNWAY.centerZ);
  if (along < RUNWAY.length / 2 + 90 && across < RUNWAY.width / 2 + 90) {
    const edge = Math.max(
      (along - RUNWAY.length / 2) / 90,
      (across - RUNWAY.width / 2) / 90,
    );
    const t = Math.max(0, Math.min(1, 1 - Math.max(0, edge)));
    const s = t * t * (3 - 2 * t);
    h = h * (1 - s) + RUNWAY.elevation * s;
  }
  // Approach valley: keep the ground low along the runway axis so a final
  // approach from either end stays clear of the home island's hills. It
  // only ever lowers terrain, never raises it.
  if (along < 900 && across < 140) {
    const acrossT = Math.max(0, Math.min(1, 1 - (across - 40) / 100));
    const s = acrossT * acrossT * (3 - 2 * acrossT);
    const target = RUNWAY.elevation + Math.max(0, along - 210) * 0.055;
    if (h > target) h = h * (1 - s) + target * s;
  }
  return h;
}

// Colour the ground by height and slope: sand, grass, rock, snow.
function groundColor(x, z, y, slope, out) {
  // Two noise scales: broad patches plus fine speckle, so slopes read as
  // terrain instead of one flat wash.
  const n = noise(x * 1.7 + 40, z * 1.7 - 40) * 0.09
    + noise(x * 6.3 - 17, z * 6.3 + 31) * 0.04;
  if (y < 3) {
    out[0] = 0.82 + n; out[1] = 0.76 + n; out[2] = 0.52 + n; // sand
  } else if (y < 95) {
    const t = y / 95;
    out[0] = 0.3 - 0.06 * t + n;
    out[1] = 0.62 - 0.14 * t + n;
    out[2] = 0.28 - 0.04 * t + n; // grass
  } else if (y < 210) {
    out[0] = 0.4 + n; out[1] = 0.36 + n; out[2] = 0.3 + n; // scrub rock
  } else if (y < 300) {
    out[0] = 0.46 + n; out[1] = 0.43 + n; out[2] = 0.41 + n; // grey rock
  } else {
    out[0] = 0.92 + n; out[1] = 0.93 + n; out[2] = 0.95 + n; // snow
  }
  if (slope > 0.55 && y > 3) {
    // Steep faces show bare rock whatever their height.
    out[0] = 0.48 + n; out[1] = 0.44 + n; out[2] = 0.4 + n;
  }
  return out;
}

function makeRunwayTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2f3337';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#3a3f44';
  for (let i = 0; i < 200; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 64, 2, 2);
  }
  // Edge lines and centre dashes.
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 3, 512, 2);
  g.fillRect(0, 59, 512, 2);
  for (let x = 20; x < 512; x += 42) g.fillRect(x, 30, 22, 4);
  // Threshold bars at both ends.
  for (let i = 0; i < 4; i++) {
    g.fillRect(8, 10 + i * 13, 26, 6);
    g.fillRect(478, 10 + i * 13, 26, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildWorld(scene) {
  // Light: warm sun plus a soft sky bounce, and distance fog for depth.
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.set(900, 1400, 500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x4a6b43, 0.9));
  scene.fog = new THREE.Fog(0xc3d9e8, 500, 4200);

  // Sky dome: a gradient sphere that never moves with the camera.
  {
    const geo = new THREE.SphereGeometry(6500, 24, 14);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = [0.22, 0.48, 0.84];
    const horizon = [0.82, 0.9, 0.96];
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / 6500 + 0.12));
      colors[i * 3] = horizon[0] + (top[0] - horizon[0]) * t;
      colors[i * 3 + 1] = horizon[1] + (top[1] - horizon[1]) * t;
      colors[i * 3 + 2] = horizon[2] + (top[2] - horizon[2]) * t;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false,
    }));
    scene.add(sky);
  }

  // Sun glow sprite.
  const glowTex = makeGlowTexture();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff3c0, fog: false, depthWrite: false,
  }));
  sunSprite.position.set(3200, 1900, -2600);
  sunSprite.scale.set(900, 900, 1);
  scene.add(sunSprite);

  // Sea.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(14000, 14000),
    new THREE.MeshPhongMaterial({
      color: 0x1d6fae, transparent: true, opacity: 0.9,
      shininess: 140, specular: 0x99ccff,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  scene.add(sea);

  // Terrain mesh with vertex colours.
  const SEG = 150;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    // Slope from neighbours, for the rock-on-steep rule.
    const s = Math.abs(heightAt(x + 12, z) - y) / 12
      + Math.abs(heightAt(x, z + 12) - y) / 12;
    groundColor(x, z, y, s, col);
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);

  // Runway strip, slightly above the flattened ground.
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshLambertMaterial({ map: makeRunwayTexture() }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.rotation.z = 0;
  runway.position.set(RUNWAY.centerX, RUNWAY.elevation + 0.4, RUNWAY.centerZ);
  scene.add(runway);

  // Windsock beside the threshold, so the pilot can read the wind.
  const sockGroup = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 16, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.y = 8;
  sockGroup.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(3.5, 15, 0);
  sockGroup.add(sock);
  sockGroup.position.set(RUNWAY.centerX - RUNWAY.length / 2 + 12, RUNWAY.elevation, 26);
  scene.add(sockGroup);

  // Low-poly trees on the home island's grass, kept clear of the runway.
  {
    const rng = makeRng(4242);
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
    const crownGeo = new THREE.ConeGeometry(3.4, 11, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2f });
    const spots = [];
    let tries = 0;
    while (spots.length < 130 && tries < 2000) {
      tries++;
      const x = (rng() * 2 - 1) * 850;
      const z = (rng() * 2 - 1) * 850;
      const y = heightAt(x, z);
      if (y < 6 || y > 95) continue;
      if (Math.abs(x) < RUNWAY.length / 2 + 60 && Math.abs(z) < RUNWAY.width / 2 + 60) continue;
      spots.push([x, y, z]);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    spots.forEach(([x, y, z], i) => {
      const sc = 0.8 + rng() * 0.9;
      m.compose(new THREE.Vector3(x, y + 2.2 * sc, z), q, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, y + (5 + 5.5) * sc, z), q, new THREE.Vector3(sc, sc, sc));
      crowns.setMatrixAt(i, m);
    });
    scene.add(trunks);
    scene.add(crowns);
  }

  // Drifting clouds: flat-shaded puffs that slide slowly downwind.
  const clouds = [];
  {
    const rng = makeRng(777);
    const puffGeo = new THREE.SphereGeometry(1, 10, 8);
    // Unlit white: Lambert shading turned the puffs into grey discs.
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.92, fog: true,
    });
    for (let i = 0; i < 22; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(puffGeo, puffMat);
        puff.position.set((rng() - 0.5) * 90, (rng() - 0.5) * 12, (rng() - 0.5) * 40);
        const sc = 22 + rng() * 30;
        puff.scale.set(sc, sc * 0.42, sc * 0.8);
        cloud.add(puff);
      }
      cloud.position.set(
        (rng() * 2 - 1) * WORLD_HALF,
        360 + rng() * 170,
        (rng() * 2 - 1) * WORLD_HALF,
      );
      cloud.userData.speed = 2 + rng() * 3;
      scene.add(cloud);
      clouds.push(cloud);
    }
  }

  function update(dt, wind) {
    for (const cloud of clouds) {
      cloud.position.x += (cloud.userData.speed + wind.x) * dt;
      if (cloud.position.x > WORLD_HALF + 300) cloud.position.x = -WORLD_HALF - 300;
    }
    // The windsock points downwind and droops a little in calm air.
    const strength = Math.min(1, Math.hypot(wind.x, wind.z) / 6 + 0.25);
    sock.rotation.y = Math.atan2(-wind.z, wind.x);
    sock.rotation.x = 0;
    sock.scale.set(1, strength, 1);
  }

  return { update };
}
