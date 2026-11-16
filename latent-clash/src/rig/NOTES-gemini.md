# Gemini 娘 — rig notes (Gemini animator)

Design source: CONTRACT-V2 §V2.6 + `LC.PAL.gemini` (slots hair2, ear, eye2, lining, star). Files: `chars/gemini-art.js`
(head stamp, faces, hands, star stamps), `chars/gemini.js` (body, chains, renderer), `anims/gemini-base.js` (common
set + airJump), `anims/gemini-attacks.js` (normals, specials, super). Registration: `manifest.js` (load order),
`anims/placeholders.js` (her segment table + aliases).

## Progress / next steps (kept current for restarts)
- [ ] step 1: registration + body + look in idle
- [ ] step 2: base set
- [ ] step 3: normals
- [ ] step 4: specials + super
- [ ] step 5: throws, intro, win, lose
