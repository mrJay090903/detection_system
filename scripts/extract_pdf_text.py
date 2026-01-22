"""
PDF Text Extraction using pdfminer.six (pure Python)
Optimized for Vercel serverless execution - fast and memory-efficient.
"""

import sys
import json
from typing import Dict, Optional
from pdfminer.high_level import extract_text
from pdfminer.layout import LAParams
from io import BytesIO


def extract_text_from_pdf(pdf_path: str) -> Dict[str, any]:
    """
    Extract text from a PDF file using pdfminer.six.
    Optimized for speed - minimal page-by-page processing.
    
    Args:
        pdf_path: Path to the PDF file
    
    Returns:
        Dictionary containing extracted text and metadata
    """
    try:
        # Extract text with optimized layout parameters (faster)
        laparams = LAParams(
            line_margin=0.5,
            word_margin=0.1,
            char_margin=2.0,
            boxes_flow=0.5,
            detect_vertical=False,  # Disable for speed
            all_texts=False  # Only main text for speed
        )
        
        # Extract all text at once (faster than page-by-page)
        full_text = extract_text(pdf_path, laparams=laparams)
        
        # Quick word and character count
        cleaned_text = full_text.strip()
        word_count = len(cleaned_text.split())
        
        return {
            "success": True,
            "text": cleaned_text,
            "character_count": len(cleaned_text),
            "word_count": word_count,
            "metadata": {
                "extractor": "pdfminer.six"
            }
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def extract_text_from_bytes(pdf_bytes: bytes) -> Dict[str, any]:
    """
    Extract text from PDF bytes using pdfminer.six (pure Python).
    Optimized for speed and memory efficiency.
    
    Args:
        pdf_bytes: PDF file as bytes
    
    Returns:
        Dictionary containing extracted text and metadata
    """
    try:
        # Create a BytesIO object from bytes
        pdf_file = BytesIO(pdf_bytes)
        
        # Extract text with optimized layout parameters
        laparams = LAParams(
            line_margin=0.5,
            word_margin=0.1,
            char_margin=2.0,
            boxes_flow=0.5,
            detect_vertical=False,
            all_texts=False
        )
        
        # Extract all text at once
        full_text = extract_text(pdf_file, laparams=laparams)
        
        # Clean up text
        cleaned_text = full_text.strip()
        
        return {
            "success": True,
            "text": cleaned_text,
            "character_count": len(cleaned_text),
            "word_count": len(cleaned_text.split()),
            "metadata": {
                "extractor": "pdfminer.six"
            }
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def main():
    """Main function for CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No PDF file path provided"
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_text_from_pdf(pdf_path)
    print(json.dumps(result, indent=2))
    
    if not result["success"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
