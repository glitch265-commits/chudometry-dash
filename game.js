/* ===================== Chudometry Dash — game.js =====================
 * Menu, save data, canvas renderer and the main loop.
 * --------------------------------------------------------------------- */

import { CHARACTERS, fallbackSrc, loadSprite, resolveSources } from "./characters.js";
import { DIFF_COLORS, DIFF_FACE, EV, LEVELS, STEP, generateLevel, newPlayer, step } from "./levels.js";
import { audio, setMusicOn, setSfxOn, sfx, startMusic, stopMusic, unlockAudio } from "./audio.js";

/* --------------------------- shorthands --------------------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* --------------------------- save data --------------------------- */
const SAVE_KEY = "chudometry_save_v1";

const DEFAULT_SAVE = {
  selectedChar: 0,
  selectedLevel: 0,
  music: true,
  sfx: true,
  shake: true,
  easy: false,
  bests: {},
  runs: [],
  totalAttempts: 0,
  totalJumps: 0,
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const p = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...p, bests: p.bests || {}, runs: p.runs || [] };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch {
    /* ignore */
  }
}

function recordRun(rec) {
  const prev = S.bests[rec.level] || 0;
  if (rec.pct > prev) S.bests[rec.level] = rec.pct;
  S.runs = [rec, ...S.runs].slice(0, 40);
  S.totalAttempts += 1;
  S.totalJumps += rec.jumps || 0;
  persist();
}

let S = loadSave();
const best = (i) => S.bests[i] || 0;

/* --------------------------- resolved images --------------------------- */
const sources = CHARACTERS.map(fallbackSrc);
const found = [false, false, false];
const sprites = new Array(CHARACTERS.length).fill(null);

function charOf(i) {
  const c = CHARACTERS[i] || CHARACTERS[0];
  return { ...c, src: sources[i] };
}

async function bootImages() {
  const res = await resolveSources();
  for (let i = 0; i < CHARACTERS.length; i++) {
    sources[i] = res.sources[i];
    found[i] = res.found[i];
    sprites[i] = await loadSprite(sources[i]);
  }
  renderMenu();
}

/* --------------------------- particles --------------------------- */
const particles = [];

function spawn(kind, x, y, hue, count, power = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 5 * power,
      vy: Math.random() * 5 * power,
      life: kind === "trail" ? 0.35 : 0.6,
      max: kind === "trail" ? 0.35 : 0.6,
      size: kind === "burst" ? 0.3 : 0.18 + Math.random() * 0.16,
      hue: hue + (Math.random() * 40 - 20),
      kind,
    });
  }
  if (particles.length > 260) particles.splice(0, particles.length - 260);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 9 * dt;
  }
}

/* --------------------------- renderer --------------------------- */
const VIEW_BLOCKS_H = 11.5;
const GROUND_BLOCKS = 2.4;
const CAM_BACK = 5.2;
const cam = { shake: 0, flash: 0 };

