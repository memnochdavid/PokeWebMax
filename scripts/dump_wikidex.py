#!/usr/bin/env python3

"""
WikiDex offline dump.

Descarga artículos de WikiDex mediante la API de MediaWiki y los guarda
localmente en SQLite, con JSON opcional.

Características:

- Descarga artículos del namespace principal.
- Guarda wikitext completo.
- SQLite como almacenamiento principal.
- JSON individual opcional.
- HTML opcional mediante action=parse.
- Rate limiting.
- Cooldown periódico.
- Retry-After.
- Backoff exponencial.
- Reintentos ante desconexiones.
- Reanudación segura.
- Modo actualización incremental.
- Índice FTS5 para búsquedas offline.

Ejemplos:

    # Prueba de 20 páginas
    python dump_wikidex.py --limit 20

    # Descarga recomendada
    python dump_wikidex.py --no-html --delay 1.0

    # Más conservador
    python dump_wikidex.py --no-html --delay 1.5 \
        --cooldown-every 25 \
        --cooldown 15

    # Con HTML
    python dump_wikidex.py --html

    # Sin JSON individuales
    python dump_wikidex.py --no-json

    # Actualizar una copia existente
    python dump_wikidex.py --update --no-html

    # Otra carpeta de destino
    python dump_wikidex.py --output /ruta/wikidex
"""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import requests


# ============================================================
# CONFIGURACIÓN
# ============================================================

WIKIDEX_API = "https://www.wikidex.net/api.php"

MAIN_NAMESPACE = 0

DEFAULT_OUTPUT = "wikidex_dump"

DEFAULT_DELAY = 1.0

DEFAULT_COOLDOWN = 15.0

DEFAULT_COOLDOWN_EVERY = 50

DEFAULT_BATCH_SIZE = 25

DEFAULT_TIMEOUT = 90

DEFAULT_RETRIES = 7

USER_AGENT = (
    "PersonalWikiDexOfflineDump/2.0 "
    "(offline personal application; API client)"
)


