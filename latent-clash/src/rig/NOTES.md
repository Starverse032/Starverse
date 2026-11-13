# RIG — notes

## Progress / next steps (kept current for restarts)

Design (decided):
- Puppets render into a palette-INDEXED buffer (raster.js): index = 2 + material*4 + tone; 0 empty, 1 outline.
  Groups (arm, leg, torso, head, hair…) are rasterised to scratch, then composited with a 1-px
  4-neighbour outline (exterior = PAL.outline, interior = front part's deep tone / outline if darker behind).
- Limbs/torso/clothes = procedural primitives (tapered capsules, polygons, ellipses) with per-primitive
  cel shading (light from upper front). Heads = hand-authored ASCII stamps + expression overlays,
  tilted via RotSprite (cached).
- skel.js: pose = plain object (vectors root/hip/head/hF/hB/fF/fB/muz/grab/wpn; scalars lean, bend,
  tilt, faF, faB, pen, sq, shr, haF, haB, pg, skirt, tail, arch; discrete eyes/mouth/handF/…),
  per-segment keys, eased, time quantised to `step` (twos). 2-bone IK for arms/legs.
- Secondary motion (secondary.js): verlet chains in local space, inertia from env velocity, hysteresis snapping.
- Foot lock in tick() for walk anims (visual only; anchors stay analytic).

Status:
- [x] raster.js, skel.js
- [ ] secondary.js, core.js (API + puppet), chars/claude.js, chars/deepseek.js
- [ ] anims/*-base.js, anims/*-attacks.js, anims/placeholders.js, manifest.js
- [ ] dev/rig-viewer.html, dev/rig-sheet.html, tools/rig-sheet.mjs
- [ ] art iteration rounds, perf test, authoring guide
