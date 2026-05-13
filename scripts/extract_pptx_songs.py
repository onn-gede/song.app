#!/usr/bin/env python3
"""
Extrage text dintr-o arhiva ZIP cu fisiere PPTX si produce:
- JSON cu toate cantările parsate
- CSV pentru verificare rapida
- SQL seed optional pentru Supabase

Nu foloseste librarii externe. Ruleaza cu Python 3.10+.

Exemplu:
python scripts/extract_pptx_songs.py "Tineret (1).zip" --out samples --collection-code TINERI
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def decode_zip_unicode_markers(value: str) -> str:
    """Transforma nume de tip #U0163 in caractere unicode."""
    return re.sub(r"#U([0-9A-Fa-f]{4})", lambda m: chr(int(m.group(1), 16)), value)


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    return value.strip()


def strip_accents(value: str) -> str:
    # Varianta mica, fara diacritice, suficienta pentru comparatii interne.
    replacements = str.maketrans({
        "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t",
        "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ş": "S", "Ț": "T", "Ţ": "T",
    })
    return value.translate(replacements)


def norm_compare(value: str) -> str:
    value = strip_accents(value).lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_romanian_diacritics(value: str) -> bool:
    return any(ch in value for ch in "ăâîșşțţĂÂÎȘŞȚŢ")


def normalize_title_from_filename(filename: str) -> tuple[str | None, str]:
    name = decode_zip_unicode_markers(Path(filename).stem).strip()
    # Exemple: 001 Am fost..., 001b.Doamne..., 020 Domn...
    m = re.match(r"^(?P<number>\d+[a-zA-Z]?)\s*[.\- ]\s*(?P<title>.+)$", name)
    if not m:
        return None, clean_text(name)
    number = m.group("number")
    title = clean_text(m.group("title"))
    return number, title


