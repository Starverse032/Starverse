# v2 交接记录（共享文件、接口、交接帧参数）

每组写完共享文件后在这里记一笔：文件、接口、交接帧参数。另一组只 import，不修改；需要改时在报告里提出。

---

## f1212 · A1 `a_origin` → A2 `a_star` · 置换①“节点日冕光”（A1 组）

**状态**：`web/src/shots/_corona.js` 接口已定（2026-10-26）。A1 渲染到 f1211，A2 从 f1212 起渲染。`timeline.json` 里 A2 的 `transitionIn` 是不带 `postBlend` 的 `handoff`，所以 f1212 两侧的后期参数必须一致：**两侧都用 `coronaPost()`**。

### 文件
- `web/src/shots/_corona.js`：日冕光（A1 组写，A2 只 import）。
- `web/src/shots/_webgraph.js` 新增 `WEB_PATH_A` / `webPathAPose(fr)` / `applyWebPathA(cam, fr)`（E6）。原 `WEB_PATH` 没改。
- `web/src/shots/a_origin/web.js`：日冕光后面那张压暗的网（`createWebLayer`，见下文第 4 条）。A2 可以 import；这个文件归 A1 组维护。

### 接口（都是帧号 `fr = f.t * 24` 的纯函数，可以带小数）
```js
import { createCorona, coronaState, coronaPost, coronaWebDim, coronaProfile, CORONA } from './_corona.js';

// create(ctx):
const corona = createCorona(ctx);                    // 一个全屏材质，无贴图、无烘焙
// render(shot, f)：先把自己的场景画进 f.target，最后再叠日冕光（它会遮住后面的东西）
corona.render(ctx.renderer, f.target, f.t * 24);     // CORONA.span 之外不画，返回 false
// post(shot, f)：
if (coronaPost.active(f.t * 24)) return coronaPost(f.t * 24);   // [1176, 1248) 内返回一整套显式参数
```
- `coronaState(fr)` → `{ A, R300, sigma, rot }`：亮度包络、半径（宽瓣降到中心 18%（约为总亮度 10%）处的半径，单位是 1080p 像素）、核心 σ、冕流转角。
- `coronaProfile(r, theta, fr)` → `[r, g, b, occ]`：着色器的 CPU 镜像，用于量测。
- `coronaWebDim(fr)`：网（日冕光后面所有东西）的整体乘子。f1198 前是 0.70（“选定”时其余网压暗 −30%），到 f1212 降到 0.32，之后保持。
- `CORONA`：常量 `R`、`span`、`postSpan`、`radius`、颜色等。

### 画法（屏幕空间，1080p 像素，y 向下，中心 R = (734.5, 540.5)，与 `_webgraph` 的像素中心约定一致）
- 宽瓣 `(1 + 3.17 x²)^-1.2`（x = r / R300），HDR 增益 0.46乘冕流调制 `1 + 0.22·s(θ)`：6 个整数谐波，种子相位固定，转得很慢，只作用在瓣的外部。核心是高斯，σ ≈ 46 px，HDR 增益 0.34。
- 颜色：核心 `#E6EEFF`，宽瓣 `#BFD4FF`，尾部渐变到 `#6FA8FF`（冷白，≥ 7000 K）。
- 遮挡：premultiplied “over”，`dst = dst·(1 − occ) + corona`，`occ(R) = 0.72·A`。
- 包络：f1194 起亮（smootherstep），**f1210.5–1213 平台，峰值正好在 f1212（斜率为 0）**。f1213 起退开：亮度在 f1224 降到 0.18，瓣同时向 120 px 圆盘收缩（R300：f1212 为 300 → f1226 约 135）。f1236 归零。R300 在峰值前随推进每帧增长约 1.2%。
- 交接帧参数（f1212）：A = 1.000，R300 = 300.0 px，σ = 46.0 px，rot = 0，`coronaWebDim` = 0.32；后期取 `coronaPost(1212)`（exposure 1、bloom 0.75、bloomThreshold 1.0、knee 0.6、streak 0.12、vignette 0.2、ca 0.0006、grain 0.035、saturation 1、contrast 1）。目标是 R 附近显示值约 180（HDR 亮度约 0.6，低于泛光 knee），全画面最大值 ≤ 230。
- 实测（A1 侧，f1211，半分辨率，1080p 半径）：R 处 L = 178；r = 40 / 100 / 200 / 300 / 400 / 600 px 处 L = 154 / 103 / 55 / 24 / 9 / 3；全画面最大 L = 204。

