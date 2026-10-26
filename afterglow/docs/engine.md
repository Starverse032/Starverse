# AFTERGLOW 渲染引擎 · 镜头开发规范（v2）

> v2（2026-10-26）：时间轴按 `docs/v2/` 定稿重排为 31 个引擎镜头；引擎新增交接转场 `handoff` 与 `postBlend`（E2）、逐帧运动模糊子帧数 `motionBlur(f)`（E3）、渲染范围 `ctx.range`（E4）、泛光遮罩 `f.mask`（V2）、带颜色的闪光转场；`anchors` 按 E7 更新。旧接口全部兼容：不用新接口的模块，输出与 v1.3 引擎逐像素相同（已用 7 个 v1.3 帧验证：运动模糊、闪光、叠化、字卡、片名）。
> 本文 §1 是 v2 的镜头 / 模块 / 组对照，§2 是镜头模块接口（含新接口与用法示例），§3 是交接帧约定，§4 以后是后期参数、性能与命令。

## 0. 目录
```
timeline.json            唯一的时间线（镜头 / 字幕卡 / 遮幅 / 静音 / 同步点），画面和声音共用；v2 结构见 §1
web/index.html           页面入口（字体、import map）
web/src/main.js          启动；暴露 window.AG 给离线渲染器；URL 参数 r0 / r1 → ctx.range（E4）
web/src/engine.js        帧 → 镜头调度、转场（含 handoff / postBlend）、运动模糊、遮幅、字幕卡、泛光遮罩、后期
web/src/post.js          HDR 后期：泛光 / 宽银幕光晕（可被遮罩）/ ACES / 调色 / 颗粒 / 暗角 / 色差 / 遮幅
web/src/cards.js         电影字幕卡与片内字幕（canvas2D，在色调映射之后叠加，因此不发光、不糊）
web/src/slate.js         镜头模块还不存在时的占位画面（显示 timeline 里的 title / visual / camera / sound）
web/src/lib/glsl.js      GLSL 片段：hash、value/simplex 噪声、fbm、ridged、curl、worley、黑体辐射色、ACES
web/src/lib/kit.js       bake / bakeSky / skyDome / starfield / filmCamera / fullscreen / LowRes / compositor
web/src/lib/util.js      easing、keyframes、seeded rng、shake、textToPoints、textCanvas、timecode
web/src/lib/earth.js     可辨认的地球：真实海岸线（Natural Earth 公有领域坐标）+ 合成城市灯海 / 公路 / 城镇，
                         程序化生物群落、冰盖、云层、海面太阳反光、大气辉光、夜侧气辉；createEarth(ctx) 用法见文件头注释
web/src/lib/textatlas.js 字形图集 glyphAtlas / uniqueGlyphs / 短语图集 phraseAtlas（复杂文字整句塑形）/ glyphPointsMaterial
web/src/shots/_webgraph.js 共享的 WEB 节点图（种子 1990）+ WEB_PATH 相机样条：getWeb / webPathPose / applyWebPose /
                         sampleWebPoints / hopDistances。v2：A1（a_origin）新增 WEB_PATH_A（E6），不改 WEB_PATH；
                         w_sea 按 WEB_PATH(9.0) 位姿布局字海（= A1 在 f1128 经过的构图）
web/src/data/voices.js   约 5000 年的人类文字语料与每种文字的字体 FONT_FOR(lang)
web/src/data/land.js / places.js   海岸线、湖泊、城市坐标与人口（只用作坐标，不用任何影像）
web/src/shots/*.js       每个镜头模块一个文件（一个模块可以服务多个镜头 id）
render/render.mjs        离线渲染：静帧 / 片段 / 多进程整片；把渲染范围传给页面（E4）
tools/validate_timeline.py  timeline.json 校验：整数帧、无缝覆盖、字卡 / 字幕与 docs/v2/timeline-v2.md 一致等（§6）
audio/                   声音（numpy 合成），读 timeline.json 的 silences / letterbox / music / sfx / sync / mix
```

## 1. v2 镜头 · 模块 · 组对照

