# -*- coding: utf-8 -*-
"""生成离线图片浏览器（单个 HTML + 数据 js，双击即可按分类检索全站素材）"""
import os, json, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "_index")
OUT_HTML = os.path.join(ROOT, "浏览.html")
OUT_DATA = os.path.join(ROOT, "_index", "data.js")

MODULE_LABEL = {
    "appearance": "外观图鉴", "item": "道具图鉴", "cash": "商城图鉴",
    "map": "地图图鉴", "npc": "NPC图鉴", "skill": "技能图鉴",
    "mob": "怪物图鉴", "pet": "宠物图鉴",
    "extra": "补充素材",
}

IMG_EXT = (".png", ".webp", ".jpg", ".jpeg", ".gif")

# WZ String.wz 名称表 (fetch_wz_strings.py 生成)
_NAMES_PATH = os.path.join(IDX, "wz_names.json")
try:
    NAMES = json.load(open(_NAMES_PATH, encoding="utf-8"))
except Exception:
    NAMES = {}


def lookup_name(gid):
    k = str(gid)
    return NAMES.get(k) or NAMES.get(k.lstrip("0")) or ""


def scan_extra(used):
    """把本地存在、但没有对应元数据记录的图片也纳入检索。

    覆盖两类：原站 dbsource 图标散图、WZ 直抽但主站索引里没有的装备图。
    """
    out = []
    for sub in ("dbsource", "wz_preview"):
        base = os.path.join(ROOT, sub)
        if not os.path.isdir(base):
            continue
        for r, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d != "_cache"]
            for f in files:
                if not f.lower().endswith(IMG_EXT):
                    continue
                full = os.path.join(r, f)
                rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                if rel in used:
                    continue
                used.add(rel)
                gid = os.path.splitext(f)[0]
                reldir = os.path.relpath(r, ROOT).replace(os.sep, "/")
                if sub == "wz_preview":
                    cat = os.path.basename(r)
                elif reldir.endswith("icon/item"):
                    cat = "道具图标"
                else:
                    cat = reldir.split("/")[-1] or sub
                name = lookup_name(gid) or gid
                out.append({"m": "extra", "c": cat, "i": gid, "n": name, "p": rel})
    return out


