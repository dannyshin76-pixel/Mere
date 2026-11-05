"use strict";
/* ---------------- battle ---------------- */
function startBattle(e, first) {
  if (mode !== "explore" || BT) return;
  mode = "battle";
  queued = null;
  pendingBattle = null;
  bigMap = false;
  mini.classList.remove("big");
  const ens = e.group.map((t) => {
    const b = EN[t];
    return {
      type: t,
      name: b.name,
      hp: b.hp,
      max: b.hp,
      atk: b.atk,
      def: b.def,
      spd: b.spd,
      flash: -1e9,
      lunge: -1e9,
      dieT: 0,
    };
  });
  const tally = {},
    seen = {};
  ens.forEach((x) => (tally[x.type] = (tally[x.type] || 0) + 1));
  ens.forEach((x) => {
    if (tally[x.type] > 1) {
      seen[x.type] = (seen[x.type] || 0) + 1;
      x.name += " " + "ABCDE"[seen[x.type] - 1];
    }
  });
  BT = {
    src: e,
    enemies: ens,
    cmd: [],
    idx: 0,
    menu: "main",
    round: 1,
    first,
    phase: "cmd",
    fx: [],
    wall: false,
    pend: null,
    boss: !!e.boss,
  };
  if (e.boss) log(`${EN[e.group[0]].name} rises to meet you!`, "bad");
  else if (first === "party")
    log(
      `You catch ${groupName(e)
        .replace(/^A /, "a ")
        .replace(/^Two/, "two")
        .replace(/^Three/, "three")} off guard!`,
      "good",
    );
  else log(`${groupName(e)} ${e.group.length > 1 ? "attack" : "attacks"}!`, "bad");
  beginRound();
}
const nextActor = (from) => {
  for (let i = from + 1; i < 4; i++) if (S.party[i].hp > 0) return i;
  return -1;
};
function beginRound() {
  BT.cmd = [];
  BT.phase = "cmd";
  BT.menu = "main";
  BT.pend = null;
  BT.idx = nextActor(-1);
  S.party.forEach((m) => (m.guard = false));
  BT.wall = false;
  renderAll();
}
const learned = (m) => Object.entries(SKILLS).filter(([k, s]) => s.cls === m.cls && m.lv >= s.lv);
const physDmg = (atk, def, mult = 1) =>
  Math.max(1, Math.round(atk * (0.85 + rnd() * 0.3) * mult - def * 0.5));
const magDmg = (mag, def, mult) =>
  Math.max(1, Math.round(mag * mult * (0.9 + rnd() * 0.2) - def * 0.25));
