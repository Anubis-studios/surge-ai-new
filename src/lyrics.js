// src/lyrics.js
// AI lyric generation (via the ai-text-plugin) with a template fallback so the
// studio keeps working even if the AI service is unavailable.

export function syllableCount(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  let n = 0;
  for (const w of words) {
    const reduced = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    const m = reduced.match(/[aeiouy]{1,2}/g);
    n += m ? m.length : 1;
  }
  return Math.max(1, n);
}

const SECTION_LABELS = {
  verse1: "Verse 1", verse2: "Verse 2", prechorus: "Pre-Chorus",
  chorus: "Chorus", finalchorus: "Final Chorus", bridge: "Bridge",
};

function normalizeSection(raw) {
  const s = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (/verse1|verseone|vers1/.test(s) || (s.includes("verse") && s.includes("1"))) return "verse1";
  if (/verse2|versetwo/.test(s) || (s.includes("verse") && s.includes("2"))) return "verse2";
  if (s.includes("pre") && s.includes("chorus")) return "prechorus";
  if (s.includes("final") && s.includes("chorus")) return "finalchorus";
  if (s.includes("chorus")) return "chorus";
  if (s.includes("bridge")) return "bridge";
  if (s.includes("outro")) return "outro";
  if (s.includes("intro")) return "intro";
  return null;
}

export function parseLyrics(text) {
  const title = { value: null };
  const sections = {};
  let current = null;
  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.replace(/\r/g, "");
    const t = line.trim();
    if (!t) continue;
    const tm = t.match(/^title\s*[:：]\s*(.+)$/i);
    if (tm) { title.value = tm[1].trim().replace(/[<>]/g, "").slice(0, 60); continue; }
    const sm = t.match(/^\[(.*)\]$/);
    if (sm) {
      const key = normalizeSection(sm[1]);
      if (key && key !== "intro" && key !== "outro") {
        current = key;
        if (!sections[key]) sections[key] = [];
      }
      continue;
    }
    if (current && !t.startsWith("[") && !/^(title|verse|chorus|bridge|pre|outro|intro)/i.test(t) && t.length < 90) {
      const clean = t.replace(/^[•\-\*\d\.\)\s]+/, "").trim();
      if (clean && sections[current].length < 10) sections[current].push({ text: clean, syllables: syllableCount(clean) });
    }
  }
  return { title: title.value || "", sections };
}

// Fills missing/undersized sections with plausible placeholder lines so the
// song always has a complete structure.
export function ensureSections(sections, fallback) {
  const out = {};
  for (const key of ["verse1", "verse2", "prechorus", "chorus", "finalchorus", "bridge"]) {
    const existing = sections[key] || [];
    const min = key === "prechorus" ? 2 : 3;
    const fb = fallback[key] || [];
    const merged = [...existing, ...fb.slice(existing.length)];
    out[key] = merged.slice(0, Math.max(min, merged.length)).map((l) => ({
      text: typeof l === "string" ? l : l.text,
      syllables: typeof l === "string" ? syllableCount(l) : l.syllables,
    }));
  }
  return out;
}

export function buildLyricsInstruction({ prompt, style, mood }) {
  return [
    `You are a professional songwriter. Write original lyrics for a brand-new song. Be vivid, specific and emotionally honest. Avoid clichés and filler words. Vary the length of lines. It should feel like a real, finished song.`,
    ``,
    `STYLE: ${style ? style.vibe : "pop"}`,
    `CONCEPT: ${prompt || "an original song"}`,
    mood ? `EXTRA MOOD: ${mood}` : "",
    ``,
    `OUTPUT EXACTLY in this format, with no extra commentary:`,
    `Title: <one-to-four-word title>`,
    ``,
    `[Verse 1]`,
    `<4 lines>`,
    ``,
    `[Pre-Chorus]`,
    `<2 lines>`,
    ``,
    `[Chorus]`,
    `<4 lines>`,
    ``,
    `[Verse 2]`,
    `<4 lines>`,
    ``,
    `[Bridge]`,
    `<4 lines>`,
    ``,
    `[Final Chorus]`,
    `<4 lines — echo the chorus with a final twist>`,
    ``,
    `Rules:`,
    `- Put each lyric line on its own line. One blank line between sections, none inside a section.`,
    `- 3 to 12 words per line.`,
    `- Keep the narrator's voice, imagery and story consistent across sections.`,
  ].filter(Boolean).join("\n");
}

export function buildRegenInstruction({ prompt, style, title, sections, target }) {
  const lines = [];
  lines.push(`You are a professional songwriter. You are revising ONE section of an existing song. Be vivid, specific and emotionally honest.`);
  lines.push(``);
  lines.push(`EXISTING SONG`);
  lines.push(`Title: ${title || "Untitled"}`);
  lines.push(`Style: ${style ? style.vibe : "pop"}`);
  lines.push(`Concept: ${prompt || "an original song"}`);
  lines.push(``);
  lines.push(`LYRICS SO FAR:`);
  for (const key of ["verse1", "prechorus", "chorus", "verse2", "bridge", "finalchorus"]) {
    const sec = sections[key];
    if (!sec || !sec.length) continue;
    lines.push(`[${SECTION_LABELS[key]}]`);
    for (const l of sec) lines.push(l.text);
    lines.push(``);
  }
  lines.push(`TASK: Rewrite ONLY the [${SECTION_LABELS[target]}] section. Keep roughly the same number of lines (${sections[target] ? sections[target].length : 4}) and the same song's voice. Output ONLY the section, starting with the label:`);
  lines.push(`[${SECTION_LABELS[target]}]`);
  return lines.join("\n");
}

