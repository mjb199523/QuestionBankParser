"""Parse table-based DOCX question papers into structured JSON."""

from __future__ import annotations

import base64
import json
import mimetypes
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
}
W_VAL = f"{{{NS['w']}}}val"
R_EMBED = f"{{{NS['r']}}}embed"


@dataclass
class Paragraph:
    text: str
    numbered: bool
    images: list[dict] = field(default_factory=list)


def _extract_text_chunks(element: ET.Element) -> list[str]:
    chunks = []
    for child in element:
        if child.tag == f"{{{NS['w']}}}r":
            for t in child.findall(".//w:t", NS):
                if not t.text:
                    continue
                text = t.text
                rPr = child.find(".//w:rPr", NS)
                if rPr is not None:
                    vertAlign = rPr.find(".//w:vertAlign", NS)
                    if vertAlign is not None and vertAlign.get(W_VAL) == "superscript":
                        if text.strip() in ("0", "o", "O"):
                            text = text.replace(text.strip(), "°")
                chunks.append(text)
        elif child.tag in (f"{{{NS['m']}}}oMath", f"{{{NS['m']}}}oMathPara"):
            chunks.extend(_extract_text_chunks(child))
        elif child.tag == f"{{{NS['m']}}}f":
            num = child.find(".//m:num", NS)
            den = child.find(".//m:den", NS)
            num_text = "".join(_extract_text_chunks(num)) if num is not None else ""
            den_text = "".join(_extract_text_chunks(den)) if den is not None else ""
            chunks.append(f"{num_text}/{den_text}")
        elif child.tag == f"{{{NS['m']}}}r":
            for t in child.findall(".//m:t", NS):
                if t.text:
                    chunks.append(t.text)
        else:
            chunks.extend(_extract_text_chunks(child))
    return chunks


def _text(element: ET.Element) -> str:
    chunks = _extract_text_chunks(element)
    return re.sub(r"\s+", " ", "".join(chunks)).strip()


def _direct_paragraphs_and_nested_images(
    element: ET.Element, images: dict[str, dict]
) -> list[Paragraph]:
    """Collect paragraphs outside nested tables AND images from nested tables.

    Text inside nested tables (e.g. data/matching tables embedded in
    questions) is intentionally excluded so it doesn't pollute the
    question text or get mis-detected as options.  Images from those
    tables are still captured as prompt images.
    """
    W_P = f"{{{NS['w']}}}p"
    W_TBL = f"{{{NS['w']}}}tbl"
    result: list[Paragraph] = []

    def _collect_images(para: ET.Element) -> list[dict]:
        found = []
        for blip in para.findall(".//a:blip", NS):
            rid = blip.get(R_EMBED)
            if rid in images:
                found.append(images[rid])
        return found

    def _walk(node: ET.Element) -> None:
        for child in node:
            if child.tag == W_P:
                num_pr = child.find("./w:pPr/w:numPr", NS)
                result.append(
                    Paragraph(_text(child), num_pr is not None, _collect_images(child))
                )
            elif child.tag == W_TBL:
                # Check if images are in separate cells (option-like layout).
                # If each image-bearing cell has exactly one image and no text,
                # treat each as a separate paragraph so _option_tail can detect
                # individual options.
                per_cell_imgs: list[list[dict]] = []
                mixed = False
                for cell in child.findall(".//w:tc", NS):
                    cell_imgs: list[dict] = []
                    for blip in cell.findall(".//a:blip", NS):
                        rid = blip.get(R_EMBED)
                        if rid in images:
                            cell_imgs.append(images[rid])
                    if not cell_imgs:
                        continue
                    cell_text = "".join(
                        _text(p) for p in cell.findall(".//w:p", NS)
                    ).strip()
                    if cell_text or len(cell_imgs) > 1:
                        mixed = True
                        break
                    per_cell_imgs.append(cell_imgs)

                if not mixed and len(per_cell_imgs) > 1:
                    # Each cell has a single image — emit separate paragraphs
                    for imgs in per_cell_imgs:
                        result.append(Paragraph("", False, imgs))
                else:
                    # Fall back: lump all images into one paragraph
                    nested_imgs: list[dict] = []
                    for blip in child.findall(".//a:blip", NS):
                        rid = blip.get(R_EMBED)
                        if rid in images:
                            nested_imgs.append(images[rid])
                    if nested_imgs:
                        result.append(Paragraph("", False, nested_imgs))
            else:
                _walk(child)

    _walk(element)
    return result