def main():
    recs = []
    seen = set()
    with open(os.path.join(IDX, "all_records.jsonl"), encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            key = (r["module"], r["category"], r["id"])
            if key in seen:
                continue
            seen.add(key)
            img = r.get("preview") or r.get("icon") or ""
            local = None
            if img:
                cand = img.split("?")[0].lstrip("/")
                if os.path.exists(os.path.join(ROOT, cand.replace("/", os.sep))):
                    local = cand
            # 回退: WZ 直抽的缩略图(绕开被封主站), 覆盖所有已抽取的外观分类
            if local is None and r.get("module") == "appearance":
                wp = f"wz_preview/{r['category']}/{r['id']}.png"
                if os.path.exists(os.path.join(ROOT, wp)):
                    local = wp
            if not local:
                continue
            nm = r["name"] or lookup_name(r["id"])
            recs.append({"m": r["module"], "c": r["category"], "i": r["id"],
                         "n": nm, "p": local})

    used = set(x["p"] for x in recs)
    extra = scan_extra(used)
    recs.extend(extra)
    print(f"元数据记录 {len(recs)-len(extra):,} 条 + 本地散图 {len(extra):,} 张 "
          f"(名称表 {len(NAMES):,} 项)")

    cats = Counter((r["m"], r["c"]) for r in recs)
    stat = [{"m": m, "c": c, "n": n} for (m, c), n in sorted(cats.items(), key=lambda x: -x[1])]
    payload = json.dumps({"items": recs, "cats": stat}, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_DATA, "w", encoding="utf-8") as f:
        f.write("window.MXD_DATA=" + payload + ";")

    html = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>冒险岛素材库 · 本地索引</title>
<style>
:root{--bg:#16181d;--panel:#1e2128;--line:#2e323c;--fg:#e6e8ee;--dim:#9aa2b1;--acc:#f07b3f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 "Microsoft YaHei",system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:rgba(22,24,29,.96);border-bottom:1px solid var(--line);padding:12px 18px;backdrop-filter:blur(6px)}
h1{margin:0 0 10px;font-size:17px;font-weight:600}
h1 span{color:var(--acc)}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input,select{background:var(--panel);border:1px solid var(--line);color:var(--fg);border-radius:6px;padding:7px 10px;font-size:13px;outline:none}
input{flex:1;min-width:220px}
input:focus,select:focus{border-color:var(--acc)}
#count{color:var(--dim);font-size:12px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;padding:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;text-align:center;transition:.15s}
.card:hover{border-color:var(--acc);transform:translateY(-2px)}
.thumb{height:92px;display:flex;align-items:center;justify-content:center;background:
linear-gradient(45deg,#24272f 25%,transparent 25%),linear-gradient(-45deg,#24272f 25%,transparent 25%),
linear-gradient(45deg,transparent 75%,#24272f 75%),linear-gradient(-45deg,transparent 75%,#24272f 75%);
background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0}
.thumb img{max-width:88px;max-height:84px;image-rendering:pixelated}
.name{font-size:11px;color:var(--dim);padding:4px 5px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#more{display:block;margin:0 auto 30px;padding:9px 26px;background:var(--panel);border:1px solid var(--line);color:var(--fg);border-radius:6px;cursor:pointer}
#more:hover{border-color:var(--acc)}
.mono{font-family:Consolas,monospace;color:#7b8496;font-size:10px}
</style></head><body>
<header>
<h1>冒险岛素材库 · 本地索引 <span id="total"></span></h1>
<div class="bar">
  <input id="q" placeholder="搜索名称或 ID（支持中文/数字）">
  <select id="cat"><option value="">全部分类</option></select>
  <span id="count"></span>
</div>
</header>
<div id="grid"></div>
<button id="more">加载更多</button>
<script src="_index/data.js"></script>
<script>
var D=window.MXD_DATA.items||[], CATS=window.MXD_DATA.cats||[];
var shown=0, filtered=[], PAGE=200;
document.getElementById('total').textContent=D.length.toLocaleString()+' 张';
var sel=document.getElementById('cat');
CATS.forEach(function(c){
  var o=document.createElement('option');
  o.value=c.m+'|'+c.c;
  var pre=(c.m==='extra')?'补充·':'';
  o.textContent=c.c? (pre+c.c+' ('+c.n+')') : (pre+c.m+' ('+c.n+')');
  sel.appendChild(o);
});
function apply(){
  var q=document.getElementById('q').value.trim().toLowerCase();
  var cf=sel.value;
  filtered=D.filter(function(r){
    if(cf && (r.m+'|'+r.c)!==cf) return false;
    if(!q) return true;
    return (r.n&&r.n.toLowerCase().indexOf(q)>=0)||String(r.i).indexOf(q)>=0;
  });
  document.getElementById('count').textContent='匹配 '+filtered.length.toLocaleString()+' 条';
  document.getElementById('grid').innerHTML='';
  shown=0; paint();
}
function paint(){
  var g=document.getElementById('grid'), frag=document.createDocumentFragment();
  var end=Math.min(shown+PAGE,filtered.length);
  for(var i=shown;i<end;i++){
    var r=filtered[i], d=document.createElement('div'); d.className='card';
    d.innerHTML='<div class="thumb"><img loading="lazy" src="'+r.p+'" alt=""></div>'+
      '<div class="name" title="'+r.n+'">'+r.n+'</div>'+
      '<div class="name mono">'+r.i+'</div>';
    frag.appendChild(d);
  }
  g.appendChild(frag); shown=end;
  document.getElementById('more').style.display = shown<filtered.length?'block':'none';
}
document.getElementById('more').onclick=paint;
var t; document.getElementById('q').oninput=function(){clearTimeout(t);t=setTimeout(apply,220);};
sel.onchange=apply;
apply();
</script></body></html>"""
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{len(recs)} 条已入浏览页 -> {OUT_HTML}")
    print(f"数据 {os.path.getsize(OUT_DATA)/1048576:.1f}MB")


if __name__ == "__main__":
    main()