function draw(ctx, W, H, lvl, p, ch, sprite, time, attempts) {
  const B = H / VIEW_BLOCKS_H;
  const groundY = H - GROUND_BLOCKS * B;
  const camX = p.x - CAM_BACK;
  const beat = (time * lvl.bpm) / 60;
  const pulse = 0.5 + 0.5 * Math.sin(beat * Math.PI * 2);
  const hue = lvl.hue;

  ctx.save();
  if (cam.shake > 0.001) ctx.translate((Math.random() - 0.5) * cam.shake * 22, (Math.random() - 0.5) * cam.shake * 22);

  /* sky */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `hsl(${hue} 65% 9%)`);
  sky.addColorStop(0.55, `hsl(${(hue + 25) % 360} 60% ${14 + pulse * 3}%)`);
  sky.addColorStop(1, `hsl(${(hue + 45) % 360} 65% 22%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const gx = W * 0.72;
  const glow = ctx.createRadialGradient(gx, groundY - B * 5.4, 0, gx, groundY - B * 5.4, B * 6);
  glow.addColorStop(0, `hsla(${(hue + 40) % 360} 100% 70% / ${0.22 + pulse * 0.1})`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  /* parallax skyline */
  ctx.save();
  ctx.globalAlpha = 0.35;
  const shift = ((camX * B * 0.18) % (B * 3) + B * 3) % (B * 3);
  for (let i = -1; i < W / (B * 3) + 2; i++) {
    const bx = i * B * 3 - shift;
    const hgt = B * (2.2 + ((i * 7919) % 5) * 0.55);
    ctx.fillStyle = `hsl(${(hue + 200) % 360} 70% 30% / 0.5)`;
    ctx.fillRect(bx, groundY - hgt, B * 2, hgt);
    ctx.fillStyle = `hsl(${(hue + 190) % 360} 90% 60% / 0.5)`;
    ctx.fillRect(bx, groundY - hgt, B * 2, B * 0.08);
  }
  ctx.restore();

  /* background grid */
  ctx.save();
  ctx.strokeStyle = `hsla(${hue} 100% 70% / 0.12)`;
  ctx.lineWidth = Math.max(1, B * 0.04);
  const gs = ((camX * B * 0.5) % (B * 1.5) + B * 1.5) % (B * 1.5);
  for (let i = -1; i < W / (B * 1.5) + 2; i++) {
    const x = i * B * 1.5 - gs;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, groundY);
    ctx.stroke();
  }
  ctx.restore();

  /* ground */
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, `hsl(${hue} 45% 16%)`);
  gg.addColorStop(1, `hsl(${(hue + 30) % 360} 50% 8%)`);
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.save();
  ctx.strokeStyle = `hsla(${hue} 100% 72% / 0.25)`;
  ctx.lineWidth = Math.max(1, B * 0.03);
  const tg = ((camX * B) % (B * 1.5) + B * 1.5) % (B * 1.5);
  for (let i = -1; i < W / (B * 1.5) + 2; i++) {
    const x = i * B * 1.5 - tg;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - B * 1.2, H);
    ctx.stroke();
  }
  ctx.restore();

  const neon = `hsl(${hue} 100% ${58 + pulse * 12}%)`;
  ctx.shadowColor = neon;
  ctx.shadowBlur = B * 0.5;
  ctx.fillStyle = neon;
  ctx.fillRect(0, groundY - B * 0.07, W, B * 0.11);
  ctx.shadowBlur = 0;

  /* objects */
  const sx = (wx) => (wx - camX) * B;
  const sy = (wy) => groundY - wy * B;
  const from = Math.floor(camX) - 2;
  const to = Math.ceil(camX + W / B) + 2;
  const seen = new Set();
  for (let c = Math.max(0, from); c < Math.min(lvl.buckets.length, to); c++) {
    for (const o of lvl.buckets[c]) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      drawObj(ctx, o, sx, sy, B, hue, time, pulse);
    }
  }

  /* particles */
  for (const pt of particles) {
    const a = Math.max(0, pt.life / pt.max);
    const size = pt.size * B * (pt.kind === "burst" ? 1 : a * 0.9 + 0.25);
    ctx.globalAlpha = a * (pt.kind === "trail" ? 0.55 : 0.85);
    ctx.fillStyle = `hsl(${pt.hue} 100% ${pt.kind === "trail" ? 70 : 80}%)`;
    const px = sx(pt.x) - size / 2;
    const py = sy(pt.y) - size / 2;
    if (pt.kind === "burst") {
      ctx.beginPath();
      ctx.arc(px, py, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(px, py, size, size);
    }
  }
  ctx.globalAlpha = 1;

  /* player */
  if (!p.dead) {
    const s = B;
    ctx.save();
    ctx.translate(sx(p.x + 0.5), sy(p.y + 0.5));
    ctx.rotate(p.rot);
    ctx.shadowColor = ch.color;
    ctx.shadowBlur = B * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-s / 2, -s / 2, s, s);
    if (sprite && sprite.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = ch.color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
    }
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, B * 0.06);
    ctx.strokeStyle = ch.color2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  /* finish line */
  const fx = sx(lvl.length);
  if (fx > -B && fx < W + B) {
    ctx.save();
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = B * 0.6;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? "#fff" : "#111";
      ctx.fillRect(fx, groundY - (i + 1) * B * 0.5, B * 0.35, B * 0.5);
    }
    ctx.restore();
  }

  /* flash + vignette */
  if (cam.flash > 0.001) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, cam.flash)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  /* attempt text */
  if (p.x < 18) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.x / 18);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 ${Math.round(B * 0.62)}px "Russo One", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Attempt ${attempts}`, sx(8), sy(4.6));
    ctx.restore();
  }

  ctx.restore();
}

