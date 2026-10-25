"""Descarga los PDF oficiales listados en scripts/protocols.json a data/protocols/.

Uso:  python scripts/download_protocols.py [--force]

No modifica los PDF: los guarda tal cual y registra su SHA-256 en
data/protocols/checksums.json para que el índice sea reproducible.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "protocols"
MANIFEST = ROOT / "scripts" / "protocols.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    force = "--force" in sys.argv
    DEST.mkdir(parents=True, exist_ok=True)
    protocols = json.loads(MANIFEST.read_text(encoding="utf-8"))
    checksums = {}
    for p in protocols:
        target = DEST / p["file"]
        if target.exists() and not force:
            print(f"[=] {p['file']} ya existe, se omite")
        else:
            print(f"[descargando] {p['url']}")
            req = urllib.request.Request(p["url"], headers={"User-Agent": "clinical-protocol-ai/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if not data.startswith(b"%PDF-"):
                print(f"[ERROR] {p['file']}: la respuesta no es un PDF", file=sys.stderr)
                return 1
            target.write_bytes(data)
        checksums[p["file"]] = {"sha256": sha256(target), "bytes": target.stat().st_size}
        print(f"[OK] {p['file']} ({checksums[p['file']]['bytes']:,} bytes)")
    (DEST / "checksums.json").write_text(json.dumps(checksums, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
