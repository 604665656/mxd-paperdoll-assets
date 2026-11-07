# -*- coding: utf-8 -*-
"""把 _index/raw 下的分页 JSON 汇总成统一索引（JSONL + CSV）与图片清单"""
import json, os, csv, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "_index", "raw")
IDX = os.path.join(ROOT, "_index")


def fix(s):
    """修复 GBK/UTF-8 双重编码乱码"""
    if not isinstance(s, str) or not s:
        return s or ""
    try:
        r = s.encode("gbk").decode("utf-8")
        return r
    except Exception:
        return s


def rows_of(d):
    if not isinstance(d, dict):
        return []
    r = d.get("rows")
    return r if r is not None else (d.get("items") or [])


def pick_id(r):
    for k in ("itemid", "mobid", "npcid", "mapid", "skillID", "petid", "sn", "id"):
        if k in r and r[k] not in (None, ""):
            return str(r[k])
    return ""


def pick_name(r):
    for k in ("name", "mobname", "npcname", "mapName", "skillName"):
        if r.get(k):
            return fix(str(r[k]))
    return ""


def main():
    groups = sorted(os.listdir(RAW)) if os.path.isdir(RAW) else []
    manifest = []
    seen_img = set()
    stats = {}

    jl = open(os.path.join(IDX, "all_records.jsonl"), "w", encoding="utf-8")
    imgf = open(os.path.join(IDX, "images.txt"), "w", encoding="utf-8")

    total = 0
    for g in groups:
        files = sorted(glob.glob(os.path.join(RAW, g, "page*.json")),
                       key=lambda p: int("".join(c for c in os.path.basename(p) if c.isdigit()) or 0))
        cnt = 0
        for fp in files:
            try:
                d = json.load(open(fp, encoding="utf-8"))
            except Exception:
                continue
            for r in rows_of(d):
                if not isinstance(r, dict):
                    continue
                mod = g.split("_")[0]
                cat = g.split("_", 1)[1] if "_" in g else ""
                rec = {
                    "module": mod,
                    "category": cat,
                    "id": pick_id(r),
                    "name": pick_name(r),
                    "icon": r.get("icon") or "",
                    "preview": r.get("preview") or r.get("stand") or "",
                    "raw": r,
                }
                jl.write(json.dumps(rec, ensure_ascii=False) + "\n")
                cnt += 1
                for key in ("icon", "preview", "stand"):
                    u = r.get(key)
                    if isinstance(u, str) and u.startswith("/") and u not in seen_img:
                        seen_img.add(u)
                        imgf.write(u + "\n")
        stats[g] = cnt
        total += cnt
        print(f"{g}: {cnt} 条")

    jl.close()
    imgf.close()

    with open(os.path.join(IDX, "stats.json"), "w", encoding="utf-8") as f:
        json.dump({"total_records": total, "by_group": stats, "unique_images": len(seen_img)},
                  f, ensure_ascii=False, indent=2)
    print(f"\n合计 {total} 条, 去重图片 {len(seen_img)} 张")


if __name__ == "__main__":
    main()
