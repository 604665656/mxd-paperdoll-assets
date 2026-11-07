# 冒险岛纸娃娃素材库 · 离线索引

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

当前索引条目：**148,884** 条（WZ 直抽 47,990 + 原站图 100,894），覆盖 **32** 个分类。
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
生成时间：2026-11-07 21:45
