# -*- coding: utf-8 -*-
"""探测各外观分类在 WZ 中的真实目录名, 以及是否能出图。
对每个分类取若干样本 ID, 试多个候选目录名, 统计 200+可出帧 的成功数。
"""
import os, json, requests
from collections import defaultdict
from wz_preview import find_default_frame, composite

WZ = "https://mxdwzapi.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")
S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0", "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})

# 目标分类 -> 候选 WZ 目录名(按优先级)
CANDS = {
    "Cap": ["Cap"],
    "Coat": ["Coat"],
    "Overall": ["Longcoat", "Overall"],
    "Pants": ["Pants"],
    "Shoes": ["Shoes"],
    "Glove": ["Glove"],
    "Shield": ["Shield"],
    "Weapon": ["Weapon"],
    "CashWeapon": ["CashWeapon", "Weapon"],
    "Cape": ["Cape"],
    "Earrings": ["Earrings", "AccessoryEar"],
    "FaceAccessory": ["FaceAccessory", "AccessoryFace"],
    "EyeDecoration": ["EyeDecoration", "AccessoryEye"],
    "Medal": ["Medal"],
    "Skin": ["Skin"],
    "TamingMob": ["TamingMob"],
}

# 收集每类样本 id
bycat = defaultdict(list)
for line in open(IDX, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        r = json.loads(line)
    except Exception:
        continue
    if r.get("module") != "appearance":
        continue
    c = r.get("category")
    if c in CANDS:
        bycat[c].append(str(r["id"]))

def try_dir(cat, d, gid):
    """返回 (status, ok_frame_reason)"""
    try:
        r = S.get(f"{WZ}/node/json/Character/{d}/{gid.zfill(8)}.img?force_parse=true&simple=true", timeout=40)
    except Exception:
        return ("ERR", None)
    if r.status_code != 200:
        return (str(r.status_code), None)
    try:
        j = r.json()
    except Exception:
        return ("JERR", None)
    fr = find_default_frame(j)
    if not fr:
        return ("200-noframe", None)
    img = composite(fr)
    if img and img.width > 2 and img.height > 2:
        return ("200-OK", img.size)
    return ("200-compositefail", None)

for cat, ids in bycat.items():
    # 取最多 6 个样本(首/中/尾分散)
    n = len(ids)
    idxs = sorted(set([0, n // 2, n - 1, min(1, n - 1), max(0, n - 2), min(n - 1, n // 3)]))
    samples = [ids[i] for i in idxs][:6]
    print(f"\n=== {cat} (共{n}个) 样本={samples}")
    for d in CANDS[cat]:
        okc = 0
        reasons = []
        for g in samples:
            st, sz = try_dir(cat, d, g)
            if st == "200-OK":
                okc += 1
                reasons.append(f"{g}:OK{sz}")
            else:
                reasons.append(f"{g}:{st}")
        print(f"   dir={d:12s} OK={okc}/{len(samples)}  {reasons}")
