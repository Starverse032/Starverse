# AUDIO — `LC.audio` (Web Audio synth: SFX, chiptune music, voice chirps)

Everything is synthesized at runtime — no audio files. Dev pages: `dev/audio-test.html` (listen,
from `file://` or http) and `dev/audio-render.html` (headless harness for the measurement tool).

## Files (load order = `manifest.js`)
| file | what |
|------|------|
| `core.js` | namespace `LC.audio._` (= K): registries `K.SFX`, `K.TRACKS`, `K.INS`, `K.DRUMS`; note/scale/chord parsing, voice-leading, seeded RNG |
| `synth.js` | per-context resources (noise buffers white/pink/brown/metal/crackle, band-limited pulse PeriodicWaves `p12/p25/p50`, softened `s12/s25/s50`, `glottal`, `reed`, `tri8`; shaper curves; synthetic reverb IR) + layer helpers `S.osc`, `S.noise`, `S.bus`, `S.echo`, `S.bubble`, `S.bell`, `S.env` |
| `mixer.js` | `K.Mixer(ctx)` — the whole graph for one (realtime or offline) context; voice limiting; SFX cache rendering (`K.renderSfx`) |
| `instruments.js` | music instruments `lead`, `bass`, `pad`, `bell` (2-op FM), `riser`, `drums`; drum kit rendered once to buffers |
| `seq.js` | track compiler + validator, `TrackInst` look-ahead scheduler, score printer / theory checks |
| `sfx-fight.js`, `sfx-system.js`, `sfx-chars.js` | the SFX definitions |
| `mix.js` | per-SFX gain trims from the measurement pass |
| `voice.js` | formant voice chirps |
| `tracks-stages.js`, `tracks-menu.js` | the 10 music tracks |
| `engine.js` | public API (§5.7) + lifecycle |
| `offline.js` | `LC.audio._dev` render hooks for tools |

## Graph
```
sfx voices ─► sfxBus(vol) ─────────────────────────────────────────────┐
track channels ─► trackFade ─► musicIn ─► duck ─► pauseLP ─► pauseGain ─► musicVol ─► master ─► compressor(-7 dB, 12:1) ─► soft clip ─► out
channel sends ─► (per track) echo (ping-pong, tempo-synced) / verbFade ─► verbIn ─► convolver(1.25 s IR) ─► musicIn
```
Volumes use a squared taper (`gain = v²`); defaults come from `LC.settings.master/music/sfx`.

## Lifecycle / robustness
- `init()` creates nothing audible; it installs capture-phase `pointerdown/mousedown/touchend/keydown`
  listeners that call `unlock()` (so audio works even if the shell forgets) and re-`resume()` after
  iOS interruptions. `unlock()` creates/resumes the AudioContext, plays a 1-sample silent buffer
  (iOS), renders the drum kit (~50 ms) and then, in the background, renders every SFX to an
  `AudioBuffer` (UI first, then fight sounds). Until a sound is cached it is synthesized live.
- While locked / suspended / unsupported every call is a silent no-op. `music()` requested while
  locked is remembered and starts on unlock. The context is suspended when `document.hidden`.
- `?mute=1` / `LC_OPTS.mute` mutes the master (not saved).
- Voice limiting: per-SFX polyphony cap (`poly`, oldest stolen with a 6 ms fade), retrigger guard
  (`guard`, default 30 ms: twelve identical hits in one frame play once), global cap 24 voices
  (lowest `prio` stolen first), small random pitch `jitter` on frequent sounds. Voices: one chirp
  per character at a time.
- Music: 40 ms timer, 300 ms look-ahead, sample-accurate absolute times; notes later than 20 ms are
  dropped after a stall instead of piling up. Loops wrap by event index (no seam).

## Public API (§5.7) + additions
`init, unlock, sfx(name, {vol, pan, pitch}), voice(charId, kind, {vol, pan, pitch}), music(track|null,
{fade = 0.5, restart = false, fadeIn}), setVolume/getVolume('master'|'music'|'sfx'), duck(amount 0..1,
seconds), setPaused(bool), list() -> { sfx, music, voice: { chars, kinds } }`.
Additions: `setMuted(bool)`, `isMuted()`, `isUnlocked()`, `state()` ('locked'|'running'|'suspended'|
'unavailable'), `stopSfx()`, `currentTrack()`, `position()` (dev: section/bar), `VOICE_KINDS`,
`_dev.render(spec)` (offline render), `_dev.analyze(track)`.
`music(t, {fade})`: the old track fades out over `fade`, the new one starts at once (fade-in
`min(0.2, fade·0.4)` unless `fadeIn` given). Same track again = no-op unless `restart: true`.
`setPaused(true)` muffles music (700 Hz low-pass, −6 dB); SFX stay normal so the pause menu can beep.

