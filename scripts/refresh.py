# -*- coding: utf-8 -*-
"""一键刷新: WZ 直抽补齐 -> 图标 -> 重建浏览器 -> 重生成报告; 主站若解封则补齐 dbsource 大图与 item 索引。
已抽取的会跳过(resume), 只补新增/之前失败的。双击 一键刷新.bat 亦可。"""
import os, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "_scripts")


def run(name, *args):
    print(f"\n>>> python {name} {' '.join(args)}", flush=True)
    r = subprocess.run([sys.executable, "-u", name, *args], cwd=SCRIPTS)
    if r.returncode != 0:
        print(f"    [警告] {name} 退出码 {r.returncode}", flush=True)
    return r.returncode


def probe_main():
    """探测主站是否解封(200=可用)"""
    try:
        import requests
        r = requests.get("https://mxd.dvg.cn/zhiwawa_v4/", timeout=8,
                         headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        return r.status_code == 200
    except Exception:
        return False


def main():
    print("=" * 52)
    print(" 冒险岛素材库 · 一键刷新")
    print("=" * 52)
    # 1) WZ 直抽补齐(已抽的跳过) + 图标
    run("wz_preview.py", "all")
    run("extract_icons.py")
    # 2) 重建离线浏览器 + 统计报告
    run("build_viewer.py")
    run("make_report.py")
    # 3) 主站解封则补齐 dbsource 大图与 item 索引
    if probe_main():
        print("\n[主站可用] 开始补齐 item 索引 + dbsource 大图(可能较久)...", flush=True)
        run("fetch_index.py")
        run("fetch_images.py")
    else:
        print("\n[主站仍被 WAF 封锁] 跳过 dbsource 大图 / item 索引; 本次仅刷新 WZ 直抽部分。", flush=True)
    print("\n" + "=" * 52)
    print(" 刷新完成")
    print("=" * 52)


if __name__ == "__main__":
    main()
