/* LATENT CLASH — stage themes (AUDIO module): library (Claude), abyss (DeepSeek), latent (final).
 * Format: see seq.js header / NOTES.md. Each bar = 16 steps (16th notes). Bass/arp/pad follow
 * the chord line through degree tokens (R 3 5 7 8 …) and generators. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._, rep = K.rep;

  // ===================================================================================
  // stage.library — Claude 娘's theme. D major with lydian colour (E/D), 138 BPM.
  // Hook: F#–A–D–C#–A | B–G#–E–F#–G#  (rising sixth, lydian twist). Form: I A A' B C | loop A.
  // ===================================================================================
  var L_GROOVE = 'x.....x.x.......|x.....x.x...x...';
  var L_FILL_K = 'x.......x.......';
  K.defTrack('stage.library', {
    bpm: 138, vol: 0.65, scale: 'D major +G#', loop: 'A',
    order: ['I', 'A', 'A2', 'B', 'C'],
    ch: {
      lead: { ins: 'lead', w: 's25', vol: 0.3, echo: 0.16, verb: 0.14, vib: [5.5, 14, 0.2], env: [0.005, 0.25, 0.7, 0.08], lp: 5200, melody: true },
      bell: { ins: 'bell', ratio: 3.5, idx: 1.5, dec: 0.9, vol: 0.24, pan: 0.2, echo: 0.24, verb: 0.25, counter: true },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.07, 0.25, 0.04], gate: 0.5, vol: 0.11, pan: -0.3, echo: 0.22, lp: 4200, hum: 0.15 },
      pad: { ins: 'pad', vol: 0.06, a: 0.35, r: 0.6, lp: 1700, verb: 0.3, gate: 1 },
      bass: { ins: 'bass', w: 'tri8', vol: 0.62, punch: 7, env: [0.003, 0.3, 0.85, 0.04], gate: 0.85, lo: 38, bassline: true },
      drums: { ins: 'drums', vol: 0.62, lv: { h: 0.5, o: 0.45, c: 0.55, t: 0.8 } }
    },
    sec: {
      I: { bars: 4, chords: 'Dmaj7 | E/D | Dmaj7 | E/D',
        bell: 'r:16 | r:16 | F#5:6 A5:2 D6:8 | C#6:8 r:8',
        arp: { arp: [0, 1, 2, 3, 4, 3, 2, 1], step: 1, len: 1, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'r:16 | r:16 | R:3 R:1 r:2 R:2 5:2 R:2 8:2 R:2 | R:3 R:1 r:2 R:2 5:2 R:2 8:2 R:2',
        drums: { k: 'x...............|x...............|x.....x.x.......|x.......x.......',
                 h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.........',
                 s: '................|................|....x.......x...|....x.....x.x.xX',
                 t: '................|................|................|........1.2.3...' } },
      A: { bars: 8, chords: 'Dmaj7 | E/D | Bm7 | Gmaj7 | Em7 | F#m7 | Gmaj7 | A7sus4 A7',
        lead: 'F#5:6 A5:2 D6:4 C#6:2 A5:2 | B5:6 G#5:2 E5:4 F#5:2 G#5:2 | A5:6 F#5:2 D5:4 E5:2 F#5:2 | G5:4 B5:4 A5:8 |' +
              ' B5:6 A5:2 G5:4 F#5:2 E5:2 | F#5:6 E5:2 F#5:2 A5:2 C#6:4 | D6:6 C#6:2 B5:4 A5:2 G5:2 | A5:8 G5:2 F#5:2 E5:4',
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'R:3 R:1 r:2 R:2 5:2 R:2 8:2 R:2',
        drums: { k: rep(L_GROOVE, 3) + '|x.....x.x.......|' + L_FILL_K,
                 s: rep('....x.......x...|....x.......x..g', 3) + '|....x.......x...|....x...x.x.xxXX',
                 h: rep('x.x.x.x.x.x.x...', 7) + '|x.x.x.x.........',
                 o: rep('..............x.', 7) + '|................',
                 c: 'x...............' + rep('|................', 7) } },
      A2: { bars: 8, chords: 'Dmaj7 | E/D | Bm7 | Gmaj7 | Em7 | A7 | Dmaj7 | Dmaj7',
        lead: 'F#5:6 A5:2 D6:4 C#6:2 A5:2 | B5:6 G#5:2 E5:4 F#5:2 G#5:2 | A5:6 F#5:2 D5:4 E5:2 F#5:2 | G5:4 B5:4 A5:8 |' +
              ' B5:6 C#6:2 D6:4 E6:4 | C#6:6 B5:2 A5:4 G5:4 | F#5:4 A5:4 D6:8 | _:4 r:6 A5:2 B5:2 C#6:2',
        bell: 'r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:8 F#6:4 A6:4 | D7:8 r:8',
        arp: { arp: [0, 1, 2, 3, 2, 1, 2, 3], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: rep('R:3 R:1 r:2 R:2 5:2 R:2 8:2 R:2', 7) + '| R:3 R:1 r:2 R:2 5:2 8:2 A2:2 F#2:2',
        drums: { k: rep(L_GROOVE, 3) + '|x.....x.x.......|' + L_FILL_K,
                 s: rep('....x.......x...|....x.......x..g', 3) + '|....x.......x...|....x...xxxxXXXX',
                 h: rep('x.x.x.x.x.x.x...', 7) + '|x.x.x.x.........',
                 o: rep('..............x.', 7) + '|................',
                 c: 'x...............' + rep('|................', 7) } },
      B: { bars: 8, chords: 'Gmaj7 | A/G | F#m7 | Bm7 | Em7 | F#m7 | Gmaj7 | A7sus4 A7',
        lead: 'D6:12 C#6:2 B5:2 | C#6:8 r:8 | A5:6 B5:2 C#6:4 E6:4 | D6:8 r:8 | G5:6 A5:2 B5:4 D6:4 | C#6:6 B5:2 A5:4 F#5:4 | B5:6 A5:2 G5:4 B5:4 | D6:4 E6:4 C#6:8',
        bell: 'r:16 | r:8 E6:2 F#6:2 E6:2 C#6:2 | r:16 | r:8 F#6:2 E6:2 D6:2 B5:2 | r:16 | r:8 E6:2 C#6:2 A5:2 F#5:2 | r:8 D6:2 B5:2 G5:2 F#5:2 | r:16',
        arp: { arp: [0, 2, 1, 3, 2, 4, 3, 1], step: 2, len: 2, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'R:6 R:2 5:4 8:4',
        drums: { k: rep('x.......x.......', 7) + '|x.......x.x.....',
                 s: rep('....x.......x...', 7) + '|....x.......xxXX',
                 h: rep('xgxgxgxgxgxgxgxg', 8),
                 c: 'x...............' + rep('|................', 7) } },
      C: { bars: 8, chords: 'Bm | G | D/F# | A | Bm | G | Em7 | A7',
        bell: 'F#5:4 B5:4 D6:4 C#6:4 | B5:8 G5:4 A5:4 | A5:4 D6:4 F#6:4 E6:4 | E6:12 C#6:4 |' +
              ' D6:4 C#6:4 B5:4 F#5:4 | G5:4 B5:4 D6:4 G6:4 | F#6:6 E6:2 D6:4 B5:4 | C#6:4 B5:4 A5:4 G5:4',
        lead: 'r:16 | r:16 | r:16 | r:16 | B4:8 D5:8 | D5:8 G5:8 | B5:8 G5:8 | E5:8 C#5:8',
        arp: { arp: [0, 1, 2, 3, 4, 3, 2, 1], step: 1, len: 1, lo: 62, hi: 81 },
        pad: { pad: 1, lo: 57, hi: 76 },
        bass: 'R:8 5:4 8:4',
        drums: { k: rep('x...............|x.........x.....', 3) + '|x.........x.....|x.......x.......',
                 s: rep('........x.......', 7) + '|x.x.x.x.xxxxXXXX',
                 h: rep('x.x.x.x.x.x.x.x.', 8),
                 t: rep('................', 6) + '|..............2.|................' } }
    }
  });

  // ===================================================================================
  // stage.abyss — DeepSeek 娘's theme. E minor / dorian (A/E vamp), 166 BPM, driving.
  // Hook: E–G–A–B–D–B–A–G (pentatonic run, 2-2-1-3 syncopation). B lifts to G major and ends
  // on an E major Picardy chord; C is a sonar-bell breakdown. Form: I A A' B B' C | loop A.
  // ===================================================================================
  var AB_K = 'x.....x.x.....x.', AB_S = '....x.......x...', AB_H = 'x.xgx.xgx.xgx.xg';
  K.defTrack('stage.abyss', {
    bpm: 166, vol: 0.65, scale: 'E minor +C# +D#', loop: 'A', echo: 60 / 166 * 0.75,
    order: ['I', 'A', 'A2', 'B', 'B2', 'C'],
    ch: {
      lead: { ins: 'lead', w: 's25', vol: 0.29, echo: 0.14, verb: 0.12, vib: [6, 16, 0.16], env: [0.004, 0.18, 0.65, 0.06], lp: 5600, melody: true },
      harm: { ins: 'lead', w: 's12', vol: 0.15, pan: -0.25, verb: 0.15, vib: [6, 10, 0.2], env: [0.01, 0.3, 0.7, 0.1], lp: 4000, counter: true },
      bell: { ins: 'bell', ratio: 2.0, idx: 1.2, dec: 0.7, vol: 0.26, pan: 0.25, echo: 0.35, verb: 0.3, counter: true },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.05, 0.2, 0.03], gate: 0.45, vol: 0.09, pan: 0.3, echo: 0.25, lp: 4500, hum: 0.2 },
      pad: { ins: 'pad', vol: 0.05, a: 0.3, r: 0.5, lp: 1500, verb: 0.3, gate: 1 },
      bass: { ins: 'bass', w: 's50', vol: 0.36, flt: [2200, 380, 0.06, 2], env: [0.002, 0.2, 0.7, 0.03], gate: 0.8, lo: 36, bassline: true },
      drums: { ins: 'drums', vol: 0.62, kit: { k: 'kickB' }, lv: { h: 0.42, o: 0.4, c: 0.55, z: 0.5, t: 0.8 } }
    },
    sec: {
      I: { bars: 4, chords: 'Em | Em | C | D',
        arp: { arp: [0, 2, 1, 3, 2, 4, 3, 5], step: 1, len: 1, lo: 64, hi: 83 },
        bell: 'B5:4 r:2 E6:2 D6:4 B5:4 | G5:8 E5:4 G5:4 | r:16 | r:16',
        bass: 'r:16 | r:16 | R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2 | R:2 8:2 R:2 8:2 R:1 R:1 R:1 R:1 8:2 8:2',
        drums: { k: 'x.......x.......|x.......x.......|' + AB_K + '|x.....x.x.......',
                 h: AB_H + '|' + AB_H + '|' + AB_H + '|' + 'x.x.x.x.........',
                 s: '................|................|' + AB_S + '|....x...xxxxXXXX' } },
      A: { bars: 8, chords: 'Em | A/E | Em | A/E | C | D | Em | B7',
        lead: 'E5:2 G5:2 A5:1 B5:3 D6:2 B5:2 A5:2 G5:2 | A5:3 G5:3 E5:2 r:2 E5:1 G5:1 A5:2 C#6:2 | B5:2 D6:2 E6:4 D6:2 B5:1 A5:1 B5:4 | C#6:6 B5:2 A5:4 E5:4 |' +
              ' G5:2 E5:2 G5:2 A5:2 B5:2 A5:2 G5:2 E5:2 | F#5:3 A5:3 D6:2 E6:4 D6:4 | E6:3 D6:3 B5:2 A5:2 G5:2 E5:4 | D#5:4 F#5:4 A5:4 B5:4',
        arp: { arp: [0, 2, 1, 3, 2, 4, 3, 5], step: 1, len: 1, lo: 64, hi: 83, vel: 0.8 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: 'R:2 R:1 R:1 8:2 R:2 r:1 R:1 5:2 8:2 7:2',
        drums: { k: rep(AB_K, 7) + '|x.....x.x.......',
                 s: rep(AB_S, 7) + '|....x.....x.xxXX',
                 h: rep(AB_H, 7) + '|x.x.x.x.x.......',
                 t: rep('................', 7) + '|............1.2.',
                 c: 'x...............' + rep('|................', 7) } },
      A2: { bars: 8, chords: 'Em | A/E | Em | A/E | C | D | Em | B7',
        lead: 'E5:2 G5:2 A5:1 B5:3 D6:2 B5:2 A5:2 G5:2 | A5:3 G5:3 E5:2 r:2 E5:1 G5:1 A5:2 C#6:2 | B5:2 D6:2 E6:4 D6:2 B5:1 A5:1 B5:4 | C#6:6 B5:2 A5:4 E5:4 |' +
              ' G5:2 A5:2 B5:2 D6:2 E6:4 D6:2 B5:2 | A5:4 F#5:2 A5:2 D6:4 C#6:2 D6:2 | B5:3 G5:3 E5:2 G5:2 A5:2 B5:4 | A5:2 B5:2 D#6:4 F#6:4 r:4',
        harm: 'r:16 | r:16 | r:16 | r:16 | E5:8 G5:8 | F#5:8 A5:8 | G5:8 E5:8 | F#5:8 B5:4 r:4',
        arp: { arp: [0, 2, 1, 3, 2, 4, 3, 5], step: 1, len: 1, lo: 64, hi: 83, vel: 0.8 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: rep('R:2 R:1 R:1 8:2 R:2 r:1 R:1 5:2 8:2 7:2', 7) + '| R:2 R:1 R:1 8:2 R:2 R:2 R:2 8:2 8:2',
        drums: { k: rep(AB_K, 7) + '|x.......x.......',
                 s: rep(AB_S, 7) + '|....x...xxxxXXXX',
                 h: rep(AB_H, 7) + '|x.x.x.x.........',
                 c: 'x...............' + rep('|................', 7) } },
      B: { bars: 8, chords: 'C | D | G | D/F# | Em | C | D | D',
        lead: 'E6:6 D6:2 C6:4 B5:2 C6:2 | D6:6 E6:2 F#6:4 A6:4 | G6:8 F#6:2 E6:2 D6:4 | D6:6 B5:2 A5:4 F#5:4 |' +
              ' G5:4 B5:4 E6:6 D6:2 | E6:4 G6:4 E6:2 D6:2 C6:4 | D6:4 F#6:4 A6:6 G6:2 | F#6:12 r:4',
        harm: 'C5:8 E5:8 | D5:8 F#5:8 | B4:8 D5:8 | A4:8 D5:8 | B4:8 G5:8 | C5:8 G5:8 | F#5:8 A5:8 | A5:12 r:4',
        arp: { arp: [0, 1, 2, 3, 4, 3, 2, 1], step: 1, len: 1, lo: 64, hi: 83 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: 'R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2',
        drums: { k: rep('x...x...x...x...', 7) + '|x...x...x.x.x...',
                 p: rep('....x.......x...', 7) + '|....x.......x...',
                 s: rep('................', 7) + '|........xxxxXXXX',
                 o: rep('..x...x...x...x.', 7) + '|..x...x.........',
                 h: rep('x...x...x...x...', 8),
                 c: 'x...............' + rep('|................', 7) } },
      B2: { bars: 8, chords: 'C | D | G | D/F# | Em | C | Am7 B7 | E',
        lead: 'E6:6 D6:2 C6:4 B5:2 C6:2 | D6:6 E6:2 F#6:4 A6:4 | G6:8 F#6:2 E6:2 D6:4 | D6:6 B5:2 A5:4 F#5:4 |' +
              ' G5:4 B5:4 E6:6 D6:2 | E6:4 G6:4 E6:2 D6:2 C6:4 | C6:4 A5:4 B5:4 D#6:4 | E6:12 r:4',
        harm: 'C5:8 E5:8 | D5:8 F#5:8 | B4:8 D5:8 | A4:8 D5:8 | B4:8 G5:8 | C5:8 G5:8 | E5:8 F#5:8 | G#5:12 r:4',
        arp: { arp: [0, 1, 2, 3, 4, 3, 2, 1], step: 1, len: 1, lo: 64, hi: 83 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: rep('R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2', 7) + '| R:4 r:2 R:2 8:4 r:4',
        drums: { k: rep('x...x...x...x...', 7) + '|x.....x.........',
                 p: rep('....x.......x...', 7) + '|................',
                 o: rep('..x...x...x...x.', 7) + '|................',
                 h: rep('x...x...x...x...', 7) + '|x...............',
                 c: 'x...............' + rep('|................', 6) + '|x...............' } },
      C: { bars: 8, chords: 'Em | C | Am | B7 | Em | C | Am7 | B7',
        bell: 'B5:4 r:2 E6:2 D6:4 B5:4 | G5:8 E5:4 G5:4 | A5:4 r:2 C6:2 B5:4 A5:4 | F#5:8 r:8 |' +
              ' E6:4 r:2 G6:2 E6:4 D6:4 | E6:6 D6:2 B5:4 G5:4 | A5:4 B5:4 C6:4 E6:4 | F#6:4 D#6:4 B5:4 A5:4',
        lead: 'r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:8 B4:2 D#5:2 F#5:2 A5:2',
        arp: { arp: [0, 2, 1, 3, 2, 4, 3, 5], step: 1, len: 1, lo: 64, hi: 83, vel: 1.1 },
        pad: { pad: 1, lo: 55, hi: 74, vel: 1.3 },
        bass: 'R:6 R:2 r:4 5:2 R:2',
        drums: { k: rep('x.........x.....', 4) + '|' + rep(AB_K, 3) + '|x.....x.x.......',
                 h: rep('x...x...x...x...', 4) + '|' + rep(AB_H, 4),
                 s: rep('................', 4) + '|....x.......x...|....x.......x...|....x...x...x.x.|x.x.x.x.xxxxXXXX',
                 z: rep('..x...x...x...x.', 4) + '|' + rep('................', 4) } }
    }
  });

  // ===================================================================================
  // stage.latent — final battle. C minor, 150 BPM. Chromatic bass ostinato (C C' C C Db C C' C Bb B);
  // chorus quotes Claude's hook rhythm (Ab: C–Eb–Ab–G–Eb) and DeepSeek's pentatonic run (Eb).
  // Bridge: call (DeepSeek, pulse) / response (Claude, bell) over Fm–Eb–Db–G. Form: I A B C B | loop A.
  // ===================================================================================
  var LT_OST = 'R:2 8:1 R:1 R:2 R#:2^ R:2 8:1 R:1 5:2 Rb:2^';
  var LT_K = 'x.x...x.x.x...x.', LT_S = '....x.......x...', LT_H = 'xxxxxxxxxxxxxxxx';
  K.defTrack('stage.latent', {
    bpm: 150, vol: 0.65, scale: 'C minor +B +Db +A', loop: 'A',
    order: ['I', 'A', 'B', 'C', 'B'],
    ch: {
      lead: { ins: 'lead', w: 's25', uni: 8, vol: 0.27, echo: 0.14, verb: 0.15, vib: [5.8, 16, 0.18], env: [0.004, 0.22, 0.7, 0.07], lp: 5000, melody: true },
      bell: { ins: 'bell', ratio: 3.5, idx: 1.6, dec: 0.8, vol: 0.25, pan: 0.2, echo: 0.3, verb: 0.3, counter: true },
      arp: { ins: 'lead', w: 's12', env: [0.002, 0.05, 0.2, 0.03], gate: 0.45, vol: 0.085, pan: -0.3, echo: 0.2, lp: 4000, hum: 0.2 },
      pad: { ins: 'pad', vol: 0.065, a: 0.4, r: 0.6, lp: 1400, verb: 0.35, gate: 1 },
      bass: { ins: 'bass', w: 's50', vol: 0.34, flt: [2600, 420, 0.05, 2.5], env: [0.002, 0.2, 0.75, 0.03], gate: 0.8, lo: 36, bassline: true },
      rise: { ins: 'riser', f0: 300, f1: 7000, q: 2.5, vol: 0.18 },
      drums: { ins: 'drums', vol: 0.62, kit: { k: 'kickB' }, lv: { h: 0.33, o: 0.4, c: 0.55, t: 0.85 } }
    },
    sec: {
      I: { bars: 4, chords: 'Cm | Cm | Cm | G',
        bass: LT_OST + '|' + LT_OST + '|' + LT_OST + '| R:2 8:1 R:1 R:2 R:2 R:2 8:2 R:2 8:2',
        rise: 'r:16 | r:16 | r:16 | C4:16',
        arp: { arp: [0, 1, 2, 1], step: 1, len: 1, lo: 60, hi: 79, vel: 0.7 },
        drums: { k: 'x.......x.......|x.......x.......|' + LT_K + '|x.x.x.x.x.x.x.x.',
                 h: LT_H + '|' + LT_H + '|' + LT_H + '|' + LT_H,
                 s: '................|................|' + LT_S + '|....x...x.x.xxXX' } },
      A: { bars: 8, chords: 'Cm | Cm | Ab | G | Cm | Cm | Fm | G',
        lead: 'G5:6 Eb5:2 C5:4 D5:2 Eb5:2 | G5:3 F5:3 Eb5:2 D5:4 C5:4 | C6:6 Bb5:2 Ab5:4 G5:2 Ab5:2 | B5:8 D6:4 G5:4 |' +
              ' C6:3 G5:3 Eb5:2 F5:2 G5:2 Bb5:2 G5:2 | C6:6 D6:2 Eb6:4 D6:2 C6:2 | Ab5:6 G5:2 F5:4 Eb5:2 F5:2 | G5:4 B5:4 D6:4 F6:4',
        arp: { arp: [0, 1, 2, 1], step: 1, len: 1, lo: 60, hi: 79, vel: 0.8 },
        pad: { pad: 1, lo: 55, hi: 74 },
        bass: LT_OST,
        drums: { k: rep(LT_K, 7) + '|x.x.x.x.x.x.x.x.',
                 s: rep(LT_S, 7) + '|....x...x.x.xxXX',
                 h: rep(LT_H, 8),
                 c: 'x...............' + rep('|................', 7) } },
      B: { bars: 8, chords: 'Ab | Bb | Eb | Cm | Ab | Bb | G | G',
        lead: 'C6:6 Eb6:2 Ab6:4 G6:2 Eb6:2 | F6:6 D6:2 Bb5:4 C6:2 D6:2 | Eb6:2 C6:2 Bb5:1 G5:3 Bb5:2 C6:2 Eb6:2 F6:2 | G6:6 F6:2 Eb6:4 D6:2 C6:2 |' +
              ' C6:6 Eb6:2 Ab6:4 G6:2 Eb6:2 | F6:6 G6:2 Ab6:4 G6:2 F6:2 | G6:8 F6:2 Eb6:2 D6:4 | B5:4 D6:4 G6:8',
        bell: 'Ab5:8 C6:8 | Bb5:8 D6:8 | G5:8 Bb5:8 | Eb6:8 G5:8 | Ab5:8 C6:8 | Bb5:8 D6:8 | B5:8 D6:8 | G5:4 B5:4 D6:8',
        arp: { arp: [0, 1, 2, 3], step: 1, len: 1, lo: 60, hi: 79 },
        pad: { pad: 1, lo: 55, hi: 74, vel: 1.2 },
        bass: 'R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2',
        rise: rep('r:16', 7) + '| C4:16',
        drums: { k: rep('x...x...x...x...', 7) + '|x...x...x.x.x.x.',
                 p: rep('....x.......x...', 7) + '|....x...........',
                 s: rep('................', 7) + '|........x.x.xxXX',
                 o: rep('..x...x...x...x.', 7) + '|..x...x.........',
                 h: rep('x.x.x.x.x.x.x.x.', 8),
                 c: 'x...............' + rep('|................', 7) } },
      C: { bars: 8, chords: 'Fm | Eb | Db | G | Fm | Eb | Db | G',
        lead: 'F5:2 Ab5:2 Bb5:1 C6:3 Eb6:2 C6:2 Bb5:2 Ab5:2 | r:16 | F5:2 Ab5:2 Bb5:1 C6:3 Db6:2 C6:2 Ab5:2 F5:2 | r:16',
        bell: 'r:16 | G5:6 Bb5:2 Eb6:4 D6:2 Bb5:2 | r:16 | B5:6 D6:2 G6:4 F6:2 D6:2',
        arp: { arp: [0, 1, 2, 1, 3, 2, 1, 2], step: 2, len: 2, lo: 60, hi: 79 },
        pad: { pad: 1, lo: 55, hi: 74, vel: 1.3 },
        bass: 'R:8 R:4 5:4',
        drums: { k: rep('x.........x.....', 6) + '|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx',
                 s: rep('........x.......', 6) + '|....x.......x...|x.x.x.x.xxxxXXXX',
                 h: rep('x.x.x.x.x.x.x.x.', 8),
                 t: rep('..............3.|................', 3) + '|................|................' } }
    }
  });
})();
