/* LATENT CLASH — shared constants (owned by LEAD; read-only for module agents).
 * Loaded first on every page. Everything hangs off window.LC. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};

  LC.VERSION = '2.0.0';
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
      { // 0 — "Daylight": vivid orange hair, cream Victorian dress with black + orange panels
        id: 'daylight',
        outline: '#2a1714',
        skin:    ['#fff0e4', '#f9d9c4', '#e0a890', '#b9745f'],
        blush:   '#ff9d8a',
        hair:    ['#ffb46a', '#f47c2c', '#c9541a', '#8a3210'],
        hairTip: ['#ffd9a8', '#ffa24a'],
        eye:     ['#fff4d6', '#e8a04a', '#a8642a', '#5a2b14'],
        cloth1:  ['#fffdf6', '#f4ecdf', '#d6c8b4', '#a6957f'],   // cream-white: blouse, capelet, skirt, boots
        cloth2:  ['#4a4444', '#2c2728', '#1c1819', '#0f0c0d'],   // black: cravat, corset belt, skirt panels, bows
        accent:  ['#ffd08a', '#ff8a3c', '#e5621f', '#a23c10'],   // vivid orange: sash panels, flowers, lining, magic
        metal:   ['#fff3b8', '#edbd4f', '#b07e2a', '#7a5218'],   // gold: trim, chain, tassels, book corners, light-quill
        book:    ['#b0563a', '#7a3324', '#55211a', '#32120f'],   // leather cover of the book
        ui:      '#e5621f', uiLight: '#ffb46a', uiDark: '#8a3210'
      },
      { // 1 — "Dark mode": ivory hair, charcoal dress with cream + amber panels
        id: 'darkmode',
        outline: '#1d1416',
        skin:    ['#fff0e4', '#f9d9c4', '#e0a890', '#b9745f'],
        blush:   '#ff9d8a',
        hair:    ['#ffffff', '#efe6d6', '#c9b9a2', '#8f806e'],
        hairTip: ['#ffb07a', '#ff8a57'],
        eye:     ['#fff4d6', '#e8a04a', '#a8642a', '#5a2b14'],
        cloth1:  ['#6a6578', '#474352', '#2c2a34', '#1a191f'],
        cloth2:  ['#fffdf6', '#efe6d6', '#c9b9a2', '#8f806e'],
        accent:  ['#fff0b0', '#ffc94a', '#e39a1e', '#a3640f'],
        metal:   ['#ffffff', '#d9d4e0', '#9a94a8', '#5e596b'],
        book:    ['#5f7f8f', '#3a5563', '#263b46', '#16242c'],
        ui:      '#efe6d6', uiLight: '#ffffff', uiDark: '#474352'
      }
    ],
    deepseek: [
      { // 0 — "Surface": deep-blue hair, navy maid dress, white apron
        id: 'surface',
        outline: '#0f1430',
        skin:    ['#fff3ea', '#fbdccb', '#e2ab9b', '#b87a72'],
        blush:   '#ff9fb0',
        hair:    ['#6f8fe8', '#2f4bb5', '#1f2f80', '#141c52'],
        hairTip: ['#9fd8ff', '#4fa0f0'],
        eye:     ['#e6fbff', '#58c4ff', '#2a7fe0', '#123a8a'],
        cloth1:  ['#ffffff', '#eaf0fc', '#bcc8ea', '#8794c6'],   // white: apron, headdress, cuffs, frills, tights
        cloth2:  ['#3d4a8f', '#252e63', '#181e45', '#0e122c'],   // navy: the maid dress, shoes
        under:   ['#8fb0f0', '#5f86d8', '#4468b8', '#2f4a8c'],   // lighter blue pinstriped under-skirt
        fin:     ['#56608f', '#343c66', '#222848', '#14182e'],   // whale tail and head fins (navy-grey)
        accent:  ['#d4faff', '#74d4ff', '#2ba0f0', '#1a6fc0'],   // cyan-blue: hair bow, gem, water, glow
        metal:   ['#fff0b0', '#e0b860', '#a07a30', '#6a4c18'],   // gold: buttons, embroidery, small bows
        ui:      '#4d6bfe', uiLight: '#a9c0ff', uiDark: '#222c85'
      },
      { // 1 — "Abyss": pale aqua hair, teal-cyan dress with navy apron, coral-pink glow
        id: 'abyss',
        outline: '#0c1030',
        skin:    ['#fff3ea', '#fbdccb', '#e2ab9b', '#b87a72'],
        blush:   '#ff9fb0',
        hair:    ['#e9fbff', '#9fe6f5', '#56b6d6', '#2c7a9c'],
        hairTip: ['#ffffff', '#d9fbff'],
        eye:     ['#ffe6f2', '#ff8fc0', '#e0508f', '#8a2a5c'],
        cloth1:  ['#4a5aa8', '#2c3777', '#1c2352', '#111638'],
        cloth2:  ['#b8f6ff', '#5cdcf5', '#27a6d0', '#17709a'],
        under:   ['#ffffff', '#d9f4fb', '#a6d6e6', '#6fa6bc'],
        fin:     ['#9fe6f5', '#56b6d6', '#2c7a9c', '#184a62'],
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
