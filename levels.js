/* ===================== Chudometry Dash — levels.js =====================
 * Physics + procedural level generator + the fixed-timestep simulation step.
 * Units are blocks, y goes UP, the ground is at 0.
 * --------------------------------------------------------------------- */

export const STEP = 1 / 240;
export const G = 105;
export const JUMP_V = 21.5;
export const PAD_V = 30;
export const ORB_V = 22;
export const MAX_FALL = 40;
export const HAZ_INSET = 0.1;
export const SOLID_INSET = 0.28;
export const LAND_TOL = 0.38;
export const JUMP_TIME = (2 * JUMP_V) / G;
export const PAD_TIME = (2 * PAD_V) / G;

export const EV = { JUMP: 1, LAND: 2, PAD: 4, ORB: 8, DIE: 16, WIN: 32 };

export const DIFF_COLORS = {
  Easy: "#38bdf8",
  Normal: "#4ade80",
  Hard: "#facc15",
  Harder: "#fb923c",
  Insane: "#f472b6",
  Demon: "#ef4444",
};

export const DIFF_FACE = {
  Easy: "🙂",
  Normal: "😐",
  Hard: "😠",
  Harder: "😡",
  Insane: "🤬",
  Demon: "👹",
};

export const LEVELS = [
  { name: "Stereo Chudness", difficulty: "Easy", speed: 8.4, secs: 30, tier: 0, hue: 205, bpm: 128, K: 14, seed: 1000 },
  { name: "Back on Chud", difficulty: "Easy", speed: 8.7, secs: 32, tier: 0, hue: 280, bpm: 132, K: 13, seed: 8919 },
  { name: "Polar Chud", difficulty: "Normal", speed: 9.0, secs: 34, tier: 1, hue: 150, bpm: 136, K: 12, seed: 16838 },
  { name: "Dry Chud", difficulty: "Normal", speed: 9.4, secs: 36, tier: 1, hue: 30, bpm: 140, K: 11, seed: 24757 },
  { name: "Base After Chud", difficulty: "Hard", speed: 10.4, secs: 38, tier: 1, hue: 330, bpm: 142, K: 10, seed: 32676 },
  { name: "Can't Let Chud", difficulty: "Hard", speed: 10.4, secs: 40, tier: 2, hue: 190, bpm: 146, K: 9, seed: 40595 },
  { name: "Chudper", difficulty: "Hard", speed: 10.8, secs: 42, tier: 2, hue: 100, bpm: 148, K: 8, seed: 48514 },
  { name: "Time Chudchine", difficulty: "Harder", speed: 11.2, secs: 44, tier: 2, hue: 260, bpm: 150, K: 8, seed: 56433 },
  { name: "Chucles", difficulty: "Harder", speed: 11.6, secs: 46, tier: 3, hue: 0, bpm: 152, K: 7, seed: 64352 },
  { name: "xChud", difficulty: "Harder", speed: 12.0, secs: 48, tier: 3, hue: 170, bpm: 156, K: 6, seed: 72271 },
  { name: "Clutterchud", difficulty: "Insane", speed: 12.4, secs: 50, tier: 3, hue: 45, bpm: 160, K: 6, seed: 80190 },
  { name: "Theory of Chud", difficulty: "Insane", speed: 12.96, secs: 52, tier: 4, hue: 300, bpm: 164, K: 5, seed: 192838 },
  { name: "Electrochud", difficulty: "Insane", speed: 12.96, secs: 54, tier: 4, hue: 215, bpm: 168, K: 5, seed: 96028 },
  { name: "Clubchud", difficulty: "Demon", speed: 13.5, secs: 56, tier: 4, hue: 350, bpm: 172, K: 4, seed: 313405 },
  { name: "Chud Deadlocked", difficulty: "Demon", speed: 14.0, secs: 60, tier: 4, hue: 12, bpm: 176, K: 4, seed: 111866 },
];

/* --------------------------- rng --------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------- builder --------------------------- */
class Builder {
  constructor() {
    this.objs = [];
    this.id = 0;
  }
  add(t, x, y, w = 1, h = 1) {
    this.objs.push({ t, x, y, w, h, id: this.id++ });
  }
  spike(x, y = 0) {
    this.add("spike", x, y);
  }
  spikes(x, n, y = 0) {
    for (let i = 0; i < n; i++) this.spike(x + i, y);
  }
  mini(x, y = 0) {
    this.add("mini", x, y);
  }
  block(x, y, w, h) {
    this.add("block", x, y, w, h);
  }
  pad(x, y = 0) {
    this.add("pad", x, y);
  }
  orb(x, y) {
    this.add("orb", x, y);
  }
  spikeDown(x, y) {
    this.add("spikeDown", x, y);
  }
}

