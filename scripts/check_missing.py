# -*- coding: utf-8 -*-
"""诊断 Face/Hair 抽取的最终剩余状态: 哪些有图, 哪些是404, 哪些是结构性无默认帧, 哪些还能抢救"""
import os, json, requests
from collections import Counter

WZ = "https://mxdwzapi.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "wz_preview", "_cache")
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0", "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})

targets = []
for line in open(IDX, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        r = json.loads(line)
    except Exception:
        continue
    if r.get("module") != "appearance" or r.get("category") not in ("Face", "Hair"):
        continue
    targets.append((r["category"], str(r["id"])))

have_png = [(c, g) for c, g in targets if os.path.exists(os.path.join(ROOT, "wz_preview", c, g + ".png"))]
marked = [(c, g) for c, g in targets
          if os.path.exists(os.path.join(CACHE, f"{c}_{g.zfill(8)}.404"))]
unmarked = [(c, g) for c, g in targets
            if not os.path.exists(os.path.join(ROOT, "wz_preview", c, g + ".png"))
            and not os.path.exists(os.path.join(CACHE, f"{c}_{g.zfill(8)}.404"))]

print(f"targets={len(targets)} have_png={len(have_png)} marked404={len(marked)} UNMARKED={len(unmarked)}")

# 对未标记样本做单线程分类
cls = Counter()
sample = unmarked[:50]
for cat, gid in sample:
    try:
        r = S.get(f"{WZ}/node/json/Character/{cat}/{gid.zfill(8)}.img?force_parse=true&simple=true", timeout=60)
    except Exception:
        cls["neterr"] += 1
        continue
    if r.status_code == 404:
        cls["http404"] += 1
    elif r.status_code == 200:
        try:
            d = r.json()
        except Exception:
            cls["jsonerr"] += 1
            continue
        fr = None
        for act in ("default", "stand1", "stand", "backDefault"):
            node = d.get(act)
            if isinstance(node, dict):
                f0 = node.get("0") if isinstance(node.get("0"), dict) else None
                if f0:
                    fr = "f0"
                    break
                if any(isinstance(v, dict) and "_outlink" in v for v in node.values()):
                    fr = "direct"
                    break
        cls["frame_ok" if fr else "no_std_frame"] += 1
    else:
        cls[f"http{r.status_code}"] += 1

print(f"sample {len(sample)} classified:", dict(cls))
print("first 20 UNMARKED:", unmarked[:20])
