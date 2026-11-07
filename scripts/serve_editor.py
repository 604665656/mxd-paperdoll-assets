# -*- coding: utf-8 -*-
"""本地化纸娃娃编辑器服务器
- 静态文件(editor/) 从本机根目录提供
- /api/*.php  -> 指向本地已缓存的目录接口(_index/raw/<group>/pageN.json)
- /dbsource/* -> 指向本地已下载图片(dbsource/)
- 渲染用的 WZ 接口(mxdwzapi.dvg.cn)由浏览器直连(开放,不受主站封锁)
用法: python serve_editor.py [port]
"""
import os, json, re
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDITOR = os.path.join(ROOT, "editor")
RAW = os.path.join(ROOT, "_index", "raw")
DBS = os.path.join(ROOT, "dbsource")
PORT = int(os.environ.get("PORT", "8137"))

# api 名 -> 本地缓存目录名(group)
API_MAP = {
    "appearance_list.php": "appearance",
    "item_list.php": "item",
    "pet_list.php": "pet",
    "cash-shop-list.php": "cash",
    "map-list.php": "map",
    "npc-list.php": "npc",
    "skill-list.php": "skill",
    "mob-list.php": "mob",
}


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        qs = parse_qs(u.query)

        # 1) 本地已下载图片
        if path.startswith("/dbsource/"):
            lp = os.path.join(DBS, path[len("/dbsource/"):].replace("/", os.sep))
            if os.path.isfile(lp):
                self._static(lp)
            else:
                self._send(404, "{}")
            return

        # 2) 目录接口 -> 本地缓存
        base = path.strip("/").split("?")[0]
        fname = base.split("/")[-1]
        if fname in API_MAP or "api/" in path:
            self._api(fname, qs, path)
            return

        # 3) 静态文件
        if path in ("/", ""):
            path = "/zhiwawa_v4/index.html"
        lp = os.path.join(EDITOR, path.lstrip("/").replace("/", os.sep))
        if os.path.isfile(lp):
            self._static(lp)
        else:
            # 兜底: 尝试 zhiwawa_v4 前缀
            lp2 = os.path.join(EDITOR, "zhiwawa_v4", path.lstrip("/").replace("/", os.sep))
            if os.path.isfile(lp2):
                self._static(lp2)
            else:
                self._send(404, "not found")

    def _static(self, lp):
        ext = os.path.splitext(lp)[1].lower()
        ctype = {
            ".html": "text/html; charset=utf-8", ".js": "application/javascript",
            ".css": "text/css", ".json": "application/json", ".png": "image/png",
            ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
            ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2",
        }.get(ext, "application/octet-stream")
        try:
            with open(lp, "rb") as f:
                data = f.read()
        except Exception:
            self._send(404, "{}"); return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _api(self, fname, qs, path):
        if fname in API_MAP:
            group = API_MAP[fname]
            page = int(qs.get("page", ["1"])[0])
            cat = qs.get("category", [""])[0]
            # appearance 按 category 分子目录; 其余按 group 单目录
            if group == "appearance" and cat:
                cand = os.path.join(RAW, "appearance_" + cat, f"page{page}.json")
            else:
                cand = os.path.join(RAW, group, f"page{page}.json")
            if os.path.isfile(cand):
                with open(cand, "r", encoding="utf-8") as f:
                    self._send(200, f.read())
                return
            # 缺页 -> 返回空结构(让前端不崩)
            self._send(200, json.dumps({"ok": 1, "rows": [], "total": 0,
                                        "page": page, "pages": 0, "page_size": 100}))
            return
        # 未知 api -> 空结构
        self._send(200, json.dumps({"ok": 1, "rows": [], "total": 0, "pages": 0}))


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"编辑器本地服务已启动: http://127.0.0.1:{PORT}/  (Ctrl+C 停止)")
    srv.serve_forever()


if __name__ == "__main__":
    main()
