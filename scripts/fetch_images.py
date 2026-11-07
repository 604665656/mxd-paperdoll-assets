# -*- coding: utf-8 -*-
"""按 _index/images.txt 下载全站图片，保持服务器原始目录结构。
特性：断点续传 / 礼貌限速 / 遇 403·429 自动退避冷却后重连。
用法：WORKERS=2 DELAY=0.25 python fetch_images.py
"""
import os, sys, time, threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://mxd.dvg.cn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# images.txt 路径均为 /dbsource/... 形式，直接落到仓库根目录下即单层 dbsource/
DEST = ROOT
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

WORKERS = int(os.environ.get("WORKERS", "2"))
DELAY = float(os.environ.get("DELAY", "0.25"))       # 每次请求后的礼貌间隔(秒)
CHUNK = int(os.environ.get("CHUNK", "4000"))          # 每批提交的任务数

lock = threading.Lock()
stat = {"ok": 0, "skip": 0, "fail": 0, "bytes": 0, "blocked": 0}
pause_until = {"t": 0.0}          # 全局冷却截止时间(epoch)
backoff = {"s": 60.0}             # 当前退避秒数(指数增长,初始60s避免冷却窗口内续命)
fails = []
tls = threading.local()


def sess():
    s = getattr(tls, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update({"User-Agent": UA,
                          "Referer": BASE + "/",
                          "Accept": "image/avif,image/webp,image/png,*/*"})
        tls.s = s
    return s


def local_of(url):
    p = url.split("?")[0].lstrip("/")
    return os.path.join(DEST, p.replace("/", os.sep))


def wait_pause():
    while True:
        with lock:
            until = pause_until["t"]
        if time.time() >= until:
            return
        time.sleep(min(5.0, until - time.time() + 0.1))


def on_blocked():
    """遇到限流：指数退避并设定全局冷却窗口。"""
    with lock:
        backoff["s"] = min(backoff["s"] * 2, 900.0)
        pause_until["t"] = max(pause_until["t"], time.time() + backoff["s"])
        stat["blocked"] += 1
    print(f"  !! 触发限流，冷却 {backoff['s']:.0f}s 后自动续传", flush=True)


def one(url):
    lp = local_of(url)
    if os.path.exists(lp) and os.path.getsize(lp) > 0:
        with lock:
            stat["skip"] += 1
        return
    # 403/429 退避期间，所有线程一起等待
    wait_pause()
    # 403 允许重试次数较多（等待冷却后重连）
    for attempt in range(12):
        try:
            r = sess().get(BASE + url, timeout=30)
            if r.status_code == 200 and len(r.content) > 0:
                os.makedirs(os.path.dirname(lp), exist_ok=True)
                tmp = lp + ".part"
                with open(tmp, "wb") as f:
                    f.write(r.content)
                os.replace(tmp, lp)
                with lock:
                    stat["ok"] += 1
                    stat["bytes"] += len(r.content)
                    backoff["s"] = max(20.0, backoff["s"] * 0.7)  # 顺利则缓慢恢复
                time.sleep(DELAY)
                return
            if r.status_code in (403, 429):
                on_blocked()
                wait_pause()
                continue
            if r.status_code == 404:
                with lock:
                    stat["fail"] += 1
                    fails.append(url)
                return
            # 其他非200
            with lock:
                stat["fail"] += 1
                fails.append(url)
            return
        except Exception:
            if attempt < 3:
                time.sleep(1 + attempt)
                continue
            with lock:
                stat["fail"] += 1
                fails.append(url)
            return
    with lock:
        stat["fail"] += 1
        fails.append(url)


def main():
    lst = os.path.join(ROOT, "_index", "images.txt")
    urls = [l.strip() for l in open(lst, encoding="utf-8") if l.strip()]
    total = len(urls)
    print(f"待处理 {total} 张, 并发 {WORKERS}, 间隔 {DELAY}s", flush=True)
    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        # 分批提交，避免一次性堆积过多 future
        for i in range(0, total, CHUNK):
            batch = urls[i:i + CHUNK]
            futs = [ex.submit(one, u) for u in batch]
            for _ in as_completed(futs):
                done += 1
                if done % 2000 == 0:
                    el = time.time() - t0
                    rate = done / el if el else 0
                    print(f"  {done}/{total} ok={stat['ok']} skip={stat['skip']} "
                          f"fail={stat['fail']} blocked={stat['blocked']} "
                          f"{rate:.1f}/s {stat['bytes']/1048576:.0f}MB "
                          f"剩余{int((total-done)/rate/60) if rate else '?'}min",
                          flush=True)
    print(f"完成 ok={stat['ok']} skip={stat['skip']} fail={stat['fail']} "
          f"blocked={stat['blocked']} {stat['bytes']/1048576:.1f}MB "
          f"用时{int(time.time()-t0)}s", flush=True)
    if fails:
        with open(os.path.join(ROOT, "_index", "img_fail.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(fails))
        print(f"失败清单 {len(fails)} 条 -> _index/img_fail.txt")


if __name__ == "__main__":
    main()
