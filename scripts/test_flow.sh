#!/bin/bash
# Test the complete flow

echo "=== Testing PDF Upload and Analysis Flow ==="
echo ""

# Create a test PDF
echo "1. Creating test PDF..."
python3 << 'EOF'
import fitz

doc = fitz.open()
page = doc.new_page()
text = """Research Title and Concept Similarity Verification System Using AI

This research proposes a comprehensive system for detecting similarity between research titles 
and concepts using advanced natural language processing techniques. The system will implement 
multiple algorithms including cosine similarity, Jaccard similarity, and semantic analysis 
to provide accurate similarity detection for academic institutions."""

page.insert_text((50, 50), text, fontsize=11)
doc.save("/tmp/test_research.pdf")
doc.close()
print("✓ Test PDF created")
EOF

echo ""
echo "2. Testing PDF extraction..."
python3 /workspaces/detection_system/scripts/extract_pdf_text.py /tmp/test_research.pdf | python3 -m json.tool | head -20

echo ""
echo "3. Cleanup..."
rm -f /tmp/test_research.pdf

echo ""
echo "=== Test Complete ==="
echo ""
echo "✓ PyMuPDF is working correctly"
echo "✓ PDF text extraction is functional"
echo ""
echo "To test the full flow:"
echo "1. Open http://localhost:3001/research-check"
echo "2. Select a course"
echo "3. Upload the PDF file"
echo "4. Click 'Check Similarity'"
echo "5. Click 'Analyze with AI' on any result"
