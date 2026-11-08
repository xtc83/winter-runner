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
    this.lastPattern = null;
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

  // ---------------- pattern-based generation ----------------
  // Each block is a hand-designed section (mirrored at random). Every section keeps at
  // least one route that is passable without collecting coins.
  genBlock(d0) {
    const C = LS.CFG, rng = this.rng;
    const speed = this.speedAt(d0);
    const gap = 8 + speed * 0.5;

    if (this.isSafe(d0, d0 + 60)) { this.genD = d0 + 30; return; }

    const flip = rng.chance(0.5);
    const L = (l) => (flip ? 2 - l : l);
    const blk = { obs: [], end: d0 };
    const self = this;
    const X = (l) => C.LANES[L(l)];
    const B = {
      train(l, d, len, opt = {}) {
        if (opt.ramp) {
          self.addObstacle({ type: 'ramp', lane: L(l), x: X(l), w: C.TRAIN_W, y0: 0, y1: C.TRAIN_H, dNear: d - 7, len: 7, mesh: LS.Models.ramp(7) });
        }
        const o = { type: 'train', lane: L(l), x: X(l), w: C.TRAIN_W, y0: 0, y1: C.TRAIN_H, dNear: d, len,
          mesh: LS.Models.train(len, rng, !!opt.moving), moving: !!opt.moving, speed: 9 };
        self.addObstacle(o); blk.obs.push({ l: L(l), d, len, kind: opt.ramp ? 'rampTrain' : 'train' });
        blk.end = Math.max(blk.end, d + len);
      },
      hurdle(l, d) {
        self.addObstacle({ type: 'hurdle', lane: L(l), x: X(l), w: 2.2, y0: 0, y1: 1.05, dNear: d, len: 0.3, mesh: LS.Models.hurdle() });
        blk.obs.push({ l: L(l), d, kind: 'hurdle' }); blk.end = Math.max(blk.end, d + 1);
      },
      overhead(l, d) {
        self.addObstacle({ type: 'overhead', lane: L(l), x: X(l), w: 2.2, y0: 1.38, y1: 2.26, dNear: d, len: 1.0, mesh: LS.Models.overhead() });
        blk.obs.push({ l: L(l), d, kind: 'overhead' }); blk.end = Math.max(blk.end, d + 1);
      },
      // coin line that follows ramps, roofs, hurdles (arc) and overheads (low)
      coins(l, from, to, step = 2.2, over = false) {
        const lane = L(l);
        const slots = [];
        for (let d = from; d <= to; d += step) slots.push([d, self.coinY(blk, lane, d, over)]);
        let pu = -1;
        if (d0 > 150 && rng.chance(0.1)) pu = Math.floor(slots.length / 2);
        slots.forEach(([d, y], i) => {
          if (i === pu) self.addPowerup(self.weighted([['magnet', 0.3], ['sneakers', 0.25], ['double', 0.3], ['jetpack', 0.15]]), C.LANES[lane], d, y + 0.2);
          else self.addCoin(C.LANES[lane], d, y);
        });
      },
    };

    const s = d0 + 4;
    const k = LS.clamp(d0 / 2500, 0, 1);
    const pats = [
      ['wall', 1.0], ['corridor', 0.9], ['rooftop', 1.0], ['slalom', 0.9],
      ['stairs', d0 > 250 ? 0.8 : 0], ['oncoming', d0 > 300 ? 0.5 + 0.6 * k : 0],
      ['barriers', d0 > 200 ? 0.5 + 0.4 * k : 0], ['jumpRoll', d0 > 400 ? 0.6 : 0], ['stepUp', d0 > 120 ? 0.8 : 0],
    ].filter(([p]) => p !== this.lastPattern);
    const pat = this.weighted(pats);
    this.lastPattern = pat;
    const long = () => rng.pick([21.5, 32.5]);

    switch (pat) {
      case 'wall': { // two lanes blocked by trains, third lane open with a barrier
        const open = rng.int(0, 2);
        const len = long();
        [0, 1, 2].filter((l) => l !== open).forEach((l, i) => B.train(l, s + i * rng.int(0, 6), len));
        const ob = rng.chance(0.5) ? 'hurdle' : 'overhead';
        B[ob](open, s + len * 0.5);
        if (rng.chance(0.5)) B.train([0, 1, 2].find((l) => l !== open), s + len + 2, 10.5); // keeps you guessing
        // coins on top of one wall train (bonus, needs super jump / jetpack) – open lane stays coin-free
        break;
      }
      case 'corridor': { // trains left and right, barriers in the middle lane
        const len = 32.5;
        B.train(0, s, len); B.train(2, s + rng.int(0, 4), len);
        B.hurdle(1, s + 8);
        B[rng.chance(0.5) ? 'overhead' : 'hurdle'](1, s + 22);
        if (rng.chance(0.4)) B.coins(0, s + 2, s + len - 2); // roof coins: optional
        break;
      }
      case 'rooftop': { // ramp onto a long train row, neighbour trains to hop across
        const len = 32.5;
        B.train(0, s + 7, len, { ramp: true });
        B.train(1, s + 14, 21.5);
        B.hurdle(2, s + 12);
        B.overhead(2, s + 30);
        B.coins(0, s + 1, s + 7 + len - 2);
        break;
      }
      case 'stairs': { // climb up, then hop from roof to roof across all lanes
        B.train(0, s + 7, 21.5, { ramp: true });
        B.train(1, s + 20, 32.5);
        B.train(2, s + 57, 10.5); // after the middle train ends, so the ground route stays open
        B.coins(0, s + 1, s + 26);
        B.coins(1, s + 30, s + 50);
        break;
      }
      case 'slalom': { // alternating blocks force lane changes
        B.train(0, s, 10.5); B.hurdle(1, s + 4);
        B.train(2, s + 20, 10.5); B.overhead(1, s + 24);
        B.train(0, s + 40, 10.5); B.hurdle(1, s + 44);
        B.coins(1, s, s + 48);
        break;
      }
      case 'oncoming': { // a train coming at you, a ramp train next to it
        B.train(1, s + 45, 21.5, { moving: true });
        B.train(0, s + 10, 32.5, { ramp: true });
        B.hurdle(2, s + 18);
        B.coins(0, s + 4, s + 40);
        break;
      }
      case 'barriers': { // all three lanes blocked: jump or roll
        const t1 = rng.chance(0.5) ? 'hurdle' : 'overhead';
        [0, 1, 2].forEach((l) => B[t1](l, s + 6));
        if (rng.chance(0.6)) {
          const t2 = t1 === 'hurdle' ? 'overhead' : 'hurdle';
          [0, 1, 2].forEach((l) => B[t2](l, s + 22));
        }
        B.coins(rng.int(0, 2), s, s + 26);
        break;
      }
      case 'stepUp': { // jump onto the beam, then from the beam onto the train roof
        const lane = rng.int(0, 2);
        B.overhead(lane, s + 8);
        B.train(lane, s + 12.5, 32.5);
        const other = [0, 1, 2].filter((l) => l !== lane);
        B.hurdle(other[0], s + 16);
        if (rng.chance(0.5)) B.train(other[1], s + 20, 21.5);
        B.coins(lane, s + 2, s + 40, 2.2, true); // coins show the route: up the beam, onto the roof
        break;
      }
      case 'jumpRoll': { // quick jump-roll combo in one lane, trains beside
        const open = rng.int(0, 2);
        [0, 1, 2].filter((l) => l !== open).forEach((l) => B.train(l, s, 21.5));
        B.hurdle(open, s + 5); B.overhead(open, s + 15);
        break;
      }
    }

    this.genD = blk.end + gap;
  }

  // coin height for a lane position, considering the current block's obstacles
  coinY(blk, lane, d, over) {
    const C = LS.CFG;
    let y = 0.9;
    for (const o of this.obstacles) {
      if (o.lane !== lane) continue;
      const od = -o.zNear;
      if (o.type === 'train' && !o.moving && d >= od && d <= od + o.len) y = Math.max(y, C.TRAIN_H + 0.9);
      else if (o.type === 'ramp' && d >= od && d <= od + o.len) y = Math.max(y, (d - od) / o.len * C.TRAIN_H + 0.9);
      else if (o.type === 'hurdle' && Math.abs(d - od) < 5) y = Math.max(y, 0.9 + Math.cos((d - od) / 5 * Math.PI / 2) * 1.6);
      else if (o.type === 'overhead' && over && d > od - 5 && d < od + 5) {
        y = Math.max(y, d < od ? 0.9 + 2.3 * (1 - (od - d) / 5) : C.TRAIN_H + 0.9);
      } else if (o.type === 'overhead' && !over && Math.abs(d - od) < 1.5) y = 0.5;
    }
    return y;
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
      if (Math.abs(x - o.x) > 0.95) continue;
      if (z > o.zNear || z < o.zFar) continue;
      let s;
      if (o.type !== 'ramp') s = o.y1; // trains, hurdles and overhead beams are walkable on top
      else s = ((o.zNear - z) / (o.zNear - o.zFar)) * o.y1;
      if (y >= s - 0.6 && s > h) h = s;
    }
    return h;
  }
};
