#!/usr/bin/env python3

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests


# ============================================================
# CONFIGURACIÓN
# ============================================================

OUTPUT_DIR = Path("dinamax_live_sprites")

MANIFEST_FILE = OUTPUT_DIR / "manifest.json"

DELAY = 0.75

TIMEOUT = 90

RETRIES = 7

USER_AGENT = (
    "PokeWebMax-PersonalOfflineDownloader/1.0 "
    "(personal use)"
)


# ============================================================
# DATOS
# ============================================================

SPRITES = [
    (10196, "https://images.wikidexcdn.net/mwuploads/wikidex/9/98/latest/20191206054551/Charizard_Gigamax_EpEc.gif"),
    (10198, "https://images.wikidexcdn.net/mwuploads/wikidex/f/f2/latest/20191208035316/Butterfree_Gigamax_EpEc.gif"),
    (10199, "https://images.wikidexcdn.net/mwuploads/wikidex/7/74/latest/20191207032343/Pikachu_Gigamax_EpEc.gif"),
    (10200, "https://images.wikidexcdn.net/mwuploads/wikidex/5/5c/latest/20191204065122/Meowth_Gigamax_EpEc.gif"),
    (10201, "https://images.wikidexcdn.net/mwuploads/wikidex/9/9e/latest/20191206055329/Machamp_Gigamax_EpEc.gif"),
    (10202, "https://images.wikidexcdn.net/mwuploads/wikidex/b/ba/latest/20191205025526/Gengar_Gigamax_EpEc.gif"),
    (10203, "https://images.wikidexcdn.net/mwuploads/wikidex/6/6b/latest/20191204064551/Kingler_Gigamax_EpEc.gif"),
    (10204, "https://images.wikidexcdn.net/mwuploads/wikidex/3/30/latest/20191206055216/Lapras_Gigamax_EpEc.gif"),
    (10205, "https://images.wikidexcdn.net/mwuploads/wikidex/8/81/latest/20191208180045/Eevee_Gigamax_EpEc.gif"),
    (10206, "https://images.wikidexcdn.net/mwuploads/wikidex/7/7d/latest/20191205030221/Snorlax_Gigamax_EpEc.gif"),
    (10207, "https://images.wikidexcdn.net/mwuploads/wikidex/3/3a/latest/20191206055024/Garbodor_Gigamax_EpEc.gif"),
    (10208, "https://images.wikidexcdn.net/mwuploads/wikidex/5/50/latest/20191208030656/Melmetal_Gigamax_EpEc.gif"),
    (10212, "https://images.wikidexcdn.net/mwuploads/wikidex/8/86/latest/20191207034018/Corviknight_Gigamax_EpEc.gif"),
    (10213, "https://images.wikidexcdn.net/mwuploads/wikidex/4/4a/latest/20191208043316/Orbeetle_Gigamax_EpEc.gif"),
    (10214, "https://images.wikidexcdn.net/mwuploads/wikidex/a/a7/latest/20191202213011/Drednaw_Gigamax_EpEc.gif"),
    (10215, "https://images.wikidexcdn.net/mwuploads/wikidex/c/c9/latest/20191205024332/Coalossal_Gigamax_EpEc.gif"),
    (10216, "https://images.wikidexcdn.net/mwuploads/wikidex/b/b0/latest/20191205025109/Flapple_Gigamax_EpEc.gif"),
    (10218, "https://images.wikidexcdn.net/mwuploads/wikidex/5/5f/latest/20191208043317/Sandaconda_Gigamax_EpEc.gif"),
    (10219, "https://images.wikidexcdn.net/mwuploads/wikidex/1/14/latest/20191206055500/Toxtricity_Gigamax_EpEc.gif"),
    (10228, "https://images.wikidexcdn.net/mwuploads/wikidex/1/14/latest/20191206055500/Toxtricity_Gigamax_EpEc.gif"),
    (10220, "https://images.wikidexcdn.net/mwuploads/wikidex/b/be/latest/20191205024034/Centiskorch_Gigamax_EpEc.gif"),
    (10221, "https://images.wikidexcdn.net/mwuploads/wikidex/5/51/latest/20191205030031/Hatterene_Gigamax_EpEc.gif"),
    (10222, "https://images.wikidexcdn.net/mwuploads/wikidex/b/bf/latest/20191205025806/Grimmsnarl_Gigamax_EpEc.gif"),
    (10223, "https://images.wikidexcdn.net/mwuploads/wikidex/0/09/latest/20191205023619/Alcremie_Gigamax_EpEc.gif"),
    (10224, "https://images.wikidexcdn.net/mwuploads/wikidex/e/ea/latest/20191205024732/Copperajah_Gigamax_EpEc.gif"),
    (10225, "https://images.wikidexcdn.net/mwuploads/wikidex/2/28/latest/20191206054822/Duraludon_Gigamax_EpEc.gif"),
    (10195, "https://images.wikidexcdn.net/mwuploads/wikidex/5/56/latest/20200621041242/Venusaur_Gigamax_EpEc.gif"),
    (10197, "https://images.wikidexcdn.net/mwuploads/wikidex/1/10/latest/20200621041607/Blastoise_Gigamax_EpEc.gif"),
    (10209, "https://images.wikidexcdn.net/mwuploads/wikidex/4/46/latest/20200621042120/Rillaboom_Gigamax_EpEc.gif"),
    (10210, "https://images.wikidexcdn.net/mwuploads/wikidex/c/c2/latest/20200621042347/Cinderace_Gigamax_EpEc.gif"),
    (10211, "https://images.wikidexcdn.net/mwuploads/wikidex/8/89/latest/20200928210111/Inteleon_Gigamax_EpEc.gif"),
    (10226, "https://images.wikidexcdn.net/mwuploads/wikidex/3/31/latest/20200715053735/Urshifu_brusco_Gigamax_EpEc.gif"),
    (10227, "https://images.wikidexcdn.net/mwuploads/wikidex/8/85/latest/20200715054208/Urshifu_fluido_Gigamax_EpEc.gif"),
]


