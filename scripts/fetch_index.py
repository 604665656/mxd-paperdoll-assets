# -*- coding: utf-8 -*-
"""抓取冒险岛小册子全站元数据索引（列表 JSON），落盘 _index/raw/<key>/pageN.json"""
import json, os, sys, time, threading
import requests
from concurrent.futures import ThreadPoolExecutor

BASE = "https://mxd.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "_index", "raw")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

APPEARANCE_CATS = ["Skin", "Hair", "Face", "Cap", "Overall", "Coat", "Pants", "Cape", "Glove",
                   "Shoes", "Weapon", "CashWeapon", "Shield", "FaceAccessory", "EyeDecoration",
                   "Earrings", "Medal", "Effect", "DamageSkin", "RingEffect", "NecklaceEffect",
                   "BeltEffect", "NickTag", "NameTag", "ChatBalloon", "Pet", "PetEquip",
                   "Chair", "TamingMob", "Android"]

SIMPLE = {
    "item": "/api/item_list.php",
    "cash": "/api/cash-shop-list.php",
    "map": "/api/map-list.php",
    "npc": "/api/npc-list.php",
    "skill": "/api/skill-list.php",
    "mob": "/api/mob-list.php",
    "pet": "/api/pet_list.php",
}

lock = threading.Lock()
counter = {"done": 0, "fail": 0, "items": 0}


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Referer": BASE + "/", "Accept": "application/json,*/*"})
    return s


def fetch_page(sess, path, params, outfile, tries=4):
    if os.path.exists(outfile) and os.path.getsize(outfile) > 60:
        with lock:
            counter["done"] += 1
        return True
    p = dict(params)
    p["_legacy"] = 1
    for i in range(tries):
        try:
            r = sess.get(BASE + path, params=p, timeout=60)
            if r.status_code == 200:
                txt = r.text
                if txt.lstrip().startswith("{"):
                    os.makedirs(os.path.dirname(outfile), exist_ok=True)
                    tmp = outfile + ".tmp"
                    with open(tmp, "w", encoding="utf-8") as f:
                        f.write(txt)
                    os.replace(tmp, outfile)
                    with lock:
                        counter["done"] += 1
                    return True
            time.sleep(1.0 + i)
        except Exception:
            time.sleep(1.2 + i)
    with lock:
        counter["fail"] += 1
    return False


def norm(d):
    """统一 rows / items 两种结构"""
    if not isinstance(d, dict):
        return []
    rows = d.get("rows")
    if rows is None:
        rows = d.get("items") or []
    return rows


def meta_of(d):
    if not isinstance(d, dict):
        return 0, 0
    if "pages" in d:
        return int(d.get("total") or 0), int(d.get("pages") or 0)
    m = d.get("meta") or {}
    return int(m.get("total") or 0), int(m.get("totalPages") or 0)


def run_group(name, path, base_params, key):
    """先取第1页拿总页数，再并发抓剩余页"""
    sess = session()
    d0 = None
    for _ in range(3):
        try:
            p = dict(base_params); p["page"] = 1; p["page_size"] = 100; p["_legacy"] = 1
            r = sess.get(BASE + path, params=p, timeout=60)
            if r.status_code == 200 and r.text.lstrip().startswith("{"):
                d0 = r.json(); break
        except Exception:
            pass
        time.sleep(1.5)
    if d0 is None:
        print(f"[FAIL] {name} 首页失败")
        return
    total, pages = meta_of(d0)
    outdir = os.path.join(RAW, key)
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "page1.json"), "w", encoding="utf-8") as f:
        json.dump(d0, f, ensure_ascii=False)
    print(f"[{name}] total={total} pages={pages}")
    jobs = []
    for pg in range(2, pages + 1):
        params = dict(base_params); params["page"] = pg; params["page_size"] = 100
        jobs.append((path, params, os.path.join(outdir, f"page{pg}.json")))
    with ThreadPoolExecutor(max_workers=5) as ex:
        for path_, params_, out_ in jobs:
            ex.submit(fetch_page, session(), path_, params_, out_)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    os.makedirs(RAW, exist_ok=True)
    t0 = time.time()

    if which in ("all", "appearance"):
        for cat in APPEARANCE_CATS:
            run_group(f"外观:{cat}", "/api/appearance_list.php", {"category": cat}, "appearance_" + cat)

    if which in ("all", "simple"):
        for name, path in SIMPLE.items():
            run_group(name, path, {}, name)

    if which in SIMPLE:
        run_group(which, SIMPLE[which], {}, which)
    if which in APPEARANCE_CATS:
        run_group("外观:" + which, "/api/appearance_list.php", {"category": which}, "appearance_" + which)

    print(f"done={counter['done']} fail={counter['fail']} 用时{int(time.time()-t0)}s")


if __name__ == "__main__":
    main()
