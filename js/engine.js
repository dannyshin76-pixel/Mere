"use strict";
const W = 320,
  H = 200,
  HH = 100,
  T = 32;
const $ = (id) => document.getElementById(id);
const cv = $("view"),
  ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;
const img = ctx.createImageData(W, H),
  buf = new Uint32Array(img.data.buffer),
  zbuf = new Float32Array(W);
const mini = $("mini"),
  mctx = mini.getContext("2d");
const panel = $("panel"),
  logEl = $("log"),
  partyEl = $("party");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = Math.random;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pack(r, g, b) {
  return (
    ((255 << 24) |
      (clamp(b | 0, 0, 255) << 16) |
      (clamp(g | 0, 0, 255) << 8) |
      clamp(r | 0, 0, 255)) >>>
    0
  );
}
function hash2(x, y, s) {
  let h =
    (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s, p) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    m = (v) => ((v % p) + p) % p;
  const a = hash2(m(xi), m(yi), s),
    b = hash2(m(xi + 1), m(yi), s),
    c = hash2(m(xi), m(yi + 1), s),
    d = hash2(m(xi + 1), m(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------------- textures ---------------- */
function mk(fn) {
  const d = new Uint32Array(T * T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const c = fn(x, y);
      d[y * T + x] = pack(c[0], c[1], c[2]);
    }
  return d;
}
function brick(x, y, bh, bw, s) {
  const row = Math.floor(y / bh),
    off = row & 1 ? bw / 2 : 0,
    xx = x + off,
    bx = xx % bw,
    col = Math.floor(xx / bw) % (T / bw);
  return { m: y % bh === 0 || bx === 0, t: hash2(col, row, s) };
}
const stoneC = (x, y, s, c) => {
  const b = brick(x, y, 8, 16, s),
    n = vnoise(x / 4, y / 4, s + 1, 8);
  if (b.m) return [c[0] * 0.42, c[1] * 0.42, c[2] * 0.42];
  const k = 0.72 + b.t * 0.36 + n * 0.26;
  return [c[0] * k, c[1] * k, c[2] * k];
};
const TX = {};
TX.moss = mk((x, y) => {
  let c = stoneC(x, y, 3, [108, 102, 92]);
  const m = vnoise(x / 4, y / 4, 7, 8) * 0.7 + vnoise(x / 2, y / 2, 8, 16) * 0.3;
  if (m > 0.58) {
    const a = Math.min(1, (m - 0.58) * 4);
    c = [c[0] * (1 - a) + 62 * a, c[1] * (1 - a) + 100 * a, c[2] * (1 - a) + 46 * a];
  }
  return c;
});
TX.keep = mk((x, y) => stoneC(x, y, 5, [96, 84, 118]));
TX.hedge = mk((x, y) => {
  const n = vnoise(x / 4, y / 4, 5, 8),
    s = hash2(x, y, 9);
  let c = [34 + n * 36, 72 + n * 62, 34 + n * 26];
  if (s > 0.86) c = [c[0] + 30, c[1] + 42, c[2] + 18];
  if (s < 0.08) c = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
  return c;
});
TX.rock = mk((x, y) => {
  const n = vnoise(x / 8, y / 8, 11, 4) * 0.6 + vnoise(x / 4, y / 4, 12, 8) * 0.4;
  let c = [104 + n * 58, 96 + n * 52, 90 + n * 44];
  const cr = vnoise(x / 8, y / 4, 13, 4);
  if (Math.abs(cr - 0.5) < 0.035) c = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
  if (y < 3) c = [c[0] * 0.8 + 20, c[1] * 0.8 + 30, c[2] * 0.8 + 10];
  return c;
});
TX.grass = mk((x, y) => {
  const n = vnoise(x / 4, y / 4, 21, 8),
    s = hash2(x, y, 22);
  let c = [62 + n * 30, 104 + n * 44, 46 + n * 18];
  if (s > 0.9) c = [c[0] + 26, c[1] + 34, c[2] + 10];
  if (s < 0.07) c = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
  return c;
});
TX.water = mk((x, y) => {
  const w =
    Math.sin((x / T) * Math.PI * 4 + (y / T) * Math.PI * 2) + Math.sin((y / T) * Math.PI * 6);
  const n = vnoise(x / 4, y / 4, 31, 8);
  let c = [38 + n * 16, 72 + n * 22, 112 + n * 30];
  if (w > 1.4) c = [c[0] + 60, c[1] + 70, c[2] + 70];
  return c;
});
TX.flagA = mk((x, y) => {
  const b = brick(x, y, 16, 16, 41),
    n = vnoise(x / 4, y / 4, 42, 8);
  if (b.m) return [30, 28, 26];
  const k = 0.75 + b.t * 0.3 + n * 0.25;
  return [74 * k, 70 * k, 62 * k];
});
TX.ceilA = mk((x, y) => {
  const n = vnoise(x / 4, y / 4, 51, 8);
  let v = 34 + n * 16;
  if (x % 16 < 3) v *= 0.55;
  return [v * 1.05, v, v * 0.9];
});
TX.flagB = mk((x, y) => {
  const b = brick(x, y, 16, 16, 61),
    n = vnoise(x / 4, y / 4, 62, 8);
  if (b.m) return [26, 22, 32];
  const k = 0.75 + b.t * 0.3 + n * 0.25;
  return [68 * k, 60 * k, 80 * k];
});
TX.ceilB = mk((x, y) => {
  const n = vnoise(x / 4, y / 4, 71, 8);
  let v = 28 + n * 14;
  if (y % 16 < 3) v *= 0.55;
  return [v, v * 0.9, v * 1.15];
});
function archTex(border, inner, trim) {
  return mk((x, y) => {
    const inside =
      x >= 8 && x <= 23 && y >= 8 && (y >= 16 || (x - 15.5) ** 2 + (y - 16) ** 2 <= 64);
    const near = x >= 6 && x <= 25 && y >= 6 && (y >= 16 || (x - 15.5) ** 2 + (y - 16) ** 2 <= 100);
    if (inside) return inner(x, y);
    if (near) return trim;
    return border(x, y);
  });
}
const downIn = (x, y) => {
  let v = y < 18 ? 8 : 12 + (y - 18) * 2.4;
  if (y > 18 && y % 4 === 0) v += 20;
  return [v * 1.1, v, v * 0.9];
};
const upIn = (x, y) => {
  let v = 120 + y * 3.4;
  if (y % 4 === 0) v -= 36;
  return [v * 1.04, v, v * 0.86];
};
const sealIn = (x, y) => {
  const d = Math.hypot(x - 15.5, y - 21);
  if (d < 3) return [240, 196, 92];
  if (d < 4.5) return [60, 48, 40];
  if (d < 6.5 && (((Math.atan2(y - 21, x - 15.5) * 8) / Math.PI) | 0) % 2 === 0)
    return [214, 166, 64];
  let c = [62, 58, 70];
  if (x % 5 === 0) c = [44, 40, 50];
  if ((x === 10 || x === 21) && y % 6 === 2) c = [150, 146, 160];
  return c;
};
const bRock = (x, y) => TX.rock[y * T + x],
  bMoss = (x, y) => TX.moss[y * T + x],
  bKeep = (x, y) => TX.keep[y * T + x];
const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
TX.gateA = archTex((x, y) => unpack(bRock(x, y)), downIn, [70, 56, 40]);
TX.gateB = archTex((x, y) => unpack(bRock(x, y)), sealIn, [90, 72, 40]);
TX.gateBo = archTex((x, y) => unpack(bRock(x, y)), downIn, [90, 72, 40]);
TX.downA = archTex((x, y) => unpack(bMoss(x, y)), downIn, [60, 50, 36]);
TX.upA = archTex((x, y) => unpack(bMoss(x, y)), upIn, [60, 50, 36]);
TX.downB = archTex((x, y) => unpack(bKeep(x, y)), downIn, [50, 40, 62]);
TX.upB = archTex((x, y) => unpack(bKeep(x, y)), upIn, [50, 40, 62]);

/* sky panorama */
const SKYW = 1024,
  SKYH = HH;
let SKY;
(() => {
  const c = document.createElement("canvas");
  c.width = SKYW;
  c.height = SKYH;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, SKYH);
  gr.addColorStop(0, "#5f80a8");
  gr.addColorStop(0.7, "#b9c3c4");
  gr.addColorStop(1, "#d8d0b8");
  g.fillStyle = gr;
  g.fillRect(0, 0, SKYW, SKYH);
  const R = mulberry(77);
  g.fillStyle = "rgba(255,250,240,.55)";
  for (let i = 0; i < 26; i++) {
    const x = R() * SKYW,
      y = 8 + R() * 42,
      s = 10 + R() * 26;
    for (let j = 0; j < 5; j++) {
      g.beginPath();
      g.ellipse((x + j * s * 0.6) % SKYW, y + R() * 5, s * 0.7, s * 0.28, 0, 0, 7);
      g.fill();
    }
  }
  const hill = (col, base, amp, f1, f2, ph) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, SKYH);
    for (let x = 0; x <= SKYW; x += 4) {
      const t = (x / SKYW) * Math.PI * 2;
      g.lineTo(x, base - amp * (0.6 * Math.sin(t * f1 + ph) + 0.4 * Math.sin(t * f2 + ph * 2)));
    }
    g.lineTo(SKYW, SKYH);
    g.fill();
  };
  hill("#9aa3ae", SKYH - 12, 10, 3, 7, 1);
  hill("#7d8c86", SKYH - 4, 6, 5, 11, 2);
  SKY = new Uint32Array(g.getImageData(0, 0, SKYW, SKYH).data.buffer.slice(0));
})();