`timeline.json` 的 31 个镜头（`shots[].frames` 是左闭右开的整数帧区间，是边界的唯一依据；`start / end` = 帧 ÷ 24，精确相等）。“剧本节拍”指 `docs/v2/screenplay-v2.md` §3 的节拍号；每个镜头的 `notes` 里写了节拍、帧区间、入 / 出转场和沿用关系，`was` 列出对应的 v1.3 镜头，`beats` 列出它覆盖的节拍。

| 组（建议） | 模块 | 镜头 id | 帧区间 | 时间（s） | 剧本节拍 | 入转场 | 状态 |
|---|---|---|---|---|---|---|---|
| 1 界面 | `p_terminal` | S01 / S02 / S03 / S04 / S05 / S06 | [0,48) [48,264) [264,456) [456,540) [540,576) [576,600) | 0–25 | S01-a … S01-h | cut | 沿用，改命令行 / 回显 / 名牌 |
| 1 界面 | `p_terminal` | S44 | [5640, 6000) | 235–250 | S11-d / e / f | cut | 沿用，改历史与署名 |
| 2 宇宙 | `a_origin` 🆕 | A1 | [600, 1212) | 25–50.5 | S02-a / b / c，S02-d 前段 | match（f600，像素连续） | 新模块（参考 c_afterglow / c_firststar / c_web；E6 WEB_PATH_A） |
| 3 恒星与地球 | `a_star` 🆕 | A2 | [1212, 1692) | 50.5–70.5 | S02-d 后段、S02-e、S02-f 前段 | **handoff**（置换①日冕光中点） | 新模块（参考 c_supernova / e_earth） |
| 4 落地与火 | `a_descent` 🆕 | A3 | [1692, 1758) | 70.5–73.25 | S02-f 中段 | **handoff**（置换③云层中点） | 新模块（参考 m_asking/dive.js） |
| 4 落地与火 | `f_fire` | A4 | [1758, 1872) | 73.25–78 | S02-f 末段、S02-g | **handoff**（置换⑤草叶之中） | 沿用 macro，改时间 / 三击 |
| 4 落地与火 | `f_fire` | F1 / F2 / F3 | [1872,1968) [1968,2112) [2112,2280) | 78–95 | S03-a / b / c | cut | 沿用 night；F3 篝火改到 C |
| 5 载体 | `l_carriers` 🆕 | L1 | [2280, 2784) | 95–116 | S04-a … S04-f | match（光心 C） | 新模块 |
| 6 天线 | `m_asking` | M1–M7 | [2784,2820) [2820,2850) [2850,2874) [2874,2892) [2892,2906) [2906,2916) [2916,2928) | 116–122 | S05-a … S05-g | cut；M7 transitionOut 琥珀闪光 | 沿用 antenna / dive，6 刀新内容 |
| 7 光束与旅行者号 | `b_flight` 🆕 | B1 | [2928, 3336) | 122–139 | S06 全段、S07-a 前段 | flash（琥珀，6 帧衰减） | 新模块（参考 m_beam / w_stream / v_voyager） |
| 7 光束与旅行者号 | `b_flight` 🆕 | B2 | [3336, 3864) | 139–161 | S07-a 后段、S07-b / c / d | **handoff**（同一模块内部） | 新模块（参考 v_voyager / v_pbd） |
| 8 字海与高潮 | `w_sea` | S34 | [3864, 4320) | 161–180 | S08-a / b / c | **handoff**（蓝点 → 节点，同一像素） | 沿用，v1.3 S34 + S35 合并 |
| 8 字海与高潮 | `w_sea` | S36 | [4320, 4416) | 180–184 | S08-d | dissolve 0.5 s（12 帧） | 沿用；SB1 改 48 px / 基线 846 |
| 8 字海与高潮 | `q_apex` | S37 | [4416, 4584) | 184–191 | S08-e | dissolve 0.5 s（12 帧） | 沿用，改三行版面 |
| 8 字海与高潮 | `q_apex` | S38 | [4584, 5184) | 191–216 | S09-a … S09-h | cut（同一模块连续） | 沿用，改版面（P_ans / 移位） |
| 9 窗与结尾 | `u_window` | S39 | [5184, 5256) | 216–219 | S10-a | match（光标 → 窗） | 沿用，改台灯位置与推近 |
| 9 窗与结尾 | `e_final` | S40 | [5256, 5472) | 219–228 | S10-b（f5460 模块自己画黑） | cut | 沿用，时间提前 |
| 9 窗与结尾 | `t_title` | S42 | [5472, 5640) | 228–235 | S11-a / b / c | cut | 沿用，改色阶与字号 |
| 声音组 | `audio/*` | — | [0, 6000) | 0–250 | 剧本 §6 | — | 拥有 timeline 的 `music / motifs / sfx / sync / mix` |

