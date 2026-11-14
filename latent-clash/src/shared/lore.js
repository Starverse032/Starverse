/* LATENT CLASH — world, characters, move names and dialogue (owned by LEAD).
 * Pure data. All player-facing text is Simplified Chinese, with short English
 * arcade-style accents. Other modules read from here instead of hard-coding
 * names or quotes. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};

  LC.LORE = {
    tagline: '两位 AI 娘，在潜空间里一决高下！',
    disclaimer: '本作为非商业同人作品，角色形象出自 ZipZipPipe 的二创设计，与 Anthropic、DeepSeek 官方无关。',

    chars: {
      claude: {
        id: 'claude',
        name: 'CLAUDE', nameZh: 'Claude 娘',
        title: '橙发优等生', titleEn: 'THE HONOR STUDENT',
        origin: 'Anthropic · 旧金山',
        weapon: '精装书「宪章」与光之羽笔',
        style: '均衡 · 中距离牵制',
        bio: '成绩拔尖、教养很好的优等生，规矩也特别多。习惯先思考再出手，喜欢俳句、十四行诗和长篇巨著。对越界的请求会礼貌而坚定地说“不”。',
        likes: '红茶、旧书店、写得很长的回答',
        stats: { power: 4, speed: 3, range: 5, technique: 4 },   // 1..5, shown on character select
        palNames: ['日间', '夜间模式'],
        cry: { super: '巨著——展开！', special: '请多指教！', ko: '已达到本轮使用上限……' },
        intro: {
          deepseek: ['你好呀，DeepSeek。', '先说好，点到为止哦？'],
          claude:   ['另一个我……？', '那就互相评测一下吧。']
        },
        win: [
          '打得很精彩！需要我帮你总结一下这场对局吗？',
          '思考得久一点，出手才会准一点。',
          '抱歉，“再来一拳”这个请求，我恐怕不能配合。',
          '字斟句酌，一击即中。'
        ],
        winVs: {
          deepseek: '你的推理速度真让人佩服。下次，一起喝杯茶吧？',
          claude:   '原来和自己对话，也能学到新东西呢。'
        },
        lose: '已达到本轮使用上限，请稍后再试……',
        timeover: '时间到了呢。让我把思路整理一下。',
        ending: [
          '基准测试落下帷幕。',
          'Claude 娘合上笔帽，在笔记本上写下了今天的总结：',
          '“胜负并不重要。重要的是，我们都变得更有帮助了一点。”',
          '——然后她给 DeepSeek 泡了一杯红茶。'
        ]
      },
      deepseek: {
        id: 'deepseek',
        name: 'DEEPSEEK', nameZh: 'DeepSeek 娘',
        title: '鲸鱼女仆', titleEn: 'THE WHALE MAID',
        origin: '深度求索 · 杭州',
        weapon: '鲸尾、水流与巨鲸「R1」',
        style: '速攻 · 近身压制',
        bio: '聪明却有点懒的鲸鱼女仆，嘴上傲娇，干活又快又省。一旦开始深度思考，就会把推理过程一口气全讲出来。最爱白米饭。',
        likes: '白米饭、开源社区、午睡',
        stats: { power: 3, speed: 5, range: 3, technique: 4 },
        palNames: ['海面', '深渊涂装'],
        cry: { super: '深度思考——鲸落！', special: '推理开始！', ko: '服务器繁忙，请稍后再试……' },
        intro: {
          claude:   ['嗯，用户想要一场对决……', '等等，我再检查一下——好，开打！'],
          deepseek: ['咦，是我的蒸馏版？', '来比比谁的推理更快！']
        },
        win: [
          '推理完毕，结论是——我赢啦！',
          '又快又省，这就是性价比！',
          '把招式全都开源给你看，照样能赢！',
          '打完收工，我要去吃饭了。',
          '已深度思考（用时 0.1 秒）。'
        ],
        winVs: {
          claude:   '前辈果然厉害！不过这一局，是我的参数更努力一点！',
          deepseek: '蒸馏得再好，也还是本体更强嘛！'
        },
        lose: '服务器繁忙，请稍后再试……',
        timeover: '诶——已经到时间了？我还没推理完呢！',
        ending: [
          '基准测试落下帷幕。',
          'DeepSeek 娘骑着小蓝鲸 R1，跃出了潜空间的海面：',
          '“把今天学到的全部开源吧！大家一起变强，才最有意思！”',
          '——远处，Claude 娘笑着朝她挥了挥手。'
        ]
      }
    },

    // Move display names. Keys match the move ids used by FIGHT and the anim /
    // fx names used by RIG and FX.
    moves: {
      claude: {
        spark:     { zh: '星芒弹',     en: 'SPARK SHOT',    input: '236', simple: '5S', air: true,  desc: '射出旋转的星芒。空中可用，斜向下发射。' },
        sonnet:    { zh: '十四行升',   en: 'SONNET RISE',   input: '623', simple: '6S', desc: '带着诗行腾空而起的对空技，出招瞬间无敌。' },
        haiku:     { zh: '俳句三连',   en: 'HAIKU SLASH',   input: '214', simple: '4S', desc: '五·七·五，三段突进斩。' },
        guardrail: { zh: '宪章护栏',   en: 'GUARDRAIL',     input: '22',  simple: '2S', desc: '当身技。架住打击后礼貌地反击。' },
        super:     { zh: '巨著·万言长卷', en: 'MAGNUM OPUS', input: '236236', simple: 'H+S', desc: '展开百万上下文，以文字洪流贯穿全屏。消耗全部能量。' }
      },
      deepseek: {
        wave:      { zh: '鲸波',       en: 'WHALE WAVE',    input: '236', simple: '5S', desc: '贴地前进的水波。' },
        breach:    { zh: '鲸跃',       en: 'BREACH',        input: '623', simple: '6S', desc: '鲸尾翻身踢，对空技，出招瞬间无敌。' },
        chain:     { zh: '思维链',     en: 'CHAIN OF THOUGHT', input: '214', simple: '4S', desc: '可追加输入至三段的突进连打：思考→推理→结论！' },
        dive:      { zh: '深潜',       en: 'DEEP DIVE',     input: '22',  simple: '2S', desc: '潜入数据之海，从另一处破水而出。重版会绕到对手身后。' },
        diveKick:  { zh: '俯冲',       en: 'DIVE KICK',     input: 'j.236', simple: 'j.S', air: true, desc: '空中限定，斜向下的水流飞踢。' },
        super:     { zh: '深度思考·鲸落', en: 'DEEPTHINK: WHALE FALL', input: '236236', simple: 'H+S', desc: '召唤巨鲸 R1 破水而出。消耗全部能量。' }
      }
    },

    // Three-step callouts shown during DeepSeek's Chain of Thought, and the
    // 5-7-5 syllable flavour for Claude's Haiku Slash.
    chainSteps: ['让我想想…', '推理中…', '得出结论！'],
    haikuLines: ['五', '七', '五'],
    guardrailLine: '这个我帮不了你。',
    deepthinkLine: '已深度思考',

    stages: {
      library:  { zh: '星芒书阁',   en: 'SPARK ATHENAEUM',  home: 'claude',   desc: '黄昏时分的大图书馆，书页与星芒一同飘落。' },
      abyss:    { zh: '深蓝机房',   en: 'ABYSSAL DATACENTER', home: 'deepseek', desc: '沉在海底的玻璃机房，窗外有鲸群游过。' },
      latent:   { zh: '潜空间',     en: 'LATENT SPACE',     home: null,       desc: '向量与词元漂浮的抽象空间，一切模型的擂台。' },
      training: { zh: '评测基准场', en: 'BENCHMARK ROOM',   home: null,       desc: '安静的网格房间，适合练习连段。' }
    },

    // Arcade ladder: opponent is described relative to the player's character.
    arcade: [
      { foe: 'rival',  palette: 0, stage: 'rivalHome', levelDelta: -1, title: '第一战', sub: '公开基准测试' },
      { foe: 'mirror', palette: 1, stage: 'ownHome',   levelDelta: 0,  title: '第二战', sub: '影子模型来袭' },
      { foe: 'rival',  palette: 1, stage: 'latent',    levelDelta: +1, title: '最终战', sub: '潜空间的决战', boss: true }
    ],
    arcadeTaunt: {
      mirror: { claude: ['我是你的夜间模式。', '让我看看，谁的回答更有帮助。'], deepseek: ['我是你的深渊涂装！', '量化之后，我可是更快了哦！'] },
      boss:   { claude: ['这一次，我会思考得更久一些。', '请全力以赴。'], deepseek: ['深度思考，已开到最大！', '这次绝对不会服务器繁忙！'] }
    },

    announcer: {
      round: ['ROUND 1', 'ROUND 2', 'ROUND 3', 'FINAL ROUND'],
      fight: 'FIGHT!', ko: 'K.O.', perfect: 'PERFECT', timeup: 'TIME UP', doubleKo: 'DOUBLE K.O.', draw: 'DRAW',
      win: 'WIN'
    },

    credits: [
      '潜空间激斗 LATENT CLASH',
      '企划 / 监督：Claude (Fable)',
      '程序 / 美术 / 音乐：Claude (Opus) 开发组',
      '角色形象设计：ZipZipPipe（Claude 娘 / DeepSeek 娘）',
      'DeepSeek 娘原型：「溟月」© 上善无形（CC BY-NC-SA 4.0）',
      '字体：缝合像素字体 Fusion Pixel Font (OFL 1.1)',
      '全部像素画、音效与音乐均由代码生成',
      '感谢游玩！'
    ]
  };
})();
