#!/usr/bin/env python3
"""《余光》v2 时间轴校验（评审用脚本，不是工程源码）。

解析 docs/v2/timeline-v2.md 中「机读附录」的 ```json 代码块，并与正文表格交叉核对。
用法：python3 docs/v2/check_timeline.py [docs/v2/timeline-v2.md]
退出码：0 = 无 FAIL（WARN 只提示剧本待确认处）；1 = 有 FAIL。
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/v2/timeline-v2.md"
FPS, N = 24, 6000
res = {"PASS": 0, "FAIL": 0, "WARN": 0}

def report(kind, cid, msg):
    res[kind] += 1
    print(f"{kind:4}  {cid:4}  {msg}")

def check(cid, ok, msg, detail=""):
    report("PASS" if ok else "FAIL", cid, msg + ("" if ok else f" —— {detail}"))

def tc(f):
    s, ff = divmod(f, FPS); m, ss = divmod(s, 60)
    return f"{m}:{ss:02d}.{ff:02d}"

def tiles(iv, lo, hi):
    """iv: [(start,end,name)] -> list of problems if not a seamless, non-overlapping cover of [lo,hi)."""
    iv = sorted(iv); bad = []
    if not iv: return ["空"]
    if iv[0][0] != lo: bad.append(f"起点 {iv[0][0]} ≠ {lo}")
    if iv[-1][1] != hi: bad.append(f"终点 {iv[-1][1]} ≠ {hi}")
    for (a, b, n) in iv:
        if not a < b: bad.append(f"{n} 区间非法 [{a},{b})")
    for (a1, b1, n1), (a2, b2, n2) in zip(iv, iv[1:]):
        if b1 < a2: bad.append(f"{n1}→{n2} 有缝 [{b1},{a2})")
        if b1 > a2: bad.append(f"{n1}/{n2} 重叠 [{a2},{b1})")
    return bad

text = DOC.read_text(encoding="utf-8")
blocks = re.findall(r"```json\n(.*?)\n```", text, re.S)
if not blocks:
    print("FAIL  C0    文档中没有 ```json 代码块"); sys.exit(1)
T = json.loads(blocks[-1])
SEG, BEAT, EV = T["segments"], T["beats"], T["events"]
segr = {s["id"]: (s["start"], s["end"]) for s in SEG}
beatr = {b["id"]: (b["start"], b["end"]) for b in BEAT}
print(f"读取 {DOC.relative_to(ROOT) if DOC.is_relative_to(ROOT) else DOC}：{len(SEG)} 段，{len(BEAT)} 节拍，{len(EV)} 事件\n")

# C1 基本参数
check("C1", T["fps"] == 24 and T["frames"] == 6000, "fps = 24，frames = 6000", f"{T['fps']}, {T['frames']}")

# C2 段落层
b = tiles([(s["start"], s["end"], s["id"]) for s in SEG], 0, N)
check("C2a", not b, "11 段无缝、无重叠覆盖 [0, 6000)", "; ".join(b))
check("C2b", [s["id"] for s in SEG] == [f"S{i:02d}" for i in range(1, 12)], "段编号 S01–S11 依序")
lt = {}
for s in SEG:
    if s["longTake"]: lt.setdefault(s["longTake"], []).append(s)
ok = (sorted(lt) == ["A", "B", "C"] and [x["id"] for x in lt["A"]] == ["S02"]
      and [x["id"] for x in lt["B"]] == ["S06", "S07"] and [x["id"] for x in lt["C"]] == ["S09"])
check("C2c", ok, "长镜头标记：A = S02，B = S06 + S07，C = S09", str({k: [x['id'] for x in v] for k, v in lt.items()}))
LT = {k: (v[0]["start"], v[-1]["end"]) for k, v in lt.items()}
check("C2d", all(lt[k][i]["end"] == lt[k][i + 1]["start"] for k in lt for i in range(len(lt[k]) - 1)),
      "长镜头 B 的两段首尾相接（f3216）")
print(f"      长镜头 A {LT['A']}  {LT['A'][1]-LT['A'][0]} f；B {LT['B']}  {LT['B'][1]-LT['B'][0]} f；C {LT['C']}  {LT['C'][1]-LT['C'][0]} f")

# C3 节拍层
b = tiles([(x["start"], x["end"], x["id"]) for x in BEAT], 0, N)
check("C3a", not b, f"{len(BEAT)} 个节拍无缝、无重叠覆盖 [0, 6000)", "; ".join(b))
bad = [x["id"] for x in BEAT if not (segr[x["id"][:3]][0] <= x["start"] and x["end"] <= segr[x["id"][:3]][1])]
check("C3b", not bad, "每个节拍落在所属段内", ", ".join(bad))
bad = []
for sid, (a, e) in segr.items():
    p = tiles([(x["start"], x["end"], x["id"]) for x in BEAT if x["id"][:3] == sid], a, e)
    if p: bad.append(f"{sid}: {'; '.join(p)}")
check("C3c", not bad, "每段的节拍首尾相接、恰好铺满该段", " | ".join(bad))

# C4 事件基本合法性与所属段
def span(e):
    return (e["frame"], e["frame"] + 1) if "frame" in e else (e["start"], e["end"])
bad = []
for i, e in enumerate(EV):
    if not {"type", "label", "seg"} <= set(e): bad.append(f"#{i} 缺字段"); continue
    a, z = span(e)
    if not (0 <= a < z <= N): bad.append(f"#{i} {e['type']} 越界 [{a},{z})"); continue
    segs = [e["seg"]] if isinstance(e["seg"], str) else e["seg"]
    if any(s not in segr for s in segs): bad.append(f"#{i} 未知段 {segs}"); continue
    idx = sorted(int(s[1:]) for s in segs)
    if idx != list(range(idx[0], idx[-1] + 1)): bad.append(f"#{i} 所属段不连续 {segs}"); continue
    lo, hi = segr[f"S{idx[0]:02d}"][0], segr[f"S{idx[-1]:02d}"][1]
    if not (lo <= a and z <= hi): bad.append(f"#{i} {e['type']} {e['label'][:20]} [{a},{z}) 不在 {segs} [{lo},{hi}) 内")
check("C4", not bad, f"全部 {len(EV)} 个事件字段完整、在 [0, 6000) 内、落在所属段内", "; ".join(bad[:8]))

by = {}
for e in EV: by.setdefault(e["type"], []).append(e)
F = lambda t: sorted(e["frame"] for e in by.get(t, []))

# C5 节拍内阶段
bad = []
for e in by.get("phase", []):
    a, z = beatr[e["beat"]]
    if not (a <= e["start"] and e["end"] <= z): bad.append(f"{e['beat']} [{e['start']},{e['end']}) 出界")
for bid in sorted({e["beat"] for e in by.get("phase", [])}):
    p = tiles([(e["start"], e["end"], e["label"][:8]) for e in by["phase"] if e["beat"] == bid], *beatr[bid])
    if p: bad.append(f"{bid}: {'; '.join(p)}")
check("C5", not bad, f"{len(by.get('phase', []))} 个节拍内阶段落在所属节拍内，且铺满所在节拍", " | ".join(bad))

# C6 光标状态
CS = by["cursor_state"]
b = tiles([(e["start"], e["end"], e["state"]) for e in CS], 0, N)
check("C6", not b, f"光标状态轨 {len(CS)} 段无缝覆盖 [0, 6000)", "; ".join(b))
def state_at(f):
    return next(e["state"] for e in CS if e["start"] <= f < e["end"])

# C7 心跳
HB = F("heartbeat"); KEYF = set(F("key")) | set(F("backspace")) | set(F("return"))
Z = {e["id"]: (e["start"], e["end"]) for e in by["silence_digital"] + by["silence_near"]}
check("C7a", all(f % 24 == 0 for f in HB), f"{len(HB)} 声心跳全部落在正拍（帧 = 24k）", str([f for f in HB if f % 24]))
check("C7b", all(next(s for s, (a, z) in segr.items() if a <= f < z) in ("S01", "S09", "S11") for f in HB),
      "心跳只出现在 S01、S09、S11（光标在场的段落）")
bad = [f for f in HB if state_at(f) not in ("blink", "moving")]
check("C7c", not bad, "每声心跳都落在光标“闪烁”或“移动常亮”（S09-f 例外）区间", str(bad))
bad = [f for f in HB if any(a <= f < z for k, (a, z) in Z.items() if k in ("Z0", "Z1", "Z4", "Z6", "Z7"))]
check("C7d", not bad, "数字零与三秒静音（Z6）内没有心跳", str(bad))
check("C7e", not (set(HB) & KEYF), "心跳不与键击、退格、回车同帧（打字中光标常亮、不发心跳）", str(sorted(set(HB) & KEYF)))
miss, unv = [], set(F("blink_unvoiced"))
covered = set(HB) | set(F("heartbeat_muted")) | unv
for e in CS:
    if e["state"] == "blink":
        for f in range((e["start"] + 23) // 24 * 24, e["end"], 24):
            if f not in covered: miss.append(f)
check("C7f", not miss, "每个“闪烁”区间里的每一个正拍都有心跳（或明确标为静音）", str(miss))
for f in sorted(unv):
    report("WARN", "C7g", f"f{f}（{tc(f)}）光标闪烁但剧本未写心跳 → 见 §6「待剧本确认」")
if not unv:
    check("C7g", True, "没有“光标闪烁而无心跳”的拍（f4680 已由剧本第 1 轮补上）")
mov = [f for f in HB if state_at(f) == "moving"]
check("C7h", mov == [4992, 5016], "“光标常亮仍有心跳”只出现在 S09-f（f4992、f5016）", str(mov))

# C8 键击
bad = [f for f in F("key") + F("backspace") if state_at(f) != "steady"]
check("C8a", not bad, f"{len(F('key'))} 个键击与 {len(F('backspace'))} 次退格全部发生在光标常亮区间", str(bad))
k = F("key")
check("C8b", len(k) == len(set(k)), "没有两个键落在同一帧")
check("C8c", F("return") == [190, 252, 504, 5160], "回车 4 次：f190、f252、f504、f5160", str(F("return")))
check("C8d", [x for x in k if x >= 4584] == [4656, 4664, 4672, 5040, 5064, 5088, 5112] and F("backspace") == [4848, 4872, 4896],
      "AI 三次主动输入的键位：我在。(4656/4664/4672) 删 (4848/4872/4896) 有人吗？(5040/5064/5088/5112)")

# C9 暗隙
DG = by.get("dark_gap", [])
bad = [e for e in DG if not (e["end"] - e["start"] == 7 and e["seg"] == "S04" and e["end"] % 24 == 0)]
check("C9a", len(DG) == 4 and not bad, "S04 暗隙 4 次，每次 7 帧（0.292 s），新光源都在正拍点亮", str([(e['start'], e['end']) for e in bad]))
bad = [(e["start"], e["end"]) for e in by.get("black", []) for k2, (a, z) in LT.items() if a < e["end"] and e["start"] < z]
check("C9b", not bad, "三段长镜头内没有任何黑场（长镜头不藏切）", str(bad))
CUTK = {"cut", "action_cut", "match_cut", "flash_cut", "dissolve", "cut_to_black"}
bad = [(e["frame"], k2) for e in by["cut"] if e["kind"] in CUTK for k2, (a, z) in LT.items() if a < e["frame"] < z]
check("C9c", not bad, "三段长镜头内部没有剪辑点（切、叠化、闪切）", str(bad))
bad = [e["frame"] for e in by["cut"] if e["kind"] == "continuous" and e["frame"] not in (600, 3216, 3864, 4584)]
check("C9d", not bad, "连续交接只在 f600、f3216、f3864、f4584", str(bad))

# C10 字卡
CARDS, READ = by["card"], [e for e in by["reading"] if e["primary"]]
check("C10a", len(CARDS) == 5 and all(c["fullStart"] - c["start"] == 18 and c["end"] - c["fullEnd"] == 18 for c in CARDS),
      "字卡①–⑤ 各 18 帧淡入、18 帧淡出")
bad = [(c["id"], r["label"][:16]) for c in CARDS for r in READ if c["start"] < r["end"] and r["start"] < c["end"]]
check("C10b", not bad, "字卡不与任何主要读字目标重叠（读字目标取剧本 §4.3）", str(bad))
gap = min(min(abs(c["start"] - r["end"]), abs(r["start"] - c["end"])) for c in CARDS for r in READ)
print(f"      字卡与最近读字目标的最小间隔：{gap} 帧")
bad = [(c["id"], c["seg"]) for c in CARDS if c["seg"] in ("S01", "S09", "S11")]
check("C10c", not bad, "字卡都不在有心跳的段落（S01、S09、S11）里", str(bad))
hits = set(F("key")) | set(F("backspace")) | set(F("return")) | {e["start"] for e in by["flash"]}
bad = [c["id"] for c in CARDS if c["start"] in hits]
check("C10d", not bad, "字卡入点都不与键击、回车、闪光同帧", str(bad))
bad = [(c["id"], s["id"]) for c in CARDS for s in by["subtitle"] if c["start"] < s["end"] and s["start"] < c["end"]]
check("C10e", not bad, "字卡与片内字幕不同时在场", str(bad))
t = by["title"][0]
bad = [r["label"][:12] for r in READ if t["start"] < r["end"] and r["start"] < t["end"]] + \
      [c["id"] for c in CARDS if t["start"] < c["end"] and c["start"] < t["end"]]
check("C10f", not bad, "片名 [5496, 5616) 独占画面，不与字卡或其他读字目标重叠", str(bad))

# C11 主要读字目标两两不重叠
R = sorted(READ, key=lambda e: e["start"])
bad = [(a["label"][:10], b["label"][:10]) for a, b in zip(R, R[1:]) if a["end"] > b["start"]]
check("C11", not bad, f"{len(R)} 个主要读字目标两两不重叠（每个时刻只有一个）", str(bad))

# C12 静音
SND = set(HB) | KEYF | set(F("echo")) | {e["frame"] for e in by["print"] if "tick" in e["label"]}
dig = by["silence_digital"]
bad = [(d["id"], f) for d in dig for f in SND if d["start"] <= f < d["end"]]
check("C12a", not bad, f"数字零 {len(dig)} 段（{', '.join(d['id'] for d in dig)}）内没有任何键、心跳、回显或打印声", str(bad))
check("C12b", sorted(d["end"] - d["start"] for d in dig if d["end"] - d["start"] > 48) == [162],
      "长于 2 s 的数字零只有一次：Z4 [3702, 3864) = 6.75 s")
check("C12c", Z.get("Z6") == (4920, 4992), "三秒静音 Z6 = [4920, 4992)，恰好 72 帧")

# C13 光先于声
bad = []
for e in by["light_before_sound"]:
    if e["end"] - e["start"] != 8: bad.append(f"{e['start']}→{e['end']} 不是 8 帧")
    if not any(a <= e["start"] and e["end"] <= z for a, z in Z.values()): bad.append(f"[{e['start']},{e['end']}) 没有被静音区间覆盖")
    if any(e["start"] <= f < e["end"] for f in SND): bad.append(f"[{e['start']},{e['end']}) 内有声音事件")
check("C13", not bad and len(by["light_before_sound"]) == 2, "光先于声 8 帧：f600→f608、f1344→f1352，间隙内无声", "; ".join(bad))

# C14 遮幅
L = sorted(by["letterbox"], key=lambda e: e["start"])
ok = len(L) == 2 and (L[0]["start"], L[0]["end"], L[0]["toAspect"]) == (504, 552, 2.39) and (L[1]["start"], L[1]["end"], L[1]["toAspect"]) == (5640, 5664, 1.7778)
check("C14", ok, "遮幅：[504, 552) 合拢到 2.39，[5640, 5664) 打开回 16:9；立体声切换与之同区间",
      str([(e['start'], e['end']) for e in L]))

# C16 长镜头 A 的推进速率轨与尺度置换
RT = sorted(by.get("camera_rate", []), key=lambda e: e["start"])
b = tiles([(e["start"], e["end"], e["kind"]) for e in RT], *LT["A"])
check("C16a", not b, f"推进速率轨 {len(RT)} 段无缝覆盖长镜头 A [{LT['A'][0]}, {LT['A'][1]})（巡航 / 冲刺 / 置换 / 停稳）", "; ".join(b))
SUB = [e for e in RT if e["kind"] == "substitution"]; SPR = [e for e in RT if e["kind"] == "sprint"]
check("C16b", len(SUB) == 5 and all(e["end"] - e["start"] >= 6 for e in SUB),
      "尺度置换恰好 5 处，每处 ≥ 6 帧：" + "、".join(f"[{e['start']}, {e['end']})" for e in SUB))
bad = [(a["start"], c["start"]) for a in SPR for c in SUB if a["start"] < c["end"] and c["start"] < a["end"]]
check("C16c", not bad and len(SPR) == 6, f"冲刺 {len(SPR)} 段与置换 {len(SUB)} 处互不重叠", str(bad))
bad = [e["start"] for e in RT if e["kind"] in ("cruise", "sprint") and not isinstance(e.get("maxRate"), (int, float))]
bad += [e["start"] for e in RT if isinstance(e.get("maxRate"), (int, float)) and
        ((e["kind"] == "cruise" and e["maxRate"] > 3) or (e["kind"] == "sprint" and not 0 < e["maxRate"] <= 10))]
check("C16d", not bad, "速率上限：巡航 ≤ 3%/帧，冲刺 ≤ 10%/帧", str(bad))
bad = [(a["kind"], b2["kind"], b2["start"]) for a, b2 in zip(RT, RT[1:]) if a["kind"] == b2["kind"] == "substitution"]
check("C16e", not bad, "两处置换之间至少隔一段推进（不连续置换）", str(bad))
ph = {(e["start"], e["end"]) for e in by.get("phase", []) if e["beat"].startswith("S02")}
bad = [(e["start"], e["end"]) for e in SUB if (e["start"], e["end"]) not in ph]
check("C16f", not bad, "每处置换都是 S02 节拍里的一个独立阶段（与正文 §2.2 对齐）", str(bad))
st = [e for e in RT if e["kind"] == "stopped"]
flint = [1788, 1812, 1836, 1848]
check("C16g", len(st) == 1 and st[0]["start"] == 1776 and all(st[0]["start"] <= f < st[0]["end"] for f in flint),
      "f1776 停稳后才有三次打火石与点燃（f1788 / 1812 / 1836 / 1848）")
bad = [(e["type"], e["start"]) for e in by.get("black", []) + by.get("near_dark", []) for c in SUB if e["start"] < c["end"] and c["start"] < e["end"]]
bad += [e["start"] for e in by.get("occlusion", []) if not any(c["start"] <= e["start"] and e["end"] <= c["end"] for c in SUB)]
check("C16h", not bad, "置换时刻没有黑场；前景遮挡（④⑤）都落在置换区间内", str(bad))

# C17 S06 的读字窗口与焦点变化
RW = {e["id"]: (e["start"], e["end"]) for e in by.get("read_window", [])}
FO = sorted((e["start"], e["end"]) for e in by.get("focus", []))
lang = [RW[k] for k in ("en", "ja", "es", "ar")]
ok = RW["lead"][1] - RW["lead"][0] == 72 and any((r["start"], r["end"]) == RW["lead"] for r in READ)
check("C17a", ok, "「有人吗？」读字窗 [3060, 3132) = 3.0 s，与主要读字目标一致", str(RW.get("lead")))
ok = all(20 <= z - a <= 21 for a, z in lang) and all(p[1] - q[0] == 5 for p, q in zip(lang, lang[1:]))
check("C17b", ok, "四种语言各可读 20–21 帧，相邻两句只重叠 5 帧", str(lang))
ok = lang[0][0] >= max(z for a, z in FO) and lang[-1][1] == segr["S06"][1] and any((r["start"], r["end"]) == (lang[0][0], lang[-1][1]) for r in READ)
check("C17c", ok, "「有人吗？」f3150 前完全出画后，第一句外语才开始；四句恰好铺满读字目标 [3150, 3216)", str(FO))
c3 = next(c for c in CARDS if c["id"] == "③")
ok = FO[0] == (c3["fullEnd"], c3["end"]) and FO[1] == (c3["end"], RW["lead"][0]) and FO[2] == (RW["lead"][1], lang[0][0])
check("C17d", ok, "焦点链首尾相接：卡③淡出期领头句焦外 [3030, 3048) → 拉焦 [3048, 3060) → 可读 → 掠出 [3132, 3150)", str(FO))

# C18 C 锚点区间
A = by.get("anchor", [])
cutf = {e["frame"] for e in by["cut"] if e["kind"] in CUTK}
ok = len(A) == 1 and A[0]["start"] in cutf and A[0]["end"] in cutf and A[0]["start"] < 2280 < A[0]["end"]
check("C18", ok, "光心用 C 的区间 [2112, 2892) 两端都是剪辑点，并包含 f2280 的光心匹配剪辑", str([(a['start'], a['end']) for a in A]))

# C19 心跳电平与 dub
H = by["heartbeat"]
bad = [e["frame"] for e in H if not ("level" in e and e.get("dub") == e["frame"] + 7 and e.get("dubLevel") == e["level"] - 8)]
check("C19a", not bad, "每声心跳都写明 lub 电平；dub = lub + 7 帧、低 8 dB", str(bad))
bad = [e["frame"] for e in H if e["seg"] in ("S01", "S11") and e["level"] != -30] + \
      [e["frame"] for e in H if e["seg"] == "S09" and e["level"] not in (-32, -36, -38)]
check("C19b", not bad, "电平：S01、S11 lub −30 dB；S09 只用 −32 / −36 / −38 dB", str(bad))
bad = [e["frame"] for e in H if any(d["start"] <= e["dub"] < d["end"] for d in dig)]
check("C19c", not bad, "dub 都落在亮相位内，且不进入数字零", str(bad))

# C20 片内字幕与读字目标
sb = {s2["id"]: (s2["start"], s2["end"]) for s2 in by["subtitle"]}
ok = sb["SB1"] == sb["SB2"] == (4356, 4416) and any((r["start"], r["end"]) == sb["SB1"] for r in READ) \
     and not any(4320 <= s2["start"] < 4356 for s2 in by["subtitle"])
check("C20", ok, "SB1 / SB2 = [4356, 4416)，与其读字目标同区间；天城文单独的 [4320, 4356) 内没有字幕", str(sb.get("SB1")))

# C15 正文表格与 JSON 一致
secs = {p.split(".", 1)[0]: p for p in re.split(r"^## ", text, flags=re.M)[1:]}
sec1, sec2 = secs["1"], secs["2"]
rows = {m[0]: (int(m[1]), int(m[2])) for m in re.findall(r"^\| (S\d\d) \|[^\n]*?\[(\d+), (\d+)\)", sec1, re.M)}
check("C15a", rows == segr, "正文 §1 段落表与 JSON segments 一致", str(set(rows.items()) ^ set(segr.items())))
rows = {m[0]: (int(m[1]), int(m[2])) for m in re.findall(r"^\| (S\d\d-[a-z]) \|[^\n]*?\[(\d+), (\d+)\)", sec2.split("### 2.2")[0], re.M)}
check("C15b", rows == beatr, "正文 §2.1 节拍表与 JSON beats 一致", str(sorted(set(rows.items()) ^ set(beatr.items()))[:6]))
rows = {m[0]: (int(m[1]), int(m[2])) for m in re.findall(r"^\| ([①②③④⑤]) \|.*?\| \[(\d+), (\d+)\) \| \d:\d\d", text, re.M)}
check("C15c", rows == {c["id"]: (c["start"], c["end"]) for c in CARDS}, "正文字卡表与 JSON cards 一致", str(rows))
bad = []
for a, z, ta, tz in re.findall(r"\[(\d+), (\d+)\) \| (\d:\d\d\.\d\d)–(\d:\d\d\.\d\d)", text):
    if (tc(int(a)), tc(int(z))) != (ta, tz): bad.append(f"[{a},{z}) 写作 {ta}–{tz}")
for f, t2 in re.findall(r"\| f(\d+) \| (\d:\d\d\.\d\d) \|", text):
    if tc(int(f)) != t2: bad.append(f"f{f} 写作 {t2}")
n = len(re.findall(r"\[(\d+), (\d+)\) \| (\d:\d\d\.\d\d)–", text)) + len(re.findall(r"\| f(\d+) \| (\d:\d\d\.\d\d) \|", text))
check("C15d", not bad, f"正文表格中 {n} 处“帧号 ↔ 时码”换算全部正确", "; ".join(bad[:6]))
m = re.search(r"<!-- gen:rate -->(.*?)<!-- /gen:rate -->", text, re.S)
rows = [(int(a), int(z)) for a, z in re.findall(r"^\| \[(\d+), (\d+)\)", m.group(1), re.M)] if m else []
check("C15e", rows == [(e["start"], e["end"]) for e in RT], "正文 §1.2 推进速率表与 JSON camera_rate 一致", str(rows[:3]))

print(f"\n合计：PASS {res['PASS']}，FAIL {res['FAIL']}，WARN {res['WARN']}")
sys.exit(1 if res["FAIL"] else 0)
