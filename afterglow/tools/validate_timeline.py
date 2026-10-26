#!/usr/bin/env python3
"""Validate timeline.json against itself and against docs/v2/timeline-v2.md (machine JSON, §4.4).

    python3 tools/validate_timeline.py                 # timeline.json + docs/v2/timeline-v2.md
    python3 tools/validate_timeline.py path/to/tl.json [path/to/timeline-v2.md]

Checks
  T1  fps = 24, duration = 250 s, frames = 6000
  T2  every timed item (shot, card, subtitle, credit, silence) sits on whole frames: start·24 and end·24 are
      integers (|x − round(x)| < 1e-6), and if it carries `frames: [a, b]` then start = a/24, end = b/24
  T3  shots cover [0, 250) seamlessly: sorted, first starts at 0, last ends at 6000, each shot's end = the next
      shot's start, no empty shot, unique ids
  T4  shot fields: module name, known transitionIn type (cut / match / smash / handoff / dissolve /
      fade_from_black / flash), dissolve/flash/fade durations on whole frames, postBlend a positive integer,
      flash colour well-formed; required text fields (title, visual, camera, sound, notes) present
  T5  cards, subtitles, credits and silences lie inside the film [0, 250) and start < end
  T6  every card (C01–C05 ↔ ①–⑤, C06 ↔ title) and every subtitle (by id) has exactly the frames of the
      corresponding event in docs/v2/timeline-v2.md; fades match fullStart/fullEnd; no card/subtitle missing
      or extra (SB3 is cancelled)
  T7  silences, letterbox and segment boundaries agree with the v2 machine JSON; every v2 cut
      (cut / action_cut / match_cut / flash_cut / dissolve) is a shot boundary, and v2 dissolves have the
      same length in frames
  T8  anchors: R = (734, 540), C = (960, 540), P_ans = (1520, 540), footprint.frames = [888, 1848], no arc
  T9  palette: every '#…' value is a 6-digit hex colour
Info: which shot modules exist in web/src/shots (the others render as slates).
Exit code 0 when everything passes, 1 otherwise.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'timeline.json')
DOC = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs/v2/timeline-v2.md')
FPS = 24
EPS = 1e-6

results = []
def check(code, ok, msg, detail=None):
    results.append((code, bool(ok), msg))
    print(f"{'PASS' if ok else 'FAIL'}  {code:<4} {msg}")
    if detail and not ok:
        for d in detail[:20]:
            print(f'        {d}')

def fr(x):
    return x * FPS

def whole(x):
    return abs(fr(x) - round(fr(x))) < EPS

tl = json.load(open(TL, encoding='utf-8'))
src = open(DOC, encoding='utf-8').read()
v2 = json.loads(re.findall(r'```json\n(.*?)```', src, re.S)[-1])
EV = v2['events']
TOTAL = round(tl.get('duration', 0) * FPS)
print(f'读取 {os.path.relpath(TL, ROOT)}：{len(tl["shots"])} 个镜头，{len(tl.get("cards", []))} 张卡，{len(tl.get("subtitles", []))} 条字幕；对照 {os.path.relpath(DOC, ROOT)}（{len(EV)} 个事件）\n')

# T1
check('T1', tl.get('fps') == FPS and tl.get('duration') == 250.0 and tl.get('frames') == 6000 and TOTAL == 6000,
      f"fps = {tl.get('fps')}，duration = {tl.get('duration')} s，frames = {tl.get('frames')}")

# T2
bad = []
for key in ['shots', 'cards', 'subtitles', 'credits', 'silences']:
    for it in tl.get(key, []):
        name = f"{key}:{it.get('id', '?')}"
        for edge in ['start', 'end']:
            if not isinstance(it.get(edge), (int, float)):
                bad.append(f'{name} 缺少 {edge}'); continue
            if not whole(it[edge]):
                bad.append(f'{name} {edge} = {it[edge]} → {fr(it[edge]):.6f} 帧，不是整数帧')
        if 'frames' in it:
            a, b = it['frames']
            if not (isinstance(a, int) and isinstance(b, int)):
                bad.append(f'{name} frames 不是整数：{it["frames"]}')
            elif abs(it['start'] - a / FPS) > EPS or abs(it['end'] - b / FPS) > EPS:
                bad.append(f'{name} frames {it["frames"]} 与 start/end {it["start"]}/{it["end"]} 不一致')
check('T2', not bad, '所有镜头、卡、字幕、署名、静音的边界都落在整数帧上（frames 与 start/end 一致）', bad)

# T3
shots = tl['shots']
F = [(round(fr(s['start'])), round(fr(s['end'])), s['id']) for s in shots]
bad = []
if F[0][0] != 0: bad.append(f'第一个镜头 {F[0][2]} 从 f{F[0][0]} 开始')
if F[-1][1] != TOTAL: bad.append(f'最后一个镜头 {F[-1][2]} 止于 f{F[-1][1]}')
for (a0, b0, i0), (a1, b1, i1) in zip(F, F[1:]):
    if b0 != a1: bad.append(f'{i0} 止于 f{b0}，{i1} 起于 f{a1}：{"缝隙" if b0 < a1 else "重叠"} {abs(a1 - b0)} 帧')
for a, b, i in F:
    if b <= a: bad.append(f'{i} 长度 {b - a} 帧')
ids = [s['id'] for s in shots]
dup = sorted({i for i in ids if ids.count(i) > 1})
if dup: bad.append(f'重复的镜头 id：{dup}')
check('T3', not bad, f'{len(shots)} 个镜头无缝、无重叠覆盖 [0, {TOTAL})（[0, 250) s），id 唯一', bad)

# T4
KNOWN = {'cut', 'match', 'smash', 'handoff', 'dissolve', 'fade_from_black', 'flash'}
bad = []
for i, s in enumerate(shots):
    if not re.fullmatch(r'[a-z_][a-z0-9_]*', s.get('module', '')): bad.append(f"{s['id']} module 名不合法：{s.get('module')!r}")
    for k in ['title', 'visual', 'camera', 'sound', 'notes']:
        if not s.get(k): bad.append(f"{s['id']} 缺少 {k}")
    tin = s.get('transitionIn') or {'type': 'cut'}
    ty = tin.get('type', 'cut')
    if ty not in KNOWN: bad.append(f"{s['id']} transitionIn.type 未知：{ty}")
    if ty in ('dissolve', 'flash', 'fade_from_black'):
        d = tin.get('dur', 0)
        if not (d > 0 and (whole(d) or abs(fr(d) - round(fr(d))) < 0.01)): bad.append(f"{s['id']} {ty} dur = {d}（{fr(d):.3f} 帧）")
    if ty in ('handoff', 'match') and i == 0: bad.append(f"{s['id']} 是第一个镜头，不能 {ty}")
    if 'postBlend' in tin and not (isinstance(tin['postBlend'], int) and tin['postBlend'] > 0): bad.append(f"{s['id']} postBlend 应为正整数帧：{tin['postBlend']}")
    for tr in [tin, s.get('transitionOut') or {}]:
        c = tr.get('color')
        if c is not None and not ((isinstance(c, list) and len(c) == 3 and all(isinstance(v, (int, float)) for v in c))
                                  or (isinstance(c, str) and (re.fullmatch(r'#[0-9A-Fa-f]{6}', c) or c in tl.get('palette', {})))):
            bad.append(f"{s['id']} 闪光颜色不合法：{c!r}")
    mb = s.get('motionBlur')
    if mb is not None and not (isinstance(mb, int) and mb >= 0): bad.append(f"{s['id']} motionBlur 应为整数：{mb}")
check('T4', not bad, '镜头字段完整；转场类型已知（含 handoff）；叠化 / 闪光 / 淡入时长为整数帧；postBlend、闪光颜色合法', bad)

# T5
bad = []
for key in ['cards', 'subtitles', 'credits', 'silences']:
    for it in tl.get(key, []):
        a, b = round(fr(it['start'])), round(fr(it['end']))
        if not (0 <= a < b <= TOTAL): bad.append(f"{key}:{it.get('id')} [{a}, {b}) 不在 [0, {TOTAL}) 内或为空")
for k in tl.get('letterbox', []):
    if not (0 <= k['t'] and k['t'] + k.get('dur', 0) <= tl['duration']): bad.append(f"letterbox t = {k['t']} 越界")
check('T5', not bad, '字卡、字幕、署名、静音、遮幅都在片长 [0, 250) 之内', bad)

# T6
card_ev = {e['id']: e for e in EV if e['type'] == 'card'}
title_ev = [e for e in EV if e['type'] == 'title']
sub_ev = {e['id']: e for e in EV if e['type'] == 'subtitle'}
CIRC = {'C01': '①', 'C02': '②', 'C03': '③', 'C04': '④', 'C05': '⑤'}
bad = []
seen = set()
def cmp(name, it, e, full=True):
    a, b = round(fr(it['start'])), round(fr(it['end']))
    if (a, b) != (e['start'], e['end']): bad.append(f"{name} [{a}, {b}) ≠ timeline-v2 [{e['start']}, {e['end']})")
    if full and 'fullStart' in e:
        fi = round(fr(it.get('fadeIn', 0))); fo = round(fr(it.get('fadeOut', 0)))
        fe = e.get('coolEnd', e.get('fullEnd'))
        if a + fi != e['fullStart']: bad.append(f"{name} 淡入止于 f{a + fi} ≠ fullStart f{e['fullStart']}")
        if b - fo != fe: bad.append(f"{name} 淡出起于 f{b - fo} ≠ f{fe}")
for c in tl.get('cards', []):
    if c['id'] in CIRC:
        k = CIRC[c['id']]; seen.add(k)
        if k not in card_ev: bad.append(f"{c['id']}：timeline-v2 没有卡{k}"); continue
        cmp(f"{c['id']}（卡{k}）", c, card_ev[k])
    elif c['id'] == 'C06' or c.get('style') == 'title':
        seen.add('title')
        if not title_ev: bad.append('timeline-v2 没有片名事件'); continue
        cmp(f"{c['id']}（片名）", c, title_ev[0])
    else:
        bad.append(f"多出的卡 {c['id']}")
for k in card_ev:
    if k not in seen: bad.append(f'timeline-v2 的卡{k} 在 timeline.json 里缺失')
if title_ev and 'title' not in seen: bad.append('片名卡缺失')
subs = {s['id']: s for s in tl.get('subtitles', [])}
for sid, e in sub_ev.items():
    if sid not in subs: bad.append(f'字幕 {sid} 缺失'); continue
    cmp(f'字幕 {sid}', subs[sid], e)
for sid in subs:
    if sid not in sub_ev: bad.append(f'多出的字幕 {sid}（timeline-v2 里没有；SB3 已取消）')
check('T6', not bad, f"{len(tl.get('cards', []))} 张卡（含片名）与 {len(subs)} 条字幕的帧位、淡入淡出与 timeline-v2 机读 JSON 一致", bad)

# T7
bad = []
sil_ev = {e['id']: e for e in EV if e['type'] in ('silence_digital', 'silence_near')}
sil = {z.get('id'): z for z in tl.get('silences', [])}
for zid, e in sil_ev.items():
    z = sil.get(zid)
    if not z: bad.append(f'静音 {zid} 缺失'); continue
    want = 'digital' if e['type'] == 'silence_digital' else 'near'
    if (round(fr(z['start'])), round(fr(z['end']))) != (e['start'], e['end']) or z['type'] != want:
        bad.append(f"静音 {zid} [{round(fr(z['start']))}, {round(fr(z['end']))}) {z['type']} ≠ [{e['start']}, {e['end']}) {want}")
for zid in sil:
    if zid not in sil_ev: bad.append(f'多出的静音 {zid}')
lb = tl.get('letterbox', [])
for e in [e for e in EV if e['type'] == 'letterbox']:
    hit = [k for k in lb if round(fr(k['t'])) == e['start'] and round(fr(k['t'] + k.get('dur', 0))) == e['end'] and abs(k['aspect'] - e['toAspect']) < 1e-3]
    if not hit: bad.append(f"遮幅 [{e['start']}, {e['end']}) → {e['toAspect']} 在 timeline.letterbox 里没有对应的键")
bounds = {a for a, b, i in F} | {TOTAL}
for sg in v2['segments']:
    if sg['start'] not in bounds and sg['start'] not in (3216,):   # f3216: S06→S07 inside long take B (B1 continues)
        bad.append(f"段 {sg['id']} 的起点 f{sg['start']} 不是镜头边界")
CUTS = {'cut', 'action_cut', 'match_cut', 'flash_cut', 'dissolve'}
for e in EV:
    if e['type'] == 'cut' and e['kind'] in CUTS and e['frame'] not in bounds:
        bad.append(f"timeline-v2 的剪辑点 f{e['frame']}（{e['kind']}）不是镜头边界")
    if e['type'] == 'cut' and e['kind'] == 'dissolve':
        s = [s for s in shots if round(fr(s['start'])) == e['frame']]
        if s:
            tin = s[0].get('transitionIn') or {}
            n = re.search(r'叠化 (\d+) 帧', e['label'])
            if tin.get('type') != 'dissolve' or (n and round(fr(tin.get('dur', 0))) != int(n.group(1))):
                bad.append(f"f{e['frame']} 应为 {n.group(1) if n else '?'} 帧叠化，timeline.json 是 {tin}")
check('T7', not bad, '静音 Z0–Z7、遮幅 [504, 552) / [5640, 5664)、段界与 timeline-v2 一致；v2 的每个剪辑点都是镜头边界，叠化帧数一致', bad)

# T8
A = tl.get('anchors', {})
bad = []
for k, v in [('R', [734, 540]), ('C', [960, 540]), ('P_ans', [1520, 540])]:
    if A.get(k) != v: bad.append(f'anchors.{k} = {A.get(k)}，应为 {v}')
if (A.get('footprint') or {}).get('frames') != [888, 1848]: bad.append(f"anchors.footprint.frames = {(A.get('footprint') or {}).get('frames')}")
if 'arc' in A: bad.append('anchors.arc 应删除')
check('T8', not bad, 'anchors：R = (734, 540)、C = (960, 540)、P_ans = (1520, 540)、footprint = [888, 1848]、无 arc', bad)

# T9
bad = [f'palette.{k} = {v}' for k, v in tl.get('palette', {}).items() if isinstance(v, str) and v.startswith('#') and not re.fullmatch(r'#[0-9A-Fa-f]{6}', v)]
check('T9', not bad, f"palette 的 {sum(1 for v in tl.get('palette', {}).values() if isinstance(v, str) and v.startswith('#'))} 个十六进制颜色格式正确", bad)

# info
mods = sorted({s['module'] for s in shots})
have = [m for m in mods if os.path.exists(os.path.join(ROOT, 'web/src/shots', m + '.js'))]
miss = [m for m in mods if m not in have]
print(f"\nINFO  模块 {len(mods)} 个：已存在 {', '.join(have) or '—'}；尚未建立（引擎画 slate）{', '.join(miss) or '—'}")

n_fail = sum(1 for r in results if not r[1])
print(f'\n合计：PASS {len(results) - n_fail}，FAIL {n_fail}')
sys.exit(1 if n_fail else 0)
