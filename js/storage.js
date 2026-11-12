// Local save data (highscores, coin bank for a later shop, settings).
LS.Storage = (function () {
  const KEY = 'lucasurfers.v1';
  const defaults = {
    bestScore: 0, bestDist: 0, bestNoCoin: 0, totalCoins: 0, runs: 0,
    musicVol: 35, sfxVol: 70, muted: false, quality: 'auto',
  };
  let data = Object.assign({}, defaults);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { /* storage blocked: play without saving */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  return { data, save };
})();
