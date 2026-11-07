# -*- coding: utf-8 -*-
"""从开放 WZ API 抓取 String.wz 名称表，生成 ID -> 名称 映射。

主站 mxd.dvg.cn 的 item 列表 API 只抓到 252/1232 页，道具名称大量缺失。
mxdwzapi.dvg.cn 的 String/*.img 提供官方 ID->name，可离线补齐。
支持断点续传与 503 退避重试。
"""
import os, json, time, sys
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index")
OUT = os.path.join(IDX, "wz_strings")
BASE = "https://mxdwzapi.dvg.cn/node/json/"

# 只取对素材检索有意义的表
TABLES = ["Consume", "Cash", "Etc", "Eqp", "Ins", "Pet",
          "Mob", "Npc", "Map", "Skill", "MonsterBook"]

_sess = None


def session():
    global _sess
    if _sess is None:
        _sess = requests.Session()
        _sess.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        })
    return _sess


def fetch_table(name, tries=5):
    out = os.path.join(OUT, name + ".json")
    if os.path.exists(out) and os.path.getsize(out) > 100:
        try:
            return json.load(open(out, encoding="utf-8"))
        except Exception:
            pass
    for i in range(tries):
        try:
            r = session().get(
                BASE + "String/" + name + ".img",
                params={"force_parse": "true", "simple": "true"},
                timeout=180,
            )
            if r.status_code == 200:
                d = r.json()
                if not isinstance(d, dict):
                    raise ValueError("not a dict")
                tmp = out + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(d, f, ensure_ascii=False)
                os.replace(tmp, out)
                print(f"  {name}: 200, {len(d)} 顶层节点, "
                      f"{os.path.getsize(out)/1048576:.1f}MB", flush=True)
                return d
            print(f"  {name}: HTTP {r.status_code}, 重试 {i+1}/{tries}", flush=True)
        except Exception as e:
            print(f"  {name}: {type(e).__name__} {str(e)[:80]}, "
                  f"重试 {i+1}/{tries}", flush=True)
        time.sleep(min(2 ** i, 20))
    return None


def collect_names(node, out):
    """递归收集形如 {<数字ID>: {name: '...'}} 的叶子。"""
    if not isinstance(node, dict):
        return
    for k, v in node.items():
        if not isinstance(v, dict):
            continue
        nm = v.get("name")
        if isinstance(nm, str) and nm and str(k).lstrip("0").isdigit():
            out[str(int(k))] = nm
        else:
            collect_names(v, out)


def main():
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1:] or TABLES
    allnames = {}
    for t in which:
        print("抓取", t, flush=True)
        d = fetch_table(t)
        if d is None:
            print("  跳过（不可达）", flush=True)
            continue
        sub = {}
        collect_names(d, sub)
        print(f"  采集 {len(sub)} 个名称", flush=True)
        for k, v in sub.items():
            allnames.setdefault(k, v)

    merged = os.path.join(IDX, "wz_names.json")
    tmp = merged + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(allnames, f, ensure_ascii=False)
    os.replace(tmp, merged)
    print(f"\n合并 {len(allnames)} 个 ID->名称 -> {merged}")
    print("样例:", list(allnames.items())[:8])


if __name__ == "__main__":
    main()
