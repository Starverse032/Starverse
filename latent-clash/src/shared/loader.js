/* LATENT CLASH — dev script loader (owned by LEAD).
 *
 * Works from file:// and http:// with no build step. Usage in any HTML page:
 *
 *   <script src="../src/shared/loader.js" data-root="../src/" data-modules="rig,fx"></script>
 *   <script> ...page code; every requested module is loaded by now... </script>
 *
 * - data-root:    path from the page to the src/ directory (default "src/")
 * - data-modules: comma list of module directories to load, in order. Use "all"
 *                 for the canonical order below. shared/config.js and
 *                 shared/lore.js are always loaded first.
 *
 * Each module directory contains manifest.js, which registers its script files
 * (in load order, paths relative to the module directory):
 *
 *   (window.LC_MANIFEST = window.LC_MANIFEST || {}).rig = ['core.js', 'chars/claude.js'];
 *
 * A module whose manifest is missing is skipped silently (its files simply are
 * not there yet), so pages keep working while other modules are still being
 * written. tools/build.mjs reads the same manifests to produce the single-file
 * build, so manifest.js must stay a plain one-statement registration.
 */
(function () {
  'use strict';
  var ALL = ['platform', 'audio', 'fx', 'stages', 'illust', 'rig', 'fight'];
  var me = document.currentScript;
  var root = me.getAttribute('data-root') || 'src/';
  var req = (me.getAttribute('data-modules') || 'all').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (req.length === 1 && req[0] === 'all') req = ALL.slice();
  var bust = /[?&]nocache=1/.test(location.search) ? ('?t=' + Date.now()) : '';

  function tag(src) { return '<script src="' + src + bust + '"><\/script>'; }

  window.LC_MANIFEST = window.LC_MANIFEST || {};
  window.LC_LOADER = {
    root: root, modules: req, order: ALL,
    stage2: function () {
      var html = '';
      req.forEach(function (m) {
        var files = window.LC_MANIFEST[m];
        if (!files) return;                       // module not present yet
        files.forEach(function (f) { html += tag(root + m + '/' + f); });
      });
      if (html) document.write(html);
    }
  };

  var html = tag(root + 'shared/config.js') + tag(root + 'shared/lore.js');
  req.forEach(function (m) { html += tag(root + m + '/manifest.js'); });
  html += '<script>LC_LOADER.stage2();<\/script>';
  document.write(html);
})();
