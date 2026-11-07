# -*- coding: utf-8 -*-
"""生成分类统计报告: 每类目标数/已抽取/覆盖率/ID区间/缺失清单。
输出 素材库报告.html (可离线打开)。"""
import os, json, html, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index", "all_records.jsonl")
CACHE = os.path.join(ROOT, "wz_preview", "_cache")
WP = os.path.join(ROOT, "wz_preview")
OUT = os.path.join(ROOT, "素材库报告.html")

# WZ 直抽托管(或图标)的分类
WZ_HOSTED = ["Face", "Hair", "Cap", "Coat", "Overall", "Pants", "Shoes",
             "Glove", "Shield", "Weapon", "Cape", "TamingMob", "Android", "PetEquip"]
CAT_LABEL = {
    "Face": "脸型", "Hair": "发型", "Cap": "帽子", "Coat": "上衣", "Overall": "套服",
    "Pants": "裤", "Shoes": "鞋", "Glove": "手套", "Shield": "盾", "Weapon": "武器",
    "Cape": "披风", "TamingMob": "骑宠", "Android": "机器人", "PetEquip": "宠物装备",
    "Chair": "椅子", "Pet": "宠物", "Effect": "效果", "DamageSkin": "伤害皮肤",
    "ChatBalloon": "聊天气泡", "NameTag": "称谓", "NickTag": "名牌",
    "Medal": "勋章", "Earrings": "耳环", "EyeDecoration": "眼饰",
    "FaceAccessory": "脸饰", "Skin": "皮肤", "CashWeapon": "现金武器",
    "BeltEffect": "腰带效果", "NecklaceEffect": "项链效果", "RingEffect": "戒指效果",
}

def local_exists(p):
    if not p:
        return False
    p = p.split("?")[0].lstrip("/")
    return os.path.exists(os.path.join(ROOT, p.replace("/", os.sep)))

# 汇总
data = {}  # cat -> list of (id, name, preview, icon)
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
    data.setdefault(r["category"], []).append(
        (str(r["id"]), r.get("name", ""), r.get("preview", ""), r.get("icon", "")))

rows = []
for cat, recs in data.items():
    total = len(recs)
    ids = [x[0] for x in recs]
    wz_png = sum(1 for i, *_ in recs if os.path.exists(os.path.join(WP, cat, i + ".png")))
    ds = sum(1 for i, n, pv, ic in recs
             if (not os.path.exists(os.path.join(WP, cat, i + ".png")))
             and (local_exists(pv) or local_exists(ic)))
    have = wz_png + ds
    m404 = len(glob.glob(os.path.join(CACHE, f"{cat}_*.404")))
    mempty = len(glob.glob(os.path.join(CACHE, f"{cat}_*.empty")))
    try:
        idlo, idhi = min(ids), max(ids)
    except Exception:
        idlo = idhi = "-"
    # 缺失 = 无 wz png 且 无 dbsource
    miss = [i for i, n, pv, ic in recs
            if not os.path.exists(os.path.join(WP, cat, i + ".png"))
            and not local_exists(pv) and not local_exists(ic)]
    rows.append({
        "cat": cat, "label": CAT_LABEL.get(cat, cat), "total": total,
        "wz": wz_png, "ds": ds, "have": have, "cov": (have / total if total else 0),
        "m404": m404, "mempty": mempty, "idlo": idlo, "idhi": idhi,
        "miss": miss, "hosted": cat in WZ_HOSTED,
    })

rows.sort(key=lambda x: -x["total"])
grand_total = sum(r["total"] for r in rows)
grand_have = sum(r["have"] for r in rows)

# 全局数据（浏览器索引 + WZ 名称表）
viewer_total = 0
names_total = 0
try:
    _s = open(os.path.join(ROOT, "_index", "data.js"), encoding="utf-8").read()
    viewer_total = len(json.loads(_s[_s.index("=") + 1:_s.rstrip().rstrip(";")])["items"])
except Exception:
    pass
try:
    names_total = len(json.load(open(os.path.join(ROOT, "_index", "wz_names.json"), encoding="utf-8")))
except Exception:
    pass

def pct(x):
    return f"{x*100:.1f}%"

trs = []
for r in rows:
    cls = "" if r["cov"] > 0.9 else ("warn" if r["cov"] > 0 else "off")
    note = ""
    if r["hosted"]:
        note = f"404:{r['m404']} 空:{r['mempty']}"
    else:
        note = "源站未托管" if r["wz"] == 0 else ""
    trs.append(
        f"<tr class='{cls}'><td>{r['cat']}<br><span class='sub'>{html.escape(r['label'])}</span></td>"
        f"<td class='num'>{r['total']:,}</td><td class='num'>{r['wz']:,}</td>"
        f"<td class='num'>{r['ds']:,}</td><td class='num'>{r['have']:,}</td>"
        f"<td class='num'>{pct(r['cov'])}</td>"
        f"<td class='sub'>{r['idlo']} ~ {r['idhi']}</td><td class='sub'>{note}</td></tr>")

