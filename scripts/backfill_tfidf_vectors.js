/**
 * Backfill TF-IDF vectors for existing researches
 * Run this script to generate and store vectors for all researches without vectors
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// TF-IDF functions (copied from tfidf-vectors.ts)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'about', 'into', 'through', 'during', 'including', 'against', 'among',
  'throughout', 'despite', 'towards', 'upon', 'concerning', 'using'
])

function normalizeText(text) {
  if (!text) return []
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 2)
    .filter(word => !STOP_WORDS.has(word))
}

function generateTfIdfVector(text, corpus) {
  const words = normalizeText(text)
  const wordCounts = new Map()
  
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })
  
  const totalWords = words.length || 1
  const totalDocs = corpus.length || 1
  const vector = {}
  
  wordCounts.forEach((count, word) => {
    const tf = count / totalWords
    const docsWithWord = corpus.filter(doc => 
      normalizeText(doc).includes(word)
    ).length
    const idf = Math.log((totalDocs + 1) / (docsWithWord + 1)) + 1
    vector[word] = tf * idf
  })
  
  return vector
}

async function main() {
  console.log('🚀 Starting TF-IDF vector backfill...\n')
  
  // Fetch all researches
  console.log('📥 Fetching researches from database...')
  const { data: researches, error } = await supabase
    .from('researches')
    .select('id, title, thesis_brief, tfidf_vector')
    .eq('status', 'approved')
  
  if (error) {
    console.error('❌ Error fetching researches:', error)
    process.exit(1)
  }
  
  if (!researches || researches.length === 0) {
    console.log('✅ No approved researches found')
    return
  }
  
  console.log(`📊 Found ${researches.length} approved researches\n`)
  
  // Filter researches that need vectors
  const researchesNeedingVectors = researches.filter(r => !r.tfidf_vector)
  
  if (researchesNeedingVectors.length === 0) {
    console.log('✅ All researches already have TF-IDF vectors!')
    return
  }
  
  console.log(`🔄 Generating vectors for ${researchesNeedingVectors.length} researches...\n`)
  
  // Build corpus from all researches
  const corpus = researches.map(r => `${r.title} ${r.thesis_brief || ''}`.trim())
  
  let successCount = 0
  let errorCount = 0
  
  // Generate and store vectors
  for (let i = 0; i < researchesNeedingVectors.length; i++) {
    const research = researchesNeedingVectors[i]
    const progress = `[${i + 1}/${researchesNeedingVectors.length}]`
    
    try {
      // Generate TF-IDF vector
      const text = `${research.title} ${research.thesis_brief || ''}`.trim()
      const vector = generateTfIdfVector(text, corpus)
      
      // Store vector in database
      const { error: updateError } = await supabase
        .from('researches')
        .update({ tfidf_vector: vector })
        .eq('id', research.id)
      
      if (updateError) {
        console.error(`${progress} ❌ Error updating ${research.id}:`, updateError.message)
        errorCount++
      } else {
        console.log(`${progress} ✅ Generated vector for: ${research.title.substring(0, 50)}...`)
        successCount++
      }
    } catch (err) {
      console.error(`${progress} ❌ Exception for ${research.id}:`, err.message)
      errorCount++
    }
    
    // Small delay to avoid rate limiting
    if (i < researchesNeedingVectors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Backfill Summary:')
  console.log(`   Total researches: ${researches.length}`)
  console.log(`   Already had vectors: ${researches.length - researchesNeedingVectors.length}`)
  console.log(`   Successfully generated: ${successCount}`)
  console.log(`   Errors: ${errorCount}`)
  console.log('='.repeat(60))
  
  if (errorCount === 0) {
    console.log('\n✅ Backfill completed successfully!')
  } else {
    console.log('\n⚠️  Backfill completed with errors')
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