### A2 需要知道的
1. **相机**：`webPathAPose(fr)` 是一条朝 hero.first 的直线，朝向固定（= `WEB_PATH(9.0)` 的朝向），hero.first 恒在 R。到 hero.first 的距离：d(1200) = 4.94，d(1212) = 2.81，d(1224) = 2.01（世界单位）。f1224 圆盘直径 120 px 对应恒星半径约 0.094 u（24 mm，fpx = 1280）。`WEB_PATH_A.rate(fr)` 在 f1224 以后给了一条默认的 2.2% → 1.0%/帧（只是默认值，A2 可以自己接管，只要 f1212 连续）。
2. **hero.first 的点光源**：A1 在 f1197–1207 已把它淡进日冕光（`coronaHeroFade`）。网里的其余恒星在 f1192–1206 压到 12%（`webState(fr).starDim`），沉进眩光里。f1212 时画面里没有单独的点光源，A2 不要再画它。圆盘从 f1213 起自己显现。
3. **运动模糊**：交接附近两侧都不用子帧（A1 的 `motionBlur(f)` 在 f1200 以后返回 0）。网的点用解析胶囊拖尾，长度 = 半帧位移，由 `a_origin/web.js` 画，两侧同一套公式。
4. **网**：f1212 时网乘以 0.32 后仍然看得见（画框边缘最明显）。要做到像素一致，最简单的办法是每帧调用 A1 的网层：
   ```js
   import { createWebLayer } from './a_origin/web.js';
   const web = createWebLayer(ctx);                  // 64 万点 + 星 + 半分辨率气体
   web.render(renderer, f.target, f.t * 24);         // 自己清屏，相机按 WEB_PATH_A，亮度已乘 coronaWebDim
   corona.render(renderer, f.target, f.t * 24);
   ```
   如果 A2 想按画面修改表把远景烘成天空球，请至少在 [1212, 1224) 用这个网层，等日冕光退开以后再换。

---

## f1692 · A2 `a_star` → A3 `a_descent` · 置换③“云层”（A3 组）

**状态**：`web/src/shots/_clouds.js` 接口已定（2026-10-27），A2 可以直接 import。A2 渲染到 f1691，A3 从 f1692 起渲染。A3 的 `transitionIn` 是不带 `postBlend` 的 `handoff`，所以 **两侧在 [1680, 1704) 都返回 `cloudsPost(f.frame)`**（A3 全段沿用这一组后期）。

### 文件
- `web/src/shots/_clouds.js`（A3 组写，A2 只 import）：长镜头 A 下降段的相机轨道（f1680 → f1776，A3、A4 共用）、暮色天空 GLSL、四层云、以 R 为中心的解析径向缩放模糊。

### 接口（都是帧号 `n = f.t * 24` 的纯函数，可以带小数）
```js
import { createClouds, cloudsPost, camAt, applyCamera, rateAt, viewWidthAt, focalAt,
         zoomBlurScale, createZoomBlur, SKY_GLSL, CLOUD_LAYERS, GLIDE_DEG, DUSK } from './_clouds.js';
const clouds = createClouds(ctx);            // create()：烘焙一张 1024² 云图（约 0.2 s），不建别的
clouds.render(f);                            // render()：一整帧——暮色天空 + 远处地面 + 四层云 + 径向模糊，写进 f.target
clouds.render(f, { base: tex });             // 可选：用自己的底图（tex）代替内置的天空 + 地面（A3 在云下用它垫地形）
post(shot, f) { return cloudsPost(f.frame); }
```
- **A2 在 [1680, 1692) 只需要每帧调用 `clouds.render(f)`**，不用自己画天空或云。
- 渲染成本（半分辨率实测）：约 0.5–0.8 s/帧（1080p 约 1.2 s 以内），云是半分辨率光线步进（4 层 × 8 步）。