const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const half = (v) => Math.round(v * 2) / 2;

/* --------------------------- patterns --------------------------- */
const PATTERNS = [
  // tier 0
  { name: "spike", tier: 0, f: (c, x) => (c.b.spike(x), x + 1) },
  { name: "mini", tier: 0, f: (c, x) => (c.b.mini(x), x + 1) },
  { name: "cube", tier: 0, f: (c, x) => (c.b.block(x, 0, 1, 1), x + 1) },
  { name: "run", tier: 0, f: (c, x) => { const w = ri(c.r, 3, 6); c.b.block(x, 0, w, 1); return x + w; } },
  { name: "rhythm", tier: 0, f: (c, x) => { const g = Math.ceil(c.J) + 2; c.b.spike(x); c.b.spike(x + g); return x + g + 1; } },

  // tier 1
  { name: "double", tier: 1, f: (c, x) => (c.b.spikes(x, 2), x + 2) },
  { name: "minis", tier: 1, f: (c, x) => (c.b.mini(x), c.b.mini(x + 1), x + 2) },
  { name: "stairs2", tier: 1, f: (c, x) => { c.b.block(x, 0, 3, 1); c.b.block(x + 3, 0, 3, 2); return x + 6; } },
  { name: "blockSpike", tier: 1, f: (c, x) => { c.b.block(x, 0, 6, 1); c.b.spike(x + 3, 1); return x + 6; } },
  { name: "pad", tier: 1, f: (c, x) => { const n = Math.max(2, Math.floor(c.PJ - 3)); c.b.pad(x); c.b.spikes(x + 2, n); return x + 2 + n; } },
  { name: "cubeSpike", tier: 1, f: (c, x) => { c.b.block(x, 0, 2, 1); c.b.spike(x + 2); return x + 3; } },

  // tier 2
  { name: "triple", tier: 2, minSpeed: 9.9, f: (c, x) => (c.b.spikes(x, 3), x + 3) },
  { name: "stairs3", tier: 2, f: (c, x) => { c.b.block(x, 0, 3, 1); c.b.block(x + 3, 0, 3, 2); c.b.block(x + 6, 0, 3, 3); return x + 9; } },
  { name: "orbPit", tier: 2, f: (c, x) => { const n = Math.max(4, Math.floor(1.5 * c.J - 1.5)); c.b.spikes(x, n); c.b.orb(half(x + c.J / 2 - 1), 1.6); return x + n; } },
  { name: "tunnel", tier: 2, f: (c, x) => { const L = ri(c.r, 4, 7); c.b.block(x, 2, L, 1); c.b.spike(x + L + 2); return x + L + 3; } },
  { name: "blockGap", tier: 2, f: (c, x) => { c.b.block(x, 0, 2, 1); c.b.spikes(x + 2, 2); c.b.block(x + 4, 0, 2, 1); return x + 6; } },
  { name: "padHigh", tier: 2, f: (c, x) => { const bx = x + Math.round(0.36 * c.speed); c.b.pad(x); c.b.spikes(x + 2, bx - x - 2); c.b.block(bx, 0, 4, 3); return bx + 4; } },

  // tier 3
  {
    name: "pillars", tier: 3,
    f: (c, x) => {
      let cx = x, h = 1;
      c.b.block(cx, 0, 2, h); cx += 2;
      const n = ri(c.r, 2, 3);
      for (let k = 0; k < n; k++) {
        const g = ri(c.r, 1, Math.max(1, Math.floor(c.J) - 3));
        c.b.spikes(cx, g);
        h = Math.max(1, Math.min(2, h + ri(c.r, -1, 1)));
        c.b.block(cx + g, 0, 2, h);
        cx += g + 2;
      }
      return cx;
    },
  },
  {
    name: "orbChain", tier: 3,
    f: (c, x) => {
      const o1 = half(x + c.J / 2 - 1), o2 = half(o1 + c.J * 1.05);
      const n = Math.max(6, Math.floor(o2 - x + c.J * 0.7));
      c.b.spikes(x, n); c.b.orb(o1, 1.6); c.b.orb(o2, 1.8);
      return x + n;
    },
  },
  { name: "tripleDouble", tier: 3, minSpeed: 9.9, f: (c, x) => { const g = Math.ceil(c.J) + 1; c.b.spikes(x, 3); c.b.spikes(x + 3 + g, 2); return x + 5 + g; } },
  {
    name: "platSpikes", tier: 3,
    f: (c, x) => {
      const g = Math.ceil(c.J) + 1, w = 3 + g + 3;
      c.b.block(x, 0, w, 1); c.b.spike(x + 2, 1); c.b.spikes(x + 3 + g - 1, 2, 1);
      return x + w;
    },
  },
  {
    name: "ceilSpikes", tier: 3,
    f: (c, x) => {
      const L = ri(c.r, 4, 6);
      c.b.block(x, 3, L, 1);
      for (let i = 0; i < L; i++) c.b.spikeDown(x + i, 2);
      c.b.mini(x + L + 1);
      return x + L + 2;
    },
  },

  // tier 4
  { name: "tunnelTriple", tier: 4, minSpeed: 11, f: (c, x) => { const L = ri(c.r, 4, 6); c.b.block(x, 2, L, 1); c.b.spikes(x + L + 2, 3); return x + L + 5; } },
  {
    name: "orbTriple", tier: 4,
    f: (c, x) => {
      c.b.spikes(x, 3);
      const px = x + 3 + Math.ceil(c.J * 0.6);
      const n = Math.max(4, Math.floor(1.5 * c.J - 1.5));
      c.b.spikes(px, n); c.b.orb(half(px + c.J / 2 - 1), 1.6);
      return px + n;
    },
  },
  {
    name: "pillarsHard", tier: 4,
    f: (c, x) => {
      let cx = x;
      c.b.block(cx, 0, 1, 1); cx += 1;
      const n = ri(c.r, 3, 4);
      let h = 1;
      for (let k = 0; k < n; k++) {
        const g = ri(c.r, 2, Math.max(2, Math.floor(c.J) - 2));
        c.b.spikes(cx, g);
        h = Math.max(1, Math.min(3, h + ri(c.r, 0, 1)));
        c.b.block(cx + g, 0, 1, h);
        cx += g + 1;
      }
      return cx;
    },
  },
  {
    name: "padPlatSpike", tier: 4,
    f: (c, x) => {
      const bx = x + Math.round(0.36 * c.speed);
      c.b.pad(x); c.b.spikes(x + 2, bx - x - 2); c.b.block(bx, 0, 6, 3); c.b.spike(bx + 3, 3);
      return bx + 6;
    },
  },
];

