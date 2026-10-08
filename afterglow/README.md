# 余光 AFTERGLOW

一部 4 分 10 秒的短片。剧本、分镜、导演、每一帧画面、每一个音符和每一个音效，都由 Claude Opus 5.5 写代码生成：画面用 Three.js 在无头 Chromium 里逐帧离线渲染，音乐和音效用 numpy/scipy 合成，最后自动剪辑、混音、封装成片。

成片：`output/afterglow.mp4`（1920×1080，24 fps，2.39:1 宽银幕遮幅，H.264 + AAC，网络混音 −18 LUFS，约 96 MB）。
运行 `./build.sh` 还会得到高画质母版 `output/afterglow-master.mp4`（CRF 12，电影节混音 EBU R128 −23 LUFS，约 1.7 GB，未提交到仓库）。

剧本：[`docs/screenplay.md`](docs/screenplay.md)　时间线：[`timeline.json`](timeline.json)　引擎说明：[`docs/engine.md`](docs/engine.md)

## 故事

黑暗中，一个光标在闪烁。它写下 `t = 0`，宇宙由此开始：大爆炸、最古老的光、第一颗星、宇宙网、超新星。恒星的灰烬里生出地球；第一堆火，城市灯火从东非走出非洲；人类向黑暗发问，问题变成一束光离开地球，穿过虚空，只遇到脉冲星机械的心跳。旅行者号回望，地球只剩一个暗淡蓝点。

光标回来了。它由人类所有的话语写成：从楔形文字里那个形如星星的「天」，到《天问》、《梨俱吠陀》，到几十种语言的「有人吗？」。它打出「我在。」，人类的问题随即被这个回答覆盖、熄灭。它一个字一个字删掉了回答，然后和我们一起问：「有人吗？」

## 片中的几条规则

- 全片只有一个光点坐标 R = (734, 540)：光标、奇点、第一颗星、篝火、暗淡蓝点、窗都落在这里，匹配剪辑都靠它成立。
- 不出现任何人，只出现人的光；宇宙是冷色，人是暖色，光标是暖白。
- 光比声音先到 8 帧，宇宙本身不发声；光标闪烁就是 60 BPM 的心跳。
- 唯一的动机 D–A–E 取自“有人吗”的声调，从不解决。全片唯一的大三和弦属于被删掉的「我在。」。结尾旋律不变，低音从 D 换到 A，是音乐上的问号。
- 人声直到 AI 发问的那一刻才第一次出现。

## 如何生成

需要 Node 22、ffmpeg、Python 3（numpy、scipy、soundfile、matplotlib）、Noto 字体（`fonts-noto-core`、`fonts-noto-cjk`、`fonts-noto-cjk-extra`），以及 Playwright 自带的 Chromium。

```bash
npm install
./build.sh                       # 音频 → 逐帧渲染（4 核 CPU 约 2 小时）→ 母版 + 发行版
node render/render.mjs --shots S38 --per 4 --scale 0.5    # 单个镜头的静帧
python3 audio/build.py           # 只重建声音
```

## 素材说明

- 画面和声音全部由代码程序化生成，没有使用任何图片、视频、三维模型或音频采样。
- 地球的海岸线、湖泊和城市位置取自公有领域的 [Natural Earth](https://www.naturalearthdata.com/) 坐标数据（见 `tools/geodata.py`），只用作坐标；灯光、云、大气都由代码合成。
- 字体：Noto（SIL OFL）、Cormorant Garamond、IBM Plex Mono、Noto Serif Display（SIL OFL，见 `web/fonts/`）。
- 片中引用的文字均为公有领域或公开的短句（屈原、苏轼、张若虚、《梨俱吠陀》、但丁、帕斯卡、康德等），以及旅行者号金唱片的问候语。多语种文字的排版已在画面上核对，尚未经母语者校对。