export async function generateLyrics({ prompt, style, mood }, onChunk) {
  const instruction = buildLyricsInstruction({ prompt, style, mood });
  let result;
  try {
    result = await window.root.generateText({
      instruction,
      onChunk: (d) => { if (onChunk) onChunk(d.textChunk, d.fullTextSoFar); },
    });
  } catch (e) {
    throw new Error("generateText failed: " + e.message);
  }
  return parseLyrics(result.generatedText || result.text || "");
}

export async function regenerateSection({ prompt, style, title, sections, target }, onChunk) {
  const instruction = buildRegenInstruction({ prompt, style, title, sections, target });
  let result;
  try {
    result = await window.root.generateText({
      instruction,
      onChunk: (d) => { if (onChunk) onChunk(d.textChunk); },
    });
  } catch (e) {
    throw new Error("generateText failed: " + e.message);
  }
  const parsed = parseLyrics(result.generatedText || result.text || "");
  const got = parsed.sections[target] || [];
  if (!got.length) throw new Error("The AI returned no usable lines for that section.");
  return got;
}

// ------------------------------------------------------------ fallback

const FB = {
  adj: ["golden", "hollow", "restless", "quiet", "distant", "tender", "fading", "restless", "wild", "quiet", "burning", "drunken"],
  noun: ["streetlights", "fireflies", "ocean", "highway", "midnight", "summer", "rain", "city", "sunday", "ghosts", "horizon", "letters", "windows", "neon", "winter", "daylight", "maps", "tides", "station", "garden"],
  verb: ["run", "stay", "drown", "burn", "chase", "let go", "remember", "forgive", "wander", "fade", "hold", "break", "swim", "shout"],
  emo: ["lonely", "free", "reckless", "safe", "lost", "whole", "alive", "fragile"],
  verse: [
    "{adj} {noun} and the {noun} keeps calling",
    "I feel so {emo} in the {noun}",
    "We {verb}ed through the {noun} all night",
    "{Adj} as the {noun} {verb}s away",
    "You said {noun}, I said {noun}",
    "Under the {noun} we {verb}ed",
    "{Emo} in the morning light",
    "The {noun} {verb}s but we stay",
    "Tell me again how the {noun} falls",
    "I {verb} like the {noun} believes me",
  ],
  pre: [
    "Hold on, the {noun} is calling",
    "I can feel the {noun} rising",
    "Close your eyes and {verb}",
    "Now the {noun} knows our names",
    "One more {noun} and we're leaving",
  ],
  chorus: [
    "And we {verb} till the {noun} {verb}s",
    "{Emo} as the {noun} turns",
    "We {verb}, we {verb}, we don't look back",
    "{Adj} {noun}, {adj} {noun}",
    "Carry me home like the {noun}",
    "All I want is a {adj} {noun}",
    "We were {adj} and never coming home",
  ],
  bridge: [
    "And if the {noun} falls down",
    "We'll {verb} it back together",
    "Every {noun} is a letter",
    "Written in {adj} {noun}",
    "Nobody {verb}s the way we do",
  ],
};

function fill(tpl, rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return tpl
    .replace(/\{adj\}/g, () => pick(FB.adj))
    .replace(/\{Adj\}/g, () => { const w = pick(FB.adj); return w[0].toUpperCase() + w.slice(1); })
    .replace(/\{noun\}/g, () => pick(FB.noun))
    .replace(/\{verb\}ed/g, () => pick(FB.verb).replace(/e$/, "") + "ed")
    .replace(/\{verb\}s/g, () => pick(FB.verb) + "s")
    .replace(/\{verb\}/g, () => pick(FB.verb))
    .replace(/\{emo\}/g, () => pick(FB.emo))
    .replace(/\{Emo\}/g, () => { const w = pick(FB.emo); return w[0].toUpperCase() + w.slice(1); });
}

export function buildFallbackLyrics(seed, style) {
  const rng = mulberry32Local(seed);
  const titleWord = () => `${fill("{adj}", rng)} ${fill("{noun}", rng)}`;
  const make = (pool, n, rng) => {
    const idxs = [];
    const start = Math.floor(rng() * pool.length);
    for (let i = 0; i < n; i++) idxs.push(pool[(start + i) % pool.length]);
    return idxs.map((tpl) => fill(tpl, rng));
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const title = cap(titleWord());
  const verse1 = make(FB.verse, 4, rng);
  const verse2 = make(FB.verse.slice(4), 4, rng);
  const prechorus = make(FB.pre, 2, rng);
  const chorus = make(FB.chorus, 4, rng);
  const bridge = make(FB.bridge, 4, rng);
  const finalchorus = [...chorus.slice(0, 3), `...${chorus[0].toLowerCase()}`];
  const toSections = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [
    k, v.map((text) => ({ text, syllables: syllableCount(text) })),
  ]));
  return { title, sections: toSections({ verse1, verse2, prechorus, chorus, finalchorus, bridge }) };
}

function mulberry32Local(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
