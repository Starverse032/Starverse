/* LATENT CLASH — menu / flow tracks (AUDIO module): title, select, vs, victory, stage.training,
 * continue, ending. Same format as tracks-stages.js. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._, rep = K.rep;

  var BRASS = { ins: 'lead', w: 'sawtooth', uni: 10, vol: 0.13, env: [0.008, 0.35, 0.55, 0.15], lp: 2800, verb: 0.25, gate: 1, hum: 0.05 };

  // ===================================================================================
  // title — heroic anthem, D major, 120 BPM. A = Claude's hook in half time over an anthem
  // progression; B = DeepSeek's pentatonic run (B minor) building back to D. Loop A B = 32 s.
  // ===================================================================================
  K.defTrack('title', {
    bpm: 120, vol: 0.52, scale: 'D major', loop: 'A', order: ['I', 'A', 'B'],
    ch: {
      lead: { ins: 'lead', w: 's25', uni: 7, vol: 0.27, echo: 0.18, verb: 0.2, vib: [5.5, 15, 0.22], env: [0.006, 0.3, 0.72, 0.1], lp: 5000, melody: true },
      brass: BRASS,
      bell: { ins: 'bell', ratio: 3.5, idx: 1.4, dec: 1.0, vol: 0.2, pan: 0.25, echo: 0.3, verb: 0.3 },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.06, 0.25, 0.04], gate: 0.5, vol: 0.09, pan: -0.3, echo: 0.25, lp: 4200 },
      pad: { ins: 'pad', vol: 0.065, a: 0.4, r: 0.8, lp: 1600, verb: 0.35, gate: 1 },
      bass: { ins: 'bass', w: 'tri8', vol: 0.6, punch: 7, env: [0.003, 0.3, 0.85, 0.05], gate: 0.9, lo: 38, bassline: true },
      drums: { ins: 'drums', vol: 0.62, lv: { h: 0.45, c: 0.55, t: 0.85, b: 0.7 } }
    },
    sec: {
      I: { bars: 2, chords: 'D | A',
        brass: { stab: 'X...............|X.....x.X.......', lo: 57, hi: 74, len: 4 },
        drums: { b: 'x...............|x.....x.x.......', c: 'x...............|................',
                 t: '................|..........1.2.34', s: '................|............xxXX' } },
      A: { bars: 8, chords: 'D | A/C# | Bm | G | D/F# | G | Em7 | A',
        lead: 'F#5:6 A5:2 D6:8 | C#6:6 A5:2 E5:8 | F#5:6 B5:2 D6:6 C#6:2 | B5:12 A5:4 | A5:6 D6:2 F#6:8 | E6:6 D6:2 B5:8 | G5:4 B5:4 E6:4 D6:4 | C#6:8 E6:8',
        brass: { stab: 'x.......x.......', lo: 57, hi: 74, len: 6 },
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'R:4 R:2 R:2 5:4 8:4',
        drums: { k: rep('x.......x.x.....', 7) + '|x.......x.......',
                 s: rep('....x.......x...', 7) + '|....x...x.x.xxXX',
                 h: rep('x.x.x.x.x.x.x.x.', 8),
                 t: rep('................', 3) + '|............1.2.' + rep('|................', 4),
                 c: 'x...............' + rep('|................', 3) + '|x...............' + rep('|................', 3) } },
      B: { bars: 8, chords: 'Bm | G | D | A | Bm | G | Em | A7',
        lead: 'B5:2 D6:2 E6:1 F#6:3 A6:2 F#6:2 E6:2 D6:2 | E6:3 D6:3 B5:2 r:2 B5:1 D6:1 E6:2 G6:2 | F#6:6 E6:2 D6:4 A5:4 | C#6:6 B5:2 A5:4 E5:4 |' +
              ' B5:2 D6:2 E6:1 F#6:3 A6:2 F#6:2 E6:2 D6:2 | G6:2 F#6:2 E6:2 D6:2 B5:2 D6:2 E6:2 G6:2 | G6:4 E6:4 B5:4 G5:4 | E6:4 C#6:4 A5:4 G5:4',
        bell: 'r:16 | r:16 | A5:8 D6:8 | E6:8 C#6:8 | r:16 | r:16 | B5:8 G5:8 | C#6:8 A5:8',
        arp: { arp: [0, 1, 2, 3, 4, 3, 2, 1], step: 1, len: 1, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2',
        drums: { k: rep('x...x...x...x...', 7) + '|x...x...x.x.x.x.',
                 s: rep('....x.......x...', 7) + '|....x...xxxxXXXX',
                 h: rep('..x...x...x...x.', 8),
                 c: 'x...............' + rep('|................', 7) } }
    }
  });

  // ===================================================================================
  // select — upbeat, groovy character select. F major, 126 BPM, funky pulse bass + offbeat
  // chord stabs. A/B, 16 bars ≈ 30 s loop.
  // ===================================================================================
  K.defTrack('select', {
    bpm: 126, vol: 0.65, scale: 'F major +E', loop: 'A', order: ['A', 'B'],
    ch: {
      lead: { ins: 'lead', w: 's25', vol: 0.26, echo: 0.15, verb: 0.12, vib: [6, 12, 0.2], env: [0.004, 0.15, 0.6, 0.06], lp: 5200, melody: true },
      keys: { ins: 'lead', w: 's50', env: [0.002, 0.08, 0.3, 0.05], gate: 0.6, vol: 0.075, pan: 0.25, lp: 3000, verb: 0.15 },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.05, 0.2, 0.03], gate: 0.45, vol: 0.06, pan: -0.3, echo: 0.25, lp: 4000 },
      bass: { ins: 'bass', w: 's50', vol: 0.34, flt: [2400, 350, 0.05, 3], env: [0.002, 0.15, 0.7, 0.03], gate: 0.75, lo: 36, bassline: true },
      drums: { ins: 'drums', vol: 0.6, lv: { h: 0.4, o: 0.4, p: 0.8 } }
    },
    sec: {
      A: { bars: 8, chords: 'Fmaj7 | Gm7 | Am7 | Gm7 | Fmaj7 | Gm7 | Bbmaj7 | C7sus4 C7',
        lead: 'C6:2 A5:2 r:2 C6:2 D6:2 C6:2 A5:2 G5:2 | Bb5:3 A5:1 G5:2 F5:2 G5:4 r:4 | C6:2 A5:2 r:2 C6:2 E6:2 D6:2 C6:2 A5:2 | D6:6 C6:2 Bb5:4 r:4 |' +
              ' A5:2 C6:2 F6:2 E6:2 r:2 C6:2 A5:2 C6:2 | D6:3 C6:1 Bb5:2 G5:2 Bb5:4 D6:4 | F6:6 E6:2 D6:4 C6:4 | C6:8 Bb5:2 G5:2 E5:4',
        keys: { stab: '..x...x...x..x..', lo: 62, hi: 77, len: 1 },
        bass: 'R:2 r:1 R:1 8:2 R:1 r:1 5:2 R:2 7:2 8:2',
        drums: { k: rep('x.....x...x.....', 7) + '|x.....x...x.x...',
                 p: rep('....x.......x...', 7) + '|....x.......xxxx',
                 h: rep('xgxgxgxgxgxgxgxg', 8),
                 o: rep('......x.......x.', 8),
                 c: 'x...............' + rep('|................', 7) } },
      B: { bars: 8, chords: 'Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 | Gm7 | C7',
        lead: 'D6:8 F6:4 E6:4 | C6:8 r:4 A5:2 C6:2 | Bb5:6 A5:2 G5:4 F5:4 | A5:12 r:4 | F6:8 D6:4 F6:4 | E6:8 C6:4 E6:4 | D6:4 Bb5:4 G5:4 Bb5:4 | G5:4 Bb5:4 C6:4 E6:4',
        keys: { stab: '..x...x...x..x..', lo: 62, hi: 77, len: 1 },
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 1, lo: 65, hi: 84 },
        bass: 'R:3 R:1 r:2 8:2 R:2 5:2 7:2 8:2',
        drums: { k: rep('x.......x.......', 7) + '|x.......x.x.....',
                 p: rep('....x.......x...', 7) + '|....x...x.x.xxxx',
                 h: rep('x.x.x.x.x.x.x.x.', 8),
                 c: 'x...............' + rep('|................', 7) } }
    }
  });

  // ===================================================================================
  // vs — 4 s dramatic sting (one-shot). D minor: DAN … DA-DAN | Bb → A (dominant) with crash.
  // ===================================================================================
  K.defTrack('vs', {
    bpm: 120, vol: 0.68, scale: 'D minor +C#', loop: false, order: ['S'],
    ch: {
      brass: { ins: 'lead', w: 'sawtooth', uni: 10, vol: 0.17, env: [0.006, 0.4, 0.5, 0.25], lp: 3000, verb: 0.3, gate: 1 },
      lead: { ins: 'lead', w: 's25', vol: 0.2, env: [0.005, 0.3, 0.7, 0.3], lp: 4500, verb: 0.3, vib: [6, 20, 0.15], melody: true },
      bass: { ins: 'bass', w: 'tri8', vol: 0.6, env: [0.003, 0.4, 0.8, 0.2], gate: 1, lo: 38, bassline: true },
      rise: { ins: 'riser', f0: 400, f1: 6000, q: 2, vol: 0.15 },
      drums: { ins: 'drums', vol: 0.65, lv: { b: 0.9, c: 0.6, t: 0.9 } }
    },
    sec: {
      S: { bars: 2, chords: 'Dm | Bb:8 A:8',
        brass: { stab: 'X.....x.X.......|X.......X.......', lo: 57, hi: 74, len: 6 },
        lead: 'D5:6 F5:2 A5:8 | Bb5:8 C#6:8',
        bass: 'R:6 R:2 R:8 | R:8 R:8',
        rise: 'r:8 C4:8 | r:16',
        drums: { b: 'x.....x.x.......|x.......x.......', t: '..........1.2.34|................',
                 c: '................|x.......x.......', s: '................|................' } }
    }
  });

  // ===================================================================================
  // victory — ≈5 s fanfare jingle (one-shot). C major, 150 BPM, 3 bars + ring-out.
  // ===================================================================================
  K.defTrack('victory', {
    bpm: 150, vol: 0.71, scale: 'C major', loop: false, order: ['V'],
    ch: {
      lead: { ins: 'lead', w: 's25', uni: 7, vol: 0.27, env: [0.004, 0.25, 0.7, 0.25], lp: 5200, verb: 0.25, echo: 0.15, vib: [6, 16, 0.2], melody: true },
      brass: BRASS,
      bell: { ins: 'bell', ratio: 3.5, idx: 1.4, dec: 1.2, vol: 0.2, pan: 0.25, verb: 0.3 },
      bass: { ins: 'bass', w: 'tri8', vol: 0.55, punch: 7, env: [0.003, 0.3, 0.85, 0.15], gate: 0.9, lo: 36, bassline: true },
      drums: { ins: 'drums', vol: 0.62, lv: { c: 0.6 } }
    },
    sec: {
      V: { bars: 3, chords: 'C | F G | C',
        lead: 'G5:2 C6:2 E6:2 G6:6 E6:2 G6:2 | A6:6 G6:2 F6:4 D6:4 | E6:2 D6:2 C6:12',
        bell: 'C6:4 E6:4 G6:4 E6:4 | F6:4 C6:4 D6:4 B5:4 | C7:16',
        brass: { stab: 'X.....x.X.......|X.......X.......|X...............', lo: 55, hi: 72, len: 4 },
        bass: 'R:2 R:2 R:2 R:6 5:2 R:2 | R:6 R:2 R:4 R:4 | R:16',
        drums: { k: 'x.....x.x.......|x.......x.......|x...............',
                 s: '....x.......x...|....x...x.xxXXXX|................',
                 c: 'x...............|................|X...............' } }
    }
  });

  // ===================================================================================
  // stage.training — relaxed lo-fi chip groove. C major (IV-iii-ii-I), 86 BPM, swung 16ths,
  // FM e-piano comping, bell melody (A) and soft pulse (B). 16 bars ≈ 45 s loop.
  // ===================================================================================
  K.defTrack('stage.training', {
    bpm: 86, vol: 0.58, swing: 0.28, scale: 'C major', loop: 'A', order: ['A', 'B'],
    ch: {
      bell: { ins: 'bell', ratio: 3.5, idx: 1.1, dec: 1.0, vol: 0.22, echo: 0.25, verb: 0.3, melody: true },
      lead: { ins: 'lead', w: 's12', vol: 0.2, echo: 0.2, verb: 0.2, vib: [5, 12, 0.25], env: [0.02, 0.3, 0.6, 0.15], lp: 3200, melody: true },
      keys: { ins: 'bell', ratio: 1, idx: 1.3, isus: 0.25, dec: 1.4, hold: true, vol: 0.12, pan: -0.25, verb: 0.25, hp: 90 },
      pad: { ins: 'pad', vol: 0.05, a: 0.5, r: 0.8, lp: 1100, verb: 0.3, gate: 1 },
      bass: { ins: 'bass', w: 'triangle', vol: 0.6, env: [0.006, 0.4, 0.8, 0.06], gate: 0.85, lo: 36, bassline: true },
      drums: { ins: 'drums', vol: 0.5, lv: { h: 0.32, w: 0.7, z: 0.45 } }
    },
    sec: {
      A: { bars: 8, chords: 'Fmaj7 | Em7 | Dm7 | Cmaj7 | Fmaj7 | Em7 | Dm7 G7 | Cmaj7',
        bell: 'A5:4 C6:2 E6:6 r:4 | D6:4 B5:2 G5:6 r:4 | F5:4 A5:2 C6:6 r:2 D6:2 | E6:4 D6:2 B5:2 G5:8 |' +
              ' A5:2 C6:2 E6:2 G6:4 E6:2 C6:4 | B5:6 G5:2 E5:8 | F5:4 A5:4 B5:4 D6:4 | C6:12 r:4',
        keys: { stab: 'x......x..x.....', lo: 57, hi: 74, len: 3 },
        pad: { pad: 1, lo: 55, hi: 72 },
        bass: 'R:6 5:2 r:4 8:2 7:2',
        drums: { k: rep('x.......x.x.....', 8), w: rep('....x.......x...', 8), h: rep('xgxgxgxgxgxgxgxg', 8), z: rep('..x...x...x...x.', 8) } },
      B: { bars: 8, chords: 'Am7 | Em7 | Fmaj7 | Cmaj7 | Am7 | Em7 | Dm7 | G7sus4 G7',
        lead: 'E5:4 G5:4 C6:6 B5:2 | B5:8 G5:4 E5:4 | A5:4 C6:4 F6:6 E6:2 | E6:12 r:4 | C6:4 B5:2 A5:2 E5:8 | G5:4 A5:2 B5:2 D6:8 | F6:4 E6:2 D6:2 A5:8 | C6:8 B5:4 D6:4',
        keys: { stab: 'x......x..x.....', lo: 57, hi: 74, len: 3 },
        pad: { pad: 1, lo: 55, hi: 72 },
        bass: 'R:6 5:2 r:4 8:2 7:2',
        drums: { k: rep('x.......x.x.....', 7) + '|x.......x.......', w: rep('....x.......x...', 7) + '|....x.......x.x.',
                 h: rep('xgxgxgxgxgxgxgxg', 8), z: rep('..x...x...x...x.', 8) } }
    }
  });

  // ===================================================================================
  // continue — suspenseful countdown loop. A minor (harmonic), 120 BPM, a clock-tick rim on
  // every beat. 8 bars = 16 s loop.
  // ===================================================================================
  K.defTrack('continue', {
    bpm: 120, vol: 0.86, scale: 'A minor +G#', loop: 'A', order: ['A'],
    ch: {
      lead: { ins: 'lead', w: 's25', vol: 0.23, echo: 0.25, verb: 0.25, vib: [5, 18, 0.25], env: [0.01, 0.4, 0.7, 0.2], lp: 4000, melody: true },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.06, 0.25, 0.04], gate: 0.5, vol: 0.08, pan: 0.3, echo: 0.3, lp: 3500 },
      pad: { ins: 'pad', vol: 0.06, a: 0.5, r: 0.8, lp: 1200, verb: 0.35, gate: 1 },
      bass: { ins: 'bass', w: 'tri8', vol: 0.5, env: [0.003, 0.2, 0.6, 0.05], gate: 0.5, lo: 36, bassline: true },
      drums: { ins: 'drums', vol: 0.55, lv: { w: 0.8, h: 0.3 } }
    },
    sec: {
      A: { bars: 8, chords: 'Am | Am | F | E7 | Am | Am | Dm | E7',
        lead: 'E5:12 r:4 | F5:6^ E5:2 D5:4 C5:4 | C5:12 r:4 | B4:8 G#4:8 | A5:12 r:4 | C6:6 B5:2 A5:4 E5:4 | F5:12 r:4 | G#5:8 B5:8',
        arp: { arp: [0, 1, 2, 1], step: 2, len: 2, lo: 64, hi: 79 },
        pad: { pad: 1, lo: 52, hi: 69 },
        bass: 'R:2 r:2 R:2 r:2 R:2 r:2 R:2 r:2',
        drums: { w: rep('x...x...x...x...', 8), k: rep('x.......x.......', 8), h: rep('..x...x...x...x.', 8) } }
    }
  });

  // ===================================================================================
  // ending — gentle, bittersweet-happy. G major with a borrowed C minor (iv), 92 BPM.
  // A: Claude's hook (B–D–G–F#–D) on bells; B: DeepSeek's run, slowed, on a soft pulse.
  // Loop A B ≈ 42 s.
  // ===================================================================================
  K.defTrack('ending', {
    bpm: 92, vol: 0.55, scale: 'G major +Eb', loop: 'A', order: ['I', 'A', 'B'],
    ch: {
      bell: { ins: 'bell', ratio: 3.5, idx: 1.2, dec: 1.3, vol: 0.24, echo: 0.25, verb: 0.35, melody: true },
      lead: { ins: 'lead', w: 's12', vol: 0.2, echo: 0.22, verb: 0.3, vib: [5, 14, 0.25], env: [0.02, 0.3, 0.7, 0.2], lp: 3600, melody: true },
      arp: { ins: 'lead', w: 's12', env: [0.003, 0.08, 0.25, 0.06], gate: 0.5, vol: 0.07, pan: -0.3, echo: 0.3, lp: 3500 },
      pad: { ins: 'pad', vol: 0.065, a: 0.6, r: 1.0, lp: 1300, verb: 0.4, gate: 1 },
      bass: { ins: 'bass', w: 'triangle', vol: 0.55, env: [0.008, 0.5, 0.8, 0.1], gate: 0.9, lo: 38, bassline: true },
      drums: { ins: 'drums', vol: 0.45, lv: { w: 0.6, z: 0.4 } }
    },
    sec: {
      I: { bars: 2, chords: 'C | D',
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: 'R:16' },
      A: { bars: 8, chords: 'G | D/F# | Em | C | G/B | Cm | G/D | D',
        bell: 'B5:6 D6:2 G6:4 F#6:2 D6:2 | A5:6 F#5:2 D5:4 E5:2 F#5:2 | G5:6 B5:2 E6:8 | E6:6 D6:2 C6:4 B5:2 A5:2 |' +
              ' B5:6 A5:2 G5:4 D5:4 | Eb5:6 G5:2 C6:8 | B5:6 A5:2 G5:4 A5:4 | A5:12 r:4',
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: 'R:8 5:4 R:4',
        drums: { k: rep('x...............', 8), w: rep('........x.......', 8), z: rep('x.x.x.x.x.x.x.x.', 8) } },
      B: { bars: 8, chords: 'Em | C | G | D | Em | C | Am7 D7 | G',
        lead: 'E5:2 G5:2 A5:1 B5:3 D6:4 B5:4 | C6:6 B5:2 G5:4 E5:4 | D6:2 B5:2 D6:2 E6:2 G6:4 D6:4 | F#6:8 D6:4 A5:4 |' +
              ' E5:2 G5:2 A5:1 B5:3 E6:4 D6:4 | E6:6 D6:2 C6:4 G5:4 | C6:4 B5:2 A5:2 F#5:4 A5:4 | G5:12 r:4',
        bell: 'r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | G6:8 D6:8',
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: rep('R:8 5:4 8:4', 6) + '| R:8 R:4 8:4 | R:8 5:4 8:4',
        drums: { k: rep('x.......x.......', 8), w: rep('....x.......x...', 8), z: rep('x.x.x.x.x.x.x.x.', 8) } }
    }
  });
})();
