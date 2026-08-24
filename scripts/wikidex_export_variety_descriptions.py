#!/usr/bin/env python3
"""Vuelca a un JSON intermedio las descripciones propias de Megaevolución/Gigamax de
scripts/wikidex_dump/wikidex.sqlite, listo para que el comando Symfony
`app:wikidex:import-varieties` lo cruce con la caché de `pokemon-species`/`pokemon` de
PokeAPI. Mismo reparto Python/PHP que wikidex_export_flavor_text.py (ver ese archivo) —
aquí Python solo extrae texto por FORMA (mega/mega-x/mega-y/mega-z/gmax), el PHP decide
a qué `pokemon` (variante) cacheado de PokeAPI corresponde cada forma.
"""

import argparse
import json
import sqlite3
from pathlib import Path

from wikidex_parser import DEFAULT_DB_PATH, find_template_block, parse_variety_descriptions

DEFAULT_OUT_PATH = (
    Path(__file__).parent.parent / "backend" / "var" / "wikidex_import" / "variety_descriptions.json"
)


def export_variety_descriptions(db_path):
    """Todas las páginas del dump con un bloque {{Pokédex}} real (páginas de especie,
    descarta TCG/spin-offs con "Mega"/"Gigamax" en el título por otros motivos) que
    además tengan alguna sección de Mega/Gigamax parseable -> lista de
    {"title": ..., "varieties": {forma: texto, ...}}."""
    con = sqlite3.connect(db_path)
    cur = con.execute(
        "SELECT title, wikitext FROM pages WHERE wikitext LIKE '%{{Pokédex%' "
        "AND (wikitext LIKE '%Mega-%' OR wikitext LIKE '%Gigamax%')"
    )

    entries = []
    for title, wikitext in cur.fetchall():
        if find_template_block(wikitext, "Pokédex") is None:
            continue
        varieties = parse_variety_descriptions(wikitext)
        if varieties:
            entries.append({"title": title, "varieties": varieties})
    return entries


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Ruta a wikidex.sqlite")
    parser.add_argument("--out", default=str(DEFAULT_OUT_PATH), help="Ruta del JSON de salida")
    args = parser.parse_args()

    entries = export_variety_descriptions(args.db)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")

    total_varieties = sum(len(e["varieties"]) for e in entries)
    print(f"{len(entries)} páginas exportadas, {total_varieties} formas mega/gmax -> {out_path}")


if __name__ == "__main__":
    _main()
