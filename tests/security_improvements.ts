// ============================================================================
// SECURITY IMPROVEMENTS FOR DETECTION SYSTEM
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

// ============================================================================
// 1. FILE UPLOAD SECURITY ENHANCEMENTS
// ============================================================================

// Magic bytes for file type validation
const FILE_SIGNATURES = {
  PDF: {
    signature: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
    offset: 0,
    mimeType: 'application/pdf',
    extension: '.pdf'
  },
  DOCX: {
    signature: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK.. (ZIP format)
    offset: 0,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx'
  }
}

// Validate file using magic bytes
function validateFileSignature(buffer: Buffer, expectedType: keyof typeof FILE_SIGNATURES): boolean {
  const signature = FILE_SIGNATURES[expectedType]
  const fileHeader = buffer.slice(signature.offset, signature.offset + signature.signature.length)
  return fileHeader.equals(signature.signature)
}

// File size limits (in bytes)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MIN_FILE_SIZE = 100 // 100 bytes

// Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 255)
}

// Validate file extension
function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  return ext ? allowedExtensions.includes(`.${ext}`) : false
}

// ============================================================================
// 2. RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const entry = this.requests.get(identifier)

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return false
    }

    if (entry.count >= this.maxRequests) {
      return true
    }

    entry.count++
    return false
  }

  getRemainingRequests(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - entry.count)
  }
}

// Rate limiters for different endpoints
const uploadRateLimiter = new RateLimiter(10, 60 * 1000) // 10 requests per minute
const analysisRateLimiter = new RateLimiter(5, 60 * 1000) // 5 requests per minute

// ============================================================================
// 3. INPUT VALIDATION & SANITIZATION
// ============================================================================

// Maximum text lengths
const MAX_TITLE_LENGTH = 500
const MAX_CONCEPT_LENGTH = 50000 // 50KB
const MIN_CONCEPT_LENGTH = 100

// Sanitize text input (prevent XSS, injection)
function sanitizeTextInput(input: string, maxLength: number): string {
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
}

// Validate and sanitize request data
function validateAnalysisRequest(data: any): {
  valid: boolean
  errors: string[]
  sanitized?: any
} {
  const errors: string[] = []

  if (!data.userTitle || typeof data.userTitle !== 'string') {
    errors.push('userTitle is required and must be a string')
  } else if (data.userTitle.length > MAX_TITLE_LENGTH) {
    errors.push(`userTitle exceeds maximum length of ${MAX_TITLE_LENGTH}`)
  }

  if (!data.userConcept || typeof data.userConcept !== 'string') {
    errors.push('userConcept is required and must be a string')
  } else if (data.userConcept.length < MIN_CONCEPT_LENGTH) {
    errors.push(`userConcept must be at least ${MIN_CONCEPT_LENGTH} characters`)
  } else if (data.userConcept.length > MAX_CONCEPT_LENGTH) {
    errors.push(`userConcept exceeds maximum length of ${MAX_CONCEPT_LENGTH}`)
  }

  if (!data.existingTitle || typeof data.existingTitle !== 'string') {
    errors.push('existingTitle is required and must be a string')
  }

  if (!data.existingThesisBrief || typeof data.existingThesisBrief !== 'string') {
    errors.push('existingThesisBrief is required and must be a string')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      userTitle: sanitizeTextInput(data.userTitle, MAX_TITLE_LENGTH),
      userConcept: sanitizeTextInput(data.userConcept, MAX_CONCEPT_LENGTH),
      existingTitle: sanitizeTextInput(data.existingTitle, MAX_TITLE_LENGTH),
      existingThesisBrief: sanitizeTextInput(data.existingThesisBrief, MAX_CONCEPT_LENGTH),
      lexicalSimilarity: parseFloat(data.lexicalSimilarity) || 0,
      semanticSimilarity: parseFloat(data.semanticSimilarity) || 0,
      overallSimilarity: parseFloat(data.overallSimilarity) || 0
    }
  }
}

// ============================================================================
// 4. PROMPT INJECTION PREVENTION
// ============================================================================

// Detect potential prompt injection attempts
function detectPromptInjection(text: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /system\s+prompt/i,
    /you\s+are\s+now/i,
    /new\s+instructions?:/i,
    /instead\s+of/i,
    /<\|.*?\|>/g, // Special tokens
    /###\s*system/i,
    /###\s*user/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(text))
}