- 🆕 = 模块文件还不存在，引擎画 slate（`slate.js`），这是第 0 阶段的正常状态。
- **跨组的交接**：f600（组 1 → 2，match）、f1212（2 → 3）、f1692（3 → 4）、f3864（7 → 8）、f5184（8 → 9，match）。组内交接：f1758（A3 → A4）、f3336（B1 → B2）。交接两侧的组按 §3 共同验收。
- **沿用模块按 `shot.id` 分支的地方需要改**：`f_fire.js`（`'S15'` → A4）、`m_asking.js`（`'S23'`）、`w_sea.js`（`'S34' / 'S35' / 'S36'`）、`q_apex.js`（`'S37'`）、`p_terminal.js`（`'S44'`）。新 id 在这些模块里目前走默认分支；很多旧模块还把 v1.3 的秒数写死在代码里（如 `m_asking/dive.js` 的 `T0 = 112.5`），在新时间位置上会画出不对的内容。
- 共享常量都在 `timeline.json`：`anchors.R / C / P_ans / footprint / blueDot / window / hud / cursor / heartbeat`，`palette`（v2 新增 `RED_LAMP`、`BLUE_DOT`、`NODE`、`QA / QB / QC`、`ECHO` 等），镜头的 `params`。`segments` 与 `beats` 是 timeline-v2 的段落与节拍表（只读参考）。

## 2. 镜头模块接口
`timeline.json` 中每个镜头的 `module` 字段对应 `web/src/shots/<module>.js`：
```js
export async function create(ctx) {
  // ctx = { THREE, renderer, W, H, S (=H/1080), fps, timeline, util, GLSL, kit, makeRT, FSQ, engine,
  //         range, rangeFrames, inRange(a, b, pad), shotInRange(shot, pad) }            ← v2：E4，见 §2.4
  // 在这里一次性构建场景、烘焙纹理（可以很慢，每个进程只执行一次）
  return {
    render(shot, f) {
      // f = { t, lt, dur, p, target, W, H, bar, barPx, frame, shot,
      //       transition: { in, out }, handoffIn, handoffOut,      ← v2：E2，见 §2.1
      //       sub, subs,                                           ← v2：当前子帧序号 / 子帧数（运动模糊），见 §2.3
      //       mask }                                               ← v2：泛光遮罩 RT 或 null，见 §2.5
      //   t 是全片时间（秒）；lt 是镜头内的局部时间；p = lt/dur；target 是 HDR 渲染目标（HalfFloat，线性色彩空间）
      //   必须是 t 的纯函数：不能保留跨帧状态，不能用 Math.random、Date
      //   最后必须把画面画进 f.target：renderer.setRenderTarget(f.target); renderer.render(scene, cam)
      //   如果先画到自己的中间目标，最后一步也要回到 f.target
    },
    post(shot, f) { return { bloom: 0.8, streak: 0.3, exposure: 1.2 }; },  // 可选：逐帧覆盖后期参数（必须是 f 的纯函数，见 §2.1）
    motionBlur: 6,            // 可选：常量子帧数；或 v2 的函数 motionBlur(f)（§2.3）
    msaa: true,               // 可选：4× MSAA
    bloomMask: true,          // 可选：v2 泛光遮罩；或函数 bloomMask(f)（§2.5）
  };
}
```
- 一个模块可以服务多个镜头：在 `render` 里用 `shot.id` 分支（v2 的 id 见 §1）。
- **溶解转场**：如果下一个镜头的 `transitionIn` 是 `dissolve`（时长 d），本镜头的 `render` 在 `lt ∈ [dur, dur+d]` 也会被调用，必须能继续画（`p` 会大于 1）。
- 每个镜头有输出颜色（线性 HDR）。1.0 大约是“白”，泛光阈值约 0.9。读字目标的笔画 ≤ HDR 0.4（剧本 §0 读字规则），发光感另画一层更暗更宽的光晕，或用泛光遮罩。
- 画面按 2.39:1 构图：`f.barPx` 之外的上下区域会被遮幅盖住（引擎还会对遮幅区域裁剪，省下渲染时间）。主体要放在可见带内（y 138–942）。
- `shot.notes` / `shot.params` 里放镜头需要的参数；三个固定点用 `ctx.timeline.anchors.R / C / P_ans`。
- 高速运动镜头可以在返回对象里加 `motionBlur`（子帧数或函数），或在 timeline 镜头上设 `motionBlur`，可选 `shutter`（默认 0.5，即 180° 快门）。成本 ×N，只在关键帧段使用；解析拖尾更便宜（先例：c_web 胶囊点、q_apex 螺旋积分、dive 缩放积分、p_terminal 实例化拖尾）。
- 景深：粒子镜头可以在点着色器里按 |深度 − 对焦距离| 放大点尺寸、降低亮度（散景）；也可以对远景层做模糊烘焙。
- 有硬几何边缘的镜头可以在返回对象里加 `msaa: true`，开启 4× MSAA，成本约 +50%。
- 不要修改共享文件（engine / post / cards / lib / timeline.json 的共享字段）。需要共享能力时，先在自己的模块里实现，并在汇报里说明。镜头自己的 `params / notes / post` 由本组维护。

