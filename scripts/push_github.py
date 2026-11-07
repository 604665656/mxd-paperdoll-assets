# -*- coding: utf-8 -*-
"""把本仓库创建/推送为 GitHub 上的公开仓库。

用法:
    set GITHUB_TOKEN=ghp_xxxxxxxxxxxx
    python scripts/push_github.py [仓库名]

或把 token 作为第二个参数传入:
    python scripts/push_github.py mxd-paperdoll-assets ghp_xxxxxxxxxxxx

说明:
- token 需要 repo 权限(经典 PAT) 或 Contents: write + Administration: write(细粒度)。
- 仓库一律创建为 public。若同名仓库已存在则直接复用并推送。
- token 不会写入 .git/config(通过 http.extraheader 临时传递)。
"""
import os, sys, subprocess, json, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_REPO = "mxd-paperdoll-assets"


def api(method, path, token, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.github.com" + path,
        data=data, method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "User-Agent": "mxd-gallery-push",
            "Content-Type": "application/json",
        })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, json.loads(r.read().decode() or "{}")


def git(*args, check=True):
    p = subprocess.run(["git", *args], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        raise RuntimeError("git " + " ".join(args) + " failed: " + (p.stderr or p.stdout)[:500])
    return p.stdout.strip()


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_REPO
    token = (sys.argv[2] if len(sys.argv) > 2 else
             os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"))
    if not token:
        print("缺少 GitHub token。请设置环境变量 GITHUB_TOKEN 或作为第二个参数传入。")
        print("获取方式: GitHub → Settings → Developer settings → Personal access tokens")
        return 1

    print("仓库名:", repo, "(public)")
    try:
        status, me = api("GET", "/user", token)
        user = me["login"]
        print("认证用户:", user)
    except Exception as e:
        print("认证失败:", e)
        return 1

    # 创建公开仓库(已存在则复用)
    try:
        status, info = api("POST", "/user/repos", token, {
            "name": repo,
            "description": "冒险岛纸娃娃素材库 · 离线索引与公开看板",
            "private": False,
            "has_issues": True,
        })
        print("已创建公开仓库:", info.get("full_name"))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode() or "{}")
        if e.code == 422 and "already exists" in str(body):
            print("同名仓库已存在，直接复用:", user + "/" + repo)
        else:
            print("创建仓库失败:", e.code, body)
            return 1
    except Exception as e:
        print("创建仓库失败:", e)
        return 1

    url = f"https://github.com/{user}/{repo}.git"
    # remote 用干净 URL(不含 token)
    existing = git("remote", "get-url", "origin", check=False)
    if existing:
        git("remote", "set-url", "origin", url)
    else:
        git("remote", "add", "origin", url)

    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    if branch in ("HEAD", ""):
        branch = "master"
    print("推送分支:", branch, "->", url)

    # token 通过 extraheader 临时传递, 不落盘
    import base64
    basic = base64.b64encode(f"{user}:{token}".encode()).decode()
    p = subprocess.run(
        ["git", "-c", f"http.extraheader=Authorization: Basic {basic}",
         "push", "-u", "origin", branch],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((p.stdout or "")[-1500:])
    if p.returncode != 0:
        print("推送失败:", (p.stderr or "")[-1500:])
        return 1
    print("\n完成! 仓库:", f"https://github.com/{user}/{repo}")
    print("开启 Pages: Settings → Pages → Deploy from branch → master / (root)")
    print("看板地址:", f"https://{user}.github.io/{repo}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
