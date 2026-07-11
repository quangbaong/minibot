# -*- coding: utf-8 -*-
"""
build_hero_data.py — Auto sync skin/icon từ id_skinnn.txt

Sinh / cập nhật:
  minibot/hero_data_full.json   — prefix + list skin code
  minibot/hero_icons.json       — icon CDN (display 130 · api 30_1300)
  minibot/skin_codes.json       — "Airi|Airi Mỵ hồ" → "13009"
  minibot/catalog.json          — list skin name cho Mini App (UI)
  Sources_Bot/<hero>/gốc.txt    — -->13009 : Airi Mỵ hồ  (bot chaymod)
  Sources_Bot/<hero>/sources.txt— Airi Mỵ hồ

Nguyên lý icon CDN (Garena KGVN):
  list  : 130
  file  : {cdn}{prefix}{variant}head.jpg  → 301300head.jpg (logic 30_1300)

Cách chạy:
  py minibot/build_hero_data.py
  py minibot/build_hero_data.py --id-file id_skinnn.txt
  py minibot/build_hero_data.py --no-sources   # chỉ minibot JSON, không ghi Sources_Bot
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MINIBOT = Path(__file__).resolve().parent
SOURCES_BOT = ROOT / "Sources_Bot"
DEFAULT_ID_FILE = ROOT / "id_skinnn.txt"
CDN_ID = "30"
# 3 id đặc biệt — bỏ qua (không vào catalog / Sources_Bot)
SKIP_PREFIXES = frozenset({"797", "798", "799"})

# Fallback map name → prefix (đồng bộ app.js HERO_PREFIX)
HERO_PREFIX_FALLBACK = {
    "Airi": "130", "Aleister": "156", "Alice": "118", "Allain": "537", "Amily": "193",
    "Annette": "519", "Aoi": "536", "Arduin": "126", "Arthur": "166", "Arum": "187",
    "Astrid": "502", "Ata": "511", "Aya": "543", "Azzen'Ka": "127", "Baldum": "505",
    "Bijan": "548", "Billow": "599", "Biron": "597", "Bolt Baron": "598", "Bonnie": "541",
    "Bright": "540", "Butterfly": "116", "Capheny": "524", "Celica": "192",
    "Charlotte": "206", "Chaugnar": "113", "Cresht": "171", "D'Arcy": "523",
    "Dextra": "534", "Dirak": "530", "EX": "159", "Eland'orr": "199", "Elsu": "196",
    "Enzo": "195", "Erin": "567", "Errol": "522", "Fennik": "173", "Florentino": "521",
    "Gildur": "108", "Goverra": "596", "Grakk": "175", "Hayate": "132", "Heino": "563",
    "Helen": "184", "Iggy": "538", "Ignis": "124", "Ilumia": "136", "Ishar": "526",
    "Jinna": "115", "Kahlii": "110", "Kaine": "153", "Keera": "531", "Kil'Groth": "139",
    "Kriknak": "162", "Krixi": "106", "Krizzix": "189", "Lauriel": "141", "Laville": "533",
    "Liliana": "510", "Lindis": "177", "Lorion": "539", "Lumburr": "168", "Lữ Bố": "128",
    "Maloch": "123", "Marja": "121", "Max": "180", "Mganga": "119", "Mina": "120",
    "Ming": "568", "Moren": "170", "Murad": "131", "Nakroth": "150", "Natalya": "142",
    "Ngộ Không": "167", "Omega": "114", "Omen": "506", "Ormarr": "117", "Paine": "137",
    "Preyta": "148", "Qi": "528", "Quillen": "518", "Raz": "157", "Richter": "515",
    "Rouie": "191", "Rourke": "512", "Roxie": "514", "Ryoma": "163", "Sephera": "527",
    "Sinestrea": "535", "Skud": "134", "Slimz": "169", "Stuart": "174", "Superman": "140",
    "Taara": "144", "Tachi": "542", "TeeMee": "186", "Teeri": "546", "Tel'Annas": "501",
    "Thane": "135", "The Flash": "507", "Thorne": "532", "Toro": "105", "Triệu Vân": "129",
    "Tulen": "190", "Valhein": "133", "Veera": "109", "Veres": "520", "Violet": "111",
    "Volkath": "529", "Wisp": "508", "Wonder Woman": "504", "Xeniel": "149",
    "Y'bneth": "509", "Yan": "544", "Yena": "154", "Yorn": "112", "Yue": "545",
    "Zata": "513", "Zephys": "107", "Zill": "146", "Zip": "525", "Zuka": "503",
    "Điêu Thuyền": "152", "Edras": "194", "Flowborn": "577", "Tamyn": "582",
    "Dextra": "534",
}


def load_existing_prefix_map() -> dict[str, str]:
    """name → prefix từ hero_data_full + catalog + fallback."""
    name_to_prefix: dict[str, str] = dict(HERO_PREFIX_FALLBACK)
    hdf = MINIBOT / "hero_data_full.json"
    if hdf.is_file():
        try:
            data = json.loads(hdf.read_text(encoding="utf-8"))
            for name, info in data.items():
                if isinstance(info, dict) and info.get("prefix"):
                    name_to_prefix[name] = str(info["prefix"])
        except Exception:
            pass
    # Sources_Bot folder names (ưu tiên giữ tên folder VN)
    sb = ROOT / "Sources_Bot"
    if sb.is_dir():
        for name in os.listdir(sb):
            if name not in name_to_prefix and (sb / name).is_dir():
                # giữ nếu đã có prefix từ file cũ
                pass
    return name_to_prefix


def parse_id_skinnn(path: Path) -> list[dict]:
    """
    Parse:
      ####
      130_GongBenWuZang
      -->13001 : Airi Thích khách
    """
    text = path.read_text(encoding="utf-8", errors="replace")
    heroes: list[dict] = []
    cur = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line == "####" or line.startswith("####"):
            continue
        m_hero = re.match(r"^(\d+)_(.+)$", line)
        if m_hero and not line.startswith("-->"):
            cur = {
                "prefix": m_hero.group(1),
                "code": line,
                "internal": m_hero.group(2),
                "skins": [],  # list[(code, name)]
            }
            heroes.append(cur)
            continue
        m_skin = re.match(r"^-->(\d+)\s*:\s*(.+)$", line)
        if m_skin and cur is not None:
            cur["skins"].append((m_skin.group(1), m_skin.group(2).strip()))
    return heroes


def resolve_vn_name(prefix: str, skins: list, name_to_prefix: dict[str, str], catalog_keys: list[str]) -> str | None:
    """Map hero id (130) → tên folder VN (Airi)."""
    prefix_to_names: dict[str, list[str]] = {}
    for n, p in name_to_prefix.items():
        prefix_to_names.setdefault(str(p), []).append(n)

    if prefix in prefix_to_names:
        # ưu tiên tên có trong catalog
        for n in prefix_to_names[prefix]:
            if n in catalog_keys:
                return n
        return sorted(prefix_to_names[prefix], key=len)[0]

    # đoán từ tên skin: "Airi Thích khách" → match catalog key dài nhất
    if skins:
        skin_name = skins[0][1]
        best = None
        for key in sorted(catalog_keys, key=len, reverse=True):
            if skin_name == key or skin_name.startswith(key + " ") or skin_name.startswith(key):
                best = key
                break
        if best:
            return best
        # lấy token đầu
        first = skin_name.split()[0]
        if first in catalog_keys:
            return first
    return None


def write_sources_bot(hero_name: str, skins: list[tuple[str, str]]) -> None:
    """
    Cập nhật Sources_Bot/<hero>/ từ list skin id_skinnn:
      gốc.txt    : -->13009 : Airi Mỵ hồ\\r\\n  (có thể rỗng nếu chưa có skin)
      sources.txt: Airi Mỵ hồ\\r\\n
    """
    folder = SOURCES_BOT / hero_name
    folder.mkdir(parents=True, exist_ok=True)
    goc_lines = []
    src_lines = []
    for code, sname in skins:
        goc_lines.append(f"-->{code} : {sname}\r\n")
        src_lines.append(f"{sname}\r\n")
    (folder / "gốc.txt").write_bytes("".join(goc_lines).encode("utf-8"))
    (folder / "sources.txt").write_bytes("".join(src_lines).encode("utf-8"))


def build(id_file: Path, write_sources: bool = True) -> dict:
    if not id_file.is_file():
        raise FileNotFoundError(f"Không thấy {id_file}")

    name_to_prefix = load_existing_prefix_map()
    catalog_keys: list[str] = []
    cat_path = MINIBOT / "catalog.json"
    if cat_path.is_file():
        try:
            catalog_keys = list(json.loads(cat_path.read_text(encoding="utf-8")).keys())
        except Exception:
            pass
    if SOURCES_BOT.is_dir():
        for d in os.listdir(SOURCES_BOT):
            if (SOURCES_BOT / d).is_dir() and d not in catalog_keys:
                catalog_keys.append(d)

    parsed = parse_id_skinnn(id_file)
    hero_data: dict = {}
    hero_icons: dict = {
        "_note": "cdn_id + prefix + variant + head.jpg. Default variant=0 → 30_1300 ⇔ 301300head.jpg",
        "_cdn_id": CDN_ID,
        "_url_tpl": "https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{cdn}{prefix}{variant}head.jpg",
    }
    skin_codes: dict = {}
    catalog: dict[str, list[str]] = {}
    # giữ extras nếu catalog cũ có (không phải hero)
    if cat_path.is_file():
        try:
            old_cat = json.loads(cat_path.read_text(encoding="utf-8"))
            for k, v in old_cat.items():
                if k in ("Cam Xa", "HD Chiêu", "Server") or not isinstance(v, list):
                    catalog[k] = v
        except Exception:
            pass

    skipped = []
    empty_skin_heroes = []
    forced_skip = []
    sources_written = 0
    for h in parsed:
        prefix = h["prefix"]
        skins = h["skins"]
        if prefix in SKIP_PREFIXES:
            forced_skip.append(h.get("code") or prefix)
            continue
        # VẪN thêm hero dù chưa có skin (vd 593_MaChao)
        name = resolve_vn_name(prefix, skins, name_to_prefix, catalog_keys)
        if not name:
            if skins and skins[0][1].split():
                name = skins[0][1].split()[0]
            else:
                # internal từ id_skinnn: 593_MaChao → MaChao
                name = h.get("internal") or f"Hero{prefix}"
            skipped.append(f"{h['code']}→ name: {name}")

        if not skins:
            empty_skin_heroes.append(f"{prefix} ({name})")

        # cập nhật map để resolve hero sau ổn định
        name_to_prefix[name] = prefix
        if name not in catalog_keys:
            catalog_keys.append(name)

        hero_data[name] = {
            "prefix": prefix,
            "skins": [code for code, _ in skins],
        }
        hero_icons[name] = {
            "cdn_id": CDN_ID,
            "prefix": prefix,
            "api_key": f"{CDN_ID}_{prefix}0",
            "display_id": prefix,
        }

        # catalog = list tên skin (UI Mini App) — rỗng nếu chưa có skin
        skin_names: list[str] = []
        seen_names: set[str] = set()
        for code, sname in skins:
            skin_codes[f"{name}|{sname}"] = code
            if sname not in seen_names:
                seen_names.add(sname)
                skin_names.append(sname)
        catalog[name] = skin_names

        if write_sources:
            write_sources_bot(name, skins)
            sources_written += 1

    # sort catalog hero keys (extras giữ đầu nếu có)
    extras = {k: catalog.pop(k) for k in list(catalog.keys()) if k in ("Cam Xa", "HD Chiêu", "Server")}
    catalog_sorted = {**extras, **{k: catalog[k] for k in sorted(catalog.keys(), key=lambda x: x.lower())}}

    return {
        "hero_data": hero_data,
        "hero_icons": hero_icons,
        "skin_codes": skin_codes,
        "catalog": catalog_sorted,
        "stats": {
            "heroes_src": len(parsed),
            "heroes_out": len(hero_data),
            "skins": len(skin_codes),
            "catalog_heroes": len(catalog_sorted),
            "sources_written": sources_written,
            "empty_skin_heroes": empty_skin_heroes,
            "forced_skip": forced_skip,
            "name_notes": skipped,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync minibot + Sources_Bot skins from id_skinnn.txt")
    ap.add_argument("--id-file", default=str(DEFAULT_ID_FILE), help="Path to id_skinnn.txt")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-sources", action="store_true", help="Không ghi Sources_Bot (chỉ JSON minibot)")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    out = build(Path(args.id_file), write_sources=not args.no_sources)
    st = out["stats"]
    print(f"📥 Heroes src     : {st['heroes_src']}")
    print(f"📤 Heroes out     : {st['heroes_out']}")
    print(f"🎨 Skins (codes)  : {st['skins']}")
    print(f"📚 Catalog heroes : {st['catalog_heroes']}")
    print(f"📁 Sources_Bot    : {st['sources_written']} folder")
    if st.get("forced_skip"):
        print(f"🚫 Bỏ qua (SKIP_PREFIXES): {', '.join(st['forced_skip'])}")
    if st.get("empty_skin_heroes"):
        print(f"📭 Hero chưa có skin (vẫn thêm): {len(st['empty_skin_heroes'])}")
        for s in st["empty_skin_heroes"]:
            print(f"   - {s}")
    if st.get("name_notes"):
        print(f"📝 Name resolve notes ({len(st['name_notes'])}):")
        for s in st["name_notes"][:25]:
            print(f"   - {s}")

    if args.dry_run:
        print("(dry-run, không ghi file)")
        return 0

    files = {
        MINIBOT / "hero_data_full.json": out["hero_data"],
        MINIBOT / "hero_icons.json": out["hero_icons"],
        MINIBOT / "skin_codes.json": out["skin_codes"],
        MINIBOT / "catalog.json": out["catalog"],
    }
    for path, data in files.items():
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"✅ Wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")

    print("\nURL mẫu Airi:")
    print(f"  display : 130")
    print(f"  api_key : {CDN_ID}_1300")
    print(f"  portrait: https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{CDN_ID}1300head.jpg")
    print(f"  skin 09 : https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{CDN_ID}1309head.jpg")
    print("\nGợi ý: sau khi sửa id_skinnn.txt → chạy lại lệnh này.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
