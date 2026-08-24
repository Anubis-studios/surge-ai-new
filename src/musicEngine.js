// src/musicEngine.js
// Procedural generative music engine for Surge.AI Studio.
// Given a style, bpm, key and lyric syllable schedule it composes a full
// song (structure, chords, drums, bass, melody) and renders it offline to an
// AudioBuffer. Deterministic per seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
};

const NOTE_SEMI = { C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mod = (n, m) => ((n % m) + m) % m;
const BAR = 4;

// ---------------------------------------------------------------- styles

export const STYLES = [
  {
    id: "lofi", name: "Lo-Fi", tagline: "Chill beats to daydream to",
    bpm: [72, 84], harmonyScale: "minor", melodyScale: "minorPentatonic",
    progressions: [[1, 6, 3, 7], [6, 3, 1, 7], [3, 6, 4, 5]],
    bridgeProgressions: [[6, 7, 1, 1], [4, 1, 5, 1]],
    drums: "lofi", bass: "round", chords: "keys", lead: "ep", arp: true, add7: true,
    swing: 0.55, texture: "sparse",
    vibe: "melancholic, nostalgic, warm and hazy",
    pal: ["#5eead4", "#38bdf8", "#fb923c"],
  },
  {
    id: "pop", name: "Pop", tagline: "Bright and anthemic",
    bpm: [112, 126], harmonyScale: "major", melodyScale: "majorPentatonic",
    progressions: [[1, 5, 6, 4], [6, 4, 1, 5], [4, 1, 5, 6]],
    bridgeProgressions: [[4, 5, 1, 6], [6, 4, 5, 5]],
    drums: "fourfloor", bass: "pulse", chords: "pad", lead: "warm", arp: true, add7: false,
    swing: 0, texture: "mid",
    vibe: "bright, uplifting, feel-good and anthemic",
    pal: ["#c084fc", "#818cf8", "#f472b6"],
  },
  {
    id: "hiphop", name: "Hip-Hop", tagline: "Smooth and confident",
    bpm: [82, 96], harmonyScale: "minor", melodyScale: "minorPentatonic",
    progressions: [[1, 7, 6, 5], [1, 5, 6, 4], [4, 5, 1, 6]],
    bridgeProgressions: [[6, 5, 4, 5], [1, 7, 6, 6]],
    drums: "hiphop", bass: "deep", chords: "stabs", lead: "pluck", arp: false, add7: true,
    swing: 0.6, texture: "mid",
    vibe: "laid-back, smooth, streetwise and confident",
    pal: ["#fbbf24", "#f97316", "#a855f7"],
  },
  {
    id: "rock", name: "Rock", tagline: "Loud guitars, big chorus",
    bpm: [128, 148], harmonyScale: "major", melodyScale: "major",
    progressions: [[1, 5, 6, 4], [4, 1, 5, 6], [6, 4, 1, 5]],
    bridgeProgressions: [[4, 5, 6, 4], [6, 5, 4, 4]],
    drums: "rock", bass: "distorted", chords: "guitarish", lead: "saw", arp: false, add7: false,
    swing: 0, texture: "dense",
    vibe: "gritty, energetic, rebellious and anthemic",
    pal: ["#f87171", "#fb7185", "#eab308"],
  },
  {
    id: "electronic", name: "Electronic", tagline: "Pulsing club energy",
    bpm: [122, 132], harmonyScale: "minor", melodyScale: "minor",
    progressions: [[1, 7, 1, 6], [1, 5, 6, 4], [5, 6, 4, 1]],
    bridgeProgressions: [[6, 7, 1, 1]],
    drums: "dance", bass: "pulse", chords: "stabs", lead: "square", arp: true, add7: false,
    swing: 0, texture: "dense",
    vibe: "pulsing, euphoric, nocturnal and high-energy",
    pal: ["#22d3ee", "#a78bfa", "#f0abfc"],
  },
  {
    id: "rnb", name: "R&B", tagline: "Silky late-night soul",
    bpm: [80, 92], harmonyScale: "minor", melodyScale: "minorPentatonic",
    progressions: [[1, 3, 6, 5], [2, 5, 1, 6], [6, 4, 1, 5]],
    bridgeProgressions: [[3, 6, 4, 5], [2, 5, 6, 6]],
    drums: "hiphop", bass: "deep", chords: "keys", lead: "warm", arp: false, add7: true,
    swing: 0.5, texture: "sparse",
    vibe: "sensual, smooth, silky and late-night",
    pal: ["#f472b6", "#a855f7", "#fb7185"],
  },
  {
    id: "synthwave", name: "Synthwave", tagline: "Neon-drenched 80s",
    bpm: [100, 112], harmonyScale: "minor", melodyScale: "minor",
    progressions: [[1, 6, 3, 7], [1, 5, 6, 4], [6, 4, 1, 5]],
    bridgeProgressions: [[6, 4, 1, 5], [3, 7, 1, 1]],
    drums: "fourfloor", bass: "deep", chords: "pad", lead: "saw", arp: true, add7: false,
    swing: 0, texture: "dense",
    vibe: "retro, neon, cinematic and nostalgic for the future",
    pal: ["#f472b6", "#22d3ee", "#8b5cf6"],
  },
  {
    id: "acoustic", name: "Acoustic", tagline: "Warm and heartfelt",
    bpm: [86, 100], harmonyScale: "major", melodyScale: "major",
    progressions: [[1, 5, 6, 4], [1, 3, 4, 5], [4, 5, 1, 6]],
    bridgeProgressions: [[6, 4, 1, 5], [4, 1, 5, 1]],
    drums: "light", bass: "round", chords: "guitarish", lead: "flute", arp: false, add7: false,
    swing: 0.1, texture: "sparse",
    vibe: "warm, heartfelt, gentle and storybook",
    pal: ["#a3e635", "#fbbf24", "#f97316"],
  },
  {
    id: "jazz", name: "Late-Night Jazz", tagline: "Smoky and sophisticated",
    bpm: [104, 118], harmonyScale: "dorian", melodyScale: "dorian",
    progressions: [[1, 6, 2, 5], [3, 6, 2, 5], [1, 4, 2, 5]],
    bridgeProgressions: [[6, 2, 5, 1], [2, 5, 1, 1]],
    drums: "light", bass: "round", chords: "keys", lead: "pluck", arp: false, add7: true,
    swing: 0.65, texture: "mid",
    vibe: "smoky, playful, sophisticated and nocturnal",
    pal: ["#fde047", "#fb923c", "#c084fc"],
  },
  {
    id: "ambient", name: "Ambient", tagline: "Ethereal and spacious",
    bpm: [62, 72], harmonyScale: "major", melodyScale: "lydian",
    progressions: [[1, 3, 4, 1], [1, 6, 4, 5], [4, 5, 1, 1]],
    bridgeProgressions: [[4, 5, 1, 1], [6, 5, 1, 3]],
    drums: "none", bass: "round", chords: "pad", lead: "flute", arp: true, add7: true,
    swing: 0, texture: "sparse",
    vibe: "ethereal, calm, dreamy and spacious",
    pal: ["#67e8f9", "#a5b4fc", "#f9a8d4"],
  },
];

export const SONG_PLAN = [
  { id: "intro", name: "intro" },
  { id: "verse1", name: "verse" },
  { id: "prechorus1", name: "prechorus" },
  { id: "chorus1", name: "chorus" },
  { id: "verse2", name: "verse" },
  { id: "prechorus2", name: "prechorus" },
  { id: "chorus2", name: "chorus" },
  { id: "bridge", name: "bridge" },
  { id: "chorus3", name: "chorus" },
  { id: "outro", name: "outro" },
];

const barsFor = (name, mode) => ({
  short: { intro: 2, verse: 6, prechorus: 3, chorus: 6, bridge: 6, outro: 2 },
  standard: { intro: 4, verse: 8, prechorus: 4, chorus: 8, bridge: 8, outro: 4 },
  extended: { intro: 4, verse: 10, prechorus: 4, chorus: 10, bridge: 10, outro: 6 },
}[mode][name]);

const rot = (arr, n) => arr.slice(n).concat(arr.slice(0, n));

function chordSeqFor(sec, style, rng) {
  const main = style.progressions[Math.floor(rng() * Math.min(2, style.progressions.length))];
  const alt = style.progressions[2] || main;
  switch (sec.name) {
    case "intro": return [main[0], main[1], main[0], main[1]];
    case "verse": return sec.id === "verse2" ? rot(main, 1) : main;
    case "prechorus": return [main[2], main[3], main[2], main[3]];
    case "chorus": return sec.id === "chorus3" ? rot(main, 1) : (sec.id === "chorus2" ? alt : main);
    case "bridge": return (style.bridgeProgressions || [main])[Math.floor(rng() * style.bridgeProgressions.length)];
    case "outro": return [main[0], main[3], main[0], main[0]];
    default: return main;
  }
}

function chordTones(tonic, scale, degree) {
  const idx = mod(degree - 1, scale.length);
  return [
    tonic + scale[idx],
    tonic + scale[(idx + 2) % scale.length],
    tonic + scale[(idx + 4) % scale.length],
  ];
}

function voicingFor(style, base, scale, degree) {
  const tones = chordTones(base, scale, degree);
  const notes = [tones[0] + 12, tones[1] + 12, tones[2] + 12];
  if (style.chords !== "stabs") notes.push(tones[0] + 24);
  if (style.add7) {
    const idx = mod(degree - 1, scale.length);
    notes.push(base + scale[(idx + 6) % scale.length] + 12);
  }
  return notes.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- compose

export function composeSong(opts) {
  const { seed, style, bpm, rootName, mode = "standard", lyrics } = opts;
  const rng = mulberry32(seed);
  const scale = SCALES[style.harmonyScale];
  const tonicMidi = 36 + NOTE_SEMI[rootName];
  const beatDur = 60 / bpm;
  const sw = style.swing || 0;

  const sections = [];
  let beat = 0;
  const energyOf = { intro: 1, verse: 2, prechorus: 3, chorus: 4, bridge: 2, outro: 1 };
  for (const p of SONG_PLAN) {
    const bars = barsFor(p.name, mode);
    const sec = {
      id: p.id, name: p.name, bars,
      startBeat: beat, endBeat: beat + bars * BAR,
      energy: energyOf[p.name],
    };
    const seq = chordSeqFor(sec, style, rng);
    sec.chords = [];
    for (let b = 0; b < bars; b++) {
      const degree = seq[b % seq.length];
      const root = tonicMidi + scale[mod(degree - 1, scale.length)];
      sec.chords.push({
        degree,
        root,
        tones: chordTones(tonicMidi + 12, scale, degree),
        voicing: voicingFor(style, tonicMidi + 12, scale, degree),
      });
    }
    sections.push(sec);
    beat = sec.endBeat;
  }

  const lineSchedule = placeLines(lyrics, sections);

  const events = [];
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const nextE = sections[si + 1] ? sections[si + 1].energy : 0;
    for (let b = 0; b < sec.bars; b++) {
      const bs = sec.startBeat + b * BAR;
      const ch = sec.chords[b];
      events.push(...drumEventsForBar(bs, style, sec.energy, rng, sw));
      events.push(...bassEventsForBar(bs, ch.root, style, sec.energy, rng, sw));
      events.push(...chordEventsForBar(bs, ch, style, sec.energy, rng, sw));
      if (nextE > sec.energy && b === sec.bars - 1) {
        for (let k = 0; k < 4; k++) events.push({ beat: bs + 3 + k * 0.25, type: "snare", vel: 0.5 });
        events.push({ beat: bs + 3.75, type: "oh" });
        if (nextE >= 4) events.push({ beat: bs + BAR, type: "crash" });
      }
    }
    if (sec.name === "prechorus") {
      events.push({ beat: sec.endBeat - 1.5, type: "riser", dur: 1.5 });
    }
    if (sec.name === "intro") events.push(...introMotif(sec, style, tonicMidi, rng));
    events.push(...genMelody(sec, lineSchedule, style, tonicMidi, rng));
    if (sec.name === "outro") {
      const endTonic = tonicMidi + scale[0];
      events.push({
        beat: sec.endBeat - 1.5, type: "endpad", dur: 3.0,
        midis: [endTonic + 12, endTonic + 16, endTonic + 19, endTonic + 24],
      });
    }
  }

  const evs = events.map((e) => ({ ...e, t: e.t * beatDur })).sort((a, b) => a.t - b.t);
  const duration = beat * beatDur;
  return {
    events: evs, sections, lineSchedule, duration,
    bpm, rootName, tonicMidi, styleId: style.id, styleName: style.name,
    seed, mode,
    patch: { lead: style.lead, chords: style.chords, bass: style.bass },
  };
}

function placeLines(lyrics, sections) {
  const out = [];
  for (const sec of sections) {
    const ls = lyrics && lyrics[sec.id];
    if (!ls || !ls.length) continue;
    const totalBeats = sec.endBeat - sec.startBeat;
    const w = ls.map((l) => Math.max(1, l.syllables || 4));
    const sum = w.reduce((a, b) => a + b, 0);
    const avail = totalBeats * 0.92;
    let t = sec.startBeat + 0.5;
    for (let i = 0; i < ls.length; i++) {
      const dur = (w[i] / sum) * avail;
      out.push({ sectionId: sec.id, text: ls[i].text, syllables: w[i], startBeat: t, endBeat: t + dur });
      t += dur + 0.15;
    }
  }
  return out;
}

const swingBeat = (b, sw) => {
  if (!sw) return b;
  const q = Math.round(b * 2);
  return q % 2 === 1 ? b + sw * 0.22 : b;
};

function chordAtBeat(sec, bt) {
  const bi = Math.max(0, Math.min(sec.chords.length - 1, Math.floor((bt - sec.startBeat) / BAR)));
  return sec.chords[bi];
}

function genMelody(sec, lineSchedule, style, tonicMidi, rng) {
  const events = [];
  const lines = lineSchedule.filter((l) => l.sectionId === sec.id);
  if (!lines.length) return events;
  const mscale = SCALES[style.melodyScale || style.harmonyScale];
  const base = tonicMidi + 24 + (sec.energy >= 3 ? 12 : 0);
  const sm = [];
  for (let o = 0; o < 3; o++) for (const s of mscale) sm.push(base + o * 12 + s);
  const iMax = sm.length;
  const near = (tms) => {
    let best = 0, bd = 1e9;
    for (let k = 0; k < iMax; k++) for (const tm of tms) {
      const d = Math.abs(sm[k] - tm);
      if (d < bd) { bd = d; best = k; }
    }
    return Math.max(4, Math.min(iMax - 5, best));
  };
  let pos = null;
  for (const line of lines) {
    const n = Math.max(1, Math.min(8, Math.round(line.syllables / 2)));
    const slots = [];
    for (let i = 0; i < n; i++) {
      let bt = line.startBeat + line.dur * ((i + (i === 0 ? 0 : 0.5)) / n);
      bt = Math.round(bt * 2) / 2;
      if (bt < line.endBeat - 0.1) slots.push(bt);
    }
    for (let k = 0; k < slots.length; k++) {
      const bt = slots[k];
      const ch = chordAtBeat(sec, bt);
      const tones = ch.tones.map((t) => t + 24);
      const strong = Math.round(bt * 2) % 2 === 0;
      let target;
      if (pos === null) {
        target = near(tones);
      } else if (rng() < (strong ? 0.8 : 0.42)) {
        target = near(tones);
        if (Math.abs(target - pos) > 6) target = pos + Math.sign(target - pos) * 6;
      } else {
        const step = rng() < 0.72 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.5 ? -2 : 2);
        target = Math.max(4, Math.min(iMax - 5, pos + step));
      }
      pos = target;
      const next = slots[k + 1] || line.endBeat;
      const dur = Math.max(0.25, Math.min(1.6, (next - bt) * 0.9));
      const vel = 0.34 + sec.energy * 0.055 + (strong ? 0.12 : 0) + rng() * 0.05;
      events.push({ beat: bt, type: "lead", midi: sm[target], dur, vel });
    }
    if (slots.length) {
      const last = slots[slots.length - 1];
      const prev = events.filter((e) => e.type === "lead").pop();
      if (prev) prev.dur = Math.max(prev.dur, line.endBeat - last + 0.2);
    }
  }
  const lastCh = sec.chords[sec.chords.length - 1];
  events.push({
    beat: Math.max(sec.endBeat - 0.5, lines[lines.length - 1].endBeat),
    type: "lead", midi: sm[near([lastCh.tones[0] + 24])], dur: 0.9, vel: 0.38,
  });
  return events;
}

