// Shared namespace, constants and helpers.
window.LS = window.LS || {};

LS.CFG = {
  LANES: [-2.6, 0, 2.6],
  PLAYER_W: 0.8,
  PLAYER_H: 1.8,
  PLAYER_H_ROLL: 0.85,
  GRAVITY: 42,
  JUMP_H: 2.0,          // normal jump height
  JUMP_H_SNEAKER: 4.6,  // super sneakers clear trains
  ROLL_TIME: 0.55,
  LANE_TIME: 0.2,      // seconds for a lane dash
  SPEED_START: 17,
  SPEED_MAX: 33,
  SPEED_RAMP: 110,      // metres per +1 m/s
  TRAIN_H: 3.2,
  TRAIN_W: 2.2,
  BOOST_WINDOW: 10,     // seconds the boost is offered
  BOOST_DIST: 650,      // metres the boost carries you
  BOOST_SPEED: 75,
  BOOST_Y: 5.5,
  JET_Y: 7.5,
  POWERUPS: {
    magnet:   { name: 'Magnet',  dur: 12, color: '#e53935', label: 'M' },
    sneakers: { name: 'Sprung',  dur: 12, color: '#43a047', label: 'S' },
    jetpack:  { name: 'Jetpack', dur: 9,  color: '#fb8c00', label: 'J' },
    double:   { name: '2x',      dur: 15, color: '#ff3d7f', label: '2x' },
  },
};

// Seeded RNG (mulberry32). Same seed => same track, needed for multiplayer later.
LS.makeRng = function (seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
};

LS.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
LS.lerp = (a, b, t) => a + (b - a) * t;
LS.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
