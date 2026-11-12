// Winter map: colours, scenery and decoration. New maps = new file with the same shape.
// Scenery is pre-built as a handful of baked 48 m chunks that get cloned along the track,
// so there is no geometry work (and no stutter) while playing.
LS.Maps = LS.Maps || {};

LS.Maps.winter = (function () {
  const { toon, glow, mesh, box, rbox, cyl, ball, bake, canvasTex } = LS.Models;
  const CHUNK = 48;

  function skyTexture() {
    const t = canvasTex(4, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#2f8fe6'); gr.addColorStop(0.35, '#63b8f5'); gr.addColorStop(0.55, '#a9defa');
      gr.addColorStop(0.68, '#ffe9d6'); gr.addColorStop(1, '#fff4ea');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    });
    return t;
  }

  // flat cartoon track: gravel bed + chunky sleeper, one sleeper per 2 m tile
  function trackTexture() {
    const t = canvasTex(128, 128, (g) => {
      g.fillStyle = '#8b93a6'; g.fillRect(0, 0, 128, 128);
      const cols = ['#7a8296', '#9aa2b4', '#6f778b', '#a7aec0'];
      for (let i = 0; i < 70; i++) {
        g.fillStyle = cols[i % 4];
        g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 4, 2 + Math.random() * 3, Math.random() * 3, 0, 7); g.fill();
      }
      g.fillStyle = '#3b2a22'; g.fillRect(4, 40, 120, 48);
      g.fillStyle = '#8a5a3c'; g.fillRect(8, 44, 112, 40);
      g.fillStyle = '#a06c48'; g.fillRect(8, 44, 112, 8);
      g.fillStyle = '#74492f'; g.fillRect(8, 62, 112, 3); g.fillRect(8, 74, 112, 3);
      g.fillStyle = '#ffffff';
      [[10, 40, 34], [70, 40, 26], [100, 41, 18]].forEach(([x, y, w]) => { g.beginPath(); g.ellipse(x + w / 2, y + 4, w / 2, 6, 0, 0, 7); g.fill(); });
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }

  function snowTexture() {
    const t = canvasTex(256, 256, (g) => {
      g.fillStyle = '#f2f7ff'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = i % 2 ? 'rgba(205,224,250,0.55)' : 'rgba(255,255,255,0.9)';
        g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 30, 6 + Math.random() * 12, Math.random() * 3, 0, 7); g.fill();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------- scenery pieces (added into a group that is baked afterwards) ----------
  const snowM = () => toon(0xffffff);
  const greens = [0x1f8a4c, 0x25a25a, 0x17753f];
  const bulbs = [0xff2d55, 0x34e07a, 0xffd60a, 0x3aa0ff, 0xff8a1f];

  function tree(g, x, z, s, rng, festive, far) {
    const green = toon(greens[Math.floor(rng() * greens.length)]);
    g.add(cyl(0.16 * s, 0.22 * s, 1.0 * s, far ? 5 : 7, toon(0x7a4a2b), x, 0.5 * s, z, !far));
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const r = (1.5 - i * 0.38) * s, h = (1.7 - i * 0.2) * s, y = (0.9 + i * 1.0) * s;
      g.add(mesh(new THREE.ConeGeometry(r, h, far ? 6 : 9), green, x, y + h / 2, z, !far));
      const cap = mesh(new THREE.ConeGeometry(r * 0.72, h * 0.5, far ? 6 : 9), snowM(), x, y + h * 0.76, z);
      g.add(cap);
      if (festive) {
        for (let b = 0; b < 5; b++) {
          const a = rng() * Math.PI * 2, rr = r * 0.62;
          g.add(ball(0.11 * s, glow(bulbs[(b + i) % bulbs.length], 1.8), x + Math.cos(a) * rr, y + h * 0.3, z + Math.sin(a) * rr));
        }
      }
    }
    if (festive) {
      const star = mesh(new THREE.OctahedronGeometry(0.22 * s), glow(0xffe14d, 2.4), x, (0.9 + 3 * 1.0) * s + 0.75 * s, z);
      g.add(star);
    }
  }

  function lamp(g, x, z) {
    const iron = toon(0x2a3142);
    g.add(cyl(0.08, 0.11, 4.2, 8, iron, x, 2.1, z, true));
    g.add(cyl(0.2, 0.24, 0.3, 8, iron, x, 0.15, z));
    g.add(rbox(0.5, 0.1, 0.5, 0.04, iron, x, 4.48, z));
    g.add(ball(0.24, glow(0xffe2a0, 2.2), x, 4.22, z));
    g.add(ball(0.3, snowM(), x, 4.56, z, false, 1, 0.45, 1));
  }
  // string lights from zA to zB; t0..t1 is the part of the full lamp-to-lamp span drawn here
  function lights(g, x, zA, zB, t0, t1) {
    const n = Math.round((t1 - t0) * 12);
    for (let i = 0; i <= n; i++) {
      const u = i / n, t = t0 + (t1 - t0) * u;
      if ((t < 0.02) || (t > 0.98)) continue;
      const y = 4.25 - Math.sin(t * Math.PI) * 0.9;
      const idx = Math.round(t * 12);
      g.add(ball(0.1, glow(bulbs[idx % bulbs.length], 2.0), x, y, zA + (zB - zA) * u));
    }
    // wire as short dark segments following the sag
    const wire = toon(0x2a3142);
    for (let i = 0; i < n; i++) {
      const ta = t0 + (t1 - t0) * (i / n), tb = t0 + (t1 - t0) * ((i + 1) / n);
      const ya = 4.33 - Math.sin(ta * Math.PI) * 0.9, yb = 4.33 - Math.sin(tb * Math.PI) * 0.9;
      const za = zA + (zB - zA) * (i / n), zb = zA + (zB - zA) * ((i + 1) / n);
      const seg = box(0.03, 0.03, Math.hypot(zb - za, yb - ya), wire, x, (ya + yb) / 2, (za + zb) / 2);
      seg.rotation.x = -Math.atan((yb - ya) / (zb - za));
      g.add(seg);
    }
  }

  const wallCols = [0xe5534b, 0xf2a03d, 0x4f8fe0, 0x63b36a, 0xf2d06b, 0xb86fd1, 0xef7f9e];
  function house(g, x, z, rng, side) {
    const w = rng.range(5, 7.5), d = rng.range(5, 7), h = rng.range(3.4, 5.2);
    const wall = toon(rng.pick(wallCols)), trim = toon(0xfff6e6);
    g.add(rbox(w, h, d, 0.12, wall, x, h / 2, z, true));
    g.add(box(w + 0.1, 0.25, d + 0.1, trim, x, 0.12, z));
    // gable roof with thick snow
    const rh = 2.3;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.5, 0); shape.lineTo(w / 2 + 0.5, 0); shape.lineTo(0, rh); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false });
    rg.translate(0, 0, -(d + 0.8) / 2);
    g.add(mesh(rg, toon(0x6b4a3a), x, h, z, true));
    const sg = rg.clone(); sg.scale(0.96, 1.0, 1.02);
    g.add(mesh(sg, snowM(), x, h + 0.28, z));
    g.add(rbox(0.7, 1.7, 0.7, 0.08, toon(0x8d5a44), x + w * 0.22, h + 1.5, z + d * 0.15, true));
    g.add(rbox(0.85, 0.2, 0.85, 0.08, snowM(), x + w * 0.22, h + 2.42, z + d * 0.15));
    // glowing windows + door on the side facing the track
    const fx = x - side * (w / 2 + 0.03);
    const win = glow(0xffd76a, 1.9);
    const rows = Math.max(1, Math.floor((h - 1.2) / 1.9));
    for (let j = 0; j < rows; j++) for (let i = 0; i < 2; i++) {
      const wz = z - d / 4 + i * d / 2, wy = 1.8 + j * 1.9;
      if (j === 0 && i === 0) continue;
      g.add(box(0.08, 1.2, 1.2, trim, fx, wy, wz));
      g.add(box(0.1, 0.95, 0.95, win, fx, wy, wz));
      g.add(box(0.12, 0.95, 0.08, trim, fx, wy, wz)); g.add(box(0.12, 0.08, 0.95, trim, fx, wy, wz));
      g.add(rbox(0.3, 0.14, 1.3, 0.06, snowM(), fx - side * 0.1, wy - 0.66, wz));
    }
    g.add(box(0.1, 1.9, 1.05, toon(0x5a3b2a), fx, 0.95, z - d / 4));
    g.add(ball(0.07, glow(0xffd76a, 2), fx - side * 0.06, 0.95, z - d / 4 + 0.3));
    // light strings along the eaves
    for (let i = 0; i <= 8; i++) g.add(ball(0.09, glow(bulbs[i % bulbs.length], 2), fx - side * 0.5, h - 0.05, z - d / 2 + (d * i) / 8));
  }

  function snowman(g, x, z, rot) {
    const s = snowM(), dark = toon(0x232a3d);
    g.add(ball(0.62, s, x, 0.55, z, true)); g.add(ball(0.45, s, x, 1.4, z, true)); g.add(ball(0.32, s, x, 2.02, z, true));
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const nose = mesh(new THREE.ConeGeometry(0.07, 0.34, 8), toon(0xff7a1a), x + fx * 0.4, 2.02, z + fz * 0.4);
    nose.rotation.order = 'YXZ'; nose.rotation.set(Math.PI / 2, rot, 0);
    g.add(nose);
    g.add(cyl(0.36, 0.36, 0.06, 14, dark, x, 2.27, z)); g.add(cyl(0.23, 0.23, 0.36, 14, dark, x, 2.46, z, true));
    g.add(cyl(0.24, 0.24, 0.08, 14, toon(0xe53935), x, 2.33, z));
    g.add(cyl(0.34, 0.36, 0.14, 14, toon(0xe53935), x, 1.76, z));
    [-0.13, 0.13].forEach((o) => g.add(ball(0.045, dark, x + fx * 0.29 + fz * o, 2.1, z + fz * 0.29 - fx * o)));
    [1.25, 1.45, 1.65].forEach((y, i) => g.add(ball(0.05, dark, x + fx * (0.42 - i * 0.02), y, z + fz * (0.42 - i * 0.02))));
  }

  function present(g, x, z, rng) {
    const s = rng.range(0.45, 0.8);
    g.add(rbox(s, s, s, 0.05, toon(rng.pick([0xe53935, 0x1e88e5, 0x43a047, 0x8e24aa])), x, s / 2, z, true));
    const rib = toon(0xffd600);
    g.add(box(s + 0.03, s + 0.03, 0.12, rib, x, s / 2, z)); g.add(box(0.12, s + 0.03, s + 0.03, rib, x, s / 2, z));
    g.add(ball(0.1, rib, x, s + 0.06, z));
  }

  function fence(g, x) {
    const wood = toon(0x9a6a44);
    for (let z = -1.5; z > -CHUNK; z -= 3) {
      g.add(rbox(0.18, 1.1, 0.18, 0.05, wood, x, 0.55, z));
      g.add(ball(0.14, snowM(), x, 1.12, z, false, 1, 0.6, 1));
    }
    [0.45, 0.85].forEach((y) => g.add(box(0.08, 0.14, CHUNK, wood, x, y, -CHUNK / 2)));
    g.add(box(0.14, 0.06, CHUNK, snowM(), x, 0.95, -CHUNK / 2));
  }

  function mound(g, x, z, r) { g.add(ball(r, toon(0xf4f9ff), x, -r * 0.15, z, false, 1.5, 0.42, 1.2)); }

  function signal(g, x, z, green) {
    const iron = toon(0x2a3142);
    g.add(cyl(0.07, 0.09, 3.2, 8, iron, x, 1.6, z, true));
    g.add(rbox(0.42, 0.95, 0.3, 0.08, iron, x, 3.4, z, true));
    g.add(ball(0.13, green ? toon(0x4a2020) : glow(0xff3b30, 2.4), x, 3.62, z + 0.14));
    g.add(ball(0.13, green ? glow(0x30e070, 2.4) : toon(0x1f4a2c), x, 3.2, z + 0.14));
    g.add(ball(0.2, snowM(), x, 3.9, z, false, 1.1, 0.4, 1));
  }

  function buildChunk(rng) {
    const g = new THREE.Group();
    [-1, 1].forEach((side) => {
      lamp(g, side * 5.0, -12); lamp(g, side * 5.0, -36);
      lights(g, side * 5.0, 0, -12, 0.5, 1); lights(g, side * 5.0, -12, -36, 0, 1); lights(g, side * 5.0, -36, -48, 0, 0.5);
      fence(g, side * 6.1);
      // near row: festive tree, snowman, presents, signal
      const nearZ = [-6, -20, -30, -42].map((z) => z + rng.range(-2, 2));
      nearZ.forEach((z, i) => {
        const r = rng();
        const x = side * rng.range(7.6, 9.5);
        if (r < 0.3) tree(g, x, z, rng.range(0.9, 1.25), rng, true);
        else if (r < 0.45) snowman(g, x, z, -side * Math.PI / 2 + rng.range(-0.5, 0.5));
        else if (r < 0.6) { for (let k = 0; k < 3; k++) present(g, x + rng.range(-0.6, 0.6), z + k * 0.9, rng); }
        else if (r < 0.7) signal(g, side * 7.0, z, rng.chance(0.5));
        else if (r < 0.9) tree(g, x, z, rng.range(0.8, 1.2), rng, false);
      });
      // middle: houses + trees
      const hz = rng.range(-14, -34);
      const hasHouse = rng.chance(0.75);
      if (hasHouse) house(g, side * rng.range(15, 18), hz, rng, side);
      for (let i = 0; i < 9; i++) {
        const z = -rng.range(1, CHUNK - 1), x = side * rng.range(11, 26);
        if (hasHouse && Math.abs(z - hz) < 6 && Math.abs(Math.abs(x) - 16.5) < 6) continue;
        tree(g, x, z, rng.range(1.0, 1.9), rng, false);
      }
      for (let i = 0; i < 5; i++) mound(g, side * rng.range(8, 28), -rng.range(2, CHUNK - 2), rng.range(1.2, 3));
      // far tree wall
      for (let i = 0; i < 6; i++) tree(g, side * rng.range(30, 44), -rng.range(0, CHUNK), rng.range(2.2, 3.4), rng, false, true);
    });
    const baked = bake(g, { outline: 0.05 });
    // only lit, near-track pieces need to cast shadows; glow bulbs never do
    return baked;
  }

  let chunks = null;
  function init() {
    if (chunks) return;
    const rng = LS.makeRng(20241224);
    chunks = [];
    for (let i = 0; i < 6; i++) chunks.push(buildChunk(rng));
  }

  // Place scenery for [d0, d0 + CHUNK]. Returns the objects for later removal.
  function decorate(scene, d0, rng) {
    init();
    const c = rng.pick(chunks).clone();
    if (rng.chance(0.5)) { c.rotation.y = Math.PI; c.position.z = -(d0 + CHUNK); } else c.position.z = -d0;
    scene.add(c);
    return [c];
  }

  // Far mountains, hills, clouds and sun. Follows the player.
  function backdrop() {
    const g = new THREE.Group();
    const far = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
    const body = far(0x9cc4ee), body2 = far(0x86b3e4), cap = far(0xffffff), hill = far(0xe6f1fc);
    const rng = LS.makeRng(7);
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? 1 : -1;
      const h = rng.range(45, 100), r = rng.range(40, 70);
      const x = side * rng.range(75, 190), z = -rng.range(170, 300);
      g.add(mesh(new THREE.ConeGeometry(r, h, 6), i % 3 ? body : body2, x, h / 2 - 6, z));
      g.add(mesh(new THREE.ConeGeometry(r * 0.4, h * 0.4, 6), cap, x, h - 6 - h * 0.2 + 0.6, z));
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const m = ball(1, hill, side * rng.range(50, 150), -4, -rng.range(60, 230), false, rng.range(30, 55), rng.range(9, 18), rng.range(30, 50));
      g.add(m);
    }
    const baked = bake(g, { outline: false, shadow: false });
    baked.traverse((o) => { o.frustumCulled = false; });
    // sun with halo
    const sunTex = canvasTex(128, 128, (x) => {
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.22, 'rgba(255,244,200,1)');
      gr.addColorStop(0.3, 'rgba(255,230,160,0.45)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    });
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
    sun.material.color.multiplyScalar(1.5);
    sun.scale.set(90, 90, 1); sun.position.set(70, 95, -300); baked.add(sun);
    // puffy clouds
    const cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const cg = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const cx = rng.range(-220, 220), cy = rng.range(70, 130), cz = -rng.range(200, 320), s = rng.range(8, 16);
      for (let k = 0; k < 5; k++) cg.add(ball(s * rng.range(0.6, 1), cloudM, cx + (k - 2) * s * 0.9, cy + rng.range(-2, 2), cz, false, 1.2, 0.6, 0.8));
    }
    const clouds = bake(cg, { outline: false, shadow: false });
    clouds.traverse((o) => { o.frustumCulled = false; });
    baked.add(clouds);
    baked.userData.clouds = clouds;
    return baked;
  }

  return {
    id: 'winter',
    name: 'Winter',
    chunkLen: CHUNK,
    fog: { color: 0xeaf4ff, near: 55, far: 210 },
    hemi: { sky: 0xffffff, ground: 0x6f9be0, intensity: 1.45 },
    sun: { color: 0xfff2d8, intensity: 1.55 },
    groundColor: 0xffffff,
    bankColor: 0xffffff,
    skyTexture, trackTexture, snowTexture, decorate, backdrop, init,
    snowfall: true,
  };
})();
