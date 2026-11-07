# -*- coding: utf-8 -*-
"""一键刷新: WZ 名称表 -> WZ 直抽补齐 -> 图标 -> (主站可用时)补元数据与大图
-> 重建浏览器 / 报告 -> 可选同步发布目录。

所有步骤都支持断点续传, 已完成的会跳过。
双击 一键刷新.bat 亦可; 追加 --publish 会额外同步 mxd-gallery 发布目录。
"""
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
    """探测主站是否可用(200=可用; 520/403=CDN 或 WAF 限制)"""
    try:
        import requests
        r = requests.get("https://mxd.dvg.cn/zhiwawa_v4/", timeout=8,
                         headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        return r.status_code == 200
    except Exception:
        return False


def main():
    publish = "--publish" in sys.argv
    print("=" * 52)
    print(" 冒险岛素材库 · 一键刷新")
    print("=" * 52)

    # 1) WZ 接口(独立域名, 通常可用): 名称表 + 外观缩略图 + 图标
    run("fetch_wz_strings.py")
    run("wz_preview.py", "all")
    run("extract_icons.py")

    # 2) 主站可用时才补元数据与原始大图
    if probe_main():
        print("\n[主站可用] 补齐模块索引 + dbsource 大图(可能较久)...", flush=True)
        run("fetch_index.py")
        run("build_manifest.py")
        run("fetch_images.py")
    else:
        print("\n[主站不可用] 跳过 item 索引 / dbsource 大图; 本次刷新本地与 WZ 部分。", flush=True)

    # 3) 无论主站是否可用, 最后统一重建索引页(确保新数据一定被收录)
    run("build_viewer.py")
    run("make_report.py")
    if publish:
        run("build_publish.py")

    print("\n" + "=" * 52)
    print(" 刷新完成" + ("（已同步发布目录）" if publish else ""))
    print("=" * 52)


if __name__ == "__main__":
    main()
