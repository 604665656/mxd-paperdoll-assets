# -*- coding: utf-8 -*-
"""镜像纸娃娃编辑器前端（/zhiwawa_v4/dist 全量 chunk + 页面依赖）"""
import os, re, sys, time
import requests
from urllib.parse import urljoin

BASE = "https://mxd.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "editor")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Referer": BASE + "/zhiwawa_v4/"})

seen = set()
ok = 0
fail = []


def save(url_path):
    """url_path 形如 /zhiwawa_v4/dist/assets/x.js"""
    global ok
    if url_path in seen:
        return None
    seen.add(url_path)
    clean = url_path.split("?")[0]
    if clean.endswith("/"):
        clean = clean + "index.html"
    local = os.path.join(OUT, clean.lstrip("/").replace("/", os.sep))
    if os.path.exists(local) and os.path.getsize(local) > 0:
        with open(local, "rb") as f:
            return f.read()
    for i in range(3):
        try:
            r = S.get(BASE + url_path, timeout=60)
            if r.status_code == 200:
                os.makedirs(os.path.dirname(local), exist_ok=True)
                with open(local, "wb") as f:
                    f.write(r.content)
                ok += 1
                return r.content
            if r.status_code == 404:
                fail.append(url_path)
                return None
        except Exception:
            time.sleep(1 + i)
    fail.append(url_path)
    return None


def main():
    # 1. 页面 HTML
    html = save("/zhiwawa_v4/")
    if not html:
        print("首页失败"); return
    html = html.decode("utf-8", "ignore")

    queue = set()
    # 页面直接引用
    for m in re.findall(r'(/zhiwawa_v4/dist/[^"\'\s>]+)', html):
        if not m.startswith("/zhiwawa_v4/dist/"):
            continue
        queue.add(m.split("?")[0])
    for m in re.findall(r'(/public/assets/(?:js|css|images|img)/[^"\'\s>]+)', html):
        queue.add(m.split("?")[0])

    # 2. BFS 追 chunk
    processed = set()
    while queue:
        batch = [u for u in queue if u not in processed]
        queue = set()
        for u in batch:
            processed.add(u)
            data = save(u)
            if not data or not u.endswith(".js"):
                continue
            txt = data.decode("utf-8", "ignore")
            for dep in re.findall(r'"\./([A-Za-z0-9_@.\-]+\.(?:js|css))"', txt):
                queue.add("/zhiwawa_v4/dist/assets/" + dep)
            for dep in re.findall(r'import\("\./([A-Za-z0-9_@.\-]+\.(?:js|css))"\)', txt):
                queue.add("/zhiwawa_v4/dist/assets/" + dep)
            for dep in re.findall(r'(/zhiwawa_v4/dist/[^"\'\s)]+\.(?:js|css|png|webp|svg|json))', txt):
                queue.add(dep.split("?")[0])
        print(f"  已处理 {len(processed)} 个文件, 队列 {len(queue)}, 新增下载 {ok}")

    print(f"完成: 下载 {ok} 个文件, 失败 {len(fail)}")
    if fail:
        with open(os.path.join(ROOT, "_index", "editor_fail.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(fail))


if __name__ == "__main__":
    main()