function introMotif(sec, style, tonicMidi, rng) {
  const evs = [];
  const mscale = SCALES[style.melodyScale || style.harmonyScale];
  const base = tonicMidi + 24;
  const sm = [];
  for (let o = 0; o < 2; o++) for (const s of mscale) sm.push(base + o * 12 + s);
  const near = (tms) => {
    let bi = 0, bd = 1e9;
    for (let k = 0; k < sm.length; k++) for (const tm of tms) {
      const d = Math.abs(sm[k] - tm);
      if (d < bd) { bd = d; bi = k; }
    }
    return bi;
  };
  for (let b = 0; b < sec.bars; b++) {
    const tones = sec.chords[b].tones.map((t) => t + 12);
    evs.push({ beat: sec.startBeat + b * 4, type: "lead", midi: sm[near(tones)], dur: 1.8, vel: 0.22 });
    evs.push({ beat: sec.startBeat + b * 4 + 2.5, type: "lead", midi: sm[near(tones)], dur: 0.8, vel: 0.18 });
  }
  return evs;
}

// ---------------------------------------------------------------- rhythm

function drumEventsForBar(barStart, style, energy, rng, sw) {
  const evs = [];
  const P = style.drums;
  if (P === "none" || energy === 1) return evs;
  const push = (beat, type, extra) => evs.push({ beat: barStart + beat, type, ...extra });
  const hat8 = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  const hat16 = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75];
  switch (P) {
    case "fourfloor":
      [0, 1, 2, 3].forEach((b) => push(b, "kick"));
      [1, 3].forEach((b) => push(b, "snare"));
      hat8.forEach((b) => push(b, b === 2.5 || b === 3.5 ? "oh" : "ch"));
      if (energy >= 4) [0.5, 1.5, 2.5, 3.5].forEach((b) => push(b, "ch"));
      break;
    case "dance":
      [0, 1, 2, 3, 3.5].forEach((b) => push(b, "kick"));
      [1, 3].forEach((b) => push(b, "clap"));
      hat8.forEach((b) => push(b, "ch"));
      [2.5, 3.5].forEach((b) => push(b, "oh"));
      break;
    case "hiphop":
      push(0, "kick");
      if (rng() < 0.6) push(2.5, "kick");
      if (rng() < 0.4) push(2.75, "kick");
      [1.5, 3.5].forEach((b) => push(b, "snare"));
      hat8.forEach((b) => push(b, b === 2.5 || b === 3.5 ? "oh" : "ch"));
      if (rng() < 0.35) push(3.25, "ch");
      break;
    case "breakbeat":
      push(0, "kick"); push(1.75, "kick"); push(2, "kick"); push(3.5, "kick");
      [1, 3].forEach((b) => push(b, "snare"));
      hat16.forEach((b) => push(b, "ch"));
      break;
    case "rock":
      push(0, "kick"); push(2.5, "kick");
      [1, 3].forEach((b) => push(b, "snare"));
      hat8.forEach((b) => push(b, "ch"));
      push(0, "oh");
      break;
    case "lofi":
      push(0, "kick");
      if (rng() < 0.5) push(2.5, "kick");
      [1.5, 3.5].forEach((b) => push(b, "snare"));
      hat8.forEach((b) => push(b, b === 2.5 || b === 3.5 ? "oh" : "ch"));
      if (rng() < 0.4) push(0.75, "ch");
      break;
    case "light":
      [0, 2].forEach((b) => push(b, "kick"));
      [1, 3].forEach((b) => push(b, "snare"));
      hat8.forEach((b) => push(b, "ch"));
      if (rng() < 0.5) push(3.5, "rim");
      break;
  }
  for (const e of evs) {
    if (e.type === "ch" || e.type === "oh") e.beat = swingBeat(e.beat, sw);
  }
  return evs;
}

