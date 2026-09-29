/* Dev check: proves every generated level can be finished.
 * Run with:  node scripts/verify.mjs
 */
import { EV, LEVELS, STEP, generateLevel, newPlayer, step } from "../levels.js";

function verify(lvl, K, phase, cap = 900) {
  let states = [newPlayer()];
  const total = Math.ceil(lvl.length / (lvl.speed * STEP)) + 20;
  for (let s = 0; s < total; s++) {
    const decide = (s + phase) % K === 0;
    const next = [];
    const seen = new Set();
    for (const st of states) {
      const a = decide ? 0 : st.held ? 1 : 0;
      const b = decide ? 1 : a;
      for (let inp = a; inp <= b; inp++) {
        const p = { ...st };
        const ev = step(p, inp === 1, lvl);
        if (p.dead) continue;
        if (ev & EV.WIN) return true;
        const flags = (p.onGround ? 1 : 0) | (p.held ? 2 : 0) | (p.fresh ? 4 : 0);
        const key = `${Math.round(p.y * 200)}|${Math.round(p.vy * 20)}|${flags}|${p.lastOrb}|${p.lastPad}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(p);
      }
    }
    if (!next.length) return false;
    states = next.length > cap ? next.slice(0, cap) : next;
  }
  return false;
}

let allOk = true;
for (const easy of [false, true]) {
  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = generateLevel(LEVELS[i], i, easy);
    let ok = false;
    for (let phase = 0; phase < 4 && !ok; phase++) ok = verify(lvl, LEVELS[i].K, phase);
    if (!ok) allOk = false;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${easy ? "easy    " : "original"} #${String(i + 1).padStart(2, "0")} ` +
        `${LEVELS[i].name} (objs ${lvl.objs.length}, len ${Math.round(lvl.length)})`,
    );
  }
}
console.log(allOk ? "ALL LEVELS BEATABLE" : "SOME LEVELS FAILED");
if (!allOk) process.exit(1);
