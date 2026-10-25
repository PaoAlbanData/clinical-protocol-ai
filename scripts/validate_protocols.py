"""Valida que cada PDF de data/protocols/ se abre y que su texto es extraíble.

Uso:  python scripts/validate_protocols.py

Informa de páginas sin texto o con muy poco texto (portadas, páginas en blanco,
imágenes escaneadas) para revisar posibles problemas de extracción.
"""
import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "protocols"
MANIFEST = ROOT / "scripts" / "protocols.json"
LOW_TEXT = 200  # caracteres


def main() -> int:
    protocols = json.loads(MANIFEST.read_text(encoding="utf-8"))
    ok = 0
    for p in protocols:
        path = DEST / p["file"]
        if not path.exists():
            print(f"[FALTA] {p['file']}")
            continue
        try:
            doc = pymupdf.open(path)
        except Exception as e:  # noqa: BLE001
            print(f"[ERROR] {p['file']}: no se puede abrir ({e})")
            continue
        empty, low, chars = [], [], 0
        for i, page in enumerate(doc, start=1):
            n = len(page.get_text().strip())
            chars += n
            if n == 0:
                empty.append(i)
            elif n < LOW_TEXT:
                low.append(i)
        print(f"[OK] {p['file']}: {doc.page_count} páginas, {chars:,} caracteres"
              f", cifrado={doc.is_encrypted}")
        print(f"     sin texto: {empty or 'ninguna'}")
        print(f"     poco texto (<{LOW_TEXT}): {low or 'ninguna'}")
        ok += 1
    print(f"\nDocumentos válidos: {ok}/{len(protocols)}")
    return 0 if ok == len(protocols) else 1


if __name__ == "__main__":
    sys.exit(main())