# ============================================================
# UTILIDADES
# ============================================================

def filename_from_url(url: str) -> str:
    """
    Obtiene el nombre original del archivo.
    """
    path = urlparse(url).path
    return Path(path).name


def load_manifest():
    if not MANIFEST_FILE.exists():
        return {}

    try:
        with MANIFEST_FILE.open(
            "r",
            encoding="utf-8",
        ) as f:
            return json.load(f)

    except Exception:
        return {}


def save_manifest(manifest):
    tmp = MANIFEST_FILE.with_suffix(".tmp")

    with tmp.open(
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            manifest,
            f,
            ensure_ascii=False,
            indent=2,
        )

    tmp.replace(MANIFEST_FILE)


# ============================================================
# DESCARGA
# ============================================================

def download(
    session,
    url,
    destination,
):
    """
    Descarga con reintentos.
    """

    for attempt in range(
        1,
        RETRIES + 1,
    ):

        try:

            response = session.get(
                url,
                timeout=TIMEOUT,
                stream=True,
            )

            response.raise_for_status()

            tmp = destination.with_suffix(
                destination.suffix + ".part"
            )

            with tmp.open("wb") as f:

                for chunk in response.iter_content(
                    chunk_size=1024 * 256
                ):

                    if chunk:
                        f.write(chunk)

            tmp.replace(destination)

            return True

        except Exception as exc:

            print(
                f"  Error: {exc}"
            )

            if attempt >= RETRIES:
                return False

            wait = min(
                60,
                2 ** attempt,
            )

            print(
                f"  Reintentando en {wait}s..."
            )

            time.sleep(wait)

    return False


# ============================================================
# MAIN
# ============================================================

def main():

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    manifest = load_manifest()

    session = requests.Session()

    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
    })

    print()
    print("=" * 60)
    print("Dinamax Live Sprites downloader")
    print("=" * 60)
    print()

    print(
        f"Destino: {OUTPUT_DIR.resolve()}"
    )

    print(
        f"Sprites: {len(SPRITES)}"
    )

    print(
        f"Delay: {DELAY}s"
    )

    print()

    downloaded = 0
    skipped = 0
    failed = 0

    # Evitar descargar dos veces exactamente la misma URL.
    downloaded_urls = {}

    for index, (sprite_id, url) in enumerate(
        SPRITES,
        start=1,
    ):

        original_filename = filename_from_url(
            url
        )

        # Añadimos el ID para evitar colisiones.
        filename = (
            f"{sprite_id}_{original_filename}"
        )

        destination = (
            OUTPUT_DIR
            / filename
        )

        print(
            f"[{index}/{len(SPRITES)}] "
            f"{sprite_id} -> "
            f"{original_filename}"
        )

        # ----------------------------------------------------
        # Ya descargado
        # ----------------------------------------------------

        if destination.exists():

            size = destination.stat().st_size

            if size > 0:

                print(
                    f"  ✓ Ya existe "
                    f"({size / 1024:.1f} KB)"
                )

                skipped += 1

                downloaded_urls[url] = filename

                manifest[str(sprite_id)] = {
                    "id": sprite_id,
                    "url": url,
                    "file": filename,
                    "status": "downloaded",
                }

                save_manifest(manifest)

                continue

        # ----------------------------------------------------
        # URL duplicada
        # ----------------------------------------------------

        if url in downloaded_urls:

            source_filename = downloaded_urls[url]

            print(
                f"  ↪ URL duplicada; "
                f"ya descargada como "
                f"{source_filename}"
            )

            # Creamos una copia física para que cada ID
            # tenga su propio archivo.
            source = (
                OUTPUT_DIR
                / source_filename
            )

            if source.exists():

                destination.write_bytes(
                    source.read_bytes()
                )

                manifest[str(sprite_id)] = {
                    "id": sprite_id,
                    "url": url,
                    "file": filename,
                    "status": "copied",
                    "source": source_filename,
                }

                save_manifest(manifest)

                skipped += 1

                continue

        # ----------------------------------------------------
        # Descargar
        # ----------------------------------------------------

        time.sleep(DELAY)

        print(
            f"  ↓ Descargando..."
        )

        ok = download(
            session,
            url,
            destination,
        )

        if ok:

            size = destination.stat().st_size

            print(
                f"  ✓ OK "
                f"({size / 1024:.1f} KB)"
            )

            downloaded += 1

            downloaded_urls[url] = filename

            manifest[str(sprite_id)] = {
                "id": sprite_id,
                "url": url,
                "file": filename,
                "status": "downloaded",
            }

        else:

            print(
                "  ✗ FALLÓ"
            )

            failed += 1

            manifest[str(sprite_id)] = {
                "id": sprite_id,
                "url": url,
                "file": filename,
                "status": "failed",
            }

        save_manifest(
            manifest
        )

    # ========================================================
    # RESUMEN
    # ========================================================

    print()
    print("=" * 60)
    print("TERMINADO")
    print("=" * 60)
    print()

    print(
        f"Descargados: {downloaded}"
    )

    print(
        f"Existentes/duplicados: {skipped}"
    )

    print(
        f"Fallidos: {failed}"
    )

    print()

    print(
        f"Archivos: "
        f"{OUTPUT_DIR.resolve()}"
    )

    print(
        f"Manifest: "
        f"{MANIFEST_FILE.resolve()}"
    )

    print()

    if failed:

        print(
            "Hay archivos fallidos. "
            "Vuelve a ejecutar el script para "
            "reintentarlos."
        )

        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
