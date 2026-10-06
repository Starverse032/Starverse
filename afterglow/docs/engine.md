# AFTERGLOW 渲染引擎 · 镜头开发规范

## 目录
```
timeline.json            唯一的时间线（镜头 / 字幕卡 / 遮幅 / 同步点），画面和声音共用
web/index.html           页面入口（字体、import map）
web/src/main.js          启动；暴露 window.AG 给离线渲染器
web/src/engine.js        帧 → 镜头调度、转场、遮幅、字幕卡、后期
web/src/post.js          HDR 后期：泛光 / 宽银幕光晕 / ACES / 调色 / 颗粒 / 暗角 / 色差 / 遮幅
web/src/cards.js         电影字幕卡与片尾（canvas2D 绘制，在色调映射之后叠加，因此不发光、不糊）
web/src/slate.js         镜头模块还不存在时的占位画面（可以先看动态分镜）
web/src/lib/glsl.js      GLSL 片段：hash、value/simplex 噪声、fbm、ridged、curl、worley、黑体辐射色、ACES
web/src/lib/kit.js       bake / bakeSky / skyDome / starfield / filmCamera / fullscreen / LowRes / compositor
web/src/lib/util.js      easing、keyframes、seeded rng、shake、textToPoints、textCanvas、timecode
web/src/lib/earth.js     可辨认的地球：真实海岸线（Natural Earth 公有领域坐标）+ 合成城市灯海 / 公路 / 城镇，
                         程序化生物群落、冰盖、云层、海面太阳反光、大气辉光、夜侧气辉；createEarth(ctx) 用法见文件头注释
web/src/lib/textatlas.js 字形图集 glyphAtlas / uniqueGlyphs / 短语图集 phraseAtlas（复杂文字整句塑形）/ glyphPointsMaterial
                         ——几十万个微小文字粒子，60 万个约 0.45 s/帧
web/src/data/voices.js   约 5000 年的人类文字语料（楔形文字、象形文字……《天问》、苏轼、但丁、帕斯卡、萨根、
                         数十种语言的“有人吗？”和“你好”、代码、摩尔斯电码），以及每种文字对应的字体 FONT_FOR(lang)
web/src/data/land.js / places.js   海岸线、湖泊、城市坐标与人口（只用作坐标，不用任何影像）
web/src/shots/*.js       每个镜头模块一个文件（一个模块可以服务多个镜头 id）
render/render.mjs        离线渲染：静帧 / 片段 / 多进程整片
audio/dsp.py             音频 DSP 基础库
```

## 镜头模块接口
`timeline.json` 中每个镜头的 `module` 字段对应 `web/src/shots/<module>.js`：
```js
export async function create(ctx) {
  // ctx = { THREE, renderer, W, H, S (=H/1080), fps, timeline, util, GLSL, kit, makeRT, FSQ, engine }
  // 在这里一次性构建场景、烘焙纹理（可以很慢，每个进程只执行一次）
  return {
    render(shot, f) {
      // f = { t, lt, dur, p, target, W, H, bar, barPx, frame, shot }
      //   t 是全片时间（秒）；lt 是镜头内的局部时间；p = lt/dur；target 是 HDR 渲染目标（HalfFloat，线性色彩空间）
      //   必须是 t 的纯函数：不能保留跨帧状态，不能用 Math.random、Date
      //   最后必须把画面画进 f.target：renderer.setRenderTarget(f.target); renderer.render(scene, cam)
      //   如果先画到自己的中间目标，最后一步也要回到 f.target
    },
    post(shot, f) { return { bloom: 0.8, streak: 0.3, exposure: 1.2 }; }  // 可选：逐帧覆盖后期参数
  };
}
```
- 一个模块可以服务多个镜头：在 `render` 里用 `shot.id` 分支。
- **溶解转场**：如果下一个镜头的 `transitionIn` 是 `dissolve`（时长 d），本镜头的 `render` 在 `lt ∈ [dur, dur+d]` 也会被调用，必须能继续画（`p` 会大于 1）。
- 每个镜头有输出颜色（线性 HDR）。1.0 大约是“白”，泛光阈值约 0.9，因此恒星核心、光标、超新星可以给到 5–50。
- 画面按 2.39:1 构图：`f.barPx` 之外的上下区域会被遮幅盖住（引擎还会对遮幅区域裁剪，省下渲染时间）。主体要放在可见带内。
- `shot.notes` / `shot.params` 里可以放镜头需要的参数。
- 高速运动镜头可以在返回对象里加 `motionBlur: 6`（子帧数），或在 timeline 镜头上设 `motionBlur`，可选 `shutter`（默认 0.5，即 180° 快门）。成本 ×N，只在关键镜头使用。
- 景深：粒子镜头可以在点着色器里按 |深度 − 对焦距离| 放大点尺寸、降低亮度（散景），成本很低；也可以对远景层做模糊烘焙。
- 有硬几何边缘的镜头（星球轮廓、界面线条、文字几何）可以在返回对象里加 `msaa: true`，开启 4× MSAA，成本约 +50%。
- 不要修改共享文件（engine / post / cards / lib / timeline.json）。需要共享能力时，先在自己的模块里实现，并在汇报里说明。