function drawObj(ctx, o, sx, sy, B, hue, time, pulse) {
  const x = sx(o.x);
  const yTop = sy(o.y + o.h);
  const w = o.w * B;
  const h = o.h * B;

  switch (o.t) {
    case "block": {
      ctx.fillStyle = `hsl(${hue} 30% 13%)`;
      ctx.fillRect(x, yTop, w, h);
      const g = ctx.createLinearGradient(x, yTop, x, yTop + h);
      g.addColorStop(0, `hsla(${hue} 90% 65% / 0.28)`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(x, yTop, w, h);
      ctx.strokeStyle = `hsl(${hue} 100% ${62 + pulse * 14}%)`;
      ctx.lineWidth = Math.max(1.5, B * 0.06);
      ctx.strokeRect(x + 0.5, yTop + 0.5, w - 1, h - 1);
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      for (let i = 1; i < o.w; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * B, yTop); ctx.lineTo(x + i * B, yTop + h); ctx.stroke();
      }
      for (let j = 1; j < o.h; j++) {
        ctx.beginPath(); ctx.moveTo(x, yTop + j * B); ctx.lineTo(x + w, yTop + j * B); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "spike":
    case "mini": {
      const hh = o.t === "spike" ? h * 0.5 : h * 0.25;
      const baseY = sy(o.y);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, baseY);
      ctx.lineTo(x + w * 0.5, baseY - hh);
      ctx.lineTo(x + w * 0.92, baseY);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, baseY - hh, x, baseY);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, `hsl(${hue} 90% 62%)`);
      ctx.fillStyle = g;
      ctx.shadowColor = `hsl(${hue} 100% 65%)`;
      ctx.shadowBlur = B * 0.25;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, B * 0.045);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      break;
    }
    case "spikeDown": {
      const topY = sy(o.y + 1);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, topY);
      ctx.lineTo(x + w * 0.5, topY + h * 0.5);
      ctx.lineTo(x + w * 0.92, topY);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, topY, x, topY + h * 0.5);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, `hsl(${hue} 90% 62%)`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1, B * 0.045);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      break;
    }
    case "pad": {
      const baseY = sy(o.y);
      ctx.save();
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = B * 0.5;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, baseY - B * 0.06, w * 0.44, B * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "orb": {
      const cx = x + w / 2;
      const cy = sy(o.y + 0.5);
      const r = B * (0.34 + pulse * 0.05);
      ctx.save();
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = B * 0.7;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "#fffbeb");
      g.addColorStop(0.55, "#facc15");
      g.addColorStop(1, "rgba(250,204,21,0.15)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, B * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.28 + Math.sin(time * 5) * 0.07), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

/* --------------------------- menu --------------------------- */
let currentLevel = null;
let phase = "menu";

function renderMenu() {
  renderFloaters();
  renderTitle();
  renderChars();
  renderLevels();
  renderScores();
  renderSettings();
  renderPlayBar();
  renderTabStats();
}

function renderFloaters() {
  $("floaters").innerHTML = CHARACTERS.map((c, i) => {
    const top = 16 + (i % 2) * 34;
    return `<img src="${esc(sources[i])}" alt="" style="left:${10 + i * 30}%;top:${top}%;animation:floaty ${6 + i * 1.4}s ease-in-out infinite" />`;
  }).join("");
}

function renderTitle() {
  $("titleImg").src = sources[S.selectedChar];
  $("titleImg").parentElement.style.setProperty("--c", CHARACTERS[S.selectedChar].color);
}

function renderChars() {
  $("chars").innerHTML = CHARACTERS.map((c, i) => {
    const active = S.selectedChar === i;
    const badge = found[i]
      ? '<span class="char-badge live">your photo</span>'
      : `<span class="char-badge">${active ? "selected" : "select"}</span>`;
    return (
      `<button class="char-card${active ? " active" : ""}" data-char="${i}" style="--c:${c.color}">` +
        '<div class="char-top">' +
          `<div class="cube-frame char-cube"><img src="${esc(sources[i])}" alt="${esc(c.name)}" draggable="false" /></div>` +
          '<div class="char-body">' +
            `<div class="char-name">${esc(c.name)}</div>` +
            `<div class="char-tag">${esc(c.tag)}</div>` +
            `<code class="char-file">characters/${esc(c.files[0])}</code>` +
            badge +
          "</div>" +
        "</div>" +
      "</button>"
    );
  }).join("");

  const missing = found.filter((f) => !f).length;
  const note = $("photoNote");
  if (missing === 0) {
    note.classList.add("hidden");
  } else {
    note.classList.remove("hidden");
    note.innerHTML =
      missing === 3
        ? "Using built-in stand-ins. Drop your pictures into <code>characters/</code> as <code>chud.jpg</code>, <code>chud 1.jpg</code> and <code>chud 2.jpg</code> and they load automatically."
        : `${missing} of 3 photos missing &mdash; add them to <code>characters/</code> to replace the stand-ins.`;
  }
}

function renderLevels() {
  // preview strips are cheap enough to build once per render
  const previews = LEVELS.map((m, i) => generateLevel(m, i, S.easy));

  $("levels").innerHTML = LEVELS.map((m, i) => {
    const b = best(i);
    const active = S.selectedLevel === i;
    const color = DIFF_COLORS[m.difficulty];
    const pv = previews[i];
    const dots = pv.objs
      .filter((o) => o.t === "spike" || o.t === "mini" || o.t === "block")
      .slice(0, 90)
      .map((o) => {
        const left = ((o.x / pv.length) * 100).toFixed(2);
        const height = o.t === "block" ? Math.max(1, o.h) * 8 : 6;
        const bg = o.t === "block" ? "rgba(255,255,255,0.35)" : "#fff";
        return `<i style="left:${left}%;height:${height}px;background:${bg}"></i>`;
      })
      .join("");

    return (
      `<button class="level-card${active ? " active" : ""}" data-level="${i}" style="--c:${color}">` +
        '<div class="lc-top">' +
          "<div>" +
            `<div class="lc-name">${i + 1}. ${esc(m.name)}</div>` +
            '<div class="lc-meta">' +
              `<span class="lc-diff" style="background:${color}22;color:${color}">${DIFF_FACE[m.difficulty]} ${m.difficulty}</span>` +
              `<span class="lc-bpm">${m.bpm} BPM</span>` +
            "</div>" +
          "</div>" +
          `<div class="lc-best" style="background:${color}1f;color:${color}">${b >= 100 ? "👑" : b + "%"}</div>` +
        "</div>" +
        `<div class="lc-strip" style="background:linear-gradient(90deg,hsl(${m.hue} 70% 22%),hsl(${(m.hue + 40) % 360} 70% 12%))">${dots}</div>` +
        `<div class="lc-track"><i style="width:${b}%;background:${color}"></i></div>` +
      "</button>"
    );
  }).join("");
}

function renderScores() {
  const el = $("scores");
  if (!S.runs.length) {
    el.innerHTML = '<div class="empty">🏆<br>No runs yet — pick a level and start jumping.</div>';
    return;
  }
  const rows = S.runs.slice(0, 14).map((r, i) => {
    const img = sources[r.char] || fallbackSrc(CHARACTERS[r.char] || CHARACTERS[0]);
    const res = r.won ? '<span class="win-txt">COMPLETE 👑</span>' : '<span class="lose-txt">wiped out</span>';
    return (
      "<tr>" +
        `<td>${esc(r.levelName)}</td>` +
        `<td><img class="tiny-cube" src="${esc(img)}" alt="" /></td>` +
        `<td class="num">${r.pct}%</td>` +
        `<td>${res}</td>` +
      "</tr>"
    );
  }).join("");
  el.innerHTML =
    '<table class="scores-table"><thead><tr>' +
      '<th>Level</th><th>Chud</th><th class="num">%</th><th>Result</th>' +
    "</tr></thead><tbody>" + rows + "</tbody></table>";
}

function renderSettings() {
  const rows = [
    { key: "easy", label: "🍼 Easy Mode", desc: "Slower speeds, gentler layouts" },
    { key: "music", label: "🎵 Music", desc: "Synth beat synced to the level" },
    { key: "sfx", label: "🔊 Sound FX", desc: "Jumps, orbs and explosions" },
    { key: "shake", label: "📳 Screen shake", desc: "Juicy death feedback" },
  ];
  $("settings").innerHTML = rows.map((r) =>
    `<button class="set-row" data-setting="${r.key}">` +
      '<span class="set-text">' +
        `<span class="set-label">${r.label}</span>` +
        `<span class="set-desc">${r.desc}</span>` +
      "</span>" +
      `<span class="switch${S[r.key] ? " on" : ""}"><i></i></span>` +
    "</button>",
  ).join("");

  $("statAttempts").textContent = S.totalAttempts;
  $("statJumps").textContent = S.totalJumps;
  $("statClears").textContent = Object.values(S.bests).filter((v) => v >= 100).length;
}

function renderPlayBar() {
  const m = LEVELS[S.selectedLevel];
  const ch = charOf(S.selectedChar);
  $("barImg").src = ch.src;
  $("barImg").parentElement.style.setProperty("--c", ch.color);
  $("barSub").textContent = `Level ${S.selectedLevel + 1} · ${m.difficulty}${S.easy ? " · easy" : ""}`;
  $("barName").textContent = m.name;
}

function renderTabStats() {
  const done = Object.values(S.bests).filter((v) => v >= 100).length;
  const stars = Math.round(Object.values(S.bests).reduce((a, b) => a + b, 0) / 100);
  $("statDone").textContent = `✅ ${done}/15 done`;
  $("statStars").textContent = `⚡ ${stars} stars`;
}

function renderTab(tab) {
  $("levelsPanel").classList.toggle("hidden", tab !== "levels");
  $("scoresPanel").classList.toggle("hidden", tab !== "scores");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
}

/* --------------------------- game state --------------------------- */
const canvas = $("canvas");
const ctx2d = canvas.getContext("2d");

const G_ = {
  lvl: null,
  p: newPlayer(),
  charIndex: 0,
  attempts: 1,
  jumps: 0,
  pct: 0,
  input: false,
  best: 0,
  sprite: null,
  hideTimer: null,
};

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function openGame(index) {
  unlockAudio();
  S.selectedLevel = index;
  persist();

  const lvl = generateLevel(LEVELS[index], index, S.easy);
  const ch = charOf(S.selectedChar);

  G_.lvl = lvl;
  G_.p = newPlayer();
  G_.charIndex = S.selectedChar;
  G_.sprite = sprites[S.selectedChar];
  G_.attempts = 1;
  G_.jumps = 0;
  G_.pct = 0;
  G_.input = false;
  G_.best = best(index);
  particles.length = 0;
  cam.shake = 0;
  cam.flash = 0;

  phase = "ready";
  $("menu").classList.add("hidden");
  $("game").classList.remove("hidden");
  $("easyBadge").classList.toggle("hidden", !S.easy);
  $("hudName").textContent = lvl.name;
  $("hudPct").textContent = "0%";
  $("hudFill").style.width = "0%";
  $("hudFill").style.background = `linear-gradient(90deg, hsl(${lvl.hue} 90% 55%), white)`;
  if (G_.best > 0 && G_.best < 100) {
    $("hudBest").classList.remove("hidden");
    $("hudBest").style.left = G_.best + "%";
  } else {
    $("hudBest").classList.add("hidden");
  }

  $("readyImg").src = ch.src;
  $("readyImg").parentElement.style.setProperty("--c", ch.color);
  $("readyTag").textContent = `${lvl.difficulty} · ${lvl.bpm} BPM · ${Math.round(lvl.length / lvl.speed)}s`;
  $("readyTag").style.background = `hsl(${lvl.hue} 80% 50% / 0.25)`;
  $("readyTag").style.color = `hsl(${lvl.hue} 90% 75%)`;
  $("readyName").textContent = lvl.name;
  $("readyAttempt").textContent = "Attempt 1";
  $("ready").classList.remove("hidden");
  $("modal").classList.add("hidden");
  $("jumpscare").classList.add("hidden");

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
}

function closeGame() {
  clearHideTimer();
  stopMusic();
  phase = "menu";
  window.removeEventListener("resize", resize);
  $("game").classList.add("hidden");
  $("menu").classList.remove("hidden");
  renderMenu();
}

function clearHideTimer() {
  if (G_.hideTimer !== null) {
    clearTimeout(G_.hideTimer);
    G_.hideTimer = null;
  }
}

function resetRun(countAttempt) {
  clearHideTimer();
  G_.p = newPlayer();
  particles.length = 0;
  cam.shake = 0;
  cam.flash = 0;
  G_.input = false;
  if (countAttempt) G_.attempts += 1;
  G_.pct = 0;
  $("hudPct").textContent = "0%";
  $("hudFill").style.width = "0%";
  $("readyAttempt").textContent = "Attempt " + G_.attempts;
  $("jumpscare").classList.add("hidden");
  $("modal").classList.add("hidden");
  $("ready").classList.remove("hidden");
  phase = "ready";
  stopMusic();
}

function startRun() {
  unlockAudio();
  if (phase === "playing") return;
  phase = "playing";
  $("ready").classList.add("hidden");
  if (S.music) startMusic(G_.lvl.bpm, 200 + G_.lvl.hue * 3);
}

function die() {
  const p = G_.p;
  p.dead = true;
  G_.pct = Math.min(99, Math.floor((p.x / G_.lvl.length) * 100));
  if (S.shake) cam.shake = 1;
  cam.flash = 0.55;
  spawn("burst", p.x + 0.5, p.y + 0.5, G_.lvl.hue, 46, 2.4);
  sfx("die");
  stopMusic();
  $("jsImg").src = sources[G_.charIndex];
  $("jumpscare").classList.remove("hidden");
  clearHideTimer();
  G_.hideTimer = setTimeout(() => {
    $("jumpscare").classList.add("hidden");
    showDead();
  }, 780);
}

function win() {
  G_.p.won = true;
  G_.pct = 100;
  sfx("win");
  stopMusic();
  cam.flash = 0.35;
  spawn("burst", G_.p.x + 0.5, G_.p.y + 0.5, 120, 60, 3);
  showWon();
}

function modal(html) {
  $("modalCard").innerHTML = html;
  $("modal").classList.remove("hidden");
}

function showDead() {
  phase = "dead";
  const m = LEVELS[S.selectedLevel];
  const ch = charOf(G_.charIndex);
  recordRun({ score: G_.pct, level: S.selectedLevel, levelName: m.name, pct: G_.pct, char: G_.charIndex, won: false, jumps: G_.jumps });
  modal(
    '<div class="mc-face"><img src="' + esc(ch.src) + '" alt="" /></div>' +
    '<h3 class="mc-title dead">WASTED</h3>' +
    `<p class="mc-sub">${esc(m.name)} · attempt ${G_.attempts}</p>` +
    '<div class="mc-stats">' +
      `<div class="mc-stat"><div class="v">${G_.pct}%</div><div class="l">this run</div></div>` +
      `<div class="mc-stat"><div class="v">${Math.max(G_.best, G_.pct)}%</div><div class="l">best</div></div>` +
    "</div>" +
    '<div class="mc-actions">' +
      '<button class="mc-btn primary" data-act="retry">↻ RETRY <span class="kbd">(space)</span></button>' +
      '<button class="mc-btn ghost" data-act="menu">⌂ MENU <span class="kbd">(esc)</span></button>' +
    "</div>",
  );
  $("modalCard").classList.add("dead");
  $("modalCard").classList.remove("win");
}

function showWon() {
  phase = "won";
  const m = LEVELS[S.selectedLevel];
  recordRun({ score: 100, level: S.selectedLevel, levelName: m.name, pct: 100, char: G_.charIndex, won: true, jumps: G_.jumps });
  const next = S.selectedLevel < LEVELS.length - 1
    ? '<button class="mc-btn primary" data-act="next">▶ NEXT LEVEL</button>'
    : "";
  modal(
    '<div class="mc-crown">👑</div>' +
    '<h3 class="mc-title win">LEVEL COMPLETE</h3>' +
    `<p class="mc-sub">${esc(m.name)} · 100% · ${G_.jumps} jumps</p>` +
    '<div class="mc-stats">' +
      `<div class="mc-stat"><div class="v">${G_.attempts}</div><div class="l">attempts</div></div>` +
      `<div class="mc-stat"><div class="v">${G_.lvl.objs.length}</div><div class="l">objects</div></div>` +
    "</div>" +
    '<div class="mc-actions">' + next +
      '<button class="mc-btn ghost" data-act="again">↻ PLAY AGAIN</button>' +
      '<button class="mc-btn dim" data-act="menu">⌂ MENU</button>' +
    "</div>",
  );
  $("modalCard").classList.add("win");
  $("modalCard").classList.remove("dead");
}

function showPause() {
  phase = "paused";
  G_.input = false;
  stopMusic();
  const m = LEVELS[S.selectedLevel];
  modal(
    '<h3 class="mc-title">PAUSED</h3>' +
    `<p class="mc-sub">${esc(m.name)} · ${G_.pct}%</p>` +
    '<div class="mc-actions" style="margin-top:20px">' +
      '<button class="mc-btn primary" data-act="resume">▶ RESUME</button>' +
      '<button class="mc-btn ghost" data-act="retry">↻ RESTART</button>' +
      '<button class="mc-btn dim" data-act="menu">⌂ MENU</button>' +
    "</div>",
  );
  $("modalCard").classList.remove("win", "dead");
}

/* --------------------------- main loop --------------------------- */
let lastT = 0;
let acc = 0;
let elapsed = 0;

function loop(now) {
  if (phase === "menu") return;
  requestAnimationFrame(loop);

  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  elapsed += dt;
  const p = G_.p;

  if (phase === "playing") {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 400) {
      acc -= STEP;
      const ev = step(p, G_.input, G_.lvl);
      if (ev & EV.JUMP) {
        G_.jumps += 1;
        sfx("jump");
        spawn("dust", p.x + 0.5, p.y, G_.lvl.hue, 5, 1);
      }
      if (ev & EV.ORB) { sfx("orb"); spawn("burst", p.x + 0.5, p.y + 0.5, 48, 12, 1.4); }
      if (ev & EV.PAD) { sfx("pad"); spawn("burst", p.x + 0.5, p.y, 52, 12, 1.4); }
      if (ev & EV.LAND) spawn("dust", p.x + 0.5, p.y, G_.lvl.hue, 6, 0.8);
      if (ev & EV.DIE) { die(); break; }
      if (ev & EV.WIN) { win(); break; }
    }
    if (!p.dead && !p.won && Math.random() < 0.55) {
      spawn("trail", p.x + 0.1, p.y + 0.4, G_.charIndex === 1 ? 350 : 190, 1, 0.4);
    }
    const np = Math.min(100, Math.floor((p.x / G_.lvl.length) * 100));
    if (np !== G_.pct) {
      G_.pct = np;
      $("hudPct").textContent = np + "%";
      $("hudFill").style.width = np + "%";
    }
  }

  updateParticles(dt);
  cam.shake = Math.max(0, cam.shake - dt * 3.2);
  cam.flash = Math.max(0, cam.flash - dt * 2.4);

  draw(ctx2d, window.innerWidth, window.innerHeight, G_.lvl, p, charOf(G_.charIndex), G_.sprite, elapsed, G_.attempts);
}

/* --------------------------- input --------------------------- */
function press() {
  if (phase === "ready") {
    startRun();
    G_.input = true;
    return;
  }
  if (phase === "playing") {
    G_.input = true;
    return;
  }
  if (phase === "dead") resetRun(true);
}

function release() {
  G_.input = false;
}

function pauseToggle() {
  if (phase === "playing") {
    showPause();
    $("pauseBtn").textContent = "▶";
  } else if (phase === "paused") {
    closeModal();
    startRun();
    $("pauseBtn").textContent = "⏸";
  }
}

function closeModal() {
  $("modal").classList.add("hidden");
}

document.addEventListener("keydown", (e) => {
  const k = e.code;
  if (k === "Space" || k === "ArrowUp" || k === "KeyW") {
    e.preventDefault();
    if (e.repeat) return;
    if (phase === "won") { resetRun(false); return; }
    press();
  } else if (k === "Escape" || k === "KeyP") {
    e.preventDefault();
    if (phase === "menu") return;
    if (phase === "dead") closeGame();
    else pauseToggle();
    $("pauseBtn").textContent = phase === "paused" ? "▶" : "⏸";
  } else if (k === "KeyR") {
    e.preventDefault();
    if (phase !== "menu") resetRun(true);
  } else if (k === "KeyM") {
    if (phase !== "menu") closeGame();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") release();
});

/* --------------------------- event wiring --------------------------- */
$("touch").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockAudio();
  press();
});
$("touch").addEventListener("pointerup", (e) => { e.preventDefault(); release(); });
$("touch").addEventListener("pointercancel", release);
$("touch").addEventListener("pointerleave", release);
$("touch").addEventListener("contextmenu", (e) => e.preventDefault());