### 2.1 交接转场 `handoff` 与 `postBlend`（E2）

`transitionIn: { "type": "handoff" }` 在引擎里**等于硬切**：上一帧由上一个镜头的模块画，这一帧起由本镜头的模块画，不叠化、不混合。区别只在语义上——它告诉两侧模块“这里不是剪辑点，是同一个长镜头换手”，两侧必须按 §3 的约定做到像素连续。

模块可以在 `f` 里知道自己处在哪里（所有转场类型都有 `f.transition`，`handoff` 另有快捷字段）：
```js
f.transition.in   // { type, from, fromModule, frame, postBlend, k }   k = f.frame − 交接帧（交接帧上 k = 0）；第一个镜头为 null
f.transition.out  // { type, to,   toModule,   frame, postBlend, k }   k = 交接帧 − f.frame（本镜头最后一帧 k = 1；叠化尾巴里 k ≤ 0）
f.handoffIn       // = f.transition.in，仅当入转场是 handoff；否则 null
f.handoffOut      // = f.transition.out，仅当下一个镜头以 handoff 接入；否则 null
```
用法示例（B1 → B2 交接，B2 在接手后的头 24 帧继续画 B1 留下的残留问句层）：
```js
render(shot, f) {
  if (shot.id === 'B2' && f.handoffIn && f.handoffIn.k < 24) drawResidualPhrases(f);   // 与 B1 末帧同一函数、同一参数
  if (shot.id === 'B1' && f.handoffOut) prepareForHandoff(f.handoffOut.k);              // 例如最后几帧把要交出去的层定格
  ...
}
```

**`postBlend: n`**（可用于任何硬切：`cut / match / smash / handoff`）：本镜头的头 n 帧，引擎把后期参数从“上一个镜头在它最后一帧（交接帧 − 1）的后期参数”插值到本镜头自己的后期参数，权重 `easeInOutSine(k / n)`。交接帧本身（k = 0）用的正是上一帧的后期参数，所以后期没有跳变；第 n 帧起完全是本镜头的参数。所有数值参数和数值数组（`tint / lift / flashColor / streakTint`）都参与插值。
```json
{ "id": "A2", "module": "a_star", "transitionIn": { "type": "handoff", "postBlend": 12 } }
```
- 上一个镜头的后期参数由引擎调用它的 `post(prevShot, f)`（`f.t` = 交接帧 − 1 的时间）求得，所以 **`post()` 必须是 f 的纯函数**，不能依赖 `render()` 里算出的状态，也不能假设 `create()` 建好了全部场景（E4 下上一个模块可能什么都没建）。
- 用 `postBlend` 时两侧不必在交接帧上后期完全相同；不用时必须相同（§3）。

### 2.2 带颜色的闪光转场

