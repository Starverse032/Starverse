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
- `coronaState(fr)` → `{ A, R300, sigma, rot }`：亮度包络、半径（宽瓣降到中心 10% 处的半径，单位是 1080p 像素）、核心 σ、冕流转角。
- `coronaProfile(r, theta, fr)` → `[r, g, b, occ]`：着色器的 CPU 镜像，用于量测。
- `coronaWebDim(fr)`：网（日冕光后面所有东西）的整体乘子。f1198 前是 0.70（“选定”时其余网压暗 −30%），到 f1212 降到 0.32，之后保持。
- `CORONA`：常量 `R`、`span`、`postSpan`、`radius`、颜色等。

### 画法（屏幕空间，1080p 像素，y 向下，中心 R = (734.5, 540.5)，与 `_webgraph` 的像素中心约定一致）
- 宽瓣 `(1 + 3.22 x²)^-1.6`（x = r / R300）乘冕流调制 `1 + 0.22·s(θ)`：6 个整数谐波，种子相位固定，转得很慢，只作用在瓣的外部。核心是高斯，σ ≈ 46 px。
- 颜色：核心 `#E6EEFF`，宽瓣 `#BFD4FF`，尾部渐变到 `#6FA8FF`（冷白，≥ 7000 K）。
- 遮挡：premultiplied “over”，`dst = dst·(1 − occ) + corona`，`occ(R) = 0.72·A`。
- 包络：f1194 起亮（smootherstep），**f1210.5–1213 平台，峰值正好在 f1212（斜率为 0）**。f1213 起退开：亮度在 f1224 降到 0.18，瓣同时向 120 px 圆盘收缩（R300：f1212 为 300 → f1226 约 135）。f1236 归零。R300 在峰值前随推进每帧增长约 1.2%。
- 交接帧参数（f1212）：A = 1.000，R300 = 300.0 px，σ = 46.0 px，rot = 0，`coronaWebDim` = 0.32；后期取 `coronaPost(1212)`（exposure 1、bloom 0.75、bloomThreshold 1.0、knee 0.6、streak 0.12、vignette 0.2、ca 0.0006、grain 0.035、saturation 1、contrast 1）。目标是 R 附近显示值约 180（HDR 亮度约 0.6，低于泛光 knee），全画面最大值 ≤ 230。

### A2 需要知道的
1. **相机**：`webPathAPose(fr)` 是一条朝 hero.first 的直线，朝向固定（= `WEB_PATH(9.0)` 的朝向），hero.first 恒在 R。到 hero.first 的距离：d(1200) = 4.94，d(1212) = 2.81，d(1224) = 2.01（世界单位）。f1224 圆盘直径 120 px 对应恒星半径约 0.094 u（24 mm，fpx = 1280）。`WEB_PATH_A.rate(fr)` 在 f1224 以后给了一条默认的 2.2% → 1.0%/帧（只是默认值，A2 可以自己接管，只要 f1212 连续）。
2. **hero.first 的点光源**：A1 在 f1197–1207 已把它淡进日冕光（`coronaHeroFade`）。f1212 时画面里没有单独的点光源，A2 不要再画它。圆盘从 f1213 起自己显现。
3. **运动模糊**：交接附近两侧都不用子帧（A1 的 `motionBlur(f)` 在 f1200 以后返回 0）。网的点用解析胶囊拖尾，长度 = 半帧位移，由 `a_origin/web.js` 画，两侧同一套公式。
4. **网**：f1212 时网乘以 0.32 后仍然看得见（画框边缘最明显）。要做到像素一致，最简单的办法是每帧调用 A1 的网层：
   ```js
   import { createWebLayer } from './a_origin/web.js';
   const web = createWebLayer(ctx);                  // 64 万点 + 星 + 半分辨率气体
   web.render(renderer, f.target, f.t * 24);         // 自己清屏，相机按 WEB_PATH_A，亮度已乘 coronaWebDim
   corona.render(renderer, f.target, f.t * 24);
   ```
   如果 A2 想按画面修改表把远景烘成天空球，请至少在 [1212, 1224) 用这个网层，等日冕光退开以后再换。