# ============================================================
# UTILIDADES
# ============================================================

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def chunks(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def safe_filename(title: str) -> str:
    forbidden = '<>:"/\\|?*'

    result = "".join(
        "_"
        if char in forbidden
        else char
        for char in title
    )

    result = result.strip().rstrip(".")

    if not result:
        result = "untitled"

    # Evita nombres excesivamente largos.
    return result[:180]


def sleep_with_message(seconds: float, reason: str = ""):
    if seconds <= 0:
        return

    if reason:
        print(
            f"\nCooldown: {seconds:.1f}s — {reason}",
            flush=True,
        )

    time.sleep(seconds)


# ============================================================
# CLIENTE WIKIDEX
# ============================================================

class WikiDexClient:

    def __init__(
        self,
        delay: float = DEFAULT_DELAY,
        cooldown: float = DEFAULT_COOLDOWN,
        cooldown_every: int = DEFAULT_COOLDOWN_EVERY,
        timeout: int = DEFAULT_TIMEOUT,
        retries: int = DEFAULT_RETRIES,
    ):
        self.session = requests.Session()

        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })

        self.delay = max(0.0, delay)
        self.cooldown = max(0.0, cooldown)
        self.cooldown_every = max(1, cooldown_every)

        self.timeout = timeout
        self.retries = retries

        self.request_count = 0

    # --------------------------------------------------------
    # Rate limiting
    # --------------------------------------------------------

    def before_request(self):

        self.request_count += 1

        # Cooldown periódico.
        if (
            self.request_count > 1
            and self.request_count % self.cooldown_every == 0
        ):
            sleep_with_message(
                self.cooldown,
                f"cada {self.cooldown_every} peticiones",
            )

        # Delay normal entre peticiones.
        if self.delay > 0:
            time.sleep(self.delay)

    # --------------------------------------------------------
    # HTTP
    # --------------------------------------------------------

    def request(
        self,
        params: dict,
        method: str = "GET",
    ) -> dict:

        last_error = None

        for attempt in range(1, self.retries + 1):

            self.before_request()

            try:

                if method.upper() == "POST":

                    response = self.session.post(
                        WIKIDEX_API,
                        data=params,
                        timeout=self.timeout,
                    )

                else:

                    response = self.session.get(
                        WIKIDEX_API,
                        params=params,
                        timeout=self.timeout,
                    )

                # ------------------------------------------------
                # Rate limit explícito
                # ------------------------------------------------

                if response.status_code == 429:

                    retry_after = response.headers.get(
                        "Retry-After"
                    )

                    if retry_after:

                        try:
                            wait = float(retry_after)

                        except ValueError:
                            wait = min(
                                120,
                                2 ** attempt,
                            )

                    else:

                        wait = min(
                            120,
                            2 ** attempt,
                        )

                    # Algo de jitter evita que varios clientes
                    # vuelvan a golpear el servidor simultáneamente.
                    wait += random.uniform(0, 2)

                    print(
                        f"\nHTTP 429. "
                        f"Esperando {wait:.1f}s "
                        f"(intento {attempt}/{self.retries})...",
                        file=sys.stderr,
                    )

                    time.sleep(wait)

                    continue

                # ------------------------------------------------
                # Errores temporales del servidor
                # ------------------------------------------------

                if response.status_code in (
                    500,
                    502,
                    503,
                    504,
                ):

                    retry_after = response.headers.get(
                        "Retry-After"
                    )

                    if retry_after:

                        try:
                            wait = float(retry_after)

                        except ValueError:
                            wait = min(
                                120,
                                2 ** attempt,
                            )

                    else:

                        wait = min(
                            120,
                            2 ** attempt,
                        )

                    wait += random.uniform(0, 2)

                    print(
                        f"\nHTTP {response.status_code}. "
                        f"Esperando {wait:.1f}s "
                        f"(intento {attempt}/{self.retries})...",
                        file=sys.stderr,
                    )

                    time.sleep(wait)

                    continue

                response.raise_for_status()

                data = response.json()

                if "error" in data:

                    error = data["error"]

                    code = error.get(
                        "code",
                        "unknown",
                    )

                    info = error.get(
                        "info",
                        "",
                    )

                    raise RuntimeError(
                        f"MediaWiki API error "
                        f"{code}: {info}"
                    )

                return data

            except (
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.ChunkedEncodingError,
                requests.exceptions.RequestException,
            ) as exc:

                last_error = exc

                wait = min(
                    120,
                    2 ** attempt,
                )

                # Jitter.
                wait += random.uniform(0, 2)

                if attempt >= self.retries:

                    break

                print(
                    f"\nConexión interrumpida: {exc}",
                    file=sys.stderr,
                )

                print(
                    f"Reintentando en {wait:.1f}s "
                    f"(intento {attempt}/{self.retries})...",
                    file=sys.stderr,
                )

                time.sleep(wait)

            except Exception as exc:

                last_error = exc

                if attempt >= self.retries:
                    break

                wait = min(
                    120,
                    2 ** attempt,
                )

                wait += random.uniform(0, 2)

                print(
                    f"\nError: {exc}",
                    file=sys.stderr,
                )

                print(
                    f"Reintentando en {wait:.1f}s "
                    f"(intento {attempt}/{self.retries})...",
                    file=sys.stderr,
                )

                time.sleep(wait)

        raise RuntimeError(
            "No se pudo completar la petición después de "
            f"{self.retries} intentos: {last_error}"
        )

    # --------------------------------------------------------
    # Enumeración
    # --------------------------------------------------------

    def enumerate_pages(self):

        params = {
            "action": "query",
            "list": "allpages",

            "apnamespace": MAIN_NAMESPACE,

            "aplimit": "max",

            # No necesitamos redirecciones como artículos.
            "apfilterredir": "nonredirects",

            "format": "json",
        }

        while True:

            data = self.request(
                params,
                method="GET",
            )

            pages = (
                data
                .get("query", {})
                .get("allpages", [])
            )

            for page in pages:
                yield page

            continuation = data.get("continue")

            if not continuation:
                break

            params["apcontinue"] = continuation["apcontinue"]

    # --------------------------------------------------------
    # Obtener artículos
    # --------------------------------------------------------

    def get_pages(
        self,
        titles: list[str],
    ) -> list[dict]:

        if not titles:
            return []

        params = {
            "action": "query",
            "format": "json",

            "titles": "|".join(titles),

            "prop": "info|revisions|categories|links",

            "inprop": "url",

            "rvprop": "ids|timestamp|content",

            "rvslots": "main",

            "cllimit": "max",

            "pllimit": "max",

            "redirects": "1",
        }

        # POST evita URLs gigantes cuando los títulos son largos.
        data = self.request(
            params,
            method="POST",
        )

        pages = []

        for page in (
            data
            .get("query", {})
            .get("pages", {})
            .values()
        ):

            revisions = page.get(
                "revisions",
                [],
            )

            revision = (
                revisions[0]
                if revisions
                else {}
            )

            slots = revision.get(
                "slots",
                {},
            )

            main_slot = slots.get(
                "main",
                {},
            )

            content = main_slot.get(
                "*"
            )

            if content is None:

                content = main_slot.get(
                    "content"
                )

            # Compatibilidad con respuestas de MediaWiki
            # que usan directamente revision["*"].
            if content is None:

                content = revision.get("*")

            categories = [
                item.get("title")
                for item in page.get(
                    "categories",
                    [],
                )
                if item.get("title")
            ]

            links = [
                item.get("title")
                for item in page.get(
                    "links",
                    [],
                )
                if item.get("title")
            ]

            pages.append({
                "page_id": page.get("pageid"),

                "namespace": page.get("ns"),

                "title": page.get("title"),

                "canonical_url": page.get(
                    "fullurl"
                ),

                "redirect": (
                    "redirect" in page
                ),

                "revision_id": revision.get(
                    "revid"
                ),

                "revision_timestamp": revision.get(
                    "timestamp"
                ),

                "wikitext": content or "",

                "categories": categories,

                "links": links,
            })

        return pages

    # --------------------------------------------------------
    # HTML opcional
    # --------------------------------------------------------

    def parse_html(
        self,
        wikitext: str,
        title: str,
    ) -> str:

        """
        Renderizado HTML opcional.

        IMPORTANTE:
        Esto genera una petición adicional por artículo.

        Por eso NO se utiliza durante el dump normal.
        """

        params = {
            "action": "parse",
            "format": "json",

            "title": title,

            "text": wikitext,

            "contentmodel": "wikitext",

            "prop": "text",
        }

        data = self.request(
            params,
            method="POST",
        )

        return (
            data
            .get("parse", {})
            .get("text", {})
            .get("*", "")
        )


