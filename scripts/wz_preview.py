# -*- coding: utf-8 -*-
"""从开放 WZ 接口(mxdwzapi.dvg.cn,不受主站WAF封锁)抽取外观精灵，合成缩略PNG。
绕开被封的 mxd.dvg.cn /dbsource 图标。
用法: python wz_preview.py [Hair|Face|Skin|all]
特性: 断点续传(已合成的跳过), JSON 缓存(避免重复拉取), 礼貌限速
"""
import os, io, json, time, sys, threading
import requests
from PIL import Image

WZ = "https://mxdwzapi.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_index", "all_records.jsonl")
OUT = os.path.join(ROOT, "wz_preview")
CACHE = os.path.join(OUT, "_cache")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})

# 类别 -> (WZ子目录前缀, 是否补零8位). Hair/Face 已验证; 其余装备类经 probe_cats.py 探测确认。
WZCAT = {
    "Hair": ("Hair", True), "Face": ("Face", True),
    "Cap": ("Cap", True), "Coat": ("Coat", True), "Overall": ("Longcoat", True),
    "Pants": ("Pants", True), "Shoes": ("Shoes", True), "Glove": ("Glove", True),
    "Shield": ("Shield", True), "Weapon": ("Weapon", True), "Cape": ("Cape", True),
    "TamingMob": ("TamingMob", True),
}
WORKERS = int(os.environ.get("WORKERS", "4"))
DELAY = float(os.environ.get("DELAY", "0.08"))

ZORDER = {"body": 0, "bodyOld": 0, "cape": 1, "capeBelowBody": 1, "capeOverBody": 2,
          "pants": 4, "mail": 5, "coat": 5, "longcoat": 5, "shoe": 3,
          "arm": 10, "shield": 11, "glove": 12, "medal": 12, "armBelowHead": 15,
          "ear": 18, "earrings": 18, "head": 20, "face": 25, "hair": 30, "hairOverHead": 35,
          "cap": 40, "capOverHair": 45, "weapon": 50, "hairShade": 28, "backDefault": 1,
          "tamingMob": 1}

lock = threading.Lock()
stat = {"ok": 0, "skip": 0, "fail": 0, "bytes": 0}
tls = threading.local()


def sess():
    s = getattr(tls, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})
        tls.s = s
    return s


def wz_json(cat_dir, gid):
    fn = f"{cat_dir}_{gid}.json"
    lp = os.path.join(CACHE, fn)
    if os.path.exists(lp) and os.path.getsize(lp) > 0:
        try:
            return json.load(open(lp, encoding="utf-8"))
        except Exception:
            pass
    nf = os.path.join(CACHE, f"{cat_dir}_{gid}.404")
    ef = os.path.join(CACHE, f"{cat_dir}_{gid}.empty")
    if os.path.exists(nf) or os.path.exists(ef):   # 已知不存在/无图, 直接跳过, 不再联网
        return None
    for i in range(4):
        try:
            r = sess().get(f"{WZ}/node/json/Character/{cat_dir}/{gid}.img?force_parse=true&simple=true", timeout=90)
            if r.status_code == 200:
                d = r.json()
                os.makedirs(CACHE, exist_ok=True)
                with open(lp, "w", encoding="utf-8") as f:
                    json.dump(d, f, ensure_ascii=False)
                return d
            if r.status_code == 404:   # 永久缺失, 记负缓存
                open(nf, "w").close()
                return None
        except Exception:
            time.sleep(1 + i)
    return None


def wz_img(outlink):
    safe = outlink.replace("/", "_") + ".webp"
    lp = os.path.join(CACHE, safe)
    if os.path.exists(lp) and os.path.getsize(lp) > 0:
        try:
            return Image.open(lp).convert("RGBA")
        except Exception:
            pass
    for i in range(4):
        try:
            r = sess().get(f"{WZ}/node/image/{outlink}?force_parse=true", timeout=45)
            if r.status_code == 200 and r.content:
                os.makedirs(CACHE, exist_ok=True)
                with open(lp, "wb") as f:
                    f.write(r.content)
                return Image.open(io.BytesIO(r.content)).convert("RGBA")
        except Exception:
            time.sleep(1 + i)
    return None


def _frame_from_action(node):
    """从一个动作节点取出可用帧: 编号帧 / 容器(子节点含精灵) / 自身即精灵"""
    if not isinstance(node, dict):
        return None
    f0 = node.get("0") if isinstance(node.get("0"), dict) else None
    if f0:
        return f0
    if any(isinstance(v, dict) and "_outlink" in v for v in node.values()):
        return node
    if "_outlink" in node:
        return {"main": node}
    return None


