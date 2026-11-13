# AUDIO — `LC.audio` (WebAudio synth: SFX, chiptune music, voice blips)

(Full documentation is written at the end; this file starts as a progress log so a restart is cheap.)

## Progress / next steps
- [x] core.js — namespace `LC.audio._` (K), registries (K.SFX, K.TRACKS, K.INS, K.DRUMS), note/scale/chord parsing, voice-leading, RNG.
- [x] synth.js — per-context resources (noise buffers, pulse PeriodicWaves, shaper curves, IR) + layer helpers S.osc / S.noise / S.bus / S.echo / S.bubble / S.bell.
- [ ] mixer.js — Mixer(ctx): master→comp→softclip, sfx/music buses, reverb, duck, pause, voice limiting, sfx cache render, track instances.
- [ ] engine.js — public API (init/unlock/sfx/voice/music/setVolume/getVolume/duck/setPaused/list), lifecycle, scheduler timer.
- [ ] instruments.js + seq.js — instruments, drum buffers, track compiler/validator, look-ahead scheduler.
- [ ] sfx-*.js, voice.js — all SFX of §5.7 + voice chirps.
- [ ] tracks-*.js — 10 tracks.
- [ ] dev/audio-test.html, dev/audio-render.html, tools/audio-render.mjs, tools/audio-analyze.js.
- [ ] manifest.js, NOTES.md final, measurement passes.

Design decisions so far: all SFX are pre-rendered to AudioBuffers (OfflineAudioContext) in the
background after unlock (live synthesis fallback until ready); music is scheduled live with
look-ahead; one convolver reverb on the music path only (SFX reverb is baked into cached buffers).
