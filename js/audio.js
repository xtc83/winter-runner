// All sounds are synthesised with Web Audio: no audio files, no licensing issues.
LS.Audio = (function () {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let muted = LS.Storage.data.muted;
  let coinStreak = 0, lastCoinT = 0;
  let boostNode = null;
  let customMusic = null; // <audio> element when the player loads an own file

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    setVolumes(LS.Storage.data.musicVol, LS.Storage.data.sfxVol);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setVolumes(music, sfx) {
    if (!ctx) return;
    musicBus.gain.value = (music / 100) * 0.35;
    sfxBus.gain.value = (sfx / 100) * 0.8;
  }

  function toggleMute() {
    muted = !muted;
    LS.Storage.data.muted = muted; LS.Storage.save();
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    return muted;
  }

  // --- primitives -------------------------------------------------------
  function tone(f, dur, opt = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + (opt.delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    const v = opt.vol == null ? 0.3 : opt.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, opt = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + (opt.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.frequency.setValueAtTime(opt.f0 || 1000, t);
    if (opt.f1) f.frequency.exponentialRampToValueAtTime(opt.f1, t + dur);
    f.Q.value = opt.q || 1;
    const g = ctx.createGain();
    const v = opt.vol == null ? 0.3 : opt.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opt.dest || sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // --- game sounds --------------------------------------------------------
  const sfx = {
    coin() {
      const now = performance.now();
      coinStreak = now - lastCoinT < 450 ? Math.min(coinStreak + 1, 12) : 0;
      lastCoinT = now;
      const base = 988 * Math.pow(2, coinStreak / 24);
      tone(base, 0.08, { type: 'square', vol: 0.06 });
      tone(base * 1.5, 0.22, { type: 'sine', vol: 0.16, delay: 0.05 });
    },
    jump() {
      noise(0.22, { f0: 500, f1: 2200, q: 2, vol: 0.18 });
      tone(320, 0.18, { to: 640, type: 'triangle', vol: 0.12 });
    },
    superJump() {
      noise(0.4, { f0: 300, f1: 3500, q: 3, vol: 0.22 });
      tone(260, 0.35, { to: 1040, type: 'triangle', vol: 0.15 });
    },
    roll() { noise(0.3, { filter: 'lowpass', f0: 900, f1: 200, vol: 0.3 }); },
    lane() { noise(0.09, { filter: 'highpass', f0: 2500, vol: 0.09 }); },
    land() { tone(140, 0.12, { to: 60, vol: 0.25 }); noise(0.08, { filter: 'lowpass', f0: 600, vol: 0.12 }); },
    stumble() {
      tone(220, 0.18, { to: 80, type: 'square', vol: 0.12 });
      noise(0.15, { filter: 'lowpass', f0: 1200, vol: 0.25 });
    },
    crash() {
      noise(0.9, { filter: 'lowpass', f0: 4000, f1: 150, vol: 0.6 });
      tone(120, 0.7, { to: 35, type: 'sawtooth', vol: 0.25 });
      tone(90, 0.5, { to: 40, type: 'square', vol: 0.15, delay: 0.05 });
    },
    powerup() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.06 }));
    },
    powerEnd() {
      [784, 659, 523].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.12, delay: i * 0.07 }));
    },
    boostStart() {
      tone(180, 0.8, { to: 1400, type: 'sawtooth', vol: 0.12 });
      noise(1.0, { f0: 300, f1: 4000, q: 1.5, vol: 0.35 });
      tone(90, 0.6, { to: 45, vol: 0.35 });
    },
    boostEnd() { noise(0.6, { f0: 3000, f1: 300, vol: 0.2 }); },
    record() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.07, delay: i * 0.11 }));
    },
    click() { tone(880, 0.06, { type: 'square', vol: 0.05 }); },
  };

  // Continuous rocket rumble while boosting / jetpacking.
  function startLoop() {
    if (!ctx || boostNode) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.2);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    boostNode = { s, g };
  }
  function stopLoop() {
    if (!boostNode) return;
    const { s, g } = boostNode; boostNode = null;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
    s.stop(ctx.currentTime + 0.6);
  }

  // --- music: public-domain carols, synthesised ---------------------------
  const N = {};
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let o = 2; o <= 6; o++) names.forEach((n, i) => { N[n + o] = 440 * Math.pow(2, (i - 9) / 12 + (o - 4)); });

  // [note, beats]; '-' = rest. Jingle Bells (James Lord Pierpont, 1857) – public domain.
  const verse = [
    ['G4',1],['E5',1],['D5',1],['C5',1], ['G4',3],['G4',0.5],['G4',0.5],
    ['G4',1],['E5',1],['D5',1],['C5',1], ['A4',4],
    ['A4',1],['F5',1],['E5',1],['D5',1], ['B4',4],
    ['G5',1],['G5',1],['F5',1],['D5',1], ['E5',4],
    ['G4',1],['E5',1],['D5',1],['C5',1], ['G4',4],
    ['G4',1],['E5',1],['D5',1],['C5',1], ['A4',3],['A4',1],
    ['A4',1],['F5',1],['E5',1],['D5',1], ['G5',1],['G5',1],['G5',1],['G5',1],
    ['A5',1],['G5',1],['F5',1],['D5',1], ['C5',2],['G5',2],
  ];
  const verseBass = ['C3','C3','C3','F3','F3','G3','G3','C3', 'C3','C3','C3','F3','F3','G3','G3','C3'];
  const chorus = [
    ['E5',1],['E5',1],['E5',2], ['E5',1],['E5',1],['E5',2], ['E5',1],['G5',1],['C5',1.5],['D5',0.5], ['E5',4],
    ['F5',1],['F5',1],['F5',1.5],['F5',0.5], ['F5',1],['E5',1],['E5',1],['E5',0.5],['E5',0.5],
    ['E5',1],['D5',1],['D5',1],['E5',1], ['D5',2],['G5',2],
    ['E5',1],['E5',1],['E5',2], ['E5',1],['E5',1],['E5',2], ['E5',1],['G5',1],['C5',1.5],['D5',0.5], ['E5',4],
    ['F5',1],['F5',1],['F5',1],['F5',1], ['F5',1],['E5',1],['E5',1],['E5',0.5],['E5',0.5],
    ['G5',1],['G5',1],['F5',1],['D5',1], ['C5',4],
  ];
  const chorusBass = ['C3','C3','C3','C3','F3','C3','D3','G3', 'C3','C3','C3','C3','F3','C3','G3','C3'];
  const song = [
    { mel: verse, bass: verseBass }, { mel: chorus, bass: chorusBass },
    { mel: chorus, bass: chorusBass, octave: 2 },
  ];
  const BPM = 138, BEAT = 60 / BPM;
  let musicOn = false, nextTime = 0, sec = 0, idx = 0, bar = 0, timer = null;

  function bell(f, t, dur, vol) {
    [[1, 1], [2.01, 0.35], [3.98, 0.12]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur * 1.6));
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur * 1.6 + 0.5);
    });
  }
  function bassNote(f, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function sleigh(t) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.1);
  }

  let beatInSec = 0;
  function schedule() {
    while (nextTime < ctx.currentTime + 0.25) {
      const part = song[sec];
      const [n, beats] = part.mel[idx];
      if (n !== '-') bell(N[n] * (part.octave || 1), nextTime, beats * BEAT, 0.22);
      // bass + sleigh bells on each beat crossed by this note
      const start = beatInSec, end = beatInSec + beats;
      for (let b = Math.ceil(start - 1e-6); b < end - 1e-6; b++) {
        const tb = nextTime + (b - start) * BEAT;
        const barIdx = Math.floor(b / 4) % part.bass.length;
        const root = N[part.bass[barIdx]];
        if (b % 2 === 0) bassNote(b % 4 === 0 ? root : root * 1.5, tb, BEAT * 1.8);
        sleigh(tb); sleigh(tb + BEAT / 2);
      }
      beatInSec = end;
      nextTime += beats * BEAT;
      idx++;
      if (idx >= part.mel.length) { idx = 0; beatInSec = 0; sec = (sec + 1) % song.length; }
    }
  }

  function startMusic() {
    if (!ctx) return;
    if (customMusic) { customMusic.play().catch(() => {}); return; }
    if (musicOn) return;
    musicOn = true; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 80);
  }
  function stopMusic() {
    if (customMusic) customMusic.pause();
    musicOn = false; clearInterval(timer); timer = null;
    sec = 0; idx = 0; beatInSec = 0;
  }

  function setCustomMusic(file) {
    init();
    const wasOn = musicOn;
    stopMusic();
    if (customMusic) { customMusic.pause(); URL.revokeObjectURL(customMusic.src); }
    customMusic = new Audio(URL.createObjectURL(file));
    customMusic.loop = true;
    ctx.createMediaElementSource(customMusic).connect(musicBus);
    if (wasOn) startMusic();
  }

  return { init, sfx, startLoop, stopLoop, startMusic, stopMusic, setVolumes, toggleMute, setCustomMusic, isMuted: () => muted };
})();