# ============================================================
# SQLITE
# ============================================================

def create_database(
    db_path: Path,
) -> sqlite3.Connection:

    conn = sqlite3.connect(
        db_path,
        timeout=60,
    )

    # Mejor comportamiento ante escrituras.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pages (
            page_id INTEGER PRIMARY KEY,

            namespace INTEGER NOT NULL,

            title TEXT NOT NULL UNIQUE,

            canonical_url TEXT,

            redirect INTEGER NOT NULL DEFAULT 0,

            revision_id INTEGER,

            revision_timestamp TEXT,

            wikitext TEXT NOT NULL,

            html TEXT,

            downloaded_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pages_title
        ON pages(title)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pages_revision
        ON pages(revision_id)
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            page_id INTEGER NOT NULL,

            category TEXT NOT NULL,

            PRIMARY KEY (
                page_id,
                category
            )
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_categories_category

        ON categories(category)
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS page_links (
            page_id INTEGER NOT NULL,

            target_title TEXT NOT NULL,

            PRIMARY KEY (
                page_id,
                target_title
            )
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_page_links_target

        ON page_links(target_title)
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,

            value TEXT NOT NULL
        )
    """)

    # FTS5 puede no estar disponible en algunas compilaciones
    # de SQLite.
    try:

        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts
            USING fts5(
                title,
                wikitext,
                content='pages',
                content_rowid='page_id'
            )
        """)

        conn.commit()

    except sqlite3.OperationalError:

        print(
            "WARNING: SQLite FTS5 no está disponible.",
            file=sys.stderr,
        )

    conn.commit()

    return conn


def get_existing_revision(
    conn: sqlite3.Connection,
    page_id: int,
):

    row = conn.execute(
        """
        SELECT revision_id
        FROM pages
        WHERE page_id = ?
        """,
        (page_id,),
    ).fetchone()

    return row[0] if row else None