function hurtEnemy(e, dmg, crit) {
  e.hp = Math.max(0, e.hp - dmg);
  const now = performance.now();
  e.flash = now;
  BT.fx.push({
    e,
    text: String(dmg) + (crit ? "!" : ""),
    col: crit ? "#f8c048" : "#ffffff",
    t0: now,
  });
  if (e.hp === 0) {
    e.dieT = now;
    return ` ${e.name} is defeated.`;
  }
  return "";
}
function hurtMember(i, dmg) {
  const m = S.party[i];
  m.hp = Math.max(0, m.hp - dmg);
  floatOn(i, "-" + dmg, "var(--hp)");
  renderParty();
}
function healMember(i, a) {
  const m = S.party[i];
  a = Math.min(a, stat(m, "mhp") - m.hp);
  m.hp += a;
  floatOn(i, "+" + a, "var(--good)");
  return a;
}
const foe = (i) => {
  let e = BT.enemies[i];
  if (!e || e.hp <= 0) e = BT.enemies.find((x) => x.hp > 0);
  return e;
};
async function partyAct(c) {
  const m = S.party[c.actor];
  if (m.hp <= 0 || c.kind === "defend" || c.kind === "run") return;
  if (c.kind === "attack") {
    const e = foe(c.t);
    if (!e) return;
    const crit = rnd() < (m.cls === "rogue" ? 0.2 : 0.08);
    const d = physDmg(stat(m, "atk"), e.def, crit ? 1.6 : 1);
    const x = hurtEnemy(e, d, crit);
    log(`${m.name} ${crit ? "lands a critical hit on" : "hits"} ${e.name} for ${d}.${x}`);
    await sleep(520);
    return;
  }
  if (c.kind === "item") {
    const id = c.item;
    let i = c.t,
      t = S.party[i];
    if (id === "feather") {
      if (t.hp > 0) {
        S.items.feather++;
        log(`${t.name} is already standing. The feather is saved.`);
        await sleep(300);
        return;
      }
      t.hp = Math.max(1, Math.round(stat(t, "mhp") * 0.4));
      floatOn(i, "+" + t.hp, "var(--good)");
      log(`${m.name} uses an Ember Feather. ${t.name} rises!`, "good");
    } else {
      if (t.hp <= 0) {
        S.items[id]++;
        log(`${t.name} has fallen. The ${ITEMS[id].name} is saved.`);
        await sleep(300);
        return;
      }
      if (id === "potion") {
        const a = healMember(i, 50);
        log(
          `${m.name} gives ${t.name === m.name ? "themself" : t.name} a Potion: +${a} HP.`,
          "good",
        );
      } else {
        const a = Math.min(20, stat(t, "mmp") - t.mp);
        t.mp += a;
        floatOn(i, "+" + a, "var(--mp)");
        log(
          `${m.name} uses an Ether on ${t.name === m.name ? "themself" : t.name}: +${a} MP.`,
          "good",
        );
      }
    }
    await sleep(480);
    return;
  }
  if (c.kind === "skill") {
    const sk = SKILLS[c.skill];
    if (c.skill === "wall") return;
    if (m.mp < sk.mp) {
      log(`${m.name} lacks the MP for ${sk.name}.`);
      await sleep(350);
      return;
    }
    m.mp -= sk.mp;
    renderParty();
    const atk = stat(m, "atk"),
      mag = stat(m, "mag");
    switch (c.skill) {
      case "cleave": {
        let s = `${m.name} cleaves through the line:`;
        for (const e of BT.enemies)
          if (e.hp > 0) {
            const d = physDmg(atk, e.def, 0.75);
            s += ` ${e.name} ${d}.`;
            s += hurtEnemy(e, d);
          }
        log(s);
        break;
      }
      case "backstab": {
        const e = foe(c.t);
        if (!e) break;
        const d = physDmg(atk, 0, 1.9);
        const x = hurtEnemy(e, d, true);
        log(`${m.name} backstabs ${e.name} for ${d}.${x}`);
        break;
      }
      case "flurry": {
        const e0 = foe(c.t);
        if (!e0) break;
        let tot = 0,
          x = "";
        for (let k = 0; k < 3; k++) {
          const e = foe(c.t);
          if (!e) break;
          const d = physDmg(atk, e.def, 0.62);
          tot += d;
          x += hurtEnemy(e, d);
          await sleep(140);
        }
        log(`${m.name}’s flurry deals ${tot}.${x}`);
        break;
      }
      case "fire": {
        const e = foe(c.t);
        if (!e) break;
        const d = magDmg(mag, e.def, 1.7);
        const x = hurtEnemy(e, d);
        log(`${m.name}’s Firebolt scorches ${e.name} for ${d}.${x}`);
        break;
      }
      case "frost": {
        let s = `${m.name} casts Frost Nova:`;
        for (const e of BT.enemies)
          if (e.hp > 0) {
            const d = magDmg(mag, e.def, 1.05);
            s += ` ${e.name} ${d}.`;
            s += hurtEnemy(e, d);
          }
        log(s);
        break;
      }
      case "mend": {
        let i = c.t;
        if (S.party[i].hp <= 0) {
          const al = alive().sort((a, b) => a.hp / stat(a, "mhp") - b.hp / stat(b, "mhp"));
          if (!al.length) break;
          i = S.party.indexOf(al[0]);
        }
        const a = healMember(i, Math.round(mag * 2.2 + 12));
        log(`${m.name} mends ${S.party[i].name}: +${a} HP.`, "good");
        break;
      }
      case "prayer": {
        let tot = 0;
        S.party.forEach((p, i) => {
          if (p.hp > 0) tot += healMember(i, Math.round(mag * 1.3 + 8));
        });
        log(`${m.name}’s Prayer heals the party for ${tot} HP in all.`, "good");
        break;
      }
      case "raise": {
        const t = S.party[c.t];
        if (t.hp > 0) {
          m.mp += sk.mp;
          log(`${t.name} is already standing.`);
          break;
        }
        t.hp = Math.max(1, Math.round(stat(t, "mhp") * 0.4));
        floatOn(c.t, "+" + t.hp, "var(--good)");
        log(`${m.name} raises ${t.name}!`, "good");
        break;
      }
    }
    renderParty();
    await sleep(560);
  }
}
function pickTarget() {
  const al = alive(),
    wt = { knight: 3, rogue: 2, mage: 1.5, cleric: 1.5 };
  let tot = 0;
  for (const m of al) tot += wt[m.cls];
  let r = rnd() * tot;
  for (const m of al) {
    r -= wt[m.cls];
    if (r <= 0) return m;
  }
  return al[0];
}
function guardDmg(m, d) {
  if (m.guard) d *= 0.5;
  if (BT.wall) d *= 0.5;
  return Math.max(1, Math.round(d));
}
async function enemyAct(e) {
  if (e.hp <= 0 || !alive().length) return;
  const def = EN[e.type];
  e.lunge = performance.now();
  if (def.special && rnd() < (def.boss ? 0.32 : 0.25)) {
    const nm = {
      wail: "lets out a chilling wail",
      breath: "exhales a cloud of choking spores",
      doom: "speaks a word of ruin",
    }[def.special];
    let s = `${e.name} ${nm}!`;
    S.party.forEach((m, i) => {
      if (m.hp > 0) {
        const d = guardDmg(m, physDmg(e.atk, stat(m, "def"), def.special === "doom" ? 0.75 : 0.6));
        hurtMember(i, d);
        if (m.hp <= 0) s += ` ${m.name} falls!`;
      }
    });
    log(s, "bad");
    await sleep(700);
    return;
  }
  const t = pickTarget(),
    i = S.party.indexOf(t),
    d = guardDmg(t, physDmg(e.atk, stat(t, "def")));
  hurtMember(i, d);
  log(`${e.name} hits ${t.name} for ${d}.${t.hp <= 0 ? ` ${t.name} falls!` : ""}`, "bad");
  await sleep(540);
}
async function resolve() {
  BT.phase = "resolve";
  renderAll();
  const acts = BT.cmd.slice();
  for (const c of acts) {
    const m = S.party[c.actor];
    if (c.kind === "defend") {
      m.guard = true;
      log(`${m.name} braces for the blow.`);
    }
    if (c.kind === "skill" && c.skill === "wall") {
      if (m.mp >= 5) {
        m.mp -= 5;
        BT.wall = true;
        log(`${m.name} raises a shield wall. Damage is halved this round.`, "good");
      }
    }
  }
  renderParty();
  const run = acts.find((c) => c.kind === "run");
  let order = [];
  if (run) {
    await sleep(300);
    const ps = alive().reduce((a, m) => a + stat(m, "spd"), 0) / Math.max(1, alive().length),
      es =
        BT.enemies.filter((e) => e.hp > 0).reduce((a, e) => a + e.spd, 0) /
        Math.max(1, BT.enemies.filter((e) => e.hp > 0).length);
    const ch = clamp(0.55 + (ps - es) * 0.04, 0.25, 0.9);
    if (rnd() < ch) {
      log("The party slips away.", "good");
      BT.src.stun = 4;
      BT.src.alert = false;
      endBattle();
      return;
    }
    log("No escape! The enemies close in.", "bad");
    await sleep(350);
  } else order = acts.map((c) => ({ c, s: stat(S.party[c.actor], "spd") + rnd() * 4 }));
  const free = BT.round === 1 && BT.first === "party";
  if (!free)
    BT.enemies.forEach((e) => {
      if (e.hp > 0) {
        order.push({ e, s: e.spd + rnd() * 4 });
        if (e.type === "king") order.push({ e, s: e.spd / 2 + rnd() * 4 });
      }
    });
  order.sort((a, b) => b.s - a.s);
  for (const o of order) {
    if (o.c) await partyAct(o.c);
    else await enemyAct(o.e);
    renderParty();
    if (await checkEnd()) return;
  }
  BT.round++;
  beginRound();
}
async function checkEnd() {
  if (BT.enemies.every((e) => e.hp <= 0)) {
    await sleep(450);
    victory();
    return true;
  }
  if (!alive().length) {
    await sleep(500);
    log("The party has fallen.", "bad");
    mode = "over";
    BT = null;
    renderAll();
    return true;
  }
  return false;
}
function levelUp(m) {
  const oh = stat(m, "mhp"),
    om = stat(m, "mmp");
  m.lv++;
  m.hp += stat(m, "mhp") - oh;
  m.mp += stat(m, "mmp") - om;
  let s = `${m.name} reaches level ${m.lv}!`;
  for (const [k, sk] of Object.entries(SKILLS))
    if (sk.cls === m.cls && sk.lv === m.lv) s += ` Learned ${sk.name}.`;
  log(s, "gold");
}
function victory() {
  const xp = BT.enemies.reduce((a, e) => a + EN[e.type].xp, 0),
    gold = BT.enemies.reduce((a, e) => a + EN[e.type].gold, 0);
  S.gold += gold;
  log(`Victory! ${xp} XP and ${gold} gold.`, "gold");
  for (const m of S.party)
    if (m.hp > 0) {
      m.xp += xp;
      while (m.xp >= xpNext(m.lv)) {
        m.xp -= xpNext(m.lv);
        levelUp(m);
      }
    }
  const fs = fstate(S.floor);
  fs.enemies = fs.enemies.filter((x) => x !== BT.src);
  let end = false;
  if (BT.src.boss) {
    S.flags["boss_" + S.floor] = true;
    if (S.floor === "A2") {
      S.flags.sunKey = true;
      log("The Moss Wyrm collapses. In its coils lies a brass Sun Key.", "gold");
      log("The sealed gate in the south-east of the meadows should open now.", "gold");
    }
    if (S.floor === "B3") {
      S.flags.won = true;
      end = true;
    }
  }
  endBattle();
  if (end) {
    mode = "ending";
    banner("Victory", "The Hollow King is no more");
    renderAll();
  }
}
function endBattle() {
  BT = null;
  mode = "explore";
  save();
  renderAll();
}
function wake() {
  S.gold = Math.floor(S.gold / 2);
  for (const m of S.party) {
    m.hp = stat(m, "mhp");
    m.mp = stat(m, "mmp");
  }
  for (const k in S.floors) S.floors[k].enemies = spawnList(k);
  mode = "explore";
  log("You wake at camp. Half your gold is gone.", "bad");
  goFloor("field", START.x, START.y, START.dir);
}
