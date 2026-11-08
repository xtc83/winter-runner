// Small visual effects: snow puffs, coin sparkles, speed lines.
LS.Effects = class {
  constructor(scene) {
    this.scene = scene;
    // particle pool (sprites with own material for per-particle fade)
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    this.parts = [];
    for (let i = 0; i < 120; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false; scene.add(s);
      this.parts.push({ s, v: new THREE.Vector3(), life: 0, max: 1, size: 1, grav: 0 });
    }
    this.next = 0;

    // speed lines: thin streaks around the camera
    const N = 70;
    this.lineData = [];
    const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.lineData.push(this.newLine());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  newLine(z) {
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 6;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6 + 1.5, z: z != null ? z : -Math.random() * 60 };
  }

  emit(pos, opt) {
    const n = opt.n || 6;
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.next]; this.next = (this.next + 1) % this.parts.length;
      p.s.position.copy(pos);
      p.s.position.x += (Math.random() - 0.5) * (opt.spread || 0.6);
      p.v.set((Math.random() - 0.5) * (opt.vx || 3), Math.random() * (opt.vy || 2.5), (Math.random() - 0.2) * (opt.vz || 3));
      p.life = p.max = (opt.life || 0.5) * (0.7 + Math.random() * 0.6);
      p.size = (opt.size || 0.5) * (0.6 + Math.random() * 0.8);
      p.grav = opt.grav == null ? 6 : opt.grav;
      p.s.material.color.set(opt.color || 0xffffff);
      p.s.visible = true;
    }
  }
  snowPuff(x, y, z, n = 8) { this.emit(new THREE.Vector3(x, y + 0.1, z), { n, color: 0xf4f9ff, size: 0.55, life: 0.45, vy: 2.2, vx: 4, grav: 5 }); }
  sparkle(pos) { this.emit(pos, { n: 4, color: 0xffe066, size: 0.35, life: 0.3, vy: 3, vx: 3, vz: 2, grav: 0, spread: 0.2 }); }
  burst(pos, color) { this.emit(pos, { n: 18, color, size: 0.6, life: 0.6, vy: 5, vx: 7, vz: 5, grav: 4, spread: 0.4 }); }

  update(dt, camera, speed, boosting) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.v.y -= p.grav * dt;
      p.s.position.addScaledVector(p.v, dt);
      const t = p.life / p.max;
      p.s.material.opacity = t;
      p.s.scale.setScalar(p.size * (1.4 - t * 0.4));
    }
    // speed lines relative to the camera
    const strength = boosting ? 0.75 : LS.clamp((speed - 22) / 12, 0, 0.4);
    this.lines.material.opacity = LS.damp(this.lines.material.opacity, strength, 4, dt);
    if (this.lines.material.opacity < 0.01) return;
    const arr = this.lines.geometry.attributes.position.array;
    const len = 0.6 + speed * 0.09;
    const cx = camera.position.x, cy = camera.position.y - 1.5, cz = camera.position.z;
    this.lineData.forEach((l, i) => {
      l.z += speed * 1.4 * dt;
      if (l.z > 2) Object.assign(l, this.newLine(-60));
      const o = i * 6;
      arr[o] = cx + l.x; arr[o + 1] = cy + l.y; arr[o + 2] = cz + l.z - 6;
      arr[o + 3] = cx + l.x; arr[o + 4] = cy + l.y; arr[o + 5] = cz + l.z - 6 - len;
    });
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
};
