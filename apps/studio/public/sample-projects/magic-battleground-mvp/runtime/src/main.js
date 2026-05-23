// Magic Battleground MVP — bounded slice of the Poki ragdoll fighter.
// Tests the engine's export-runtime pipeline end-to-end against a real game
// shape (input loop, physics, projectiles, ragdoll on KO).
//
// Stack: Three.js for rendering, Rapier3D (compat, WASM-bundled) for physics.
// No assets — every entity is a primitive geometry so the smoke runs against
// the standalone engine clone with zero external dependencies.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import './styles.css';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

await RAPIER.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6ea4d8);
scene.fog = new THREE.Fog(0x6ea4d8, 25, 60);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 7, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------

const world = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
// Stronger gravity than realistic — game feel, not simulation.

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

scene.add(new THREE.HemisphereLight(0xb0d4ff, 0x3a5a3a, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 14, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);

// ---------------------------------------------------------------------------
// Arena: ground + low walls
// ---------------------------------------------------------------------------

const ARENA_HALF = 12;

const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(ARENA_HALF * 2, 1, ARENA_HALF * 2),
  new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 0.95, metalness: 0 }),
);
groundMesh.position.y = -0.5;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(
  RAPIER.ColliderDesc.cuboid(ARENA_HALF, 0.5, ARENA_HALF).setTranslation(0, -0.5, 0),
  groundBody,
);

// Decorative rune ring
const ring = new THREE.Mesh(
  new THREE.RingGeometry(4, 4.4, 64),
  new THREE.MeshBasicMaterial({ color: 0x9a4cff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

// Bounding walls (visual + physical)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4e, roughness: 0.7 });
const WALL_HEIGHT = 1.2;
const WALL_THICK = 0.4;
const wallSpecs = [
  { x:  ARENA_HALF, z: 0, w: WALL_THICK, d: ARENA_HALF * 2 },
  { x: -ARENA_HALF, z: 0, w: WALL_THICK, d: ARENA_HALF * 2 },
  { x: 0, z:  ARENA_HALF, w: ARENA_HALF * 2, d: WALL_THICK },
  { x: 0, z: -ARENA_HALF, w: ARENA_HALF * 2, d: WALL_THICK },
];
for (const w of wallSpecs) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, WALL_HEIGHT, w.d), wallMat);
  mesh.position.set(w.x, WALL_HEIGHT / 2, w.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(w.w / 2, WALL_HEIGHT / 2, w.d / 2).setTranslation(w.x, WALL_HEIGHT / 2, w.z),
    body,
  );
}

// ---------------------------------------------------------------------------
// Player (kinematic capsule-like cuboid, blue mage)
// ---------------------------------------------------------------------------

const PLAYER_SIZE = { w: 0.8, h: 1.6, d: 0.8 };

const playerGroup = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_SIZE.w, PLAYER_SIZE.h, PLAYER_SIZE.d),
  new THREE.MeshStandardMaterial({ color: 0x3878ff, roughness: 0.4, metalness: 0.1 }),
);
playerBody.castShadow = true;
playerGroup.add(playerBody);

// Mage hat (cone)
const hat = new THREE.Mesh(
  new THREE.ConeGeometry(0.45, 0.7, 12),
  new THREE.MeshStandardMaterial({ color: 0x2050cc, roughness: 0.5 }),
);
hat.position.y = PLAYER_SIZE.h / 2 + 0.35;
hat.castShadow = true;
playerGroup.add(hat);

// Wand orb (visible cue for fireball spawn point)
const wand = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff5500, emissiveIntensity: 1.4 }),
);
wand.position.set(0.6, 0.2, 0);
playerGroup.add(wand);

playerGroup.position.set(0, PLAYER_SIZE.h / 2, 4);
scene.add(playerGroup);

const playerRigid = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(0, PLAYER_SIZE.h / 2, 4),
);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(PLAYER_SIZE.w / 2, PLAYER_SIZE.h / 2, PLAYER_SIZE.d / 2),
  playerRigid,
);