function bassEventsForBar(barStart, root, style, energy, rng, sw) {
  const evs = [];
  const R = root, F = root + 7;
  const push = (beat, midi, dur, vel) => evs.push({ beat: swingBeat(barStart + beat, sw), type: "bass", midi, dur, vel });
  switch (style.bass) {
    case "deep":
      push(0, R, 3.2, 0.8);
      if (rng() < 0.5) push(2.75, F, 0.5, 0.5);
      break;
    case "round":
      push(0, R, 1.6, 0.7);
      push(2, F, 1.6, 0.6);
      break;
    case "pulse":
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((b) =>
        push(b, Math.floor(b * 2) % 2 === 0 ? R : R + 12, 0.4, 0.55));
      break;
    case "distorted":
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((b) =>
        push(b, b % 1 === 0 ? R : F, 0.45, 0.75));
      break;
  }
  return evs;
}

function chordEventsForBar(barStart, ch, style, energy, rng, sw) {
  const evs = [];
  const V = ch.voicing;
  const push = (beat, dur, vel) => evs.push({ beat: swingBeat(barStart + beat, sw), type: "chord", midis: V, dur, vel });
  switch (style.chords) {
    case "pad": push(0, 3.8, 0.55); break;
    case "keys": push(0, 1.6, 0.5); push(2, 1.6, 0.45); break;
    case "stabs":
      push(0, 0.5, 0.7);
      push(style.id === "electronic" ? 2.5 : 1.5, 0.4, 0.55);
      break;
    case "guitarish":
      push(0, 1.0, 0.55); push(2, 1.0, 0.5);
      if (energy <= 2) push(1.5, 0.6, 0.4);
      break;
  }
  if (style.arp) {
    const pool = [...V.slice(0, 3), V[0] + 12, V[2] + 12];
    for (let i = 0; i < 8; i++) {
      const up = i % pool.length;
      const down = pool.length - 1 - up;
      const note = Math.floor(i / 2) % 2 === 0 ? pool[up] : pool[down];
      evs.push({ beat: swingBeat(barStart + i * 0.5, sw), type: "arp", midi: note, dur: 0.3, vel: 0.3 + (energy >= 4 ? 0.1 : 0) });
    }
  }
  return evs;
}

