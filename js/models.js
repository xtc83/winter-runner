// Procedural low-poly models built from primitives. Swap for .glb models later if wanted.
LS.Models = (function () {
  const M = {}; // material cache
  function mat(color, opt = {}) {
    const key = color + JSON.stringify(opt);
    if (!M[key]) M[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, opt));
    return M[key];
  }
  function box(w, h, d, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function stripeTexture(c1, c2, n = 6) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = c1; g.fillRect(0, 0, 128, 32);
    g.fillStyle = c2;
    for (let i = -1; i < n + 1; i++) {
      g.beginPath();
      const x = i * (128 / n);
      g.moveTo(x, 32); g.lineTo(x + 64 / n, 32); g.lineTo(x + 64 / n + 16, 0); g.lineTo(x + 16, 0); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------------- Player ----------------
  function player() {
    const root = new THREE.Group();      // positioned by game (feet at y=0)
    const body = new THREE.Group();      // rotated for roll / lean
    root.add(body);
    const jacket = mat(0xff5722), pants = mat(0x263238), skin = mat(0xffcc99), hat = mat(0x1e88e5),
      scarf = mat(0xffeb3b), shoe = mat(0xffffff), dark = mat(0x111111);

    const hips = new THREE.Group(); hips.position.y = 0.85; body.add(hips);
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.x = -0.15; legR.position.x = 0.15;
    [legL, legR].forEach((l) => {
      l.add(box(0.24, 0.72, 0.28, pants, 0, -0.38, 0));
      l.add(box(0.26, 0.14, 0.38, shoe, 0, -0.78, -0.05));
      hips.add(l);
    });
    const torso = box(0.62, 0.72, 0.36, jacket, 0, 1.2, 0); body.add(torso);
    body.add(box(0.5, 0.1, 0.38, mat(0xe64a19), 0, 0.88, 0)); // belt line
    const shoulders = new THREE.Group(); shoulders.position.y = 1.5; body.add(shoulders);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.x = -0.41; armR.position.x = 0.41;
    [armL, armR].forEach((a) => {
      a.add(box(0.18, 0.6, 0.22, jacket, 0, -0.28, 0));
      a.add(box(0.16, 0.14, 0.18, mat(0x1e88e5), 0, -0.64, 0)); // gloves
      shoulders.add(a);
    });
    body.add(box(0.56, 0.14, 0.42, scarf, 0, 1.6, 0));
    const scarfTail = box(0.14, 0.4, 0.06, scarf, 0.15, 1.42, 0.22); body.add(scarfTail);
    const head = new THREE.Group(); head.position.y = 1.82; body.add(head);
    head.add(box(0.42, 0.4, 0.4, skin));
    head.add(box(0.07, 0.07, 0.02, dark, -0.1, 0.03, -0.21));
    head.add(box(0.07, 0.07, 0.02, dark, 0.1, 0.03, -0.21));
    head.add(box(0.46, 0.18, 0.46, hat, 0, 0.22, 0));
    head.add(box(0.48, 0.08, 0.48, mat(0xffffff), 0, 0.12, 0));
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xffffff));
    pom.position.y = 0.38; head.add(pom);

    // rocket pack for boost / jetpack (hidden by default)
    const pack = new THREE.Group(); pack.position.set(0, 1.25, 0.28); body.add(pack);
    const tankMat = mat(0xb0bec5, { metalness: 0.6, roughness: 0.3 });
    const flames = [];
    [-0.15, 0.15].forEach((x) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), tankMat);
      tank.position.x = x; tank.castShadow = true; pack.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 12), mat(0xe53935));
      cap.position.set(x, 0.39, 0); pack.add(cap);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.6, 10),
        new THREE.MeshBasicMaterial({ color: 0xffa000, transparent: true, opacity: 0.9 }));
      flame.rotation.x = Math.PI; flame.position.set(x, -0.6, 0); pack.add(flame);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
      core.rotation.x = Math.PI; core.position.set(x, -0.5, 0); pack.add(core);
      flames.push(flame, core);
    });
    pack.visible = false;

    root.userData = { body, hips, legL, legR, armL, armR, head, pack, flames, scarfTail };
    return root;
  }

  // ---------------- Obstacles ----------------
  const trainPalettes = [
    [0xc62828, 0xffcdd2], [0x1565c0, 0xbbdefb], [0x2e7d32, 0xc8e6c9], [0x6a1b9a, 0xe1bee7], [0xef6c00, 0xffe0b2],
  ];
  // Train spans local z from -len to 0 (0 = end facing the player).
  function train(len, rng, moving) {
    const g = new THREE.Group();
    const [main, light] = trainPalettes[Math.floor(rng() * trainPalettes.length)];
    const H = LS.CFG.TRAIN_H, W = LS.CFG.TRAIN_W;
    const bodyMat = mat(main, { roughness: 0.5, metalness: 0.2 });
    const cars = Math.max(1, Math.round(len / 11));
    const carLen = len / cars;
    for (let c = 0; c < cars; c++) {
      const z0 = -c * carLen - 0.15, z1 = -(c + 1) * carLen + 0.15;
      const cl = z0 - z1, cz = (z0 + z1) / 2;
      g.add(box(W, H - 0.55, cl, bodyMat, 0, 0.35 + (H - 0.55) / 2 - 0.12, cz));
      g.add(box(W + 0.06, 0.25, cl, mat(light), 0, 1.15, cz)); // stripe
      // windows
      const win = mat(0x263238, { roughness: 0.2, metalness: 0.5, emissive: 0x112233 });
      for (let wz = z0 - 1.2; wz > z1 + 0.8; wz -= 1.6) {
        g.add(box(W + 0.04, 0.6, 1.0, win, 0, 2.05, wz));
      }
      // snow on roof
      const snow = box(W + 0.1, 0.14, cl - 0.1, mat(0xffffff, { roughness: 1 }), 0, H - 0.05, cz);
      g.add(snow);
      // wheels
      const wheelMat = mat(0x212121);
      [z0 - 1.2, z1 + 1.2].forEach((wz) => {
        [-0.8, 0.8].forEach((wx) => {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14), wheelMat);
          wh.rotation.z = Math.PI / 2; wh.position.set(wx, 0.32, wz); g.add(wh);
        });
      });
    }
    // front face toward player
    g.add(box(W - 0.3, 1.1, 0.06, mat(0x90caf9, { roughness: 0.1, metalness: 0.6, emissive: 0x0d2a40 }), 0, 2.0, 0.02));
    const lampMat = new THREE.MeshBasicMaterial({ color: moving ? 0xffffaa : 0x777766 });
    [-0.7, 0.7].forEach((x) => {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), lampMat);
      l.position.set(x, 0.9, 0.06); g.add(l);
    });
    if (moving) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.25, depthWrite: false }));
      glow.position.set(0, 0.9, 0.1); g.add(glow);
    }
    return g;
  }

  let rampGeo = null;
  function ramp(len) {
    if (!rampGeo) {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(1, 1); s.lineTo(0, 0);
      rampGeo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      rampGeo.rotateY(Math.PI / 2);
      rampGeo.translate(-0.5, 0, 0);
    }
    const tex = stripeTexture('#ffc107', '#37474f', 4);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 3);
    const m = new THREE.Mesh(rampGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    m.scale.set(LS.CFG.TRAIN_W - 0.2, LS.CFG.TRAIN_H, len);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  let hurdleTex = null;
  function hurdle() {
    if (!hurdleTex) hurdleTex = stripeTexture('#ffffff', '#e53935');
    const g = new THREE.Group();
    const post = mat(0x455a64);
    g.add(box(0.12, 1.0, 0.12, post, -1.0, 0.5, 0));
    g.add(box(0.12, 1.0, 0.12, post, 1.0, 0.5, 0));
    const board = box(2.2, 0.4, 0.1, new THREE.MeshStandardMaterial({ map: hurdleTex }), 0, 0.8, 0);
    g.add(board);
    g.add(box(2.2, 0.06, 0.16, mat(0xffffff), 0, 1.03, 0)); // snow on top
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3d00 }));
    lamp.position.set(-1.0, 1.06, 0); g.add(lamp);
    return g;
  }

  function overhead() {
    const g = new THREE.Group();
    const tex = stripeTexture('#ffeb3b', '#212121');
    const post = mat(0x37474f);
    [-0.4, 0.4].forEach((z) => {
      g.add(box(0.16, 2.2, 0.16, post, -1.15, 1.1, z));
      g.add(box(0.16, 2.2, 0.16, post, 1.15, 1.1, z));
    });
    // 1 m deep beam: roll under it, or jump on top and use it as a step
    g.add(box(2.4, 0.8, 1.0, new THREE.MeshStandardMaterial({ map: tex }), 0, 1.78, 0));
    g.add(box(2.5, 0.12, 1.05, mat(0xffffff, { roughness: 1 }), 0, 2.2, 0));
    // little icicles
    const ice = new THREE.MeshStandardMaterial({ color: 0xd0f0ff, roughness: 0.1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25 + (i % 3) * 0.08, 6), ice);
      c.rotation.x = Math.PI; c.position.set(-1.0 + i * 0.4, 1.28, 0.45); g.add(c);
    }
    return g;
  }

  // ---------------- Pickups ----------------
  let coinGeo = null, coinMat = null;
  function coin() {
    if (!coinGeo) {
      coinGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.08, 20);
      coinGeo.rotateX(Math.PI / 2);
      coinMat = new THREE.MeshStandardMaterial({ color: 0xffc400, metalness: 0.7, roughness: 0.25, emissive: 0x664400 });
    }
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.castShadow = true;
    return m;
  }

  const iconCache = {};
  function icon(type) {
    if (iconCache[type]) return iconCache[type];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const def = LS.CFG.POWERUPS[type];
    g.fillStyle = def.color; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    if (type === 'magnet') {
      g.lineWidth = 20; g.lineCap = 'butt';
      g.beginPath(); g.arc(64, 58, 26, Math.PI, 0, true); g.stroke();
      g.fillStyle = '#cfd8dc'; g.fillRect(28, 30, 20, 16); g.fillRect(80, 30, 20, 16);
    } else if (type === 'sneakers') {
      g.beginPath(); g.moveTo(26, 82); g.lineTo(30, 52); g.lineTo(54, 52); g.lineTo(62, 66); g.lineTo(98, 72);
      g.quadraticCurveTo(104, 84, 96, 88); g.lineTo(26, 88); g.closePath(); g.fill();
      g.lineWidth = 5; [[36, 40], [48, 34], [60, 40]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 12); g.stroke(); });
    } else if (type === 'jetpack') {
      g.fillRect(38, 30, 20, 50); g.fillRect(70, 30, 20, 50);
      g.fillStyle = '#ffeb3b';
      [48, 80].forEach((x) => { g.beginPath(); g.moveTo(x - 9, 84); g.lineTo(x + 9, 84); g.lineTo(x, 110); g.fill(); });
    } else {
      g.font = 'bold 60px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2x', 64, 68);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    iconCache[type] = t;
    return t;
  }
  function powerup(type) {
    const g = new THREE.Group();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(type), depthWrite: false }));
    s.scale.set(1.1, 1.1, 1); g.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    g.add(ring);
    g.userData.ring = ring;
    return g;
  }

  return { mat, box, player, train, ramp, hurdle, overhead, coin, powerup, icon, stripeTexture };
})();