`flash` 转场（`transitionIn` 与 `transitionOut`）可以带 `color`：线性 RGB 数组、`'#RRGGBB'`（按 sRGB 解码为线性）或 `palette` 里的名字（十六进制或线性数组）。闪光期间它覆盖 `flashColor`。
```json
{ "id": "M7", "transitionOut": { "type": "flash", "dur": 0.167, "strength": 1.4, "color": [1.0, 0.4, 0.11] } },
{ "id": "B1", "transitionIn":  { "type": "flash", "dur": 0.25,  "strength": 0.9, "color": [1.0, 0.4, 0.11] } }
```
`[1.0, 0.4, 0.11]` 是 v1.3 S26 / S27 验收过的线性琥珀（≈ sRGB 解码的 `AMBER` #FFB36B；也存为 `palette.AMBER_FLASH_LINEAR`）。写 `"color": "AMBER"` 会解码为 (1.0, 0.45, 0.15)，略偏黄。实测 v2 时间轴 f2928 的有效画面均值 (205, 148, 83)，与 v1.3 验收值 (199, 141, 74) 一致。

### 2.3 逐帧运动模糊 `motionBlur(f)`（E3）

模块可以导出函数 `motionBlur(f)`，按帧返回子帧数；返回 0 或 1 表示这一帧不做子帧。也可以返回 `{ n, shutter }` 同时改快门（占一帧的比例，默认 0.5 = 180°）。常量写法 `motionBlur: 6` 仍然可用。timeline 镜头上的 `motionBlur`（数字）优先于模块的设置。
```js
// B2：只在 170° 转向的峰值段（f3420–3492）用 6 个子帧，其余帧靠解析拖尾
motionBlur(f) { return f.shot.id === 'B2' && f.frame >= 3420 && f.frame < 3492 ? 6 : 0; },
// S38：光标移位 f4992–5039 用 4 个子帧、270° 快门
motionBlur(f) { return f.frame >= 4992 && f.frame < 5040 ? { n: 4, shutter: 0.75 } : 0; },
```
- `motionBlur(f)` 收到的是这一帧中心时刻的 `f`（`f.target` 为 null），必须是 f 的纯函数。
- 子帧渲染时 `f.sub` = 0…n−1，`f.subs` = n（不模糊时 0 / 1），可用来只在第一个子帧做一次性的工作（例如写泛光遮罩），或像 q_apex / p_terminal 那样把子帧记忆化后自己做解析模糊。
- 成本 ×n。交接帧两侧如果用子帧，n 与快门要一致（§3）。

### 2.4 渲染范围 `ctx.range`（E4）

每个渲染进程只渲染一段帧。`render.mjs` 把这段范围通过 URL（`r0 / r1`）交给页面，引擎在任何 `create()` 之前放进 ctx：
```js
ctx.rangeFrames            // [f0, f1)：本进程要渲染的帧，左闭右开；默认整片 [0, 6000)
ctx.range                  // [f0/24, f1/24]：同一范围，单位秒
ctx.inRange(a, b, pad=1)   // 区间 [a, b)（秒；只给 a 时是一个时刻）是否落在范围 ± pad 秒内
ctx.shotInRange(shot, pad=1)
```
范围的来源：`--frames a:b` 与 `--workers` 分块（每块 240 帧）就是那一块；`--from / --to` 换算成帧；`--stills t1,t2,…` 是 `[最早的静帧, 最晚的静帧 + 1)`；`--shots` 同 `--stills`；`--range a:b` 可以手动覆盖。实时预览（`play=1`）和不带参数时为整片。

用法示例（长镜头 A 的包装模块只建本块需要的子场景）：
```js
export async function create(ctx) {
  const sh = id => ctx.timeline.shots.find(s => s.id === id);
  const need = ctx.shotInRange(sh('A2'), 0.5);          // pad 覆盖子帧与 postBlend 回看
  const star = need && ctx.inRange(50.5, 58.0) ? await buildStar(ctx) : null;
  const earth = need && ctx.inRange(58.0, 70.5) ? await buildEarth(ctx) : null;
  return {
    render(shot, f) { if (f.t < 58.0) star.render(shot, f); else earth.render(shot, f); },
    post(shot, f) { return analyticPost(f.t); },          // 不依赖 star / earth 是否建好
  };
}
```
- `AG.prepare()` 会为渲染时刻 ±3 s 内出现的所有模块执行 `create()`，所以一个模块可能被创建却一帧都不画（例如块从 f1212 开始时 `a_origin` 也会被创建）。这时它应该什么都不建，`post()` 仍要能用。
- `pad` 至少覆盖：叠化尾巴（本片最长 0.5 s）、子帧（半个快门）、`postBlend` 回看（上一帧）。默认 1 s 足够。
- 静帧时间点相隔很远时，范围会覆盖其间的一切，包装模块会把子场景都建出来（结果仍然正确，只是慢）。大模块调试时按镜头分别出静帧。

