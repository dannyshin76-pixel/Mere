"use strict";
/* ---------------- log / UI ---------------- */
const lines = [];
function log(t, c) {
  lines.push({ t, c });
  while (lines.length > 7) lines.shift();
  logEl.innerHTML = lines.map((l) => `<div class="${l.c || ""}">${l.t}</div>`).join("");
}
let bannerT = 0;
function banner(sub, name) {
  const b = $("banner");
  b.innerHTML = `<small>${sub}</small>${name}`;
  b.classList.add("on");
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove("on"), 2200);
}
const cards = [];
S = null;
function buildCards() {
  partyEl.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button");
    b.className = "card";
    b.type = "button";
    b.dataset.m = i;
    b.innerHTML =
      '<div class="nm"><b></b><span></span></div><div class="bar hp"><i></i></div><div class="bar mp"><i></i></div><div class="nums"><span class="h"></span><span class="p"></span></div>';
    partyEl.appendChild(b);
    cards.push(b);
  }
}
function renderParty() {
  S.party.forEach((m, i) => {
    const c = cards[i],
      mh = stat(m, "mhp"),
      mm = stat(m, "mmp");
    c.querySelector("b").textContent = m.name;
    c.querySelector(".nm span").textContent = `${CLASSES[m.cls].title} · Lv ${m.lv}`;
    c.querySelector(".hp i").style.width = (100 * m.hp) / mh + "%";
    c.querySelector(".mp i").style.width = (100 * m.mp) / mm + "%";
    c.querySelector(".h").textContent = m.hp > 0 ? `HP ${m.hp}/${mh}` : "Fallen";
    c.querySelector(".p").textContent = `MP ${m.mp}/${mm}`;
    c.classList.toggle("ko", m.hp <= 0);
    c.classList.toggle(
      "active",
      (mode === "battle" && BT && BT.phase === "cmd" && BT.idx === i) ||
        (mode === "member" && selM === i),
    );
    c.setAttribute(
      "aria-label",
      `${m.name}, ${CLASSES[m.cls].title}, level ${m.lv}, HP ${m.hp} of ${mh}, MP ${m.mp} of ${mm}`,
    );
  });
}
function floatOn(i, text, color) {
  const c = cards[i];
  c.classList.remove("hit");
  void c.offsetWidth;
  if (color === "var(--hp)") c.classList.add("hit");
  const f = document.createElement("span");
  f.className = "float";
  f.style.color = color;
  f.textContent = text;
  c.appendChild(f);
  setTimeout(() => f.remove(), 950);
}
function renderHeader() {
  const d = DEFS[S.floor];
  $("loc").textContent = d.kind === "field" ? d.name : `${d.name} · ${d.sub}`;
  $("gold").textContent = S.gold;
  $("face").textContent = DN[S.dir];
}
const btn = (a, v, label, o = {}) =>
  `<button type="button" class="b ${o.cls || ""}" data-a="${a}" ${v != null ? `data-v="${v}"` : ""} ${o.dis ? "disabled" : ""} ${o.back ? 'data-back="1"' : ""}>${label}</button>`;