### 世界与相机（A2 的 [1632, 1680) 请在 f1680 落到这里）
- 坐标：米；原点 = 落点 R_geo（裂谷谷底一处小隆起的地面点）；x 东、y 上、**z 南**；相机朝北（看 −z），所以西（暮光）在画面左边。
- 相机始终在穿过目标的一条 **4.5° 下滑线**上：`pos(n) = d(n)·(0, sin 4.5°, cos 4.5°)`，`lookAt(0,0,0)`，无滚转，`setViewOffset` 把光轴移到 R（734.5, 540.5）。相机沿视线走向目标，所以扩张焦点每帧都正好在 R。`applyCamera(cam, n, W, H)` 一步设好（filmGauge 36、焦距、位置、near/far、移轴）。
- `viewWidthAt(n)` = 目标处的画幅宽度（剧本的“视野”）：f1680 90 km → f1704 30 km（×3 / 24 帧，每帧 4.68%）→ 冲刺 10% → 8% → f1740 1.35 km → 置换④ → f1746 60 m → 8%/帧 → f1756 27.8 m → 置换⑤ → f1762 0.55 m → 减速 6% → 0 → f1776 0.366 m。
- `focalAt(n)`：f1680 前 35 mm，[1680, 1776] 指数地 35 → 100 mm。`d = W·F/36`。`rateAt(n) = W(n−1)/W(n)` 就是 K29 量的“R 附近每帧视放大”（变焦已计入）。
- 关键帧数值：

| 帧 | 视野 W | 焦距 | 到目标 d | 相机高度 | 每帧放大 |
|---|---|---|---|---|---|
| f1680 | 90.0 km | 35.0 mm | 87.5 km | 6.87 km | 4.68% |
| **f1692** | 52.0 km | 39.9 mm | 57.6 km | 4.52 km | 4.68% |
| f1704 | 30.0 km | 45.5 mm | 37.9 km | 2.98 km | 4.68% |
| f1740 | 1.35 km | 67.5 mm | 2.53 km | 199 m | 8.0% |

- 地平线（地球曲率下的视地平线）在 f1680 约 y 493，f1692 约 y 463，f1704 约 y 431（之后随下降与变焦升到 f1756 的 y 209）。A2 的 f1632“地平线弧顶约 y 300”在 f1680 前需要自己降到 y ≈ 493。

### 云与天空（交接帧上两侧共同画的东西）
- 四层云（离谷底的高度）：L1 5.9–6.4 km、L2 5.0–5.55 km、L3 4.05–4.9 km（最厚）、L4 3.3–3.75 km，只存在于目标以南 25–150 km（相机穿过的那一段），北面的天空是晴的。f1680 相机在全部云层之上（云顶在下方迎上来，**左侧（西）**高层云顶带粉橙），f1686 在 L2 里，**f1692 在 L3 里**（整幅被云充满），f1698–1700 在 L4 里，f1704 已在云底之下。
- 相机周围留一个清空气袋（1.2–6 km 外才是云墙），否则在每帧 2 km 的速度下云里只剩一片平的灰（等于白场）。光线步进用随机快门（每个像素看快门内自己的那一刻），再加径向模糊。
- 天空 `duskSky(dir, alt)`（GLSL，在 `SKY_GLSL` 里）：太阳在西方地平线下 4°；西（左）地平线桃橙，北面蓝灰淡紫，东面靛青 + 地影 + 淡淡的金星带，头顶深蓝。没有任何灯。
- 径向模糊：以 R 为中心，模糊范围 = 缩放 `[1, m^0.5]`（半帧位移），m = `rateAt(n)`，置换段封顶 1.12。`createZoomBlur(ctx).apply(srcTex, target, n)`，A2 / A3 / A4 用同一公式。

