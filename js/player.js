// Player state, physics and animation.
LS.Player = class {
  constructor(scene) {
    this.scene = scene;
    this.rig = new LS.KidRig();
    this.mesh = this.rig.root;
    scene.add(this.mesh);
    // fake blob shadow so the player stays readable on train roofs
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x1b2238, transparent: true, opacity: 0.28, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);
    this.reset();
  }

  // swap the character model (e.g. once the animated robot has loaded)
  setRig(rig) {
    this.scene.remove(this.mesh);
    this.rig = rig; this.mesh = rig.root;
    this.scene.add(this.mesh);
    this.mesh.position.set(this.x, this.y, this.z);
    rig.reset();
  }

  reset() {
    this.lane = 1; this.lastLane = 1;
    this.x = 0; this.y = 0; this.z = 0; this.prevZ = 0;
    this.vy = 0;
    this.grounded = true; this.airTime = 0;
    this.rollT = 0; this.rollQueued = false;
    this.jumpBuf = 0; this.jumpBufSneak = false;
    this.flyY = null;          // target height while boosting / jetpacking
    this.dead = false; this.deadT = 0;
    this.phase = 0;
    this.groundH = 0;
    this.fromX = 0; this.laneT = 1; this.dir = 0; this.prevX = 0; this.vx = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.rig.reset();
  }

  get height() { return this.rollT > 0 ? LS.CFG.PLAYER_H_ROLL : LS.CFG.PLAYER_H; }
  get flying() { return this.flyY !== null; }

  // Lane change is a short animated dash, not an instant snap.
  moveTo(l) {
    this.lastLane = this.lane; this.lane = l;
    this.fromX = this.x; this.laneT = 0;
    this.dir = Math.sign(LS.CFG.LANES[l] - this.x) || this.dir;
  }
  left() { if (this.dead || this.lane <= 0) return false; this.moveTo(this.lane - 1); return true; }
  right() { if (this.dead || this.lane >= 2) return false; this.moveTo(this.lane + 1); return true; }
  bounceBack() { this.moveTo(this.lastLane); }
  get switching() { return this.laneT < 1; }

  jump(sneakers) {
    if (this.flying || this.dead) return false;
    if (!this.grounded && this.airTime > 0.12) { // small coyote time; otherwise buffer the press
      this.jumpBuf = 0.18; this.jumpBufSneak = sneakers;
      return false;
    }
    const C = LS.CFG;
    const h = sneakers ? C.JUMP_H_SNEAKER : C.JUMP_H;
    this.vy = Math.sqrt(2 * C.GRAVITY * h);
    this.grounded = false; this.airTime = 1;
    this.rollT = 0;
    return true;
  }

  roll() {
    if (this.flying || this.dead) return false;
    if (!this.grounded) { this.vy = Math.min(this.vy, -32); this.rollQueued = true; return true; }
    this.rollT = LS.CFG.ROLL_TIME;
    return true;
  }

  update(dt, world, speed) {
    const C = LS.CFG;
    this.prevZ = this.z;
    if (this.dead) { this.animateDeath(dt); return null; }
    this.z -= speed * dt;

    // lateral dash with ease-out
    this.prevX = this.x;
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / C.LANE_TIME);
      const e = 1 - Math.pow(1 - this.laneT, 2.2);
      this.x = LS.lerp(this.fromX, C.LANES[this.lane], e);
    } else this.x = C.LANES[this.lane];
    this.vx = (this.x - this.prevX) / Math.max(dt, 1e-4);

    let event = null;
    if (this.flying) {
      this.y = LS.damp(this.y, this.flyY, 4, dt);
      this.vy = 0; this.grounded = false; this.rollT = 0;
      this.groundH = world.surfaceAt(this.x, this.z, 99);
    } else {
      this.vy -= C.GRAVITY * dt;
      this.y += this.vy * dt;
      const g = world.surfaceAt(this.x, this.z, this.y);
      this.groundH = g;
      if (this.y <= g) {
        if (!this.grounded && this.vy < -8) event = 'land';
        this.y = g; this.vy = 0;
        this.grounded = true; this.airTime = 0;
        if (this.rollQueued) { this.rollQueued = false; this.rollT = C.ROLL_TIME; event = 'roll'; }
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.jump(this.jumpBufSneak); event = this.jumpBufSneak ? 'superjump' : 'jump'; }
      } else {
        this.grounded = false; this.airTime += dt;
      }
    }
    if (this.rollT > 0) this.rollT -= dt;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;

    this.animate(dt, speed);
    return event;
  }

  animate(dt, speed) {
    const p = this.parts;
    this.mesh.position.set(this.x, this.y, this.z);
    this.blob.position.set(this.x, this.groundH + 0.03, this.z);
    this.blob.scale.setScalar(LS.clamp(1 - (this.y - this.groundH) * 0.12, 0.3, 1));

    // turn into the dash direction and lean into it
    const side = this.laneT < 1 ? Math.sin(Math.PI * this.laneT) : 0;
    this.mesh.rotation.y = -this.dir * 0.55 * side;
    this.mesh.rotation.z = -this.dir * 0.22 * side;
    this.rig.animate(dt, this, speed, side);
  }

  die() {
    this.dead = true; this.deadT = 0; this.flyY = null; this.rollT = 0;
    this.rig.pack.visible = false;
  }

  animateDeath(dt) {
    this.deadT += dt;
    this.z += Math.max(0, 1.5 - this.deadT * 6) * dt * 3; // knocked back a bit
    if (this.y > this.groundH) this.y = Math.max(this.groundH, this.y - dt * 8);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(0, 0, 0);
    this.rig.death(dt, this);
  }
};

