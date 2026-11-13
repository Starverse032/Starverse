# PLATFORM — notes

## Progress / next steps (keep updated)
- [x] font bake `tools/platform-bake-font.py` → `src/gen/fontdata.js`; verified pixel-identical to Chromium (`node tools/platform-font-check.mjs`)
- [x] `font.js` (LC.font), `save.js` (LC.save), `input.js` (LC.input), `display.js` (LC.display), `touch.js` (LC.input.touch)
- [ ] `ui.js` (LC.ui kit), `app.js` (loop + LC.scenes + boot), `debug.js`
- [ ] scenes: boot, title(+attract), menu, select, stage, vs, match(+stub, pause), result, arcade(ladder/continue/ending), howto, options(+keys), credits
- [ ] index.html, package.json, tools/build.mjs, tools/platform-smoke.mjs, README.md
- [ ] screenshot polish passes (desktop 1280×720, phone 844×390 / 390×844 touch)