/* ---------------- sprites ---------------- */
function sprite(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const d = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer.slice(0));
  const fl = document.createElement("canvas");
  fl.width = w;
  fl.height = h;
  const f = fl.getContext("2d");
  f.drawImage(c, 0, 0);
  f.globalCompositeOperation = "source-in";
  f.fillStyle = "#fff";
  f.fillRect(0, 0, w, h);
  return { w, h, d, c, fl };
}
const E = (g, x, y, rx, ry, col) => {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
};
const P = (g, p, col) => {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
  g.fill();
};
const Rr = (g, x, y, w, h, col) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};
const Ln = (g, p, col, lw) => {
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.stroke();
};
const mirror = (p) => p.map((v, i) => (i % 2 === 0 ? 64 - v : v));
const SPR = {
  slime: sprite(64, 48, (g) => {
    E(g, 32, 33, 27, 16, "#3d7a38");
    E(g, 32, 30, 25, 15, "#5fae4e");
    E(g, 22, 23, 7, 4, "#a8e09a");
    E(g, 24, 31, 4, 5, "#10200e");
    E(g, 40, 31, 4, 5, "#10200e");
    E(g, 25, 29, 1.6, 1.6, "#fff");
    E(g, 41, 29, 1.6, 1.6, "#fff");
  }),
  bat: sprite(64, 40, (g) => {
    const w = [32, 18, 4, 6, 8, 16, 2, 24, 12, 22, 16, 30, 22, 24, 32, 26];
    P(g, w, "#3e3150");
    P(g, mirror(w), "#3e3150");
    P(g, [26, 14, 27, 4, 31, 12], "#5a4870");
    P(g, [38, 14, 37, 4, 33, 12], "#5a4870");
    E(g, 32, 21, 8, 10, "#5a4870");
    Rr(g, 27, 18, 3, 2, "#ff4a3a");
    Rr(g, 34, 18, 3, 2, "#ff4a3a");
    P(g, [29, 26, 31, 30, 32, 26], "#eee");
    P(g, [32, 26, 33, 30, 35, 26], "#eee");
  }),
  wolf: sprite(64, 64, (g) => {
    Rr(g, 17, 46, 6, 17, "#5d5f66");
    Rr(g, 41, 46, 6, 17, "#5d5f66");
    E(g, 32, 46, 20, 12, "#7d7f86");
    E(g, 32, 45, 10, 11, "#b9bbc0");
    P(g, [18, 24, 19, 7, 28, 18], "#6b6d74");
    P(g, [46, 24, 45, 7, 36, 18], "#6b6d74");
    E(g, 32, 29, 14, 12, "#8a8c93");
    E(g, 32, 36, 7, 6, "#c9cacd");
    E(g, 32, 33, 3, 2, "#111");
    E(g, 26, 27, 2.6, 2, "#f2c94c");
    E(g, 38, 27, 2.6, 2, "#f2c94c");
    Rr(g, 25.5, 26.5, 1.5, 1.5, "#111");
    Rr(g, 37.5, 26.5, 1.5, 1.5, "#111");
  }),
  goblin: sprite(64, 72, (g) => {
    Rr(g, 24, 56, 6, 15, "#4a3a24");
    Rr(g, 34, 56, 6, 15, "#4a3a24");
    P(g, [20, 33, 44, 33, 48, 60, 16, 60], "#7a5530");
    Rr(g, 18, 50, 28, 4, "#3a2a18");
    E(g, 15, 44, 4, 10, "#5f8f3a");
    E(g, 49, 44, 4, 10, "#5f8f3a");
    P(g, [50, 42, 54, 42, 52, 22], "#c8ccd2");
    Rr(g, 48, 40, 8, 3, "#5a3a20");
    P(g, [22, 20, 3, 11, 21, 28], "#5f8f3a");
    P(g, [42, 20, 61, 11, 43, 28], "#5f8f3a");
    E(g, 32, 22, 12, 11, "#6fa344");
    E(g, 27, 21, 2.6, 2.2, "#ff4a3a");
    E(g, 37, 21, 2.6, 2.2, "#ff4a3a");
    Rr(g, 27, 28, 10, 2, "#2a3a1a");
    Rr(g, 29, 28, 2, 3, "#eee");
    Rr(g, 34, 28, 2, 3, "#eee");
  }),
  skeleton: sprite(64, 88, (g) => {
    const b = "#e6dfcc";
    Ln(g, [52, 60, 58, 30], "#9aa2ad", 3);
    Rr(g, 49, 56, 8, 3, "#6b4a2a");
    Ln(g, [32, 26, 32, 56], b, 3);
    for (let i = 0; i < 4; i++) Ln(g, [23, 31 + i * 6, 32, 28 + i * 6, 41, 31 + i * 6], b, 2.5);
    E(g, 32, 58, 9, 4, b);
    Ln(g, [22, 30, 16, 45, 14, 57], b, 3);
    Ln(g, [42, 30, 48, 45, 52, 57], b, 3);
    Ln(g, [28, 60, 26, 74, 26, 86], b, 3);
    Ln(g, [36, 60, 38, 74, 38, 86], b, 3);
    E(g, 32, 14, 10, 11, b);
    Rr(g, 26, 19, 12, 7, b);
    E(g, 28, 14, 2.8, 3.2, "#151015");
    E(g, 36, 14, 2.8, 3.2, "#151015");
    P(g, [32, 17, 30.5, 20.5, 33.5, 20.5], "#151015");
    for (let i = 0; i < 5; i++) Rr(g, 27 + i * 2.4, 23, 1, 3, "#151015");
  }),
  wraith: sprite(64, 88, (g) => {
    P(
      g,
      [
        32, 2, 50, 16, 54, 40, 60, 84, 50, 76, 42, 86, 32, 78, 22, 86, 14, 76, 4, 84, 10, 40, 14,
        16,
      ],
      "#2d3058",
    );
    P(
      g,
      [32, 10, 44, 20, 46, 44, 50, 74, 40, 70, 32, 76, 24, 70, 14, 74, 18, 44, 20, 20],
      "#3c4178",
    );
    P(g, [16, 36, 2, 56, 8, 60, 20, 46], "#2d3058");
    P(g, [48, 36, 62, 56, 56, 60, 44, 46], "#2d3058");
    E(g, 32, 22, 10, 12, "#0b0a16");
    E(g, 28, 22, 2.2, 1.6, "#a8f4ff");
    E(g, 36, 22, 2.2, 1.6, "#a8f4ff");
  }),
  golem: sprite(80, 80, (g) => {
    Rr(g, 20, 58, 14, 22, "#6b6155");
    Rr(g, 46, 58, 14, 22, "#6b6155");
    Rr(g, 14, 24, 52, 36, "#7d7265");
    Rr(g, 2, 26, 14, 34, "#6f6559");
    Rr(g, 64, 26, 14, 34, "#6f6559");
    Rr(g, 28, 6, 24, 20, "#867a6c");
    Rr(g, 32, 13, 5, 4, "#ff9a3c");
    Rr(g, 43, 13, 5, 4, "#ff9a3c");
    Ln(g, [24, 30, 30, 38, 26, 50], "#4a433b", 1.5);
    Ln(g, [56, 28, 52, 36, 58, 44], "#4a433b", 1.5);
    E(g, 20, 25, 7, 3, "#5b7d3e");
    E(g, 56, 59, 5, 3, "#5b7d3e");
    Rr(g, 37, 36, 6, 10, "#ffb35c");
  }),
  wyrm: sprite(96, 88, (g) => {
    E(g, 48, 76, 42, 12, "#33592a");
    E(g, 48, 70, 35, 11, "#4f7d3c");
    E(g, 48, 72, 20, 5, "#9cbf6a");
    Ln(g, [62, 66, 68, 46, 58, 28], "#4f7d3c", 15);
    for (let i = 0; i < 4; i++)
      P(g, [66 - i * 2, 58 - i * 9, 78 - i * 2, 52 - i * 9, 68 - i * 2, 64 - i * 9], "#86b45a");
    E(g, 50, 24, 17, 11, "#5b8c45");
    P(g, [35, 28, 65, 28, 59, 40, 41, 38], "#3e6a2f");
    for (let i = 0; i < 5; i++) P(g, [40 + i * 4, 28, 42 + i * 4, 33, 44 + i * 4, 28], "#f0ead8");
    E(g, 43, 20, 3.2, 2.6, "#f5d548");
    E(g, 57, 20, 3.2, 2.6, "#f5d548");
    Rr(g, 42.5, 18.5, 1.4, 3.5, "#111");
    Rr(g, 56.5, 18.5, 1.4, 3.5, "#111");
    P(g, [38, 14, 30, 4, 42, 12], "#86b45a");
    P(g, [62, 14, 70, 4, 58, 12], "#86b45a");
  }),
  king: sprite(80, 100, (g) => {
    Ln(g, [67, 30, 67, 99], "#6b4a2a", 3);
    E(g, 67, 27, 4.5, 4.5, "#9ef0ff");
    P(g, [40, 26, 66, 99, 14, 99], "#3b2550");
    P(g, [20, 40, 60, 40, 65, 57, 15, 57], "#5a3a78");
    Rr(g, 15, 55, 50, 4, "#d8d0c0");
    E(g, 40, 24, 9, 11, "#cfc6d9");
    E(g, 36, 23, 3.2, 2.6, "#2a1838");
    E(g, 44, 23, 3.2, 2.6, "#2a1838");
    E(g, 36, 23, 1.6, 1.2, "#ff6a5a");
    E(g, 44, 23, 1.6, 1.2, "#ff6a5a");
    P(g, [33, 28, 47, 28, 40, 45], "#9a92a8");
    P(g, [30, 15, 30, 6, 34, 11, 37, 3, 40, 10, 43, 3, 46, 11, 50, 6, 50, 15], "#d4a73c");
    E(g, 40, 12, 1.6, 1.6, "#d0594b");
  }),
  chest: sprite(40, 30, (g) => {
    Rr(g, 4, 11, 32, 18, "#7a4a24");
    E(g, 20, 8, 16, 5, "#8e5a2c");
    Rr(g, 4, 7, 32, 6, "#8e5a2c");
    Rr(g, 10, 3, 3, 26, "#d6a640");
    Rr(g, 27, 3, 3, 26, "#d6a640");
    Rr(g, 4, 12, 32, 2, "#5a3418");
    Rr(g, 18, 13, 4, 6, "#f0c860");
  }),
  camp: sprite(64, 48, (g) => {
    for (const [x, y] of [
      [10, 42],
      [18, 45],
      [46, 45],
      [54, 42],
      [32, 46],
    ])
      E(g, x, y, 5, 3.5, "#77757a");
    Ln(g, [14, 42, 50, 32], "#6b4a2a", 5);
    Ln(g, [14, 32, 50, 42], "#5a3d24", 5);
    P(g, [32, 4, 41, 24, 45, 40, 19, 40, 23, 24], "#e8742c");
    P(g, [32, 15, 38, 28, 39, 40, 25, 40, 27, 28], "#f8c048");
    P(g, [32, 26, 35, 33, 35, 40, 29, 40, 29, 33], "#fff3c0");
  }),
  tree: sprite(64, 96, (g) => {
    Rr(g, 28, 58, 8, 38, "#5a3d24");
    Rr(g, 28, 58, 3, 38, "#6e4c2e");
    E(g, 32, 42, 23, 22, "#2a5226");
    E(g, 19, 50, 14, 13, "#2a5226");
    E(g, 45, 50, 14, 13, "#2a5226");
    E(g, 32, 27, 17, 16, "#356530");
    E(g, 25, 24, 7, 5, "#4d8540");
    E(g, 40, 40, 6, 4, "#4d8540");
    E(g, 18, 47, 5, 4, "#4d8540");
  }),
  alert: sprite(8, 16, (g) => {
    Rr(g, 2, 0, 4, 10, "#ff5040");
    Rr(g, 2, 12, 4, 4, "#ff5040");
  }),
};