## SFX names, descriptions, intended trigger points
| name | sound | trigger |
|------|-------|---------|
| hit.light | tight snap (~0.1 s) | L normal connects |
| hit.medium | solid thwack | M normal connects |
| hit.heavy | deep crunch + sub thump | H normal / sweep / heavy hit connects |
| hit.special | crunch + zap + sparkle | special or super hit connects (generic layer; add the character's own hit sound for projectiles) |
| hit.counter | heavy crunch + metallic ting | any hit that is a COUNTER (instead of the normal hit sound) |
| block.light / block.heavy | short dull "tk" / muted clank | light-medium / heavy-special attack blocked |
| whiff.light/medium/heavy | swish / swoosh / whoomp | attack startup (play on every L/M/H, hit or not) |
| jump / land / dash | air puff + small blip / footfall / swoosh+scuff | leave ground / land / dash or back-dash start |
| down | body hits floor + bounce | knockdown impact |
| throw.grab / throw.slam / throw.tech | cloth grab / floor slam / bright clash | throw connects / victim hits floor / throw teched |
| ko | biggest impact, ~2 s tail | the KO hit |
| super.flash | 0.55 s riser into major-chord impact | super freeze / cut-in start (pair with `duck(0.6, 1.5)`) |
| super.charge | rising FM whirl | energy converging on the fighter (FX `super.charge`) |
| meter.full | bright two-note chime | gauge reaches 100 |
| counter.catch | "ching!" + zip | COUNTER banner, or Guardrail catch |
| timer.tick | woodblock tick | each second of the last 10 s |
| ann.round / ann.fight / ann.ko / ann.perfect / ann.timeup / ann.win | stingers | with the matching banner |
| ui.move / ui.confirm / ui.cancel / ui.start / ui.error / ui.pause / ui.lock | menu sounds | cursor / accept / back / press start / invalid / pause open-close / character-stage locked |
| text.blip | tiny blip, fine at 20/s | typewriter dialogue characters |
| claude.spark / claude.sparkHit | bell-triplet cast / starburst impact | Spark Shot leaves the pen / hits (blocked: vol 0.6) |
| claude.sonnet | rising arpeggio whoosh + pages | Sonnet Rise start |
| claude.haiku | brush slash + koto pluck | each Haiku hit; `pitch` 1, 1.12, 1.26 for hits 1-3 |
| claude.guardrail | glassy shield rising | Guardrail stance start (play `counter.catch` on a catch) |
| claude.beam | ~1.2 s charge → roaring glyph beam → tail | Magnum Opus beam fires |
| deepseek.wave / deepseek.waveHit | rushing water / splash | Whale Wave spawns / hits |
| deepseek.breach | thump + spray whoosh + bloops | Breach start |
| deepseek.dive / deepseek.emerge | plunge + bubbles / burst | diveIn / diveOut |
| deepseek.chain | snappy wet punch | each Chain step; `pitch` 1, 1.12, 1.3 |
| deepseek.diveKick | descending whoosh, water trail | Dive Kick descent |
| deepseek.whale | ~1.5 s whale call gliding up, then colossal splash | Whale Fall: R1 breaches |

Voices: `voice('claude'|'deepseek', kind)`, kinds `light medium heavy special super hurt ko win intro`.
Suggested: light/medium/heavy on ~1/3 of normals (not every hit), special on specials, super with
the super flash, hurt on heavy/counter hits taken, ko on KO, win on the win pose, intro at entrance.

## Music
| track | key / BPM | form (bars) | length |
|-------|-----------|-------------|--------|
| title | D major, 120 | I(2) A(8) B(8), loop A–B | 36 s, loop 32 s |
| select | F major, 126 | A(8) B(8) | loop 30.5 s |
| vs | D minor, 120 | 2-bar sting, one-shot | 4 s |
| stage.library | D major/lydian, 138 | I(4) A A' B C (8 each), loop from A | 62.6 s, loop 55.7 s |
| stage.abyss | E minor/dorian, 166 | I(4) A A' B B' C (8 each) | 63.6 s, loop 57.8 s |
| stage.latent | C minor, 150 | I(4) A B C B (8 each) | 57.6 s, loop 51.2 s |
| stage.training | C major, 86 swing | A(8) B(8) | loop 44.7 s |
| victory | C major, 150 | 3 bars, one-shot | 4.8 s + ring |
| continue | A harmonic minor, 120 | 8 bars | loop 16 s |
| ending | G major (+ borrowed Cm), 92 | I(2) A(8) B(8) | 47 s, loop 41.7 s |

Motifs: **Claude** = 3–5–8–7–5 with the long-short-long rhythm `6-2-4-2-2` (library A, title A, ending A,
latent chorus in Ab). **DeepSeek** = minor-pentatonic run 1–b3–4–5–b7–5–4–b3 in `2-2-1-3-2-2-2-2`
(abyss A, title B, ending B, latent chorus/bridge).

### Track format (seq.js)
```js
K.defTrack('name', { bpm, spb: 4, bpb: 4, swing: 0..0.5, vol, scale: 'D major +G#', order: ['I','A','B'], loop: 'A' | false,
  ch: { lead: { ins: 'lead', w: 's25', vol, pan, echo, verb, lp, vib: [Hz, cents, delay], env: [a,d,s,r], uni, gate, melody: true }, ... },
  sec: { A: { bars: 8, chords: 'Dmaj7 | E/D | Bm7 G',             // bar split equally, or 'C:12 G:4'
              lead: 'F#5:6 A5:2 D6:4 C#6:2 A5:2 | ...',             // note:steps, r rest, _ tie, ! accent, ' soft, ~ slide, ^ deliberate chromatic
              bass: 'R:3 R:1 r:2 R:2 5:2 R:2 8:2 R:2',              // chord degrees: R(slash bass) T(root) 2-9 8 A(approach) b/# alterations, +/- octave
              arp: { arp: [0,1,2,3], step: 2, len: 2, lo: 62, hi: 81 }, pad: { pad: 1, lo, hi }, keys: { stab: 'x..x....', lo, hi, len },
              drums: { k: 'x...x...', s, h, o, c, t: '..1.2.3.', p, r, w, z, b } } } });
```
Every bar must sum to `spb·bpb` steps; a line shorter than its section repeats (its bar count must
divide the section's). `node tools/audio-render.mjs theory [--score]` asserts all of that, checks
scale membership (chord tones and `^` notes exempt), strong-beat melody vs chord (b9 clashes),
bass root on downbeats/chord changes, and m2/M7 clashes between melody and counter voices.

### Adding things
- SFX: `K.defSfx('name', { dur, poly, guard, jitter, wet, stereo, desc, when, build(r, out, t, p, rnd) { S.osc(...); S.noise(...); } })`
  in an sfx-*.js file; start every envelope at 0 with ≥ 0.3 ms attack; then run
  `node tools/audio-render.mjs sfx name` and add a trim to `mix.js`.
- Track: `K.defTrack` in a tracks-*.js file, then `theory name --score`, `music name`, `seam name`.

## Measurement tool
`node tools/audio-render.mjs sfx|voice|music|seam|theory|combat|all [names] [--wav] [--game] [--seconds N] [--score]`
renders through the real graph on an OfflineAudioContext in headless Chromium and prints peak, RMS,
LUFS (BS.1770 K-weighted M/I), DC, clip count, active duration, attack time, spectral centroid and
band split; PNGs (waveform + log spectrogram) and optional WAVs go to `.shots/audio/`.
Seam check: renders intro + 2 loop passes, compares 10 ms RMS envelopes around seam 1 vs seam 2.
Note: Chromium's oscillator start phase depends on the sub-quantum start offset when `frequency`
is automated, so static pitches use `.value` and note starts are rounded to whole samples.

## Deviations / known issues
- No contract deviations. Additions listed above.
- SFX reverb is baked into the cached buffers; while the cache is still rendering (first ~1 s after
  unlock) sounds play live and dry.
- Voices are formant blips — cute, but obviously synthetic.
