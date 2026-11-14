# AUDIO — `LC.audio` (WebAudio synth: SFX, chiptune music, voice blips)

(Full documentation is written at the end; this file starts as a progress log so a restart is cheap.)

## Progress / next steps
- [x] core.js, synth.js, mixer.js, instruments.js, seq.js, engine.js (public API), offline.js (tool hooks)
- [x] sfx-fight.js, sfx-system.js, sfx-chars.js — all 52 SFX of §5.7 render, no clipping (balance pass pending)
- [x] voice.js — voice(charId, kind) formant chirps for both characters, all 9 kinds
- [x] tools/audio-render.mjs + tools/audio-analyze.js + dev/audio-render.html (offline measurement works)
- [ ] music: stage.library, stage.abyss, stage.latent (tracks-stages.js) -> then title, select, victory, vs, stage.training, continue, ending
- [ ] SFX/voice/music loudness balance pass (trim table), loop seam checks
- [ ] dev/audio-test.html, NOTES.md final docs
