/* LATENT CLASH — shared constants (owned by LEAD; read-only for module agents).
 * Loaded first on every page. Everything hangs off window.LC. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};

  LC.VERSION = '1.0.0';
  LC.TITLE_ZH = '潜空间激斗';
  LC.TITLE_EN = 'LATENT CLASH';

  // ---- Screen / world -------------------------------------------------------
  LC.W = 384;            // internal resolution (16:9), integer-upscaled to the display
  LC.H = 216;
  LC.FPS = 60;           // fixed logic rate; ALL durations are in frames (ticks)
  LC.GROUND_Y = 186;     // screen/world y of the ground line fighters stand on
  LC.STAGE_W = 640;      // world width; camera x ranges over [0, STAGE_W - W]
  LC.BLEED = 8;          // backgrounds must cover an extra 8px on every side (screen shake)

  LC.CHARS = ['claude', 'deepseek'];
  LC.STAGES = ['library', 'abyss', 'latent', 'training'];

  // ---- Default settings (PLATFORM overwrites from saved data at boot) --------
  LC.settings = {
    master: 0.8, music: 0.6, sfx: 0.9,
    shake: true,          // screen shake
    flash: true,          // false = reduce full-screen flashes (photosensitivity)
    crt: false,           // scanline / CRT filter
    difficulty: 3,        // 1..5
    rounds: 2,            // rounds needed to win a match
    time: 99,             // round timer in seconds, 0 = infinite
    touch: 'auto',        // 'auto' | 'on' | 'off'
    showFps: false
  };

  // ---- Character palettes -----------------------------------------------------
  // Single source of truth for RIG, ILLUST and FX. Each ramp is ordered
  // [highlight, base, shade, deep]. Derive in-between tones from these if you
  // must, but never introduce an unrelated hue for a listed slot.
  // Index 0 = default colours, index 1 = alternate (used for mirror matches).
  LC.PAL = {
    claude: [
      { // 0 — "Daylight": coral hair, cream jacket, slate skirt
        id: 'daylight',
        outline: '#2a1a1c',
        skin:    ['#ffeadb', '#f7cdb2', '#dc9f86', '#b9715f'],
        blush:   '#ff9d8a',
        hair:    ['#ffc79a', '#ee8a5f', '#c25e42', '#8a3b30'],
        hairTip: ['#fff1d6', '#ffd7a8'],
        eye:     ['#fff4d6', '#f0a03a', '#b3601f', '#5a2b14'],
        cloth1:  ['#fffaf0', '#f1e7d3', '#cfbd9f', '#9d8a73'],   // cream: capelet jacket, boots
        cloth2:  ['#5b5768', '#3e3b49', '#27252e', '#17161b'],   // slate: skirt, tights, pen barrel
        accent:  ['#ffd9a0', '#ff9e6b', '#d97757', '#a34d36'],   // spark orange: ribbon, clip, magic
        metal:   ['#fff3b8', '#edbd4f', '#b07e2a', '#7a5218'],   // gold: pen bands & nib, buttons
        ui:      '#d97757', uiLight: '#ffb58a', uiDark: '#7e3830'
      },
      { // 1 — "Dark mode": ivory hair, slate jacket, terracotta skirt
        id: 'darkmode',
        outline: '#1d1416',
        skin:    ['#ffeadb', '#f7cdb2', '#dc9f86', '#b9715f'],
        blush:   '#ff9d8a',
        hair:    ['#ffffff', '#efe6d6', '#c9b9a2', '#8f806e'],
        hairTip: ['#ffb07a', '#ff8a57'],
        eye:     ['#fff4d6', '#f0a03a', '#b3601f', '#5a2b14'],
        cloth1:  ['#6a6578', '#474352', '#2c2a34', '#1a191f'],
        cloth2:  ['#f09a76', '#d97757', '#a84f3a', '#6e3126'],
        accent:  ['#fff0b0', '#ffc94a', '#e39a1e', '#a3640f'],
        metal:   ['#ffffff', '#d9d4e0', '#9a94a8', '#5e596b'],
        ui:      '#efe6d6', uiLight: '#ffffff', uiDark: '#474352'
      }
    ],
    deepseek: [
      { // 0 — "Surface": blue hair, white whale hoodie
        id: 'surface',
        outline: '#131a3c',
        skin:    ['#fff0e6', '#f8d6c4', '#dba595', '#b87a72'],
        blush:   '#ff9fb0',
        hair:    ['#a9c0ff', '#4d6bfe', '#3346c9', '#222c85'],
        hairTip: ['#c9f7ff', '#6fe0ff'],
        eye:     ['#e6fbff', '#58d4ff', '#1f8fe0', '#123a8a'],
        cloth1:  ['#ffffff', '#e8eefc', '#b8c5ea', '#8492c6'],   // white: hoodie body, sneakers
        cloth2:  ['#7d95ff', '#4d6bfe', '#3346c9', '#222c85'],   // blue: hood top, stripes, shorts, whale tail
        accent:  ['#d4faff', '#74e4ff', '#2bb8f0', '#1a7fc0'],   // cyan: water, glow, gloves
        metal:   ['#ffffff', '#c9d4f0', '#8a97c2', '#56608c'],   // silver: zipper, eyelets
        ui:      '#4d6bfe', uiLight: '#a9c0ff', uiDark: '#222c85'
      },
      { // 1 — "Abyss": pale aqua hair, navy hoodie, coral-pink glow
        id: 'abyss',
        outline: '#0c1030',
        skin:    ['#fff0e6', '#f8d6c4', '#dba595', '#b87a72'],
        blush:   '#ff9fb0',
        hair:    ['#e9fbff', '#9fe6f5', '#56b6d6', '#2c7a9c'],
        hairTip: ['#ffffff', '#d9fbff'],
        eye:     ['#ffe6f2', '#ff8fc0', '#e0508f', '#8a2a5c'],
        cloth1:  ['#4a5aa8', '#2c3777', '#1c2352', '#111638'],
        cloth2:  ['#b8f6ff', '#5cdcf5', '#27a6d0', '#17709a'],
        accent:  ['#ffe0ea', '#ff9fc0', '#f0609a', '#b03a70'],
        metal:   ['#ffffff', '#c9d4f0', '#8a97c2', '#56608c'],
        ui:      '#5cdcf5', uiLight: '#b8f6ff', uiDark: '#1c2352'
      }
    ]
  };

  // Neutral UI palette (menus, HUD). PLATFORM / FIGHT / ILLUST share these.
  LC.UI = {
    bg0: '#0b0a14', bg1: '#15132a', bg2: '#231f45', line: '#3b3670',
    text: '#f4efe6', dim: '#9b96b8', gold: '#ffd166', red: '#ff4d6d',
    green: '#5ee6a8', hp: '#ffd23f', hpLow: '#ff5a4d', hpLag: '#ffffff',
    meter: '#58d4ff', meterFull: '#fff07a', black: '#05040a'
  };
})();
