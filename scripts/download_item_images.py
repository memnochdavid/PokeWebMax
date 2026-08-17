#!/usr/bin/env python3
"""Descarga las imágenes de objetos listadas en scripts/links.txt (nombre\tURL,
generado a partir del dump local de WikiDex) a scripts/item_images/, con nombre de
fichero en el mismo estilo que el resto de assets del proyecto (minúsculas, sin
tildes, guion bajo — ver frontend/src/utils/animatedSprite.js).

Uso: python3 scripts/download_item_images.py
"""

import json
import re
import time
import unicodedata
from pathlib import Path

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
LINKS_FILE = SCRIPT_DIR / "links.txt"
# David movió los PNG descargados aquí a mano y los ignoró en git (ver
# frontend/.gitignore) — mismo criterio que public/animated/ y public/sprites_home/.
OUTPUT_DIR = SCRIPT_DIR.parent / "frontend" / "public" / "objects"
# Nombre -> fichero final (con el sufijo de desambiguación si lo tuvo, ver
# build_filenames) — fuente de verdad para cualquier otro script que necesite saber
# qué fichero corresponde a qué objeto (ej. build_item_icon_map.py), en vez de
# recalcular el slug y arriesgarse a no reproducir la desambiguación de colisiones.
MANIFEST_FILE = SCRIPT_DIR / "item_images_manifest.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/139.0 Safari/537.36"
    )
}

DELAY = 0.2


def slugify(text):
    normalized = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(c for c in normalized if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")


def base_name(full_name):
    """El nombre 'primario' antes de la barra ('Elíxir/Elixir' -> 'Elíxir')."""
    return full_name.split("/")[0].strip()


def qualifier(full_name):
    """Sufijo entre paréntesis al final del nombre, si lo hay (en cualquiera de
    los dos lados de la barra, ej. 'Pesabola/Peso Ball (Hisui)' -> 'Hisui') — se
    usa solo para desambiguar colisiones de slug, no en el nombre normal."""
    match = re.search(r"\(([^()]+)\)\s*$", full_name.strip())
    return match.group(1) if match else None


def read_links():
    items = []
    with LINKS_FILE.open(encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            name, url = line.split("\t")
            items.append((name, url))
    return items


def build_filenames(items):
    """Devuelve [(name, url, filename)] con slugs únicos — desambigua colisiones
    con el calificador entre paréntesis del nombre completo, o si no hay, con un
    sufijo numérico como último recurso."""
    base_slugs = [slugify(base_name(name)) for name, _ in items]
    counts = {}
    for slug in base_slugs:
        counts[slug] = counts.get(slug, 0) + 1

    seen = {}
    result = []
    for (name, url), slug in zip(items, base_slugs):
        final_slug = slug
        if counts[slug] > 1:
            qual = qualifier(name)
            if qual:
                final_slug = f"{slug}_{slugify(qual)}"
            if final_slug in seen:
                n = seen.get(final_slug, 1) + 1
                final_slug = f"{slug}_{n}"
        seen[final_slug] = seen.get(final_slug, 0) + 1
        ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
        result.append((name, url, f"{final_slug}.{ext}"))
    return result


def download(session, url, destination):
    try:
        response = session.get(url, timeout=60, stream=True)
        response.raise_for_status()
        with destination.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)
        return True
    except Exception as e:
        print(f"    ERROR: {e}")
        return False


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    items = read_links()
    print(f"{len(items)} objetos en {LINKS_FILE}")

    planned = build_filenames(items)

    session = requests.Session()
    session.headers.update(HEADERS)

    downloaded = 0
    skipped = 0
    errors = 0

    for i, (name, url, filename) in enumerate(planned, start=1):
        destination = OUTPUT_DIR / filename

        if destination.exists():
            skipped += 1
            print(f"[{i:4d}/{len(planned)}] YA EXISTE  {filename}")
            continue

        print(f"[{i:4d}/{len(planned)}] bajando    {filename}  ({name})")
        if download(session, url, destination):
            downloaded += 1
        else:
            errors += 1

        time.sleep(DELAY)

    with MANIFEST_FILE.open("w", encoding="utf-8") as f:
        json.dump(
            {name: filename for name, _url, filename in planned},
            f,
            ensure_ascii=False,
            indent=1,
            sort_keys=True,
        )
    print(f"\nmanifiesto escrito: {MANIFEST_FILE}")

    print()
    print(f"Descargados : {downloaded}")
    print(f"Ya existían : {skipped}")
    print(f"Errores     : {errors}")
    print(f"Destino     : {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