// ---------------------------------------------------------------------------
// Rigs: how a character model is posed. All rigs expose root, pack, flames,
// reset(), animate(dt, player, speed, side) and death(dt, player).
// ---------------------------------------------------------------------------

// Blocky kid animated by rotating its parts (fallback, works without model files).
LS.KidRig = class {
  constructor() { Object.assign(this, LS.Models.kid()); this.phase = 0; }
  reset() {
    this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); this.body.scale.set(1, 1, 1);
    this.pack.visible = false;
  }
  animate(dt, pl, speed, side) {
    const p = this;
    this.phase += dt * (6 + speed * 0.32);
    const s = Math.sin(this.phase);
    p.pack.visible = pl.flying;
    if (pl.flying) {
      p.body.rotation.x = -0.35;
      p.legL.rotation.x = 0.4 + s * 0.1; p.legR.rotation.x = 0.3 - s * 0.1;
      p.armL.rotation.x = 0.6; p.armR.rotation.x = 0.6;
      p.armL.rotation.z = -0.3; p.armR.rotation.z = 0.3;
      const f = 0.8 + Math.random() * 0.5;
      p.flames.forEach((fl) => { fl.scale.set(1, f, 1); });
      p.body.scale.set(1, 1, 1); p.body.position.y = 0;
      return;
    }
    p.armL.rotation.z = 0; p.armR.rotation.z = 0;
    if (pl.rollT > 0) {
      const t = 1 - pl.rollT / LS.CFG.ROLL_TIME;
      p.body.rotation.x = -t * Math.PI * 2;
      p.body.position.y = 0.45; p.body.scale.set(1, 0.5, 1);
      p.legL.rotation.x = p.legR.rotation.x = -1.2;
      p.armL.rotation.x = p.armR.rotation.x = -1.4;
      return;
    }
    p.body.position.y = 0; p.body.scale.set(1, 1, 1);
    if (!pl.grounded) {
      const up = LS.clamp(pl.vy / 10, -1, 1);
      p.body.rotation.x = -0.2 * up;
      p.legL.rotation.x = -1.3 * Math.max(0, up) - 0.2; p.legR.rotation.x = -0.6 * Math.max(0, up) + 0.3;
      p.armL.rotation.x = -2.2 + up * 0.4; p.armR.rotation.x = -1.6 - up * 0.3;
      p.armL.rotation.z = -0.6; p.armR.rotation.z = 0.6;
      return;
    }
    p.body.rotation.x = -0.12;
    p.legL.rotation.x = s * 0.9; p.legR.rotation.x = -s * 0.9;
    p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
    p.body.position.y = Math.abs(Math.cos(this.phase)) * 0.08 + side * 0.18;
    if (side > 0) { p.legL.rotation.x *= 0.4; p.legR.rotation.x *= 0.4; p.armL.rotation.z = -0.4 * side; p.armR.rotation.z = 0.4 * side; }
    p.scarfTail.rotation.x = 0.4 + Math.sin(this.phase * 2) * 0.2;
  }
  death(dt, pl) {
    const p = this, t = Math.min(1, pl.deadT * 3);
    p.body.scale.set(1, 1, 1); p.body.position.y = 0;
    p.body.rotation.x = LS.lerp(0, 1.4, t);
    p.armL.rotation.x = p.armR.rotation.x = -2.5 * t;
    p.armL.rotation.z = -0.8 * t; p.armR.rotation.z = 0.8 * t;
  }
};