def _paragraphs(element: ET.Element, images: dict[str, dict]) -> list[Paragraph]:
    return _direct_paragraphs_and_nested_images(element, images)


def _relationship_images(archive: zipfile.ZipFile) -> dict[str, dict]:
    rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
    result = {}
    for rel in rels.findall("pr:Relationship", NS):
        target = rel.get("Target", "")
        if not target.startswith("media/"):
            continue
        path = f"word/{target}"
        raw = archive.read(path)
        mime = mimetypes.guess_type(target)[0] or "application/octet-stream"
        result[rel.get("Id", "")] = {
            "filename": Path(target).name,
            "mimeType": mime,
            "dataUrl": f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}",
        }
    return result


def _cell_paragraphs(row: ET.Element, images: dict[str, dict]) -> list[list[Paragraph]]:
    return [_paragraphs(cell, images) for cell in row.findall("./w:tc", NS)]


def _question_number(paragraphs: list[Paragraph]) -> int | None:
    text = " ".join(p.text for p in paragraphs if p.text).strip()
    match = re.fullmatch(r"(\d+)[.)]?", text)
    return int(match.group(1)) if match else None


def _is_numbered_cell(paragraphs: list[Paragraph]) -> bool:
    return any(paragraph.numbered for paragraph in paragraphs)


def _is_primarily_latin(text: str) -> bool:
    """Return True when the majority of alphabetic characters are Latin."""
    if not text.strip():
        return False
    latin = 0
    non_latin = 0
    for c in text:
        if ('A' <= c <= 'Z') or ('a' <= c <= 'z'):
            latin += 1
        elif c.isalpha() and ord(c) > 127:
            non_latin += 1
    total = latin + non_latin
    if total == 0:
        return False  # digits / punctuation only – not a translation
    return latin / total > 0.5


def _strip_translation(paragraphs: list[Paragraph]) -> list[Paragraph]:
    """Remove trailing English translation from bilingual content.

    Scans for the first primarily-Latin paragraph that appears *after*
    non-Latin (e.g. Assamese) content and truncates from that point.
    Paragraphs that look like options (numbered lists or A/B/C/D labels)
    are never treated as translation text.
    """
    seen_non_latin = False
    for i, p in enumerate(paragraphs):
        if not p.text.strip():
            continue
        # Never truncate at a paragraph that looks like an option
        if p.numbered or re.match(r"^\s*[A-Da-d](?:[.\)]\s*|\s+)", p.text):
            continue
        if _is_primarily_latin(p.text):
            if seen_non_latin:
                return paragraphs[:i]
        else:
            seen_non_latin = True
    return paragraphs


def _manual_option(paragraph: Paragraph) -> tuple[str, str] | None:
    match = re.match(r"^\s*([A-Da-d])(?:[\.\)]\s*|\s+)(.*)$", paragraph.text)
    if not match:
        return None
    return match.group(1).upper(), match.group(2).strip()


def _is_image_only(paragraph: Paragraph) -> bool:
    """True when the paragraph has images but no text and no numbering."""
    return not paragraph.text and bool(paragraph.images) and not paragraph.numbered


def _is_option(paragraph: Paragraph) -> bool:
    return bool(
        (paragraph.numbered and (paragraph.text or paragraph.images))
        or _manual_option(paragraph)
    )


def _extract_options(paragraphs: list[Paragraph]) -> list[dict]:
    options = []
    for paragraph in paragraphs:
        # Accept both standard options and image-only paragraphs
        if not _is_option(paragraph) and not _is_image_only(paragraph):
            continue
        manual = _manual_option(paragraph)
        label = manual[0] if manual else chr(65 + len(options))
        if manual:
            text = manual[1]
        elif paragraph.text:
            text = paragraph.text
        else:
            # Image-only option: use the label letter as display text
            text = label
        options.append(
            {
                "label": label,
                "text": text,
                "images": paragraph.images,
            }
        )
    return options


def _option_tail(paragraphs: list[Paragraph]) -> tuple[int, list[dict]]:
    """Find the options at the end of the paragraph list.
    
    Since `_strip_translation` removes any trailing English translation,
    the actual options are always at the end of the remaining paragraphs.

    Two detection strategies:
    1. Standard: walk backward for numbered/labeled options (text or image).
    2. Image-only fallback: if no standard options found, walk backward
       for un-numbered image-only paragraphs (requires ≥2 to avoid
       misclassifying a single prompt image).
    """
    end = len(paragraphs)
    while end and not paragraphs[end - 1].text and not paragraphs[end - 1].images:
        end -= 1

    # Strategy 1: standard options (numbered lists or A/B/C/D labels)
    start = end
    while start and _is_option(paragraphs[start - 1]):
        start -= 1

    if start < end:
        return start, _extract_options(paragraphs[start:end])

    # Strategy 2: image-only paragraphs (no numbering, no text)
    start = end
    while start and _is_image_only(paragraphs[start - 1]):
        start -= 1

    if end - start >= 2:
        return start, _extract_options(paragraphs[start:end])

    return end, []