// ---------------------------------------------------------------------------
// Enemy (single dynamic cuboid; turns into ragdoll on hit)
// ---------------------------------------------------------------------------

const ENEMY_COLOR = 0xe04848;
const ENEMY_HEAD_COLOR = 0xf2c89e;

const enemyState = {
  alive: false,
  group: null,        // THREE.Group when alive
  rigid: null,        // RAPIER body when alive
  ragdoll: null,      // { parts: [{body, mesh}], joints: [...] } when KO'd
  respawnAt: 0,
};

const spawnEnemy = () => {
  // Pick a random angle a few units from the center, away from the player.
  const angle = Math.random() * Math.PI * 2;
  const dist = 4 + Math.random() * 2;
  const pos = { x: Math.cos(angle) * dist, y: 1.0, z: Math.sin(angle) * dist };

  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.4, 0.5),
    new THREE.MeshStandardMaterial({ color: ENEMY_COLOR, roughness: 0.55 }),
  );
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: ENEMY_HEAD_COLOR, roughness: 0.7 }),
  );
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  // Two simple eye dots, so the player can read direction
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  eyeL.position.set(-0.1, 0.95, 0.3);
  eyeR.position.set(0.1, 0.95, 0.3);
  group.add(eyeL, eyeR);

  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);

  const rigid = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .lockRotations()
      .setLinearDamping(2.5),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.4, 0.85, 0.3).setDensity(2),
    rigid,
  );

  enemyState.alive = true;
  enemyState.group = group;
  enemyState.rigid = rigid;
  enemyState.ragdoll = null;
};

const killEnemy = (impactDir) => {
  if (!enemyState.alive) return;
  enemyState.alive = false;

  const lastPos = enemyState.rigid.translation();

  // Remove the alive representation.
  scene.remove(enemyState.group);
  world.removeRigidBody(enemyState.rigid);
  enemyState.group = null;
  enemyState.rigid = null;

  // Build a 5-part ragdoll: head, torso, two arms, hips/legs (single block).
  // Joints are spherical (any-axis rotation), each anchored at the contact
  // point between segments. Density is tuned so the torso dominates inertia.
  const parts = [];
  const joints = [];

  const makePart = (geom, mat, x, y, z, density, halfExtents) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(lastPos.x + x, lastPos.y + y, lastPos.z + z);
    mesh.castShadow = true;
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setLinearDamping(0.5)
        .setAngularDamping(0.5),
    );
    if (halfExtents.isBox) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setDensity(density),
        body,
      );
    } else {
      world.createCollider(
        RAPIER.ColliderDesc.ball(halfExtents.r).setDensity(density),
        body,
      );
    }
    parts.push({ body, mesh });
    return body;
  };

  const torsoMat = new THREE.MeshStandardMaterial({ color: ENEMY_COLOR, roughness: 0.55 });
  const headMat = new THREE.MeshStandardMaterial({ color: ENEMY_HEAD_COLOR, roughness: 0.7 });
  const limbMat = new THREE.MeshStandardMaterial({ color: 0xb83838, roughness: 0.6 });

  const torso = makePart(
    new THREE.BoxGeometry(0.7, 0.8, 0.4),
    torsoMat,
    0, 0, 0, 4, { isBox: true, x: 0.35, y: 0.4, z: 0.2 },
  );
  const head = makePart(
    new THREE.SphereGeometry(0.32, 16, 16),
    headMat,
    0, 0.7, 0, 2, { r: 0.32 },
  );
  const armL = makePart(
    new THREE.BoxGeometry(0.22, 0.7, 0.22),
    limbMat,
    -0.45, 0.05, 0, 1, { isBox: true, x: 0.11, y: 0.35, z: 0.11 },
  );
  const armR = makePart(
    new THREE.BoxGeometry(0.22, 0.7, 0.22),
    limbMat,
    0.45, 0.05, 0, 1, { isBox: true, x: 0.11, y: 0.35, z: 0.11 },
  );
  const legs = makePart(
    new THREE.BoxGeometry(0.6, 0.7, 0.35),
    limbMat,
    0, -0.75, 0, 3, { isBox: true, x: 0.3, y: 0.35, z: 0.175 },
  );

  // Joints (anchors are in each body's local frame).
  const J = RAPIER.JointData;
  joints.push(world.createImpulseJoint(
    J.spherical({ x: 0, y: 0.45, z: 0 }, { x: 0, y: -0.32, z: 0 }), torso, head, true,
  ));
  joints.push(world.createImpulseJoint(
    J.spherical({ x: -0.4, y: 0.35, z: 0 }, { x: 0.11, y: 0.35, z: 0 }), torso, armL, true,
  ));
  joints.push(world.createImpulseJoint(
    J.spherical({ x: 0.4, y: 0.35, z: 0 }, { x: -0.11, y: 0.35, z: 0 }), torso, armR, true,
  ));
  joints.push(world.createImpulseJoint(
    J.spherical({ x: 0, y: -0.4, z: 0 }, { x: 0, y: 0.35, z: 0 }), torso, legs, true,
  ));

  // Apply impulse from impact: knockback away from player, plus an upward kick.
  const knock = 8;
  torso.applyImpulse({ x: impactDir.x * knock, y: 6, z: impactDir.z * knock }, true);
  head.applyImpulse({ x: impactDir.x * knock * 0.4, y: 2, z: impactDir.z * knock * 0.4 }, true);

  enemyState.ragdoll = { parts, joints };
  enemyState.respawnAt = performance.now() + 3000;

  score += 1;
  updateHud(`KO! Respawn in 3s...`);
};