// ---------------------------------------------------------------- render

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function renderSong(score) {
  const SR = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * (score.duration + 1.6)), SR);

  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 7;
  comp.attack.value = 0.005; comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ctx.destination);

  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.6, 3.0);
  const revGain = ctx.createGain();
  revGain.gain.value = 0.85;
  conv.connect(revGain);
  revGain.connect(master);

  const noise = makeNoise(ctx, 1.0);
  const P = score.patch;

  for (const ev of score.events) {
    schedule(ctx, ev, master, conv, noise, P);
  }
  return ctx.startRendering();
}

function schedule(ctx, ev, master, conv, noise, P) {
  const t = ev.t;
  switch (ev.type) {
    case "kick": kick(ctx, t, master); break;
    case "snare": snare(ctx, t, noise, master, conv); break;
    case "clap": clap(ctx, t, noise, master); break;
    case "ch": hat(ctx, t, false, noise, master); break;
    case "oh": hat(ctx, t, true, noise, master); break;
    case "rim": rim(ctx, t, noise, master); break;
    case "crash": crash(ctx, t, noise, master, conv); break;
    case "riser": riser(ctx, t, ev.dur, noise, master); break;
    case "bass": bass(ctx, t, ev, master, P.bass); break;
    case "chord": chord(ctx, t, ev, master, conv, P.chords); break;
    case "arp": arp(ctx, t, ev, master, conv); break;
    case "lead": lead(ctx, t, ev, master, conv, P.lead); break;
    case "endpad": endpad(ctx, t, ev, master, conv); break;
  }
}

