/* ===================== Chudometry Dash — audio.js =====================
 * A tiny WebAudio synth: looping kick/hat/snare/bass/arp locked to the level
 * BPM, plus one-shot sound effects. No audio files needed.
 * --------------------------------------------------------------------- */

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;

let timer = null;
let step16 = 0;
let nextTime = 0;
let bpm = 130;
let scaleRoot = 220;
let running = false;

export const audio = { musicOn: true, sfxOn: true };

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = audio.musicOn ? 0.22 : 0;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = audio.sfxOn ? 0.5 : 0;
    sfxGain.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function setMusicOn(on) {
  audio.musicOn = on;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.05);
  if (on && running) startMusic(bpm, scaleRoot, true);
}

export function setSfxOn(on) {
  audio.sfxOn = on;
  if (sfxGain && ctx) sfxGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
}

function blip(freq, time, dur, type, gain, dest, slideTo) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), time + dur);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g);
  g.connect(dest);
  o.start(time);
  o.stop(time + dur + 0.02);
}

function noise(time, dur, gain, dest) {
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 900;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(time);
}

const MINOR = [0, 3, 5, 7, 10];

export function startMusic(newBpm, root, force) {
  const c = ensure();
  if (!c) return;
  bpm = newBpm;
  scaleRoot = root;
  if (running && !force) return;
  stopMusic();
  running = true;
  step16 = 0;
  nextTime = c.currentTime + 0.08;
  const spb = 60 / bpm / 4;

  const schedule = () => {
    const dest = musicGain;
    if (!ctx || !dest) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const t = nextTime;
      const s = step16 % 32;
      if (s % 8 === 0) blip(120, t, 0.16, "sine", 0.9, dest, 45);              // kick
      if (s % 4 === 2) noise(t, 0.05, 0.25, dest);                             // hat
      if (s % 16 === 8) noise(t, 0.12, 0.4, dest);                             // snare
      if (s % 4 === 0) {                                                       // bass
        const deg = MINOR[(Math.floor(step16 / 16) * 2) % MINOR.length];
        blip(((scaleRoot / 2) * Math.pow(2, deg / 12)), t, spb * 3.2, "square", 0.22, dest);
      }
      const deg = MINOR[(step16 * 3) % MINOR.length];                          // arp
      const oct = step16 % 8 < 4 ? 2 : 3;
      blip(scaleRoot * Math.pow(2, deg / 12) * (oct / 2), t, spb * 1.6, "triangle", 0.13, dest);
      step16++;
      nextTime += spb;
    }
    timer = setTimeout(schedule, 60);
  };
  schedule();
}

export function stopMusic() {
  running = false;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

export function sfx(kind) {
  const c = ensure();
  if (!c || !sfxGain) return;
  const t = c.currentTime;
  const dest = sfxGain;
  switch (kind) {
    case "jump": blip(520, t, 0.09, "square", 0.18, dest, 880); break;
    case "orb": blip(700, t, 0.14, "triangle", 0.26, dest, 1400); break;
    case "pad": blip(300, t, 0.2, "sawtooth", 0.22, dest, 1200); break;
    case "die": blip(420, t, 0.5, "sawtooth", 0.32, dest, 60); noise(t, 0.3, 0.35, dest); break;
    case "win":
      [0, 4, 7, 12].forEach((n, i) => blip(440 * Math.pow(2, n / 12), t + i * 0.11, 0.3, "triangle", 0.28, dest));
      break;
    case "click": blip(880, t, 0.05, "square", 0.12, dest); break;
  }
}
