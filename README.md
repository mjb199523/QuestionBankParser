# Question Paper Parser

A dependency-free MVP for uploading table-based Word question papers, extracting questions and options, reviewing the result, and exporting Excel.

## Run

Requires Python 3.10 or newer.

```powershell
python server.py
```

Open `http://127.0.0.1:8000`, then upload a `.docx` question paper.

## Test

```powershell
python -m unittest -v
```

## Parse from the command line

```powershell
python parser.py "paper.docx" --output "parsed.json"
```

## Supported by this MVP

- Unicode Assamese and English text
- Question papers structured using Word tables
- Word automatic numbering for answer options
- Reading passages associated with question ranges
- Question and option text only; passages and images are ignored
- Browser-based correction and answer selection
- Excel `.xlsx` export

The parser intentionally does not guess correct answers when the paper does not include an answer key.