### 交接帧参数（f1692）
- 相机：`camAt(1692)` = { W 51 961.5 m, F 39.91 mm, d 57 602 m, 高度 4 519 m }，R = 光轴。
- 后期：`cloudsPost(1692)` = exposure 1.0、bloom 0.55、bloomThreshold 1.0、bloomKnee 0.6、streak 0、vignette 0.22、ca 0.0006、grain 0.04、saturation 1、contrast 1。
- 运动模糊：两侧都不用子帧（解析径向模糊 + 随机快门）。泛光遮罩：都不写。
- 实测（K32，半分辨率，有效画面）：f1691 / 1692 / 1693 平均 L 64 / 58 / 50，8×8 块变异系数 0.27 / 0.28 / 0.29（≥ 0.08），左侧比右侧暖（色相更靠近红橙）。

---

## f1758 · A3 `a_descent` → A4 `f_fire` · 置换⑤“草叶横扫”（A3 组）

**状态**：`web/src/shots/_sweep.js` 接口已定（2026-10-27）。A3 渲染到 f1757，A4 从 f1758 起渲染。A4 只需要 import，**每帧最后调用一次 `sweep.drawOver(f)`**。

### 文件
- `web/src/shots/_sweep.js`（A3 组写，A4 只 import）：金合欢枝桠横扫（置换④，A3 自己用）、草叶横扫（置换⑤，A3 与 A4 共用）、交接“纱幕”（veil）、交接参数 `HANDOFF_1758`。它从 `_clouds.js` 取相机轨道。

### 接口（`n = f.t * 24`，纯函数，子帧可用）
```js
import { createSweep, sweepPost, veilWeight, grassPose, acaciaPose, HANDOFF_1758 } from './_sweep.js';
const sweep = createSweep(ctx);       // create()：用 canvas2D 画两张散焦剪影贴图（约 0.3 s）
// render(shot, f)：先把自己的世界画进 f.target，然后
sweep.drawOver(f);                    // 纱幕（权重 veilWeight(n)）+ 本帧的横扫层，预乘 alpha 叠在 f.target 上；横扫之外什么都不画
post(shot, f) { return sweepPost(f.frame); }    // = cloudsPost，与 A3 相同；或者 A4 的 transitionIn 写 postBlend
```
- 也可以分开调用 `sweep.drawVeil(f)` / `sweep.drawBlades(f)`。`drawBlades(f, target, { alphaOnly: true })` 只画覆盖率（白），用于量测。

### 两次横扫
- **置换④ 金合欢** [1740, 1746)：焦外深色枝桠剪影（之字形细枝、成对直刺、羽状小叶团），**从左向右**，边缘被西天（左）勾亮；自带 12 抽头、0.3 帧快门的运动模糊。实测覆盖率（有效画面）：f1740–1746 = 18 / 40 / 52 / 49 / 30 / 19 / 5 %；R 被遮（α > 0.5）f1741、1742、1744 三帧。
- **置换⑤ 草叶** [1756, 1762)：焦外干草叶（暗黄灰，左缘亮），**从右向左**扫过 R。实测覆盖率 f1756–1762 = 17 / 38 / 58 / 54 / 35 / 16 / 0 %；R 被遮 f1758、1759 两帧（f1760 α = 0.49）。最大覆盖 ≤ 70%，未被遮住的部分始终可见，不是黑场。

### 纱幕（交接的关键）
草叶后面要从 A3 的 28 m 地面换成 A4 的微距火绒布景。草叶最多遮 70%，剩下的 30% 无法藏住这次换景，所以两侧共用一层屏幕空间的“纱幕”：一片强烈散焦的暮色地面（左上方留着西天的余光，暗暖灰的地面，几颗大而软的焦外光斑），是 n 的纯函数。两侧都把自己的世界按同一个权重混向纱幕：

