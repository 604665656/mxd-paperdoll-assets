# -*- coding: utf-8 -*-
"""导出冒险岛纸娃娃动作分镜：帧数据 JSON + 逐帧部件图 + 合成 PNG 序列 + GIF

用法:
  python anim_export.py male            # 男体型全部常用动作
  python anim_export.py female stand1,walk1
  python anim_export.py full male       # 身体+脸+发型 完整角色
"""
import os, io, json, time, sys
import requests
from PIL import Image

WZ = "https://mxdwzapi.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "animations")
CACHE = os.path.join(OUT, "_cache")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Referer": "https://mxd.dvg.cn/zhiwawa_v4/"})

ZORDER = {"body": 0, "bodyOld": 0, "cape": 1, "pants": 4, "mail": 5, "shoe": 3,
          "arm": 10, "shield": 11, "glove": 12, "armBelowHead": 15, "ear": 18,
          "head": 20, "face": 25, "hair": 30, "hairOverHead": 35, "cap": 40,
          "capOverHair": 45, "weapon": 50, "armOverHair": 60}

ACTIONS = ["stand1", "stand2", "walk1", "walk2", "alert", "jump", "prone",
           "swingO1", "swingO2", "swingO3", "swingT1", "swingT2", "swingT3",
           "swingP1", "swingP2", "swingOF", "swingTF", "swingPF",
           "heal", "ladder", "rope", "sit", "laugh", "sad", "angry",
           "blink", "hit", "die1", "fly", "crouch"]

BODIES = {"male": "Character/00002000.img", "female": "Character/00012000.img"}
PARTS = {"face": "Character/Face/00020000.img", "hair": "Character/Hair/00030000.img"}


def wz_json(path):
    for i in range(3):
        try:
            r = S.get(f"{WZ}/node/json/{path}?force_parse=true&simple=true", timeout=90)
            if r.status_code == 200:
                return r.json()
        except Exception:
            time.sleep(1 + i)
    return None


def wz_img(path):
    safe = path.replace("/", "_").replace(".img", "") + ".webp"
    lp = os.path.join(CACHE, safe)
    if os.path.exists(lp) and os.path.getsize(lp) > 0:
        try:
            return Image.open(lp).convert("RGBA")
        except Exception:
            pass
    for i in range(3):
        try:
            r = S.get(f"{WZ}/node/image/{path}?force_parse=true", timeout=45)
            if r.status_code == 200 and r.content:
                os.makedirs(CACHE, exist_ok=True)
                with open(lp, "wb") as f:
                    f.write(r.content)
                return Image.open(io.BytesIO(r.content)).convert("RGBA")
        except Exception:
            time.sleep(1 + i)
    return None


def collect_parts(frame, extra=None):
    """返回 [(z, outlink, ox, oy)]"""
    out = []
    for name, p in frame.items():
        if not isinstance(p, dict) or "_outlink" not in p:
            continue
        z = ZORDER.get(p.get("z") or name, 50 if name == "weapon" else 20)
        o = p.get("origin") or {}
        out.append((z, p["_outlink"], int(o.get("x", 0)), int(o.get("y", 0))))
    if extra:
        out.extend(extra)
    out.sort(key=lambda t: t[0])
    return out


def export(body_key, body_path, actions, extras=None):
    data = wz_json(body_path)
    if not data:
        print("  JSON 获取失败", body_key)
        return
    base = os.path.join(OUT, body_key)
    os.makedirs(base, exist_ok=True)
    meta = {}

    for act in actions:
        node = data.get(act)
        if not isinstance(node, dict):
            continue
        frames = sorted([k for k in node.keys() if k.isdigit()], key=int)
        fdir = os.path.join(base, act)
        os.makedirs(fdir, exist_ok=True)

        # pass1: 收集部件与包围盒
        plans, minx, miny, maxx, maxy = [], 10 ** 6, 10 ** 6, -10 ** 6, -10 ** 6
        for fn in frames:
            fr = node[fn]
            if not isinstance(fr, dict):
                continue
            parts = collect_parts(fr, extras)
            loaded = []
            for z, outlink, ox, oy in parts:
                sp = wz_img(outlink)
                if sp is None:
                    continue
                loaded.append((z, sp, -ox, -oy))
                minx = min(minx, -ox)
                miny = min(miny, -oy)
                maxx = max(maxx, -ox + sp.width)
                maxy = max(maxy, -oy + sp.height)
            plans.append((fn, loaded, int(fr.get("delay") or 100)))
        if not plans or maxx <= minx:
            continue

        pad = 4
        cw, ch = maxx - minx + pad * 2, maxy - miny + pad * 2
        ox_shift, oy_shift = -minx + pad, -miny + pad

        seq, delays = [], []
        for fn, loaded, delay in plans:
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            for z, sp, x, y in loaded:
                layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
                layer.paste(sp, (x + ox_shift, y + oy_shift), sp)
                canvas = Image.alpha_composite(canvas, layer)
            canvas.save(os.path.join(fdir, f"frame_{int(fn):02d}.png"))
            seq.append(canvas)
            delays.append(delay)

        if seq:
            seq[0].save(os.path.join(base, f"{act}.gif"), save_all=True,
                        append_images=seq[1:], duration=delays, loop=0, disposal=2)
            meta[act] = {"frames": len(seq), "delays": delays, "canvas": [cw, ch]}
            print(f"  {body_key}/{act}: {len(seq)}帧 {cw}x{ch}", flush=True)

    with open(os.path.join(base, "_frames.json"), "w", encoding="utf-8") as f:
        json.dump({"body": body_path, "actions": meta, "raw": data}, f, ensure_ascii=False)


def face_hair_extras():
    """为骨架动画叠加静态脸型与发型（取 stand1 第0帧的头部锚点）"""
    ext = []
    face = wz_json(PARTS["face"])
    hair = wz_json(PARTS["hair"])
    for src, name, z in ((face, "face", 25), (hair, "hair", 30)):
        if not src:
            continue
        node = src.get("default") or src.get("stand1") or {}
        fr = node.get("0") if isinstance(node, dict) else None
        if isinstance(fr, dict):
            for k, p in fr.items():
                if isinstance(p, dict) and "_outlink" in p:
                    o = p.get("origin") or {}
                    ext.append((z, p["_outlink"], int(o.get("x", 0)), int(o.get("y", 0))))
    return ext


def main():
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    mode = "body"
    if args and args[0] == "full":
        mode = "full"
        args = args[1:]
    which = args[0] if args else "male"
    acts = args[1].split(",") if len(args) > 1 else ACTIONS
    if which not in BODIES:
        print("unknown body", which); return
    extras = face_hair_extras() if mode == "full" else None
    key = which + ("_full" if mode == "full" else "")
    print(f"[{key}] {BODIES[which]} 动作{len(acts)}个", flush=True)
    export(key, BODIES[which], acts, extras)


if __name__ == "__main__":
    main()
