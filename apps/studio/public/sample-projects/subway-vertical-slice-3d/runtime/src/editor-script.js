const LANES = [-3.2, 0, 3.2];
const PLAYER_Z = 8;

const pickLane = () => LANES[Math.floor(Math.random() * LANES.length)];
const randomBehind = (min = 70, max = 130) => -(min + Math.random() * (max - min));

export default function setupRunnerSlice(ctx) {
  const { scene, getObject3DById, mount } = ctx;

  const playerBody = getObject3DById('player-body');
  const playerHead = getObject3DById('player-head');
  if (!playerBody || !playerHead) {
    // eslint-disable-next-line no-console
    console.warn('[runner-slice] missing player objects');
    return;
  }

  const obstacleIds = ['obstacle-1', 'obstacle-2', 'obstacle-3', 'obstacle-4', 'obstacle-5', 'obstacle-6'];
  const coinIds = ['coin-1', 'coin-2', 'coin-3', 'coin-4', 'coin-5', 'coin-6'];

  const obstacles = obstacleIds
    .map((id) => ({ id, obj: getObject3DById(id) }))
    .filter((entry) => !!entry.obj)
    .map((entry) => ({ ...entry, cooldown: 0 }));

  const coins = coinIds
    .map((id) => ({ id, obj: getObject3DById(id) }))
    .filter((entry) => !!entry.obj)
    .map((entry) => ({ ...entry, active: true, spin: Math.random() * Math.PI * 2 }));

  const state = {
    lane: 1,
    targetLane: 1,
    speed: 16,
    maxSpeed: 30,
    accel: 0.9,
    distance: 0,
    score: 0,
    coins: 0,
    lives: 3,
    jumpY: 0,
    jumpVy: 0,
    gravity: 34,
    jumpImpulse: 13,
    invuln: 0,
    gameOver: false,
  };

  const keysDown = new Set();

  const onKeyDown = (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      state.targetLane = Math.max(0, state.targetLane - 1);
    }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      state.targetLane = Math.min(2, state.targetLane + 1);
    }
    if ((event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') && !state.gameOver && state.jumpY < 0.01) {
      state.jumpVy = state.jumpImpulse;
    }
    if ((event.code === 'KeyR' || event.code === 'Enter') && state.gameOver) {
      state.gameOver = false;
      state.lives = 3;
      state.speed = 16;
      state.distance = 0;
      state.score = 0;
      state.coins = 0;
      state.jumpY = 0;
      state.jumpVy = 0;
      state.invuln = 0;
      state.targetLane = 1;
      state.lane = 1;
      obstacles.forEach((entry) => {
        entry.cooldown = 0;
        entry.obj.position.x = pickLane();
        entry.obj.position.z = randomBehind();
      });
      coins.forEach((entry) => {
        entry.active = true;
        entry.obj.visible = true;
        entry.obj.position.x = pickLane();
        entry.obj.position.z = randomBehind(60, 140);
      });
    }
    keysDown.add(event.code);
  };

  const onKeyUp = (event) => {
    keysDown.delete(event.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const hud = document.createElement('div');
  hud.style.position = 'absolute';
  hud.style.left = '12px';
  hud.style.top = '12px';
  hud.style.padding = '10px 12px';
  hud.style.borderRadius = '8px';
  hud.style.background = 'rgba(7, 10, 16, 0.72)';
  hud.style.color = '#f6f8ff';
  hud.style.fontFamily = 'monospace';
  hud.style.fontSize = '14px';
  hud.style.lineHeight = '1.35';
  hud.style.pointerEvents = 'none';
  hud.style.whiteSpace = 'pre';
  mount?.appendChild(hud);

  const refreshHud = () => {
    hud.textContent = [
      'Runner Slice 3D',
      'Left/Right or A/D = lane | Up/Space = jump',
      `Distance: ${Math.floor(state.distance)}m   Score: ${Math.floor(state.score)}   Coins: ${state.coins}   Lives: ${state.lives}`,
      state.gameOver ? 'GAME OVER - press R or Enter to restart' : '',
    ].filter(Boolean).join('\n');
  };

  refreshHud();

  const hurtPlayer = () => {
    if (state.invuln > 0 || state.gameOver) return;
    state.lives -= 1;
    state.invuln = 1.2;
    if (state.lives <= 0) {
      state.gameOver = true;
    }
  };

  const laneX = () => LANES[state.targetLane];

  const tick = (dt, _time) => {
    if (state.gameOver) {
      refreshHud();
      return;
    }

    state.speed = Math.min(state.maxSpeed, state.speed + state.accel * dt);
    state.distance += state.speed * dt;
    state.score += state.speed * dt * 8;
    state.invuln = Math.max(0, state.invuln - dt);

    // Lane move.
    const targetX = laneX();
    const dx = targetX - playerBody.position.x;
    const laneStep = Math.min(1, dt * 10);
    playerBody.position.x += dx * laneStep;
    playerHead.position.x = playerBody.position.x;

    if (Math.abs(dx) < 0.03) {
      state.lane = state.targetLane;
      playerBody.position.x = targetX;
      playerHead.position.x = targetX;
    }

    // Jump arc.
    state.jumpVy -= state.gravity * dt;
    state.jumpY += state.jumpVy * dt;
    if (state.jumpY < 0) {
      state.jumpY = 0;
      state.jumpVy = 0;
    }
    playerBody.position.y = 1 + state.jumpY;
    playerHead.position.y = 2.05 + state.jumpY;

    // Camera follow.
    const cam = scene.game.renderer.threeJSCamera;
    const targetCamX = playerBody.position.x * 0.45;
    cam.position.x += (targetCamX - cam.position.x) * Math.min(1, dt * 5);
    cam.position.y += ((7.5 + state.jumpY * 0.2) - cam.position.y) * Math.min(1, dt * 4);
    cam.position.z = 14;
    cam.lookAt(playerBody.position.x * 0.2, 1.3 + state.jumpY * 0.1, PLAYER_Z - 3);

    // Obstacles stream toward player.
    for (const entry of obstacles) {
      const obstacle = entry.obj;
      obstacle.position.z += state.speed * dt;
      if (obstacle.position.z > 18) {
        obstacle.position.z = randomBehind();
        obstacle.position.x = pickLane();
        obstacle.position.y = Math.random() < 0.2 ? 1.3 : 0.75;
      }

      const closeX = Math.abs(obstacle.position.x - playerBody.position.x) < 1.05;
      const closeZ = Math.abs(obstacle.position.z - PLAYER_Z) < 1.15;
      const underJump = playerBody.position.y < (obstacle.position.y + 0.55);
      if (closeX && closeZ && underJump) {
        hurtPlayer();
      }
    }

    // Coins stream + pickup.
    for (const entry of coins) {
      const coin = entry.obj;
      entry.spin += dt * 5;
      coin.rotation.y = entry.spin;
      coin.position.z += state.speed * dt;

      if (!entry.active || coin.position.z > 18) {
        entry.active = true;
        coin.visible = true;
        coin.position.z = randomBehind(70, 150);
        coin.position.x = pickLane();
        coin.position.y = 1.2 + Math.random() * 0.6;
      }

      const pickX = Math.abs(coin.position.x - playerBody.position.x) < 0.9;
      const pickZ = Math.abs(coin.position.z - PLAYER_Z) < 0.95;
      const pickY = Math.abs(coin.position.y - (1 + state.jumpY)) < 1.1;
      if (entry.active && pickX && pickZ && pickY) {
        entry.active = false;
        coin.visible = false;
        state.coins += 1;
        state.score += 40;
      }
    }

    // Blink player on invulnerability.
    const blink = state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0;
    playerBody.visible = !blink;
    playerHead.visible = !blink;

    refreshHud();
  };

  return {
    tick,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      hud.remove();
      playerBody.visible = true;
      playerHead.visible = true;
    },
  };
}
