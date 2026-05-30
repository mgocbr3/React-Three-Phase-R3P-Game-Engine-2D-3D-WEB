const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TYPE_CHART = {
  fire: { grass: 1.3, water: 0.8, electric: 1.0, normal: 1.0 },
  water: { fire: 1.3, grass: 0.8, electric: 1.0, normal: 1.0 },
  grass: { water: 1.3, fire: 0.8, electric: 1.0, normal: 1.0 },
  electric: { water: 1.3, grass: 0.9, fire: 1.0, normal: 1.0 },
  normal: { fire: 1.0, water: 1.0, grass: 1.0, electric: 1.0, normal: 1.0 },
};

const createPokemon = (name, type, level, maxHp, atk, def, speed, moves) => ({
  name,
  type,
  level,
  maxHp,
  hp: maxHp,
  atk,
  def,
  speed,
  exp: 0,
  moves,
  fainted: false,
});

const clonePokemon = (p) => ({ ...p, moves: p.moves.map((m) => ({ ...m })) });

const calcDamage = (attacker, defender, move) => {
  const stab = attacker.type === move.type ? 1.15 : 1;
  const typeMult = TYPE_CHART[move.type]?.[defender.type] ?? 1;
  const raw = ((attacker.atk * move.power) / Math.max(1, defender.def)) * stab * typeMult;
  const variance = 0.9 + Math.random() * 0.2;
  return {
    amount: Math.max(1, Math.floor(raw * variance)),
    typeMult,
  };
};

const toSummary = (team) => team.map((p, i) => `${i + 1}.${p.name} ${Math.max(0, p.hp)}/${p.maxHp}`).join(' | ');

