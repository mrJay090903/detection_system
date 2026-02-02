/**
 * OPTIMIZED SIMILARITY CHECK WITH PRECOMPUTED TF-IDF VECTORS
 * 
 * Strategy:
 * 1. Query vector: Generate TF-IDF vector ONCE for the proposed research
 * 2. Database vectors: Load precomputed TF-IDF vectors from database
 * 3. Compare: Fast cosine similarity calculation (in-memory, no recomputation)
 * 4. Result: Get top matches in ~1-2 seconds instead of 10+ seconds
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  generateTfIdfVector, 
  cosineSimilarity, 
  buildResearchText 
} from '@/lib/tfidf-vectors'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Parse request body
    const body = await req.json()
    const { title, concept, thesis_brief } = body
    
    // Validate inputs
    if (!title || !concept) {
      return NextResponse.json(
        { error: 'Title and concept are required' },
        { status: 400 }
      )
    }

    console.log('🔍 Starting optimized similarity check with precomputed vectors...')
    console.log(`Title: ${title.substring(0, 50)}...`)
    console.log(`Concept length: ${concept.length} chars`)

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all approved researches with TF-IDF vectors
    console.log('📥 Fetching researches with precomputed TF-IDF vectors...')
    const fetchStartTime = Date.now()
    
    const { data: researches, error: dbError } = await supabase
      .from('researches')
      .select('id, title, thesis_brief, year, course, researchers, tfidf_vector')
      .eq('status', 'approved')
      .not('tfidf_vector', 'is', null)
    
    const fetchTime = Date.now() - fetchStartTime
    
    if (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json(
        { 
          error: 'Failed to fetch existing researches from database', 
          details: dbError.message
        },
        { status: 500 }
      )
    }

    if (!researches || researches.length === 0) {
      console.log('✅ No approved researches with TF-IDF vectors found')
      return NextResponse.json({
        success: true,
        proposedTitle: title,
        proposedConcept: concept,
        similarities: [],
        report: `No existing researches found in the database to compare against.\n\nYour proposed research:\nTitle: ${title}\nConcept: ${concept}\n\nThis research appears to be unique as there are no existing researches in the database for comparison.`,
        totalComparisons: 0,
        executionTime: Date.now() - startTime,
        message: 'No researches found in database for comparison'
      })
    }

    console.log(`✅ Fetched ${researches.length} researches with TF-IDF vectors in ${fetchTime}ms`)

    // STEP 1: Generate TF-IDF vector for the proposed research (ONCE)
    console.log('🔄 Generating TF-IDF vector for proposed research...')
    const vectorGenStartTime = Date.now()
    
    // Build corpus from all existing researches
    const corpus = researches.map(r => buildResearchText(r.title, r.thesis_brief || ''))
    
    // Add proposed research text to corpus for proper IDF calculation
    const proposedText = buildResearchText(title, thesis_brief || concept)
    corpus.push(proposedText)
    
    // Generate TF-IDF vector for proposed research
    const proposedVector = generateTfIdfVector(proposedText, corpus)
    const vectorGenTime = Date.now() - vectorGenStartTime
    
    console.log(`✅ Generated proposed vector in ${vectorGenTime}ms`)
    console.log(`   Vector size: ${Object.keys(proposedVector).length} terms`)

    // STEP 2: Compare proposed vector against all stored vectors
    console.log('⚡ Comparing against stored vectors...')
    const compareStartTime = Date.now()
    
    const similarities = researches.map(research => {
      // Use stored TF-IDF vector from database
      const storedVector = research.tfidf_vector as Record<string, number>
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(proposedVector, storedVector)
      
      return {
        id: research.id,
        title: research.title,
        thesis_brief: research.thesis_brief || '',
        year: research.year,
        course: research.course,
        researchers: research.researchers || [],
        overallSimilarity: similarity,
        titleSimilarity: similarity, // For compatibility
        abstractSimilarity: similarity, // For compatibility
        semanticSimilarity: similarity,
        similarityPercentage: Math.round(similarity * 100),
        explanation: `TF-IDF Cosine Similarity: ${(similarity * 100).toFixed(2)}%`
      }
    })
    
    const compareTime = Date.now() - compareStartTime
    
    console.log(`✅ Compared against ${researches.length} researches in ${compareTime}ms`)

    // STEP 3: Sort by similarity and get top matches
    const topMatches = similarities
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, 10) // Get top 10 matches
    
    const totalTime = Date.now() - startTime
    
    console.log('📊 Results:')
    console.log(`   Top match: ${topMatches[0]?.similarityPercentage}%`)
    console.log(`   Total execution time: ${totalTime}ms`)
    console.log(`   Breakdown:`)
    console.log(`     - Database fetch: ${fetchTime}ms`)
    console.log(`     - Vector generation: ${vectorGenTime}ms`)
    console.log(`     - Comparison: ${compareTime}ms`)

    // Generate report
    const report = generateReport(title, concept, topMatches, totalTime)

    return NextResponse.json({
      success: true,
      proposedTitle: title,
      proposedConcept: concept,
      similarities: topMatches,
      report,
      totalComparisons: researches.length,
      executionTime: totalTime,
      performance: {
        fetchTime,
        vectorGenTime,
        compareTime,
        totalTime
      },
      message: 'Similarity check completed successfully'
    })

  } catch (error) {
    console.error('❌ Error in similarity check:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

function generateReport(
  proposedTitle: string,
  proposedConcept: string,
  similarities: Array<{
    title: string
    thesis_brief: string
    year?: number
    course?: string
    researchers?: string[]
    overallSimilarity: number
    similarityPercentage: number
    explanation: string
  }>,
  executionTime: number
): string {
  const highSimilarities = similarities.filter(s => s.overallSimilarity >= 0.7)
  const mediumSimilarities = similarities.filter(s => s.overallSimilarity >= 0.4 && s.overallSimilarity < 0.7)
  const lowSimilarities = similarities.filter(s => s.overallSimilarity < 0.4)

  let report = `RESEARCH SIMILARITY ANALYSIS REPORT\n`
  report += `${'='.repeat(80)}\n\n`
  
  report += `PROPOSED RESEARCH:\n`
  report += `Title: ${proposedTitle}\n`
  report += `Concept: ${proposedConcept.substring(0, 200)}${proposedConcept.length > 200 ? '...' : ''}\n\n`
  
  report += `ANALYSIS SUMMARY:\n`
  report += `- Total comparisons: ${similarities.length}\n`
  report += `- High similarity (≥70%): ${highSimilarities.length} ${highSimilarities.length > 0 ? '⚠️' : '✓'}\n`
  report += `- Medium similarity (40-69%): ${mediumSimilarities.length}\n`
  report += `- Low similarity (<40%): ${lowSimilarities.length}\n`
  report += `- Execution time: ${executionTime}ms\n\n`

  if (highSimilarities.length > 0) {
    report += `⚠️ HIGH SIMILARITY MATCHES (≥70%):\n`
    report += `${'─'.repeat(80)}\n\n`
    
    highSimilarities.forEach((match, index) => {
      report += `${index + 1}. ${match.title}\n`
      report += `   Similarity: ${match.similarityPercentage}%\n`
      report += `   Year: ${match.year || 'N/A'} | Course: ${match.course || 'N/A'}\n`
      report += `   Researchers: ${match.researchers?.join(', ') || 'N/A'}\n`
      report += `   Brief: ${match.thesis_brief.substring(0, 150)}...\n\n`
    })
    
    report += `⚠️ WARNING: High similarity detected. Please review these matches carefully.\n\n`
  }

  if (mediumSimilarities.length > 0 && similarities.length <= 5) {
    report += `MEDIUM SIMILARITY MATCHES (40-69%):\n`
    report += `${'─'.repeat(80)}\n\n`
    
    mediumSimilarities.slice(0, 3).forEach((match, index) => {
      report += `${index + 1}. ${match.title}\n`
      report += `   Similarity: ${match.similarityPercentage}%\n`
      report += `   Year: ${match.year || 'N/A'} | Course: ${match.course || 'N/A'}\n\n`
    })
  }

  report += `\nANALYSIS METHOD:\n`
  report += `Using precomputed TF-IDF vectors with cosine similarity.\n`
  report += `This method compares the semantic content and key terms between researches.\n\n`

  if (highSimilarities.length === 0) {
    report += `✅ CONCLUSION: Your proposed research appears to be sufficiently unique.\n`
    report += `No high similarity matches found with existing researches.\n`
  } else {
    report += `⚠️ CONCLUSION: Please review the high similarity matches above.\n`
    report += `Consider differentiating your research approach or scope.\n`
  }

  return report
}