## 后期参数（在 `timeline.json` 镜头的 `post` 字段或模块的 `post()` 里设置）
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| exposure | 1.0 | 色调映射前的曝光倍数 |
| bloom / bloomThreshold / bloomKnee / bloomRadius | 0.9 / 0.9 / 0.6 / 1.0 | 物理泛光（6 级 mip） |
| streak / streakTint | 0 / [0.55,0.75,1] | 变形宽银幕水平光晕 |
| ca | 0.0012 | 径向色差 |
| vignette | 0.28 | 暗角 |
| grain | 0.035 | 胶片颗粒（暗部更明显） |
| saturation / contrast | 1 / 1 | 调色 |
| tint / lift | [1,1,1] / [0,0,0] | 线性染色 / 暗部提升（显示空间） |
| fade | 0 | 0 为不变，1 为全黑 |
| flash / flashColor | 0 | HDR 闪白（加在泛光之前） |

转场（镜头的 `transitionIn`）：`cut`、`match`、`smash`（都是硬切）、`dissolve`（dur）、`fade_from_black`（dur）、`flash`（dur, strength）。
淡出（镜头的 `transitionOut`）：`fade_to_black`（dur）、`flash`（dur, strength）。

## 性能（实测，1920×1080，SwiftShader，4 核 CPU）
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

**规则**：
1. 镜头自身的预算约 **1.0 s/帧**（最多 3 s）。
2. **静态的东西都在 `create()` 里烘焙**：`kit.bakeSky()`（等距柱状投影天空，4096×2048 以内）、`kit.bake()`（任意 2D 纹理，如地球大陆 / 夜灯 / 云的贴图、星云层）。逐帧只做采样、变换、少量噪声。
3. 星星用 `kit.starfield()`（点精灵，便宜而且锐利），不要逐像素搜索星点。
4. 体积感用多层烘焙纹理的视差叠加，或者 `kit.LowRes` 半分辨率光线步进（≤48 步）再用 `compositor` 加回去。
5. 粒子运动在顶点着色器里写成 t 的解析函数（例如 `p = p0 + v*t + curl(p0)*...`），不要做 CPU 端逐帧模拟。
6. 文字转粒子用 `util.textToPoints()`；中文用 `"Noto Serif CJK SC"`，等宽界面用 `"IBM Plex Mono"`，英文衬线用 `"Cormorant Garamond"`。其他文字（阿拉伯文、天城文、希伯来文、泰文、格鲁吉亚文、韩文、日文等）用系统里的 Noto 字体，例如 `"Noto Sans Arabic"`、`"Noto Sans Devanagari"`、`"Noto Sans CJK KR"`。

## 常用命令
```bash
cd afterglow
npm install                                    # three、ws
node render/render.mjs --stills 3,10.5,42 --sheet               # 静帧，输出到 build/stills/（加 --sheet 拼一张缩略图）
node render/render.mjs --stills 3,10.5 --stills-dir build/stills/S05   # 指定输出目录
node render/render.mjs --from 40 --to 52 --out build/S05.mp4 --scale 0.5   # 半分辨率预览片段
node render/render.mjs --shots S05,S06 --per 4 --stills-dir build/stills/S05 --scale 0.5   # 每个镜头均匀取 4 帧并拼缩略图
node render/render.mjs --workers 2 --out build/video.mp4        # 整片（按 240 帧分块，多进程）
```
静帧输出时会打印每帧耗时（ms），用它来检查预算。第一帧包含着色器编译，偏慢。