function renderPanel() {
  let h = "";
  if (mode === "explore") {
    h = `<div class="pad">${btn("mv", "tl", '<span aria-hidden="true">&#8630;</span> Turn')}${btn("mv", "f", '<span aria-hidden="true">&#8593;</span> Forward')}${btn("mv", "tr", 'Turn <span aria-hidden="true">&#8631;</span>')}
      ${btn("mv", "l", '<span aria-hidden="true">&#8592;</span> Step')}${btn("mv", "b", '<span aria-hidden="true">&#8595;</span> Back')}${btn("mv", "r", 'Step <span aria-hidden="true">&#8594;</span>')}
      ${btn("mv", "w", "Wait")}${btn("map", null, bigMap ? "Close map" : "Map")}${btn("mm", "0", "Party")}</div>
      <div class="hint">W / S forward and back · A / D turn · Q / E sidestep · Space wait · M map. On touch, swipe the view to walk and turn. Walk into a monster to strike first. Tap a party member to heal.</div>`;
  } else if (mode === "member") {
    const m = S.party[selM],
      cl = S.party[3],
      mh = stat(m, "mhp"),
      mm = stat(m, "mmp"),
      it = S.items;
    const g = m.gear.length ? m.gear.join(", ") : "Starting gear";
    h = `<h2>${m.name} <span class="k" style="font-family:var(--mono);font-size:12px;color:var(--dim)">${CLASSES[m.cls].title} · Lv ${m.lv} · ${m.xp}/${xpNext(m.lv)} XP</span></h2>
      <div class="stats"><div>ATK<b>${stat(m, "atk")}</b></div><div>DEF<b>${stat(m, "def")}</b></div><div>MAG<b>${stat(m, "mag")}</b></div><div>SPD<b>${stat(m, "spd")}</b></div></div>
      <p>${g}</p><div class="menu one">
      ${btn("use", "potion", `Potion <small>${it.potion} left</small>`, { cls: "row", dis: !(it.potion > 0 && m.hp > 0 && m.hp < mh) })}
      ${btn("use", "ether", `Ether <small>${it.ether} left</small>`, { cls: "row", dis: !(it.ether > 0 && m.hp > 0 && m.mp < mm) })}
      ${btn("use", "feather", `Ember Feather <small>${it.feather} left</small>`, { cls: "row", dis: !(it.feather > 0 && m.hp <= 0) })}
      ${btn("use", "mend", `Tamsin casts Mend <small>3 MP · ${cl.mp} left</small>`, { cls: "row", dis: !(cl.hp > 0 && cl.mp >= 3 && m.hp > 0 && m.hp < mh) })}
      ${cl.lv >= 3 ? btn("use", "raise", `Tamsin casts Raise <small>10 MP</small>`, { cls: "row", dis: !(cl.hp > 0 && cl.mp >= 10 && m.hp <= 0) }) : ""}
      ${btn("close", null, "Close", { back: 1 })}</div>`;
  } else if (mode === "camp") {
    const it = S.items;
    h = `<h2>Campfire</h2><p>Rest to restore the party and save. Monsters you defeated return to the wilds while you sleep.</p>
      <div class="menu one">${btn("rest", null, "Rest by the fire <small>free</small>", { cls: "row gold" })}
      ${Object.entries(ITEMS)
        .map(([k, v]) =>
          btn("buy", k, `Buy ${v.name} <small>${v.price}g · have ${it[k]}</small>`, {
            cls: "row",
            dis: S.gold < v.price,
          }),
        )
        .join("")}
      ${btn("close", null, "Leave camp", { back: 1 })}</div>`;
  } else if (mode === "battle") {
    h = battlePanel();
  } else if (mode === "over") {
    h = `<h2>The party has fallen</h2><p>You wake by the campfire, bruised and lighter of purse.</p><div class="menu one">${btn("wake", null, "Wake at camp")}</div>`;
  } else if (mode === "ending") {
    h = `<h2>The Hollow King is no more</h2><p>Light returns to the keep, and the meadows grow quiet. Your party can keep exploring, or start a new journey from the header.</p><div class="menu one">${btn("close", null, "Keep exploring")}</div>`;
  } else if (mode === "confirm") {
    h = `<h2>Start a new game?</h2><p>This erases your saved progress in this browser.</p><div class="menu">${btn("yesnew", null, "Start over")}${btn("close", null, "Cancel", { back: 1 })}</div>`;
  }
  panel.innerHTML = h;
  let n = 1;
  panel.querySelectorAll(".menu button[data-a]").forEach((b) => {
    if (mode === "battle" && !b.dataset.back) {
      b.insertAdjacentHTML("afterbegin", `<span class="k">${n}</span>`);
    }
    n++;
  });
}
function renderAll() {
  renderHeader();
  renderParty();
  renderPanel();
}
