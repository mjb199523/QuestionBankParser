import sys
sys.stdout.reconfigure(encoding='utf-8')
import xml.etree.ElementTree as ET
import re
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}
W_VAL = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'

def _extract_text_chunks(element: ET.Element) -> list:
    chunks = []
    for child in element:
        if child.tag == f"{{{NS['w']}}}r":
            for t in child.findall('.//w:t', NS):
                if not t.text: continue
                text = t.text
                rPr = child.find('.//w:rPr', NS)
                if rPr is not None:
                    vertAlign = rPr.find('.//w:vertAlign', NS)
                    if vertAlign is not None and vertAlign.get(W_VAL) == 'superscript':
                        if text.strip() in ('0', 'o', 'O'):
                            text = text.replace(text.strip(), '°')
                chunks.append(text)
        elif child.tag in (f"{{{NS['m']}}}oMath", f"{{{NS['m']}}}oMathPara"):
            chunks.extend(_extract_text_chunks(child))
        elif child.tag == f"{{{NS['m']}}}f":
            num = child.find('.//m:num', NS)
            den = child.find('.//m:den', NS)
            num_text = ''.join(_extract_text_chunks(num)) if num is not None else ''
            den_text = ''.join(_extract_text_chunks(den)) if den is not None else ''
            chunks.append(f"{num_text}/{den_text}")
        elif child.tag == f"{{{NS['m']}}}r":
            for t in child.findall('.//m:t', NS):
                if t.text: chunks.append(t.text)
        else:
            chunks.extend(_extract_text_chunks(child))
    return chunks

def _text(element: ET.Element) -> str:
    chunks = _extract_text_chunks(element)
    return re.sub(r'\s+', ' ', ''.join(chunks)).strip()

with open('math_dump.xml', 'r', encoding='utf-8') as f:
    p = ET.fromstring(f.read())
    print('RESULT:')
    print(_text(p))
