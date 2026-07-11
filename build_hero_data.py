# -*- coding: utf-8 -*-
"""
build_hero_data.py — Auto sinh data icon/skin cho Mini App từ id_skinnn.txt

Sinh ra:
  minibot/hero_data_full.json
  minibot/hero_icons.json
  minibot/skin_codes.json

Nguyên lý icon CDN (Garena KGVN):
  Hiển thị / list  : hero id = 130
  API file name    : {cdn}{prefix}{variant}head.jpg
                     ví dụ default  → 301300head.jpg  (logic 30_1300)
                     skin 13009     → 301309head.jpg
  cdn_id mặc định  : 30

Cách chạy (từ root project hoặc minibot/):
  py minibot/build_hero_data.py
  py minibot/build_hero_data.py --id-file id_skinnn.txt
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
DEFAULT_ID_FILE = ROOT / "id_skinnn.txt"
CDN_ID = "30"

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


def build(id_file: Path) -> dict:
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
    if not catalog_keys:
        sb = ROOT / "Sources_Bot"
        if sb.is_dir():
            catalog_keys = [d for d in os.listdir(sb) if (sb / d).is_dir()]

    parsed = parse_id_skinnn(id_file)
    hero_data: dict = {}
    hero_icons: dict = {
        "_note": "cdn_id + prefix + variant + head.jpg. Default variant=0 → 30_1300 ⇔ 301300head.jpg",
        "_cdn_id": CDN_ID,
        "_url_tpl": "https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{cdn}{prefix}{variant}head.jpg",
    }
    skin_codes: dict = {}

    skipped = []
    for h in parsed:
        prefix = h["prefix"]
        skins = h["skins"]
        if not skins:
            skipped.append(h["code"])
            continue
        name = resolve_vn_name(prefix, skins, name_to_prefix, catalog_keys)
        if not name:
            # fallback: dùng internal code
            name = h["internal"]
            skipped.append(f"{h['code']}→? used internal name")

        hero_data[name] = {
            "prefix": prefix,
            "skins": [code for code, _ in skins],
        }
        # list hiện 130; API logic 30_1300
        hero_icons[name] = {
            "cdn_id": CDN_ID,
            "prefix": prefix,
            "api_key": f"{CDN_ID}_{prefix}0",  # 30_1300
            "display_id": prefix,              # 130
        }
        for code, sname in skins:
            skin_codes[f"{name}|{sname}"] = code

    return {
        "hero_data": hero_data,
        "hero_icons": hero_icons,
        "skin_codes": skin_codes,
        "stats": {
            "heroes_src": len(parsed),
            "heroes_out": len(hero_data),
            "skins": len(skin_codes),
            "skipped_empty": skipped,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build minibot hero/skin icon data from id_skinnn.txt")
    ap.add_argument("--id-file", default=str(DEFAULT_ID_FILE), help="Path to id_skinnn.txt")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    out = build(Path(args.id_file))
    st = out["stats"]
    print(f"📥 Heroes src : {st['heroes_src']}")
    print(f"📤 Heroes out : {st['heroes_out']}")
    print(f"🎨 Skins      : {st['skins']}")
    if st["skipped_empty"]:
        print(f"⏭️  Skip empty/unknown ({len(st['skipped_empty'])}):")
        for s in st["skipped_empty"][:20]:
            print(f"   - {s}")

    if args.dry_run:
        print("(dry-run, không ghi file)")
        return 0

    files = {
        MINIBOT / "hero_data_full.json": out["hero_data"],
        MINIBOT / "hero_icons.json": out["hero_icons"],
        MINIBOT / "skin_codes.json": out["skin_codes"],
    }
    for path, data in files.items():
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"✅ Wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")

    print("\nURL mẫu Airi:")
    print(f"  display : 130")
    print(f"  api_key : {CDN_ID}_1300")
    print(f"  portrait: https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{CDN_ID}1300head.jpg")
    print(f"  skin 09 : https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{CDN_ID}1309head.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