function buildBuckets(objs, length) {
  const n = Math.ceil(length) + 20;
  const buckets = new Array(n);
  for (let i = 0; i < n; i++) buckets[i] = [];
  for (const o of objs) {
    const a = Math.max(0, Math.floor(o.x - 2));
    const b = Math.min(n - 1, Math.floor(o.x + o.w + 2));
    for (let c = a; c <= b; c++) buckets[c].push(o);
  }
  return buckets;
}

/**
 * Build a level. `easy` slows it down, widens the gaps and skips the meanest
 * patterns, but keeps the same seeded layout rules.
 */
export function generateLevel(meta, index, easy = false) {
  const speed = easy ? meta.speed * 0.84 : meta.speed;
  const r = mulberry32(meta.seed + (easy ? 7919 : 0));
  const b = new Builder();
  const J = speed * JUMP_TIME;
  const PJ = speed * PAD_TIME;
  const ctx = { b, J, PJ, speed, r };
  const target = speed * meta.secs;
  const d = index / (LEVELS.length - 1);

  const pool = PATTERNS.filter(
    (p) => p.tier <= meta.tier && (!p.minSpeed || speed >= p.minSpeed) && (!p.maxSpeed || speed <= p.maxSpeed),
  );
  const weights = pool.map((p) => (p.tier === meta.tier ? 4 : p.tier === meta.tier - 1 ? 2 : 1));
  const wSum = weights.reduce((a, c) => a + c, 0);
  const pick = () => {
    let v = r() * wSum;
    for (let i = 0; i < pool.length; i++) {
      v -= weights[i];
      if (v <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  const skip = new Set(easy ? ["pillarsHard", "padPlatSpike", "tripleDouble", "ceilSpikes"] : []);

  let x = 14;
  let last = "";
  let guard = 0;
  while (x < target && guard++ < 800) {
    let p = pick();
    if ((p.name === last || skip.has(p.name)) && guard < 780) p = pick();
    last = p.name;
    x = p.f(ctx, x);
    const gapMul = (easy ? 2.3 : 1.9) - 1.1 * d + r() * ((easy ? 1.7 : 1.4) - 1.1 * d);
    x += Math.max(2, Math.round(J * gapMul));
  }

  const objs = b.objs.sort((a, c) => a.x - c.x);
  objs.forEach((o, i) => (o.id = i));
  const length = x + 12;
  return {
    index,
    name: meta.name,
    difficulty: meta.difficulty,
    speed,
    hue: meta.hue,
    bpm: meta.bpm,
    secs: meta.secs,
    length,
    objs,
    buckets: buildBuckets(objs, length),
  };
}

/* --------------------------- simulation --------------------------- */
export function newPlayer() {
  return {
    x: 0, y: 0, vy: 0, rot: 0,
    onGround: true, held: false, fresh: false,
    lastOrb: -1, lastPad: -1,
    dead: false, won: false,
  };
}

function overlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  return ax1 > bx0 && ax0 < bx1 && ay1 > by0 && ay0 < by1;
}

/** Advance one 1/240s tick. Returns an EV bitmask. */
export function step(p, input, lvl) {
  if (p.dead || p.won) return 0;
  let ev = 0;

  if (input && !p.held) p.fresh = true;
  if (!input) p.fresh = false;
  p.held = input;

  const wasGround = p.onGround;

  if (p.onGround && p.held) {
    p.vy = JUMP_V;
    p.onGround = false;
    p.fresh = false;
    ev |= EV.JUMP;
  }

  p.vy -= G * STEP;
  if (p.vy < -MAX_FALL) p.vy = -MAX_FALL;

  const prevY = p.y;
  p.y += p.vy * STEP;
  p.x += lvl.speed * STEP;
  p.onGround = false;

  if (p.y <= 0) {
    p.y = 0;
    p.vy = 0;
    p.onGround = true;
  }

  // cosmetic spin — snaps flat when you land
  if (p.onGround) {
    const q = Math.PI / 2;
    p.rot = Math.round(p.rot / q) * q;
  } else {
    p.rot += 5.2 * STEP;
  }

  const bucket = lvl.buckets[Math.floor(p.x + 0.5)];
  if (bucket) {
    const px0 = p.x, py0 = p.y, px1 = p.x + 1, py1 = p.y + 1;
    const hx0 = p.x + HAZ_INSET, hx1 = p.x + 1 - HAZ_INSET;
    const hy0 = p.y + HAZ_INSET, hy1 = p.y + 1 - HAZ_INSET;

    // solid blocks: land on top, die if you run into the face
    for (const o of bucket) {
      if (o.t !== "block") continue;
      if (overlap(px0, py0, px1, py1, o.x, o.y, o.x + o.w, o.y + o.h)) {
        const top = o.y + o.h;
        if (p.vy <= 0 && prevY >= top - LAND_TOL) {
          p.y = top;
          p.vy = 0;
          p.onGround = true;
        } else if (
          overlap(p.x + SOLID_INSET, p.y + SOLID_INSET, p.x + 1 - SOLID_INSET, p.y + 1 - SOLID_INSET, o.x, o.y, o.x + o.w, o.y + o.h)
        ) {
          p.dead = true;
          return ev | EV.DIE;
        }
      }
    }

    // hazards and pickups
    for (const o of bucket) {
      if (o.t === "spike") {
        if (overlap(hx0, hy0, hx1, hy1, o.x + 0.4, o.y, o.x + 0.6, o.y + 0.5)) { p.dead = true; return ev | EV.DIE; }
      } else if (o.t === "spikeDown") {
        if (overlap(hx0, hy0, hx1, hy1, o.x + 0.4, o.y + 0.5, o.x + 0.6, o.y + 1)) { p.dead = true; return ev | EV.DIE; }
      } else if (o.t === "mini") {
        if (overlap(hx0, hy0, hx1, hy1, o.x + 0.4, o.y, o.x + 0.6, o.y + 0.25)) { p.dead = true; return ev | EV.DIE; }
      } else if (o.t === "pad") {
        if (o.id !== p.lastPad && overlap(px0, py0, px1, py1, o.x, o.y, o.x + 1, o.y + 0.35)) {
          p.vy = PAD_V; p.onGround = false; p.lastPad = o.id; ev |= EV.PAD;
        }
      } else if (o.t === "orb") {
        if (p.fresh && o.id !== p.lastOrb && overlap(px0, py0, px1, py1, o.x - 0.2, o.y - 0.2, o.x + 1.2, o.y + 1.2)) {
          p.vy = ORB_V; p.onGround = false; p.fresh = false; p.lastOrb = o.id; ev |= EV.ORB;
        }
      }
    }
  }

  if (!wasGround && p.onGround) ev |= EV.LAND;
  if (p.x >= lvl.length) { p.won = true; ev |= EV.WIN; }
  return ev;
}
