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

# Tên sai từng map nhầm prefix — không dùng lại khi resolve
BAD_NAME_PREFIX = {
    "EX": "159",       # đúng là Dolia
    "Edras": "194",    # đúng là SuLie
    "Flowborn": "577", # đúng là ShaoSiYuan
    "Tamyn": "582",    # đúng là Ciyuanfashi
}


def known_folder_names() -> list[str]:
    """Tên folder Sources_Bot + catalog (để khớp 'Airi Thích khách' → Airi)."""
    names: set[str] = set()
    if SOURCES_BOT.is_dir():
        for d in os.listdir(SOURCES_BOT):
            if (SOURCES_BOT / d).is_dir() and d not in BAD_NAME_PREFIX:
                names.add(d)
    cat_path = MINIBOT / "catalog.json"
    if cat_path.is_file():
        try:
            for k in json.loads(cat_path.read_text(encoding="utf-8")):
                if k not in BAD_NAME_PREFIX and k not in ("Cam Xa", "HD Chiêu", "Server"):
                    names.add(k)
        except Exception:
            pass
    return sorted(names, key=len, reverse=True)


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


def name_from_skin_label(skin_name: str, folders: list[str]) -> str | None:
    """'Airi Thích khách' / 'Dolia Hoa tiêu…' → Airi / Dolia."""
    if not skin_name:
        return None
    # bỏ tag vip nếu có: [●]Dolia ...
    s = re.sub(r"^\[[^\]]*\]\s*", "", skin_name).strip()
    # khớp folder dài nhất trước (The Flash, Wonder Woman, …)
    for key in folders:
        if not key or key in BAD_NAME_PREFIX:
            continue
        if s == key or s.startswith(key + " "):
            return key
    for special in ("The Flash", "Bolt Baron", "Wonder Woman", "Azzen'Ka", "Eland'orr", "Kil'Groth", "Tel'Annas", "Y'bneth", "D'Arcy"):
        if s == special or s.startswith(special + " "):
            return special
    parts = s.split()
    return parts[0] if parts else None


def resolve_hero_name(prefix: str, internal: str, skins: list, folders: list[str]) -> str:
    """
    Đúng id + đúng tên:
      1) Từ tên skin trong id_skinnn (ưu tiên tuyệt đối)
      2) Internal code trong id_skinnn: 593_MaChao → MaChao
    Không reverse map từ fallback sai (EX/Edras/…).
    """
    if skins:
        n = name_from_skin_label(skins[0][1], folders)
        if n and n not in BAD_NAME_PREFIX:
            return n
    # hero chưa skin: dùng đúng tên sau dấu _ trong id_skinnn
    if internal and internal not in BAD_NAME_PREFIX:
        return internal
    return f"Hero{prefix}"


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

    folders = known_folder_names()
    # thêm tên sẽ suy ra trong pass này (để hero sau khớp)
    cat_path = MINIBOT / "catalog.json"

    parsed = parse_id_skinnn(id_file)
    hero_data: dict = {}
    hero_icons: dict = {
        "_note": "cdn_id + prefix + variant + head.jpg. Default variant=0 → 30_1300 ⇔ 301300head.jpg",
        "_cdn_id": CDN_ID,
        "_url_tpl": "https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/{cdn}{prefix}{variant}head.jpg",
    }
    skin_codes: dict = {}
    catalog: dict[str, list[str]] = {}

    empty_skin_heroes = []
    forced_skip = []
    name_notes = []
    sources_written = 0
    used_names: dict[str, str] = {}  # name → prefix (chống trùng tên)

    for h in parsed:
        prefix = h["prefix"]
        skins = h["skins"]
        internal = h.get("internal") or ""
        if prefix in SKIP_PREFIXES:
            forced_skip.append(h.get("code") or prefix)
            continue

        name = resolve_hero_name(prefix, internal, skins, folders)
        # trùng tên khác prefix → gắn suffix id
        if name in used_names and used_names[name] != prefix:
            name = f"{name}_{prefix}"
            name_notes.append(f"{h['code']} trùng tên → {name}")
        used_names[name] = prefix
        if name not in folders:
            folders.append(name)
            folders.sort(key=len, reverse=True)

        if not skins:
            empty_skin_heroes.append(f"{prefix} = {name}")
        name_notes.append(f"{prefix} → {name}" + (f" ({internal})" if internal and internal != name else ""))

        hero_data[name] = {
            "prefix": prefix,
            "internal": internal,
            "skins": [code for code, _ in skins],
        }
        hero_icons[name] = {
            "cdn_id": CDN_ID,
            "prefix": prefix,
            "api_key": f"{CDN_ID}_{prefix}0",
            "display_id": prefix,
        }

        skin_names: list[str] = []
        seen_names: set[str] = set()
        for code, sname in skins:
            # bỏ tag [●] nếu lỡ có
            clean = re.sub(r"^\[[^\]]*\]\s*", "", sname).strip()
            skin_codes[f"{name}|{clean}"] = code
            if clean not in seen_names:
                seen_names.add(clean)
                skin_names.append(clean)
        catalog[name] = skin_names

        if write_sources:
            write_sources_bot(name, [(c, re.sub(r"^\[[^\]]*\]\s*", "", n).strip()) for c, n in skins])
            sources_written += 1

    # dọn folder Sources_Bot tên sai (EX/Edras/…) nếu đã tạo bản đúng
    if write_sources:
        for bad, pfx in BAD_NAME_PREFIX.items():
            # nếu prefix này đã có tên đúng khác
            good = next((n for n, info in hero_data.items() if info.get("prefix") == pfx), None)
            bad_dir = SOURCES_BOT / bad
            if good and good != bad and bad_dir.is_dir():
                try:
                    import shutil
                    shutil.rmtree(bad_dir)
                    name_notes.append(f"removed wrong Sources_Bot/{bad} (→ {good})")
                except Exception:
                    pass

    catalog_sorted = {k: catalog[k] for k in sorted(catalog.keys(), key=lambda x: x.lower())}

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
            "name_notes": name_notes,
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
    # chỉ in note quan trọng (trùng tên / dọn folder sai)
    notes = [s for s in st.get("name_notes") or [] if "trùng" in s or "removed" in s or "→" not in s or s.count("→") > 1]
    # luôn in vài id đặc biệt để kiểm tra
    check = [s for s in st.get("name_notes") or [] if any(x in s for x in ("159 ", "194 ", "577 ", "593 ", "595 ", "582 ", "584 "))]
    if check:
        print("🔎 Check id→tên:")
        for s in check:
            print(f"   - {s}")
    if notes:
        print(f"📝 Notes ({len(notes)}):")
        for s in notes[:20]:
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