def sql_escape(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def section_type_from_label(label: str | None) -> str:
    if not label:
        return "verse"
    l = label.lower().strip().replace(".", "")
    if l in {"r", "ref", "refren", "chorus"}:
        return "chorus"
    if l in {"b", "bridge"}:
        return "bridge"
    return "verse"


def extract_key_from_header(header: str) -> str | None:
    # Cauta tonalitati simple in header: "Titlu - C", "Titlu - Am" etc.
    m = re.search(r"\s-\s*([A-G](?:#|b)?m?)\b", header)
    if m:
        return m.group(1)
    return None


def extract_section_label(header: str) -> str | None:
    h = header.strip()
    m = re.match(r"^(R|Refren|Ref\.?|\d+|[0-9]+[a-z]?)\.?\b", h, flags=re.IGNORECASE)
    if m:
        return m.group(1).replace(".", "")
    return None


def slide_paragraphs(pptx_bytes: bytes) -> list[list[str]]:
    slides: list[list[str]] = []
    with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as pptx:
        slide_names = [
            name for name in pptx.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        ]
        slide_names.sort(key=lambda x: int(re.search(r"slide(\d+)\.xml", x).group(1)))
        for slide_name in slide_names:
            root = ET.fromstring(pptx.read(slide_name))
            paras: list[str] = []
            for p in root.iter(A_NS + "p"):
                txt = "".join(t.text or "" for t in p.iter(A_NS + "t"))
                txt = clean_text(txt)
                if txt:
                    paras.append(txt)
            if paras:
                slides.append(paras)
    return slides


@dataclass
class ParsedSection:
    position: int
    section_label: str | None
    section_type: str
    content: str


@dataclass
class ParsedSong:
    source_file: str
    song_number: str | None
    title: str
    default_key: str | None
    lyrics_text: str
    sections: list[ParsedSection]
    parser_notes: str


def possible_title_from_header(header: str, song_number: str | None, fallback_title: str) -> str | None:
    value = header.strip()
    value = re.sub(r"^(R|Refren|Ref\.?|\d+[a-z]?|\d+)\.?\s*", "", value, flags=re.IGNORECASE).strip()
    if song_number:
        value = re.sub(rf"\b{re.escape(song_number)}\b\s*$", "", value).strip()
        value = re.sub(rf"\b{re.escape(str(int(song_number[:3])) if song_number[:3].isdigit() else song_number)}\b\s*$", "", value).strip()
    value = re.sub(r"\s-\s*[A-G](?:#|b)?m?\s*$", "", value).strip()
    if not value or value.isdigit():
        return None
    # Acceptam candidatul daca seamana cu titlul din fisier, dar are diacritice/capitalizare mai buna.
    f = norm_compare(fallback_title)
    v = norm_compare(value)
    if v == f or f in v or v in f:
        return value
    return None


def is_projector_header_footer(line: str, song_number: str | None, file_title: str) -> bool:
    nline = norm_compare(line)
    ntitle = norm_compare(file_title)
    starts_with_label = re.match(r"^(R|Refren|Ref\.?|\d+[a-z]?|\d+)\.?\b", line.strip(), flags=re.IGNORECASE) is not None
    has_title = bool(ntitle and ntitle in nline)
    has_number = bool(song_number and re.search(rf"\b{re.escape(song_number)}\b", line))
    if song_number and song_number[:3].isdigit():
        try:
            has_number = has_number or re.search(rf"\b{int(song_number[:3])}\b", line) is not None
        except ValueError:
            pass
    # Header/footer tipic: "1. Titlu 001" sau "R. Titlu 001".
    return starts_with_label and has_title and (has_number or len(line) <= len(file_title) + 10)


def parse_song(filename: str, pptx_bytes: bytes) -> ParsedSong:
    song_number, file_title = normalize_title_from_filename(filename)
    slides = slide_paragraphs(pptx_bytes)
    sections: list[ParsedSection] = []
    default_key: str | None = None
    notes: list[str] = []
    title = file_title

    if slides:
        first_candidate = possible_title_from_header(slides[0][0], song_number, file_title)
        if first_candidate and (has_romanian_diacritics(first_candidate) or len(first_candidate) >= len(title)):
            title = first_candidate

    for idx, paras in enumerate(slides, start=1):
        header_candidates = [p for p in paras if is_projector_header_footer(p, song_number, file_title)]
        first_line = paras[0] if paras else ""
        footer_or_header = header_candidates[0] if header_candidates else first_line

        if default_key is None:
            default_key = extract_key_from_header(footer_or_header) or extract_key_from_header(first_line)

        label = extract_section_label(footer_or_header)
        content_lines = [p for p in paras if p not in header_candidates]

        # Daca nu am recunoscut header/footer, dar prima linie e doar eticheta, o scoatem din continut.
        if content_lines and extract_section_label(content_lines[0]) and len(content_lines[0]) <= 12:
            label = label or extract_section_label(content_lines[0])
            content_lines = content_lines[1:]

        if not content_lines and first_line:
            content_lines = [re.sub(r"^(R|Refren|Ref\.?|\d+|[0-9]+[a-z]?)\.?\s*", "", first_line, flags=re.IGNORECASE).strip()]

        content = "\n".join(line for line in content_lines if line).strip()
        if not content:
            continue

        sections.append(
            ParsedSection(
                position=idx,
                section_label=label,
                section_type=section_type_from_label(label),
                content=content,
            )
        )

    if not sections:
        notes.append("Nu s-a extras text din slide-uri.")

    lyrics_text = "\n\n".join(section.content for section in sections)

    # O nota importanta: refrenele pot fi repetate in PPT pentru proiectie.
    if len(sections) >= 3:
        contents = [s.content for s in sections]
        if len(set(contents)) < len(contents):
            notes.append("Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.")

    return ParsedSong(
        source_file=decode_zip_unicode_markers(filename),
        song_number=song_number,
        title=title,
        default_key=default_key,
        lyrics_text=lyrics_text,
        sections=sections,
        parser_notes=" ".join(notes),
    )


def parse_zip(zip_path: Path) -> list[ParsedSong]:
    songs: list[ParsedSong] = []
    with zipfile.ZipFile(zip_path) as outer:
        pptx_names = [name for name in outer.namelist() if name.lower().endswith(".pptx")]
        pptx_names.sort(key=lambda n: normalize_title_from_filename(n)[0] or n)
        for name in pptx_names:
            try:
                songs.append(parse_song(name, outer.read(name)))
            except Exception as exc:  # noqa: BLE001
                number, title = normalize_title_from_filename(name)
                songs.append(
                    ParsedSong(
                        source_file=decode_zip_unicode_markers(name),
                        song_number=number,
                        title=title,
                        default_key=None,
                        lyrics_text="",
                        sections=[],
                        parser_notes=f"Eroare la parsare: {exc}",
                    )
                )
    return songs


def write_json(songs: list[ParsedSong], out_path: Path) -> None:
    out_path.write_text(
        json.dumps([asdict(song) for song in songs], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_csv(songs: list[ParsedSong], out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["song_number", "title", "default_key", "sections_count", "source_file", "parser_notes", "lyrics_preview"])
        for song in songs:
            writer.writerow([
                song.song_number,
                song.title,
                song.default_key,
                len(song.sections),
                song.source_file,
                song.parser_notes,
                song.lyrics_text[:500].replace("\n", " / "),
            ])


def write_sql_seed(songs: list[ParsedSong], out_path: Path, collection_code: str) -> None:
    lines: list[str] = []
    lines.append("-- Seed generat automat din PPTX. Verifica manual dupa import.\n")
    lines.append("-- Ruleaza dupa 001_init_schema.sql si 002_seed_core_data.sql.\n\n")
    lines.append(f"-- Colectie tinta: {collection_code}\n\n")

    for song in songs:
        title = sql_escape(song.title)
        lyrics = sql_escape(song.lyrics_text)
        default_key = sql_escape(song.default_key)
        song_number = sql_escape(song.song_number)
        source_file = sql_escape(song.source_file)
        parser_notes = sql_escape(song.parser_notes or "Import automat din PPTX; necesita verificare manuala.")
        lines.append("with collection as (\n")
        lines.append(f"  select id from public.song_collections where short_code = {sql_escape(collection_code)}\n")
        lines.append("), inserted_song as (\n")
        lines.append("  insert into public.songs (title, lyrics_text, default_key, notes)\n")
        lines.append(f"  values ({title}, {lyrics}, {default_key}, {parser_notes})\n")
        lines.append("  returning id\n")
        lines.append("), inserted_file as (\n")
        lines.append("  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)\n")
        lines.append(f"  select collection.id, inserted_song.id, {source_file}, 'pptx', 'needs_review', {lyrics}, {parser_notes}\n")
        lines.append("  from collection, inserted_song\n")
        lines.append("  returning id, song_id\n")
        lines.append(")\n")
        lines.append("insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)\n")
        lines.append(f"select inserted_song.id, collection.id, {song_number}, {title}, inserted_file.id\n")
        lines.append("from inserted_song, collection, inserted_file;\n\n")

        for section in song.sections:
            lines.append("insert into public.song_sections (song_id, section_type, section_label, position, content)\n")
            lines.append("select s.id, ")
            lines.append(f"{sql_escape(section.section_type)}, {sql_escape(section.section_label)}, {section.position}, {sql_escape(section.content)}\n")
            lines.append("from public.songs s\n")
            lines.append("join public.song_sources ss on ss.song_id = s.id\n")
            lines.append(f"join public.song_collections c on c.id = ss.collection_id and c.short_code = {sql_escape(collection_code)}\n")
            lines.append(f"where ss.song_number is not distinct from {song_number} and ss.source_title = {title}\n")
            lines.append("order by s.created_at desc\n")
            lines.append("limit 1;\n")
        lines.append("\n")

    out_path.write_text("".join(lines), encoding="utf-8")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--out", type=Path, default=Path("samples"))
    parser.add_argument("--collection-code", default="TINERI")
    args = parser.parse_args(argv)

    args.out.mkdir(parents=True, exist_ok=True)
    songs = parse_zip(args.zip_path)
    write_json(songs, args.out / "tineret_import_preview.json")
    write_csv(songs, args.out / "tineret_import_preview.csv")
    write_sql_seed(songs, args.out / "004_seed_tineret_from_pptx.sql", args.collection_code)
    print(f"Am extras {len(songs)} cantari.")
    print(f"JSON: {args.out / 'tineret_import_preview.json'}")
    print(f"CSV:  {args.out / 'tineret_import_preview.csv'}")
    print(f"SQL:  {args.out / '004_seed_tineret_from_pptx.sql'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
