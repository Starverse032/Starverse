# 人工智能简史 · A Brief History of AI

一部约 **30 分钟**的中文长视频，讲述人工智能从古老梦想到大模型时代的发展历程。
画面、解说、字幕、背景音乐全部由本目录中的代码**离线、程序化生成**，可完整复现。

| 项目 | 规格 |
| --- | --- |
| 时长 | 29 分 41 秒 |
| 画面 | 1920×1080，30 fps，H.264 |
| 声音 | 中文男声解说（Kokoro 语音合成）+ 程序合成的氛围音乐，AAC 立体声 |
| 字幕 | 中文字幕已压制在画面中；另附 `ai-history.srt` |
| 章节 | MP4 内嵌章节标记，播放器可直接跳转 |

成片：`output/ai-history.mp4`　字幕：`output/ai-history.srt`　解说词全文：[`docs/解说词.md`](docs/解说词.md)

> 仓库里的成片是为了符合 GitHub 单文件 100 MB 上限而二次压缩的版本（约 90 MB，视频约 315 kbps）。
> 按下文步骤运行 `build.py` 可得到约 170 MB 的高画质原版（CRF 20）。

## 章节

| 时间 | 章节 | 主要内容 |
| --- | --- | --- |
| 00:00 | 序章 | 机器能思考吗？ |
| 00:41 | 第一章 · 古老的梦想（远古 — 19 世纪） | 塔罗斯与偃师、莱布尼茨、巴贝奇与洛夫莱斯、布尔代数 |
| 03:05 | 第二章 · 理论的奠基（1936 — 1950） | 图灵机、麦卡洛克—皮茨神经元、ENIAC、控制论与信息论、图灵测试 |
| 06:02 | 第三章 · 人工智能的诞生（1955 — 1956） | 达特茅斯会议、逻辑理论家 |
| 07:20 | 第四章 · 黄金年代（1956 — 1974） | 感知机、LISP、“机器学习”、ELIZA、Shakey 与 A* 算法 |
| 10:11 | 第五章 · 第一次寒冬（1969 — 1980） | 《感知机》与异或问题、组合爆炸、莱特希尔报告 |
| 11:32 | 第六章 · 专家系统的兴衰（1965 — 1993） | DENDRAL、MYCIN、XCON、第五代计算机、第二次寒冬 |
| 13:30 | 第七章 · 神经网络的复兴（1982 — 1997） | 霍普菲尔德网络、反向传播、卷积神经网络、LSTM |
| 15:26 | 第八章 · 统计学习的时代（1988 — 2011） | 贝叶斯网络、支持向量机、深蓝、GPU 与 ImageNet、沃森与 Siri |
| 17:45 | 第九章 · 深度学习革命（2012 — 2019） | AlexNet、word2vec、GAN、ResNet、AlphaGo、图灵奖 |
| 21:01 | 第十章 · 大模型的崛起（2017 — 2022） | Transformer、GPT/BERT 与规模定律、AlphaFold、扩散模型、ChatGPT |
| 24:17 | 第十一章 · 智能时代的浪潮（2023 — 2025） | 百模大战、多模态、推理模型、诺贝尔奖、智能体 |
| 27:15 | 第十二章 · 挑战与未来 | 幻觉、偏见、安全与对齐、全球治理、回望与展望 |
| 29:15 | 尾声 | 图灵：“那里有很多事情需要去做。” |

## 如何生成

本项目在 Linux 上开发和测试（Python 3.13，4 核 CPU）。

```bash
# 1. 系统依赖：ffmpeg、思源（Noto CJK）字体、skia 需要的 EGL 库
sudo apt-get install ffmpeg fonts-noto-cjk libegl1 libgl1

# 2. Python 依赖
pip install -r requirements.txt

# 3. 下载离线语音模型（约 400 MB，来自 sherpa-onnx 的 GitHub Releases）
./tools/fetch_models.sh            # 下载到 ./models
# WITH_ASR=1 ./tools/fetch_models.sh  # 额外下载语音识别模型，用于发音校验（可选）

# 4. 构建
python build.py --models models                 # 完整成片 → output/ai-history.mp4（4 核约 1 小时）
python build.py --models models --stills        # 只输出每个场景的静帧到 build/stills/，用于快速检查画面
python build.py --models models --preview 60    # 只渲染前 60 秒
```

常用参数：`--jobs` 并行进程数、`--crf` 画质（越小越清晰、文件越大）、`--voice` 音色编号、`--speed` 语速。

修改解说词只需编辑 `avgen/script.py`，语音按句缓存，重新构建时只会合成改动过的句子。

## 工作原理

```
avgen/script.py ──► tts.py ──► timeline.py ──► scenes.py + visuals/ ──► render.py ──► ffmpeg
   解说词与分镜      逐句合成语音   按真实语音时长排出      每一帧都是时间 t 的       多进程逐帧渲染     编码、混音、
                    （带缓存）     场景、字幕与画面节奏      纯函数：背景/版式/插图    管道送入 x264      封装章节
                                                    ▲
                                    music.py（程序化合成背景音乐，人声出现时自动压低）
```

- **解说**：[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh) 多语种模型，通过 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 离线运行。
  `avgen/pronounce.py` 把英文专有名词（如 ChatGPT、AlphaGo）换成更自然的读法，只影响声音，不影响字幕。
  `tools/asr_check.py` 用 SenseVoice 语音识别回听全部解说，找出可能读错的句子。
- **画面**：[skia-python](https://github.com/kyamagu/skia-python) 绘制。每个历史事件都有一段专门的动画插图
  （图灵机真实运行二进制加一程序、感知机真实执行学习算法、A* 真实搜索路径、深蓝第六局棋谱逐步复盘、扩散模型逐步去噪……），
  并随解说进度切换画面。底部时间轴贯穿全片，标出两次“AI 寒冬”。
- **音乐**：`avgen/music.py` 用 numpy/scipy 合成和弦铺底、钟琴音与混响；寒冬章节转为更暗的和声，深度学习之后更明亮。

## 关于内容

解说词中的年份、人物与数据均经过核对；若干图表做了标注：
- “热度与投入”曲线是**示意图**，用于表现两次寒冬的起伏，并非精确数据；
- 围棋棋盘为示意，不是 AlphaGo 对局的真实棋谱；国际象棋部分复盘的是 1997 年深蓝对卡斯帕罗夫的第六局；
- ImageNet 历年冠军错误率、GPT 系列参数量、CASP14 成绩等为公开报道的数据。

## 目录

```
build.py              构建入口
avgen/
  script.py           解说词与分镜（改内容只需改这里）
  pronounce.py        语音读法替换
  tts.py              语音合成与缓存
  timeline.py         时间线与字幕切分
  scenes.py           各类场景版式、时间轴、字幕
  visuals/            45 段事件插图（va: 1–4 章，vb: 5–8 章，vc: 9–12 章）
  background.py       星空背景
  music.py            背景音乐合成
  render.py           逐帧渲染与编码
tools/
  fetch_models.sh     下载语音模型
  asr_check.py        语音识别回听校验
  export_script.py    导出解说词文稿
docs/解说词.md         解说词全文
output/               成片与字幕
```

## 许可与致谢

- 语音模型 Kokoro-82M（Apache-2.0）；推理框架 sherpa-onnx（Apache-2.0）
- 字体 Noto Sans/Serif CJK、DejaVu（SIL OFL / 自由许可）
- 所有画面与音乐均为程序生成，未使用第三方图片或音频素材
