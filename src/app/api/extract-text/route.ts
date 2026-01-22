import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

// File size limits (optimized for Vercel)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (Vercel serverless function limit)
const MIN_FILE_SIZE = 100 // 100 bytes

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 10 // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

// Vercel optimization: Timeout for Python processes
const PYTHON_PROCESS_TIMEOUT = 25000 // 25 seconds (Vercel has 30s limit for hobby plan)

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

// Extract text from PDF using pdfminer.six (pure Python, no native dependencies)
async function parsePDFWithPython(buffer: Buffer): Promise<{ text: string, metadata?: any }> {
  // Create a temporary file in /tmp directory
  const tempFileName = `temp_pdf_${randomBytes(16).toString('hex')}.pdf`
  const tempFilePath = join('/tmp', tempFileName)
  
  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, buffer)
    console.log('[Python/pdfminer] Temporary file created:', tempFilePath)
    
    // Call Python script to extract text using pdfminer.six
    const pythonScriptPath = join(process.cwd(), 'scripts', 'extract_pdf_text.py')
    console.log('[Python/pdfminer] Calling Python script:', pythonScriptPath)
    console.log('[Python/pdfminer] Python command: python3', pythonScriptPath, tempFilePath)
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, tempFilePath])
      
      let stdout = ''
      let stderr = ''
      let isComplete = false
      
      // Set timeout for Python process (Vercel optimization)
      const timeout = setTimeout(() => {
        if (!isComplete) {
          pythonProcess.kill()
          reject(new Error('PDF extraction timeout - file may be too large or complex'))
        }
      }, PYTHON_PROCESS_TIMEOUT)
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      pythonProcess.on('close', async (code) => {
        isComplete = true
        clearTimeout(timeout)
        console.log('[Python/pdfminer] Process closed with code:', code)
        console.log('[Python/pdfminer] stdout:', stdout.substring(0, 200))
        console.log('[Python/pdfminer] stderr:', stderr)
        
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
          console.log('[Python/pdfminer] Temporary file deleted')
        } catch (err) {
          console.error('[Python/pdfminer] Failed to delete temporary file:', err)
        }
        
        if (code !== 0) {
          console.error('[Python/pdfminer] Python script error:', stderr)
          reject(new Error(`PDF extraction failed: ${stderr || 'Unknown error'}`))
          return
        }
        
        try {
          const result = JSON.parse(stdout)
          if (result.success) {
            console.log('[Python/pdfminer] Extraction successful, text length:', result.text?.length || 0)
            resolve({
              text: result.text,
              metadata: result.metadata
            })
          } else {
            console.error('[Python/pdfminer] Extraction failed:', result.error)
            reject(new Error(result.error || 'PDF extraction failed'))
          }
        } catch (err) {
          console.error('[Python/pdfminer] Failed to parse JSON output:', err)
          console.error('[Python/pdfminer] stdout was:', stdout)
          reject(new Error(`Failed to parse extraction result: ${err}`))
        }
      })
      
      pythonProcess.on('error', async (err) => {
        isComplete = true
        clearTimeout(timeout)
        console.error('[Python/pdfminer] Process error:', err)
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
        } catch (unlinkErr) {
          console.error('[Python/pdfminer] Failed to delete temporary file:', unlinkErr)
        }
        reject(new Error(`Failed to start Python process: ${err.message}`))
      })
    })
  } catch (err) {
    console.error('[Python/pdfminer] Unexpected error:', err)
    // Clean up temporary file in case of error
    try {
      await unlink(tempFilePath)
    } catch (unlinkErr) {
      console.error('[Python/pdfminer] Failed to delete temporary file:', unlinkErr)
    }
    throw err
  }
}

