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
  buildTfIdfIndex,
  vectorizeTfIdf,
  cosineSimilarity, 
  buildResearchText 
} from '@/lib/tfidf-vectors'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    console.log('🔍 === SIMILARITY CHECK API CALLED ===')
    const startTime = Date.now()
    
    // Parse request body
    const body = await req.json()
    console.log('📥 Request body received:', Object.keys(body))
    
    // Support both parameter names for compatibility
    const title = body.title || body.proposedTitle
    const concept = body.concept || body.proposedConcept
    const thesis_brief = body.thesis_brief || body.proposedConcept
    
    // Validate inputs
    if (!title || !concept) {
      console.error('❌ Validation failed:', { 
        hasTitle: !!title, 
        hasConcept: !!concept, 
        bodyKeys: Object.keys(body) 
      })
      return NextResponse.json(
        { error: 'Title and concept are required' },
        { status: 400 }
      )
    }

    console.log('✅ Validation passed')
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

    // Fetch all researches (try with precomputed vectors first, fallback to all)
    console.log('📥 Fetching researches from database...')
    const fetchStartTime = Date.now()
    
    let researches: any[] | null
    let dbError: any
    
    const precomputedResult = await supabase
      .from('researches')
      .select('id, title, thesis_brief, year, course, researchers, tfidf_vector')
      .not('tfidf_vector', 'is', null)
    
    // If no researches with precomputed vectors, fetch all and compute on-the-fly
    const usePrecomputed = precomputedResult.data && precomputedResult.data.length > 0
    
    if (usePrecomputed) {
      researches = precomputedResult.data
      dbError = precomputedResult.error
    } else {
      console.log('⚠️  No precomputed vectors found, fetching all researches...')
      const result = await supabase
        .from('researches')
        .select('id, title, thesis_brief, year, course, researchers')
      
      // Add tfidf_vector property as null for TypeScript
      researches = result.data?.map(r => ({ ...r, tfidf_vector: null })) || null
      dbError = result.error
    }
    
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
      console.log('✅ No researches found in database')
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

    console.log(`✅ Fetched ${researches.length} researches in ${fetchTime}ms`)
    console.log(`   Using ${usePrecomputed ? 'PRECOMPUTED' : 'ON-THE-FLY'} vectors`)

    // STEP 1: Build TF-IDF index from corpus
    console.log('🔄 Building TF-IDF index...')
    const vectorGenStartTime = Date.now()
    
    // Build corpus from all existing researches
    const corpus = researches.map(r => buildResearchText(r.title, r.thesis_brief || ''))
    
    // Add proposed research text to corpus for proper IDF calculation
    const proposedText = buildResearchText(title, thesis_brief || concept)
    corpus.push(proposedText)
    
    // Build TF-IDF index once for all vectorization
    const tfidfIndex = buildTfIdfIndex(corpus, {
      minTokenLen: 4,
      useBigrams: true,
      minDf: 2,
      maxDfRatio: 0.8,
      topK: 400
    })
    
    // Generate TF-IDF vector for proposed research
    const proposedVector = vectorizeTfIdf(proposedText, tfidfIndex)
    const vectorGenTime = Date.now() - vectorGenStartTime
    
    console.log(`✅ Built index and generated proposed vector in ${vectorGenTime}ms`)
    console.log(`   Vector size: ${Object.keys(proposedVector).length} terms`)

    // STEP 2: Compare proposed vector against stored or generated vectors
    console.log('⚡ Comparing against vectors...')
    const compareStartTime = Date.now()
    
    const similarities = researches.map(research => {
      let storedVector: Record<string, number>
      
      // Use precomputed vector if available, otherwise compute on-the-fly
      if (usePrecomputed && research.tfidf_vector) {
        storedVector = research.tfidf_vector as Record<string, number>
      } else {
        // Generate vector on-the-fly for this research using the index
        const researchText = buildResearchText(research.title, research.thesis_brief || '')
        storedVector = vectorizeTfIdf(researchText, tfidfIndex)
      }
      
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
        lexicalSimilarity: similarity, // For compatibility with AI analysis
        similarityPercentage: Math.round(similarity * 100),
        explanation: `TF-IDF Cosine Similarity: ${(similarity * 100).toFixed(2)}%`
      }
    })
    
    const compareTime = Date.now() - compareStartTime
    
    console.log(`✅ Compared against ${researches.length} researches in ${compareTime}ms`)
    console.log(`   Method: ${usePrecomputed ? 'Precomputed vectors (FAST)' : 'On-the-fly generation (SLOWER)'}`)

    // STEP 3: Sort by similarity and get top 3 matches with minimum threshold
    const topMatches = similarities
      .filter(s => s.overallSimilarity >= 0.1) // Minimum 10% similarity
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, 3) // Get top 3 matches only
    
    const totalTime = Date.now() - startTime
    
    console.log('📊 Results:')
    console.log(`   Total researches compared: ${researches.length}`)
    console.log(`   Above 10% threshold: ${similarities.filter(s => s.overallSimilarity >= 0.1).length}`)
    console.log(`   Returning top: ${topMatches.length}`)
    if (topMatches.length > 0) {
      console.log(`   #1 match: ${topMatches[0]?.similarityPercentage}% - ${topMatches[0]?.title.substring(0, 40)}...`)
    }
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
  report += `- Total comparisons: ${similarities.length} researches analyzed\n`
  report += `- Showing: Top 3 matches only\n`
  report += `- High similarity (≥70%): ${highSimilarities.length} ${highSimilarities.length > 0 ? '⚠️' : '✓'}\n`
  report += `- Medium similarity (40-69%): ${mediumSimilarities.length}\n`
  report += `- Low similarity (<40%): ${lowSimilarities.length}\n`
  report += `- Execution time: ${executionTime}ms\n`
  report += `- Algorithm: TF-IDF Cosine Similarity (focuses on key terms)\n\n`

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
