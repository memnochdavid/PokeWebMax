#!/usr/bin/env python3

import os
import re
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


PAGE_URL = (
    "https://projectpokemon.org/home/docs/spriteindex_148/"
    "switch-sv-style-sprites-for-home-r153/"
)

OUTPUT_DIR = (
    "/home/david/Escritorio/WORKSPACE/"
    "PokeWebMax/frontend/public/sprites_home"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/139.0 Safari/537.36"
    )
}

IMAGE_EXTENSIONS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
)


def is_image_url(url):
    """Comprueba si una URL parece apuntar a una imagen."""
    if not url:
        return False

    path = urlparse(url).path.lower()

    return path.endswith(IMAGE_EXTENSIONS)


def get_filename(url, fallback_number):
    """Obtiene un nombre de archivo seguro."""

    path = urlparse(url).path
    filename = os.path.basename(path)

    if not filename:
        return f"sprite_{fallback_number:04d}.png"

    # Eliminar caracteres problemáticos
    filename = re.sub(r'[<>:"/\\|?*]', "_", filename)

    return filename


def get_image_url(img, page_url):
    """
    Intenta obtener la URL de la imagen original.

    Project Pokémon puede utilizar diferentes atributos
    dependiendo de cómo se cargue la página.
    """

    # Primero buscamos un enlace alrededor de la imagen.
    parent_link = img.find_parent("a")

    if parent_link:
        href = parent_link.get("href")

        if href:
            href = urljoin(page_url, href)

            if is_image_url(href):
                return href

    # Atributos posibles de lazy loading.
    attributes = [
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-image",
        "src",
    ]

    for attr in attributes:
        value = img.get(attr)

        if value:
            value = urljoin(page_url, value)

            if is_image_url(value):
                return value

    return None


def find_generation_markers(soup):
    """
    Encuentra Gen 1 ... Gen 9 aunque no sean headings HTML.

    Devuelve:
        {
            1: elemento,
            2: elemento,
            ...
        }
    """

    generations = {}

    pattern = re.compile(r"^\s*Gen\s+([1-9])\s*$", re.IGNORECASE)

    for text_node in soup.find_all(string=True):

        text = text_node.strip()

        match = pattern.match(text)

        if not match:
            continue

        gen = int(match.group(1))

        if gen in generations:
            continue

        # Guardamos el elemento padre.
        generations[gen] = text_node.parent

    return generations


def collect_images_between(soup, start_element, end_element):
    """
    Recoge imágenes que aparecen después de start_element
    y antes de end_element.
    """

    images = []

    # Recorremos todos los elementos posteriores en el DOM.
    current = start_element.find_next()

    while current:

        if current == end_element:
            break

        if current.name == "img":
            images.append(current)

        current = current.find_next()

    return images


def download(session, url, destination):
    """Descarga una imagen."""

    try:

        response = session.get(
            url,
            headers=HEADERS,
            timeout=60,
            stream=True,
        )

        response.raise_for_status()

        with open(destination, "wb") as f:

            for chunk in response.iter_content(
                chunk_size=1024 * 64
            ):

                if chunk:
                    f.write(chunk)

        return True

    except Exception as e:

        print(f"       ERROR: {e}")

        return False


def main():

    print("=" * 70)
    print("PROJECT POKÉMON - HOME SV STYLE SPRITES")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    # ---------------------------------------------------------
    # Descargar HTML
    # ---------------------------------------------------------

    print("\n[*] Descargando página...")

    response = session.get(
        PAGE_URL,
        timeout=60,
    )

    response.raise_for_status()

    print(
        f"[+] HTTP {response.status_code} "
        f"({len(response.content):,} bytes)"
    )

    soup = BeautifulSoup(
        response.text,
        "html.parser",
    )

    # ---------------------------------------------------------
    # Encontrar Gen 1 ... Gen 9
    # ---------------------------------------------------------

    print("\n[*] Buscando generaciones...")

    generations = find_generation_markers(soup)

    print(
        f"[+] Generaciones encontradas: "
        f"{sorted(generations.keys())}"
    )

    missing = [
        gen
        for gen in range(1, 10)
        if gen not in generations
    ]

    if missing:

        print(
            f"[!] No se encontraron: "
            f"{missing}"
        )

    if not generations:

        print("\n[ERROR] No se encontró ninguna generación.")
        print(
            "Guarda una copia del HTML ejecutando:"
        )
        print(
            "  curl -L "
            f"'{PAGE_URL}' "
            "> projectpokemon.html"
        )

        return

    # ---------------------------------------------------------
    # Ordenar generaciones
    # ---------------------------------------------------------

    ordered = sorted(
        generations.items(),
        key=lambda x: x[0],
    )

    total = 0
    skipped = 0
    errors = 0

    # ---------------------------------------------------------
    # Procesar generaciones
    # ---------------------------------------------------------

    for index, (gen, marker) in enumerate(ordered):

        print("\n" + "=" * 70)
        print(f"GEN {gen}")
        print("=" * 70)

        gen_dir = os.path.join(
            OUTPUT_DIR,
            f"gen{gen}",
        )

        os.makedirs(
            gen_dir,
            exist_ok=True,
        )

        # Siguiente Gen
        if index + 1 < len(ordered):

            next_marker = ordered[index + 1][1]

        else:

            next_marker = None

        # Buscar imágenes
        images = collect_images_between(
            soup,
            marker,
            next_marker,
        )

        print(
            f"[*] Elementos <img> encontrados: "
            f"{len(images)}"
        )

        # -----------------------------------------------------
        # Convertir imágenes a URLs
        # -----------------------------------------------------

        urls = []

        seen = set()

        for img in images:

            url = get_image_url(
                img,
                PAGE_URL,
            )

            if not url:
                continue

            if url in seen:
                continue

            seen.add(url)

            urls.append(url)

        print(
            f"[+] Imágenes descargables: "
            f"{len(urls)}"
        )

        # -----------------------------------------------------
        # Descargar
        # -----------------------------------------------------

        for number, url in enumerate(
            urls,
            start=1,
        ):

            filename = get_filename(
                url,
                number,
            )

            destination = os.path.join(
                gen_dir,
                filename,
            )

            if os.path.exists(destination):

                skipped += 1

                print(
                    f"  [{number:4d}/{len(urls):4d}] "
                    f"EXISTE  {filename}"
                )

                continue

            print(
                f"  [{number:4d}/{len(urls):4d}] "
                f"BAJANDO {filename}"
            )

            ok = download(
                session,
                url,
                destination,
            )

            if ok:

                total += 1

            else:

                errors += 1

            # No saturar el servidor.
            time.sleep(0.08)

    # ---------------------------------------------------------
    # Resumen
    # ---------------------------------------------------------

    print("\n")
    print("=" * 70)
    print("DESCARGA TERMINADA")
    print("=" * 70)

    print(f"Descargados : {total}")
    print(f"Ya existían : {skipped}")
    print(f"Errores     : {errors}")

    print("\nDestino:")
    print(OUTPUT_DIR)

    print("\nArchivos por generación:")

    for gen in range(1, 10):

        gen_dir = os.path.join(
            OUTPUT_DIR,
            f"gen{gen}",
        )

        if not os.path.isdir(gen_dir):
            print(f"  Gen {gen}: NO CREADA")
            continue

        files = [
            f
            for f in os.listdir(gen_dir)
            if os.path.isfile(
                os.path.join(gen_dir, f)
            )
        ]

        print(
            f"  Gen {gen}: "
            f"{len(files)} archivos"
        )


if __name__ == "__main__":
    main()
