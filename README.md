# Luca-Surfers – Winter-Edition

Ein 3D-Endless-Runner im Browser (Three.js). Läuft komplett ohne Server.

## Spielen

- **Online (empfohlen):** https://xtc83.github.io/winter-runner/ – mit animierter Roboter-Figur.
- **Lokal:** `index.html` per Doppelklick öffnen. Funktioniert, zeigt aber eine einfachere Ersatzfigur, weil Browser bei lokalen Dateien keine 3D-Modelle laden.

## Steuerung

| Taste | Aktion |
|---|---|
| ← → / A D | Gleis wechseln |
| ↑ / W / Leertaste | Springen |
| ↓ / S | Rollen (in der Luft: schnell runter) |
| E | Boost – nur in den ersten 10 Sekunden einer Runde |
| P / Esc | Pause |
| M | Ton an/aus |

## Features

- Winter-Map mit Schneefall, Tannen, Lichterketten, Häusern und Schneemännern
- Stehende und entgegenkommende Züge, Rampen auf die Zugdächer, Barrieren zum Springen/Rollen
- Auf Barrieren und Rollen-Balken kann man draufspringen und von dort weiter aufs Zugdach
- Gebaute Streckenabschnitte (Zug-Gasse, Dächer-Route, Treppchen, Slalom, Gegenverkehr, Barrierenreihen …)
- Start-Boost (ca. 650 m Raketenflug)
- Münzen, die man auch komplett meiden kann → **No-Coin-Lauf** mit eigenem Rekord
- Power-ups: Magnet, Super-Sprung, Jetpack, 2x-Punkte
- Highscores werden lokal im Browser gespeichert
- Musik und Soundeffekte werden live synthetisiert (Jingle Bells, gemeinfrei). Eigene MP3 lokal ladbar.

## Grafik

Cartoon-Look mit Toon-Shading, dunklen Konturen und Leuchteffekten. Im Menü lässt sich die
Grafikstufe wählen (Automatisch / Hoch / Mittel / Niedrig). „Automatisch" schaltet selbst
herunter, wenn das Spiel nicht flüssig läuft.

## Credits

- Roboter-Figur: „RobotExpressive" von Tomás Laulhé (Quaternius), Anpassungen von Don McCurdy – CC0 1.0
- Three.js (MIT)

## Projektstruktur

```
index.html          Seite + Menüs
css/style.css       HUD / Menü-Design
lib/three.min.js    Three.js r160 (MIT)
lib/three-addons.min.js  Three.js-Zusätze gebündelt (Modell-Lader, Leuchteffekt, runde Boxen)
assets/robot.glb    Animierte Spielfigur (CC0)
js/core.js          Konstanten, Seed-Zufallsgenerator
js/storage.js       Highscores (localStorage)
js/audio.js         Sounds + Musik (Web Audio)
js/models.js        Cartoon-Modelle (Toon-Material, Konturen), Roboter-Lader
js/maps/winter.js   Winter-Map (Farben, Deko) – neue Maps = neue Datei
js/world.js         Streckengenerator, Hindernisse, Münzen, Power-ups
js/player.js        Spielfigur, Physik, Animation
js/effects.js       Schneestaub, Funkeln, Speed-Linien
js/game.js          Spielschleife, Steuerung, Kollisionen, HUD
```

Die Strecke wird aus einem Seed erzeugt: gleicher Seed = gleiche Strecke. Das ist die Grundlage für den späteren Multiplayer.

## Geplant

- Multiplayer (bis 4 Spieler, gleiche Strecke, live)
- Shop mit Figuren und Gadgets
- Weitere Maps