function kick(ctx, t, master) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.3);
  const n = ctx.createBufferSource(); n.buffer = makeNoise(ctx, 0.05);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.22, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  n.connect(f); f.connect(ng); ng.connect(master);
  n.start(t, 0, 0.03);
}

function snare(ctx, t, noise, master, conv) {
  const n = ctx.createBufferSource(); n.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp); bp.connect(g); g.connect(master);
  const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(conv);
  n.start(t, Math.random() * 0.5, 0.25);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.35, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(og); og.connect(master);
  o.start(t); o.stop(t + 0.12);
}

function clap(ctx, t, noise, master) {
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.012;
    const n = ctx.createBufferSource(); n.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2000; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, tt);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.03);
    n.connect(bp); bp.connect(g); g.connect(master);
    n.start(tt, Math.random() * 0.5, 0.05);
  }
}

function hat(ctx, t, open, noise, master) {
  const n = ctx.createBufferSource(); n.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = open ? 6500 : 8200;
  const dur = open ? 0.28 : 0.045;
  const g = ctx.createGain();
  g.gain.setValueAtTime(open ? 0.2 : 0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(hp); hp.connect(g); g.connect(master);
  n.start(t, Math.random() * 0.5, dur + 0.05);
}

function rim(ctx, t, noise, master) {
  const n = ctx.createBufferSource(); n.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(bp); bp.connect(g); g.connect(master);
  n.start(t, Math.random() * 0.5, 0.07);
}

function crash(ctx, t, noise, master, conv) {
  const n = ctx.createBufferSource(); n.buffer = noise;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  n.connect(hp); hp.connect(g); g.connect(master);
  const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(conv);
  n.start(t, Math.random() * 0.5, 1.5);
}

function riser(ctx, t, dur, noise, master) {
  const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(8000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.95);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(bp); bp.connect(g); g.connect(master);
  n.start(t); n.stop(t + dur + 0.05);
}

function bass(ctx, t, ev, master, patch) {
  const f = midiFreq(ev.midi);
  const dur = ev.dur;
  const pk = ev.vel || 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = patch === "deep" ? 280 : (patch === "round" ? 620 : (patch === "pulse" ? 750 : 1500));
  lp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(pk, t);
  g.gain.exponentialRampToValueAtTime(pk * 0.5, t + Math.min(dur, 2) * 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.12);
  const oscs = [];
  if (patch === "distorted") {
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f; oscs.push(o1);
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f * 1.005; oscs.push(o2);
  } else if (patch === "pulse") {
    const o1 = ctx.createOscillator(); o1.type = "square"; o1.frequency.value = f; oscs.push(o1);
  } else {
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f; oscs.push(o1);
  }
  for (const o of oscs) { o.connect(lp); o.start(t); o.stop(t + dur + 0.2); }
  lp.connect(g); g.connect(master);
  const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = f;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.5 * pk, t);
  sg.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.1);
  sub.connect(sg); sg.connect(master);
  sub.start(t); sub.stop(t + dur + 0.2);
}

