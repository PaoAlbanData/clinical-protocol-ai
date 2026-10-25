"""Construye el índice documental estático a partir de los PDF originales.

Uso:  python scripts/build_index.py

PDF -> extracción de texto (PyMuPDF) -> limpieza -> fragmentación por página ->
public/data/index.json

Cada fragmento pertenece a UNA sola página del PDF, de modo que la cita de
página es siempre exacta. Los PDF no se modifican. El texto de los fragmentos
es literal; la limpieza sólo une palabras cortadas por guiones de fin de línea,
elimina cabeceras/pies repetidos y normaliza espacios.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "protocols"
MANIFEST = ROOT / "scripts" / "protocols.json"
OUT = ROOT / "public" / "data" / "index.json"

MAX_CHUNK = 900   # caracteres por fragmento (objetivo)
MIN_CHUNK = 220   # fragmentos menores se fusionan con el siguiente
INDEX_VERSION = 1

# Cabeceras de tabla que se repiten en casi todas las páginas de los PAI.
BOILERPLATE = {"actividades", "características de calidad", "actividades características de calidad"}
PAGE_HEADER = re.compile(r"^(\d{1,3})(?:\s+PAI\b.*)?$")
RUNNING_PAI = re.compile(r"^PAI\b")
CHAPTER = re.compile(r"^[a-záéíóúñ ]{4,40}$")       # pestaña de capítulo: "componentes"
STAGE = re.compile(r"^\d{1,2}º$")                     # "4º" inicio de etapa del proceso
ITEM_START = re.compile(r"^(?:[•\-–]|\d{1,2}(?:\.\d{1,2})+\.?\s|[a-z]\)\s)")


def clean_line(line: str) -> str:
    line = line.replace("\t", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", line).strip()


def join_lines(prev: str, line: str) -> str:
    """Une dos líneas reparando palabras cortadas al final de línea."""
    if prev.endswith("­"):                         # guion blando
        return prev[:-1] + line
    if re.search(r"[a-záéíóúñ]-$", prev) and re.match(r"^[a-záéíóúñ]", line):
        return prev[:-1] + line
    return prev + " " + line


def parse_page(page: pymupdf.Page) -> dict:
    lines = [clean_line(l) for l in page.get_text().splitlines()]
    lines = [l for l in lines if l]
    label, chapter, stage = None, None, None

    # Cabecera: número de página impreso, "PAI ..." y pestaña de capítulo.
    head = 0
    while head < min(3, len(lines)):
        l = lines[head]
        m = PAGE_HEADER.match(l)
        if m and label is None:
            label = int(m.group(1))
        elif RUNNING_PAI.match(l):
            pass
        elif CHAPTER.match(l) and chapter is None:
            chapter = l
        else:
            break
        head += 1
    lines = lines[head:]

    # Etapa del proceso: "4º" seguido de líneas en mayúsculas.
    body = []
    i = 0
    while i < len(lines):
        l = lines[i]
        if STAGE.match(l):
            j = i + 1
            words = []
            while j < len(lines) and lines[j].upper() == lines[j] and re.search(r"[A-ZÁÉÍÓÚÑ]", lines[j]):
                words.append(lines[j])
                j += 1
            if words:
                stage = f"{l} " + " ".join(words).capitalize()
                i = j
                continue
        if l.lower() not in BOILERPLATE:
            body.append(l)
        i += 1

    # Agrupar en elementos (párrafos, viñetas, actividades numeradas).
    items: list[str] = []
    for l in body:
        if items and not ITEM_START.match(l) and not items[-1].endswith((".", ":")):
            items[-1] = join_lines(items[-1], l)
        elif items and not ITEM_START.match(l) and re.match(r"^[a-záéíóúñ(]", l):
            items[-1] = join_lines(items[-1], l)
        else:
            items.append(l)
    items = [re.sub(r"\s+", " ", it.replace("­", "")).strip() for it in items]
    items = [it for it in items if len(it) > 2]
    return {"label": label, "chapter": chapter, "stage": stage, "items": items}


def split_long(item: str) -> list[str]:
    if len(item) <= MAX_CHUNK * 1.3:
        return [item]
    parts, cur = [], ""
    for sent in re.split(r"(?<=[.;])\s+", item):
        if cur and len(cur) + len(sent) > MAX_CHUNK:
            parts.append(cur)
            cur = sent
        else:
            cur = f"{cur} {sent}".strip()
    if cur:
        parts.append(cur)
    return parts


HEADER_ITEM = re.compile(r"^\d{1,2}(?:\.\d{1,2})+\.?\s")


def chunk_items(items: list[str]) -> list[str]:
    """Agrupa elementos en fragmentos. Si un fragmento empieza a mitad de una
    actividad numerada («7.13 Hipoglucemia» + viñetas), repite su encabezado
    para que las viñetas conserven el contexto."""
    chunks, cur, header = [], "", None
    for item in (p for it in items for p in split_long(it)):
        if cur and len(cur) + len(item) + 1 > MAX_CHUNK and len(cur) >= MIN_CHUNK:
            chunks.append(cur)
            cur = f"{header}\n{item}" if header and not HEADER_ITEM.match(item) else item
        else:
            cur = f"{cur}\n{item}" if cur else item
        if HEADER_ITEM.match(item):
            header = item if len(item) <= 200 else None
    if cur:
        if chunks and len(cur) < MIN_CHUNK and len(chunks[-1]) + len(cur) < MAX_CHUNK * 1.4:
            chunks[-1] += "\n" + cur
        else:
            chunks.append(cur)
    return chunks


def main() -> int:
    protocols = json.loads(MANIFEST.read_text(encoding="utf-8"))
    docs, chunks, seen = [], [], set()
    for p in protocols:
        path = SRC / p["file"]
        if not path.exists():
            print(f"[FALTA] {path} - ejecuta primero scripts/download_protocols.py")
            return 1
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        doc = pymupdf.open(path)
        first, last = p["contentPages"]
        g_first, g_last = p["glossaryPages"]
        n_doc = 0
        for pno in range(first, last + 1):
            parsed = parse_page(doc[pno - 1])
            for text in chunk_items(parsed["items"]):
                key = re.sub(r"\W+", "", text.lower())
                if len(key) < 40 or key in seen:          # sin contenido o duplicado
                    continue
                seen.add(key)
                chunks.append({
                    "id": len(chunks),
                    "d": p["id"],
                    "p": pno,
                    "l": parsed["label"],
                    "c": parsed["chapter"],
                    "s": parsed["stage"],
                    "g": g_first <= pno <= g_last,
                    "t": text,
                })
                n_doc += 1
        docs.append({
            "id": p["id"], "title": p["title"], "shortTitle": p["shortTitle"],
            "institution": p["institution"], "year": p["year"], "license": p["license"],
            "file": p["file"], "url": p["url"], "pages": doc.page_count,
            "contentPages": p["contentPages"], "keywords": p["keywords"],
            "sha256": sha, "chunks": n_doc,
        })
        print(f"[OK] {p['id']}: páginas {first}-{last}, {n_doc} fragmentos")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": INDEX_VERSION, "docs": docs, "chunks": chunks}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nTotal: {len(chunks)} fragmentos, {OUT.stat().st_size / 1024:.0f} KB -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
