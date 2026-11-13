/* LATENT CLASH — LC.save: localStorage wrapper that never throws (PLATFORM).
 * Falls back to an in-memory store when storage is unavailable (sandboxed iframes,
 * private mode, quota). Values are JSON. Also owns loading/saving LC.settings. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var PREFIX = 'latentclash.v1.';
  var mem = {};
  var ls = null;
  try {
    ls = window.localStorage;
    var probe = PREFIX + '__probe';
    ls.setItem(probe, '1'); ls.removeItem(probe);
  } catch (e) { ls = null; }

  var save = LC.save = {
    available: !!ls,
    get: function (key, fallback) {
      var raw;
      try { raw = ls ? ls.getItem(PREFIX + key) : mem[key]; } catch (e) { raw = mem[key]; }
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw;
      try { raw = JSON.stringify(value); } catch (e) { console.error('[platform] save: cannot serialise', key); return false; }
      mem[key] = raw;
      if (!ls) return false;
      try { ls.setItem(PREFIX + key, raw); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      delete mem[key];
      try { if (ls) ls.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },
    clearAll: function () {
      mem = {};
      if (!ls) return;
      try {
        var keys = [];
        for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k); }
        keys.forEach(function (k) { ls.removeItem(k); });
      } catch (e) { /* ignore */ }
    },

    // ---- settings -------------------------------------------------------------
    DEFAULTS: null,
    loadSettings: function () {
      if (!save.DEFAULTS) save.DEFAULTS = JSON.parse(JSON.stringify(LC.settings));
      var s = save.get('settings', null);
      if (s && typeof s === 'object') {
        Object.keys(save.DEFAULTS).forEach(function (k) {
          if (s[k] !== undefined && typeof s[k] === typeof save.DEFAULTS[k]) LC.settings[k] = s[k];
        });
      }
      return LC.settings;
    },
    saveSettings: function () { return save.set('settings', LC.settings); },
    resetSettings: function () {
      if (!save.DEFAULTS) return;
      Object.keys(save.DEFAULTS).forEach(function (k) { LC.settings[k] = save.DEFAULTS[k]; });
      save.saveSettings();
    }
  };
})();
