#!/usr/bin/env python3
"""Vuelca a un JSON intermedio el texto de '== Efecto ==' de TODAS las páginas del
dump de WikiDex que tengan esa sección — no solo habilidades/movimientos, cualquier
página con ese encabezado (ítems, bayas, cartas TCG... hay 2748 en total, ver
.claude/memory/project_pokewebmax_progress.md). Deliberadamente no se filtra aquí por
tipo de página: el comando de importación en PHP (`app:wikidex:import-effects`) es
quien sabe qué nombres de habilidad/movimiento está buscando (via
`effect_title_candidates()` en PHP, mismo criterio que este propio parser) y descarta
lo que no le sirve — mismo reparto de responsabilidades que
wikidex_export_flavor_text.py (Python solo extrae texto, PHP hace el cruce).
"""

import argparse
import json
import sqlite3
from pathlib import Path

from wikidex_parser import DEFAULT_DB_PATH, parse_effect

DEFAULT_OUT_PATH = (
    Path(__file__).parent.parent / "backend" / "var" / "wikidex_import" / "effects.json"
)


def export_effects(db_path, variant="es"):
    con = sqlite3.connect(db_path)
    cur = con.execute("SELECT title, wikitext FROM pages WHERE wikitext LIKE '%== Efecto ==%'")

    entries = []
    for title, wikitext in cur.fetchall():
        text = parse_effect(wikitext, variant=variant)
        if text:
            entries.append({"title": title, "text": text})
    return entries


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Ruta a wikidex.sqlite")
    parser.add_argument("--out", default=str(DEFAULT_OUT_PATH), help="Ruta del JSON de salida")
    parser.add_argument("--variant", choices=["es", "ha"], default="es")
    args = parser.parse_args()

    entries = export_effects(args.db, variant=args.variant)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(entries)} páginas con sección Efecto exportadas -> {out_path}")


if __name__ == "__main__":
    _main()
