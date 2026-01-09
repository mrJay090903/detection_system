import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

// pdf-parse doesn't have ESM support, need to use dynamic import
async function parsePDF(buffer: Buffer) {
  const pdfParse = await import('pdf-parse') as any
  const pdf = pdfParse.default || pdfParse
  return pdf(buffer)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const fileType = file.type
    const fileName = file.name.toLowerCase()
    
    // IMPORTANT: File is only processed in memory for text extraction
    // The file is NOT saved to disk or database - it's only scanned to read the content
    // Convert file to buffer for in-memory processing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    let extractedText = ''
    
    // Extract text based on file type
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Extract text from PDF
      try {
        const pdfData = await parsePDF(buffer)
        extractedText = pdfData.text
      } catch (error) {
        console.error('PDF parsing error:', error)
        return NextResponse.json(
          { error: 'Failed to parse PDF file' },
          { status: 400 }
        )
      }
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      // Extract text from DOCX
      try {
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
      } catch (error) {
        console.error('DOCX parsing error:', error)
        return NextResponse.json(
          { error: 'Failed to parse DOCX file' },
          { status: 400 }
        )
      }
    } else if (
      fileType === 'application/msword' ||
      fileName.endsWith('.doc')
    ) {
      // For .doc files (older Word format)
      return NextResponse.json(
        { error: 'Legacy .doc format is not supported. Please convert to .docx or PDF format.' },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF or DOCX file.' },
        { status: 400 }
      )
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')  // Replace multiple spaces/newlines with single space
      .trim()
    
    if (!extractedText || extractedText.length < 10) {
      return NextResponse.json(
        { error: 'No text could be extracted from the file' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      text: extractedText,
      fileName: file.name,
      fileSize: file.size,
      extractedLength: extractedText.length
    })
  } catch (error) {
    console.error('Text extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract text from file', details: String(error) },
      { status: 500 }
    )
  }
}

// Configure max file size (10MB)
export const maxDuration = 60; // Maximum execution time in seconds
export const bodyParser = false; // Disable default body parser to handle multipart/form-data
