# -*- coding: utf-8 -*-
"""组装可公开的 GitHub 仓库目录: 排除缓存/日志/临时文件, 生成 README/.gitignore/看板首页。
输出: 与 mxd_dump 平级的 mxd-gallery/ (可 git init 后直接推送, 并可作 GitHub Pages 根目录)。
"""
import os, json, shutil, html, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                    # mxd_dump
PUB = os.path.dirname(ROOT)                     # 工作区根
PUB = os.path.join(PUB, "mxd-gallery")
IDX = os.path.join(ROOT, "_index", "data.js")

IGNORE = shutil.ignore_patterns("_cache", "__pycache__", "*.log", "*.part",
                                "*.tmp", "*.404", "*.empty", ".DS_Store",
                                ".git", "*.pyc")

def copy_dir(src, dst, ignore=IGNORE):
    """增量同步: 已存在且大小/修改时间相同的文件直接跳过。"""
    if not os.path.isdir(src):
        return 0
    os.makedirs(dst, exist_ok=True)
    copied = 0
    for root, dirs, files in os.walk(src):
        skipped = set(ignore(root, dirs + files) or [])
        dirs[:] = [d for d in dirs if d not in skipped]
        files = [f for f in files if f not in skipped]
        rel = os.path.relpath(root, src)
        out = dst if rel == "." else os.path.join(dst, rel)
        os.makedirs(out, exist_ok=True)
        for f in files:
            s = os.path.join(root, f)
            d = os.path.join(out, f)
            try:
                if (os.path.exists(d)
                        and os.path.getsize(d) == os.path.getsize(s)
                        and abs(os.path.getmtime(d) - os.path.getmtime(s)) < 2):
                    continue
            except OSError:
                pass
            shutil.copy2(s, d)
            copied += 1
    n = 0
    for _, _, fs in os.walk(dst):
        n += len(fs)
    print(f"    (本次实际复制 {copied:,} 个新文件)", flush=True)
    return n

def copy_file(src, dst):
    if not os.path.exists(src):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    return True

print("发布目录:", PUB)
os.makedirs(PUB, exist_ok=True)

# 1) 缩略图(排除 _cache)
n_wz = copy_dir(os.path.join(ROOT, "wz_preview"), os.path.join(PUB, "wz_preview"))
print("wz_preview:", n_wz)

# 2) 原站图
n_ds = copy_dir(os.path.join(ROOT, "dbsource"), os.path.join(PUB, "dbsource"))
print("dbsource:", n_ds)

# 3) 编辑器 / 动画
for d in ("editor", "animations"):
    print(d + ":", copy_dir(os.path.join(ROOT, d), os.path.join(PUB, d)))

# 4) 数据: 浏览器 data.js + 统计/清单
os.makedirs(os.path.join(PUB, "_index"), exist_ok=True)
copy_file(IDX, os.path.join(PUB, "_index", "data.js"))
for f in ("stats.json", "images.txt", "wz_names.json"):
    p = os.path.join(ROOT, "_index", f)
    if os.path.exists(p) and os.path.getsize(p) < 20 * 1048576:
        copy_file(p, os.path.join(PUB, "_index", f))
# WZ String.wz 原始名称表(11 张表, 约 20MB)
print("wz_strings:", copy_dir(os.path.join(ROOT, "_index", "wz_strings"),
                              os.path.join(PUB, "_index", "wz_strings")))

# 5) 页面
for f in ("浏览.html", "素材库报告.html", "一键刷新.bat", "推送到GitHub.bat"):
    copy_file(os.path.join(ROOT, f), os.path.join(PUB, f))

# 6) 复现脚本
n_sc = copy_dir(os.path.join(ROOT, "_scripts"), os.path.join(PUB, "scripts"))
print("scripts:", n_sc)

# 7) .nojekyll (让 GitHub Pages 保留 _index 等下划线目录)
open(os.path.join(PUB, ".nojekyll"), "w").close()

# 8) .gitignore
git_ignore = """# 中间产物 / 缓存(体积巨大, 不入仓库)
wz_preview/_cache/
__pycache__/
*.pyc
*.log
*.part
*.tmp
*.404
*.empty
.ds_store
thumbs.db

# 下载器运行日志
_dbs_fetch.log
_wz_*.log
img_fail.txt
"""
with open(os.path.join(PUB, ".gitignore"), "w", encoding="utf-8") as f:
    f.write(git_ignore)

# 9) 统计(从 data.js 读取)
items = []
try:
    s = open(IDX, encoding="utf-8").read()
    j = s[s.index("=") + 1:s.rstrip().rstrip(";").rindex("}") + 1]
    items = json.loads(j)["items"]
