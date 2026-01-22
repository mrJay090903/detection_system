import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MIN_FILE_SIZE = 100 // 100 bytes

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 10 // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  
  entry.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

// Magic byte validation for PDF files
function validatePDFSignature(buffer: Buffer): boolean {
  // PDF files start with %PDF (0x25, 0x50, 0x44, 0x46)
  if (buffer.length < 4) return false
  return buffer[0] === 0x25 && buffer[1] === 0x50 && 
         buffer[2] === 0x44 && buffer[3] === 0x46
}

// Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.\.+/g, '.')
    .substring(0, 255)
}

// Extract text from PDF using PyMuPDF (better performance and accuracy)
async function parsePDFWithPyMuPDF(buffer: Buffer): Promise<{ text: string, metadata?: any }> {
  // Create a temporary file for the PDF
  const tempFileName = `temp_pdf_${randomBytes(16).toString('hex')}.pdf`
  const tempFilePath = join(tmpdir(), tempFileName)
  
  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, buffer)
    console.log('[PyMuPDF] Temporary file created:', tempFilePath)
    
    // Call Python script to extract text using PyMuPDF
    const pythonScriptPath = join(process.cwd(), 'scripts', 'extract_pdf_text.py')
    console.log('[PyMuPDF] Calling Python script:', pythonScriptPath)
    console.log('[PyMuPDF] Python command: python3', pythonScriptPath, tempFilePath)
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, tempFilePath])
      
      let stdout = ''
      let stderr = ''
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      pythonProcess.on('close', async (code) => {
        console.log('[PyMuPDF] Process closed with code:', code)
        console.log('[PyMuPDF] stdout:', stdout.substring(0, 200))
        console.log('[PyMuPDF] stderr:', stderr)
        
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
          console.log('[PyMuPDF] Temporary file deleted')
        } catch (err) {
          console.error('[PyMuPDF] Failed to delete temporary file:', err)
        }
        
        if (code !== 0) {
          console.error('[PyMuPDF] Python script error:', stderr)
          reject(new Error(`PDF extraction failed: ${stderr || 'Unknown error'}`))
          return
        }
        
        try {
          const result = JSON.parse(stdout)
          if (result.success) {
            console.log('[PyMuPDF] Extraction successful, text length:', result.text?.length || 0)
            resolve({
              text: result.text,
              metadata: result.metadata
            })
          } else {
            console.error('[PyMuPDF] Extraction failed:', result.error)
            reject(new Error(result.error || 'PDF extraction failed'))
          }
        } catch (err) {
          console.error('[PyMuPDF] Failed to parse JSON output:', err)
          console.error('[PyMuPDF] stdout was:', stdout)
          reject(new Error(`Failed to parse extraction result: ${err}`))
        }
      })
      
      pythonProcess.on('error', async (err) => {
        console.error('[PyMuPDF] Process error:', err)
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
        } catch (unlinkErr) {
          console.error('[PyMuPDF] Failed to delete temporary file:', unlinkErr)
        }
        reject(new Error(`Failed to start Python process: ${err.message}`))
      })
    })
  } catch (err) {
    console.error('[PyMuPDF] Unexpected error:', err)
    // Clean up temporary file in case of error
    try {
      await unlink(tempFilePath)
    } catch (unlinkErr) {
      console.error('[PyMuPDF] Failed to delete temporary file:', unlinkErr)
    }
    throw err
  }
}