| 帧 | 1756 | 1757 | **1758** | 1759 | 1760 | 1761 起 |
|---|---|---|---|---|---|---|
| `veilWeight(n)` | 0 | 0.55 | **1** | 0.8 | 0.4 | 0 |

所以 f1758 两侧画的都是“纱幕 + 草叶”，逐像素一致；A3 的世界在 f1757 溶进纱幕，A4 的微距布景在 f1759–1760 从纱幕里显出来（读作快速推进里焦点跟不上、再找回焦点）。`drawOver` 已经包含这一步，A4 不需要自己写混合。

### 交接帧参数（f1758，`HANDOFF_1758`）
- 下降相机（A3 一侧）：焦距 82.13 mm，目标处视野 7.52 m，到目标 17.15 m，高 1.35 m，4.5° 下滑线，光轴在 R，朝北，无滚转。
- 微距相机（A4 一侧）不必与它一致——纱幕遮住了这次跳变。A4 只需保证：火绒（对焦点）在 R；朝北、无滚转；暮光从左（西）来，低、冷，太阳在西地平线下 4°，没有别的光；后期与 `sweepPost` 一致（或 postBlend）。轨道上 f1762 的视野是 0.55 m（`viewWidthAt(1762)`），f1776 是 0.366 m（焦距 100 mm 时 d ≈ 1.02 m）；现在的 `f_fire/macro.js` 是 100 mm、对焦 0.75 m、俯 12°（画幅约 0.27 m），取景由 A4 组定。
- 运动模糊：横扫层自带解析运动模糊，两侧都不用子帧。泛光遮罩：都不写。

### 需要 A4 做的
1. `create()` 里 `const sweep = createSweep(ctx)`；`render()` 在 [1758, 1762) 画完微距布景后调用 `sweep.drawOver(f)`（之后调用也无害，横扫之外它什么都不画）。
2. f1758 的后期 = `sweepPost(1758)`；如果 A4 的后期不同，在 A4 的 `transitionIn` 加 `postBlend`（引擎会从 A3 在 f1757 的后期平滑过去）。
3. 交接验收：A3 能画到 f1758、f1759（`build/a_descent_test/` 里有把 A3 延长 2 帧的测试时间轴），两组一起比较 X(1758) 与 Y(1758)。

---

## f3864 · B2 `b_flight` → S34 `w_sea` · 蓝点转为字海节点（字海组）

**状态**：`web/src/shots/w_sea/handoff.js` 接口已定（2026-10-27）。B2 渲染到 f3863，S34 从 f3864 起渲染。S34 的 `transitionIn` 是不带 `postBlend` 的 `handoff`，所以 f3864 两侧后期必须一致：**两侧都用 `timeline.post` + `handoffPost(fr)`**（f3864 时 bloom 0、streak 0；其余 = timeline.post：vignette 0.2、ca 0.0006、grain 0.035、exposure 1）。