def _plain_text(paragraphs: Iterable[Paragraph]) -> list[str]:
    return [p.text for p in paragraphs if p.text]


def _extract_range(text: str) -> tuple[int, int] | None:
    patterns = [
        r"(?:Q\.?\s*No\.?\s*)?(\d+)\s*(?:to|-|–)\s*(?:Q\.?\s*No\.?\s*)?(\d+)",
        r"(\d+)\s+ৰ\s+পৰা\s+(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1)), int(match.group(2))
    return None


def _metadata(paragraphs: list[Paragraph]) -> dict:
    lines = _plain_text(paragraphs)
    metadata = {"title": lines[0] if lines else "", "fields": {}, "subjectRanges": []}
    for line in lines[1:]:
        if ":" in line:
            key, value = line.split(":", 1)
            metadata["fields"][key.strip()] = value.strip()
        found_range = _extract_range(line)
        if found_range:
            subject = re.split(r"[:–-]", line, maxsplit=1)[0].strip()
            metadata["subjectRanges"].append(
                {"subject": subject, "start": found_range[0], "end": found_range[1]}
            )
    return metadata


def _subject_for(number: int, metadata: dict) -> str:
    for item in metadata["subjectRanges"]:
        if item["start"] <= number <= item["end"]:
            return item["subject"]
    return ""


def _question_type(options: list[dict], prompt_images: list[dict]) -> str:
    if options and (prompt_images or any(option["images"] for option in options)):
        return "image_mcq"
    if options:
        return "mcq"
    if prompt_images:
        return "image_question"
    return "open_ended"


def parse_docx(path: str | Path) -> dict:
    path = Path(path)
    with zipfile.ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        images = _relationship_images(archive)

    body = document.find("w:body", NS)
    top_paragraphs = [Paragraph(_text(p), False) for p in body.findall("./w:p", NS)]
    metadata = _metadata(top_paragraphs)
    questions = []
    contexts = []
    active_context: dict | None = None
    last_question_number = 0

    for table in body.findall("./w:tbl", NS):
        for row in table.findall("./w:tr", NS):
            cells = _cell_paragraphs(row, images)
            if not cells:
                continue
            number = _question_number(cells[0])
            if number is None and len(cells) > 1 and _is_numbered_cell(cells[0]):
                number = last_question_number + 1
            if number is None:
                row_paragraphs = cells[0]
                text = "\n".join(_plain_text(row_paragraphs))
                if not text:
                    continue
                found_range = _extract_range(text)
                if found_range:
                    active_context = {
                        "start": found_range[0],
                        "end": found_range[1],
                        "instruction": text,
                        "content": [],
                    }
                    contexts.append(active_context)
                elif active_context:
                    active_context["content"].extend(_plain_text(row_paragraphs))
                continue

            last_question_number = number
            content = [p for cell in cells[1:] for p in cell]
            content = _strip_translation(content)
            option_start, options = _option_tail(content)
            prompt_paragraphs = content[:option_start]
            prompt_images = [image for p in prompt_paragraphs for image in p.images]
            prompt_text = "\n".join(_plain_text(prompt_paragraphs))
            context_id = next(
                (
                    index
                    for index, context in enumerate(contexts)
                    if context["start"] <= number <= context["end"]
                ),
                None,
            )
            questions.append(
                {
                    "number": number,
                    "subject": _subject_for(number, metadata),
                    "type": _question_type(options, prompt_images),
                    "question": prompt_text,
                    "promptImages": prompt_images,
                    "options": options,
                    "answer": "",
                    "contextId": context_id,
                }
            )

    return {
        "sourceFile": path.name,
        "metadata": metadata,
        "contexts": contexts,
        "questions": questions,
        "stats": {
            "questionCount": len(questions),
            "contextCount": len(contexts),
            "imageCount": len(images),
        },
    }


if __name__ == "__main__":
    import argparse

    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("docx")
    cli.add_argument("--output")
    args = cli.parse_args()
    result = json.dumps(parse_docx(args.docx), ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(result, encoding="utf-8")
    else:
        print(result)
