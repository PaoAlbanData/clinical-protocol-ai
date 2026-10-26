"""Verifica la exactitud de las páginas del índice contra los PDF originales.

Uso:  python scripts/verify_index.py

Para cada fragmento de public/data/index.json comprueba que su texto aparece
en la página del PDF que cita (comparando sólo letras y dígitos, para ignorar
saltos de línea y guiones de corte). También comprueba los SHA-256.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "public" / "data" / "index.json"
SRC = ROOT / "data" / "protocols"


ANNOTATION = re.compile(r"\[Recomendación clase [^\]]+\]")


def norm(text: str) -> str:
    return re.sub(r"[^0-9a-záéíóúüñ]", "", text.lower().replace("­", ""))


def main() -> int:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    errors = 0
    pages: dict[tuple[str, int], str] = {}
    for d in data["docs"]:
        path = SRC / d["file"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != d["sha256"]:
            print(f"[ERROR] {d['file']}: el SHA-256 no coincide con el índice")
            errors += 1
        doc = pymupdf.open(path)
        for i, page in enumerate(doc, start=1):
            pages[(d["id"], i)] = norm(page.get_text())

    for c in data["chunks"]:
        page = pages[(c["d"], c["p"])]
        # Cada línea del fragmento (salvo encabezados repetidos) debe estar en la página.
        for line in c["t"].split("\n"):
            # La clase y el nivel de evidencia se añaden al indexar desde la tabla.
            n = norm(ANNOTATION.sub("", line))
            if len(n) >= 8 and n not in page:
                print(f"[ERROR] fragmento {c['id']} ({c['d']} p{c['p']}): «{line[:80]}» no está en la página")
                errors += 1
                break

    print(f"Fragmentos verificados: {len(data['chunks'])}; errores: {errors}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
