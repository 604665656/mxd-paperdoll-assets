# -*- coding: utf-8 -*-
"""抽取 Android / PetEquip 的物品图标(info.icon)作为缩略图。
这两类 WZ 节点只有 info 元数据, 没有身体/装备帧, 用 info.icon 出图。"""
import os, json, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from wz_preview import wz_json, composite, is_good_png, OUT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")
CATS = ["Android", "PetEquip"]
WORKERS = int(os.environ.get("WORKERS", "5"))
DELAY = float(os.environ.get("DELAY", "0.1"))

lock = threading.Lock()
stat = {"ok": 0, "skip": 0, "fail": 0, "noicon": 0}


def one(cat, gid):
    out = os.path.join(OUT, cat, gid + ".png")
    if is_good_png(out):
        with lock:
            stat["skip"] += 1
        return
    d = wz_json(cat, gid.zfill(8))   # 目录名与分类名一致
    if not d:
        with lock:
            stat["fail"] += 1
        return
    icon = (d.get("info") or {}).get("icon")
    if not isinstance(icon, dict) or "_outlink" not in icon:
        with lock:
            stat["noicon"] += 1
        return
    img = composite({"icon": icon})
    if not img:
        with lock:
            stat["fail"] += 1
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".tmp"
    img.save(tmp, "PNG")
    os.replace(tmp, out)
    with lock:
        stat["ok"] += 1
    time.sleep(DELAY)


def main():
    targets, seen = [], set()
    for line in open(IDX, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except Exception:
            continue
        if r.get("module") != "appearance" or r.get("category") not in CATS:
            continue
        k = (r["category"], str(r["id"]))
        if k in seen:
            continue
        seen.add(k)
        targets.append(k)
    print(f"待抽取 {len(targets)} 个 (图标)", flush=True)
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(one, c, g) for c, g in targets]
        for _ in as_completed(futs):
            pass
    print(f"完成 ok={stat['ok']} skip={stat['skip']} fail={stat['fail']} noicon={stat['noicon']}", flush=True)


if __name__ == "__main__":
    main()
