"""Create a simple Excel workbook containing question and option text."""

from __future__ import annotations

import io
import re
import zipfile
from xml.sax.saxutils import escape


def _cell(ref: str, value, style: int = 0) -> str:
    text = escape(str(value or ""))
    preserve = ' xml:space="preserve"' if text.startswith(" ") or text.endswith(" ") else ""
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t{preserve}>{text}</t></is></c>'


def _column(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-") or "questions"


def create_xlsx(paper: dict) -> tuple[str, bytes]:
    questions = paper.get("questions", [])
    max_options = max((len(q.get("options", [])) for q in questions), default=4)
    max_options = max(4, max_options)
    headers = ["Question No.", "Question"] + [f"Option {_column(i)}" for i in range(1, max_options + 1)]
    rows = [headers]
    for question in questions:
        options = [option.get("text", "") for option in question.get("options", [])]
        rows.append(
            [question.get("number", ""), question.get("question", "")]
            + options
            + [""] * (max_options - len(options))
        )

    row_xml = []
    for row_index, row in enumerate(rows, 1):
        style = 1 if row_index == 1 else 2
        cells = "".join(_cell(f"{_column(col_index)}{row_index}", value, style) for col_index, value in enumerate(row, 1))
        height = ' ht="24" customHeight="1"' if row_index == 1 else ""
        row_xml.append(f'<row r="{row_index}"{height}>{cells}</row>')

    last_col = _column(len(headers))
    sheet = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="70" customWidth="1"/><col min="3" max="{len(headers)}" width="36" customWidth="1"/></cols>
  <sheetData>{''.join(row_xml)}</sheetData>
  <autoFilter ref="A1:{last_col}{len(rows)}"/>
</worksheet>"""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF08705A"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD9E3DD"/></left><right style="thin"><color rgb="FFD9E3DD"/></right><top style="thin"><color rgb="FFD9E3DD"/></top><bottom style="thin"><color rgb="FFD9E3DD"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""
    files = {
        "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""",
        "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""",
        "xl/workbook.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets></workbook>""",
        "xl/_rels/workbook.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""",
        "xl/worksheets/sheet1.xml": sheet,
        "xl/styles.xml": styles,
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in files.items():
            archive.writestr(path, content.encode("utf-8"))
    filename = f"{_safe_name(paper.get('sourceFile', 'questions').removesuffix('.docx'))}-questions.xlsx"
    return filename, output.getvalue()
