# AUDIO — `LC.audio` (Web Audio synth: SFX, chiptune music, voice chirps)

## Progress / next steps
- 2026-11-14: verified end to end. `node tools/audio-smoke.mjs` (realtime, headless Chromium) = ALL OK;
  `node tools/audio-render.mjs all` = 0 clips, 0 console warnings, 0 theory errors, seams identical.
- Fixed this pass: track fade-out stopped scheduling notes after the 300 ms look-ahead (long `fade`
  went silent early); tracks replaced in the same frame were kept for 3 s each (30 rapid `music()`
  calls = 34 live graphs) — now dropped at once, stopped tracks freed 0.1 s after their fade;
  music bus −2.5 dB (`K.MUSIC_TRIM`) so music sits under SFX at equal sliders; `ui.start`/`ui.lock`
  trimmed −2 dB to stay under `hit.light`.
- 2026-11-15: GPT 娘 added (6 `gpt.*` SFX, `voice('gpt', …)`, `list().voice.chars` now from voice.js); smoke ALL OK, 0 clips.
- 2026-11-16: Gemini 娘 added (7 `gemini.*` SFX, `voice('gemini', …)` with a cat-like upward flick per syllable); smoke ALL OK, 0 clips.
- Next (optional): see "Known weaknesses".

Everything is synthesized at runtime — no audio files. Dev pages: `dev/audio-test.html` (button per
SFX / voice / track, volume/pan/pitch sliders, scope, combat sim) and `dev/audio-render.html`
(headless harness for the tools).

## Files (load order = `manifest.js`)
| file | what |
|------|------|
| `core.js` | namespace `LC.audio._` (= K): registries `K.SFX`, `K.TRACKS`, `K.INS`, `K.DRUMS`; note/scale/chord parsing, voice-leading, seeded RNG |
| `synth.js` | per-context resources (noise buffers white/pink/brown/metal/crackle, band-limited pulse PeriodicWaves `p12/p25/p50`, softened `s12/s25/s50`, `glottal`, `reed`, `tri8`; shaper curves; synthetic reverb IR) + layer helpers `S.osc`, `S.noise`, `S.bus`, `S.echo`, `S.bubble`, `S.bell`, `S.env` |
| `mixer.js` | `K.Mixer(ctx)` — the whole graph for one (realtime or offline) context; voice limiting; SFX cache rendering (`K.renderSfx`) |
| `instruments.js` | music instruments `lead`, `bass`, `pad`, `bell` (2-op FM), `riser`, `drums`; drum kit rendered once to buffers |
| `seq.js` | track compiler + validator, `TrackInst` look-ahead scheduler, score printer / theory checks |
| `sfx-fight.js`, `sfx-system.js`, `sfx-chars.js` | the SFX definitions |
| `mix.js` | per-SFX gain trim table from the measurement pass (not a duplicate of `mixer.js`; must load after all sfx-*.js) |
| `voice.js` | formant voice chirps |
| `tracks-stages.js`, `tracks-menu.js` | the 10 music tracks |
| `engine.js` | public API (§5.7) + lifecycle |
| `offline.js` | `LC.audio._dev` render hooks for tools |

