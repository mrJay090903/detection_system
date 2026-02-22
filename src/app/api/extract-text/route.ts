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

// --- PDF parsing function removed as requested by user ---


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
    let usePdfJs = false

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

      // Check for engine preference (e.g., 'pdfjs') passed from client for drag-and-drop
      const engine = (formData.get('engine') as string | null) || undefined
      if (engine === 'pdfjs') usePdfJs = true

      fileName = file.name.toLowerCase()
      fileType = file.type
      buffer = Buffer.from(await file.arrayBuffer())

      console.log('[Extract-Text] Received file via multipart/form-data for local processing:', { fileName, fileType, size: buffer.length, engine })

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
    let parsingNotes: string | undefined
    
    // Extract text based on file type
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // 4. Validate PDF magic bytes
      if (!validatePDFSignature(buffer)) {
        return NextResponse.json({ error: 'File is not a valid PDF.' }, { status: 400 })
      }

      // Parse PDF using unpdf (pure JS, serverless-friendly)
      try {
        const { extractText } = await import('unpdf')
        
        // Convert Buffer to Uint8Array (unpdf requires Uint8Array)
        const uint8Array = new Uint8Array(buffer)
        
        console.log('[Extract-Text] Attempting PDF extraction with unpdf...')
        const pdfData = await extractText(uint8Array, {
          mergePages: true
        })
        
        const pdfDataPreview = typeof pdfData === 'string' 
          ? (pdfData as string).substring(0, 100) 
          : pdfData ? JSON.stringify(pdfData).substring(0, 200) : ''
        
        console.log('[Extract-Text] unpdf returned:', {
          type: typeof pdfData,
          isString: typeof pdfData === 'string',
          hasText: pdfData?.text !== undefined,
          totalPages: pdfData?.totalPages,
          keys: typeof pdfData === 'object' ? Object.keys(pdfData) : [],
          preview: pdfDataPreview
        })
        
        // unpdf returns an object with totalPages and text properties
        if (typeof pdfData === 'string') {
          extractedText = pdfData
        } else if (pdfData && typeof pdfData.text === 'string') {
          extractedText = pdfData.text
        } else {
          console.error('[Extract-Text] Unexpected unpdf response format')
          extractedText = String(pdfData)
        }
        
        const pageCount = (pdfData && pdfData.totalPages) ? pdfData.totalPages : 1
        parsingNotes = `Extracted from ${pageCount} PDF page${pageCount !== 1 ? 's' : ''}`
        
        console.log('[Extract-Text] PDF parsed successfully:', {
          pages: pageCount,
          textLength: extractedText.length,
          preview: extractedText.substring(0, 200)
        })
      } catch (error) {
        console.error('PDF parsing error:', error)
        return NextResponse.json(
          { error: 'Failed to parse PDF file', details: String(error) },
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
    
    if (!extractedText || extractedText.length < 10) {
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
      rawLength: extractedText.length,
      parsingNotes: parsingNotes
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
    .replace(/\s+/g, ' ')
    .trim()
  
  console.log('[Parse] Normalized text:', {
    length: normalized.length,
    preview: normalized.substring(0, 300)
  })
  
  if (!normalized || normalized.length < 10) {
    return { title: '', concept: '' }
  }
  
  let title = ''
  let concept = ''

  // ── PRIMARY STRATEGY: "BU Thematic Area:" is the boundary marker ──────────
  // The research title ends immediately BEFORE "BU Thematic Area:", and the
  // research concept starts FROM "BU Thematic Area:" (inclusive).
  const buThematicPattern = /bu\s+thematic\s+area\s*:/i
  const buThematicMatch = normalized.match(buThematicPattern)

  if (buThematicMatch && buThematicMatch.index !== undefined) {
    const buIndex = buThematicMatch.index

    // Everything from "BU Thematic Area:" onward becomes the concept
    concept = normalized.substring(buIndex).trim()

    // Extract title from the text that precedes "BU Thematic Area:"
    const beforeBU = normalized.substring(0, buIndex).trim()

    // Look for an explicit title label first (e.g. "Proposed Title: ...")
    const labeledTitleMatch = beforeBU.match(
      /(?:proposed\s+title|research\s+title|title)\s*:\s*(.+)/i
    )
    if (labeledTitleMatch && labeledTitleMatch[1]) {
      title = labeledTitleMatch[1].replace(/\s+/g, ' ').trim()
    } else if (beforeBU.length > 0) {
      // Fall back: last non-trivial segment before BU Thematic Area is the title
      const parts = beforeBU
        .split(/[\n.]+/)
        .map(s => s.trim())
        .filter(s => s.length > 5)
      title = (parts[parts.length - 1] || beforeBU).replace(/\s+/g, ' ').trim()
    }

    console.log('[Parse] BU Thematic Area boundary detected:', {
      title,
      conceptPreview: concept.substring(0, 200)
    })
  } else {
    // ── FALLBACK: no "BU Thematic Area:" found — use original strategies ─────
    // Split by periods or newlines to get potential title
    const sentences = normalized.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 0)

    if (sentences.length === 0) {
      return { title: '', concept: normalized }
    }

    // Strategy 1: Look for explicit title markers
    const titleMatch = normalized.match(/(?:proposed\s+title|research\s+title|title)\s*:\s*([^\n.]+)/i)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim()
      // Everything after the title marker is the concept
      const titleEndIndex = normalized.indexOf(titleMatch[0]) + titleMatch[0].length
      concept = normalized.substring(titleEndIndex).trim()
    } else {
      // Strategy 2: First substantial sentence/line is the title, rest is thesis brief
      let titleIndex = -1
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim()

        // Skip boilerplate
        if (
          sentence.length < 10 ||
          sentence.length > 300 ||
          /^(University|College|Department|Bicol|Submitted|Prepared|Research\s+Proposal|Thesis\s+Proposal|Capstone|Concept\s+Paper|\d+)$/i.test(sentence)
        ) {
          continue
        }

        title = sentence
        titleIndex = i
        break
      }

      if (titleIndex >= 0 && titleIndex < sentences.length - 1) {
        concept = sentences.slice(titleIndex + 1).join('. ').trim()
      } else if (titleIndex >= 0) {
        concept = normalized
      } else {
        title = sentences[0]
        concept = sentences.slice(1).join('. ').trim()
      }
    }
  }

  // If concept is still empty, fall back to the full text
  if (!concept || concept.length < 10) {
    concept = normalized
  }

  // Clean up title (remove extra whitespace)
  title = title.replace(/\s+/g, ' ').trim()

  console.log('[Parse] Final extraction:', {
    title: title,
    titleLength: title.length,
    conceptLength: concept.length,
    conceptPreview: concept.substring(0, 200)
  })

  return {
    title: title || 'Untitled Research',
    concept: concept
  }
}

// Configure function runtime and duration
export const maxDuration = 60; // Maximum execution time in seconds
export const runtime = 'nodejs'