def save_page(
    conn: sqlite3.Connection,
    page: dict,
    html: str | None = None,
):

    page_id = page["page_id"]

    # Si no estamos actualizando HTML, conservar el existente.
    if html is None:

        old = conn.execute(
            """
            SELECT html
            FROM pages
            WHERE page_id = ?
            """,
            (page_id,),
        ).fetchone()

        if old:
            html = old[0]

    conn.execute(
        """
        INSERT INTO pages (
            page_id,
            namespace,
            title,
            canonical_url,
            redirect,
            revision_id,
            revision_timestamp,
            wikitext,
            html,
            downloaded_at
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )

        ON CONFLICT(page_id)
        DO UPDATE SET

            namespace =
                excluded.namespace,

            title =
                excluded.title,

            canonical_url =
                excluded.canonical_url,

            redirect =
                excluded.redirect,

            revision_id =
                excluded.revision_id,

            revision_timestamp =
                excluded.revision_timestamp,

            wikitext =
                excluded.wikitext,

            html =
                excluded.html,

            downloaded_at =
                excluded.downloaded_at
        """,
        (
            page_id,

            page["namespace"],

            page["title"],

            page["canonical_url"],

            int(page["redirect"]),

            page["revision_id"],

            page["revision_timestamp"],

            page["wikitext"],

            html,

            utc_now(),
        ),
    )

    conn.execute(
        """
        DELETE FROM categories
        WHERE page_id = ?
        """,
        (page_id,),
    )

    for category in page["categories"]:

        conn.execute(
            """
            INSERT OR IGNORE INTO categories
            (
                page_id,
                category
            )
            VALUES (?, ?)
            """,
            (
                page_id,
                category,
            ),
        )

    conn.execute(
        """
        DELETE FROM page_links
        WHERE page_id = ?
        """,
        (page_id,),
    )

    for target in page["links"]:

        conn.execute(
            """
            INSERT OR IGNORE INTO page_links
            (
                page_id,
                target_title
            )
            VALUES (?, ?)
            """,
            (
                page_id,
                target,
            ),
        )


def rebuild_fts(
    conn: sqlite3.Connection,
):

    try:

        print(
            "\nReconstruyendo índice FTS5..."
        )

        conn.execute(
            "DELETE FROM pages_fts"
        )

        conn.execute("""
            INSERT INTO pages_fts (
                rowid,
                title,
                wikitext
            )

            SELECT
                page_id,
                title,
                wikitext

            FROM pages
        """)

        conn.commit()

    except sqlite3.OperationalError:

        print(
            "FTS5 no disponible; se omite."
        )


# ============================================================
# METADATA
# ============================================================

def set_metadata(
    conn: sqlite3.Connection,
    key: str,
    value: str,
):

    conn.execute(
        """
        INSERT INTO metadata(
            key,
            value
        )

        VALUES (?, ?)

        ON CONFLICT(key)
        DO UPDATE SET
            value = excluded.value
        """,
        (
            key,
            value,
        ),
    )

    conn.commit()


# ============================================================
# JSON
# ============================================================

def save_json(
    page: dict,
    directory: Path,
    html: str | None,
):

    filename = (
        safe_filename(page["title"])
        + ".json"
    )

    path = directory / filename

    data = dict(page)

    if html is not None:
        data["html"] = html

    data["source"] = "WikiDex"

    data["source_url"] = (
        "https://www.wikidex.net/"
    )

    data["license_note"] = (
        "Consulta la información de "
        "copyright/licencias de WikiDex "
        "antes de redistribuir este dataset."
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )


# ============================================================
# PROCESAMIENTO DE LOTES
# ============================================================

