"""
PDF Text Extraction using PyMuPDF (fitz)
This script extracts text from PDF files with better accuracy and performance.
"""

import fitz  # PyMuPDF
import sys
import json
from typing import Dict, Optional


def extract_text_from_pdf(pdf_path: str) -> Dict[str, any]:
    """
    Extract text from a PDF file using PyMuPDF.
    
    Args:
        pdf_path: Path to the PDF file
    
    Returns:
        Dictionary containing extracted text and metadata
    """
    try:
        # Open the PDF
        doc = fitz.open(pdf_path)
        
        # Extract text from all pages
        full_text = ""
        page_texts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Use get_text() with default layout preservation
            page_text = page.get_text("text")
            page_texts.append({
                "page": page_num + 1,
                "text": page_text,
                "length": len(page_text)
            })
            full_text += page_text + "\n"
        
        # Get document metadata
        metadata = doc.metadata
        page_count = len(doc)
        
        # Minimal cleaning - only normalize excessive newlines
        # Keep the text as close to original as possible
        cleaned_text = full_text.strip()
        
        doc.close()
        
        return {
            "success": True,
            "text": cleaned_text,
            "full_text": full_text,
            "page_count": page_count,
            "pages": page_texts,
            "metadata": {
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "creation_date": metadata.get("creationDate", ""),
                "mod_date": metadata.get("modDate", "")
            },
            "character_count": len(cleaned_text),
            "word_count": len(cleaned_text.split())
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def extract_text_from_bytes(pdf_bytes: bytes) -> Dict[str, any]:
    """
    Extract text from PDF bytes using PyMuPDF.
    
    Args:
        pdf_bytes: PDF file as bytes
    
    Returns:
        Dictionary containing extracted text and metadata
    """
    try:
        # Open the PDF from bytes
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Extract text from all pages
        full_text = ""
        page_texts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Use get_text() with default layout preservation
            page_text = page.get_text("text")
            page_texts.append({
                "page": page_num + 1,
                "text": page_text,
                "length": len(page_text)
            })
            full_text += page_text + "\n"
        
        # Get document metadata
        metadata = doc.metadata
        page_count = len(doc)
        
        # Minimal cleaning - only normalize excessive newlines
        # Keep the text as close to original as possible
        cleaned_text = full_text.strip()
        
        doc.close()
        
        return {
            "success": True,
            "text": cleaned_text,
            "full_text": full_text,
            "page_count": page_count,
            "pages": page_texts,
            "metadata": {
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "creation_date": metadata.get("creationDate", ""),
                "mod_date": metadata.get("modDate", "")
            },
            "character_count": len(cleaned_text),
            "word_count": len(cleaned_text.split())
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
