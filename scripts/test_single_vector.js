/**
 * Test script to store TF-IDF vector for a single research
 * This helps diagnose if the storage is working
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

// TF-IDF functions
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
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
  console.log('🧪 Testing TF-IDF vector storage for single research...\n')
  
  // Fetch first research
  console.log('📥 Fetching first research from database...')
  const { data: researches, error } = await supabase
    .from('researches')
    .select('id, title, thesis_brief')
    .limit(5)
  
  if (error) {
    console.error('❌ Error fetching research:', error)
    process.exit(1)
  }
  
  if (!researches || researches.length === 0) {
    console.log('❌ No researches found')
    return
  }
  
  const research = researches[0]
  console.log('✅ Selected research:')
  console.log(`   ID: ${research.id}`)
  console.log(`   Title: ${research.title}`)
  console.log(`   Brief length: ${research.thesis_brief?.length || 0} chars\n`)
  
  // Build corpus
  console.log('🔄 Building corpus from all researches...')
  const corpus = researches.map(r => `${r.title} ${r.thesis_brief || ''}`.trim())
  console.log(`   Corpus size: ${corpus.length} documents\n`)
  
  // Generate vector
  console.log('🔄 Generating TF-IDF vector...')
  const text = `${research.title} ${research.thesis_brief || ''}`.trim()
  const vector = generateTfIdfVector(text, corpus)
  
  console.log('✅ Vector generated:')
  console.log(`   Number of terms: ${Object.keys(vector).length}`)
  console.log(`   Sample terms:`, Object.keys(vector).slice(0, 5))
  console.log(`   Sample values:`, Object.values(vector).slice(0, 5).map(v => v.toFixed(4)))
  console.log(`   Vector JSON size: ${JSON.stringify(vector).length} bytes\n`)
  
  // Store in database
  console.log('💾 Storing vector in database...')
  const { data: updateResult, error: updateError } = await supabase
    .from('researches')
    .update({ tfidf_vector: vector })
    .eq('id', research.id)
    .select()
  
  if (updateError) {
    console.error('❌ Error storing vector:', updateError)
    console.error('   Full error:', JSON.stringify(updateError, null, 2))
    process.exit(1)
  }
  
  console.log('✅ Update query executed')
  console.log('   Rows returned:', updateResult?.length || 0)
  if (updateResult && updateResult.length > 0) {
    console.log('   Has tfidf_vector:', updateResult[0].tfidf_vector !== null)
    if (updateResult[0].tfidf_vector) {
      console.log('   Stored terms:', Object.keys(updateResult[0].tfidf_vector).length)
    }
  }
  console.log()
  
  // Verify by reading back
  console.log('🔍 Verifying by reading back from database...')
  const { data: verifyData, error: verifyError } = await supabase
    .from('researches')
    .select('id, title, tfidf_vector')
    .eq('id', research.id)
    .single()
  
  if (verifyError) {
    console.error('❌ Error verifying:', verifyError)
    process.exit(1)
  }
  
  console.log('✅ Verification result:')
  console.log(`   ID: ${verifyData.id}`)
  console.log(`   Title: ${verifyData.title.substring(0, 50)}...`)
  console.log(`   tfidf_vector is null: ${verifyData.tfidf_vector === null}`)
  
  if (verifyData.tfidf_vector === null) {
    console.log('\n❌ PROBLEM: Vector is NULL in database!')
    console.log('   This could mean:')
    console.log('   1. Column does not exist (run migration)')
    console.log('   2. RLS policy is blocking writes')
    console.log('   3. ANON_KEY does not have permission')
  } else {
    console.log(`   ✅ Vector stored successfully!`)
    console.log(`   Terms in database: ${Object.keys(verifyData.tfidf_vector).length}`)
    console.log(`   Sample terms:`, Object.keys(verifyData.tfidf_vector).slice(0, 5))
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
