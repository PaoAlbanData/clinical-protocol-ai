"""Construye el índice documental estático a partir del PDF original.

Uso:  python scripts/build_index.py

PDF -> extracción de texto (PyMuPDF) -> limpieza -> fragmentación por página ->
public/data/index.json

Cada fragmento pertenece a UNA sola página del PDF, de modo que la cita de
página es siempre exacta. El PDF no se modifica. El texto de los fragmentos es
literal; la limpieza sólo une palabras cortadas por guiones de fin de línea,
elimina cabeceras de página y la bibliografía, y normaliza espacios. La clase de
recomendación y el nivel de evidencia de las tablas se añaden entre corchetes
al final de cada recomendación (`[Recomendación clase I, nivel de evidencia B]`).
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
MIN_CHUNK = 220   # fragmentos menores se fusionan con el anterior
INDEX_VERSION = 2

ITEM_START = re.compile(r"^(?:[•\-–§]|\d{1,2}(?:\.\d{1,2})+\.?\s|[a-z]\)\s|CAP[IÍ]TULO\s)")
SECTION = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+(\S.{3,})$")
CHAPTER = re.compile(r"^CAP[IÍ]TULO\s+(\d{1,2})\.?\s*(.+)$")
BIBLIO = re.compile(r"^BIBLIOGRAF[IÍ]A$", re.I)
# Cabeceras de tabla de recomendaciones («Recomendación | Clase | Nivel de evidencia»).
TABLE_HEADER = {"recomendación", "clase", "clase de", "nivel de", "evidencia", "nivel de evidencia",
                "recomendación clase", "clase de recomendación", "grado"}
REC_CLASS = re.compile(r"^(I|IIa|IIb|III)$")
REC_LEVEL = re.compile(r"^([ABC](?:-[A-Z]{1,3})?)$")


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


SPANISH_WORDS = {"de", "la", "que", "el", "en", "los", "las", "con", "para", "una", "del", "se", "por", "como"}
REFERENCE_MARK = re.compile(r"et al|doi|https?:|\d{4};\s?\d|\d{4}:\d|\(\d{4}\)")


def is_spanish_prose(line: str) -> bool:
    words = re.findall(r"[a-záéíóúñ]+", line.lower())
    return len(line) >= 60 and sum(w in SPANISH_WORDS for w in words) >= 4 and not REFERENCE_MARK.search(line)


def ends_bibliography(line: str, following: str) -> bool:
    """Una sección numerada («3.5 Estudios…»), un capítulo o dos líneas seguidas
    de prosa en español (las referencias están mayoritariamente en inglés)
    cierran la bibliografía."""
    return bool(
        CHAPTER.match(line)
        or SECTION.match(line)
        or re.match(r"^\d{1,2}\.\s+[A-ZÁÉÍÓÚÑ ]{6,}$", line)
        or (is_spanish_prose(line) and is_spanish_prose(following) and not re.match(r"^\d{1,3}\.\s", line))
    )


class PageParser:
    """Analiza página a página conservando el estado (capítulo, sección, bibliografía)."""

    def __init__(self, header_patterns: list[str]):
        self.headers = [re.compile(p) for p in header_patterns]
        self.chapter: str | None = None
        self.section: str | None = None
        self.in_biblio = False
        self.unassigned = 0         # pares clase/nivel sin recomendación inequívoca

    def parse(self, page: pymupdf.Page) -> dict:
        # Líneas con su posición (x0, y0, x1, y1) para asignar la clase de
        # recomendación por fila y no unir texto de párrafos o columnas distintos.
        lines: list[tuple[str, tuple]] = []
        for block in page.get_text("dict")["blocks"]:
            for ln in block.get("lines", []):
                text = clean_line("".join(sp["text"] for sp in ln["spans"]))
                if text:
                    lines.append((text, tuple(ln["bbox"])))
        label = None
        head = 0
        while head < min(3, len(lines)) and any(h.search(lines[head][0]) for h in self.headers):
            if lines[head][0].isdigit() and label is None:
                label = int(lines[head][0])
            head += 1
        lines = lines[head:]

        body: list[tuple[str, tuple, str | None, str | None]] = []   # texto, posición, capítulo, sección
        marks: list[tuple[str, tuple]] = []      # líneas sueltas de clase o nivel
        for i, (l, bb) in enumerate(lines):
            if self.in_biblio:
                if not ends_bibliography(l, lines[i + 1][0] if i + 1 < len(lines) else ""):
                    continue
                self.in_biblio = False
            if BIBLIO.match(l):
                self.in_biblio = True
                continue
            if m := CHAPTER.match(l):
                self.chapter = f"Capítulo {m.group(1)}. {m.group(2).capitalize()}"
                self.section = None
            elif m := SECTION.match(l):
                self.section = f"{m.group(1)} {m.group(2)}"
            if l.lower() in TABLE_HEADER:
                continue
            if REC_CLASS.match(l) or REC_LEVEL.match(l):
                marks.append((l, bb))
                continue
            body.append((l, bb, self.chapter, self.section))

        # Agrupar en elementos (párrafos, viñetas, recomendaciones) uniendo sólo
        # líneas contiguas en la página.
        items: list[dict] = []
        for l, bb, chapter, section in body:
            prev = items[-1] if items else None
            contiguous = prev is not None and prev["y1"] - 2 <= bb[1] <= prev["y1"] + 6 and abs(bb[0] - prev["x0"]) < 120
            if prev and contiguous and not ITEM_START.match(l) and (
                not prev["text"].endswith((".", ":")) or re.match(r"^[a-záéíóúñ(]", l)
            ):
                prev["text"] = join_lines(prev["text"], l)
                prev["y1"] = max(prev["y1"], bb[3])
            else:
                items.append({"text": l, "x0": bb[0], "x1": bb[2], "y0": bb[1], "y1": bb[3],
                              "rec": l.startswith(("–", "•")), "chapter": chapter, "section": section})

        # Clase y nivel de evidencia: los que están en la misma fila de la tabla
        # (a la derecha de la recomendación y dentro de su altura). Si no hay
        # exactamente una clase y un nivel, no se asigna: es preferible omitirla
        # a atribuir una equivocada.
        used: set[int] = set()
        for it in (x for x in items if x["rec"]):
            in_row = [k for k, (t, bb) in enumerate(marks)
                      if bb[0] > it["x0"] + 40 and it["y0"] - 4 <= (bb[1] + bb[3]) / 2 <= it["y1"] + 4]
            cls = [k for k in in_row if REC_CLASS.match(marks[k][0])]
            lvl = [k for k in in_row if REC_LEVEL.match(marks[k][0])]
            if len(cls) == 1 and len(lvl) == 1:
                it["text"] += f" [Recomendación clase {marks[cls[0]][0]}, nivel de evidencia {marks[lvl[0]][0]}]"
                used.update((cls[0], lvl[0]))
        self.unassigned += sum(1 for k, (t, _) in enumerate(marks) if REC_CLASS.match(t) and k not in used)

        # Cada elemento conserva el capítulo y la sección en los que empieza.
        out = []
        for it in items:
            text = re.sub(r"\s+", " ", it["text"].replace("­", "")).strip()
            if len(text) > 2:
                out.append((text, it["chapter"], it["section"]))
        return {"label": label, "items": out}


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


def chunk_items(items: list[tuple[str, str | None, str | None]]) -> list[tuple[str, str | None, str | None]]:
    """Agrupa elementos en fragmentos (texto, capítulo, sección). El capítulo y
    la sección del fragmento son los del elemento con el que empieza. Si un
    fragmento empieza a mitad de una sección numerada («5.1.2 ¿Qué pacientes…»
    + viñetas), repite su encabezado para que las viñetas conserven el contexto."""
    chunks: list[list] = []
    cur, meta, header = "", (None, None), None
    for text, chapter, section in items:
        for item in split_long(text):
            if cur and len(cur) + len(item) + 1 > MAX_CHUNK and len(cur) >= MIN_CHUNK:
                chunks.append([cur, *meta])
                cur = f"{header}\n{item}" if header and not HEADER_ITEM.match(item) else item
                meta = (chapter, section)
            elif cur:
                cur = f"{cur}\n{item}"
            else:
                cur, meta = item, (chapter, section)
            if HEADER_ITEM.match(item):
                header = item if len(item) <= 200 else None
    if cur:
        if chunks and len(cur) < MIN_CHUNK and len(chunks[-1][0]) + len(cur) < MAX_CHUNK * 1.4:
            chunks[-1][0] += "\n" + cur
        else:
            chunks.append([cur, *meta])
    return [tuple(c) for c in chunks]


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
        parser = PageParser(p["headerPatterns"])
        n_doc = 0
        for pno in range(first, last + 1):
            parsed = parser.parse(doc[pno - 1])
            for text, chapter, section in chunk_items(parsed["items"]):
                key = re.sub(r"\W+", "", text.lower())
                if len(key) < 40 or key in seen:          # sin contenido o duplicado
                    continue
                if len(re.findall(r"et al|doi\.org", text)) >= 2:   # restos de bibliografía
                    continue
                lines = text.split("\n")
                body = "\n".join(lines[1:]) if len(lines) > 1 and HEADER_ITEM.match(lines[0]) else text
                if len(body) < 120 and re.match(r"^[A-Z][\w\-/]{1,12}\s?[:=]", body):   # nota de abreviatura suelta
                    continue
                seen.add(key)
                chunks.append({
                    "id": len(chunks),
                    "d": p["id"],
                    "p": pno,
                    "l": parsed["label"],
                    "c": chapter,
                    "s": section,
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
        print(f"[OK] {p['id']}: páginas {first}-{last}, {n_doc} fragmentos; "
              f"pares clase/nivel sin asignar por ambigüedad: {parser.unassigned}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": INDEX_VERSION, "docs": docs, "chunks": chunks}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nTotal: {len(chunks)} fragmentos, {OUT.stat().st_size / 1024:.0f} KB -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
