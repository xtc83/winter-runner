// Main game: renderer, loop, input, collisions, HUD.
(function () {
  const C = LS.CFG, S = LS.Storage.data, A = LS.Audio;
  const $ = (id) => document.getElementById(id);
  const map = LS.Maps.winter;

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  $('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = map.skyTexture();
  scene.fog = new THREE.Fog(map.fog.color, map.fog.near, map.fog.far);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
  const hemi = new THREE.HemisphereLight(map.hemi.sky, map.hemi.ground, map.hemi.intensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(map.sun.color, map.sun.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -30, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- snowfall ----------
  let snow = null;
  if (map.snowfall) {
    const N = 2500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = -Math.random() * 95 + 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    snow = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.22, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.9,
    }));
    snow.frustumCulled = false;
    scene.add(snow);
  }
  function updateSnow(dt, t) {
    if (!snow) return;
    const p = snow.geometry.attributes.position.array;
    const cz = camera.position.z, cx = camera.position.x;
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] -= dt * (1.6 + (i % 7) * 0.15);
      p[i] += Math.sin(t + i) * dt * 0.4;
      if (p[i + 1] < 0) p[i + 1] += 22;
      if (p[i + 2] > cz + 5) p[i + 2] -= 95;
      if (p[i + 2] < cz - 90) p[i + 2] += 95;
      if (p[i] > cx + 25) p[i] -= 50; else if (p[i] < cx - 25) p[i] += 50;
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- game objects ----------
  const world = new LS.World(scene, map);
  const player = new LS.Player(scene);
  const fx = new LS.Effects(scene);

  const G = {
    state: 'menu', // menu | running | paused | dead | over
    seed: 1, speed: C.SPEED_START, score: 0, coins: 0, runTime: 0,
    boostUsed: false, boosting: false, boostEnd: 0,
    power: {}, invuln: 0, stumbleT: 0, shake: 0, deadT: 0,
  };

  function newRun() {
    G.seed = (Math.random() * 1e9) >>> 0;
    world.reset(G.seed);
    player.reset();
    Object.assign(G, {
      speed: C.SPEED_START, score: 0, coins: 0, runTime: 0, boostUsed: false, boosting: false,
      boostEnd: 0, power: {}, invuln: 0, stumbleT: 0, shake: 0, deadT: 0,
    });
    $('powerups').innerHTML = '';
    hud.last = {};
  }

  function startRun() {
    A.init();
    newRun();
    G.state = 'running';
    show('hud'); hide('menu'); hide('over'); hide('pause');
    A.startMusic();
    toast('LOS!', 700);
  }

  // ---------- input ----------
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === 'm') { const m = A.toggleMute(); toast(m ? 'Ton aus' : 'Ton an', 600); return; }

    if (G.state === 'menu' || G.state === 'over') {
      if (k === 'enter' || (G.state === 'over' && k === ' ')) startRun();
      return;
    }
    if (G.state === 'paused') {
      if (k === 'p' || k === 'escape' || k === 'enter') resume();
      return;
    }
    if (G.state !== 'running') return;
    if (k === 'p' || k === 'escape') { pause(); return; }

    if (k === 'arrowleft' || k === 'a') { if (player.left()) laneFx(); }
    else if (k === 'arrowright' || k === 'd') { if (player.right()) laneFx(); }
    else if (k === 'arrowup' || k === 'w' || k === ' ') {
      if (player.jump(!!G.power.sneakers)) { (G.power.sneakers ? A.sfx.superJump : A.sfx.jump)(); fx.snowPuff(player.x, player.groundH, player.z, 6); }
    } else if (k === 'arrowdown' || k === 's') { if (player.roll() && player.grounded) { A.sfx.roll(); fx.snowPuff(player.x, player.y, player.z, 6); } }
    else if (k === 'e') tryBoost();
  });

  function laneFx() {
    A.sfx.lane();
    if (player.grounded) fx.snowPuff(player.x, player.y, player.z, 5);
  }
  function pause() { if (G.state !== 'running') return; G.state = 'paused'; show('pause'); A.stopLoop(); A.stopMusic(); }
  function resume() { G.state = 'running'; hide('pause'); A.startMusic(); if (player.flying) A.startLoop(); last = performance.now(); }
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- boost ----------
  function tryBoost() {
    if (G.boostUsed || G.runTime > C.BOOST_WINDOW || player.flying) return;
    G.boostUsed = true; G.boosting = true;
    const d = -player.z;
    G.boostEnd = d + C.BOOST_DIST;
    world.clearRange(d - 5, G.boostEnd + 120);
    player.flyY = C.BOOST_Y;
    player.rollT = 0;
    A.sfx.boostStart(); A.startLoop();
    G.shake = 0.5;
    toast('BOOST!', 900);
  }
  function endFlight() {
    player.flyY = null;
    G.invuln = 1.2;
    A.stopLoop(); A.sfx.boostEnd();
  }

  // ---------- power-ups ----------
  function activatePower(type) {
    const def = C.POWERUPS[type];
    A.sfx.powerup();
    toast(def.name.toUpperCase() + '!', 800);
    if (type === 'jetpack') {
      if (G.boosting) return;
      const d = -player.z;
      const len = Math.max(G.speed, 20) * def.dur;
      world.clearRange(d + len - 40, d + len + 80);
      world.skyCoins(d + 12, d + len - 15, C.JET_Y + 0.9);
      player.flyY = C.JET_Y;
      A.startLoop();
    }
    G.power[type] = def.dur;
  }
  function updatePowers(dt) {
    for (const type of Object.keys(G.power)) {
      G.power[type] -= dt;
      if (G.power[type] <= 0) {
        delete G.power[type];
        if (type === 'jetpack' && !G.boosting) endFlight();
        A.sfx.powerEnd();
      }
    }
  }

  // ---------- collisions ----------
  function crash() {
    fx.burst(new THREE.Vector3(player.x, player.y + 1, player.z - 0.5), 0xffffff);
    player.die();
    G.state = 'dead'; G.deadT = 0; G.shake = 0.6;
    A.sfx.crash(); A.stopLoop();
  }
  function stumble(o) {
    o.ignore = true;
    player.bounceBack();
    A.sfx.stumble();
    G.shake = 0.3;
    if (G.stumbleT > 0) { crash(); return; }
    G.stumbleT = 3;
    toast('Vorsicht!', 600);
  }
  function checkObstacles() {
    if (player.flying || G.invuln > 0) return;
    const h = player.height;
    const py0 = player.y, py1 = player.y + h;
    const sz0 = player.z - 0.3, sz1 = player.prevZ + 0.3; // swept along the frame
    for (const o of world.obstacles) {
      if (o.type === 'ramp' || o.ignore) continue;
      if (Math.abs(player.x - o.x) > 0.35 + o.w / 2) continue;
      if (sz1 < o.zFar || sz0 > o.zNear) continue;
      if (py1 <= o.y0 || py0 >= o.y1 - 0.45) continue;
      const wasInZ = !(player.prevZ + 0.3 < o.prevFar || player.prevZ - 0.3 > o.prevNear);
      if (wasInZ && o.type === 'train') stumble(o);
      else crash();
      return;
    }
  }

  function collect(dt) {
    if (G.boosting) return;
    const mag = !!G.power.magnet;
    const py0 = player.y, py1 = player.y + player.height;
    const zA = player.z - 0.7, zB = player.prevZ + 0.7;
    const target = new THREE.Vector3(player.x, player.y + 1, player.z);
    for (const c of world.coins) {
      if (c.taken) continue;
      const p = c.mesh.position;
      if (mag && !c.magnet && p.z < player.z + 1 && p.z > player.z - 28 && Math.abs(p.x - player.x) < 9) c.magnet = true;
      let hit = false;
      if (c.magnet) {
        p.lerp(target, 1 - Math.exp(-14 * dt));
        p.z -= G.speed * dt * 0.5;
        hit = p.distanceTo(target) < 1.2;
      } else {
        hit = Math.abs(p.x - player.x) < 0.9 && p.z > zA && p.z < zB && p.y > py0 - 0.5 && p.y < py1 + 0.3;
      }
      if (hit) { c.taken = true; G.coins++; A.sfx.coin(); fx.sparkle(p); }
    }
    for (const pu of world.powerups) {
      if (pu.taken) continue;
      const p = pu.mesh.position;
      if (Math.abs(p.x - player.x) < 1.0 && p.z > zA - 0.3 && p.z < zB + 0.3 && p.y > py0 - 0.6 && p.y < py1 + 0.5) {
        pu.taken = true; fx.burst(p, 0xffffff); activatePower(pu.type);
      }
    }
  }

  // ---------- HUD ----------
  const hud = { last: {} };
  function setText(id, v) { if (hud.last[id] !== v) { hud.last[id] = v; $(id).textContent = v; } }
  function updateHud() {
    const d = Math.floor(-player.z);
    setText('score', Math.floor(G.score).toLocaleString('de-DE'));
    setText('coinCount', G.coins);
    setText('dist', d + ' m');
    $('mult').classList.toggle('hidden', !G.power.double);
    $('nocoin').classList.toggle('hidden', !(G.coins === 0 && d > 50));
    const boostAvail = !G.boostUsed && G.runTime <= C.BOOST_WINDOW && G.state === 'running';
    $('boostPrompt').classList.toggle('hidden', !boostAvail);
    if (boostAvail) setText('boostTime', Math.ceil(C.BOOST_WINDOW - G.runTime));
    // power-up bars
    const box = $('powerups');
    for (const type of Object.keys(C.POWERUPS)) {
      let el = box.querySelector('[data-t="' + type + '"]');
      if (G.power[type]) {
        if (!el) {
          const def = C.POWERUPS[type];
          el = document.createElement('div'); el.className = 'pu'; el.dataset.t = type;
          el.innerHTML = `<div class="ico" style="background:${def.color}">${def.label}</div><div class="name">${def.name}</div><div class="bar"><i></i></div>`;
          box.appendChild(el);
        }
        el.querySelector('i').style.width = (G.power[type] / C.POWERUPS[type].dur * 100) + '%';
      } else if (el) el.remove();
    }
  }
  let toastTimer = null;
  function toast(text, ms) {
    const t = $('toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function renderRecords() {
    $('records').innerHTML = `
      <div>Highscore<b>${Math.floor(S.bestScore).toLocaleString('de-DE')}</b></div>
      <div>Weiteste Strecke<b>${Math.floor(S.bestDist)} m</b></div>
      <div>Bester No-Coin-Lauf<b>${Math.floor(S.bestNoCoin)} m</b></div>
      <div>Münzen gesamt<b>${S.totalCoins}</b></div>`;
  }

  function gameOver() {
    G.state = 'over';
    const d = Math.floor(-player.z);
    let record = false;
    if (G.score > S.bestScore) { S.bestScore = Math.floor(G.score); record = true; }
    if (d > S.bestDist) S.bestDist = d;
    const noCoin = G.coins === 0;
    if (noCoin && d > S.bestNoCoin) S.bestNoCoin = d;
    S.totalCoins += G.coins; S.runs++;
    LS.Storage.save();
    $('rScore').textContent = Math.floor(G.score).toLocaleString('de-DE');
    $('rDist').textContent = d + ' m';
    $('rCoins').textContent = G.coins;
    $('rNoCoinRow').classList.toggle('hidden', !noCoin);
    $('rNoCoin').textContent = d + ' m';
    $('newRecord').classList.toggle('hidden', !record);
    if (record) A.sfx.record();
    renderRecords();
    show('over');
    A.stopMusic();
  }

  // ---------- camera ----------
  // Low chase camera that follows lane dashes with a little lag and roll.
  const cam = { x: 0, y: 3.6, lookX: 0, roll: 0, dip: 0 };
  function updateCamera(dt, t) {
    const fy = player.flying ? player.y * 0.55 : player.y * 0.7;
    cam.x = LS.damp(cam.x, player.x * 0.85, 7, dt);
    cam.lookX = LS.damp(cam.lookX, player.x, 12, dt);
    cam.y = LS.damp(cam.y, 3.5 + fy, player.vy < 0 ? 6 : 4, dt);
    cam.dip = LS.damp(cam.dip, 0, 6, dt);
    cam.roll = LS.damp(cam.roll, -player.vx * 0.006, 10, dt);
    const back = player.flying ? 6.0 : 6.6;
    camera.position.set(cam.x, cam.y - cam.dip, player.z + back);
    if (G.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * G.shake;
      camera.position.y += (Math.random() - 0.5) * G.shake;
    }
    camera.lookAt(cam.lookX * 0.9, 1.2 + fy - cam.dip * 0.5, player.z - 9);
    camera.rotateZ(cam.roll);
    const fov = G.boosting ? 82 : player.flying ? 70 : 64 + (G.speed - C.SPEED_START) * 0.35;
    camera.fov = LS.damp(camera.fov, fov, 3, dt);
    camera.updateProjectionMatrix();
    sun.position.set(player.x + 10, 26, player.z + 6);
    sun.target.position.set(player.x, 0, player.z - 10);
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    if (G.state === 'running') {
      G.runTime += dt;
      const d = -player.z;
      let target = world.speedAt(d);
      if (G.boosting) target = C.BOOST_SPEED;
      G.speed = LS.damp(G.speed, target, G.boosting ? 2.5 : 1.5, dt);

      const ev = player.update(dt, world, G.speed);
      if (ev === 'land' || ev === 'roll') { A.sfx.land(); cam.dip = 0.25; fx.snowPuff(player.x, player.y, player.z, 10); }
      if (ev === 'roll') A.sfx.roll();
      if (ev === 'jump') A.sfx.jump();
      if (ev === 'superjump') A.sfx.superJump();
      const nd = -player.z;
      G.score += (nd - d) * (G.power.double ? 2 : 1);

      if (G.boosting && nd >= G.boostEnd) {
        G.boosting = false;
        if (G.power.jetpack) player.flyY = C.JET_Y; else endFlight();
      }
      updatePowers(dt);
      if (G.invuln > 0) G.invuln -= dt;
      if (G.stumbleT > 0) G.stumbleT -= dt;

      world.update(dt, player, G);
      collect(dt);
      checkObstacles();
      updateHud();
    } else if (G.state === 'dead') {
      player.update(dt, world, 0);
      G.deadT += dt;
      if (G.deadT > 1.3) gameOver();
    } else if (G.state === 'menu') {
      player.animate(dt, 0);
      world.update(dt, player, G);
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.5);
    updateCamera(dt, t);
    fx.update(dt, camera, G.state === 'running' ? G.speed : 0, G.boosting && G.state === 'running');
    updateSnow(dt, t);
    renderer.render(scene, camera);
  }

  // ---------- menu wiring ----------
  $('startBtn').onclick = () => { A.sfx.click(); startRun(); };
  $('againBtn').onclick = startRun;
  $('menuBtn').onclick = toMenu;
  $('quitBtn').onclick = toMenu;
  $('resumeBtn').onclick = resume;
  function toMenu() {
    A.stopMusic(); A.stopLoop();
    hide('over'); hide('pause'); hide('hud'); show('menu');
    newRun(); G.state = 'menu'; renderRecords();
  }
  $('musicVol').value = S.musicVol; $('sfxVol').value = S.sfxVol;
  $('musicVol').oninput = (e) => { S.musicVol = +e.target.value; A.setVolumes(S.musicVol, S.sfxVol); LS.Storage.save(); };
  $('sfxVol').oninput = (e) => { S.sfxVol = +e.target.value; A.setVolumes(S.musicVol, S.sfxVol); LS.Storage.save(); };
  $('musicFile').onchange = (e) => { if (e.target.files[0]) { A.setCustomMusic(e.target.files[0]); toast('Eigene Musik geladen', 1200); } };

  // debug hook for automated tests
  window.__game = { G, player, world, startRun };

  newRun();
  renderRecords();
  requestAnimationFrame(frame);
})();
