/* LATENT CLASH — FIGHT move list data for the pause menu / how-to-play (LC.fight.getMoveList). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};

  var NORMAL_ZH = { '5L': '站立轻攻击', '5M': '站立中攻击', '5H': '站立重攻击', '2L': '下段轻攻击', '2M': '下段中攻击',
    '2H': '扫腿（击倒）', jL: '空中轻攻击', jM: '空中中攻击', jH: '空中重攻击' };
  var NORMAL_EN = { '5L': 'STAND LIGHT', '5M': 'STAND MEDIUM', '5H': 'STAND HEAVY', '2L': 'CROUCH LIGHT', '2M': 'CROUCH MEDIUM',
    '2H': 'SWEEP', jL: 'JUMP LIGHT', jM: 'JUMP MEDIUM', jH: 'JUMP HEAVY' };

  function dmgOf(mv) {
    if (mv.proj) { var d = mv.proj.dmg; return typeof d === 'object' ? d.L + '/' + d.M + '/' + d.H : String(d); }
    if (!mv.hits) return '';
    var parts = mv.hits.map(function (h) {
      if (h.every) {
        var n = Math.floor((h.fr[1] - h.fr[0]) / h.every) + 1;
        var fin = h.final && h.final.dmg ? h.final.dmg : h.dmg;
        return String(h.dmg * (n - 1) + fin);
      }
      var x = h.dmg;
      return typeof x === 'object' ? x.L + '/' + x.M + '/' + x.H : String(x);
    });
    return parts.join(' + ');
  }

  F.getMoveList = function (charId) {
    var C = F.chars[charId];
    if (!C) return [];
    var L = (LC.LORE && LC.LORE.moves && LC.LORE.moves[charId]) || {};
    var out = [
      { id: 'dash', name: '冲刺 / 后撤步', nameEn: 'DASH / BACKDASH', input: '66 / 44', simple: '66 / 44', type: 'system', desc: '快速前冲；后撤步出招瞬间无敌。', damage: '' },
      { id: 'guard', name: '防御', nameEn: 'GUARD', input: '4 / 1', simple: '4 / 1', type: 'system', desc: '按住后方防御。站防挡中/上段（跳攻为上段），蹲防挡中/下段。', damage: '' },
      { id: 'throw', name: '投技', nameEn: 'THROW', input: 'L+M', simple: 'L+M', type: 'throw', desc: '贴身无法防御。4+L+M 向后投。被抓住后 8 帧内按 L+M 可拆投。', damage: String(F.T.THROW_DMG) }
    ];
    ['5L', '5M', '5H', '2L', '2M', '2H', 'jL', 'jM', 'jH'].forEach(function (id) {
      var mv = C.moves[id];
      if (!mv) return;
      var h = mv.hits[0];
      var gd = h.guard === 'low' ? '下段' : h.guard === 'high' ? '上段' : '中段';
      out.push({ id: id, name: NORMAL_ZH[id], nameEn: NORMAL_EN[id], input: id.replace('5', '').replace('j', 'j.'), simple: id,
        type: 'normal', desc: gd + (id === '2H' ? '，命中击倒。' : '。轻→中→重可连续取消。'), damage: dmgOf(mv) });
    });
    var order = charId === 'claude' ? ['spark', 'sonnet', 'haiku', 'guardrail', 'super'] : ['wave', 'breach', 'chain', 'dive', 'diveKick', 'super'];
    order.forEach(function (id) {
      var mv = C.moves[id], lore = L[id] || {};
      if (!mv) return;
      var dmg = dmgOf(mv);
      if (id === 'chain') dmg = [C.moves.chain, C.moves.chain2, C.moves.chain3].map(function (x) { return x.hits[0].dmg.M; }).join(' + ');
      if (id === 'guardrail') dmg = dmgOf(C.moves.guardrailHit);
      out.push({ id: id, name: lore.zh || id, nameEn: lore.en || id.toUpperCase(),
        input: (lore.input || mv.motion) + (id === 'super' ? '+攻击' : '+L/M/H'), simple: lore.simple || '',
        type: mv.kind === 'super' ? 'super' : 'special', desc: (lore.desc || '') + (id === 'super' ? '（需要满能量）' : ''), damage: dmg });
      if (id === 'spark' && C.moves.airSpark) out.push({ id: 'airSpark', name: (lore.zh || '') + '（空中）', nameEn: 'AIR ' + (lore.en || ''),
        input: 'j.236+L/M/H', simple: 'j.S', type: 'special', desc: '空中斜向下发射。', damage: dmgOf(C.moves.airSpark) });
    });
    return out;
  };
})();
