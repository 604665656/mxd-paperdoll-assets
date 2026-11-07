# -*- coding: utf-8 -*-
"""把剩余 UNMARKED 的 ID 按可抽取性分类, 只抢救真正能出图的(正常精灵), 跳过 1x1 canvas 脸/无默认帧。"""
import os, json
from wz_preview import wz_json, find_default_frame, wz_img, composite, WZCAT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")
CACHE = os.path.join(ROOT, "wz_preview", "_cache")

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

unmarked = [(c, g) for c, g in targets
            if not os.path.exists(os.path.join(ROOT, "wz_preview", c, g + ".png"))
            and not os.path.exists(os.path.join(CACHE, f"{c}_{g.zfill(8)}.404"))]

from collections import Counter
cls = Counter()
recoverable = []
for c, g in unmarked:
    cd = WZCAT[c][0]
    d = wz_json(cd, g.zfill(8))
    if not d:
        cls["no_json(404/err)"] += 1
        continue
    fr = find_default_frame(d)
    if not fr:
        cls["no_default_frame"] += 1
        continue
    # 看帧部件尺寸, 判断是否 1x1 canvas
    sizes = []
    for name, p in fr.items():
        if isinstance(p, dict) and "_outlink" in p:
            im = wz_img(p["_outlink"])
            if im:
                sizes.append(im.size)
    if not sizes:
        cls["no_loadable_sprite"] += 1
        continue
    w, h = sizes[0]
    if w <= 1 or h <= 1:
        cls["tiny_1x1_canvas"] += 1
        continue
    img = composite(fr)
    if img and img.width > 2 and img.height > 2:
        cls["recoverable_sprite"] += 1
        recoverable.append((c, g))
    else:
        cls["composite_fail"] += 1

print("UNMARKED total:", len(unmarked))
print("classification:", dict(cls))
print("recoverable count:", len(recoverable), recoverable[:20])

# 抢救可抽取的
from wz_preview import one, stat, lock
for c, g in recoverable:
    one(c, WZCAT[c][0], g)
with lock:
    print(f"recovered ok={stat['ok']} fail={stat['fail']}")
