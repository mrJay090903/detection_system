import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"

// Force Node.js runtime for Buffer support
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log("=== Extract Text API Called ===")
  
  try {
    console.log("Getting form data...")
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    
    console.log("File info:", {
      name: file?.name || 'null',
      type: file?.type || 'null',
      size: file?.size || 'null'
    })

    if (!file) {
      console.log("No file provided")
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      console.log("File too large:", file.size)
      return NextResponse.json(
        { success: false, error: "File size must be less than 10MB" },
        { status: 400 }
      )
    }

    console.log("Converting to buffer...")
    const arrayBuffer = await file.arrayBuffer()
    console.log("ArrayBuffer size:", arrayBuffer.byteLength)
    const uint8Array = new Uint8Array(arrayBuffer)
    let extractedText = ""

    console.log("Processing file type:", file.type)
    
    // Extract text based on file type
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
      console.log("Processing PDF...")
      
      try {
        // Try Method 1: pdf-parse-fork (fast, works for most PDFs)
        try {
          console.log("Trying pdf-parse-fork...")
          // @ts-ignore - no type definitions available
          const pdfParse = (await import("pdf-parse-fork")).default
          const buffer = Buffer.from(arrayBuffer)
          const result = await pdfParse(buffer, {
            max: 0,
            version: 'v2.0.550',
          })
          extractedText = result.text
          console.log("✓ pdf-parse-fork succeeded, text length:", extractedText.length)
        } catch (parseError) {
          console.log("✗ pdf-parse-fork failed:", parseError instanceof Error ? parseError.message : 'Unknown error')
          
          // Try Method 2: pdfjs-dist (more robust, handles difficult PDFs)
          console.log("Trying pdfjs-dist as fallback...")
          // @ts-ignore - dynamic import
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
          
          // Load PDF document
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useSystemFonts: true,
            verbosity: 0
          })
          
          const pdf = await loadingTask.promise
          console.log(`PDF loaded: ${pdf.numPages} pages`)
          
          // Extract text from all pages
          const textPages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ')
            textPages.push(pageText)
          }
          
          extractedText = textPages.join('\n\n')
          console.log("✓ pdfjs-dist succeeded, text length:", extractedText.length)
        }
        
        // Check if text was extracted
        if (!extractedText || extractedText.trim().length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: "PDF appears to be empty or contains only images. Please copy and paste your text directly into the concept field instead." 
            },
            { status: 400 }
          )
        }
      } catch (pdfError) {
        console.error("All PDF parsing methods failed:", pdfError)
        const errorMsg = pdfError instanceof Error ? pdfError.message : "Unknown PDF error"
        
        return NextResponse.json(
          { 
            success: false, 
            error: `Unable to read PDF file. Please copy and paste your text directly into the concept field instead. (Error: ${errorMsg.substring(0, 100)})` 
          },
          { status: 400 }
        )
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword" ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.doc')
    ) {
      console.log("Processing DOCX/DOC...")
      try {
        // Extract text from DOCX/DOC - mammoth still uses Buffer
        const buffer = Buffer.from(arrayBuffer)
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
        console.log("DOCX text extracted, length:", extractedText.length)
      } catch (docError) {
        console.error("DOCX parsing error:", docError)
        const errorMsg = docError instanceof Error ? docError.message : "Unknown DOCX error"
        return NextResponse.json(
          { success: false, error: `Failed to parse DOCX: ${errorMsg}` },
          { status: 500 }
        )
      }
    } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith('.txt')) {
      console.log("Processing TXT...")
      try {
        // Extract text from TXT - convert Uint8Array to string
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(uint8Array)
        console.log("TXT text extracted, length:", extractedText.length)
      } catch (txtError) {
        console.error("TXT parsing error:", txtError)
        return NextResponse.json(
          { success: false, error: "Failed to read text file" },
          { status: 500 }
        )
      }
    } else {
      console.log("Unsupported file type:", file.type, "filename:", file.name)
      return NextResponse.json(
        { success: false, error: `Unsupported file type. Please upload PDF, DOCX, or TXT files.` },
        { status: 400 }
      )
    }

    // Clean up the extracted text
    extractedText = extractedText.trim()
    console.log("Final text length after trim:", extractedText.length)

    if (!extractedText) {
      console.log("No text extracted")
      return NextResponse.json(
        { success: false, error: "No text could be extracted from the file" },
        { status: 400 }
      )
    }

    console.log("Success! Returning response")
    return NextResponse.json({
      success: true,
      text: extractedText,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
  } catch (error) {
    console.error("=== Error in Extract Text API ===")
    console.error("Error extracting text:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to extract text from file" 
      },
      { status: 500 }
    )
  }
}