def process_batch(
    client: WikiDexClient,
    conn: sqlite3.Connection,
    titles: list[str],
    args,
    pages_dir: Path | None,
):

    pages = client.get_pages(titles)

    downloaded = 0

    skipped = 0

    for page in pages:

        page_id = page["page_id"]

        if page_id is None:
            continue

        existing_revision = get_existing_revision(
            conn,
            page_id,
        )

        # Modo incremental.
        if (
            args.update
            and existing_revision is not None
            and existing_revision == page["revision_id"]
        ):

            skipped += 1

            continue

        html = None

        # HTML es deliberadamente opcional.
        if args.html:

            try:

                print(
                    f"\nRenderizando HTML: "
                    f"{page['title']}",
                    flush=True,
                )

                html = client.parse_html(
                    page["wikitext"],
                    page["title"],
                )

            except Exception as exc:

                print(
                    f"\nWARNING: no se pudo generar "
                    f"HTML para {page['title']}: "
                    f"{exc}",
                    file=sys.stderr,
                )

                # Guardamos igualmente el wikitext.
                html = None

        save_page(
            conn,
            page,
            html,
        )

        # Commit por artículo.
        #
        # Es un poco menos eficiente que hacer un commit por lote,
        # pero garantiza que Ctrl+C deje la base en buen estado.
        conn.commit()

        if pages_dir is not None:

            try:

                save_json(
                    page,
                    pages_dir,
                    html,
                )

            except OSError as exc:

                print(
                    f"\nWARNING: no se pudo guardar JSON "
                    f"para {page['title']}: {exc}",
                    file=sys.stderr,
                )

        downloaded += 1

    return downloaded, skipped


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Descarga WikiDex para uso offline."
        )
    )

    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=(
            "Directorio de salida. "
            f"Default: {DEFAULT_OUTPUT}"
        ),
    )

    parser.add_argument(
        "--html",
        action="store_true",
        help=(
            "Renderiza y guarda HTML. "
            "NO recomendado para el primer dump."
        ),
    )

    parser.add_argument(
        "--no-json",
        action="store_true",
        help=(
            "No crea JSON individuales."
        ),
    )

    parser.add_argument(
        "--update",
        action="store_true",
        help=(
            "Actualiza una copia existente "
            "comparando revision_id."
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help=(
            "Número máximo de artículos. "
            "Útil para pruebas."
        ),
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=(
            "Espera entre peticiones, en segundos. "
            f"Default: {DEFAULT_DELAY}"
        ),
    )

    parser.add_argument(
        "--cooldown",
        type=float,
        default=DEFAULT_COOLDOWN,
        help=(
            "Pausa larga periódica, en segundos. "
            f"Default: {DEFAULT_COOLDOWN}"
        ),
    )

    parser.add_argument(
        "--cooldown-every",
        type=int,
        default=DEFAULT_COOLDOWN_EVERY,
        help=(
            "Número de peticiones entre cooldowns. "
            f"Default: {DEFAULT_COOLDOWN_EVERY}"
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=(
            "Número de títulos por petición. "
            f"Default: {DEFAULT_BATCH_SIZE}"
        ),
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=(
            "Timeout HTTP. "
            f"Default: {DEFAULT_TIMEOUT}s"
        ),
    )

    parser.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_RETRIES,
        help=(
            "Número de reintentos. "
            f"Default: {DEFAULT_RETRIES}"
        ),
    )

    args = parser.parse_args()

    # --------------------------------------------------------
    # Directorios
    # --------------------------------------------------------

    output = Path(
        args.output
    )

    output.mkdir(
        parents=True,
        exist_ok=True,
    )

    db_path = (
        output
        / "wikidex.sqlite"
    )

    pages_dir = None

    if not args.no_json:

        pages_dir = (
            output
            / "pages"
        )

        pages_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

    # --------------------------------------------------------
    # SQLite
    # --------------------------------------------------------

    conn = create_database(
        db_path
    )

    set_metadata(
        conn,
        "source",
        "WikiDex",
    )

    set_metadata(
        conn,
        "source_url",
        "https://www.wikidex.net/",
    )

    set_metadata(
        conn,
        "dump_version",
        "2.0",
    )

    set_metadata(
        conn,
        "last_run_started",
        utc_now(),
    )

    # --------------------------------------------------------
    # Cliente
    # --------------------------------------------------------

    client = WikiDexClient(
        delay=args.delay,
        cooldown=args.cooldown,
        cooldown_every=args.cooldown_every,
        timeout=args.timeout,
        retries=args.retries,
    )

    # --------------------------------------------------------
    # Información
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("WikiDex offline dump")
    print("=" * 60)
    print()

    print(
        f"API:       {WIKIDEX_API}"
    )

    print(
        f"Salida:    {output.resolve()}"
    )

    print(
        f"SQLite:    {db_path.resolve()}"
    )

    print(
        f"JSON:      {'NO' if args.no_json else 'SÍ'}"
    )

    print(
        f"HTML:      {'SÍ' if args.html else 'NO'}"
    )

    print(
        f"Delay:     {args.delay}s"
    )

    print(
        f"Cooldown:  {args.cooldown}s "
        f"cada {args.cooldown_every} peticiones"
    )

    print(
        f"Lote:      {args.batch_size}"
    )

    print(
        f"Timeout:   {args.timeout}s"
    )

    print(
        f"Reintentos:{args.retries}"
    )

    print()

    if args.html:

        print(
            "AVISO: HTML activado."
        )

        print(
            "Esto hará una petición adicional "
            "por artículo."
        )

        print()

    # --------------------------------------------------------
    # Descarga
    # --------------------------------------------------------

    start_time = time.time()

    processed = 0

    downloaded = 0

    skipped = 0

    title_buffer = []

    try:

        for page_info in client.enumerate_pages():

            title = page_info.get(
                "title"
            )

            if not title:
                continue

            title_buffer.append(
                title
            )

            if len(title_buffer) < args.batch_size:
                continue

            # ------------------------------------------------
            # Limit
            # ------------------------------------------------

            if (
                args.limit is not None
                and processed >= args.limit
            ):
                break

            remaining = (
                args.limit - processed
                if args.limit is not None
                else None
            )

            if remaining is not None:

                current_titles = (
                    title_buffer[:remaining]
                )

            else:

                current_titles = (
                    title_buffer
                )

            # ------------------------------------------------
            # Procesar
            # ------------------------------------------------

            try:

                d, s = process_batch(
                    client,
                    conn,
                    current_titles,
                    args,
                    pages_dir,
                )

                downloaded += d
                skipped += s

                processed += len(
                    current_titles
                )

            except Exception as exc:

                print(
                    "\nERROR procesando lote:",
                    exc,
                    file=sys.stderr,
                )

                print(
                    "La base de datos conserva "
                    "los lotes anteriores.",
                    file=sys.stderr,
                )

                raise

            title_buffer = []

            elapsed = (
                time.time()
                - start_time
            )

            rate = (
                downloaded / elapsed
                if elapsed > 0
                else 0
            )

            print(
                f"\rArtículos procesados: "
                f"{processed:,} | "
                f"descargados: "
                f"{downloaded:,} | "
                f"sin cambios: "
                f"{skipped:,} | "
                f"{rate:.2f}/s",
                end="",
                flush=True,
            )

            if (
                args.limit is not None
                and processed >= args.limit
            ):
                break

        # ----------------------------------------------------
        # Último lote
        # ----------------------------------------------------

        if (
            title_buffer
            and (
                args.limit is None
                or processed < args.limit
            )
        ):

            remaining = (
                args.limit - processed
                if args.limit is not None
                else None
            )

            if remaining is not None:

                title_buffer = (
                    title_buffer[:remaining]
                )

            d, s = process_batch(
                client,
                conn,
                title_buffer,
                args,
                pages_dir,
            )

            downloaded += d
            skipped += s

            processed += len(
                title_buffer
            )

    except KeyboardInterrupt:

        print()
        print()
        print(
            "Descarga interrumpida por el usuario."
        )

        print(
            "Los artículos ya guardados "
            "permanecen en SQLite."
        )

        print(
            "Puedes ejecutar el programa "
            "de nuevo."
        )

        conn.close()

        return 0

    # --------------------------------------------------------
    # FTS
    # --------------------------------------------------------

    rebuild_fts(
        conn
    )

    set_metadata(
        conn,
        "last_run_finished",
        utc_now(),
    )

    set_metadata(
        conn,
        "pages_processed",
        str(processed),
    )

    set_metadata(
        conn,
        "pages_downloaded",
        str(downloaded),
    )

    # --------------------------------------------------------
    # Estadísticas
    # --------------------------------------------------------

    total = conn.execute(
        "SELECT COUNT(*) FROM pages"
    ).fetchone()[0]

    category_count = conn.execute(
        "SELECT COUNT(*) FROM categories"
    ).fetchone()[0]

    link_count = conn.execute(
        "SELECT COUNT(*) FROM page_links"
    ).fetchone()[0]

    elapsed = (
        time.time()
        - start_time
    )

    conn.close()

    print()
    print()
    print("=" * 60)
    print("DESCARGA TERMINADA")
    print("=" * 60)
    print()

    print(
        f"Artículos SQLite : {total:,}"
    )

    print(
        f"Categorías       : {category_count:,}"
    )

    print(
        f"Enlaces           : {link_count:,}"
    )

    print(
        f"Procesados        : {processed:,}"
    )

    print(
        f"Descargados       : {downloaded:,}"
    )

    print(
        f"Sin cambios       : {skipped:,}"
    )

    print(
        f"Tiempo            : "
        f"{elapsed / 60:.1f} minutos"
    )

    print()

    print(
        "Base de datos:"
    )

    print(
        f"  {db_path.resolve()}"
    )

    if pages_dir:

        print()

        print(
            "JSON:"
        )

        print(
            f"  {pages_dir.resolve()}"
        )

    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