export default function setupPokemonSlice(ctx) {
  const { scene, gameObjects, Phaser } = ctx;

  const player = gameObjects.get('player');
  const trainerA = gameObjects.get('trainer-a');
  const trainerB = gameObjects.get('trainer-b');
  const grassWest = gameObjects.get('grass-west');
  const grassEast = gameObjects.get('grass-east');
  const lake = gameObjects.get('lake');

  if (!player || !trainerA || !trainerB || !grassWest || !grassEast) {
    // eslint-disable-next-line no-console
    console.warn('[pokemon-slice] missing required scene objects');
    return;
  }

  const keys = {
    up: scene.input.keyboard.addKey('W'),
    left: scene.input.keyboard.addKey('A'),
    down: scene.input.keyboard.addKey('S'),
    right: scene.input.keyboard.addKey('D'),
    interact: scene.input.keyboard.addKey('E'),
    one: scene.input.keyboard.addKey('ONE'),
    two: scene.input.keyboard.addKey('TWO'),
    three: scene.input.keyboard.addKey('THREE'),
    four: scene.input.keyboard.addKey('FOUR'),
  };
  const cursors = scene.input.keyboard.createCursorKeys();

  const party = [
    createPokemon('Flameling', 'fire', 8, 58, 22, 14, 19, [
      { name: 'Ember Shot', type: 'fire', power: 14 },
      { name: 'Quick Claw', type: 'normal', power: 10 },
    ]),
    createPokemon('Aquary', 'water', 7, 62, 18, 18, 15, [
      { name: 'Bubble Wave', type: 'water', power: 13 },
      { name: 'Tail Slap', type: 'normal', power: 10 },
    ]),
    createPokemon('Leaflet', 'grass', 7, 64, 17, 20, 12, [
      { name: 'Leaf Cutter', type: 'grass', power: 13 },
      { name: 'Tackle', type: 'normal', power: 9 },
    ]),
    createPokemon('Voltkit', 'electric', 6, 50, 19, 12, 22, [
      { name: 'Spark Bolt', type: 'electric', power: 15 },
      { name: 'Bite', type: 'normal', power: 9 },
    ]),
  ];

  const wildPool = [
    createPokemon('Flaro', 'fire', 6, 46, 16, 11, 14, [
      { name: 'Tiny Ember', type: 'fire', power: 10 },
      { name: 'Scratch', type: 'normal', power: 8 },
    ]),
    createPokemon('Sprouty', 'grass', 6, 50, 14, 14, 13, [
      { name: 'Bud Whip', type: 'grass', power: 11 },
      { name: 'Headbutt', type: 'normal', power: 8 },
    ]),
    createPokemon('Drizzle', 'water', 7, 54, 15, 15, 12, [
      { name: 'Mini Tide', type: 'water', power: 12 },
      { name: 'Peck', type: 'normal', power: 8 },
    ]),
    createPokemon('Sparko', 'electric', 7, 45, 17, 10, 18, [
      { name: 'Static Zap', type: 'electric', power: 12 },
      { name: 'Quick Hit', type: 'normal', power: 9 },
    ]),
  ];

  const trainerTeams = {
    'trainer-a': [
      createPokemon('Rubblet', 'normal', 8, 58, 18, 16, 12, [
        { name: 'Slam', type: 'normal', power: 11 },
        { name: 'Guard Bash', type: 'normal', power: 9 },
      ]),
      createPokemon('Mossy', 'grass', 8, 60, 18, 19, 10, [
        { name: 'Vine Snap', type: 'grass', power: 12 },
        { name: 'Roll Hit', type: 'normal', power: 9 },
      ]),
    ],
    'trainer-b': [
      createPokemon('Aqualynx', 'water', 9, 68, 20, 20, 15, [
        { name: 'Current Fang', type: 'water', power: 13 },
        { name: 'Rush', type: 'normal', power: 10 },
      ]),
      createPokemon('Voltora', 'electric', 9, 60, 23, 14, 20, [
        { name: 'Thunder Dash', type: 'electric', power: 14 },
        { name: 'Claw', type: 'normal', power: 9 },
      ]),
    ],
  };

  const world = {
    minX: 40,
    minY: 40,
    maxX: 1560,
    maxY: 1160,
  };

  const blocked = [];
  if (lake?.getBounds) blocked.push(lake.getBounds());

  const grassAreas = [grassWest.getBounds(), grassEast.getBounds()];

  const state = {
    mode: 'explore',
    playerSpeed: 230,
    activeIndex: 0,
    enemy: null,
    enemyTeam: null,
    enemyIndex: 0,
    battleType: null,
    battleOwner: null,
    inGrassStep: 0,
    badges: 0,
    defeatedTrainers: new Set(),
    battleMessage: 'Explore and battle!',
    uiMode: 'main',
    pendingSwitch: false,
    introCooldown: 0,
  };

  const hudPanel = scene.add.rectangle(800, 60, 1560, 96, 0x0f1f0f, 0.82).setDepth(150);
  const hudText = scene.add.text(30, 16, '', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#f3ffe8',
    wordWrap: { width: 1520 },
  }).setDepth(151);

  const battlePanel = scene.add.rectangle(800, 920, 1560, 500, 0x121522, 0.9).setDepth(200).setVisible(false);
  const battleText = scene.add.text(70, 700, '', {
    fontFamily: 'monospace',
    fontSize: '24px',
    color: '#e9f4ff',
    wordWrap: { width: 1480 },
  }).setDepth(201).setVisible(false);

  const chooseNextAlive = () => party.findIndex((p) => !p.fainted);

  const gainExp = (pokemon, value) => {
    pokemon.exp += value;
    const needed = pokemon.level * 18;
    if (pokemon.exp >= needed) {
      pokemon.exp -= needed;
      pokemon.level += 1;
      pokemon.maxHp += 4;
      pokemon.atk += 2;
      pokemon.def += 2;
      pokemon.speed += 1;
      pokemon.hp = pokemon.maxHp;
      state.battleMessage = `${pokemon.name} leveled up to Lv.${pokemon.level}!`;
    }
  };

  const setBattleVisible = (visible) => {
    battlePanel.setVisible(visible);
    battleText.setVisible(visible);
  };

  const refreshBattleUI = () => {
    if (state.mode !== 'battle' || !state.enemy) return;
    const ally = party[state.activeIndex];
    const enemy = state.enemy;
    const optionsMain = '1 Attack  2 Strong Move  3 Switch Pokemon  4 Run (wild only)';
    const optionsSwitch = `Choose Switch: 1 ${party[0].name}  2 ${party[1].name}  3 ${party[2].name}  4 ${party[3].name}`;
    battleText.setText([
      `${state.battleType === 'wild' ? 'Wild' : 'Trainer'} Battle ${state.battleOwner ? `vs ${state.battleOwner}` : ''}`,
      `${ally.name} Lv.${ally.level} HP ${Math.max(0, ally.hp)}/${ally.maxHp}    vs    ${enemy.name} Lv.${enemy.level} HP ${Math.max(0, enemy.hp)}/${enemy.maxHp}`,
      '',
      state.battleMessage,
      '',
      state.uiMode === 'switch' ? optionsSwitch : optionsMain,
    ]);
  };

  const endBattle = (won) => {
    setBattleVisible(false);
    state.mode = 'explore';
    state.enemy = null;
    state.enemyTeam = null;
    state.enemyIndex = 0;
    state.battleType = null;
    state.uiMode = 'main';
    state.pendingSwitch = false;
    state.introCooldown = 0.65;

    if (won && state.battleOwner && !state.defeatedTrainers.has(state.battleOwner)) {
      state.defeatedTrainers.add(state.battleOwner);
      state.badges += 1;
    }
  };

  const applyAttack = (attacker, defender, move) => {
    const hit = calcDamage(attacker, defender, move);
    defender.hp = Math.max(0, defender.hp - hit.amount);
    defender.fainted = defender.hp <= 0;
    const eff = hit.typeMult > 1.05 ? 'Super effective!' : hit.typeMult < 0.95 ? 'Not very effective.' : '';
    return `${attacker.name} used ${move.name} (${hit.amount} dmg). ${eff}`.trim();
  };

  const enemyTurn = () => {
    const enemy = state.enemy;
    const ally = party[state.activeIndex];
    if (!enemy || !ally) return;

    const move = enemy.moves[Math.random() < 0.5 ? 0 : 1];
    const message = applyAttack(enemy, ally, move);
    if (ally.fainted) {
      const next = chooseNextAlive();
      if (next === -1) {
        state.battleMessage = `${message}\nAll your pokemons fainted. Team restored at camp.`;
        party.forEach((p) => {
          p.fainted = false;
          p.hp = p.maxHp;
        });
        state.activeIndex = 0;
        endBattle(false);
        return;
      }
      state.activeIndex = next;
      state.battleMessage = `${message}\n${ally.name} fainted. ${party[next].name}, go!`;
      refreshBattleUI();
      return;
    }
    state.battleMessage = message;
    refreshBattleUI();
  };

  const checkEnemyTeamProgress = () => {
    if (!state.enemy) return false;
    if (!state.enemy.fainted) return false;

    if (state.battleType === 'trainer' && state.enemyTeam) {
      state.enemyIndex += 1;
      if (state.enemyIndex >= state.enemyTeam.length) {
        gainExp(party[state.activeIndex], 24);
        state.battleMessage = `You defeated trainer ${state.battleOwner}!`;
        refreshBattleUI();
        endBattle(true);
        return true;
      }
      state.enemy = clonePokemon(state.enemyTeam[state.enemyIndex]);
      state.battleMessage = `Trainer sent ${state.enemy.name}!`;
      refreshBattleUI();
      return true;
    }

    gainExp(party[state.activeIndex], 14);
    state.battleMessage = `Enemy ${state.enemy.name} fainted. You won!`;
    refreshBattleUI();
    endBattle(true);
    return true;
  };

  const startBattle = ({ enemyTeam, battleType, owner }) => {
    state.mode = 'battle';
    state.battleType = battleType;
    state.battleOwner = owner ?? null;
    state.enemyTeam = enemyTeam ? enemyTeam.map(clonePokemon) : null;
    state.enemyIndex = 0;
    state.enemy = clonePokemon((state.enemyTeam ? state.enemyTeam[0] : wildPool[Math.floor(Math.random() * wildPool.length)]));
    state.uiMode = 'main';
    state.pendingSwitch = false;
    state.battleMessage = `${battleType === 'wild' ? 'A wild' : 'Trainer'} ${state.enemy.name} appeared!`;
    setBattleVisible(true);
    refreshBattleUI();
  };

  const isInsideRect = (x, y, rect) => (
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  );

  const collidesBlocked = (x, y, radius) => blocked.some((r) => (
    x + radius > r.left && x - radius < r.right && y + radius > r.top && y - radius < r.bottom
  ));

  const updateHud = () => {
    const inGrass = grassAreas.some((zone) => isInsideRect(player.x, player.y, zone));
    const badgeGoal = state.defeatedTrainers.size >= 2 ? 'Goal complete! return to grass for farming XP' : 'Defeat both trainers';
    hudText.setText([
      'Pokemon Vertical Slice | Move WASD/Arrows | Interact E | Battle keys 1-4',
      `Area: ${inGrass ? 'Tall Grass' : 'Path'} | Team: ${toSummary(party)} | Badges: ${state.badges} | ${badgeGoal}`,
    ]);
  };

  updateHud();

  return function tick(deltaMs) {
    const dt = deltaMs / 1000;

    if (state.introCooldown > 0) state.introCooldown = Math.max(0, state.introCooldown - dt);

    if (state.mode === 'battle') {
      if (state.uiMode === 'main') {
        if (Phaser.Input.Keyboard.JustDown(keys.one)) {
          const ally = party[state.activeIndex];
          const enemy = state.enemy;
          if (!ally || !enemy) return;
          const move = ally.moves[0];
          const allyFirst = ally.speed >= enemy.speed;
          state.battleMessage = allyFirst
            ? applyAttack(ally, enemy, move)
            : applyAttack(enemy, ally, enemy.moves[Math.random() < 0.5 ? 0 : 1]);
          if (allyFirst) {
            if (!checkEnemyTeamProgress()) enemyTurn();
          } else if (!ally.fainted) {
            state.battleMessage += `\n${applyAttack(ally, enemy, move)}`;
            checkEnemyTeamProgress();
          }
          refreshBattleUI();
          return;
        }
        if (Phaser.Input.Keyboard.JustDown(keys.two)) {
          const ally = party[state.activeIndex];
          const enemy = state.enemy;
          if (!ally || !enemy) return;
          const move = ally.moves[1] ?? ally.moves[0];
          state.battleMessage = applyAttack(ally, enemy, move);
          if (!checkEnemyTeamProgress()) enemyTurn();
          refreshBattleUI();
          return;
        }
        if (Phaser.Input.Keyboard.JustDown(keys.three)) {
          state.uiMode = 'switch';
          state.battleMessage = 'Choose pokemon to switch.';
          refreshBattleUI();
          return;
        }
        if (Phaser.Input.Keyboard.JustDown(keys.four)) {
          if (state.battleType !== 'wild') {
            state.battleMessage = 'Cannot run from trainer battle.';
            refreshBattleUI();
            return;
          }
          if (Math.random() < 0.55) {
            state.battleMessage = 'Escaped safely.';
            refreshBattleUI();
            endBattle(false);
          } else {
            state.battleMessage = 'Could not escape!';
            enemyTurn();
          }
          return;
        }
      } else if (state.uiMode === 'switch') {
        const keyOrder = [keys.one, keys.two, keys.three, keys.four];
        for (let i = 0; i < keyOrder.length; i += 1) {
          if (!Phaser.Input.Keyboard.JustDown(keyOrder[i])) continue;
          if (party[i].fainted) {
            state.battleMessage = `${party[i].name} has fainted.`;
            state.uiMode = 'main';
            refreshBattleUI();
            return;
          }
          state.activeIndex = i;
          state.uiMode = 'main';
          state.battleMessage = `Go ${party[i].name}!`;
          enemyTurn();
          refreshBattleUI();
          return;
        }
      }

      updateHud();
      return;
    }

    let mx = 0;
    let my = 0;
    if (keys.left.isDown || cursors.left.isDown) mx -= 1;
    if (keys.right.isDown || cursors.right.isDown) mx += 1;
    if (keys.up.isDown || cursors.up.isDown) my -= 1;
    if (keys.down.isDown || cursors.down.isDown) my += 1;

    const len = Math.hypot(mx, my);
    if (len > 0) {
      const dirX = mx / len;
      const dirY = my / len;
      const nextX = clamp(player.x + dirX * state.playerSpeed * dt, world.minX, world.maxX);
      const nextY = clamp(player.y + dirY * state.playerSpeed * dt, world.minY, world.maxY);
      const radius = player.radius ?? 22;
      if (!collidesBlocked(nextX, nextY, radius)) {
        player.x = nextX;
        player.y = nextY;
      }

      const inGrass = grassAreas.some((zone) => isInsideRect(player.x, player.y, zone));
      if (inGrass && state.introCooldown <= 0) {
        state.inGrassStep += dt;
        if (state.inGrassStep >= 0.55) {
          state.inGrassStep = 0;
          if (Math.random() < 0.23) {
            startBattle({ battleType: 'wild' });
            updateHud();
            return;
          }
        }
      } else {
        state.inGrassStep = 0;
      }
    }

    const checkTrainerTrigger = (trainerObj, trainerId) => {
      if (state.defeatedTrainers.has(trainerId)) return false;
      const dist = Math.hypot(player.x - trainerObj.x, player.y - trainerObj.y);
      if (dist > 95) return false;
      if (!Phaser.Input.Keyboard.JustDown(keys.interact)) return false;
      startBattle({
        battleType: 'trainer',
        owner: trainerId,
        enemyTeam: trainerTeams[trainerId],
      });
      return true;
    };

    if (checkTrainerTrigger(trainerA, 'trainer-a') || checkTrainerTrigger(trainerB, 'trainer-b')) {
      updateHud();
      return;
    }

    if (state.defeatedTrainers.has('trainer-a')) trainerA.setFillStyle(0x777777, 1);
    if (state.defeatedTrainers.has('trainer-b')) trainerB.setFillStyle(0x666666, 1);

    updateHud();
  };
}