function chord(ctx, t, ev, master, conv, patch) {
  const dur = ev.dur;
  const vel = ev.vel || 0.5;
  for (const m of ev.midis) {
    const f = midiFreq(m);
    if (patch === "pad") {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1150; lp.Q.value = 0.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vel * 0.055, t + 0.35);
        g.gain.setValueAtTime(vel * 0.055, t + dur * 0.75);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.0);
        o.connect(lp); lp.connect(g); g.connect(master);
        const s = ctx.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(conv);
        o.start(t); o.stop(t + dur + 1.1);
      }
    } else if (patch === "keys") {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * 0.32, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vel * 0.14, t + Math.min(0.8, dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
      o.connect(g); g2.connect(g); g.connect(master);
      const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(conv);
      o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
    } else if (patch === "stabs") {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(master);
      const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(conv);
      o.start(t); o.stop(t + dur + 0.05);
    } else {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.3, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.1, t + Math.min(0.4, dur * 0.5));
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.1);
      o.connect(lp); lp.connect(g); g.connect(master);
      const s = ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(conv);
      o.start(t); o.stop(t + dur + 0.15);
    }
  }
}

function arp(ctx, t, ev, master, conv) {
  const f = midiFreq(ev.midi);
  const dur = ev.dur;
  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(ev.vel || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(master);
  const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(conv);
  o.start(t); o.stop(t + dur + 0.05);
}

function lead(ctx, t, ev, master, conv, patch) {
  const f = midiFreq(ev.midi);
  const dur = ev.dur;
  const vel = ev.vel || 0.5;
  const g = ctx.createGain();
  const oscs = [];
  const add = (type, freq, det) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (det) o.detune.value = det;
    oscs.push(o);
    return o;
  };
  let lp = null;
  if (patch === "warm") {
    add("sawtooth", f, -6); add("sawtooth", f * 1.003, 6);
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2300; lp.Q.value = 1;
  } else if (patch === "saw") {
    add("sawtooth", f, 0); add("sawtooth", f * 1.006, 5);
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.Q.value = 0.8;
  } else if (patch === "square") {
    add("square", f, 0); add("square", f * 0.5, 0);
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600; lp.Q.value = 1;
  } else if (patch === "flute") {
    add("sine", f, 0); add("sine", f * 2, 0);
    const o2g = ctx.createGain(); o2g.gain.value = 0.18;
    oscs[oscs.length - 1].connect(o2g); o2g.connect(g);
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2500; lp.Q.value = 0.7;
    lp.connect(g);
    const vibr = ctx.createOscillator(); vibr.frequency.value = 5;
    const vg = ctx.createGain(); vg.gain.value = 4;
    vibr.connect(vg); vg.connect(oscs[0].detune);
    vibr.start(t); vibr.stop(t + dur + 0.2);
  } else if (patch === "bell") {
    add("sine", f, 0); add("sine", f * 2.76, 0); add("sine", f * 5.4, 0);
    lp = null;
  } else if (patch === "pluck") {
    add("sawtooth", f, 0);
    lp = ctx.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 1400; lp.Q.value = 1.5;
  } else {
    add("sine", f, 0); add("sine", f * 2, 0);
    const o2g = ctx.createGain(); o2g.gain.value = 0.4;
    oscs[oscs.length - 1].connect(o2g); o2g.connect(g);
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.8;
    lp.connect(g);
  }
  if (lp) { for (const o of oscs) o.connect(lp); lp.connect(g); }
  else { for (const o of oscs) o.connect(g); }
  g.gain.setValueAtTime(0.0001, t);
  if (patch === "flute") {
    g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.09);
    g.gain.setValueAtTime(vel * 0.4, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
  } else if (patch === "pluck" || patch === "bell") {
    g.gain.linearRampToValueAtTime(vel * 0.42, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(0.5, dur * 0.8));
  } else {
    g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.02);
    g.gain.setValueAtTime(vel * 0.36, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
  }
  g.connect(master);
  if (patch !== "pluck") {
    const s = ctx.createGain(); s.gain.value = patch === "flute" ? 0.45 : 0.3;
    g.connect(s); s.connect(conv);
  }
  if (patch === "warm" || patch === "saw" || patch === "square") {
    const vibr = ctx.createOscillator(); vibr.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 5;
    vibr.connect(vg); vg.connect(oscs[0].detune);
    vibr.start(t); vibr.stop(t + dur + 0.2);
  }
  for (const o of oscs) { o.start(t); o.stop(t + dur + 0.3); }
}

