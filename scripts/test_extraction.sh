#!/bin/bash
# Test script for PDF extraction

# Create a simple test PDF with text content
echo "Creating test PDF..."
python3 << 'EOF'
import fitz

# Create a simple PDF with text
doc = fitz.open()
page = doc.new_page()
text = "This is a test PDF document for the detection system. It contains sample text for extraction."
page.insert_text((50, 50), text, fontsize=12)
doc.save("/tmp/test_sample.pdf")
doc.close()
print("Test PDF created at /tmp/test_sample.pdf")
EOF

echo ""
echo "Testing Python extraction script..."
python3 /workspaces/detection_system/scripts/extract_pdf_text.py /tmp/test_sample.pdf

echo ""
echo "Cleanup..."
rm -f /tmp/test_sample.pdf
echo "Test complete!"
