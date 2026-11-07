import json, requests, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Referer": "https://mxd.dvg.cn/", "Accept": "application/json,*/*"})
BASE = "https://mxd.dvg.cn"

def get(path, params):
    p = dict(params); p["_legacy"] = 1
    for i in range(3):
        try:
            r = S.get(BASE + path, params=p, timeout=40)
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return {"_raw": r.text[:300]}
            print("  http", r.status_code, r.text[:120])
        except Exception as e:
            print("  err", e)
        time.sleep(1.5)
    return None

tests = [
    ("item_list", "/api/item_list.php", {"page": 1, "page_size": 3}),
    ("pet_list", "/api/pet_list.php", {"page": 1, "page_size": 3}),
    ("set_list", "/api/set_list.php", {"page": 1, "page_size": 3}),
]
for name, path, params in tests:
    d = get(path, params)
    print("=" * 20, name)
    print(json.dumps(d, ensure_ascii=False)[:900] if d else "None")

# page_size probe on appearance
for ps in (100, 200, 500):
    d = get("/api/appearance_list.php", {"category": "Skin", "page": 1, "page_size": ps})
    if d and "rows" in d:
        print("page_size req", ps, "-> got", d.get("page_size"), "rows", len(d["rows"]), "pages", d.get("pages"))
    else:
        print("page_size req", ps, "-> fail", str(d)[:120])