// Fallback: pdf-parse for pure JavaScript PDF parsing (works on Vercel)
async function parsePDFLegacy(buffer: Buffer) {
  try {
    const pdfParse = await import('pdf-parse')
    const parseFunction = pdfParse.default || pdfParse
    
    if (typeof parseFunction !== 'function') {
      throw new Error('pdf-parse import failed - not a function')
    }
    
    const result = await parseFunction(buffer)
    
    if (!result || !result.text) {
      throw new Error('pdf-parse returned no text')
    }
    
    return result
  } catch (error) {
    console.error('[pdf-parse] Detailed error:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const rateLimit = checkRateLimit(clientIP)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': (RATE_LIMIT_WINDOW / 1000).toString()
          }
        }
      )
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }
    
    if (file.size < MIN_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too small or corrupted' },
        { status: 400 }
      )
    }
    
    // 3. Sanitize filename
    const originalName = file.name
    const sanitizedName = sanitizeFilename(originalName)
    
    console.log('[Extract-Text] File received:', {
      originalName,
      sanitizedName,
      size: file.size,
      type: file.type,
      clientIP
    })

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
      // 4. Validate PDF magic bytes
      if (!validatePDFSignature(buffer)) {
        console.error('[Extract-Text] Invalid PDF signature')
        return NextResponse.json(
          { error: 'File is not a valid PDF. File content does not match PDF format.' },
          { status: 400 }
        )
      }
      
      // Extract text from PDF - Try PyMuPDF first, fallback to pdf-parse
      console.log('[Extract-Text] Attempting PDF extraction')
      let pdfExtractionMethod = 'unknown'
      
      try {
        // First try PyMuPDF (better quality but requires Python)
        console.log('[Extract-Text] Trying PyMuPDF extraction')
        const pdfData = await parsePDFWithPyMuPDF(buffer)
        extractedText = pdfData.text
        pdfExtractionMethod = 'PyMuPDF'
        console.log('[Extract-Text] PDF extracted using PyMuPDF:', {
          textLength: extractedText.length,
          metadata: pdfData.metadata
        })
      } catch (pymupdfError) {
        console.warn('[Extract-Text] PyMuPDF failed (likely Python not available), using pdf-parse fallback')
        console.log('[Extract-Text] PyMuPDF error details:', pymupdfError instanceof Error ? pymupdfError.message : String(pymupdfError))
        
        // Fallback to pdf-parse (pure JavaScript, works everywhere)
        try {
          console.log('[Extract-Text] Attempting pdf-parse fallback')
          const pdfData = await parsePDFLegacy(buffer)
          extractedText = pdfData.text
          pdfExtractionMethod = 'pdf-parse'
          console.log('[Extract-Text] PDF extracted using pdf-parse fallback:', {
            textLength: extractedText.length,
            pages: pdfData.numpages
          })
        } catch (fallbackError) {
          console.error('[Extract-Text] Both PDF parsing methods failed')
          console.error('[Extract-Text] PyMuPDF error:', pymupdfError)
          console.error('[Extract-Text] pdf-parse error:', fallbackError)
          return NextResponse.json(
            { 
              error: 'Failed to parse PDF file. The file may be corrupted, password-protected, or in an unsupported format.',
              details: process.env.NODE_ENV === 'development' 
                ? `PyMuPDF: ${pymupdfError instanceof Error ? pymupdfError.message : String(pymupdfError)}, pdf-parse: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
                : undefined
            },
            { status: 400 }
          )
        }
      }
      
      console.log(`[Extract-Text] PDF extraction successful using ${pdfExtractionMethod}`)
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
    
    // Keep original extracted text - don't collapse all whitespace yet
    console.log('[Extract] Raw text extracted:', {
      length: extractedText.length,
      preview: extractedText.substring(0, 200)
    })
    
    // Parse for title and concept while preserving all content
    const parsedContent = parseResearchProposal(extractedText)
    
    console.log('[Extract] After parsing:', {
      titleLength: parsedContent.title.length,
      conceptLength: parsedContent.concept.length,
      title: parsedContent.title,
      conceptPreview: parsedContent.concept.substring(0, 300)
    })
    
    if (!parsedContent.concept || parsedContent.concept.length < 10) {
      return NextResponse.json(
        { error: 'No meaningful text could be extracted from the file' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      text: parsedContent.concept,  // Return the cleaned concept
      title: parsedContent.title,    // Return extracted title if found
      fileName: file.name,
      fileSize: file.size,
      extractedLength: parsedContent.concept.length,
      rawLength: extractedText.length
    })
  } catch (error) {
    console.error('Text extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract text from file', details: String(error) },
      { status: 500 }
    )
  }
}

// Parse research proposal to extract title and concept
function parseResearchProposal(text: string): { title: string; concept: string } {
  // Normalize line breaks and whitespace
  let normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  
  console.log('[Parse] Normalized text:', {
    length: normalized.length,
    preview: normalized.substring(0, 300)
  })
  
  let title = ''
  let concept = normalized
  
  // Check if there's a "Sustainable Development Goal:" or "BU Thematic Area:" section
  const sdgIndex = normalized.search(/Sustainable\s+Development\s+Goal:/i)
  const buThematicIndex = normalized.search(/BU\s+Thematic\s+Area:/i)
  
  // Determine the boundary where title should stop (whichever comes first)
  let titleEndBoundary = -1
  if (buThematicIndex !== -1 && sdgIndex !== -1) {
    titleEndBoundary = Math.min(buThematicIndex, sdgIndex)
  } else if (buThematicIndex !== -1) {
    titleEndBoundary = buThematicIndex
  } else if (sdgIndex !== -1) {
    titleEndBoundary = sdgIndex
  }
  
  // Strategy 1: Look for explicit title markers and extract until boundary
  const titleMatch = normalized.match(/(?:proposed\s+title|research\s+title|title)\s*:/i)
  if (titleMatch) {
    const titleStartIndex = normalized.indexOf(titleMatch[0]) + titleMatch[0].length
    
    if (titleEndBoundary !== -1 && titleStartIndex < titleEndBoundary) {
      // Extract title from after the marker until the boundary (BU Thematic Area or SDG)
      title = normalized.substring(titleStartIndex, titleEndBoundary).trim()
      // Everything from the boundary onwards is the concept
      concept = normalized.substring(titleEndBoundary).trim()
    } else if (titleEndBoundary === -1) {
      // No boundary found, extract title from the line and rest is concept
      const titleLineMatch = normalized.substring(titleStartIndex).match(/([^\n]+)/)
      if (titleLineMatch) {
        title = titleLineMatch[1].trim()
        const titleLineEnd = titleStartIndex + titleLineMatch[0].length
        concept = normalized.substring(titleLineEnd).trim()
      }
    }
  }
  
  // Strategy 2: If no title marker, find first meaningful line (skip boilerplate, stop before boundary)
  if (!title) {
    const lines = normalized.split(/\n+/)
    let foundTitle = false
    let conceptStartIndex = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.length === 0) continue
      
      // Check if we've reached the boundary section (BU Thematic Area or SDG)
      if (titleEndBoundary !== -1) {
        const currentPosition = lines.slice(0, i).join('\n').length
        if (currentPosition >= titleEndBoundary) {
          break // Stop looking for title once we reach boundary section
        }
      }
      
      // Skip boilerplate patterns (but don't skip "BU Thematic Area:" as it marks the boundary)
      if (
        /Thematic\s+Area(?!\:)/i.test(line) || // Skip "Thematic Area" but not "BU Thematic Area:"
        /University\s+of/i.test(line) ||
        /Bicol\s+University/i.test(line) ||
        /College\s+of/i.test(line) ||
        /Department\s+of/i.test(line) ||
        /Submitted\s+(by|to)/i.test(line) ||
        /Prepared\s+by/i.test(line) ||
        /Research\s+Proposal/i.test(line) ||
        /Thesis\s+Proposal/i.test(line) ||
        /Capstone/i.test(line) ||
        /Concept\s+Paper/i.test(line) ||
        /^\d+$/i.test(line) || // Skip standalone numbers
        line.length < 10
      ) {
        continue
      }
      
      // Found the title
      if (line.length <= 200) {
        title = line
        conceptStartIndex = i + 1
        foundTitle = true
        break
      }
    }
    
    // Get everything after title as concept (including BU Thematic Area onwards)
    if (foundTitle && titleEndBoundary !== -1) {
      // Use the boundary to get concept from BU Thematic Area or SDG onwards
      concept = normalized.substring(titleEndBoundary).trim()
    } else if (foundTitle && conceptStartIndex < lines.length) {
      concept = lines.slice(conceptStartIndex).join('\n').trim()
    }
  }
  
  // If still no title, use first substantial line
  if (!title) {
    const lines = normalized.split(/\n+/).filter(l => l.trim().length > 10)
    if (lines.length > 0) {
      title = lines[0].trim().substring(0, 200)
      concept = lines.slice(1).join('\n').trim()
    } else {
      title = 'Untitled Research'
      concept = normalized
    }
  }
  
  // Only remove boilerplate patterns from concept, but keep "BU Thematic Area:" and everything after
  concept = concept
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      // Only remove lines that are pure boilerplate (excluding "BU Thematic Area:" with colon)
      return !(
        /^Thematic\s+Area\s*\d*$/i.test(trimmed) || // Remove "Thematic Area" without colon
        /^University\s+of/i.test(trimmed) ||
        /^Bicol\s+University$/i.test(trimmed) ||
        /^College\s+of/i.test(trimmed) ||
        /^Department\s+of/i.test(trimmed) ||
        /^Research\s+Proposal$/i.test(trimmed) ||
        /^Thesis\s+Proposal$/i.test(trimmed) ||
        /^Capstone\s+(Project|Proposal)$/i.test(trimmed) ||
        /^Concept\s+Paper$/i.test(trimmed) ||
        /^\d+$/i.test(trimmed) || // Remove standalone page numbers
        trimmed.length === 0
      )
    })
    .join(' ')
    .trim()
  
  // Normalize whitespace but keep content
  concept = concept.replace(/\s+/g, ' ').trim()
  
  console.log('[Parse] Final extraction:', {
    title: title,
    titleLength: title.length,
    conceptLength: concept.length,
    conceptPreview: concept.substring(0, 200)
  })
  
  return {
    title: title,
    concept: concept
  }
}



// Configure max file size (10MB)
export const maxDuration = 60; // Maximum execution time in seconds
export const bodyParser = false; // Disable default body parser to handle multipart/form-data