function endpad(ctx, t, ev, master, conv) {
  const dur = ev.dur;
  for (const m of ev.midis) {
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = midiFreq(m); o.detune.value = det;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 1.0);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(master);
      const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(conv);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
}

// ---------------------------------------------------------------- playback & export

export class Player {
  constructor() {
    this.ctx = null;
    this.src = null;
    this.gainNode = null;
    this.buffer = null;
    this.startedAt = 0;
    this.offset = 0;
    this.duration = 0;
    this.playing = false;
    this.onTime = null;
    this.gain = 1;
    this._raf = null;
  }
  ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  load(buffer) {
    this.buffer = buffer;
    this.duration = buffer.duration;
  }
  play() {
    this.ensure();
    if (this.src) { this.src.stop(); this.src.disconnect(); this.gainNode.disconnect(); this.src = null; }
    this.src = this.ctx.createBufferSource();
    this.src.buffer = this.buffer;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.gain;
    this.src.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.src.start(this.ctx.currentTime + 0.02, this.offset);
    this.startedAt = this.ctx.currentTime + 0.02;
    this.playing = true;
    this._tick();
  }
  pause() {
    if (this.src) {
      this.offset = this.time();
      this.src.stop();
      this.src.disconnect();
      this.gainNode.disconnect();
      this.src = null;
    }
    this.playing = false;
    this._emit();
  }
  seek(frac) {
    const was = this.playing;
    this.offset = Math.max(0, Math.min(1, frac)) * this.duration;
    if (was) this.play();
    this._emit();
  }
  time() {
    if (!this.playing || !this.ctx) return this.offset;
    return Math.min(this.duration, this.offset + (this.ctx.currentTime - this.startedAt));
  }
  stop() {
    if (this.src) { this.src.stop(); this.src.disconnect(); this.gainNode.disconnect(); this.src = null; }
    this.playing = false;
    this.offset = 0;
    this._emit();
  }
  _tick() {
    if (!this.playing) return;
    this._emit();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._tick());
  }
  _emit() {
    if (this.onTime) this.onTime(this.time(), this.playing);
  }
}

export function encodeWav(buffer) {
  const numCh = 2, sr = buffer.sampleRate, len = buffer.length;
  const bytesPerSample = 2, blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, dataSize, true);
  const ch0 = buffer.getChannelData(0), ch1 = buffer.getChannelData(1);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const l = Math.max(-1, Math.min(1, ch0[i]));
    const r = Math.max(-1, Math.min(1, ch1[i]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7fff, true); off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function waveformPeaks(buffer, buckets = 1000) {
  const ch = buffer.getChannelData(0);
  const len = buffer.length;
  const step = Math.max(1, Math.floor(len / buckets));
  const peaks = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let mx = 0;
    const start = i * step;
    const end = Math.min(len, start + step);
    for (let j = start; j < end; j++) {
      const a = Math.abs(ch[j]);
      if (a > mx) mx = a;
    }
    peaks[i] = mx;
  }
  return peaks;
}
