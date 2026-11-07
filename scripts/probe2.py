# -*- coding: utf-8 -*-
"""探测非穿戴类(椅子/宠物/伤害皮肤/效果/称谓等)的真实 WZ 全路径。
这些不在 Character/<分类> 下, 试多种全路径模板。"""
import os, json, requests
from collections import defaultdict
from wz_preview import find_default_frame, composite

WZ = "https://mxdwzapi.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")
S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0", "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})

# 分类 -> 候选全路径模板(不含 .img 前缀斜杠), {id8}=8位补零, {id}=原样
CANDS = {
    "Chair": ["Item/Install/{id8}.img", "Character/Chair/{id8}.img"],
    "Pet": ["Item/Pet/{id8}.img", "Character/Pet/{id8}.img", "Pet/{id8}.img"],
    "PetEquip": ["Item/PetEquip/{id8}.img", "Character/PetEquip/{id8}.img"],
    "Android": ["Character/Android/{id8}.img", "Character/{id8}.img"],
    "Effect": ["Effect/{id8}.img", "Character/Effect/{id8}.img"],
    "DamageSkin": ["Effect/DamageSkin/{id8}.img", "UI/DamageSkin/{id8}.img", "DamageSkin/{id8}.img"],
    "ChatBalloon": ["UI/ChatBalloon/{id8}.img", "Effect/ChatBalloon/{id8}.img"],
    "NameTag": ["UI/NameTag/{id8}.img", "Character/NameTag/{id8}.img"],
    "NickTag": ["UI/NickTag/{id8}.img", "Character/NickTag/{id8}.img"],
    "BeltEffect": ["Character/BeltEffect/{id8}.img", "Effect/BeltEffect/{id8}.img"],
    "NecklaceEffect": ["Character/NecklaceEffect/{id8}.img", "Effect/NecklaceEffect/{id8}.img"],
    "RingEffect": ["Character/RingEffect/{id8}.img", "Effect/RingEffect/{id8}.img"],
}

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

def try_path(tpl, gid):
    path = tpl.format(id8=gid.zfill(8), id=gid)
    try:
        r = S.get(f"{WZ}/node/json/{path}?force_parse=true&simple=true", timeout=40)
    except Exception:
        return "ERR", None
    if r.status_code != 200:
        return str(r.status_code), None
    try:
        j = r.json()
    except Exception:
        return "JERR", None
    fr = find_default_frame(j)
    if not fr:
        return "200-noframe", None
    img = composite(fr)
    if img and img.width > 2 and img.height > 2:
        return "OK", img.size
    return "200-compositefail", None

for cat, ids in bycat.items():
    n = len(ids)
    idxs = sorted(set([0, n // 2, n - 1, min(1, n - 1), max(0, n - 2)]))
    samples = [ids[i] for i in idxs][:5]
    print(f"\n=== {cat} (共{n}) 样本={samples}")
    for tpl in CANDS[cat]:
        okc = 0
        reasons = []
        for g in samples:
            st, sz = try_path(tpl, g)
            if st == "OK":
                okc += 1
            reasons.append(f"{g}:{st}")
        print(f"   {tpl:34s} OK={okc}/{len(samples)} {reasons}")