// Extract text from DOCX using python-docx (pure Python, no native dependencies)
async function parseDOCXWithPython(buffer: Buffer): Promise<{ text: string, metadata?: any }> {
  // Create a temporary file in /tmp directory
  const tempFileName = `temp_docx_${randomBytes(16).toString('hex')}.docx`
  const tempFilePath = join('/tmp', tempFileName)
  
  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, buffer)
    console.log('[Python/python-docx] Temporary file created:', tempFilePath)
    
    // Call Python script to extract text using python-docx
    const pythonScriptPath = join(process.cwd(), 'scripts', 'extract_docx_text.py')
    console.log('[Python/python-docx] Calling Python script:', pythonScriptPath)
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, tempFilePath])
      
      let stdout = ''
      let stderr = ''
      let isComplete = false
      
      // Set timeout for Python process (Vercel optimization)
      const timeout = setTimeout(() => {
        if (!isComplete) {
          pythonProcess.kill()
          reject(new Error('DOCX extraction timeout - file may be too large or complex'))
        }
      }, PYTHON_PROCESS_TIMEOUT)
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      pythonProcess.on('close', async (code) => {
        isComplete = true
        clearTimeout(timeout)
        console.log('[Python/python-docx] Process closed with code:', code)
        
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
          console.log('[Python/python-docx] Temporary file deleted')
        } catch (err) {
          console.error('[Python/python-docx] Failed to delete temporary file:', err)
        }
        
        if (code !== 0) {
          console.error('[Python/python-docx] Python script error:', stderr)
          reject(new Error(`DOCX extraction failed: ${stderr || 'Unknown error'}`))
          return
        }
        
        try {
          const result = JSON.parse(stdout)
          if (result.success) {
            console.log('[Python/python-docx] Extraction successful, text length:', result.text?.length || 0)
            resolve({
              text: result.text,
              metadata: result.metadata
            })
          } else {
            console.error('[Python/python-docx] Extraction failed:', result.error)
            reject(new Error(result.error || 'DOCX extraction failed'))
          }
        } catch (err) {
          console.error('[Python/python-docx] Failed to parse JSON output:', err)
          reject(new Error(`Failed to parse extraction result: ${err}`))
        }
      })
      
      pythonProcess.on('error', async (err) => {
        isComplete = true
        clearTimeout(timeout)
        console.error('[Python/python-docx] Process error:', err)
        // Clean up temporary file
        try {
          await unlink(tempFilePath)
        } catch (unlinkErr) {
          console.error('[Python/python-docx] Failed to delete temporary file:', unlinkErr)
        }
        reject(new Error(`Failed to start Python process: ${err.message}`))
      })
    })
  } catch (err) {
    console.error('[Python/python-docx] Unexpected error:', err)
    // Clean up temporary file in case of error
    try {
      await unlink(tempFilePath)
    } catch (unlinkErr) {
      console.error('[Python/python-docx] Failed to delete temporary file:', unlinkErr)
    }
    throw err
  }
}

// Fallback: PDF.js (Mozilla) for pure JavaScript PDF parsing (works reliably on Vercel)
async function parsePDFWithPDFJS(buffer: Buffer) {
  try {
    console.log('[PDF.js] Starting PDF parsing with buffer size:', buffer.length)
    
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty buffer provided')
    }
    
    // Validate PDF header
    const pdfHeader = buffer.slice(0, 5).toString('utf8')
    console.log('[PDF.js] PDF header:', pdfHeader)
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error('Invalid PDF header - file may be corrupted')
    }
    
    // Import PDF.js dynamically
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    console.log('[PDF.js] Module imported successfully')
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      verbosity: 0 // Reduce logging
    })
    
    const pdfDocument = await loadingTask.promise
    console.log('[PDF.js] PDF loaded, pages:', pdfDocument.numPages)
    
    if (pdfDocument.numPages === 0) {
      throw new Error('PDF has no pages')
    }
    
    // Extract text from all pages
    let fullText = ''
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }
    
    console.log('[PDF.js] Text extraction completed:', {
      textLength: fullText.length,
      numPages: pdfDocument.numPages
    })
    
    // Clean up
    await pdfDocument.destroy()
    
    // Validate extracted text
    const cleanedText = fullText.trim()
    if (!cleanedText || cleanedText.length === 0) {
      throw new Error('PDF contains no extractable text - it may be image-based (scanned document) or empty')
    }
    
    if (cleanedText.length < 10) {
      throw new Error('PDF contains insufficient text content - it may be primarily images')
    }
    
    return {
      text: cleanedText,
      numpages: pdfDocument.numPages
    }
  } catch (error) {
    console.error('[PDF.js] Error details:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    })
    
    // Provide specific error messages
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
      throw new Error('PDF is password-protected or encrypted')
    } else if (errorMsg.includes('Invalid') || errorMsg.includes('corrupt')) {
      throw new Error('PDF file is corrupted or invalid')
    } else if (errorMsg.includes('image-based') || errorMsg.includes('no extractable text')) {
      throw error // Pass through our custom messages
    } else {
      throw new Error(`PDF parsing failed: ${errorMsg}`)
    }
  }
}

