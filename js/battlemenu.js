"use strict";
/* ---------------- battle menu (viewport overlay), targeting, command queue ---------------- */
function battleSummary() {
  if (BT.phase !== "cmd") return `<h2>Round ${BT.round}</h2><p>The fight plays out…</p>`;
  const m = S.party[BT.idx];
  return `<h2>Round ${BT.round}</h2><p>${m.name} is choosing. Pick commands in the battle view, or tap an enemy to attack it.</p>`;
}
function battleMenu() {
  if (BT.phase !== "cmd") return "";
  const m = S.party[BT.idx];
  let h = `<div class="who">${m.name} <small>${CLASSES[m.cls].title} · ${m.mp} MP</small></div>`;
  const first = BT.idx === nextActor(-1);
  if (BT.menu === "main") {
    h += `<div class="menu cmdbar">${btn("cmd", "attack", "Attack")}${btn("cmd", "skill", "Skills")}${btn("cmd", "item", "Items")}${btn("cmd", "defend", "Defend")}
    ${first ? btn("cmd", "run", BT.boss ? "Run (blocked)" : "Run", { dis: BT.boss }) : ""}${BT.cmd.length ? btn("bk", null, "Back", { back: 1 }) : ""}</div>`;
  } else if (BT.menu === "skill") {
    h += `<div class="menu one list">${learned(m)
      .map(([k, s]) =>
        btn("sk", k, `${s.name} <small>${s.mp} MP · ${s.desc}</small>`, {
          cls: "row",
          dis: m.mp < s.mp,
        }),
      )
      .join("")}${btn("bk", null, "Back", { back: 1 })}</div>`;
  } else if (BT.menu === "item") {
    h += `<div class="menu one list">${Object.entries(ITEMS)
      .map(([k, v]) =>
        btn("it", k, `${v.name} <small>${S.items[k]} · ${v.desc}</small>`, {
          cls: "row",
          dis: S.items[k] <= 0 || (v.tk === "dead" && !S.party.some((p) => p.hp <= 0)),
        }),
      )
      .join("")}${btn("bk", null, "Back", { back: 1 })}</div>`;
  } else if (BT.menu === "target") {
    const tk = BT.pend.tk;
    if (tk === "enemy") {
      h = h.replace("</div>", ` · <span class="tip">tap an enemy</span></div>`);
      h += `<div class="menu cmdbar">`;
      BT.enemies.forEach((e, i) => {
        if (e.hp > 0) h += btn("tg", i, e.name);
      });
    } else {
      h += `<div class="menu one list">`;
      S.party.forEach((p, i) => {
        const ok = tk === "dead" ? p.hp <= 0 : p.hp > 0;
        if (ok)
          h += btn("tg", i, `${p.name} <small>${p.hp}/${stat(p, "mhp")} HP · ${p.mp} MP</small>`, {
            cls: "row",
          });
      });
    }
    h += btn("bk", null, "Back", { back: 1 }) + "</div>";
  }
  return h;
}
const bmenu = $("bmenu");
function renderBattleMenu() {
  const on = mode === "battle" && BT && BT.phase === "cmd";
  bmenu.hidden = !on;
  cv.parentElement.classList.toggle("inbattle", mode === "battle");
  bmenu.innerHTML = on ? battleMenu() : "";
  if (!on) return;
  let n = 1;
  bmenu.querySelectorAll("button[data-a]").forEach((b) => {
    if (!b.dataset.back) b.insertAdjacentHTML("afterbegin", `<span class="k">${n}</span>`);
    n++;
  });
  // Keep enemies clear of a one-row menu; taller lists just cover the scene
  if (bmenu.querySelector(".cmdbar")) BT.reserve = (bmenu.offsetHeight / cv.clientHeight) * H;
}
// Tap an enemy in the view: attack it, or pick it as the target
function battleTap(clientX, clientY) {
  if (mode !== "battle" || !BT || BT.phase !== "cmd") return;
  const r = cv.getBoundingClientRect(),
    x = ((clientX - r.left) / r.width) * W,
    y = ((clientY - r.top) / r.height) * H;
  const i = BT.enemies.findIndex(
    (e) =>
      e.hp > 0 &&
      e.box &&
      x >= e.box.x &&
      x <= e.box.x + e.box.w &&
      y >= e.box.y &&
      y <= e.box.y + e.box.h,
  );
  if (i < 0) return;
  if (BT.menu === "target" && BT.pend.tk === "enemy") commit({ ...BT.pend, t: i });
  else if (BT.menu === "main") commit({ kind: "attack", tk: "enemy", from: "main", t: i });
}
function needTarget(pend) {
  BT.pend = pend;
  const tk = pend.tk;
  if (tk === "enemy") {
    const al = BT.enemies.map((e, i) => (e.hp > 0 ? i : -1)).filter((i) => i >= 0);
    if (al.length === 1) {
      commit({ ...pend, t: al[0] });
      return;
    }
  }
  if (tk === "enemies" || tk === "none") {
    commit(pend);
    return;
  }
  BT.menu = "target";
  renderAll();
}
function battleCmd(v) {
  const m = S.party[BT.idx];
  if (v === "attack") needTarget({ kind: "attack", tk: "enemy", from: "main" });
  else if (v === "skill") {
    BT.menu = "skill";
    renderAll();
  } else if (v === "item") {
    BT.menu = "item";
    renderAll();
  } else if (v === "defend") commit({ kind: "defend" });
  else if (v === "run") commit({ kind: "run" });
}
function commit(c) {
  c.actor = BT.idx;
  if (c.kind === "item") S.items[c.item]--;
  BT.cmd.push(c);
  BT.menu = "main";
  BT.pend = null;
  if (c.kind === "run") {
    resolve();
    return;
  }
  const n = nextActor(BT.idx);
  if (n < 0) resolve();
  else {
    BT.idx = n;
    renderAll();
  }
}
function back() {
  if (BT.phase !== "cmd") return;
  if (BT.menu === "target") {
    BT.menu = BT.pend.from;
    BT.pend = null;
  } else if (BT.menu !== "main") BT.menu = "main";
  else if (BT.cmd.length) {
    const c = BT.cmd.pop();
    if (c.kind === "item") S.items[c.item]++;
    BT.idx = c.actor;
  }
  renderAll();
}
