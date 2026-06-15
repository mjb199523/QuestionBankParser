import glob
from parser import parse_docx, _is_primarily_latin

docx_files = glob.glob(r'C:\Users\Manashjyoti Barman\Downloads\*.docx')
issues = []
for docx_path in docx_files:
    try:
        result = parse_docx(docx_path)
    except Exception as e:
        continue
    
    for q in result['questions']:
        # Check if the parsed question still contains significant English text
        if "What happens" in q['question'] or "Which of the following" in q['question']:
            issues.append((docx_path, q['number'], q['question']))

if not issues:
    print("No issues found! English text is successfully stripped in all tested files.")
else:
    for issue in issues:
        print(f"File: {issue[0]} | Q{issue[1]}")
        print(f"Text: {issue[2]}\n")
