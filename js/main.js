"use strict";
/* ---------------- loop & input ---------------- */
let lastT = performance.now();
function loop(now) {
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.dur),
      e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camX = anim.x0 + (anim.x1 - anim.x0) * e;
    camY = anim.y0 + (anim.y1 - anim.y0) * e;
    camA = anim.a0 + (anim.a1 - anim.a0) * e;
    if (k >= 1) {
      camX = anim.x1;
      camY = anim.y1;
      camA = anim.a1;
      anim = null;
      afterAnim();
    }
  }
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  for (const e of enemies()) {
    if (e.rx === undefined) {
      e.rx = e.x;
      e.ry = e.y;
    }
    const f = Math.min(1, dt * 11);
    e.rx += (e.x - e.rx) * f;
    e.ry += (e.y - e.ry) * f;
  }
  render(now);
  drawMap();
  requestAnimationFrame(loop);
}
panel.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-a]");
  if (!b || b.disabled) return;
  const a = b.dataset.a,
    v = b.dataset.v;
  switch (a) {
    case "mv":
      input(v);
      break;
    case "map":
      toggleMap();
      break;
    case "mm":
      selM = +v;
      mode = "member";
      renderAll();
      break;
    case "cmd":
      battleCmd(v);
      break;
    case "bk":
      back();
      break;
    case "sk": {
      const s = SKILLS[v];
      needTarget({ kind: "skill", skill: v, tk: s.tk, from: "skill" });
      break;
    }
    case "it":
      needTarget({ kind: "item", item: v, tk: ITEMS[v].tk, from: "item" });
      break;
    case "tg":
      commit({ ...BT.pend, t: +v });
      break;
    case "rest":
      rest();
      break;
    case "buy":
      buy(v);
      break;
    case "use":
      useOutside(v);
      break;
    case "close":
      mode = "explore";
      renderAll();
      break;
    case "wake":
      wake();
      break;
    case "yesnew":
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (e) {}
      for (const k in FLOORS) delete FLOORS[k];
      for (const k in EXPC) delete EXPC[k];
      S = fresh();
      mode = "explore";
      lines.length = 0;
      intro();
      goFloor("field", START.x, START.y, START.dir);
      break;
  }
});
partyEl.addEventListener("click", (e) => {
  const c = e.target.closest(".card");
  if (!c) return;
  const i = +c.dataset.m;
  if (mode === "explore" || mode === "member" || mode === "camp") {
    selM = i;
    mode = "member";
    renderAll();
    return;
  }
  if (
    mode === "battle" &&
    BT &&
    BT.phase === "cmd" &&
    BT.menu === "target" &&
    BT.pend.tk !== "enemy"
  ) {
    const p = S.party[i],
      ok = BT.pend.tk === "dead" ? p.hp <= 0 : p.hp > 0;
    if (ok) commit({ ...BT.pend, t: i });
  }
});
mini.addEventListener("click", toggleMap);
mini.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    toggleMap();
  }
});
$("newbtn").addEventListener("click", () => {
  if (mode === "battle") return;
  mode = "confirm";
  renderAll();
});
const KEYS = {
  w: "f",
  arrowup: "f",
  s: "b",
  arrowdown: "b",
  a: "tl",
  arrowleft: "tl",
  d: "tr",
  arrowright: "tr",
  q: "l",
  e: "r",
  " ": "w",
};
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (mode === "member" && KEYS[k]) {
    mode = "explore";
    renderAll();
  }
  if (mode === "explore") {
    if (k === "m") {
      e.preventDefault();
      toggleMap();
      return;
    }
    if (KEYS[k]) {
      e.preventDefault();
      if (!e.repeat || !anim) input(KEYS[k]);
    }
    return;
  }
  if (/^[1-9]$/.test(k)) {
    const bs = panel.querySelectorAll(".menu button[data-a]"),
      b = bs[+k - 1];
    if (b && !b.disabled) {
      e.preventDefault();
      b.click();
    }
    return;
  }
  if (k === "escape" || k === "backspace") {
    const b = panel.querySelector("button[data-back]");
    if (b) {
      e.preventDefault();
      b.click();
    }
  }
});
// Block text selection and image/element dragging anywhere in the game
addEventListener("selectstart", (e) => e.preventDefault());
addEventListener("dragstart", (e) => e.preventDefault());
addEventListener("pagehide", () => {
  if (mode !== "battle") save();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode !== "battle") save();
});

function intro() {
  log("Your party makes camp at the edge of Ashfield Meadows.");
  log("Monsters roam in plain sight. Go around them, or walk into them to strike first.");
  log(
    "A cellar door lies in the rocks to the east. A sealed gate waits in the south-east.",
    "gold",
  );
}
buildCards();
const saved = load();
S = saved || fresh();
if (saved) {
  log("Welcome back. Your journey continues.");
} else intro();
fstate(S.floor);
syncCam();
renderAll();
const d0 = DEFS[S.floor];
banner(d0.kind === "field" ? "Overworld" : d0.sub, d0.name);
requestAnimationFrame(loop);