### 2.5 泛光遮罩（V2）

模块声明 `bloomMask: true`（或函数 `bloomMask(f)`，也可在 timeline 镜头上写 `"bloomMask": true`）后，`f.mask` 是一张与画面同尺寸的 RGBA8 渲染目标，每个输出帧清成 0。模块把遮罩画进去，三个通道各管一件事：

| 通道 | 含义 | 在哪里生效 |
|---|---|---|
| R | 这个像素**不产生**泛光和横向光晕（不进泛光的源） | 泛光预滤（bloom 与 streak 共用的金字塔）之前 |
| G | 这个像素**不接收**泛光 | 合成时，`bloom × (1 − G)` |
| B | 这个像素**不接收**横向光晕 | 合成时，`streak × (1 − B)` |

不声明遮罩的模块走原来的着色器分支，画面逐像素不变。

用法示例（S38：光标 HDR 2.0 照常发光、拖 ±160 px 横向光晕，但同一行已有字的笔画区间内光晕为 0；读字笔画自己不进泛光）：
```js
const maskScene = new THREE.Scene();      // 与正片同相机的字形网格，材质输出 vec4(r, g, b, 1)
return {
  bloomMask: true,
  render(shot, f) {
    renderer.setRenderTarget(f.target); renderer.render(scene, cam);           // 正片
    if (f.mask && f.sub === 0) {                                               // 子帧时只写一次
      strokeMat.uniforms.rgb.value.set(1, 0, 0);    // R：笔画不进泛光
      boxMat.uniforms.rgb.value.set(0, 0, 1);       // B：同一行字的包围盒（随打字 / 删字更新）不接收横向光晕
      const ac = renderer.autoClear; renderer.autoClear = false;               // 引擎已清过遮罩
      renderer.setRenderTarget(f.mask); renderer.render(maskScene, cam);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);                                      // 画完回到 f.target
    }
  },
};
```
- 写遮罩时关掉 `autoClear`（或只在第一个写入时清），多个绘制合成用 `THREE.MaxEquation` 混合最稳。
- 子帧与叠化：遮罩每个输出帧只清一次，所有子帧、叠化两侧的镜头画进同一张遮罩，作用于混合后的画面。
- 实测（`build/v2-engine/`）：R 遮住的 HDR 20 光块周围泛光为 0（未遮的同样光块周围 224/255），G+B 遮住的区域横向光晕为 0。

### 2.6 timeline 的帧字段

镜头、字卡、字幕、署名、静音都有 `frames: [a, b)`。引擎载入时用它重算 `start = a / 24`、`end = b / 24`（与引擎算帧时间的 `frame / fps` 是同一个双精度数，边界不会漂移）。改时间时**改 `frames`**，并同步 `start / end`、`tc`，然后跑 `tools/validate_timeline.py`。

## 3. 交接帧约定（长镜头的引擎换手）

长镜头 A、B 和蓝点 → 字海在银幕上不切，但引擎在这些帧换模块（或同一模块换 timeline 镜头）。设交接帧为 F：F − 1 由出镜头 X 画，F 起由入镜头 Y 画。v2 的交接帧：

