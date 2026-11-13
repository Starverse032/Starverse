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

Status (step 1 = pipeline end-to-end):
- [x] raster.js, skel.js, secondary.js, core.js (full §5.3 API), placeholders.js (all §3.3 names, contract segs)
- [x] Claude v1 renders (head v2 art, hair, capelet, skirt, pen); idle only authored
- [x] tools/rig-sheet.mjs + dev/rig-sheet.html (anim rows, --overview, --heads, --palettes, --versus, --perf)
- [ ] DeepSeek v1 (chars/deepseek-art.js, chars/deepseek.js, anims/deepseek-base.js)
- [ ] dev/rig-viewer.html (minimal)
- [ ] polish passes in lead's order: idle+faces → walk/dash → guard/hits/launch/down/getup → crouch/jump/land
      → normals → specials → super → throws → intro/win/lose
