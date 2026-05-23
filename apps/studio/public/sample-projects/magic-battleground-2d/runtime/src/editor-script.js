// Magic Battleground 2D — gameplay loaded by PhaserRuntimeMount inside the
// editor viewport. Declared in project.pixlproject.json as
// `scenes[0].runtimeScript = "runtime/src/editor-script.js"`.
//
// Plain ES module — Vite serves files under /sample-projects/ raw, so this
// file can't pull bare imports like `import 'three'`. Everything the script
// needs is provided via the ctx parameter at setup time:
//   ctx.scene        — the live Phaser.Scene
//   ctx.gameObjects  — Map<name, Phaser.GameObjects.GameObject> for the
//                      rootObjects authored in the project doc
//   ctx.Phaser       — the Phaser namespace (rare cases that need globals)
//
// The setup function returns a tick(delta, time) function. The mount wires
// it to scene update so it runs once per frame.

export default function setupArena(ctx) {
  const { scene, gameObjects } = ctx;

  const player = gameObjects.get('player-mage');
  const enemy = gameObjects.get('enemy-mage');
  const fireballStatic = gameObjects.get('fireball-incoming');
  const hpFill = gameObjects.get('hp-bar-fill');
  const wandOrb = gameObjects.get('player-wand-orb');

  if (!player || !enemy) {
    // eslint-disable-next-line no-console
    console.warn('[editor-script] expected player + enemy gameObjects; got', {
      player: !!player,
      enemy: !!enemy,
    });
    return;
  }

  // The static fireball in the project doc was a hint of the gameplay —
  // hide it now that the live one will spawn on click.
  if (fireballStatic) fireballStatic.setVisible(false);

  // Player input. Phaser maps WASD via addKey() and gives a CursorKeys
  // helper for the arrow keys. Both are supported so left-handers and
  // arrow-key folk get the same controls.
  const keys = {
    W: scene.input.keyboard.addKey('W'),
    A: scene.input.keyboard.addKey('A'),
    S: scene.input.keyboard.addKey('S'),
    D: scene.input.keyboard.addKey('D'),
  };
  const cursors = scene.input.keyboard.createCursorKeys();

  // Game state.
  let hpPct = 1.0;
  const HP_FULL_WIDTH = hpFill ? hpFill.displayWidth : 200;
  const PLAYER_SPEED = 240; // px/s
  const ENEMY_SPEED = 80;
  const PROJECTILE_SPEED = 600;
  const PROJECTILE_TTL = 2.5;
  const PROJECTILE_RADIUS = 50;
  const PROJECTILE_FROM_PLAYER_OFFSET_X = 25;
  const PLAYER_Y_FLOOR = 460; // matches floor strip Y
  const ARENA_BOUNDS = { minX: 40, maxX: 760, minY: 100, maxY: 480 };

  const projectiles = [];

  // Click to cast a fireball aimed at the click point.
  scene.input.on('pointerdown', (pointer) => {
    const sourceX = player.x + (player.flipX ? -PROJECTILE_FROM_PLAYER_OFFSET_X : PROJECTILE_FROM_PLAYER_OFFSET_X);
    const sourceY = player.y - 16;
    const dx = pointer.worldX - sourceX;
    const dy = pointer.worldY - sourceY;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    const vx = (dx / len) * PROJECTILE_SPEED;
    const vy = (dy / len) * PROJECTILE_SPEED;

    // Re-use the orb-blue texture already loaded by the project's static
    // fireball; texture keys are the asset URLs declared in the doc.
    const ORB_KEY = 'assets/fx/orb-blue.png';
    if (!scene.textures.exists(ORB_KEY)) return;

    const orb = scene.add.image(sourceX, sourceY, ORB_KEY);
    orb.setScale(1.4);
    orb.setDepth(8);
    projectiles.push({ obj: orb, vx, vy, ttl: PROJECTILE_TTL });

    // Wand orb flashes briefly to telegraph the cast.
    if (wandOrb) {
      const baseScale = wandOrb.scale;
      wandOrb.setScale(baseScale * 1.6);
      scene.time.delayedCall(80, () => {
        try { wandOrb.setScale(baseScale); } catch { /* noop */ }
      });
    }
  });

  function setHp(pct) {
    hpPct = Math.max(0, Math.min(1, pct));
    if (hpFill) hpFill.displayWidth = HP_FULL_WIDTH * hpPct;
  }

  function killEnemy() {
    enemy.setVisible(false);
    enemy.active = false;
    // Damage feedback: drop player HP a bit too (just to show the bar moves).
    setHp(Math.max(0.05, hpPct - 0.12));
    // Respawn elsewhere after a short delay.
    scene.time.delayedCall(1500, () => {
      const sign = Math.random() < 0.5 ? -1 : 1;
      enemy.x = player.x + sign * (220 + Math.random() * 80);
      enemy.x = Math.max(ARENA_BOUNDS.minX, Math.min(ARENA_BOUNDS.maxX, enemy.x));
      enemy.y = PLAYER_Y_FLOOR;
      enemy.setVisible(true);
      enemy.active = true;
      // Heal a sliver on respawn so the bar trends down over many KOs.
      setHp(Math.min(1, hpPct + 0.05));
    });
  }

  return function tick(deltaMs) {
    const dts = deltaMs / 1000;

    // Player movement.
    const moveLeft = keys.A.isDown || cursors.left.isDown;
    const moveRight = keys.D.isDown || cursors.right.isDown;
    const moveUp = keys.W.isDown || cursors.up.isDown;
    const moveDown = keys.S.isDown || cursors.down.isDown;
    if (moveLeft) {
      player.x -= PLAYER_SPEED * dts;
      player.setFlipX(true);
    }
    if (moveRight) {
      player.x += PLAYER_SPEED * dts;
      player.setFlipX(false);
    }
    if (moveUp) player.y -= PLAYER_SPEED * dts;
    if (moveDown) player.y += PLAYER_SPEED * dts;
    player.x = Math.max(ARENA_BOUNDS.minX, Math.min(ARENA_BOUNDS.maxX, player.x));
    player.y = Math.max(ARENA_BOUNDS.minY, Math.min(ARENA_BOUNDS.maxY, player.y));

    // Wand orb follows the player (anchored 24px to the side).
    if (wandOrb) {
      const ox = player.flipX ? -22 : 22;
      wandOrb.x = player.x + ox;
      wandOrb.y = player.y;
    }

    // Enemy AI: drift toward the player along x, face them.
    if (enemy.visible && enemy.active !== false) {
      const dx = player.x - enemy.x;
      const dist = Math.abs(dx);
      if (dist > 80) {
        enemy.x += Math.sign(dx) * ENEMY_SPEED * dts;
      }
      enemy.setFlipX(dx > 0); // face player
      enemy.y = PLAYER_Y_FLOOR;
    }

    // Step projectiles.
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.obj.x += p.vx * dts;
      p.obj.y += p.vy * dts;
      p.ttl -= dts;

      // Hit-check vs enemy.
      if (enemy.visible && enemy.active !== false) {
        const ex = enemy.x;
        const ey = enemy.y - 20; // approximate centre of body
        if (Math.hypot(p.obj.x - ex, p.obj.y - ey) < PROJECTILE_RADIUS) {
          p.obj.destroy();
          projectiles.splice(i, 1);
          killEnemy();
          continue;
        }
      }

      // Despawn out of bounds or TTL expired.
      if (
        p.ttl <= 0 ||
        p.obj.x < -50 ||
        p.obj.x > 850 ||
        p.obj.y < -50 ||
        p.obj.y > 650
      ) {
        p.obj.destroy();
        projectiles.splice(i, 1);
      }
    }
  };
}
