# Hollowmere

Browser game: a first-person, grid-based party RPG. Plain HTML, CSS and JavaScript with no build step and no dependencies.

- Live game (GitHub Pages, deploys from `main`): https://dannyshin76-pixel.github.io/Mere/
- Repository: https://github.com/dannyshin76-pixel/Mere

## Workflow rules

- After each change, test it (see below), then commit and push to `main` so the live game updates. Do this without being asked.
- For large or risky features, ask the owner whether to work on a branch first.
- When a commit changes `style.css` or any `js/*.js` file, bump the `?v=` number on every asset link in `index.html` so browsers fetch the new files: `sed -i -E 's/\?v=[0-9]+/?v=N/g' index.html` (N = current number + 1).
- Keep the code formatted: `npx -y prettier@3.3.3 --print-width 100 --write "js/*.js" style.css`
- Read only the file you need. Use the map below and search with grep before opening whole files.
- When you add, rename or remove a file, or move a feature to another file, update the file map below (and the table in `README.md`) in the same commit.
- If a file grows past about 500 lines or holds more than one feature, suggest splitting it to the owner before adding more to it.

## File map

Scripts are classic `<script>` tags loaded in this order and share globals (no modules).

| File | Contents |
|---|---|
| `index.html` | Page markup and script tags |
| `style.css` | Layout and styling; colors are tokens on `:root` |
| `js/engine.js` | Utilities (`mulberry`, `hash2`, `vnoise`, `pack`), wall/floor textures `TX`, sky panorama, sprite art `SPR` |
| `js/data.js` | `CLASSES`, `SKILLS`, `ITEMS`, enemy stats `EN`, floor settings `DEFS`, ASCII `FIELD_MAP`, start/arrival points |
| `js/world.js` | Field parsing, dungeon generator `genDungeon`, save state `S`, `save`/`load`, map helpers |
| `js/ui.js` | Message log, banner, party cards, all side panels (`renderPanel`) |
| `js/explore.js` | Movement, monster AI (`tick`), floor changes (`goFloor`), chests, camp, out-of-battle items |
| `js/battle.js` | Turn-based combat: menus, damage formulas, enemy actions, victory, defeat |
| `js/render.js` | Software raycaster (`render`), battle overlay, minimap (`drawMap`) |
| `js/main.js` | Game loop, keyboard and click input, startup |

## Common edits

- Balance (enemy HP, damage, XP, gold): `EN` in `js/data.js`
- Party growth and skills: `CLASSES` and `SKILLS` in `js/data.js`; skill effects in `partyAct` in `js/battle.js`
- Dungeon layout and monster pools: `DEFS` in `js/data.js` (seeded generation in `genDungeon`)
- Overworld layout: `FIELD_MAP` in `js/data.js` (`#` hedge, `R` rock, `~` water, `T` tree, `C` camp, `A`/`B` dungeon gates, `c` chest, `s`/`w`/`g` monsters, `P` start)
- New monster art: add a `sprite(...)` entry to `SPR` in `js/engine.js` and stats to `EN`

## Testing

Serve the folder (`python3 -m http.server 8765`) and load it in headless Chromium with Playwright. Check for console errors, press movement keys, and, for combat changes, start a fight with `startBattle(enemies()[0], 'party')` and press `1` to pick menu options.

## Notes

- Saves live in `localStorage` under `hollowmere-save-v1`. Changing map layouts or the save shape can break old saves; bump the key if needed.
- Dungeon layouts are generated from fixed seeds, so changing a seed or generator logic changes that floor for everyone.
