import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { getSupabaseServer } from '@/lib/supabaseServer'

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

// PyMuPDF-based extraction (removed for Vercel compatibility)
// Note: Running Python / spawning child processes is not supported on Vercel Edge functions
// and Python/PyMuPDF is not available in the default serverless runtime. We use a pure JS
// parser (pdf-parse) for production on Vercel and keep the extraction in-memory (no local disk writes).

async function parsePDF(buffer: Buffer) {
  try {
    console.log('[pdf-parse] Starting PDF parsing with buffer size:', buffer.length)

    if (!buffer || buffer.length === 0) {
      throw new Error('Empty buffer provided to pdf-parse')
    }

    const pdfHeader = buffer.slice(0, 5).toString('utf8')
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error('Invalid PDF header - file may be corrupted')
    }

    const pdfParse = await import('pdf-parse')
    const parseFunction = (pdfParse as any).default || pdfParse
    if (typeof parseFunction !== 'function') {
      throw new Error('pdf-parse import failed - not a function')
    }

    const result = await parseFunction(buffer, { max: 0 })

    if (!result || !result.text || result.text.length === 0) {
      throw new Error('pdf-parse returned empty text - PDF may contain only images or be corrupt')
    }

    return result
  } catch (error) {
    console.error('[pdf-parse] Error details:', error)
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
    
    // Support two flows:
    // 1) Client uploaded the file to Supabase storage and sent JSON: { bucket, path, fileName }
    // 2) Legacy: client included the file in a multipart/form-data (local dev). We still accept it but
    //    recommend using Supabase direct upload to avoid Vercel request size limits.

    const contentType = request.headers.get('content-type') || ''

    let buffer: Buffer
    let fileType: string | undefined
    let fileName: string = 'uploaded-file'

    if (contentType.includes('application/json')) {
      // JSON flow with bucket + path
      const body = await request.json()
      const { bucket, path, fileName: fname } = body || {}
      if (!bucket || !path) {
        return NextResponse.json({ error: 'Missing bucket or path in request body' }, { status: 400 })
      }

      // Download from Supabase storage (server-side, uses service role key)
      const supabase = getSupabaseServer()
      const downloadRes = await supabase.storage.from(bucket).download(path)
      if (downloadRes.error || !downloadRes.data) {
        console.error('[Extract-Text] Supabase download error:', downloadRes.error)
        return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
      }

      // Convert to Buffer (handles Blob, ReadableStream, Node stream)
      const data = downloadRes.data as any
      if (typeof data.arrayBuffer === 'function') {
        const ab = await data.arrayBuffer()
        buffer = Buffer.from(ab)
      } else if (data.on && typeof data.on === 'function') {
        // Node stream
        buffer = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = []
          data.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
          data.on('end', () => resolve(Buffer.concat(chunks)))
          data.on('error', (err: any) => reject(err))
        })
      } else {
        return NextResponse.json({ error: 'Unknown data type returned from storage' }, { status: 500 })
      }

      fileType = undefined // unknown (we can infer from filename)
      if (fname) fileName = fname.toLowerCase()

      // Optional cleanup
      if (process.env.CLEAN_UP_UPLOADED_FILES === '1') {
        const removeRes = await supabase.storage.from(bucket).remove([path])
        if (removeRes.error) console.warn('[Extract-Text] Failed to remove uploaded file:', removeRes.error)
      }

    } else if (contentType.includes('multipart/form-data')) {
      // Legacy local dev flow
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE} bytes` }, { status: 413 })
      if (file.size < MIN_FILE_SIZE) return NextResponse.json({ error: 'File is too small or corrupted' }, { status: 400 })

      fileName = file.name.toLowerCase()
      fileType = file.type
      buffer = Buffer.from(await file.arrayBuffer())

      console.log('[Extract-Text] Received file via multipart/form-data for local processing:', { fileName, fileType, size: buffer.length })

    } else {
      return NextResponse.json({ error: 'Unsupported content type. Use JSON with storage path or multipart/form-data.' }, { status: 415 })
    }
    
    // File summary and sanitation
    const originalName = fileName
    const sanitizedName = sanitizeFilename(originalName)

    console.log('[Extract-Text] File ready for processing:', {
      originalName,
      sanitizedName,
      inferredType: fileType,
      size: buffer.length,
      clientIP
    })

    let extractedText = ''
    
    // Extract text based on file type
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // 4. Validate PDF magic bytes
      if (!validatePDFSignature(buffer)) {
        return NextResponse.json({ error: 'File is not a valid PDF.' }, { status: 400 })
      }

      // Use the Node/JS parser (pdf-parse) for production compatibility. This processes entirely in memory
      // and does not write to disk or spawn child processes (works on Vercel serverless)
      try {
        const pdfData = await parsePDF(buffer)
        extractedText = pdfData.text
        console.log('[Extract-Text] PDF extracted using pdf-parse:', { textLength: extractedText.length, pages: pdfData.numpages })
      } catch (pdfError) {
        console.error('[Extract-Text] PDF parsing failed:', pdfError)

        let userMessage = 'Failed to parse PDF file.'
        const msg = pdfError instanceof Error ? pdfError.message.toLowerCase() : String(pdfError).toLowerCase()
        if (msg.includes('images')) userMessage = 'This PDF appears to contain only images. Please use a PDF with selectable text.'
        if (msg.includes('password') || msg.includes('encrypted')) userMessage = 'This PDF is password-protected. Please remove the password and try again.'

        return NextResponse.json({ error: userMessage, details: process.env.NODE_ENV === 'development' ? String(pdfError) : undefined }, { status: 400 })
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
      fileName: fileName,
      fileSize: buffer.length,
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



// Configure function runtime and duration
export const maxDuration = 60; // Maximum execution time in seconds
export const runtime = 'nodejs'