def find_default_frame(d):
    """优先 default/站立动作; 兜底取表情帧(部分 50000+ 脸型只有表情, 无 default)"""
    for act in ("default", "stand1", "stand", "backDefault"):
        r = _frame_from_action(d.get(act))
        if r:
            return r
    priority = ("smile", "angry", "blink", "0")
    order = [k for k in priority if k in d] + \
            [k for k in d.keys() if k not in priority and k != "info"]
    for act in order:
        r = _frame_from_action(d.get(act))
        if r:
            return r
    return None


def composite(frame):
    # 若 frame 本身就是一个精灵(_outlink 直接是字符串值), 规范化为单层
    if isinstance(frame, dict) and isinstance(frame.get("_outlink"), str):
        frame = {"__sprite__": frame}
    parts = []
    for name, p in frame.items():
        if not isinstance(p, dict) or "_outlink" not in p:
            continue
        z = ZORDER.get(p.get("z") or name, 20 if name == "face" else (30 if name == "hair" else 25))
        o = p.get("origin") or {}
        parts.append((z, p["_outlink"], int(o.get("x", 0)), int(o.get("y", 0))))
    parts.sort(key=lambda t: t[0])
    loaded = []
    minx = miny = 10 ** 6; maxx = maxy = -10 ** 6
    for z, ol, ox, oy in parts:
        sp = wz_img(ol)
        if sp is None:
            continue
        loaded.append((z, sp, -ox, -oy))
        minx = min(minx, -ox); miny = min(miny, -oy)
        maxx = max(maxx, -ox + sp.width); maxy = max(maxy, -oy + sp.height)
    if not loaded or maxx <= minx:
        return None
    pad = 4
    cw, ch = maxx - minx + pad * 2, maxy - miny + pad * 2
    oxs, oys = -minx + pad, -miny + pad
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0,0))
    for z, sp, x, y in loaded:
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        layer.paste(sp, (x + oxs, y + oys), sp)
        canvas = Image.alpha_composite(canvas, layer)
    return canvas


def is_good_png(path):
    """存在且能完整解码才视为已完成; 损坏则删除以便重抽"""
    if not os.path.exists(path) or os.path.getsize(path) <= 0:
        return False
    try:
        with Image.open(path) as im:
            im.load()
        return True
    except Exception:
        try:
            os.remove(path)
        except Exception:
            pass
        return False


def one(cat, cat_dir, gid):
    out = os.path.join(OUT, cat, f"{gid}.png")
    if is_good_png(out):
        with lock:
            stat["skip"] += 1
        return
    d = wz_json(cat_dir, gid.zfill(8))
    if not d:
        with lock:
            stat["fail"] += 1
        return
    fr = find_default_frame(d)
    if not fr:
        with lock:
            stat["fail"] += 1
        return
    img = composite(fr)
    if not img:
        with lock:
            stat["fail"] += 1
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".tmp"
    img.save(tmp, "PNG")
    os.replace(tmp, out)  # 原子替换, 避免中断留下半截文件
    with lock:
        stat["ok"] += 1
        stat["bytes"] += os.path.getsize(out)
    time.sleep(DELAY)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which == "all":
        cats = list(WZCAT.keys())
    else:
        cats = [c.strip() for c in which.split(",") if c.strip() in WZCAT]
        if not cats:
            cats = list(WZCAT.keys())
    # 收集目标
    targets = []
    seen = set()
    for line in open(SRC, encoding="utf-8"):
        try:
            r = json.loads(line)
        except Exception:
            continue
        if r.get("module") != "appearance" or r.get("category") not in WZCAT:
            continue
        if r["category"] not in cats:
            continue
        key = (r["category"], r["id"])
        if key in seen:
            continue
        seen.add(key)
        targets.append((r["category"], WZCAT[r["category"]][0], r["id"]))
    print(f"待抽取 {len(targets)} 个 ({','.join(cats)})", flush=True)
    from concurrent.futures import ThreadPoolExecutor, as_completed
    done = 0; total = len(targets)
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(one, c, cd, g) for c, cd, g in targets]
        for _ in as_completed(futs):
            done += 1
            if done % 1000 == 0:
                print(f"  {done}/{total} ok={stat['ok']} skip={stat['skip']} "
                      f"fail={stat['fail']} {stat['bytes']/1048576:.0f}MB", flush=True)
    print(f"完成 ok={stat['ok']} skip={stat['skip']} fail={stat['fail']} "
          f"{stat['bytes']/1048576:.1f}MB", flush=True)


if __name__ == "__main__":
    main()