// Legacy fallback: pdf-parse (keep as last resort)
async function parsePDFLegacy(buffer: Buffer) {
  try {
    console.log('[pdf-parse] Starting legacy PDF parsing')
    const pdfParse = await import('pdf-parse')
    const parseFunction = (pdfParse as any).default || pdfParse
    
    const result = await parseFunction(buffer, {
      max: 0,
      version: 'default',
      pagerender: undefined
    })
    
    if (!result?.text || result.text.trim().length < 10) {
      throw new Error('PDF contains no extractable text - it may be image-based (scanned document) or empty')
    }
    
    return result
  } catch (error) {
    console.error('[pdf-parse] Failed:', error instanceof Error ? error.message : String(error))
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
      
      // Extract text from PDF - Optimized for Vercel (prioritize JavaScript methods)
      console.log('[Extract-Text] Attempting PDF extraction')
      let pdfExtractionMethod = 'unknown'
      let pdfJsError: any = null
      
      try {
        // First try PDF.js (pure JavaScript - works perfectly on Vercel)
        console.log('[Extract-Text] Trying PDF.js extraction (Vercel-optimized)')
        const pdfData = await parsePDFWithPDFJS(buffer)
        extractedText = pdfData.text
        pdfExtractionMethod = 'PDF.js'
        console.log('[Extract-Text] PDF extracted using PDF.js:', {
          textLength: extractedText.length,
          pages: pdfData.numpages
        })
      } catch (pdfjsErr) {
        pdfJsError = pdfjsErr
        console.warn('[Extract-Text] PDF.js failed, trying pdf-parse fallback')
        console.log('[Extract-Text] PDF.js error:', pdfjsErr instanceof Error ? pdfjsErr.message : String(pdfjsErr))
        
        // Try PDF.js (Mozilla's library - works great on Vercel)
        try {
          console.log('[Extract-Text] Attempting PDF.js extraction')
          const pdfData = await parsePDFWithPDFJS(buffer)
          extractedText = pdfData.text
          pdfExtractionMethod = 'PDF.js'
          console.log('[Extract-Text] PDF extracted using PDF.js:', {
            textLength: extractedText.length,
            pages: pdfData.numpages
          })
        } catch (pdfjsError) {
          console.warn('[Extract-Text] PDF.js failed, trying pdf-parse as last resort')
          console.log('[Extract-Text] PDF.js error:', pdfjsError instanceof Error ? pdfjsError.message : String(pdfjsError))
          
          // Last resort: pdf-parse fallback
          try {
            console.log('[Extract-Text] Attempting pdf-parse fallback')
            const pdfData = await parsePDFLegacy(buffer)
            extractedText = pdfData.text
            pdfExtractionMethod = 'pdf-parse'
            console.log('[Extract-Text] PDF extracted using pdf-parse:', {
              textLength: extractedText.length,
              pages: pdfData.numpages
            })
          } catch (fallbackError) {
            console.error('[Extract-Text] All PDF parsing methods failed')
            console.error('[Extract-Text] PDF.js error:', {
              message: pdfJsError instanceof Error ? pdfJsError.message : String(pdfJsError)
            })
            console.error('[Extract-Text] pdf-parse error:', {
              message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
              stack: fallbackError instanceof Error ? fallbackError.stack : undefined
            })
            
            // Provide more specific and helpful error message
            let userMessage = 'Failed to parse PDF file.'
            let suggestions: string[] = []
            
            if (fallbackError instanceof Error) {
              const errorMsg = fallbackError.message.toLowerCase()
              if (errorMsg.includes('images') || errorMsg.includes('empty text') || errorMsg.includes('image-based')) {
                userMessage = 'This PDF appears to contain only scanned images without text.'
                suggestions = [
                  'Try opening the PDF and using "Select All" (Ctrl+A or Cmd+A) - if you can\'t select text, it\'s image-based',
                  'Use a PDF with selectable text, or convert your scanned PDF using OCR software',
                  'Try copying the text manually from the PDF and pasting it into the form'
                ]
              } else if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
                userMessage = 'This PDF is password-protected or encrypted.'
                suggestions = [
                  'Remove the password protection from the PDF',
                  'Save a copy without password protection and try again'
                ]
              } else if (errorMsg.includes('corrupt') || errorMsg.includes('invalid')) {
                userMessage = 'This PDF file appears to be corrupted or invalid.'
                suggestions = [
                  'Try opening the PDF in a PDF reader to verify it works',
                  'Save a new copy of the PDF and try again',
                  'Convert the PDF to a different format and back'
                ]
              } else {
                userMessage = 'Unable to extract text from this PDF.'
                suggestions = [
                  'Ensure the PDF contains selectable text (not just images)',
                  'Try removing any password protection',
                  'Save a new copy of the PDF and try uploading again',
                  'Alternatively, manually enter your research details in the form below'
                ]
              }
            }
            
            return NextResponse.json(
              { 
                error: userMessage,
                suggestions: suggestions,
                details: process.env.NODE_ENV === 'development' 
                  ? `All methods failed | PDF.js: ${pdfJsError instanceof Error ? pdfJsError.message : String(pdfJsError)} | pdf-parse: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
                  : undefined,
                canManualEntry: true // Signal to frontend that manual entry is available
              },
              { status: 400 }
            )
          }
        }
      }
      
      console.log(`[Extract-Text] PDF extraction successful using ${pdfExtractionMethod}`)
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      // Extract text from DOCX - Prioritize JavaScript for Vercel
      console.log('[Extract-Text] Attempting DOCX extraction')
      let docxExtractionMethod = 'unknown'
      
      try {
        // Use mammoth (JavaScript) - works perfectly on Vercel
        console.log('[Extract-Text] Trying mammoth extraction (Vercel-optimized)')
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
        docxExtractionMethod = 'mammoth'
        console.log('[Extract-Text] DOCX extracted using mammoth:', {
          textLength: extractedText.length
        })
      } catch (mammothError) {
        console.error('[Extract-Text] DOCX parsing failed')
        console.error('[Extract-Text] Mammoth error:', mammothError instanceof Error ? mammothError.message : String(mammothError))
        
        return NextResponse.json(
          { 
            error: 'Failed to parse DOCX file',
            suggestions: [
              'Ensure the file is a valid DOCX document',
              'Try opening and saving the file in Microsoft Word or Google Docs',
              'Convert the document to PDF format and try again'
            ],
            details: process.env.NODE_ENV === 'development' 
              ? `Mammoth: ${mammothError instanceof Error ? mammothError.message : String(mammothError)}`
              : undefined
          },
          { status: 400 }
        )
      }
      
      console.log(`[Extract-Text] DOCX extraction successful using ${docxExtractionMethod}`)
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

// Parse research proposal to extract title and concept automatically
function parseResearchProposal(text: string): { title: string; concept: string } {
  // Normalize line breaks and whitespace
  let normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .trim()
  
  console.log('[Parse] Normalized text length:', normalized.length)
  
  let title = ''
  let concept = ''
  
  // Strategy: Find "BU Thematic Area" marker (with or without colon)
  const buThematicMarker = /BU\s+Thematic\s+Area/i
  const buThematicMatch = normalized.search(buThematicMarker)
  
  if (buThematicMatch !== -1) {
    // Found "BU Thematic Area" - split here
    const titleSection = normalized.substring(0, buThematicMatch).trim()
    const conceptSection = normalized.substring(buThematicMatch).trim()
    
    console.log('[Parse] Found "BU Thematic Area" at position:', buThematicMatch)
    console.log('[Parse] Title section length:', titleSection.length)
    console.log('[Parse] Concept section length:', conceptSection.length)
    
    // Extract title from title section
    // Look for explicit title markers: "Research Title:", "Proposed Title:", "Title:"
    const titleMarkerRegex = /(?:Research\s+Title|Proposed\s+Title|Title)\s*:\s*(.+?)$/im
    const titleMatch = titleSection.match(titleMarkerRegex)
    
    if (titleMatch) {
      // Found title marker - extract everything after the marker
      const titleStart = titleSection.indexOf(titleMatch[0]) + titleMatch[0].indexOf(':') + 1
      const textAfterMarker = titleSection.substring(titleStart).trim()
      
      // Title is everything from after the marker until the end of the title section
      // Clean up the text and normalize whitespace
      title = textAfterMarker
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
          // Remove boilerplate lines but keep the actual title content
          return !(
            /^University\s+of/i.test(line) ||
            /^Bicol\s+University$/i.test(line) ||
            /^College\s+of/i.test(line) ||
            /^Department\s+of/i.test(line) ||
            /^Submitted\s+(by|to)/i.test(line) ||
            /^Prepared\s+by/i.test(line) ||
            /^Research\s+Proposal$/i.test(line) ||
            /^Thesis\s+Proposal$/i.test(line) ||
            /^Capstone\s+(Project|Proposal)$/i.test(line) ||
            /^Concept\s+Paper$/i.test(line) ||
            /^\d{4}$/i.test(line) ||
            /^Page\s+\d+/i.test(line) ||
            line.length === 0
          )
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      console.log('[Parse] Extracted title from marker:', title.substring(0, 100))
    } else {
      // No title marker found - use the first substantial line
      const lines = titleSection
        .split('\n')
        .map(l => l.trim())
        .filter(l => {
          // Skip boilerplate
          return !(
            /^University\s+of/i.test(l) ||
            /^Bicol\s+University$/i.test(l) ||
            /^College\s+of/i.test(l) ||
            /^Department\s+of/i.test(l) ||
            /^Submitted\s+(by|to)/i.test(l) ||
            /^Prepared\s+by/i.test(l) ||
            /^Research\s+Proposal$/i.test(l) ||
            /^Thesis\s+Proposal$/i.test(l) ||
            /^\d{4}$/i.test(l) ||
            l.length < 10
          )
        })
      
      if (lines.length > 0) {
        title = lines[0].substring(0, 200)
      }
      
      console.log('[Parse] No title marker found, using first line:', title.substring(0, 100))
    }
    
    // Concept is everything from "BU Thematic Area" onwards
    concept = conceptSection
      .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
      .trim()
  } else {
    // No "BU Thematic Area:" found - try fallback parsing
    console.log('[Parse] "BU Thematic Area:" not found, using fallback parsing')
    
    // Look for SDG marker as alternative
    const sdgMarker = /Sustainable\s+Development\s+Goal\s*:/i
    const sdgMatch = normalized.search(sdgMarker)
    
    if (sdgMatch !== -1) {
      const titleSection = normalized.substring(0, sdgMatch).trim()
      concept = normalized.substring(sdgMatch).trim().replace(/\s+/g, ' ')
      
      // Extract title from section
      const titleMatch = titleSection.match(/(?:proposed\s+title|research\s+title|title)\s*:(.+?)(?:\n|$)/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
      } else {
        const lines = titleSection.split('\n').filter(l => l.trim().length > 10)
        if (lines.length > 0) {
          title = lines[0].trim().substring(0, 200)
        }
      }
    } else {
      // No markers found - use basic extraction
      const lines = normalized.split('\n').filter(l => l.trim().length > 10)
      
      if (lines.length > 0) {
        // First line as title
        title = lines[0].trim().substring(0, 200)
        // Rest as concept
        concept = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim()
      } else {
        title = 'Untitled Research'
        concept = normalized.replace(/\s+/g, ' ').trim()
      }
    }
  }
  
  // Fallback if title is still empty
  if (!title || title.length < 3) {
    title = 'Untitled Research'
  }
  
  // Fallback if concept is empty
  if (!concept || concept.length < 10) {
    concept = normalized.replace(/\s+/g, ' ').trim()
  }
  
  console.log('[Parse] Final extraction:', {
    titleLength: title.length,
    conceptLength: concept.length,
    title: title.substring(0, 100),
    conceptPreview: concept.substring(0, 200)
  })
  
  return {
    title: title,
    concept: concept
  }
}



// ============================================================================
// VERCEL CONFIGURATION - Optimized for serverless execution
// ============================================================================
export const maxDuration = 30; // 30 seconds max (Vercel Pro: 60s, Hobby: 10s default, extended to 30s)
export const runtime = 'nodejs'; // Use Node.js runtime
export const preferredRegion = 'auto'; // Auto-select best region
export const dynamic = 'force-dynamic'; // Always run dynamically (no caching for file uploads)
