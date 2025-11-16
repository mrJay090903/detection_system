import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"

// Force Node.js runtime for Buffer support
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log("=== Extract Text API Called ===")
  
  try {
    console.log("Getting form data...")
    const formData = await request.formData()
    const file = formData.get("file") as File
    
    console.log("File info:", {
      name: file?.name,
      type: file?.type,
      size: file?.size
    })

    if (!file) {
      console.log("No file provided")
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      )
    }

    console.log("Converting to buffer...")
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ""

    console.log("Processing file type:", file.type)
    
    // Extract text based on file type
    if (file.type === "application/pdf") {
      console.log("Processing PDF...")
      try {
        // Dynamic import for pdf-parse
        const pdfParse = await import("pdf-parse")
        const data = await (pdfParse as any)(buffer)
        extractedText = data.text
        console.log("PDF text extracted, length:", extractedText.length)
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError)
        throw new Error("Failed to parse PDF file")
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      console.log("Processing DOCX/DOC...")
      // Extract text from DOCX/DOC
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
      console.log("DOCX text extracted, length:", extractedText.length)
    } else if (file.type === "text/plain") {
      console.log("Processing TXT...")
      // Extract text from TXT
      extractedText = buffer.toString("utf-8")
      console.log("TXT text extracted, length:", extractedText.length)
    } else {
      console.log("Unsupported file type:", file.type)
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${file.type}` },
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