// First spawn
spawnEnemy();

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = Object.create(null);
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Mouse aim — project ground hit point.
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const aimPoint = new THREE.Vector3(0, 0, 0);

const updateAimFromMouse = (ev) => {
  ndc.x = (ev.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(groundPlane, aimPoint);
};
window.addEventListener('mousemove', updateAimFromMouse);

const fireballs = [];
const FIREBALL_SPEED = 22;
const FIREBALL_LIFE = 2.5;

const castFireball = () => {
  if (!enemyState.alive) return;
  const origin = new THREE.Vector3();
  wand.getWorldPosition(origin);
  const dir = new THREE.Vector3().subVectors(aimPoint, origin);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) return;
  dir.normalize();

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xff8a2a, emissive: 0xff4400, emissiveIntensity: 2.0, roughness: 0.4,
    }),
  );
  mesh.position.copy(origin);
  scene.add(mesh);

  const light = new THREE.PointLight(0xff7a30, 1.5, 5);
  mesh.add(light);

  // Kinematic for predictable hit checks (gameplay > physics realism).
  fireballs.push({
    mesh,
    velocity: dir.multiplyScalar(FIREBALL_SPEED),
    ttl: FIREBALL_LIFE,
    dirX: dir.x,
    dirZ: dir.z,
  });
};

window.addEventListener('mousedown', (ev) => {
  updateAimFromMouse(ev);
  castFireball();
});

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

let score = 0;

const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = `
  <div class="title">Magic Battleground MVP</div>
  <div class="controls">WASD to move • Mouse to aim • Click to cast fireball</div>
  <div class="score">KOs: <span id="score">0</span></div>
  <div class="status" id="status"></div>
`;
document.body.appendChild(hud);

const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const updateHud = (statusText = '') => {
  scoreEl.textContent = String(score);
  statusEl.textContent = statusText;
};
updateHud();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const PLAYER_SPEED = 6.5;
const tmpVec = new THREE.Vector3();
const clock = new THREE.Clock();