| F | X → Y | 交接帧上两侧共同画的东西 | 转场 |
|---|---|---|---|
| f600 | S06 `p_terminal` → A1 `a_origin` | R 处 HDR 1.5 的白点；遮幅、颗粒、暗角、色差 | match |
| f1212 | A1 `a_origin` → A2 `a_star` | 置换①的日冕光（半径约 300 px 的屏幕空间径向光，同一函数）+ 压暗的 `_webgraph` 网 | handoff |
| f1692 | A2 `a_star` → A3 `a_descent` | 置换③的云层（3–4 层，同一组参数与视差） | handoff |
| f1758 | A3 `a_descent` → A4 `f_fire` | 置换⑤的前景草叶（同一片、同一位置）；草叶后面换成 macro 机位 | handoff |
| f3336 | B1 → B2（`b_flight` 内部） | 整个探测器 + 残留字尘；同一相机函数 | handoff |
| f3864 | B2 `b_flight` → S34 `w_sea` | R 处蓝点（同 PSF、同亮度、同尺寸）+ 背景星（= 字海第一批字的屏幕坐标，同一张 `_webgraph` 在 `WEB_PATH(9.0)` 下投影） | handoff |

f5184（S38 → S39，光标 → 窗）是剧本里的匹配剪辑，不按本约定验收，只要求同位同尺寸。

**约定**
1. **同一个世界函数**：交接帧上两侧共同出现的东西，由同一个函数、同一组参数画出（相机位姿、太阳方向、种子、PSF、调色板）。共享的常量放在 `timeline.json`（镜头 `params`、`anchors`、`palette`），共享的代码放在两组共同维护的 `web/src/shots/_*.js`（例如 `_webgraph.js`），不要各写一份“看起来一样”的。
2. **像素连续**：Y(F) 应当是 X 若继续画到 F 时的画面。验收：临时把 X 的镜头延长 1 帧，渲染 X(F)，与正式时间轴的 Y(F) 比较——有效画面内平均绝对差 ≤ 2/255（8 位显示值），结构位移 ≤ 1 px；并且 X(F−1) → Y(F) 的运动与 X(F−1) → X(F) 一致（速度不跳）。所以 **X 必须能画出 F 及之后一两帧**（像叠化尾巴一样）。
3. **后期一致**：Y 在 F 的后期参数（`DEFAULT_POST ← timeline.post ← shot.post ← post()`）与 X 在 F 的相同（数值差 ≤ 1e-3），或者 Y 的 `transitionIn` 写 `postBlend: n`（§2.1），让引擎从 X 在 F − 1 的参数平滑过来。遮幅、颗粒的随机种子由引擎按 t 给出，两侧天然一致。
4. **运动模糊一致**：如果交接前后用子帧，两侧在交接附近的 `n` 与快门相同；用解析拖尾的，两侧拖尾长度的公式相同（剧本：拖尾长度 = 半帧位移）。
5. **泛光遮罩一致**：交接帧上两侧对同一物体写同样的遮罩（或都不写）。
6. **纯函数、可独立渲染**：分块渲染时，一个块可能正好从 F 开始，此时 X 的模块被创建但不画（§2.4）。两侧都不能依赖对方的运行状态；Y 不能读 X 的渲染结果。
7. **用 `f.handoffIn / f.handoffOut` 判断位置**，不要把交接帧号写死在代码里；帧号写在镜头 `params`（`handoffInFrame / handoffOutFrame`）里只作说明。
8. **两组共同验收**：跨组的交接（f600、f1212、f1692、f3864）由两侧的组一起出一组静帧：X(F−1)、X(F)、Y(F)、Y(F+1)，附平均绝对差与后期参数对照。

## 4. 后期参数（在 `timeline.json` 镜头的 `post` 字段或模块的 `post()` 里设置）
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| exposure | 1.0 | 色调映射前的曝光倍数 |
| bloom / bloomThreshold / bloomKnee / bloomRadius | 0.9 / 0.9 / 0.6 / 1.0 | 物理泛光（6 级 mip）；可被泛光遮罩（§2.5） |
| streak / streakTint | 0 / [0.55,0.75,1] | 变形宽银幕水平光晕；可被泛光遮罩 |
| ca | 0.0012 | 径向色差（uv 单位：画面角上的偏移约为 ca × 1920 px；剧本里的“色差 0.6 px”≈ ca 0.0003） |
| vignette | 0.28 | 暗角 |
| grain | 0.035 | 胶片颗粒（暗部更明显） |
| saturation / contrast | 1 / 1 | 调色 |
| tint / lift | [1,1,1] / [0,0,0] | 线性染色 / 暗部提升（显示空间） |
| fade | 0 | 0 为不变，1 为全黑 |
| flash / flashColor | 0 / [1,0.96,0.9] | HDR 闪光（加在泛光之前）；闪光转场的 `color` 会覆盖 flashColor（§2.2） |