### 文件与接口（帧号 `fr = f.t * 24` 的纯函数）
```js
import { createHandoffLayer, handoffStars, handoffPost, nodeMorph, BLUE_DOT, PBD } from './w_sea/handoff.js';
const hand = createHandoffLayer(ctx);          // 一个全屏 pass（蓝点 / 节点 + PBD 光带）+ 一组 1 px 点（星）
hand.render(ctx.renderer, f.target, f.t * 24); // 叠加（additive），屏幕空间；在自己的场景之后调用
post(shot, f) { return { ...handoffPost(f.t * 24) }; }   // fr < 3864 时 = { bloom: 0, streak: 0 }
```
- **蓝点**：x 732–735、y 538–541（像素索引），HDR = ACES 反解的 `#82A4DA`，正方形、无泛光。实测 f3864（1080p）核心 (130, 164, 218)；两侧 1 px 的色差边（ca 0.0006）是后期的，两侧相同。
- **星**：`handoffStars()` = `_webgraph` 节点在 `WEB_PATH(9.0)`（24 mm，即 S02 f1128 的构图）下的投影：深度 ≥ 30、带内 y 150–930、离 R ≥ 172 px、彼此 ≥ 18 px，取质量最大的 150 颗 + (900, 450) 那颗（f3900 变 𒀭）。每颗 1 px，显示值 28–84、暖中性白（非蓝）。
- **PBD 光带**：x 824、σ 70 px、`#CDBB98` 的 5%（显示值），不压在点上。S34 在 f3864–3912 把它淡出。
- f3864 起（只有 S34）：`nodeMorph(fr)` 0 → 1（48 帧）把点变成 6 px 核心 + 24 px 柔光的节点（`#FFE2B8`，实测 f3911 核心 (255, 227, 186)）；每颗星在自己的 `tk`（f3870–3950，离 R 由近到远）闪 3 下后交给字。

### B2 需要做的
在 [3780, 3864) 的蓝点段用这个 layer 画蓝点、星和光带（或逐像素复刻同样的数值），并在这些帧的 `post()` 里返回 `handoffPost(fr)`（即 bloom 0、streak 0）。这样 f3863（B2）与 f3864（S34）是同一个 fr 的函数，像素连续。B2 自己的其他内容（探测器等）在 f3816 前已出画，f3816–3863 画面里只有这三样。

---

## f2279 → f2280 · F3 `f_fire` → L1 `l_carriers` · 光心匹配剪辑（火组）

**状态**（2026-10-28）：F3 已实现，数值为 f2279 全分辨率实测（`build/stills/fire-v2/f3/f02279_F3.png`）。这是一刀匹配剪辑（`match`），不是 handoff，不要求像素连续、后期不要求一致；要求光心同一像素（S03-K9 / 剧本 §5.3：≤ 2 px）。

### F3 在 f2279 画的篝火（屏幕空间，1080p，`web/src/shots/f_fire/night.js` 的 `fireSpr`）
- **光心**：核心是关于像素 (960, 540) 中心（连续坐标 960.5, 540.5）对称的椭圆高斯，σx = 2.1 px、σy = 3.0 px；上方另有一小舌火焰（中心上移 7 px，亮度 0.25）。手持呼吸 0.5 px 在 f2279 钉为 0（`zeroAt = 2279/24`），所以 f2279 没有任何偏移。
- **实测（f2279，显示值）**：峰值像素 (960, 540)，RGB (240, 138, 44)，亮度 L = 153；亮度加权重心——阈值 L ≥ 140：(960.13, 539.87)；L ≥ 100：(960.04, 539.51)；L ≥ 60：(960.04, 538.88)（火舌在上，阈值越低重心越往上偏不到 1.2 px）。
- **大小**：核心半高宽 7 px（横）× 12 px（竖）；L ≥ 60 的范围约 x 954–966、y 527–547；40 px 的暖色微光（指数衰减，半径 7 / 20 px 两层），再往外是山丘被火照亮的一道 34×8 px 暖边。
- **亮度 / 颜色**：黑体 1600 K，HDR 核心 ≈ 1.35（≤ 1.5，色相保持在约 20°），没有横向光晕之外的特效。post：bloom 0.72、bloomThreshold 1.0、knee 0.6、streak 0.2（冷色 tint [0.7, 0.8, 1.0]）、vignette 0.24、grain 0.04、ca 0.0006、exposure 1。
- **注意**：远景小火的饱和橙色在色调映射后亮度上不去（L 峰值 153），所以“L ≥ 180 的亮度加权重心”在 F3 一侧没有像素；匹配请用 **峰值像素 / L ≥ 100 的重心 = (960, 540)**。L1 一侧（近景篝火）的 L ≥ 180 重心对准 (960, 540) 即可，两者相差 < 1 px。
