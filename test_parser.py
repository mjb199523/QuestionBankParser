import unittest
import zipfile
from io import BytesIO
from pathlib import Path

from excel_export import create_xlsx
from parser import parse_docx


SAMPLE = Path(
    r"C:\Users\Manashjyoti Barman\Desktop\Final question paper & LO mapping_PAT 1st Round 2026-27"
    r"\Assamese medium\Word file\Class III_Assamese Medium.docx"
)
CLASS_V_SAMPLE = SAMPLE.with_name("Class V_Assamese Medium.docx")


class ParserTest(unittest.TestCase):
    @unittest.skipUnless(SAMPLE.exists(), "Sample document is not available")
    def test_sample_document(self):
        paper = parse_docx(SAMPLE)
        self.assertEqual(40, paper["stats"]["questionCount"])
        self.assertEqual(9, paper["stats"]["imageCount"])
        self.assertEqual(4, len(paper["questions"][0]["options"]))
        self.assertEqual("image_mcq", paper["questions"][32]["type"])
        self.assertEqual("image_mcq", paper["questions"][35]["type"])
        self.assertEqual(4, len(paper["questions"][35]["options"]))
        self.assertEqual(4, len(paper["questions"][39]["options"]))

    @unittest.skipUnless(CLASS_V_SAMPLE.exists(), "Class V sample document is not available")
    def test_word_numbered_question_rows_and_manual_options(self):
        paper = parse_docx(CLASS_V_SAMPLE)
        self.assertEqual(40, paper["stats"]["questionCount"])
        self.assertEqual(4, len(paper["questions"][2]["options"]))
        self.assertEqual("A", paper["questions"][2]["options"][0]["label"])
        self.assertEqual(4, len(paper["questions"][32]["options"]))
        self.assertEqual(3, len(paper["questions"][32]["promptImages"]))

        filename, raw = create_xlsx(paper)
        self.assertTrue(filename.endswith(".xlsx"))
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            sheet = archive.read("xl/worksheets/sheet1.xml").decode("utf-8")
        self.assertIn("Question No.", sheet)
        self.assertIn("Option A", sheet)
        self.assertNotIn("My Best Friend", sheet)


if __name__ == "__main__":
    unittest.main()
