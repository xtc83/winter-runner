// Player state, physics and animation.
LS.Player = class {
  constructor(scene) {
    this.mesh = LS.Models.player();
    scene.add(this.mesh);
    this.parts = this.mesh.userData;
    // fake blob shadow so the player stays readable on train roofs
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);
    this.reset();
  }

  reset() {
    this.lane = 1; this.lastLane = 1;
    this.x = 0; this.y = 0; this.z = 0; this.prevZ = 0;
    this.vy = 0;
    this.grounded = true; this.airTime = 0;
    this.rollT = 0; this.rollQueued = false;
    this.flyY = null;          // target height while boosting / jetpacking
    this.dead = false; this.deadT = 0;
    this.phase = 0;
    this.groundH = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.parts.body.rotation.set(0, 0, 0);
    this.parts.body.position.set(0, 0, 0);
    this.parts.body.scale.set(1, 1, 1);
    this.parts.pack.visible = false;
  }

  get height() { return this.rollT > 0 ? LS.CFG.PLAYER_H_ROLL : LS.CFG.PLAYER_H; }
  get flying() { return this.flyY !== null; }

  left() { if (this.lane > 0) { this.lastLane = this.lane; this.lane--; return true; } return false; }
  right() { if (this.lane < 2) { this.lastLane = this.lane; this.lane++; return true; } return false; }
  bounceBack() { const l = this.lane; this.lane = this.lastLane; this.lastLane = l; }

  jump(sneakers) {
    if (this.flying || this.dead) return false;
    if (!this.grounded && this.airTime > 0.12) return false; // small coyote time
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

    // lateral
    this.x = LS.damp(this.x, C.LANES[this.lane], 18, dt);

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
      } else {
        this.grounded = false; this.airTime += dt;
      }
    }
    if (this.rollT > 0) this.rollT -= dt;

    this.animate(dt, speed);
    return event;
  }

  animate(dt, speed) {
    const p = this.parts;
    this.mesh.position.set(this.x, this.y, this.z);
    this.blob.position.set(this.x, this.groundH + 0.03, this.z);
    this.blob.scale.setScalar(LS.clamp(1 - (this.y - this.groundH) * 0.12, 0.3, 1));

    const lean = (this.x - LS.CFG.LANES[this.lane]) * 0.25;
    this.mesh.rotation.z = lean;
    this.phase += dt * (6 + speed * 0.32);
    const s = Math.sin(this.phase);

    p.pack.visible = this.flying;
    if (this.flying) {
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

    if (this.rollT > 0) {
      // tuck and spin
      const t = 1 - this.rollT / LS.CFG.ROLL_TIME;
      p.body.rotation.x = -t * Math.PI * 2;
      p.body.position.y = 0.45; p.body.scale.set(1, 0.5, 1);
      p.legL.rotation.x = p.legR.rotation.x = -1.2;
      p.armL.rotation.x = p.armR.rotation.x = -1.4;
      return;
    }
    p.body.position.y = 0; p.body.scale.set(1, 1, 1);

    if (!this.grounded) {
      p.body.rotation.x = -0.15;
      p.legL.rotation.x = -0.9; p.legR.rotation.x = 0.5;
      p.armL.rotation.x = 1.0; p.armR.rotation.x = -0.6;
      p.armL.rotation.z = -0.5; p.armR.rotation.z = 0.5;
      return;
    }
    p.body.rotation.x = -0.12;
    p.legL.rotation.x = s * 0.9; p.legR.rotation.x = -s * 0.9;
    p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
    p.body.position.y = Math.abs(Math.cos(this.phase)) * 0.08;
    p.scarfTail.rotation.x = 0.4 + Math.sin(this.phase * 2) * 0.2;
  }

  die() {
    this.dead = true; this.deadT = 0; this.flyY = null; this.rollT = 0;
    this.parts.pack.visible = false;
  }

  animateDeath(dt) {
    this.deadT += dt;
    const p = this.parts;
    const t = Math.min(1, this.deadT * 3);
    p.body.scale.set(1, 1, 1); p.body.position.y = 0;
    p.body.rotation.x = LS.lerp(0, 1.4, t);
    p.armL.rotation.x = p.armR.rotation.x = -2.5 * t;
    p.armL.rotation.z = -0.8 * t; p.armR.rotation.z = 0.8 * t;
    this.z += Math.max(0, 1.5 - this.deadT * 6) * dt * 3; // knocked back a bit
    if (this.y > this.groundH) this.y = Math.max(this.groundH, this.y - dt * 8);
    this.mesh.position.set(this.x, this.y, this.z);
  }
};

