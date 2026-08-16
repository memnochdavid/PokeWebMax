#!/usr/bin/env python3
"""Vuelca las descripciones Pokédex de scripts/wikidex_dump/wikidex.sqlite a un JSON
intermedio, listo para que el comando Symfony `app:wikidex:import` lo lea y lo cruce
con la caché de especies de PokeAPI.

Corre en Python (no en el contenedor backend) porque `docker-compose.yml` solo monta
`./backend`, no `./scripts` — y porque el parser de wikitext (wikidex_parser.py) ya
está escrito y validado aquí, sin necesidad de reimplementarlo en PHP ni de añadir
pdo_sqlite al backend.Dockerfile solo para una importación puntual. Ver paso 4 de
.claude/memory/project_pokewebmax_wikidex_dump_analysis.md.

El PHP no ve wikitext ni títulos de WikiDex en ningún momento — solo `version` slugs de
PokeAPI (ya resueltos aquí) y el título de la página, que el comando de importación
cruza contra `species.names[es].name` para encontrar el pokemon-species real.
"""

import argparse
import json
import sqlite3
from pathlib import Path

from wikidex_parser import DEFAULT_DB_PATH, find_template_block, pokedex_by_pokeapi_version

DEFAULT_OUT_PATH = (
    Path(__file__).parent.parent / "backend" / "var" / "wikidex_import" / "flavor_text.json"
)


def export_flavor_text(db_path, variant="es"):
    """Todas las páginas del dump con un bloque {{Pokédex}} real -> lista de
    {"title": ..., "versions": {slug_pokeapi: texto, ...}}. Se omiten las páginas cuyo
    bloque no aportó ninguna entrada mapeable a un `version` de PokeAPI (spin-offs
    puros, o bloque vacío)."""
    con = sqlite3.connect(db_path)
    cur = con.execute("SELECT title, wikitext FROM pages WHERE wikitext LIKE '%{{Pokédex%'")

    entries = []
    for title, wikitext in cur.fetchall():
        if find_template_block(wikitext, "Pokédex") is None:
            continue
        versions = pokedex_by_pokeapi_version(wikitext, variant=variant)
        if versions:
            entries.append({"title": title, "versions": versions})
    return entries


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Ruta a wikidex.sqlite")
    parser.add_argument("--out", default=str(DEFAULT_OUT_PATH), help="Ruta del JSON de salida")
    parser.add_argument("--variant", choices=["es", "ha"], default="es")
    args = parser.parse_args()

    entries = export_flavor_text(args.db, variant=args.variant)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")

    total_versions = sum(len(e["versions"]) for e in entries)
    print(f"{len(entries)} páginas exportadas, {total_versions} entradas versión -> {out_path}")


if __name__ == "__main__":
    _main()
