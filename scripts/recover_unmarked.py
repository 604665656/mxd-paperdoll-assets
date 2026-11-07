# -*- coding: utf-8 -*-
"""只针对 UNMARKED(无PNG且无404标记)的 ID 重新抽取, 复用 wz_preview 的 one()。
复用 one() 会自动跳过已有PNG, 只对这少量 ID 做解码/抓取, 速度快。"""
import os, json
from wz_preview import one, WZCAT, stat, lock

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

print(f"UNMARKED to (re)try: {len(unmarked)}", flush=True)
for c, g in unmarked:
    one(c, WZCAT[c][0], g)

with lock:
    print(f"DONE ok={stat['ok']} skip={stat['skip']} fail={stat['fail']}", flush=True)