// Skinned robot with real animation clips (Running, Jump, Idle, Death).
LS.RobotRig = class {
  constructor(parts) {
    Object.assign(this, parts);
    this.cur = null; this.curAction = null;
    this.reset();
  }
  play(name, fade = 0.12) {
    if (this.cur === name) return this.curAction;
    const a = this.actions[name];
    if (!a) return this.curAction;
    a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (this.curAction) this.curAction.fadeOut(fade);
    this.cur = name; this.curAction = a;
    return a;
  }
  pose(roll) {
    const b = this.body;
    if (roll == null) { b.rotation.set(0, 0, 0); b.position.set(0, 0, 0); b.scale.set(1, 1, 1); this.model.position.y = 0; return; }
    // curl into a ball that spins around its centre
    this.model.position.y = -0.95;
    b.position.y = 0.52; b.scale.setScalar(0.56);
    b.rotation.set(-roll * Math.PI * 2, 0, 0);
  }
  reset() {
    this.mixer.stopAllAction(); this.cur = null; this.curAction = null;
    this.pose(null); this.pack.visible = false;
    this.play('Idle', 0); this.mixer.update(0);
  }
  animate(dt, pl, speed, side) {
    this.pack.visible = pl.flying;
    if (pl.flying) {
      this.pose(null);
      this.body.rotation.x = -0.55; this.body.position.y = 0.15;
      const a = this.play('Running'); if (a) a.timeScale = 0.35;
      const f = 0.8 + Math.random() * 0.5;
      this.flames.forEach((fl) => { fl.scale.set(1, f, 1); });
    } else if (pl.rollT > 0) {
      this.pose(1 - pl.rollT / LS.CFG.ROLL_TIME);
      const a = this.play('Running'); if (a) a.timeScale = 2;
    } else if (!pl.grounded) {
      this.pose(null);
      const a = this.play('Jump', 0.06);
      if (a) a.timeScale = a.getClip().duration / 0.75;
      this.body.rotation.x = -0.12 * LS.clamp(pl.vy / 10, -1, 1);
    } else if (speed < 1) {
      this.pose(null); this.play('Idle', 0.2);
    } else {
      this.pose(null);
      const a = this.play('Running', 0.1);
      if (a) a.timeScale = LS.clamp(speed / 15, 1.0, 2.0);
      this.body.rotation.x = -0.1;
      this.body.position.y = side * 0.16;
    }
    this.mixer.update(dt);
  }
  death(dt, pl) {
    this.pose(null); this.pack.visible = false;
    const a = this.play('Death', 0.06);
    if (a) a.timeScale = 1.6;
    this.mixer.update(dt);
  }
};