$("pauseBtn").addEventListener("pointerdown", (e) => e.stopPropagation());
$("pauseBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  pauseToggle();
});

$("playBtn").addEventListener("click", () => {
  sfx("click");
  openGame(S.selectedLevel);
});

$("modalCard").addEventListener("pointerdown", (e) => e.stopPropagation());
$("modalCard").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  e.stopPropagation();
  const act = btn.dataset.act;
  $("pauseBtn").textContent = "⏸";
  if (act === "resume") { closeModal(); startRun(); }
  else if (act === "retry") resetRun(true);
  else if (act === "again") resetRun(false);
  else if (act === "next") openGame(S.selectedLevel + 1);
  else if (act === "menu") closeGame();
});

document.querySelector(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  sfx("click");
  renderTab(t.dataset.tab);
});

document.body.addEventListener("click", (e) => {
  const el = e.target.closest("[data-char],[data-level],[data-setting]");
  if (!el) return;
  if (el.dataset.char !== undefined) {
    sfx("click");
    S.selectedChar = +el.dataset.char;
    persist();
    renderChars();
    renderTitle();
    renderPlayBar();
  } else if (el.dataset.level !== undefined) {
    sfx("click");
    S.selectedLevel = +el.dataset.level;
    persist();
    renderLevels();
    renderPlayBar();
  } else if (el.dataset.setting) {
    sfx("click");
    const key = el.dataset.setting;
    S[key] = !S[key];
    persist();
    if (key === "music") setMusicOn(S.music);
    if (key === "sfx") setSfxOn(S.sfx);
    renderSettings();
    renderPlayBar();
  }
});

/* --------------------------- boot --------------------------- */
setMusicOn(S.music);
setSfxOn(S.sfx);
renderMenu();
bootImages();
