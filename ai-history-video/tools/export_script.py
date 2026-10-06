"""把 avgen/script.py 中的解说词导出为 Markdown 文稿（docs/解说词.md）。"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from avgen.script import SCENES  # noqa: E402

out = ["# 《人工智能简史》解说词", "", "> 由 `tools/export_script.py` 从 `avgen/script.py` 自动导出。", ""]
for sc in SCENES:
    k = sc["kind"]
    if k == "title":
        out += ["## 序章", ""]
    elif k == "chapter":
        out += [f"## {sc['num']} · {sc['title']}（{sc['years']}）", ""]
        continue
    elif k == "event":
        out += [f"### {sc['year']} · {sc['title']}", ""]
    elif k == "quote":
        out += [f"> “{sc['text']}”", f"> —— {sc['author']}", ""]
    elif k == "reflection":
        out += ["### 回望", ""]
    elif k == "outro":
        out += ["## 尾声", ""]
    out += ["".join(sc["lines"]), ""]
path = os.path.join(ROOT, "docs", "解说词.md")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print(path, sum(len(l) for s in SCENES for l in s["lines"]), "字")