except Exception as e:
    print("data.js 解析失败:", e)

from collections import Counter
cats = Counter(r["c"] for r in items)
total = len(items)
wz_cnt = sum(1 for r in items if r["p"].startswith("wz_preview/"))
ds_cnt = total - wz_cnt
n_cat = len(cats)
top = cats.most_common(14)
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

# 10) README.md
readme = f"""# 冒险岛纸娃娃素材库 · 离线索引

第三方纸娃娃站 (`mxd.dvg.cn/zhiwawa_v4/`) 的素材**本地离线副本**：可在无网络环境下按分类 / 名称 / ID 检索全部外观图，并附带可离线运行的纸娃娃编辑器与复现脚本。

## 在线访问（GitHub Pages）

- **公开看板**：`index.html` → `https://<用户名>.github.io/<仓库名>/`
- **素材浏览器**：`浏览.html`（按分类检索全部素材）
- **统计报告**：`素材库报告.html`（每类数量、ID 区间、缺失清单）

> 本地直接打开 `浏览.html` 亦可（图片路径均为相对路径）。

## 内容清单

| 目录 | 说明 |
|------|------|
| `wz_preview/<分类>/*.png` | 从开放 WZ 接口直抽合成的外观缩略图（脸型 / 发型 / 帽子 / 上衣 / 套服 / 裤 / 鞋 / 手套 / 盾 / 武器 / 披风 / 骑宠 / 机器人 / 宠物装备） |
| `dbsource/...` | 原站下载的图标与纸娃娃预览图（保持服务器原始目录结构） |
| `animations/` | 角色动作 GIF / PNG 序列 |
| `editor/` | 纸娃娃编辑器前端静态文件（`serve_editor.py` 可在本地起服务代理 API） |
| `_index/data.js` | 离线浏览器的数据索引（分类 / 名称 / ID / 相对图片路径） |
| `_index/wz_names.json`、`_index/wz_strings/` | 从 WZ `String.wz` 提取的 **15 万+ ID → 中文名称** 映射及 11 张原始表 |
| `scripts/` | 抓取、合成、统计、重建、一键刷新的全部复现脚本 |

当前索引条目：**{total:,}** 条（WZ 直抽 {wz_cnt:,} + 原站图 {ds_cnt:,}），覆盖 **{n_cat}** 个分类。
其中包含主站元数据记录与**本地散图补充**（道具图标、主站索引未收录的 WZ 装备图），散图名称由 WZ 名称表回填。

## 数据来源与构建

- 元数据与图片路径：`mxd.dvg.cn` 的 `_legacy=1` 列表接口。
- 外观缩略图：`mxdwzapi.dvg.cn` 的 WZ node 接口（`/node/json/...` + `/node/image/...`），按 z-order 与 origin 偏移做 alpha 合成。
- ID→名称：`mxdwzapi.dvg.cn/node/json/String/*.img`（Consume / Eqp / Cash / Etc / Ins / Pet / Mob / Npc / Skill 等），用于补齐主站 item 列表未抓完的名称。
- 主站曾触发阿里云 WAF 限流，下载器采用**断点续传 + 指数退避**，解封后自动续传。

复现步骤（需 Python 3 + `requests` / `Pillow`）：

```bash
python scripts/fetch_index.py          # 抓元数据(主站可用时)
python scripts/fetch_wz_strings.py     # WZ ID→名称表
python scripts/wz_preview.py all       # 直抽外观缩略图
python scripts/extract_icons.py        # 机器人/宠物装备图标
python scripts/build_viewer.py         # 重建 浏览.html
python scripts/make_report.py          # 重建统计报告
python scripts/refresh.py              # 一键刷新（含主站解封检测）
```

Windows 下可直接双击 `一键刷新.bat`。

## 免责声明

- 本站所收录的游戏素材、图标、人物形象等**著作权归 NEXON 及原权利人所有**，本站数据来自第三方公开站点，仅作**个人学习、研究与离线参考**用途，非商业用途。
- 如权利人认为内容不宜公开，请通过仓库 Issue 联系，将第一时间删除。
- 本仓库不包含任何账号、密钥或私有数据；`wz_preview/_cache/` 等中间缓存未纳入版本管理。

---
生成时间：{now}
"""
with open(os.path.join(PUB, "README.md"), "w", encoding="utf-8") as f:
    f.write(readme)

# 11) 公开看板首页 index.html
rows = "".join(
    f"<tr><td>{html.escape(c)}</td><td class='num'>{n:,}</td>"
    f"<td><div class='bar'><i style='width:{min(100, n / max(1, top[0][1]) * 100):.1f}%'></i></div></td></tr>"
    for c, n in top)

board = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>冒险岛素材库 · 公开看板</title>
<style>
:root{{--bg:#16181d;--panel:#1e2128;--line:#2e323c;--fg:#e6e8ee;--dim:#9aa2b1;--acc:#f07b3f}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif;padding:32px 22px 60px}}
.wrap{{max-width:1000px;margin:0 auto}}
h1{{font-size:24px;margin:0 0 6px}} h1 span{{color:var(--acc)}}
.sub{{color:var(--dim);font-size:13px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px}}
.card b{{display:block;font-size:26px;color:var(--acc);line-height:1.3}}
.card span{{color:var(--dim);font-size:12px}}
.links{{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 30px}}
a.btn{{display:inline-block;background:var(--panel);border:1px solid var(--line);color:var(--fg);
  text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px}}
a.btn:hover{{border-color:var(--acc);color:var(--acc)}}
a.btn.primary{{background:var(--acc);border-color:var(--acc);color:#fff}}
h2{{font-size:16px;margin:30px 0 12px}}
table{{width:100%;border-collapse:collapse;background:var(--panel);border-radius:10px;overflow:hidden}}
th,td{{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left}}
th{{background:#24272f;color:var(--dim);font-size:12px;font-weight:600}}
td.num{{text-align:right;font-variant-numeric:tabular-nums;width:110px}}
.bar{{background:#2a2e37;border-radius:4px;height:8px;overflow:hidden}}
.bar i{{display:block;height:100%;background:linear-gradient(90deg,#f07b3f,#f0b13f)}}
.note{{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);
  border-radius:6px;padding:12px 16px;margin-top:28px;color:var(--dim);font-size:12px}}
footer{{margin-top:34px;color:#6b7280;font-size:11px}}
</style></head><body><div class="wrap">
<h1>冒险岛素材库 · <span>公开看板</span></h1>
<div class="sub">第三方纸娃娃站素材的离线副本 · 数据快照生成于 {now}</div>

<div class="cards">
  <div class="card"><b>{total:,}</b><span>可检索素材条目</span></div>
  <div class="card"><b>{wz_cnt:,}</b><span>WZ 直抽缩略图</span></div>
  <div class="card"><b>{ds_cnt:,}</b><span>原站下载图片</span></div>
  <div class="card"><b>{n_cat}</b><span>覆盖分类</span></div>
</div>

<div class="links">
  <a class="btn primary" href="浏览.html">打开素材浏览器 →</a>
  <a class="btn" href="素材库报告.html">统计报告</a>
  <a class="btn" href="README.md">项目说明</a>
</div>

<h2>分类分布（Top {len(top)}）</h2>
<table><thead><tr><th>分类</th><th>数量</th><th>占比</th></tr></thead><tbody>{rows}</tbody></table>

<div class="note">
数据来源：第三方纸娃娃站 <code>mxd.dvg.cn</code> 的元数据，以及开放 WZ 接口 <code>mxdwzapi.dvg.cn</code> 的精灵图合成与 <code>String.wz</code> 名称表。
页面与图片均为静态文件，可完全离线运行。<br><br>
<b>免责声明</b>：游戏素材著作权归 NEXON 及原权利人所有，本仓库仅用于个人学习、研究与离线参考，非商业用途；如权利人认为内容不宜公开，请通过仓库 Issue 联系删除。
</div>

<footer>Generated {now} · 静态看板，无追踪、无后端、无 Cookie</footer>
</div>
<script>
/* 公开分享链接的 sharecode 透传：访客从首页点进子页面时保留授权参数。
   本地离线打开时无 sharecode，此脚本不生效。 */
(function(){{
  var sc = new URLSearchParams(location.search).get('sharecode');
  if(!sc) return;
  Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function(a){{
    var h = a.getAttribute('href');
    if(!h || /^https?:|^#|^mailto:/.test(h)) return;
    a.setAttribute('href', h + (h.indexOf('?')>=0?'&':'?') + 'sharecode=' + encodeURIComponent(sc));
  }});
}})();
</script>
</body></html>"""
with open(os.path.join(PUB, "index.html"), "w", encoding="utf-8") as f:
    f.write(board)

# 汇总
nf = 0
sz = 0
for r, _, fs in os.walk(PUB):
    for x in fs:
        nf += 1
        try:
            sz += os.path.getsize(os.path.join(r, x))
        except Exception:
            pass
print(f"\n发布目录就绪: {nf:,} 个文件, {sz/1048576:.1f} MB")
print(f"索引条目 {total:,} (WZ {wz_cnt:,} + 原站 {ds_cnt:,}), 分类 {n_cat}")
print("包含: README.md / index.html(看板) / .nojekyll / .gitignore")