// Sanitize prompt input
function sanitizePromptInput(text: string): string {
  // Remove or escape potential prompt injection attempts
  return text
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[REDACTED]')
    .replace(/system\s+prompt/gi, '[REDACTED]')
    .replace(/<\|.*?\|>/g, '') // Remove special tokens
    .replace(/###/g, '') // Remove markdown headers that could be used for injection
}

// ============================================================================
// 5. SECURE FILE UPLOAD ROUTE EXAMPLE
// ============================================================================

export async function secureUploadHandler(request: NextRequest) {
  try {
    // 1. Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    if (uploadRateLimiter.isRateLimited(clientIP)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: '60 seconds'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0'
          }
        }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
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
    const sanitizedFilename = sanitizeFilename(file.name)

    // 4. Validate file extension
    const allowedExtensions = ['.pdf', '.docx']
    if (!validateFileExtension(sanitizedFilename, allowedExtensions)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and DOCX files are allowed.' },
        { status: 400 }
      )
    }

    // 5. Read file and validate magic bytes
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let fileTypeValid = false
    if (sanitizedFilename.endsWith('.pdf')) {
      fileTypeValid = validateFileSignature(buffer, 'PDF')
    } else if (sanitizedFilename.endsWith('.docx')) {
      fileTypeValid = validateFileSignature(buffer, 'DOCX')
    }

    if (!fileTypeValid) {
      return NextResponse.json(
        { error: 'File content does not match the file extension. Possible file type mismatch.' },
        { status: 400 }
      )
    }

    // 6. Calculate file hash for integrity
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    // 7. Continue with extraction...
    // [Rest of the extraction logic]

    return NextResponse.json({
      success: true,
      fileName: sanitizedFilename,
      fileSize: file.size,
      fileHash: fileHash,
      // ... other data
    })

  } catch (error) {
    console.error('Secure upload error:', error)
    return NextResponse.json(
      { error: 'File processing failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// 6. SECURE AI ANALYSIS ROUTE EXAMPLE
// ============================================================================

export async function secureAnalysisHandler(request: Request) {
  try {
    // 1. Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    if (analysisRateLimiter.isRateLimited(clientIP)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: '60 seconds'
        },
        { status: 429 }
      )
    }

    const data = await request.json()

    // 2. Validate and sanitize input
    const validation = validateAnalysisRequest(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const sanitizedData = validation.sanitized!

    // 3. Check for prompt injection
    const hasInjection = 
      detectPromptInjection(sanitizedData.userTitle) ||
      detectPromptInjection(sanitizedData.userConcept)

    if (hasInjection) {
      console.warn('Potential prompt injection detected:', {
        clientIP,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json(
        { error: 'Invalid input detected. Please review your content.' },
        { status: 400 }
      )
    }

    // 4. Further sanitize for prompt
    const safeUserTitle = sanitizePromptInput(sanitizedData.userTitle)
    const safeUserConcept = sanitizePromptInput(sanitizedData.userConcept)

    // 5. Continue with AI analysis...
    // [Rest of the AI analysis logic]

    return NextResponse.json({
      success: true,
      // ... analysis results
    })

  } catch (error) {
    console.error('Secure analysis error:', error)
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// 7. ALGORITHM ACCURACY TESTING
// ============================================================================

export interface SimilarityTestCase {
  name: string
  text1: string
  text2: string
  expectedRange: { min: number; max: number }
}

export const similarityTestCases: SimilarityTestCase[] = [
  {
    name: 'Identical Text',
    text1: 'The quick brown fox jumps over the lazy dog',
    text2: 'The quick brown fox jumps over the lazy dog',
    expectedRange: { min: 0.95, max: 1.0 }
  },
  {
    name: 'Paraphrased Text',
    text1: 'Global warming is a serious threat to humanity',
    text2: 'Climate change poses a significant danger to human civilization',
    expectedRange: { min: 0.5, max: 0.8 }
  },
  {
    name: 'Word Substitution',
    text1: 'The student submitted their research paper',
    text2: 'The pupil handed in their academic thesis',
    expectedRange: { min: 0.3, max: 0.6 }
  },
  {
    name: 'Completely Different',
    text1: 'Machine learning algorithms in healthcare',
    text2: 'Cooking recipes from ancient Rome',
    expectedRange: { min: 0.0, max: 0.1 }
  },
  {
    name: 'Empty Strings',
    text1: '',
    text2: '',
    expectedRange: { min: 0.0, max: 0.0 }
  },
  {
    name: 'One Empty',
    text1: 'Some text here',
    text2: '',
    expectedRange: { min: 0.0, max: 0.0 }
  },
  {
    name: 'Single Character',
    text1: 'a',
    text2: 'a',
    expectedRange: { min: 0.9, max: 1.0 }
  },
  {
    name: 'Only Numbers',
    text1: '123456789',
    text2: '123456789',
    expectedRange: { min: 0.95, max: 1.0 }
  },
  {
    name: 'Special Characters',
    text1: '!@#$%^&*()',
    text2: '!@#$%^&*()',
    expectedRange: { min: 0.9, max: 1.0 }
  }
]

export function runSimilarityTests(
  similarityFunction: (text1: string, text2: string) => number
): { passed: number; failed: number; results: any[] } {
  let passed = 0
  let failed = 0
  const results: any[] = []

  for (const testCase of similarityTestCases) {
    const score = similarityFunction(testCase.text1, testCase.text2)
    const isPass = score >= testCase.expectedRange.min && score <= testCase.expectedRange.max

    if (isPass) {
      passed++
    } else {
      failed++
    }

    results.push({
      name: testCase.name,
      score,
      expected: testCase.expectedRange,
      passed: isPass
    })
  }

  return { passed, failed, results }
}