# 缺失明细(仅 WZ 托管且缺失<=600 的展示)
det = []
for r in rows:
    if not r["hosted"] or not r["miss"]:
        continue
    if len(r["miss"]) > 800:
        continue
    ids_txt = ", ".join(r["miss"])
    det.append(f"<details><summary>{r['cat']} {html.escape(r['label'])} — 缺失 {len(r['miss'])} 个</summary>"
               f"<div class='ids'>{ids_txt}</div></details>")

html_doc = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>冒险岛素材库 · 统计报告</title>
<style>
:root{{--bg:#16181d;--panel:#1e2128;--line:#2e323c;--fg:#e6e8ee;--dim:#9aa2b1;--acc:#f07b3f;--ok:#4caf7d}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif;padding:28px}}
h1{{font-size:20px;margin:0 0 4px}} h1 span{{color:var(--acc)}}
.meta{{color:var(--dim);font-size:12px;margin-bottom:20px}}
.cards{{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 18px;min-width:150px}}
.card b{{display:block;font-size:24px;color:var(--acc)}} .card span{{color:var(--dim);font-size:12px}}
table{{width:100%;border-collapse:collapse;background:var(--panel);border-radius:8px;overflow:hidden}}
th,td{{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}}
th{{background:#24272f;color:var(--dim);font-weight:600;font-size:12px}}
td.num{{text-align:right;font-variant-numeric:tabular-nums}}
.sub{{color:var(--dim);font-size:11px}}
tr.warn td{{color:#e0c56b}} tr.off td{{color:#8a7f7f}}
tr:hover td{{background:#22262e}}
h2{{font-size:15px;margin:26px 0 10px;color:var(--fg)}}
details{{background:var(--panel);border:1px solid var(--line);border-radius:6px;margin:6px 0;padding:8px 12px}}
summary{{cursor:pointer;color:var(--dim)}} summary:hover{{color:var(--acc)}}
.ids{{font-family:Consolas,monospace;font-size:11px;color:#7b8496;margin-top:6px;word-break:break-all}}
</style></head><body>
<h1>冒险岛素材库 · <span>本地统计报告</span></h1>
<div class="meta">数据源: mxdwzapi.dvg.cn WZ node 接口(主站 mxd.dvg.cn 被 WAF 封锁) · 生成于本机离线副本</div>
<div class="cards">
<div class="card"><b>{grand_total:,}</b><span>外观条目总数</span></div>
<div class="card"><b>{grand_have:,}</b><span>本地已有图片</span></div>
<div class="card"><b>{pct(grand_have/grand_total if grand_total else 0)}</b><span>总覆盖率</span></div>
<div class="card"><b>{sum(1 for r in rows if r['hosted'])}</b><span>WZ 直抽分类</span></div>
<div class="card"><b>{viewer_total:,}</b><span>浏览器可检索条目</span></div>
<div class="card"><b>{names_total:,}</b><span>WZ ID→名称映射</span></div>
</div>
<table><thead><tr>
<th>分类</th><th>总条目</th><th>WZ直抽</th><th>dbsource</th><th>本地已有</th><th>覆盖率</th><th>ID 区间</th><th>缺失</th>
</tr></thead><tbody>
{''.join(trs)}
</tbody></table>
<h2>缺失明细（WZ 直抽分类，点击展开）</h2>
{''.join(det) if det else '<div class="sub">无（或缺失过多未展开）</div>'}
<div class="meta" style="margin-top:24px">说明：本表只统计<b>外观图鉴</b>（63,523 条主站记录）；浏览器另有道具图标与 WZ 补充散图，故「浏览器可检索条目」大于本表总数。<br>
WZ直抽=从开放 WZ 接口抽的缩略图；dbsource=封锁前从主站下载的图；缺失中的 404=源站无此 ID，空=仅有 1×1 占位无美术。非托管分类(椅子/宠物/效果等)此接口不提供精灵图。<br>
ID→名称映射来自 WZ <code>String.wz</code>（Consume / Eqp / Cash / Etc / Ins / Pet / Mob / Npc / Skill），用于补齐主站 item 列表未抓完的部分。</div>
</body></html>"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html_doc)
print(f"报告已生成: {OUT}")
print(f"总条目 {grand_total:,}  本地已有 {grand_have:,}  覆盖率 {pct(grand_have/grand_total if grand_total else 0)}")
for r in rows[:8]:
    print(f"  {r['cat']:14s} total={r['total']:,} have={r['have']:,} cov={pct(r['cov'])}")