`timeline.post` 是电影段默认（bloomThreshold 1.0、bloom 0.75、streak 0.25、vignette 0.2、ca 0.0006、grain 0.035）。

转场（镜头的 `transitionIn`）：`cut`、`match`、`smash`、`handoff`（都是硬切；可带 `postBlend: n`）、`dissolve`（dur）、`fade_from_black`（dur）、`flash`（dur, strength, color）。
淡出（镜头的 `transitionOut`）：`fade_to_black`（dur）、`flash`（dur, strength, color）。

## 5. 性能（实测，1920×1080，SwiftShader，4 核 CPU）
| 每像素操作（整屏一遍） | 耗时 |
| --- | --- |
| 空着色器 | 45 ms |
| 一次 value / simplex 噪声 | ~30 ms |
| fbm 6 倍频 | ~200 ms |
| 一次纹理采样 | ~14 ms |
| worley 27 格 | ~310 ms |
| 32 步光线步进（每步一次纹理采样） | ~350 ms |
| 后期固定开销（泛光+光晕+合成） | ~400 ms |
| 30 万加法点粒子 | ~150 ms |

泛光遮罩的额外开销：清一张 RGBA8 + 预滤与合成各多一次采样（只在声明遮罩的帧）。

**规则**：
1. 镜头自身的预算约 **1.0 s/帧**（最多 3 s）。画面修改表估算全片 11 330–15 720 worker·秒；火、夜景、地球几段已达 4.0–4.65 s/帧，新内容不能再叠加在这些模块上（审计 §3.5）。
2. **静态的东西都在 `create()` 里烘焙**：`kit.bakeSky()`、`kit.bake()`。逐帧只做采样、变换、少量噪声。大模块按 `ctx.range` 只烘焙本块需要的部分（§2.4）。
3. 星星用 `kit.starfield()`（点精灵，便宜而且锐利），不要逐像素搜索星点。
4. 体积感用多层烘焙纹理的视差叠加，或者 `kit.LowRes` 半分辨率光线步进（≤48 步）再用 `compositor` 加回去。
5. 粒子运动在顶点着色器里写成 t 的解析函数，不要做 CPU 端逐帧模拟。
6. 文字转粒子用 `util.textToPoints()`；中文用 `"Noto Serif CJK SC"`，等宽界面用 `"IBM Plex Mono"`，英文衬线用 `"Cormorant Garamond"`。其他文字用系统里的 Noto 字体。

## 6. 常用命令
```bash
cd afterglow
npm install                                    # three、ws
python3 tools/validate_timeline.py             # 改 timeline.json 后必跑（退出码 0 = 通过）
node render/render.mjs --stills 3,10.5,42 --sheet               # 静帧，输出到 build/stills/（加 --sheet 拼一张缩略图）
node render/render.mjs --stills 3,10.5 --stills-dir build/stills/A1   # 指定输出目录
node render/render.mjs --from 40 --to 52 --out build/A1.mp4 --scale 0.5   # 半分辨率预览片段（ctx.range = 这一段）
node render/render.mjs --shots A2,A3 --per 4 --stills-dir build/stills/A2 --scale 0.5   # 每个镜头均匀取 4 帧并拼缩略图
node render/render.mjs --stills 50.5 --range 1200:1300 ...      # 手动指定 ctx.range（帧）
node render/render.mjs --timeline build/my-test.json --stills 1   # 用另一份时间轴（测试用；模块名可写相对路径，如 ../../../build/x/t_mod）
node render/render.mjs --workers 2 --out build/video.mp4        # 整片（按 240 帧分块，多进程）——第 0 阶段不要跑
```
静帧输出时会打印每帧耗时（ms），用它来检查预算。第一帧包含着色器编译，偏慢。渲染信号量默认最多 2 个 Chromium 同时渲染（`build/locks`），排队时请等待，不要结束别人的进程。

引擎第 0 阶段的验证材料在 `build/v2-engine/`：`t_engine.js` + `test-timeline.json`（handoff / postBlend / motionBlur(f) / ctx.range / 泛光遮罩 / 闪光颜色），静帧在 `build/v2-engine/stills/`。