const tick = () => {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);

  // Player movement (camera-relative would be nicer, but the camera is fixed
  // overhead so world-aligned input is intuitive enough).
  const move = tmpVec.set(0, 0, 0);
  if (keys.KeyW || keys.ArrowUp) move.z -= 1;
  if (keys.KeyS || keys.ArrowDown) move.z += 1;
  if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
  if (keys.KeyD || keys.ArrowRight) move.x += 1;
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(PLAYER_SPEED * dt);

  const cur = playerRigid.translation();
  const next = {
    x: THREE.MathUtils.clamp(cur.x + move.x, -ARENA_HALF + 1, ARENA_HALF - 1),
    y: PLAYER_SIZE.h / 2,
    z: THREE.MathUtils.clamp(cur.z + move.z, -ARENA_HALF + 1, ARENA_HALF - 1),
  };
  playerRigid.setNextKinematicTranslation(next);
  playerGroup.position.set(next.x, next.y, next.z);

  // Face the aim direction (rotate group around Y).
  if (aimPoint.lengthSq() > 0.1) {
    const dx = aimPoint.x - next.x;
    const dz = aimPoint.z - next.z;
    if (dx * dx + dz * dz > 0.05) {
      playerGroup.rotation.y = Math.atan2(dx, dz);
    }
  }

  // Step physics.
  world.step();

  // Enemy AI: simple homing — walk toward the player. Skipped while ragdolling.
  if (enemyState.alive) {
    const ep = enemyState.rigid.translation();
    const dx = next.x - ep.x;
    const dz = next.z - ep.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.2) {
      const speed = 2.2;
      enemyState.rigid.setLinvel({ x: (dx / dist) * speed, y: enemyState.rigid.linvel().y, z: (dz / dist) * speed }, true);
    } else {
      enemyState.rigid.setLinvel({ x: 0, y: enemyState.rigid.linvel().y, z: 0 }, true);
    }
    enemyState.group.position.set(ep.x, ep.y, ep.z);
  }

  // Ragdoll sync.
  if (enemyState.ragdoll) {
    for (const p of enemyState.ragdoll.parts) {
      const t = p.body.translation();
      const r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    if (performance.now() >= enemyState.respawnAt) {
      for (const p of enemyState.ragdoll.parts) {
        scene.remove(p.mesh);
        world.removeRigidBody(p.body);
      }
      enemyState.ragdoll = null;
      spawnEnemy();
      updateHud('');
    }
  }

  // Fireballs: integrate, sync, check hit.
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    fb.ttl -= dt;
    fb.mesh.position.x += fb.velocity.x * dt;
    fb.mesh.position.z += fb.velocity.z * dt;

    let consumed = false;

    if (enemyState.alive) {
      const ep = enemyState.rigid.translation();
      const dx = fb.mesh.position.x - ep.x;
      const dz = fb.mesh.position.z - ep.z;
      const dy = fb.mesh.position.y - ep.y;
      if (dx * dx + dy * dy + dz * dz < 0.65 * 0.65) {
        consumed = true;
        killEnemy({ x: fb.dirX, z: fb.dirZ });
      }
    }

    // Out-of-bounds or expired
    if (
      !consumed &&
      (fb.ttl <= 0 ||
       Math.abs(fb.mesh.position.x) > ARENA_HALF ||
       Math.abs(fb.mesh.position.z) > ARENA_HALF)
    ) {
      consumed = true;
    }

    if (consumed) {
      scene.remove(fb.mesh);
      fireballs.splice(i, 1);
    }
  }

  // Camera follow (smooth lerp behind/above the player).
  const camTarget = tmpVec.set(playerGroup.position.x, 7, playerGroup.position.z + 9);
  camera.position.lerp(camTarget, 0.08);
  camera.lookAt(playerGroup.position.x, 1, playerGroup.position.z);

  renderer.render(scene, camera);
};

tick();

// Hint to anyone debugging in the console.
// Expose internals so headless tests / dev tools can drive the game without
// dispatching synthetic input events (which browsers may gate for security).
window.__mb = {
  scene, world, playerGroup, playerRigid, enemyState, fireballs,
  keys, aimPoint, castFireball,
};
