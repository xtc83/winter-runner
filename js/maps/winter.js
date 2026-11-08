// Winter map: colours, scenery and decoration. New maps = new file with the same shape.
LS.Maps = LS.Maps || {};

LS.Maps.winter = (function () {
  const { mat, box } = LS.Models;

  function skyTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#3d6e9e'); gr.addColorStop(0.45, '#8fb8d8'); gr.addColorStop(0.62, '#d6e6f2'); gr.addColorStop(1, '#e8f1f8');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // gravel + wooden sleepers, one sleeper per texture tile (2 m)
  function trackTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#6d6a66'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = 80 + Math.random() * 70;
      g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    g.fillStyle = '#5d4037'; g.fillRect(6, 44, 116, 40);
    g.fillStyle = '#4e342e'; for (let i = 0; i < 5; i++) g.fillRect(6, 48 + i * 8, 116, 2);
    // snow dust on sleeper
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 40; i++) g.fillRect(6 + Math.random() * 112, 44 + Math.random() * 8, 6 + Math.random() * 10, 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  function snowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#eef4fa'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) {
      const v = 215 + Math.random() * 40;
      g.fillStyle = `rgba(${v - 10},${v - 4},${v + 10},0.5)`;
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------- scenery pieces ----------
  const snowMat = mat(0xffffff, { roughness: 1 });
  const treeGeo = [];
  function tree(scale) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 6), mat(0x5d4037));
    trunk.position.y = 0.5; g.add(trunk);
    const green = mat(0x1b5e20, { flatShading: true });
    for (let i = 0; i < 3; i++) {
      const r = 1.4 - i * 0.35, h = 1.6 - i * 0.2, y = 1.1 + i * 0.95;
      if (!treeGeo[i]) {
        treeGeo[i] = [new THREE.ConeGeometry(r, h, 8), new THREE.ConeGeometry(r * 0.75, h * 0.45, 8)];
      }
      const cone = new THREE.Mesh(treeGeo[i][0], green); cone.position.y = y + h / 2; cone.castShadow = true; g.add(cone);
      const cap = new THREE.Mesh(treeGeo[i][1], snowMat); cap.position.y = y + h * 0.78; g.add(cap);
    }
    g.scale.setScalar(scale);
    return g;
  }

  const bulbColors = [0xff1744, 0x00e676, 0xffea00, 0x2979ff, 0xff9100];
  const bulbMats = bulbColors.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
  function lamp() {
    const g = new THREE.Group();
    g.add(box(0.14, 4.2, 0.14, mat(0x263238), 0, 2.1, 0));
    g.add(box(0.7, 0.1, 0.1, mat(0x263238), 0, 4.15, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    head.position.set(0, 4.0, 0); g.add(head);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.18, depthWrite: false }));
    halo.position.copy(head.position); g.add(halo);
    g.add(box(0.3, 0.08, 0.3, snowMat, 0, 4.24, 0));
    return g;
  }
  function lightString(x, zA, zB, y) {
    const g = new THREE.Group();
    const n = 10;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const b = new THREE.Mesh(bulbGeo, bulbMats[i % bulbMats.length]);
      b.position.set(x, y - Math.sin(t * Math.PI) * 0.8, zA + (zB - zA) * t);
      g.add(b);
    }
    return g;
  }

  const houseColors = [0xb71c1c, 0x8d6e63, 0x1a237e, 0x33691e, 0xf9a825, 0x4e342e];
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
  function house(rng, side) {
    const g = new THREE.Group();
    const w = rng.range(5, 8), d = rng.range(5, 8), h = rng.range(3.5, 6);
    g.add(box(w, h, d, mat(rng.pick(houseColors)), 0, h / 2, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4), snowMat);
    roof.rotation.y = Math.PI / 4; roof.position.y = h + 1.3; roof.castShadow = true; g.add(roof);
    const fx = -side * (w / 2 + 0.02); // windows facing the track
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < Math.floor(h / 2.2); j++) {
        const wnd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), windowMat);
        wnd.position.set(fx, 1.6 + j * 2, -d / 4 + i * d / 2);
        wnd.rotation.y = -side * Math.PI / 2;
        g.add(wnd);
      }
    }
    const chim = box(0.6, 1.6, 0.6, mat(0x5d4037), w * 0.2, h + 1.6, 0); g.add(chim);
    return g;
  }

  function snowman() {
    const g = new THREE.Group();
    [[0.6, 0.6], [0.42, 1.45], [0.3, 2.05]].forEach(([r, y]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), snowMat);
      s.position.y = y; s.castShadow = true; g.add(s);
    });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), mat(0xff6f00));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.05, 0.38); g.add(nose);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12), mat(0x212121));
    hat.position.y = 2.45; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12), mat(0x212121));
    brim.position.y = 2.28; g.add(brim);
    return g;
  }

  function present(rng) {
    const g = new THREE.Group();
    const s = rng.range(0.4, 0.7);
    g.add(box(s, s, s, mat(rng.pick([0xd32f2f, 0x1976d2, 0x388e3c, 0x7b1fa2])), 0, s / 2, 0));
    g.add(box(s + 0.02, s + 0.02, 0.1, mat(0xffd600), 0, s / 2, 0));
    g.add(box(0.1, s + 0.02, s + 0.02, mat(0xffd600), 0, s / 2, 0));
    return g;
  }

  // Fill both sides of [d0, d1] (distances) with scenery. Returns the objects for later removal.
  function decorate(scene, d0, d1, rng) {
    const objs = [];
    const add = (o, x, d, rotY = 0) => { o.position.set(x, 0, -d); o.rotation.y = rotY; scene.add(o); objs.push(o); };
    // lamps with string lights every 24 m
    const firstLamp = Math.ceil(d0 / 24) * 24;
    for (let d = firstLamp; d < d1; d += 24) {
      [-1, 1].forEach((side) => {
        add(lamp(), side * 5.0, d);
        const ls = lightString(side * 5.0, -d, -(d + 24), 4.05);
        scene.add(ls); objs.push(ls);
      });
    }
    for (let d = d0; d < d1; d += rng.range(3, 7)) {
      const side = rng.chance(0.5) ? -1 : 1;
      add(tree(rng.range(0.8, 1.6)), side * rng.range(6.5, 16), d + rng.range(0, 3), rng.range(0, 6));
    }
    if (rng.chance(0.55)) {
      const side = rng.chance(0.5) ? -1 : 1;
      add(house(rng, side), side * rng.range(19, 24), rng.range(d0, d1));
    }
    if (rng.chance(0.18)) add(snowman(), (rng.chance(0.5) ? -1 : 1) * rng.range(6, 8), rng.range(d0, d1), rng.range(-0.6, 0.6) + Math.PI);
    if (rng.chance(0.25)) {
      const x = (rng.chance(0.5) ? -1 : 1) * rng.range(5.8, 7);
      const d = rng.range(d0, d1);
      for (let i = 0; i < 3; i++) add(present(rng), x + rng.range(-0.5, 0.5), d + i * 0.8, rng.range(0, 1));
    }
    return objs;
  }

  // Far mountains, follow the player.
  function backdrop() {
    const g = new THREE.Group();
    const mMat = new THREE.MeshBasicMaterial({ color: 0xc5d8ea, fog: false });
    const capMat = new THREE.MeshBasicMaterial({ color: 0xf5faff, fog: false });
    const rng = LS.makeRng(7);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const h = rng.range(40, 90), r = rng.range(40, 70);
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mMat);
      const x = side * rng.range(70, 160), z = -rng.range(150, 260);
      m.position.set(x, h / 2 - 5, z); g.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.36, 7), capMat);
      cap.position.set(x, h - 5 - h * 0.18 + 0.5, z); g.add(cap);
    }
    return g;
  }

  return {
    id: 'winter',
    name: 'Winter',
    fog: { color: 0xdde9f3, near: 40, far: 190 },
    hemi: { sky: 0xe3f0ff, ground: 0x8fa3b8, intensity: 1.1 },
    sun: { color: 0xfff1dd, intensity: 1.8 },
    bankColor: 0xffffff,
    skyTexture, trackTexture, snowTexture, decorate, backdrop,
    snowfall: true,
  };
})();
