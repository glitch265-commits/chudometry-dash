/* ===================== Chudometry Dash — characters.js ===================== */

export const CHARACTERS = [
  {
    name: "Classic Chud",
    tag: "the bowl cut boss",
    color: "#22d3ee",
    color2: "#a3e635",
    // 👇 the real picture goes here
    files: ["chud.jpg", "chud.jpeg", "chud.png", "chud.webp"],
  },
  {
    name: "Dragon Chud",
    tag: "hoodie up, head back",
    color: "#f43f5e",
    color2: "#fbbf24",
    files: ["chud 1.jpg", "chud1.jpg", "chud 1.jpeg", "chud 1.png", "chud1.png", "chud 1.webp"],
  },
  {
    name: "Fluffy Chud",
    tag: "soft hair, softer jumps",
    color: "#a855f7",
    color2: "#34d399",
    files: ["chud 2.jpg", "chud2.jpg", "chud 2.jpeg", "chud 2.png", "chud2.png", "chud 2.webp"],
  },
];

const BASE = document.baseURI.replace(/index\.html.*$/, "");

/** Stand-in cube art, drawn as an SVG data URL so no extra files are needed. */
export function fallbackSrc(c) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + c.color + '"/><stop offset="1" stop-color="' + c.color2 + '"/>' +
    "</linearGradient></defs>" +
    '<rect width="256" height="256" rx="28" fill="#0b1030"/>' +
    '<rect x="10" y="10" width="236" height="236" rx="22" fill="url(#g)" opacity="0.9"/>' +
    '<rect x="10" y="10" width="236" height="236" rx="22" fill="none" stroke="#fff" stroke-width="8"/>' +
    "</svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/**
 * Every path worth trying for a character, in priority order.
 * Covers all three ways this folder can be laid out:
 *   characters/chud.jpg      <- raw source deployed straight to Pages
 *   chud.jpg                 <- loose in the repo root
 *   public/characters/...    <- repo root served before a build step runs
 */
export function srcCandidates(c) {
  const enc = c.files.map((f) => encodeURIComponent(f));
  return [
    ...enc.map((f) => BASE + "characters/" + f),
    ...enc.map((f) => BASE + f),
    ...enc.map((f) => BASE + "public/characters/" + f),
  ];
}

function probe(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 1);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Preload the sprite for the canvas. */
export function loadSprite(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Work out which file actually exists for each slot. Returns the src to use
 * plus whether it's your real photo (false = built-in stand-in).
 */
export async function resolveSources() {
  const sources = [];
  const found = [];
  for (const c of CHARACTERS) {
    let hit = null;
    for (const url of srcCandidates(c)) {
      if (await probe(url)) {
        hit = url;
        break;
      }
    }
    sources.push(hit || fallbackSrc(c));
    found.push(hit !== null);
  }
  return { sources, found };
}
