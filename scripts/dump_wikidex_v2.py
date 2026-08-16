#!/usr/bin/env python3

"""
WikiDex offline dump - versión optimizada y reanudable.

Primera descarga:

    python dump_wikidex.py \
        --no-html \
        --no-relations \
        --delay 0.75 \
        --cooldown 10 \
        --cooldown-every 50 \
        --batch-size 50

Reanudar una descarga interrumpida:

    python dump_wikidex.py \
        --resume \
        --no-html \
        --no-relations \
        --delay 0.75 \
        --cooldown 10 \
        --cooldown-every 50 \
        --batch-size 50

Actualización completa posterior:

    python dump_wikidex.py \
        --update \
        --no-html \
        --no-relations

HTML:

    --html

JSON:

    --no-json

Relaciones:

    --relations

Por defecto:
- wikitext: SÍ
- JSON: SÍ
- HTML: NO
- categorías/enlaces: NO
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

import requests


# ============================================================
# CONFIGURACIÓN
# ============================================================

WIKIDEX_API = "https://www.wikidex.net/api.php"

MAIN_NAMESPACE = 0

DEFAULT_OUTPUT = "wikidex_dump"

DEFAULT_DELAY = 0.75

DEFAULT_COOLDOWN = 10.0

DEFAULT_COOLDOWN_EVERY = 50

DEFAULT_BATCH_SIZE = 50

DEFAULT_TIMEOUT = 90

DEFAULT_RETRIES = 7

USER_AGENT = (
    "PersonalWikiDexOfflineDump/3.0 "
    "(personal offline application; MediaWiki API client)"
)


# ============================================================
# UTILIDADES
# ============================================================

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_filename(title: str) -> str:

    forbidden = '<>:"/\\|?*'

    result = "".join(
        "_"
        if c in forbidden
        else c
        for c in title
    )

    result = result.strip().rstrip(".")

    if not result:
        result = "untitled"

    return result[:180]


def sleep_message(seconds: float, reason: str):

    if seconds <= 0:
        return

    print(
        f"\nCooldown: {seconds:.1f}s — {reason}",
        flush=True,
    )

    time.sleep(seconds)


# ============================================================
# CLIENTE API
# ============================================================

class WikiDexClient:

    def __init__(
        self,
        delay: float,
        cooldown: float,
        cooldown_every: int,
        timeout: int,
        retries: int,
    ):

        self.session = requests.Session()

        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })

        self.delay = max(0.0, delay)

        self.cooldown = max(
            0.0,
            cooldown,
        )

        self.cooldown_every = max(
            1,
            cooldown_every,
        )

        self.timeout = timeout

        self.retries = retries

        self.request_count = 0

    # --------------------------------------------------------
    # Rate limiting
    # --------------------------------------------------------

    def before_request(self):

        self.request_count += 1

        if (
            self.request_count > 1
            and self.request_count % self.cooldown_every == 0
        ):
            sleep_message(
                self.cooldown,
                f"cada {self.cooldown_every} peticiones",
            )

        if self.delay > 0:
            time.sleep(self.delay)

    # --------------------------------------------------------
    # HTTP
    # --------------------------------------------------------

    def request(
        self,
        params: dict,
        method: str = "POST",
    ):

        last_error = None

        for attempt in range(
            1,
            self.retries + 1,
        ):

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
                # Rate limit
                # ------------------------------------------------

                if response.status_code == 429:

                    retry_after = (
                        response.headers.get(
                            "Retry-After"
                        )
                    )

                    if retry_after:

                        try:
                            wait = float(
                                retry_after
                            )

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

                    wait += random.uniform(
                        0,
                        2,
                    )

                    print(
                        f"\nHTTP 429. "
                        f"Esperando {wait:.1f}s "
                        f"({attempt}/{self.retries})...",
                        file=sys.stderr,
                    )

                    time.sleep(wait)

                    continue

                # ------------------------------------------------
                # Errores temporales
                # ------------------------------------------------

                if response.status_code in (
                    500,
                    502,
                    503,
                    504,
                ):

                    retry_after = (
                        response.headers.get(
                            "Retry-After"
                        )
                    )

                    if retry_after:

                        try:
                            wait = float(
                                retry_after
                            )

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

                    wait += random.uniform(
                        0,
                        2,
                    )

                    print(
                        f"\nHTTP {response.status_code}. "
                        f"Esperando {wait:.1f}s...",
                        file=sys.stderr,
                    )

                    time.sleep(wait)

                    continue

                response.raise_for_status()

                data = response.json()

                if "error" in data:

                    error = data["error"]

                    raise RuntimeError(
                        f"MediaWiki API error "
                        f"{error.get('code')}: "
                        f"{error.get('info')}"
                    )

                return data

            except (
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.ChunkedEncodingError,
                requests.exceptions.RequestException,
            ) as exc:

                last_error = exc

                if attempt >= self.retries:
                    break

                wait = min(
                    120,
                    2 ** attempt,
                )

                wait += random.uniform(
                    0,
                    2,
                )

                print(
                    f"\nConexión interrumpida: {exc}",
                    file=sys.stderr,
                )

                print(
                    f"Reintentando en {wait:.1f}s "
                    f"({attempt}/{self.retries})...",
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

                wait += random.uniform(
                    0,
                    2,
                )

                print(
                    f"\nError: {exc}",
                    file=sys.stderr,
                )

                print(
                    f"Reintentando en {wait:.1f}s...",
                    file=sys.stderr,
                )

                time.sleep(wait)

        raise RuntimeError(
            "No se pudo completar la petición después de "
            f"{self.retries} intentos: {last_error}"
        )

    # --------------------------------------------------------
    # Enumerar artículos
    # --------------------------------------------------------

    def enumerate_pages(
        self,
        start_title: str | None = None,
    ):

        params = {
            "action": "query",

            "list": "allpages",

            "apnamespace": MAIN_NAMESPACE,

            "aplimit": "max",

            "apfilterredir": "nonredirects",

            "format": "json",
        }

        if start_title:

            params["apfrom"] = start_title

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

            continuation = data.get(
                "continue"
            )

            if not continuation:
                break

            params["apcontinue"] = (
                continuation["apcontinue"]
            )

    # --------------------------------------------------------
    # Descargar artículos
    # --------------------------------------------------------

    def get_pages(
        self,
        titles: list[str],
        include_relations: bool,
    ):

        if not titles:
            return []

        params = {
            "action": "query",

            "format": "json",

            "titles": "|".join(titles),

            "prop": "info|revisions",

            "inprop": "url",

            "rvprop": "ids|timestamp|content",

            "rvslots": "main",

            "redirects": "1",
        }

        # Relaciones son opcionales.
        #
        # Dejarlas fuera hace la petición bastante más ligera.
        if include_relations:

            params["prop"] = (
                "info|revisions|categories|links"
            )

            params["cllimit"] = "max"

            params["pllimit"] = "max"

        data = self.request(
            params,
            method="POST",
        )

        result = []

        pages = (
            data
            .get("query", {})
            .get("pages", {})
        )

        for page in pages.values():

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

            content = main_slot.get("*")

            if content is None:

                content = main_slot.get(
                    "content"
                )

            if content is None:

                content = revision.get("*")

            categories = []

            links = []

            if include_relations:

                categories = [
                    x.get("title")
                    for x in page.get(
                        "categories",
                        [],
                    )
                    if x.get("title")
                ]

                links = [
                    x.get("title")
                    for x in page.get(
                        "links",
                        [],
                    )
                    if x.get("title")
                ]

            result.append({

                "page_id": page.get(
                    "pageid"
                ),

                "namespace": page.get(
                    "ns"
                ),

                "title": page.get(
                    "title"
                ),

                "canonical_url": page.get(
                    "fullurl"
                ),

                "redirect": (
                    "redirect" in page
                ),

                "revision_id": revision.get(
                    "revid"
                ),

                "revision_timestamp": (
                    revision.get(
                        "timestamp"
                    )
                ),

                "wikitext": content or "",

                "categories": categories,

                "links": links,
            })

        return result

    # --------------------------------------------------------
    # HTML
    # --------------------------------------------------------

    def parse_html(
        self,
        wikitext: str,
        title: str,
    ):

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
# DATABASE
# ============================================================

def create_database(
    path: Path,
):

    conn = sqlite3.connect(
        path,
        timeout=60,
    )

    conn.execute(
        "PRAGMA journal_mode=WAL"
    )

    conn.execute(
        "PRAGMA synchronous=NORMAL"
    )

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
        CREATE INDEX IF NOT EXISTS
        idx_pages_title
        ON pages(title)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_pages_revision
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
        CREATE INDEX IF NOT EXISTS
        idx_categories_category
        ON categories(category)
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS metadata (

            key TEXT PRIMARY KEY,

            value TEXT NOT NULL
        )
    """)

    try:

        conn.execute("""
            CREATE VIRTUAL TABLE
            IF NOT EXISTS pages_fts

            USING fts5(
                title,
                wikitext,
                content='pages',
                content_rowid='page_id'
            )
        """)

    except sqlite3.OperationalError:

        print(
            "WARNING: FTS5 no disponible.",
            file=sys.stderr,
        )

    conn.commit()

    return conn


