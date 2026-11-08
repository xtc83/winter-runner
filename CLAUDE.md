# Luca-Surfers – Projektgedächtnis

Eigenes 3D-Endless-Runner-Spiel im Browser (Three.js), Stil angelehnt an das Genre der
Zug-Endless-Runner. Besitzer: xtc83. Kommunikation auf Deutsch, locker und ehrlich.

## Grundregeln (vom Besitzer festgelegt)

- **Eigenes Spiel, kein Nachbau:** keine Figuren, Grafiken, Musik, Namen oder konkreten
  Level aus Subway Surfers übernehmen. Genre-Mechaniken (3 Gleise, Züge, Springen/Rollen,
  Münzen, Power-ups) sind ok.
- **Musik nur gemeinfrei oder selbst komponiert**, im Code synthetisiert (Web Audio).
  Geschützte Songs (z. B. "Last Christmas") nicht einbauen. Spieler können lokal eine
  eigene MP3 laden.
- **Plattform: PC** (Tastatur). Einzelspieler zuerst, Multiplayer (max. 4) kommt später.
- Ehrliches Feedback geben, Rückfragen stellen, bevor große Dinge gebaut werden.

## Technik

- Reines HTML/JS, **kein Build-Schritt**, klassische `<script>`-Dateien mit globalem
  Namespace `LS` → `index.html` funktioniert per Doppelklick (file://).
- Three.js r160 liegt lokal in `lib/three.min.js` (offline lauffähig).
- Hosting: GitHub Pages (Branch `main`, Root) → https://xtc83.github.io/winter-runner/
- Testen: Playwright + Chromium headless mit `--use-gl=angle --use-angle=swiftshader`,
  `window.__game` ist ein Debug-Hook (G, player, world, startRun).
  Headless läuft mit wenigen FPS (dt wird auf 0.05 gekappt) → Timing-Tests großzügig.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/core.js` | `LS.CFG` (alle Tuning-Werte: Tempo, Sprung, Boost, Power-ups), Seed-RNG |
| `js/storage.js` | Highscores/Settings in localStorage (`lucasurfers.v1`) |
| `js/audio.js` | Soundeffekte + Musik (Jingle Bells, gemeinfrei) synthetisiert |
| `js/models.js` | Low-Poly-Modelle aus Grundformen (Spieler, Züge, Rampe, Hindernisse, Münzen, Power-ups) |
| `js/maps/winter.js` | Winter-Map: Farben, Texturen, Deko. **Neue Map = neue Datei gleicher Form** |
| `js/world.js` | Streckengenerator aus gebauten Abschnitten, Kollisionsflächen (`surfaceAt`) |
| `js/player.js` | Physik, Gleis-Dash, Sprung-Puffer, Animation |
| `js/effects.js` | Schneestaub, Funkeln, Speed-Linien |
| `js/game.js` | Loop, Input, Kollisionen, Boost, Power-ups, HUD, Kamera |

Koordinaten: Spieler läuft Richtung −z, Distanz `d = −z`. Gleise x = −2.6 / 0 / 2.6.

## Spielmechanik (Stand)

- Gleiswechsel = 0,2-s-Dash mit Drehung/Neigung, Kamera folgt mit Verzögerung.
- Hindernisse: Hürde (springen), Balken (rollen **oder draufspringen**), Zug (stehend /
  entgegenkommend), Rampe aufs Zugdach. Hürden, Balken und Zugdächer sind begehbar.
- Seitlich in Zug = Zurückprallen; 2× innerhalb 3 s = Crash. Frontal = Crash.
- Start-Boost: Taste E in den ersten 10 s, ~650 m Raketenflug, sammelt keine Münzen.
- **No-Coin-Lauf:** Jeder Abschnitt muss eine Route ohne Pflicht-Münzen haben. Beim
  Bauen neuer Abschnitte darauf achten (Münzen nur auf optionalen Routen).
- Power-ups: Magnet, Super-Sprung, Jetpack (Münzspur in der Luft), 2x-Punkte.
- Strecke kommt aus einem Seed → Basis für Multiplayer (alle gleiche Strecke).

## Roadmap / offene Punkte

1. Feedback vom Besitzer nach dem Testen einarbeiten (Tempo, Sprung, Schwierigkeit).
2. Shop mit Figuren und Gadgets (Münzen werden schon als `totalCoins` gespeichert).
3. Multiplayer bis 4 Spieler: gleiche Seed-Strecke, Positionen live synchronisieren.
   Plan: zuerst Peer-to-Peer (WebRTC/PeerJS, kein eigener Server), falls Netzprobleme →
   kleiner Node-WebSocket-Server.
4. Weitere Maps (Datei in `js/maps/`).
5. Optional: bessere 3D-Modelle (CC0, z. B. Kenney/Quaternius) statt Grundformen.