## Graph
```
sfx voices ─► sfxBus(vol) ─────────────────────────────────────────────┐
track channels ─► trackFade ─► musicIn(×0.75) ─► duck ─► pauseLP ─► pauseGain ─► musicVol ─► master ─► compressor(-7 dB, 12:1) ─► soft clip ─► out
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
- Music: a fading-out track keeps scheduling until its fade ends, then is freed (0.1 s later; finished
  one-shots after 3 s of ring-out); a track replaced in the same frame is dropped at once, so rapid
  switching never stacks. 40 ms timer, 300 ms look-ahead, sample-accurate absolute times; notes later than 20 ms are
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
| gpt.breath | 0.5 s airy teal fire roar + crackle + icy glints | dragon-fire breath first active frame |
| gpt.rise | upward whoosh + claw ring + wing flap | rising claw start-up → rise |
| gpt.call / gpt.callSlam | snatch + wing-beat lift / heavy floor impact + rumble | command grab connects / victim hits floor |
| gpt.roar | growling formant sweep + pressure thump | roar move |
| gpt.super | ~1.5 s: three lock-on tones (L/R/C), converging beam blast, icy tail | GPT super: heads appear (after super flash) |
| gemini.star / gemini.starHit | glassy ting + rising sparkle arpeggio / crystalline shatter | star or airStar leaves the hand / star hits (blocked: vol 0.6) |
| gemini.rise | upward whoosh + two detuned twin-star tones (L/R) | starRise start-up → rise |
| gemini.twin | soft two-note chime played twice (echo, L then R) | twin gesture: light-twin appears |
| gemini.twinStrike | light slash + ghostly phasey tail | twinStrike active (the twin claws) |
| gemini.blink | reversed suck-in → pop + sparkle | blinkOut start (optionally blinkIn too, vol 0.6) |
| gemini.super | ~1.5 s: twinkle build-up, falling-star cascade, two crossing beam swells, bright burst | Gemini super: constellation lights (after super flash) |

Voices: `voice('claude'|'deepseek'|'gpt'|'gemini', kind)` (gpt: lowest, darkest, slower/flatter = regal; gemini: highest, brightest, quickest, upward "nya~" flick at syllable ends except hurt/ko), kinds `light medium heavy special super hurt ko win intro`.
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
  `node tools/audio-render.mjs sfx name`, add a trim to `mix.js` toward its category's LUFS-M
  (table below), add the name to the list in `tools/audio-smoke.mjs` if it is contract-required.
- Track: `K.defTrack` in a tracks-*.js file, then `theory name --score`, `music name`, `seam name`.

## Loudness (unity sliders, offline, peak dBFS / LUFS-M; 0 clips everywhere)
| group | sounds (peak / LUFS-M) |
|-------|------------------------|
| hits | light -1.1/-18.9 · medium -0.5/-16.9 · heavy -0.5/-13.7 · special -0.5/-14.3 · counter -0.5/-13.8 |
| block / whiff | block.light -0.6/-22.7 · block.heavy -1.3/-19.7 · whiff L/M/H -6.9/-23.0, -4.3/-21.5, -4.3/-19.8 |
| movement | jump -5.2/-26.4 · land -3.3/-24.2 · dash -4.2/-24.4 · down -2.5/-15.9 |
| throws | grab -1.6/-22.4 · slam -1.1/-9.7 · tech -1.1/-19.6 |
| big | ko -0.5/-8.1 · super.flash -0.5/-10.3 · super.charge -9.0/-16.1 · claude.beam -1.1/-7.8 · deepseek.whale -0.9/-7.2 |
| system | meter.full -9.8/-17.0 · counter.catch -2.2/-16.8 · timer.tick -1.9/-23.6 · ann.* -0.5…-4.0 / -11.1…-12.0 |
| UI | move -7.5/-26.1 · confirm -10.5/-21.1 · cancel -12.2/-21.0 · start -12.4/-20.0 · error -9.8/-21.1 · pause -9.9/-21.0 · lock -5.3/-20.1 · text.blip -5.7/-28.2 |
| characters | specials -1.0…-7.7 / -16.0…-19.6 (chain/haiku hits ≈ -19) · gpt breath -8.4/-16.0 · rise -3.6/-16.0 · call -3.1/-18.1 · callSlam -3.5/-12.9 · roar -2.8/-14.9 · super -0.7/-7.4 · gemini star -4.3/-17.2 · starHit -1.2/-17.5 · rise -5.6/-15.9 · twin -6.9/-17.0 · twinStrike -5.5/-18.7 · blink -2.1/-20.3 · super -0.5/-8.9 |
| voices | peak -7…-13 (gemini -5.7…-11.6), LUFS-M -16 (super) … -22 (light) |
| music (20 s, after trim) | loops -14.6…-15.7 LUFS-I (peak ≤ -1.7); stings vs -13.2, victory -12.5 |
Game defaults (master .8, music .6, sfx .9): combat mix -17.1 LUFS-I, music alone -28.2 → music ≈ 11 LU under.

## Music summary
title D maj 120 (36 s, loop 32 s) · select F maj 126 (loop 30.5 s) · vs D min 120 (4 s one-shot) ·
stage.library D maj/lydian 138 (62.6 s, loop 55.7 s) · stage.abyss E min/dorian 166 (63.6 s, loop 57.8 s) ·
stage.latent C min 150 (57.6 s, loop 51.2 s) · stage.training C maj 86 swing (loop 44.7 s) ·
victory C maj 150 (4.8 s one-shot) · continue A harm. min 120 (loop 16 s) · ending G maj 92 (47 s, loop 41.7 s).
Seam renders: seam 1 and seam 2 envelopes match (−35…−80 dB diff), no dip at the loop point.

## Measurement tool
`node tools/audio-render.mjs sfx|voice|music|seam|theory|combat|all [names] [--wav] [--game] [--seconds N] [--score]`
renders through the real graph on an OfflineAudioContext in headless Chromium and prints peak, RMS,
LUFS (BS.1770 K-weighted M/I), DC, clip count, active duration, attack time, spectral centroid and
band split; PNGs (waveform + log spectrogram) and optional WAVs go to `.shots/audio/`.
Seam check: renders intro + 2 loop passes, compares 10 ms RMS envelopes around seam 1 vs seam 2.
Note: Chromium's oscillator start phase depends on the sub-quantum start offset when `frequency`
is automated, so static pitches use `.value` and note starts are rounded to whole samples.

## Realtime smoke test
`node tools/audio-smoke.mjs`: manifest order, every contract name registered, silent no-ops before
unlock (and music request remembered), unlock in a real click, every SFX / voice / track played,
volume clamp, same-track no-op, restart, 30 rapid switches, long fade, `music(null)`, duck/pause,
hidden-tab suspend/resume, unknown names warn exactly once, no-Web-Audio page silent. Exit code 1 on failure.

## Deviations / known issues
- No contract deviations. Additions listed above.
- SFX reverb is baked into the cached buffers; while the cache is still rendering (first ~1 s after
  unlock) sounds play live and dry.
- Voices are formant blips — cute, but obviously synthetic.
- `stage.latent` is 51 s per loop pass, `continue` 16 s (it is a countdown screen, not a stage).
- `throw.slam` (-9.7 LUFS-M) is louder than `hit.heavy`; intended as a floor impact but can dominate.
- Voice unknown-name warnings only fire once audio is unlocked (calls before unlock are silent no-ops).
- Hidden tab suspends the context, so music resumes where it paused rather than "in real time".
- Default music slider (0.6 from `LC.settings`) puts menu music at about -28 LUFS; if menus feel quiet,
  raise the default to ~0.7 in settings rather than removing `K.MUSIC_TRIM`.
