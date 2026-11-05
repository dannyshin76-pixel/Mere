"use strict";
/* ---------------- render ---------------- */
let FR = 0,
  FG = 0,
  FB = 0,
  frame = 0,
  SEEN = null,
  seenKey = "";
function shade(c, L, m) {
  const k = L * m,
    j = 1 - L;
  return (
    (0xff000000 |
      ((((c >> 16) & 255) * k + FB * j) << 16) |
      ((((c >> 8) & 255) * k + FG * j) << 8) |
      ((c & 255) * k + FR * j)) >>>
    0
  );
}
function wallTex(F, c) {
  const d = DEFS[F.key];
  switch (c) {
    case 1:
      return TX.hedge;
    case 2:
      return TX.rock;
    case 10:
      return TX.gateA;
    case 11:
      return S.flags.sunKey ? TX.gateBo : TX.gateB;
    case 12:
      return TX[d.tex.down];
    case 13:
      return TX[d.tex.up];
    default:
      return d.tex ? TX[d.tex.w] : TX.rock;
  }
}
function render(now) {
  frame++;
  const F = cur(),
    d = DEFS[S.floor],
    g = F.grid,
    w = F.w,
    h = F.h,
    ex = exp(S.floor);
  if (seenKey !== S.floor || !SEEN || SEEN.length !== w * h) {
    SEEN = new Int32Array(w * h);
    seenKey = S.floor;
  }
  const px = camX,
    py = camY,
    dX = Math.cos(camA),
    dY = Math.sin(camA),
    plX = -dY * 0.66,
    plY = dX * 0.66,
    field = d.kind === "field";
  [FR, FG, FB] = d.fog;
  let maxD = d.maxD;
  if (!field) maxD *= 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37);
  const inv = 1 / maxD;
  const r0x = dX - plX,
    r0y = dY - plY,
    r1x = dX + plX,
    r1y = dY + plY,
    ftex = field ? null : TX[d.floorTex],
    ctex = field ? null : TX[d.ceilTex],
    wo = (now / 140) | 0;
  for (let y = HH; y < H; y++) {
    const rd = HH / (y - HH + 0.5),
      sx = (rd * (r1x - r0x)) / W,
      sy = (rd * (r1y - r0y)) / W;
    let fx = px + rd * r0x,
      fy = py + rd * r0y;
    let L = 1 - rd * inv;
    if (L < 0) L = 0;
    const row = y * W,
      crow = (H - 1 - y) * W;
    for (let x = 0; x < W; x++) {
      const ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = ((fx - ix) * T) | 0,
        ty = ((fy - iy) * T) | 0;
      if (field) {
        const c = ix >= 0 && iy >= 0 && ix < w && iy < h ? g[iy * w + ix] : 0;
        buf[row + x] =
          c === 3
            ? shade(TX.water[ty * T + ((tx + wo) & 31)], L, 1)
            : shade(TX.grass[ty * T + tx], L, 1);
      } else {
        buf[row + x] = shade(ftex[ty * T + tx], L, 1);
        buf[crow + x] = shade(ctex[ty * T + tx], L, 0.85);
      }
      fx += sx;
      fy += sy;
    }
  }
  if (field) {
    const TAU = Math.PI * 2;
    for (let x = 0; x < W; x++) {
      const a = camA + Math.atan(((2 * x) / W - 1) * 0.66);
      const u = (((((a / TAU) % 1) + 1) % 1) * SKYW) | 0;
      for (let y = 0; y < HH; y++) buf[y * W + x] = SKY[y * SKYW + u];
    }
  }
  const pi = Math.floor(py) * w + Math.floor(px);
  if (pi >= 0 && pi < ex.length) {
    ex[pi] = 1;
    SEEN[pi] = frame;
  }
  for (let x = 0; x < W; x++) {
    const cm = (2 * x) / W - 1,
      rx = dX + plX * cm,
      ry = dY + plY * cm;
    let mx = Math.floor(px),
      my = Math.floor(py);
    const ddx = Math.abs(1 / rx),
      ddy = Math.abs(1 / ry);
    let stX, stY, sdx, sdy;
    if (rx < 0) {
      stX = -1;
      sdx = (px - mx) * ddx;
    } else {
      stX = 1;
      sdx = (mx + 1 - px) * ddx;
    }
    if (ry < 0) {
      stY = -1;
      sdy = (py - my) * ddy;
    } else {
      stY = 1;
      sdy = (my + 1 - py) * ddy;
    }
    let side = 0,
      c = 0,
      n = 0;
    while (n++ < 80) {
      if (sdx < sdy) {
        sdx += ddx;
        mx += stX;
        side = 0;
      } else {
        sdy += ddy;
        my += stY;
        side = 1;
      }
      if (mx < 0 || my < 0 || mx >= w || my >= h) {
        c = field ? 1 : d.wall;
        break;
      }
      const i = my * w + mx;
      c = g[i];
      const pd = side === 0 ? sdx - ddx : sdy - ddy;
      if (pd < 9) {
        ex[i] = 1;
        SEEN[i] = frame;
      }
      if (WALLS[c]) break;
    }
    const perp = Math.max(0.001, side === 0 ? sdx - ddx : sdy - ddy);
    zbuf[x] = perp;
    const lh = H / perp,
      y0 = HH - lh / 2;
    let wx = side === 0 ? py + perp * ry : px + perp * rx;
    wx -= Math.floor(wx);
    let tx = (wx * T) | 0;
    if (side === 0 && rx > 0) tx = T - 1 - tx;
    if (side === 1 && ry < 0) tx = T - 1 - tx;
    const tex = wallTex(F, c);
    let L = 1 - perp * inv;
    if (L < 0) L = 0;
    const sm = side === 1 ? 0.78 : 1;
    const ys = Math.max(0, Math.ceil(y0)),
      ye = Math.min(H - 1, Math.floor(HH + lh / 2)),
      stp = T / lh;
    let tp = (ys - y0) * stp;
    for (let y = ys; y <= ye; y++) {
      buf[y * W + x] = shade(tex[((tp | 0) & 31) * T + tx], L, sm);
      tp += stp;
    }
  }
  // sprites
  const sps = [],
    fs = fstate(S.floor);
  for (const t of F.trees) sps.push({ x: t.x + 0.5, y: t.y + 0.5, s: SPR.tree, h: 1.45, lift: 0 });
  for (const o of F.objs)
    sps.push({ x: o.x + 0.5, y: o.y + 0.5, s: SPR.camp, h: 0.42, lift: 0, glow: 1 });
  for (const c of F.chests)
    if (!fs.opened[c.id]) sps.push({ x: c.x + 0.5, y: c.y + 0.5, s: SPR.chest, h: 0.3, lift: 0 });
  const ux = plX / 0.66,
    uy = plY / 0.66;
  for (const e of fs.enemies) {
    if (BT && BT.src === e) continue;
    if (e.rx === undefined) {
      e.rx = e.x;
      e.ry = e.y;
    }
    const n = e.group.length,
      gs = n > 1 ? 0.82 : 1;
    e.group.forEach((t, k) => {
      const def = EN[t],
        off = (k - (n - 1) / 2) * 0.3,
        bob = def.lift ? Math.sin(now / 170 + k * 2 + e.x) * 0.04 : 0;
      sps.push({
        x: e.rx + 0.5 + ux * off + dX * k * 0.02,
        y: e.ry + 0.5 + uy * off + dY * k * 0.02,
        s: SPR[t],
        h: def.scale * gs,
        lift: (def.lift || 0) + bob,
      });
    });
    if (e.alert) {
      const top = Math.max(...e.group.map((t) => (EN[t].lift || 0) + EN[t].scale * gs));
      sps.push({
        x: e.rx + 0.5 - dX * 0.05,
        y: e.ry + 0.5 - dY * 0.05,
        s: SPR.alert,
        h: 0.13,
        lift: top + 0.05,
        glow: 1,
      });
    }
  }
  for (const s of sps) s.d = (s.x - px) ** 2 + (s.y - py) ** 2;
  sps.sort((a, b) => b.d - a.d);
  const invDet = 1 / (plX * dY - dX * plY);
  for (const s of sps) {
    if (s.hideIf) continue;
    const sx = s.x - px,
      sy = s.y - py,
      tX = invDet * (dY * sx - dX * sy),
      tY = invDet * (-plY * sx + plX * sy);
    if (tY < 0.2) continue;
    const scr = (W / 2) * (1 + tX / tY),
      unit = H / tY,
      hg = unit * s.h,
      wd = (hg * s.s.w) / s.s.h,
      bottom = HH + unit / 2 - s.lift * unit,
      top = bottom - hg,
      left = scr - wd / 2;
    const x0 = Math.max(0, Math.ceil(left)),
      x1 = Math.min(W - 1, Math.floor(scr + wd / 2)),
      y0 = Math.max(0, Math.ceil(top)),
      y1 = Math.min(H - 1, Math.floor(bottom));
    let L = s.glow ? 1 : 1 - tY * inv;
    if (L < 0) L = 0;
    if (L <= 0.01 && !field) continue;
    const sw = s.s.w,
      sh = s.s.h,
      sd = s.s.d;
    for (let x = x0; x <= x1; x++) {
      if (tY >= zbuf[x]) continue;
      const u = Math.min(sw - 1, (((x - left) / wd) * sw) | 0);
      for (let y = y0; y <= y1; y++) {
        const v = Math.min(sh - 1, (((y - top) / hg) * sh) | 0),
          c = sd[v * sw + u];
        if (c >>> 24 < 128) continue;
        buf[y * W + x] = shade(c, L, 1);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (BT) drawBattle(now);
}
function drawBattle(now) {
  ctx.fillStyle = "rgba(12,9,16,.62)";
  ctx.fillRect(0, 0, W, H);
  const n = BT.enemies.length,
    feet = H - 24 - (BT.reserve || 0),
    shrink = Math.min(1, (feet - 18) / 158);
  const sizes = BT.enemies.map((e) => {
    const sp = SPR[e.type],
      bh = Math.min(158, 40 + 120 * EN[e.type].scale) * shrink;
    return { bh, bw: (bh * sp.w) / sp.h };
  });
  const totalW = sizes.reduce((a, s) => a + s.bw, 0),
    fit = Math.min(1, (W - 24) / (totalW + (n - 1) * 10));
  let xcur = (W - (totalW * fit + (n - 1) * 10)) / 2;
  BT.enemies.forEach((e, i) => {
    const def = EN[e.type],
      sp = SPR[e.type],
      bw = sizes[i].bw * fit,
      bh = sizes[i].bh * fit,
      cx = xcur + bw / 2;
    xcur += bw + 10;
    const lift = def.lift ? def.lift * 70 + Math.sin(now / 170 + i * 2) * 4 : 0;
    let ox = 0,
      oy = 0;
    if (now - e.flash < 260) ox = Math.sin((now - e.flash) / 16) * 3;
    if (now - e.lunge < 280) oy = Math.sin(((now - e.lunge) / 280) * Math.PI) * 6;
    let a = 1;
    if (e.hp <= 0) {
      a = Math.max(0, 1 - (now - e.dieT) / 450);
      if (a <= 0) return;
    }
    const top = feet - bh - lift + oy;
    e.sx = cx;
    e.sy = top;
    const hw = Math.max(bw, 44) / 2;
    e.box = {
      x: cx - hw,
      y: Math.min(top, feet - 44),
      w: hw * 2,
      h: feet + 22 - Math.min(top, feet - 44),
    };
    ctx.globalAlpha = a;
    ctx.drawImage(now - e.flash < 110 ? sp.fl : sp.c, cx - bw / 2 + ox, top, bw, bh);
    ctx.globalAlpha = 1;
    if (e.hp > 0) {
      ctx.fillStyle = "#0b0910";
      ctx.fillRect(cx - 18, feet + 8, 36, 4);
      ctx.fillStyle = "#d0594b";
      ctx.fillRect(cx - 18, feet + 8, (36 * e.hp) / e.max, 4);
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "#ece3cf";
      ctx.fillText(e.name, cx, feet + 20);
    }
    if (
      BT.phase === "cmd" &&
      BT.menu === "target" &&
      BT.pend &&
      BT.pend.tk === "enemy" &&
      e.hp > 0
    ) {
      const idx = BT.enemies.filter((x, j) => x.hp > 0 && j <= i).length;
      ctx.fillStyle = "#d2a650";
      ctx.beginPath();
      ctx.moveTo(cx - 5, top - 12);
      ctx.lineTo(cx + 5, top - 12);
      ctx.lineTo(cx, top - 5);
      ctx.fill();
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillText(String(idx), cx, top - 15);
    }
  });
  ctx.textAlign = "center";
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  BT.fx = BT.fx.filter((f) => now - f.t0 < 900);
  for (const f of BT.fx) {
    const k = (now - f.t0) / 900;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#000";
    ctx.fillText(f.text, (f.e.sx || W / 2) + 1, (f.e.sy || 80) + 21 - k * 18);
    ctx.fillStyle = f.col;
    ctx.fillText(f.text, f.e.sx || W / 2, (f.e.sy || 80) + 20 - k * 18);
  }
  ctx.globalAlpha = 1;
}
const MAPC = {
  0: "#332d3d",
  1: "#3c6b34",
  2: "#7a6f62",
  3: "#355a85",
  4: "#6b6079",
  5: "#5f6b4e",
  6: "#665a7e",
  7: "#2e5428",
  10: "#d2a650",
  11: "#d2a650",
  12: "#d2a650",
  13: "#e8e0c8",
};
function drawMap() {
  const F = cur(),
    ex = exp(S.floor),
    R = 6;
  const cs = bigMap ? Math.max(6, Math.floor(360 / Math.max(F.w, F.h))) : 8;
  const cw = bigMap ? F.w * cs : (R * 2 + 1) * cs,
    ch = bigMap ? F.h * cs : (R * 2 + 1) * cs;
  if (mini.width !== cw || mini.height !== ch) {
    mini.width = cw;
    mini.height = ch;
  }
  const ox = bigMap ? 0 : S.x - R,
    oy = bigMap ? 0 : S.y - R,
    nw = bigMap ? F.w : R * 2 + 1,
    nh = bigMap ? F.h : R * 2 + 1;
  mctx.fillStyle = "#0d0b11";
  mctx.fillRect(0, 0, cw, ch);
  for (let j = 0; j < nh; j++)
    for (let i = 0; i < nw; i++) {
      const x = ox + i,
        y = oy + j;
      if (!inB(F, x, y)) continue;
      const k = y * F.w + x;
      if (!ex[k]) continue;
      mctx.fillStyle = MAPC[F.grid[k]] || "#6b6079";
      mctx.fillRect(i * cs, j * cs, cs, cs);
    }
  const dot = (x, y, col, r) => {
    const i = x - ox,
      j = y - oy;
    if (i < 0 || j < 0 || i >= nw || j >= nh) return;
    if (!ex[y * F.w + x]) return;
    mctx.fillStyle = col;
    mctx.fillRect(i * cs + (cs - r) / 2, j * cs + (cs - r) / 2, r, r);
  };
  const fs = fstate(S.floor);
  for (const c of F.chests) if (!fs.opened[c.id]) dot(c.x, c.y, "#f0c860", cs * 0.6);
  for (const o of F.objs) dot(o.x, o.y, "#ff8a3c", cs * 0.7);
  for (const e of fs.enemies) {
    const k = e.y * F.w + e.x;
    if (SEEN[k] === frame || (e.boss && ex[k]))
      dot(e.x, e.y, e.alert ? "#ff5040" : "#c04a3e", cs * 0.7);
  }
  const pxm = (S.x - ox) * cs + cs / 2,
    pym = (S.y - oy) * cs + cs / 2,
    a = camA;
  mctx.fillStyle = "#ece3cf";
  mctx.beginPath();
  mctx.moveTo(pxm + Math.cos(a) * cs * 0.55, pym + Math.sin(a) * cs * 0.55);
  mctx.lineTo(pxm + Math.cos(a + 2.4) * cs * 0.45, pym + Math.sin(a + 2.4) * cs * 0.45);
  mctx.lineTo(pxm + Math.cos(a - 2.4) * cs * 0.45, pym + Math.sin(a - 2.4) * cs * 0.45);
  mctx.fill();
}
function toggleMap() {
  bigMap = !bigMap;
  mini.classList.toggle("big", bigMap);
  renderPanel();
}
