// Cartoon-style models: toon shading, dark outlines, rounded shapes.
// Everything is built from primitives and baked into a few meshes per object.
LS.Models = (function () {
  const ADD = window.THREE_ADDONS || {};
  const OUTLINE = 0x1b2238;

  // ---------- materials ----------
  let ramp3 = null;
  function gradient() {
    if (!ramp3) {
      ramp3 = new THREE.DataTexture(new Uint8Array([120, 185, 255, 255]), 4, 1, THREE.RedFormat);
      ramp3.minFilter = ramp3.magFilter = THREE.NearestFilter;
      ramp3.needsUpdate = true;
    }
    return ramp3;
  }
  const cache = {};
  function toon(color, opt = {}) {
    const key = 't' + color + JSON.stringify(opt);
    if (!cache[key]) cache[key] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: gradient() }, opt));
    return cache[key];
  }
  // unlit, brighter than white so the bloom pass picks it up
  function glow(color, k = 1.6) {
    const key = 'g' + color + '|' + k;
    if (!cache[key]) {
      const m = new THREE.MeshBasicMaterial({ color });
      m.color.multiplyScalar(k);
      cache[key] = m;
    }
    return cache[key];
  }
  function texToon(tex, opt = {}) {
    return new THREE.MeshToonMaterial(Object.assign({ map: tex, gradientMap: gradient() }, opt));
  }

  // Outline = back faces pushed out along the normal (works for skinned meshes too).
  const outlineMats = {};
  function outlineMat(thickness = 0.035) {
    if (outlineMats[thickness]) return outlineMats[thickness];
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        thickness: { value: thickness }, color: { value: new THREE.Color(OUTLINE) },
      }]),
      vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        #include <fog_pars_vertex>
        uniform float thickness;
        void main() {
          vec3 objectNormal = normal;
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          vec3 transformed = position;
          #include <skinning_vertex>
          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          vec3 n = normalize(normalMatrix * objectNormal);
          mvPosition.xyz += n * thickness * (1.0 + max(0.0, -mvPosition.z) * 0.03);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 color;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      side: THREE.BackSide, fog: true,
    });
    outlineMats[thickness] = m;
    return m;
  }

  // ---------- geometry helpers ----------
  function mesh(geo, material, x = 0, y = 0, z = 0, ol = false) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.userData.ol = ol;
    return m;
  }
  function box(w, h, d, material, x, y, z, ol) { return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, ol); }
  function rbox(w, h, d, r, material, x, y, z, ol) {
    const geo = ADD.RoundedBoxGeometry ? new ADD.RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    return mesh(geo, material, x, y, z, ol);
  }
  function cyl(rt, rb, h, seg, material, x, y, z, ol) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z, ol); }
  function ball(r, material, x, y, z, ol, sx = 1, sy = 1, sz = 1) {
    const big = r * Math.max(sx, sy, sz) > 0.25; // tiny bulbs don't need many triangles
    const m = mesh(new THREE.SphereGeometry(r, big ? 12 : 6, big ? 8 : 4), material, x, y, z, ol);
    m.scale.set(sx, sy, sz);
    return m;
  }

  // Merge all meshes of a group into one mesh per material (+ one outline mesh).
  function bake(group, opt = {}) {
    const merge = ADD.BufferGeometryUtils && ADD.BufferGeometryUtils.mergeGeometries;
    if (!merge) { group.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); return group; }
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const by = new Map(), ol = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); });
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(g);
      if (o.userData.ol) ol.push(g);
    });
    const out = new THREE.Group();
    for (const [m, gs] of by) {
      const me = new THREE.Mesh(merge(gs, false), m);
      const lit = !m.isMeshBasicMaterial;
      me.castShadow = lit && opt.shadow !== false;
      me.receiveShadow = lit;
      out.add(me);
    }
    if (ol.length && opt.outline !== false) out.add(new THREE.Mesh(merge(ol, false), outlineMat(opt.outline || 0.035)));
    return out;
  }
  // build once, then hand out cheap clones that share geometry
  const protos = {};
  function proto(key, build) {
    if (!protos[key]) protos[key] = build();
    return protos[key].clone();
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function stripeTexture(c1, c2, n = 6) {
    return canvasTex(128, 32, (g) => {
      g.fillStyle = c1; g.fillRect(0, 0, 128, 32);
      g.fillStyle = c2;
      for (let i = -1; i < n + 1; i++) {
        const x = i * (128 / n);
        g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 64 / n, 32); g.lineTo(x + 64 / n + 16, 0); g.lineTo(x + 16, 0); g.fill();
      }
    });
  }

  // ---------- rocket pack (shared by all characters) ----------
  function rocketPack() {
    const pack = new THREE.Group();
    const flames = [];
    const tank = toon(0xcfd8dc);
    [-0.16, 0.16].forEach((x) => {
      pack.add(cyl(0.13, 0.13, 0.6, 14, tank, x, 0, 0));
      const cap = mesh(new THREE.ConeGeometry(0.13, 0.2, 14), toon(0xe53935), x, 0.4, 0); pack.add(cap);
      pack.add(cyl(0.15, 0.1, 0.14, 14, toon(0x455a64), x, -0.36, 0));
      const flame = mesh(new THREE.ConeGeometry(0.12, 0.7, 10), glow(0xff8a00, 2.2), x, -0.75, 0);
      flame.rotation.x = Math.PI; pack.add(flame);
      const core = mesh(new THREE.ConeGeometry(0.06, 0.45, 8), glow(0xfff3b0, 2.6), x, -0.62, 0);
      core.rotation.x = Math.PI; pack.add(core);
      flames.push(flame, core);
    });
    pack.add(box(0.5, 0.12, 0.1, toon(0x455a64), 0, 0.05, -0.08));
    pack.visible = false;
    return { pack, flames };
  }

  // ---------- fallback character: blocky kid (used if the 3D model can't load) ----------
  function kid() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const jacket = toon(0xff5722), pants = toon(0x2b3a4a), skin = toon(0xffcc99), hat = toon(0x1e88e5),
      scarf = toon(0xffd600), white = toon(0xffffff), dark = toon(0x1b2238);
    const add = (parent, m) => { m.castShadow = true; parent.add(m); return m; };
    const hips = new THREE.Group(); hips.position.y = 0.85; body.add(hips);
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.x = -0.15; legR.position.x = 0.15;
    [legL, legR].forEach((l) => {
      add(l, rbox(0.25, 0.74, 0.29, 0.08, pants, 0, -0.38, 0));
      add(l, rbox(0.28, 0.17, 0.42, 0.07, white, 0, -0.78, -0.05));
      hips.add(l);
    });
    add(body, rbox(0.64, 0.74, 0.38, 0.14, jacket, 0, 1.2, 0));
    const shoulders = new THREE.Group(); shoulders.position.y = 1.5; body.add(shoulders);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.x = -0.42; armR.position.x = 0.42;
    [armL, armR].forEach((a) => {
      add(a, rbox(0.19, 0.62, 0.23, 0.08, jacket, 0, -0.28, 0));
      add(a, ball(0.11, hat, 0, -0.64, 0));
      shoulders.add(a);
    });
    add(body, rbox(0.58, 0.16, 0.44, 0.07, scarf, 0, 1.6, 0));
    const scarfTail = add(body, rbox(0.15, 0.42, 0.07, 0.03, scarf, 0.15, 1.42, 0.22));
    const head = new THREE.Group(); head.position.y = 1.84; body.add(head);
    add(head, rbox(0.46, 0.44, 0.44, 0.14, skin));
    add(head, ball(0.045, dark, -0.1, 0.03, -0.215));
    add(head, ball(0.045, dark, 0.1, 0.03, -0.215));
    add(head, rbox(0.5, 0.22, 0.5, 0.1, hat, 0, 0.24, 0));
    add(head, rbox(0.53, 0.1, 0.53, 0.05, white, 0, 0.13, 0));
    add(head, ball(0.11, white, 0, 0.42, 0));
    // outlines per part (parts animate separately, so no baking here)
    const olm = outlineMat(0.03);
    root.traverse((o) => { if (o.isMesh && o.material !== olm) { const c = new THREE.Mesh(o.geometry, olm); o.add(c); } });
    const { pack, flames } = rocketPack();
    pack.position.set(0, 1.25, 0.3); body.add(pack);
    return { root, body, legL, legR, armL, armR, scarfTail, pack, flames };
  }

  // ---------- main character: animated robot (CC0 model by Quaternius) ----------
  function loadRobot(done) {
    if (!ADD.GLTFLoader || location.protocol === 'file:') { done(null); return; }
    new ADD.GLTFLoader().load('assets/robot.glb', (gltf) => {
      try { done(buildRobot(gltf)); } catch (e) { console.warn('robot setup failed', e); done(null); }
    }, undefined, () => done(null));
  }
  function buildRobot(gltf) {
    const model = gltf.scene;
    const colors = { Main: 0xff6a1f, Grey: 0x5d6b7c, Black: 0x232a3d };
    const olm = outlineMat(0.028);
    const meshes = [];
    model.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((o) => {
      const src = o.material;
      o.material = toon(colors[src.name] !== undefined ? colors[src.name] : 0x9aa7b5);
      o.castShadow = true; o.frustumCulled = false;
      let ol;
      if (o.isSkinnedMesh) { ol = new THREE.SkinnedMesh(o.geometry, olm); ol.bind(o.skeleton, o.bindMatrix); }
      else ol = new THREE.Mesh(o.geometry, olm);
      ol.frustumCulled = false;
      ol.morphTargetInfluences = o.morphTargetInfluences;
      o.add(ol);
    });
    // scale to player height, face away from the camera
    // measure rigid parts only (skinned bounds are unreliable before the first pose)
    model.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    meshes.forEach((o) => { if (!o.isSkinnedMesh) bb.expandByObject(o); });
    const k = 1.95 / (bb.max.y - bb.min.y);
    model.scale.setScalar(k);
    model.rotation.y = Math.PI;

    // winter gear on the head bone
    let headBone = null;
    model.traverse((o) => { if (o.isBone && o.name === 'Head') headBone = o; });
    if (headBone) {
      const gear = new THREE.Group();
      const hat = toon(0x1e88e5), white = toon(0xffffff);
      const dome = mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 0, 0, true);
      dome.scale.set(1, 0.85, 1); gear.add(dome);
      gear.add(cyl(0.42, 0.42, 0.14, 18, white, 0, 0.02, 0, true));
      gear.add(ball(0.13, white, 0, 0.4, 0, true));
      const g = bake(gear, { outline: 0.028 });
      g.traverse((o) => { o.castShadow = false; });
      const inv = 1 / headBone.getWorldScale(new THREE.Vector3()).x; // bone units -> metres
      g.scale.setScalar(inv * 1.38);
      g.position.set(0, 0.62 * inv, 0);
      headBone.add(g);
      g.name = 'gear';
    }

    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    body.add(model);
    // scarf around the neck (follows the body group, not the bones)
    const { pack, flames } = rocketPack();
    pack.position.set(0, 1.15, 0.42); body.add(pack);

    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    gltf.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });
    ['Jump', 'Death'].forEach((n) => { if (actions[n]) { actions[n].setLoop(THREE.LoopOnce); actions[n].clampWhenFinished = true; } });
    return { root, body, model, mixer, actions, pack, flames, headBone };
  }

  // ---------- trains ----------
  const palettes = [
    { main: 0xe53935, light: 0xfff3e0, accent: 0xffc107 },
    { main: 0x1e88e5, light: 0xffffff, accent: 0xffeb3b },
    { main: 0x43a047, light: 0xfff8e1, accent: 0xff7043 },
    { main: 0xfdd835, light: 0xffffff, accent: 0x3949ab },
    { main: 0x8e24aa, light: 0xfce4ec, accent: 0x26c6da },
    { main: 0x00acc1, light: 0xffffff, accent: 0xff5252 },
  ];
  const glassMat = () => toon(0x24324f, { emissive: 0x0c1830 });
  // Train spans local z from -len to 0 (0 = end facing the player).
  function buildTrain(len, pal, moving) {
    const g = new THREE.Group();
    const W = LS.CFG.TRAIN_W;
    const main = toon(pal.main), light = toon(pal.light), accent = toon(pal.accent);
    const dark = toon(0x2a3142), roof = toon(0x8f9bb0), snow = toon(0xffffff), glass = glassMat();
    const cars = Math.max(1, Math.round(len / 11));
    const carLen = len / cars;
    for (let c = 0; c < cars; c++) {
      const cl = carLen - 0.3, cz = -(c + 0.5) * carLen;
      g.add(box(W - 0.4, 0.4, cl - 0.6, dark, 0, 0.45, cz));                    // chassis
      g.add(rbox(W, 1.3, cl, 0.2, main, 0, 1.25, cz, true));                     // lower body
      g.add(rbox(W - 0.04, 1.05, cl - 0.06, 0.22, light, 0, 2.3, cz, true));     // window band
      g.add(box(W + 0.03, 0.13, cl - 0.3, accent, 0, 1.84, cz));                 // stripe
      g.add(box(W + 0.01, 0.6, cl - 1.3, glass, 0, 2.32, cz));                   // glass strip
      for (let pz = -cl / 2 + 1.5; pz < cl / 2 - 1.0; pz += 1.75) g.add(box(W + 0.03, 0.66, 0.2, light, 0, 2.32, cz + pz));
      [-cl / 4, cl / 4].forEach((dz) => {                                         // doors
        g.add(box(W + 0.035, 1.95, 1.05, accent, 0, 1.6, cz + dz));
        g.add(box(W + 0.05, 0.7, 0.75, glass, 0, 2.25, cz + dz));
        g.add(box(W + 0.055, 1.95, 0.04, dark, 0, 1.6, cz + dz));
      });
      g.add(rbox(W - 0.1, 0.34, cl - 0.1, 0.15, roof, 0, 2.9, cz, true));        // roof
      g.add(rbox(W - 0.3, 0.24, cl - 0.5, 0.11, snow, 0, 3.08, cz));             // snow, top = 3.2
      [-cl / 2 + 1.5, cl / 2 - 1.5].forEach((bz) => {                             // bogies
        g.add(box(W - 0.3, 0.3, 1.9, dark, 0, 0.3, cz + bz));
        [-0.55, 0.55].forEach((wz) => [-0.86, 0.86].forEach((wx) => {
          const w = cyl(0.3, 0.3, 0.16, 14, toon(0x3a4256), wx, 0.3, cz + bz + wz); w.rotation.z = Math.PI / 2; g.add(w);
          const hub = cyl(0.12, 0.12, 0.18, 10, toon(0xb0bec5), wx, 0.3, cz + bz + wz); hub.rotation.z = Math.PI / 2; g.add(hub);
        }));
      });
      if (c < cars - 1) g.add(box(W - 0.7, 2.1, 0.4, dark, 0, 1.75, -(c + 1) * carLen));
    }
    // front face (towards the player)
    g.add(rbox(W - 0.5, 0.85, 0.12, 0.05, glass, 0, 2.3, -0.12));
    g.add(box(W - 0.9, 0.06, 0.13, toon(0x5b78b0), 0.1, 2.48, -0.118));          // glass highlight
    g.add(rbox(W - 0.1, 0.3, 0.35, 0.1, dark, 0, 0.72, -0.08, true));            // bumper
    g.add(box(1.0, 0.24, 0.1, glow(moving ? 0xffa000 : 0x8a6a2a, moving ? 1.8 : 0.9), 0, 2.9, -0.13));
    const lampOn = glow(0xfff6c0, 2.4), lampOff = toon(0xd8d2b0);
    [-0.72, 0.72].forEach((x) => {
      const rim = cyl(0.2, 0.2, 0.08, 16, dark, x, 1.15, -0.13); rim.rotation.x = Math.PI / 2; g.add(rim);
      const l = cyl(0.15, 0.15, 0.1, 16, moving ? lampOn : lampOff, x, 1.15, -0.12); l.rotation.x = Math.PI / 2; g.add(l);
    });
    const baked = bake(g, { outline: 0.045 });
    if (moving) { // soft light cone so oncoming trains read from far away
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({
        map: canvasTex(64, 64, (x) => {
          const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
          gr.addColorStop(0, 'rgba(255,246,190,0.9)'); gr.addColorStop(1, 'rgba(255,246,190,0)');
          x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
        }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      beam.position.set(0, 1.15, 0.05); baked.add(beam);
    }
    return baked;
  }
  function train(len, rng, moving) {
    const pi = Math.floor(rng() * palettes.length);
    return proto(`train|${len}|${pi}|${moving}`, () => buildTrain(len, palettes[pi], moving));
  }

  let rampGeo = null;
  function ramp(len) {
    return proto('ramp|' + len, () => {
      if (!rampGeo) {
        const s = new THREE.Shape();
        s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(1, 1); s.lineTo(0, 0);
        rampGeo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
        rampGeo.rotateY(Math.PI / 2);
        rampGeo.translate(-0.5, 0, 0);
      }
      const W = LS.CFG.TRAIN_W, H = LS.CFG.TRAIN_H;
      const tex = canvasTex(128, 256, (g) => {
        g.fillStyle = '#ffc928'; g.fillRect(0, 0, 128, 256);
        g.strokeStyle = '#e09a00'; g.lineWidth = 14;
        for (let y = -20; y < 300; y += 64) { g.beginPath(); g.moveTo(0, y + 40); g.lineTo(64, y); g.lineTo(128, y + 40); g.stroke(); }
        g.fillStyle = '#2a3142'; g.fillRect(0, 0, 10, 256); g.fillRect(118, 0, 10, 256);
      });
      const grp = new THREE.Group();
      const m = new THREE.Mesh(rampGeo, texToon(tex));
      m.scale.set(W - 0.2, H, len); m.castShadow = m.receiveShadow = true;
      grp.add(m);
      const o = new THREE.Mesh(rampGeo, outlineMat(0.045)); o.scale.copy(m.scale); grp.add(o);
      return grp;
    });
  }

  function hurdle() {
    return proto('hurdle', () => {
      const g = new THREE.Group();
      const post = toon(0x4a5568), board = texToon(stripeTexture('#ffffff', '#ff3b3b'));
      [-1.0, 1.0].forEach((x) => {
        g.add(rbox(0.16, 1.0, 0.16, 0.05, post, x, 0.5, 0, true));
        g.add(rbox(0.5, 0.1, 0.5, 0.04, post, x, 0.05, 0));
      });
      g.add(rbox(2.2, 0.42, 0.12, 0.05, board, 0, 0.78, 0, true));
      g.add(rbox(2.25, 0.12, 0.24, 0.06, toon(0xffffff), 0, 1.02, 0));
      g.add(ball(0.09, glow(0xff5a1f, 2.2), -1.0, 1.1, 0));
      g.add(ball(0.09, glow(0xff5a1f, 2.2), 1.0, 1.1, 0));
      return bake(g, { outline: 0.035 });
    });
  }

  function overhead() {
    return proto('overhead', () => {
      const g = new THREE.Group();
      const post = toon(0x3d4760), beam = texToon(stripeTexture('#ffd92e', '#2a3142'));
      [-0.4, 0.4].forEach((z) => [-1.15, 1.15].forEach((x) => g.add(rbox(0.18, 2.2, 0.18, 0.05, post, x, 1.1, z, true))));
      g.add(rbox(2.45, 0.82, 1.0, 0.08, beam, 0, 1.79, 0, true));
      g.add(rbox(2.5, 0.14, 1.06, 0.07, toon(0xffffff), 0, 2.19, 0));
      const ice = toon(0xbfeaff, { emissive: 0x23506a });
      for (let i = 0; i < 6; i++) {
        const c = mesh(new THREE.ConeGeometry(0.055, 0.24 + (i % 3) * 0.09, 6), ice, -1.0 + i * 0.4, 1.28, 0.44);
        c.rotation.x = Math.PI; g.add(c);
      }
      return bake(g, { outline: 0.035 });
    });
  }

  // ---------- pickups ----------
  // Coins are drawn with one InstancedMesh (see world.js).
  function coinParts() {
    const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 24);
    geo.rotateX(Math.PI / 2);
    const face = canvasTex(128, 128, (g) => {
      g.fillStyle = '#ffb300'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffd740'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
      g.fillStyle = '#ffb300'; g.beginPath(); g.arc(64, 64, 38, 0, 7); g.fill();
      g.fillStyle = '#fff3a0';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
      g.fill();
    });
    const faceMat = new THREE.MeshToonMaterial({ map: face, gradientMap: gradient(), emissive: 0x7a4a00 });
    const side = new THREE.MeshToonMaterial({ color: 0xe69500, gradientMap: gradient(), emissive: 0x5a3200 });
    return { geo, mats: [side, faceMat, faceMat] };
  }

  const iconCache = {};
  function icon(type) {
    if (iconCache[type]) return iconCache[type];
    const def = LS.CFG.POWERUPS[type];
    iconCache[type] = canvasTex(128, 128, (g) => {
      g.fillStyle = def.color; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#1b2238'; g.stroke();
      g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(64, 64, 51, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      if (type === 'magnet') {
        g.lineWidth = 20; g.beginPath(); g.arc(64, 58, 24, Math.PI, 0, true); g.stroke();
        g.fillStyle = '#cfd8dc'; g.fillRect(30, 32, 20, 16); g.fillRect(78, 32, 20, 16);
      } else if (type === 'sneakers') {
        g.beginPath(); g.moveTo(28, 82); g.lineTo(32, 54); g.lineTo(54, 54); g.lineTo(62, 66); g.lineTo(96, 72);
        g.quadraticCurveTo(102, 84, 94, 88); g.lineTo(28, 88); g.closePath(); g.fill();
        g.lineWidth = 5; [[38, 42], [50, 36], [62, 42]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 12); g.stroke(); });
      } else if (type === 'jetpack') {
        g.fillRect(40, 32, 18, 46); g.fillRect(70, 32, 18, 46);
        g.fillStyle = '#ffeb3b';
        [49, 79].forEach((x) => { g.beginPath(); g.moveTo(x - 9, 82); g.lineTo(x + 9, 82); g.lineTo(x, 106); g.fill(); });
      } else {
        g.font = 'bold 56px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2x', 64, 68);
      }
    });
    return iconCache[type];
  }
  function powerup(type) {
    const g = new THREE.Group();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(type), depthWrite: false }));
    s.scale.set(1.15, 1.15, 1); g.add(s);
    const col = new THREE.Color(LS.CFG.POWERUPS[type].color);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    g.add(bubble);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), glow(0xffffff, 1.5));
    g.add(ring);
    g.userData.ring = ring;
    return g;
  }

  return {
    toon, glow, texToon, outlineMat, mesh, box, rbox, cyl, ball, bake, proto, canvasTex, stripeTexture,
    kid, loadRobot, rocketPack, train, ramp, hurdle, overhead, coinParts, powerup, icon,
  };
})();
