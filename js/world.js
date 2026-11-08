// Track generation, obstacles, coins, power-ups and scenery.
// Everything is generated from a seed, so the same seed gives the same track (multiplayer later).
// Distances "d" grow forward; world z = -d.
LS.World = class {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.buildStatic();
  }

  buildStatic() {
    const { scene, map } = this;
    const C = LS.CFG;
    this.static = new THREE.Group();
    scene.add(this.static);

    const snowTex = map.snowTexture();
    snowTex.repeat.set(30, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 480),
      new THREE.MeshStandardMaterial({ map: snowTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    this.static.add(ground);

    const trackTex = map.trackTexture();
    trackTex.repeat.set(1, 240);
    const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.95 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.8, roughness: 0.3 });
    C.LANES.forEach((x) => {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 480), trackMat);
      t.rotation.x = -Math.PI / 2; t.position.set(x, 0.0, 0); t.receiveShadow = true;
      this.static.add(t);
      [-0.72, 0.72].forEach((rx) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 480), railMat);
        r.position.set(x + rx, 0.07, 0); r.receiveShadow = true;
        this.static.add(r);
      });
    });
    // snow banks along the track
    const bankMat = new THREE.MeshStandardMaterial({ color: map.bankColor, roughness: 1 });
    [-1, 1].forEach((s) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 480), bankMat);
      b.position.set(s * 4.5, 0.25, 0); b.receiveShadow = true; b.castShadow = true;
      this.static.add(b);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 480, 8), bankMat);
      b2.rotation.x = Math.PI / 2; b2.position.set(s * 4.5, 0.55, 0); b2.receiveShadow = true;
      this.static.add(b2);
    });
    this.backdrop = map.backdrop();
    scene.add(this.backdrop);
  }

  reset(seed) {
    this.clearAll();
    this.seed = seed;
    this.rng = LS.makeRng(seed);
    this.decoRng = LS.makeRng(seed ^ 0x9e3779b9);
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.decor = [];
    this.genD = 70;        // first obstacles after a calm run-up
    this.decoD = -30;
    this.prevFree = 1;
    this.safe = [];        // [{from,to}] distances with no obstacles (boost / jetpack landing)
  }

  clearAll() {
    const rm = (o) => this.scene.remove(o.mesh || o);
    (this.obstacles || []).forEach(rm);
    (this.coins || []).forEach(rm);
    (this.powerups || []).forEach(rm);
    (this.decor || []).forEach((chunk) => chunk.objs.forEach((o) => this.scene.remove(o)));
  }

  speedAt(d) { const C = LS.CFG; return Math.min(C.SPEED_MAX, C.SPEED_START + d / C.SPEED_RAMP); }

  isSafe(a, b) { return this.safe.some((s) => a < s.to && b > s.from); }

  // remove obstacles in [from, to] and keep future generation clear there
  clearRange(from, to) {
    this.safe.push({ from, to });
    this.obstacles = this.obstacles.filter((o) => {
      const d0 = -o.zNear, d1 = -o.zFar;
      if (d1 > from && d0 < to) { this.scene.remove(o.mesh); return false; }
      return true;
    });
  }

  // ---------------- generation ----------------
  update(dt, player, game) {
    const d = -player.z;
    while (this.genD < d + 230) this.genBlock(this.genD);
    while (this.decoD < d + 200) {
      const objs = this.map.decorate(this.scene, this.decoD, this.decoD + 40, this.decoRng);
      this.decor.push({ d1: this.decoD + 40, objs });
      this.decoD += 40;
    }
    // keep static track under the player (snap to texture tile so sleepers don't swim)
    this.static.position.z = Math.round(player.z / 8) * 8;
    this.backdrop.position.z = player.z;

    // moving trains
    for (const o of this.obstacles) {
      o.prevNear = o.zNear; o.prevFar = o.zFar;
      if (o.moving) {
        if (!o.active && o.zNear > player.z - 75) o.active = true;
        if (o.active) {
          const dz = o.speed * dt;
          o.zNear += dz; o.zFar += dz; o.mesh.position.z = o.zNear;
        }
      }
    }

    // cleanup behind the camera
    const behind = player.z + 18;
    this.obstacles = this.obstacles.filter((o) => (o.zFar > behind ? (this.scene.remove(o.mesh), false) : true));
    this.coins = this.coins.filter((c) => (c.mesh.position.z > behind || c.taken ? (this.scene.remove(c.mesh), false) : true));
    this.powerups = this.powerups.filter((p) => (p.mesh.position.z > behind || p.taken ? (this.scene.remove(p.mesh), false) : true));
    this.decor = this.decor.filter((ch) => {
      if (-ch.d1 > behind + 10) { ch.objs.forEach((o) => this.scene.remove(o)); return false; }
      return true;
    });
    this.safe = this.safe.filter((s) => s.to > d - 50);

    // spin coins / power-ups
    const t = performance.now() / 1000;
    for (const c of this.coins) c.mesh.rotation.y += dt * 4;
    for (const p of this.powerups) {
      p.mesh.position.y = p.y + Math.sin(t * 3 + p.phase) * 0.15;
      p.mesh.userData.ring.rotation.y += dt * 2;
    }
  }

  genBlock(d0) {
    const C = LS.CFG, rng = this.rng;
    const k = LS.clamp(d0 / 3000, 0, 1); // difficulty 0..1
    const speed = this.speedAt(d0);
    const gap = 9 + speed * 0.55;
    const at = d0 + 10; // obstacle line of this block

    if (this.isSafe(d0, d0 + 60)) {
      this.genD = d0 + 30;
      return;
    }

    // a lane that is always passable without coins (keeps no-coin runs possible)
    let free = this.prevFree + rng.int(-1, 1);
    free = LS.clamp(free, 0, 2);
    this.prevFree = free;

    const types = [null, null, null];
    const lens = [0, 0, 0];
    let maxLen = 1;
    const pattern = d0 > 400 && rng.chance(0.12 + 0.1 * k) ? 'row' : 'lanes';

    if (pattern === 'row') {
      for (let l = 0; l < 3; l++) types[l] = rng.chance(0.5) ? 'hurdle' : 'overhead';
    } else {
      for (let l = 0; l < 3; l++) {
        if (l === free) continue;
        const w = [
          ['none', 0.28 - 0.15 * k], ['hurdle', 0.2], ['overhead', 0.17],
          ['train', 0.14 + 0.1 * k], ['ramp', 0.14], ['moving', d0 > 350 ? 0.05 + 0.12 * k : 0],
        ];
        types[l] = this.weighted(w);
      }
      // never block both non-free lanes with moving trains
      if (types.filter((t) => t === 'moving').length > 1) types[types.indexOf('moving')] = 'train';
    }

    for (let l = 0; l < 3; l++) {
      const t = types[l];
      if (!t || t === 'none') continue;
      const x = C.LANES[l];
      if (t === 'hurdle') this.addObstacle({ type: t, lane: l, x, w: 2.2, y0: 0, y1: 1.05, dNear: at, len: 0.3, mesh: LS.Models.hurdle() });
      else if (t === 'overhead') this.addObstacle({ type: t, lane: l, x, w: 2.2, y0: 1.35, y1: 2.25, dNear: at, len: 0.3, mesh: LS.Models.overhead() });
      else if (t === 'train' || t === 'ramp') {
        const len = rng.pick([10.5, 21.5, 21.5, 32.5]);
        const off = t === 'ramp' ? 7 : 0;
        this.addObstacle({ type: 'train', lane: l, x, w: C.TRAIN_W, y0: 0, y1: C.TRAIN_H, dNear: at + off, len, mesh: LS.Models.train(len, rng, false) });
        if (t === 'ramp') this.addObstacle({ type: 'ramp', lane: l, x, w: C.TRAIN_W, y0: 0, y1: C.TRAIN_H, dNear: at, len: 7, mesh: LS.Models.ramp(7) });
        lens[l] = len;
        maxLen = Math.max(maxLen, len + off);
      } else if (t === 'moving') {
        const len = rng.pick([10.5, 21.5]);
        this.addObstacle({ type: 'train', lane: l, x, w: C.TRAIN_W, y0: 0, y1: C.TRAIN_H, dNear: at + 30, len, mesh: LS.Models.train(len, rng, true), moving: true, speed: 9 });
        maxLen = Math.max(maxLen, len + 30);
      }
    }

    // ----- coins: one lane, never the free lane (unless it's a row) -----
    let coinLanes = [0, 1, 2].filter((l) => l !== free && types[l] !== 'train' && types[l] !== 'moving');
    if (pattern === 'row') coinLanes = [0, 1, 2];
    if (coinLanes.length && rng.chance(0.85)) {
      const cl = rng.pick(coinLanes);
      const t = types[cl];
      const x = C.LANES[cl];
      const slots = [];
      if (t === 'hurdle') {
        for (let i = 0; i < 9; i++) {
          const dd = at - 8 + i * 2;
          const u = (dd - (at - 5)) / 10;
          slots.push([dd, 0.9 + (u > 0 && u < 1 ? Math.sin(u * Math.PI) * 1.6 : 0)]);
        }
      } else if (t === 'overhead') {
        for (let i = 0; i < 7; i++) slots.push([at - 5 + i * 2, 0.5]);
      } else if (t === 'ramp') {
        const trainLen = lens[cl];
        for (let dd = at + 1; dd < at + 7 + trainLen - 1; dd += 2) {
          const y = dd < at + 7 ? (dd - at) / 7 * C.TRAIN_H : C.TRAIN_H;
          slots.push([dd, y + 0.9]);
        }
      } else {
        const n = rng.int(6, 10);
        for (let i = 0; i < n; i++) slots.push([at - 6 + i * 2, 0.9]);
      }
      // power-up replaces one coin now and then
      let puSlot = -1;
      if (d0 > 150 && rng.chance(0.11)) puSlot = Math.floor(slots.length / 2);
      slots.forEach(([dd, y], i) => {
        if (i === puSlot) this.addPowerup(this.weighted([['magnet', 0.3], ['sneakers', 0.25], ['double', 0.3], ['jetpack', 0.15]]), x, dd, y + 0.2);
        else this.addCoin(x, dd, y);
      });
    }

    this.genD = at + maxLen + gap;
  }

  weighted(list) {
    const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let r = this.rng() * total;
    for (const [v, w] of list) { r -= Math.max(0, w); if (r <= 0) return v; }
    return list[0][0];
  }

  addObstacle(o) {
    o.zNear = -o.dNear; o.zFar = -(o.dNear + o.len);
    o.prevNear = o.zNear; o.prevFar = o.zFar;
    o.mesh.position.set(o.x, 0, o.zNear);
    if (o.type === 'hurdle' || o.type === 'overhead') o.mesh.position.z = o.zNear - o.len / 2;
    this.scene.add(o.mesh);
    this.obstacles.push(o);
  }

  addCoin(x, d, y) {
    const mesh = LS.Models.coin();
    mesh.position.set(x, y, -d);
    this.scene.add(mesh);
    this.coins.push({ mesh, taken: false, magnet: false });
  }

  addPowerup(type, x, d, y) {
    const mesh = LS.Models.powerup(type);
    mesh.position.set(x, y, -d);
    this.scene.add(mesh);
    this.powerups.push({ type, mesh, y, taken: false, phase: Math.random() * 6 });
  }

  // coin trail in the sky for the jetpack
  skyCoins(fromD, toD, y) {
    let lane = 1;
    for (let d = fromD; d < toD; d += 2.5) {
      if (this.rng.chance(0.06)) lane = LS.clamp(lane + (this.rng.chance(0.5) ? 1 : -1), 0, 2);
      this.addCoin(LS.CFG.LANES[lane], d, y);
    }
  }

  // ---------------- queries ----------------
  // Highest walkable surface under (x, z) that the player can step onto from height y.
  surfaceAt(x, z, y) {
    let h = 0;
    for (const o of this.obstacles) {
      if (o.type !== 'train' && o.type !== 'ramp') continue;
      if (Math.abs(x - o.x) > 0.95) continue;
      if (z > o.zNear || z < o.zFar) continue;
      let s;
      if (o.type === 'train') s = o.y1;
      else s = ((o.zNear - z) / (o.zNear - o.zFar)) * o.y1;
      if (y >= s - 0.6 && s > h) h = s;
    }
    return h;
  }
};