def get_metadata(
    conn,
    key,
):

    row = conn.execute(
        """
        SELECT value
        FROM metadata
        WHERE key = ?
        """,
        (key,),
    ).fetchone()

    return row[0] if row else None


def set_metadata(
    conn,
    key,
    value,
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


def get_revision(
    conn,
    page_id,
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


# ============================================================
# GUARDAR PÁGINA
# ============================================================

def save_page(
    conn,
    page,
    html=None,
):

    page_id = page["page_id"]

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
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
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

    # Solo actualizamos relaciones si se han solicitado.
    if page["categories"]:

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

    if page["links"]:

        conn.execute(
            """
            DELETE FROM page_links
            WHERE page_id = ?
            """,
            (page_id,),
        )

        for link in page["links"]:

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
                    link,
                ),
            )


# ============================================================
# JSON
# ============================================================

def save_json(
    page,
    directory,
    html,
):

    path = (
        directory
        / (
            safe_filename(
                page["title"]
            )
            + ".json"
        )
    )

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
    ) as f:

        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2,
        )


# ============================================================
# FTS
# ============================================================

def rebuild_fts(conn):

    try:

        print(
            "\nActualizando índice de búsqueda..."
        )

        conn.execute(
            "DELETE FROM pages_fts"
        )

        conn.execute("""
            INSERT INTO pages_fts(
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

        pass


# ============================================================
# PROCESAR LOTE
# ============================================================

def process_batch(
    client,
    conn,
    titles,
    args,
    pages_dir,
):

    pages = client.get_pages(
        titles,
        include_relations=(
            args.relations
        ),
    )

    downloaded = 0

    skipped = 0

    last_title = None

    for page in pages:

        page_id = page["page_id"]

        if page_id is None:
            continue

        last_title = page["title"]

        existing_revision = (
            get_revision(
                conn,
                page_id,
            )
        )

        # En modo update, no reescribir páginas
        # que no han cambiado.
        if (
            args.update
            and existing_revision is not None
            and existing_revision == page["revision_id"]
        ):

            skipped += 1

            continue

        html = None

        if args.html:

            try:

                print(
                    f"\nHTML: {page['title']}",
                    flush=True,
                )

                html = client.parse_html(
                    page["wikitext"],
                    page["title"],
                )

            except Exception as exc:

                print(
                    f"\nWARNING HTML "
                    f"{page['title']}: {exc}",
                    file=sys.stderr,
                )

        save_page(
            conn,
            page,
            html,
        )

        # Commit inmediato.
        conn.commit()

        if pages_dir is not None:

            save_json(
                page,
                pages_dir,
                html,
            )

        downloaded += 1

    # Guardamos el cursor DESPUÉS de guardar el lote.
    if last_title:

        set_metadata(
            conn,
            "resume_title",
            last_title,
        )

        set_metadata(
            conn,
            "resume_updated_at",
            utc_now(),
        )

        conn.commit()

    return downloaded, skipped


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Descarga WikiDex de forma "
            "reanudable."
        )
    )

    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
    )

    parser.add_argument(
        "--resume",
        action="store_true",
        help=(
            "Continúa desde el último título "
            "guardado en SQLite."
        ),
    )

    parser.add_argument(
        "--update",
        action="store_true",
        help=(
            "Recorre todo WikiDex y actualiza "
            "páginas cuya revisión haya cambiado."
        ),
    )

    parser.add_argument(
        "--html",
        action="store_true",
        help=(
            "Genera HTML. Aumenta considerablemente "
            "las peticiones."
        ),
    )

    parser.add_argument(
        "--no-html",
        action="store_true",
        help=(
            "No genera HTML."
        ),
    )

    parser.add_argument(
        "--no-json",
        action="store_true",
        help=(
            "No genera JSON."
        ),
    )

    parser.add_argument(
        "--relations",
        action="store_true",
        help=(
            "Descarga categorías y enlaces "
            "mediante la API."
        ),
    )

    parser.add_argument(
        "--no-relations",
        action="store_true",
        help=(
            "No descarga categorías/enlaces."
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
    )

    parser.add_argument(
        "--cooldown",
        type=float,
        default=DEFAULT_COOLDOWN,
    )

    parser.add_argument(
        "--cooldown-every",
        type=int,
        default=DEFAULT_COOLDOWN_EVERY,
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
    )

    parser.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_RETRIES,
    )

    args = parser.parse_args()

    # --------------------------------------------------------
    # Defaults
    # --------------------------------------------------------

    if args.no_html:

        args.html = False

    if args.no_relations:

        args.relations = False

    # Si no se especifica ninguna opción de relaciones,
    # por defecto NO las descargamos.
    #
    # Esto es intencionado para el dump principal.

    # --------------------------------------------------------
    # Output
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
    # DB
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
        "last_run_started",
        utc_now(),
    )

    conn.commit()

    # --------------------------------------------------------
    # Resume
    # --------------------------------------------------------

    start_title = None

    if args.resume:

        start_title = get_metadata(
            conn,
            "resume_title",
        )

        if start_title:

            print(
                f"\nReanudando después de: "
                f"{start_title}"
            )

        else:

            print(
                "\nNo hay cursor guardado. "
                "Comenzando desde el principio."
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
    # Info
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("WikiDex offline dump - optimizado")
    print("=" * 60)
    print()

    print(
        f"Salida:       {output.resolve()}"
    )

    print(
        f"SQLite:       {db_path.resolve()}"
    )

    print(
        f"JSON:         {'SÍ' if not args.no_json else 'NO'}"
    )

    print(
        f"HTML:         {'SÍ' if args.html else 'NO'}"
    )

    print(
        f"Relaciones:   {'SÍ' if args.relations else 'NO'}"
    )

    print(
        f"Delay:        {args.delay}s"
    )

    print(
        f"Cooldown:     {args.cooldown}s"
    )

    print(
        f"Cooldown cada:{args.cooldown_every} peticiones"
    )

    print(
        f"Lote:         {args.batch_size}"
    )

    print()

    # --------------------------------------------------------
    # Descarga
    # --------------------------------------------------------

    started = time.time()

    processed = 0

    downloaded = 0

    skipped = 0

    buffer = []

    try:

        for page_info in client.enumerate_pages(
            start_title=start_title,
        ):

            title = page_info.get(
                "title"
            )

            if not title:
                continue

            # Si estamos reanudando, allpages incluye el
            # título de inicio. Lo saltamos porque ya fue
            # guardado en el lote anterior.
            if (
                args.resume
                and start_title
                and title == start_title
            ):

                continue

            buffer.append(title)

            if len(buffer) < args.batch_size:

                continue

            # Respetar limit.
            if args.limit is not None:

                remaining = (
                    args.limit
                    - processed
                )

                if remaining <= 0:

                    break

                current = (
                    buffer[:remaining]
                )

            else:

                current = buffer

            d, s = process_batch(
                client,
                conn,
                current,
                args,
                pages_dir,
            )

            downloaded += d

            skipped += s

            processed += len(
                current
            )

            buffer = []

            elapsed = (
                time.time()
                - started
            )

            rate = (
                downloaded / elapsed
                if elapsed > 0
                else 0
            )

            total = (
                conn.execute(
                    "SELECT COUNT(*) FROM pages"
                ).fetchone()[0]
            )

            print(
                f"\rArtículos procesados: "
                f"{processed:,} | "
                f"total DB: {total:,} | "
                f"descargados: {downloaded:,} | "
                f"sin cambios: {skipped:,} | "
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

        if buffer:

            if args.limit is not None:

                remaining = (
                    args.limit
                    - processed
                )

                if remaining > 0:

                    buffer = (
                        buffer[:remaining]
                    )

                else:

                    buffer = []

            if buffer:

                d, s = process_batch(
                    client,
                    conn,
                    buffer,
                    args,
                    pages_dir,
                )

                downloaded += d

                skipped += s

                processed += len(
                    buffer
                )

    except KeyboardInterrupt:

        print()
        print()
        print(
            "Interrumpido por Ctrl+C."
        )

        print(
            "Todo lo guardado en SQLite "
            "permanece intacto."
        )

        cursor = get_metadata(
            conn,
            "resume_title",
        )

        if cursor:

            print()
            print(
                "Último cursor guardado:"
            )

            print(
                f"  {cursor}"
            )

            print()
            print(
                "Para continuar:"
            )

            print(
                "  python dump_wikidex.py "
                "--resume --no-html "
                "--no-relations"
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
        "download_complete",
        "true",
    )

    conn.commit()

    # --------------------------------------------------------
    # Estadísticas
    # --------------------------------------------------------

    total = conn.execute(
        "SELECT COUNT(*) FROM pages"
    ).fetchone()[0]

    elapsed = (
        time.time()
        - started
    )

    conn.close()

    print()
    print()
    print("=" * 60)
    print("DESCARGA TERMINADA")
    print("=" * 60)
    print()

    print(
        f"Artículos en DB: {total:,}"
    )

    print(
        f"Procesados:      {processed:,}"
    )

    print(
        f"Descargados:     {downloaded:,}"
    )

    print(
        f"Sin cambios:     {skipped:,}"
    )

    print(
        f"Tiempo:          "
        f"{elapsed / 60:.1f} minutos"
    )

    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
