# Hollowmere

A first-person party RPG that runs in the browser. Lead four adventurers across Ashfield Meadows and down into the Mossy Cellar and Hollow Keep. Every monster is visible on the map, so each fight is your choice.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page layout |
| `style.css` | Page styling |
| `js/engine.js` | Utilities, textures, sky and sprite art |
| `js/data.js` | Classes, skills, items, enemies, floor settings, field map |
| `js/world.js` | Dungeon generation and save state |
| `js/ui.js` | Party cards, menus and message log |
| `js/explore.js` | Movement, monster AI, chests, camp |
| `js/battle.js` | Turn-based combat |
| `js/render.js` | First-person renderer and minimap |
| `js/main.js` | Game loop, input and startup |

Scripts load in the order above and share globals.

## Run locally

Open `index.html` through any static server, for example `python3 -m http.server`.
