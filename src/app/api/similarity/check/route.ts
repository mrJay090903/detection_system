import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Configure longer timeout for AI processing
export const maxDuration = 60 // 60 seconds max
export const dynamic = 'force-dynamic'

// Get semantic embeddings using Gemini
async function getEmbedding(text: string, genAI: GoogleGenerativeAI): Promise<number[]> {
  try {
    // Use Gemini embedding model - try different model names
    let result
    try {
      const model = genAI.getGenerativeModel({ model: 'embedding-001' })
      result = await model.embedContent(text)
    } catch (e) {
      // Try alternative: use text-embedding-004 or other available models
      try {
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
        result = await model.embedContent(text)
      } catch (e2) {
        // Fallback: use gemini-pro with a prompt-based approach
        console.warn('Embedding model not available, using fallback')
        return []
      }
    }
    
    // Handle different response formats
    if (result && result.embedding) {
      return result.embedding.values || []
    }
    
    return []
  } catch (error) {
    console.error('Error getting embedding:', error)
    // Fallback: return empty array if embedding fails
    return []
  }
}

// Calculate cosine similarity between two embedding vectors
function cosineSimilarityEmbeddings(vec1: number[], vec2: number[]): number {
  if (vec1.length === 0 || vec2.length === 0 || vec1.length !== vec2.length) {
    return 0
  }
  
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  if (denominator === 0) return 0
  
  return Math.max(0, Math.min(1, dotProduct / denominator))
}

// Generate comprehensive explanation for similarity using Python
async function generateSimilarityExplanation(
  proposedTitle: string,
  proposedConcept: string,
  existingTitle: string,
  existingAbstract: string,
  lexicalSim: number,
  semanticSim: number,
  genAI: GoogleGenerativeAI
): Promise<string> {
  try {
    // Use Python script to call Gemini API with temp file
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')
    const execAsync = promisify(exec)
    
    // Use temp file to avoid shell escaping issues
    const tempDir = os.tmpdir()
    const explanationFile = path.join(tempDir, `explanation-${Date.now()}.json`)
    
    const input = {
      action: 'explanation',
      proposedTitle,
      proposedConcept,
      existingTitle,
      existingAbstract,
      lexicalSim: lexicalSim,
      semanticSim: semanticSim
    }
    
    fs.writeFileSync(explanationFile, JSON.stringify(input))
    
    const { stdout, stderr } = await execAsync(
      `python3 /workspaces/detection_system/scripts/gemini_api.py < "${explanationFile}"`,
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    )
    
    // Cleanup
    try { fs.unlinkSync(explanationFile) } catch {}
    
    if (stderr && !stderr.includes('injecting env')) {
      console.error('Python script stderr:', stderr)
    }
    
    const result = JSON.parse(stdout)
    
    if (result.success) {
      return result.explanation
    } else {
      throw new Error(result.error || 'Unknown error from Python script')
    }
  } catch (error) {
    console.error('Error calling Python Gemini API:', error)
    
    // Deep comprehensive fallback explanation
    const avgSim = ((lexicalSim + semanticSim) / 2) * 100
    const isConceptual = semanticSim > lexicalSim + 0.15
    const isLexical = lexicalSim > semanticSim + 0.15
    const lexicalPercent = (lexicalSim * 100).toFixed(1)
    const semanticPercent = (semanticSim * 100).toFixed(1)
    
    if (avgSim >= 70) {
      return `**How similar are they?**
These two researches are very similar - almost like twins! They share ${avgSim.toFixed(0)}% similarity overall.

**What are they both trying to do?**
Both researches are trying to solve the same problem. ${isConceptual ? `They use different words to say it, but they mean the same thing - like saying "car" vs "automobile".` : `They even use many of the same exact words to describe it.`}

**How are they doing it?**
Both use similar technologies, tools, or methods to solve the problem. They're taking the same approach.

**Why should you care about this similarity?**
Both of these researches are working on the same thing in the same way. ${isConceptual ? `Even though the words look different (word matching: ${lexicalPercent}%, meaning matching: ${semanticPercent}%), the ideas behind them are basically identical. Think of it like two people describing the same movie using different words - the story is still the same.` : `They use the same words (${lexicalPercent}% match) and have the same ideas (${semanticPercent}% match). This means they're not just in the same field - they're doing almost exactly the same thing.`} This is a really high level of similarity.

**What's the bottom line?**
These are too similar - one might be copying the other or they lack originality. You should look at them carefully to make sure they're different enough.`
    } else if (avgSim >= 40) {
      return `**How similar are they?**
These researches are somewhat similar - like cousins rather than twins. They share ${avgSim.toFixed(0)}% similarity.

**What are they both trying to do?**
${isConceptual ? `They're working on related problems, but not exactly the same thing. They have similar ideas but explain them differently.` : `They're in the same field and share some of the same goals, but they have different focuses.`}

**How are they doing it?**
They might use some of the same tools or methods, but they also have their own unique approaches.

**Why should you care about this similarity?**
Both of these researches are in the same area of study. ${isConceptual ? `The meaning similarity (${semanticPercent}%) is higher than word similarity (${lexicalPercent}%), which means they share similar concepts but describe them differently - like two recipes for similar dishes using different ingredients.` : `They share some common words (${lexicalPercent}%) and ideas (${semanticPercent}%), so they're working in the same neighborhood but on different streets.`} There's enough overlap that they're related, but enough difference that they're not the same.

**What's the bottom line?**
These are similar enough to be in the same field, but different enough to be separate works. They're probably okay, but double-check to make sure they're original enough.`
    } else {
      return `**How similar are they?**
These researches have low similarity at ${avgSim.toFixed(0)}%.

**What are they both trying to do?**
${isConceptual ? `They work on different problems with minimal conceptual overlap.` : `They address different topics and goals.`}

**How are they doing it?**
Different methodologies and approaches are used.

**Why should you care about this similarity?**
${isConceptual ? `Small meaning overlap (${semanticPercent}%) with low word matching (${lexicalPercent}%) suggests minimal connection.` : `Both word matching (${lexicalPercent}%) and meaning matching (${semanticPercent}%) are low, indicating distinct research areas.`}

**What's the bottom line?**
The researches are sufficiently different and appear to be original works.`
    }
  }
}

// Combined Lexical and Semantic Similarity Calculation
async function calculateCosineSimilarity(
  proposedTitle: string,
  proposedConcept: string,
  existingResearches: Array<{ 
    id?: string
    title: string
    abstract: string
    year?: number
    course?: string
  }>,
  genAI: GoogleGenerativeAI
): Promise<Array<{
  id?: string
  title: string
  abstract: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
  lexicalSimilarity: number
  semanticSimilarity: number
  similarityType: 'Lexical' | 'Conceptual' | 'Both'
  explanation: string
  verification?: string
}>> {
  // Enhanced TF-IDF cosine similarity with improved preprocessing
  
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'about', 'into', 'through', 'during', 'including', 'against', 'among',
    'throughout', 'despite', 'towards', 'upon', 'concerning'
  ])

  // Word similarity using Levenshtein distance
  const wordSimilarity = (word1: string, word2: string): number => {
    if (word1 === word2) return 1.0
    if (word1.length === 0 || word2.length === 0) return 0
    
    const longer = word1.length > word2.length ? word1 : word2
    const shorter = word1.length > word2.length ? word2 : word1
    
    // If words are very different in length, similarity is low
    if (longer.length - shorter.length > 3) return 0
    
    // Check if one word contains the other (for compound words)
    if (longer.includes(shorter) && shorter.length >= 4) return 0.7
    
    // Simple character overlap similarity
    const commonChars = [...shorter].filter(char => longer.includes(char)).length
    return commonChars / longer.length
  }

  // Enhanced preprocessing with better normalization
  const preprocess = (text: string): string[] => {
    if (!text) return []
    
    return text
      .toLowerCase()
      // Keep numbers and hyphens for technical terms
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => {
        // Keep words longer than 2 chars and not stop words
        // Also keep numbers
        return (word.length > 2 && !stopWords.has(word)) || /^\d+$/.test(word)
      })
      .map(word => {
        // More aggressive stemming
        const original = word
        
        // Remove common suffixes
        if (word.length > 6) {
          if (word.endsWith('tion')) return word.slice(0, -4)
          if (word.endsWith('sion')) return word.slice(0, -4)
          if (word.endsWith('ment')) return word.slice(0, -4)
          if (word.endsWith('ness')) return word.slice(0, -4)
        }
        if (word.length > 5) {
          if (word.endsWith('ing')) return word.slice(0, -3)
          if (word.endsWith('ity')) return word.slice(0, -3)
          if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
        }
        if (word.length > 4) {
          if (word.endsWith('ed')) return word.slice(0, -2)
          if (word.endsWith('ly')) return word.slice(0, -2)
          if (word.endsWith('er')) return word.slice(0, -2)
        }
        if (word.length > 3) {
          if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
        }
        
        return word
      })
      .filter(word => word.length > 0)
  }

  // Create n-grams (1-gram, 2-gram, and 3-gram) for better matching
  const createNGrams = (words: string[]): string[] => {
    const ngrams: string[] = [...words] // 1-grams
    
    // 2-grams
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.push(`${words[i]} ${words[i + 1]}`)
    }
    
    // 3-grams for longer phrases
    for (let i = 0; i < words.length - 2; i++) {
      ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
    }
    
    return ngrams
  }

  // Character-level n-grams for fuzzy matching
  const createCharNGrams = (word: string, n: number = 3): string[] => {
    const charNgrams: string[] = []
    for (let i = 0; i <= word.length - n; i++) {
      charNgrams.push(word.substring(i, i + n))
    }
    return charNgrams
  }

  const calculateTfIdf = (
    text: string,
    allTexts: string[]
  ): Map<string, number> => {
    const words = preprocess(text)
    const ngrams = createNGrams(words)
    const wordCounts = new Map<string, number>()
    
    ngrams.forEach(ngram => {
      wordCounts.set(ngram, (wordCounts.get(ngram) || 0) + 1)
    })

    const tfIdf = new Map<string, number>()
    const totalDocs = allTexts.length
    
    if (totalDocs === 0) return tfIdf
    
    // Preprocess all documents once for efficiency
    const preprocessedDocs = allTexts.map(doc => ({
      words: preprocess(doc),
      ngrams: createNGrams(preprocess(doc))
    }))
    
    wordCounts.forEach((count, ngram) => {
      // Check exact match
      let docsWithNgram = preprocessedDocs.filter(doc => 
        doc.ngrams.includes(ngram)
      ).length
      
      // If no exact match, check for fuzzy similarity (for single words)
      if (docsWithNgram === 0 && ngram.split(' ').length === 1) {
        const word = ngram
        docsWithNgram = preprocessedDocs.filter(doc => {
            return doc.words.some(docWord => {
              const sim = wordSimilarity(word, docWord)
              return sim > 0.55 // Lowered threshold for better accuracy (was 0.6)
            })
        }).length
        
        // Boost similarity score if fuzzy match found
        if (docsWithNgram > 0) {
          const tf = count / ngrams.length
          const idf = Math.log((totalDocs + 1) / (docsWithNgram + 1)) + 1
          // Reduce weight for fuzzy matches but still include them
          tfIdf.set(ngram, tf * idf * 0.7)
          return
        }
      }
      
      // Improved IDF calculation with smoothing
      const idf = Math.log((totalDocs + 1) / (docsWithNgram + 1)) + 1
      const tf = count / ngrams.length
      tfIdf.set(ngram, tf * idf)
    })

    return tfIdf
  }

  const cosineSimilarity = (
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number => {
    const allWords = new Set([...vec1.keys(), ...vec2.keys()])
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    let fuzzyMatchScore = 0

    // Exact matches
    allWords.forEach(word => {
      const val1 = vec1.get(word) || 0
      const val2 = vec2.get(word) || 0
      dotProduct += val1 * val2
      norm1 += val1 * val1
      norm2 += val2 * val2
    })

    // Add fuzzy matching for single-word ngrams
    const vec1Words = Array.from(vec1.keys()).filter(w => w.split(' ').length === 1)
    const vec2Words = Array.from(vec2.keys()).filter(w => w.split(' ').length === 1)
    
    vec1Words.forEach(word1 => {
      const val1 = vec1.get(word1) || 0
      if (val1 === 0) return
      
      vec2Words.forEach(word2 => {
        const val2 = vec2.get(word2) || 0
        if (val2 === 0) return
        
        // Skip if already matched exactly
        if (word1 === word2) return
        
        const sim = wordSimilarity(word1, word2)
        if (sim > 0.55) { // Lowered threshold for better accuracy (was 0.6)
          // Add fuzzy match contribution (weighted by similarity)
          fuzzyMatchScore += val1 * val2 * sim * 0.35 // Increased weight (was 0.3)
        }
      })
    })

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) return 0
    
    // Combine exact match and fuzzy match scores
    const exactSimilarity = dotProduct / denominator
    const fuzzyContribution = fuzzyMatchScore / (denominator + 1)
    
    return Math.max(0, Math.min(1, exactSimilarity + fuzzyContribution))
  }

  const allTitles = [
    proposedTitle,
    ...existingResearches.map(r => r.title)
  ]
  const allAbstracts = [
    proposedConcept,
    ...existingResearches.map(r => r.abstract)
  ]

  // Get semantic embeddings for proposed research
  console.log('Getting semantic embeddings for proposed research...')
  const proposedTitleEmbedding = await getEmbedding(proposedTitle, genAI)
  const proposedConceptEmbedding = await getEmbedding(proposedConcept, genAI)
  
  // Calculate lexical similarity (TF-IDF)
  const proposedTitleVec = calculateTfIdf(proposedTitle, allTitles)
  const proposedConceptVec = calculateTfIdf(proposedConcept, allAbstracts)

  // Process all researches with AI-based similarity calculation
  const results = await Promise.all(
    existingResearches.map(async (research, index) => {
      // Try AI-based similarity first
      let aiSimilarity = null
      try {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const fs = await import('fs')
        const path = await import('path')
        const os = await import('os')
        const execAsync = promisify(exec)
        
        // Use temp file to avoid shell escaping issues
        const tempDir = os.tmpdir()
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`
        const inputFile = path.join(tempDir, `ai-similarity-${uniqueId}.json`)
        
        const input = {
          action: 'calculate',
          proposedTitle,
          proposedConcept,
          existingTitle: research.title,
          existingAbstract: research.abstract
        }
        
        fs.writeFileSync(inputFile, JSON.stringify(input))
        
        console.log(`Calling AI for research ${index + 1}/${existingResearches.length}: "${research.title.substring(0, 40)}..."`)
        
        const { stdout, stderr } = await execAsync(
          `python3 /workspaces/detection_system/scripts/gemini_api.py < "${inputFile}"`,
          { timeout: 30000, maxBuffer: 1024 * 1024 } // 30 second timeout
        )
        
        // Cleanup temp file
        try { fs.unlinkSync(inputFile) } catch {}
        
        if (stderr && stderr.trim().length > 0 && !stderr.includes('injecting env')) {
          console.log('AI stderr:', stderr.trim())
        }
        
        const result = JSON.parse(stdout)
        if (result.success) {
          console.log(`✓ AI calculated: ${(result.overallSimilarity * 100).toFixed(1)}%`)
          aiSimilarity = {
            titleSimilarity: result.titleSimilarity,
            abstractSimilarity: result.abstractSimilarity,
            overallSimilarity: result.overallSimilarity,
            reasoning: result.reasoning
          }
        } else {
          console.log(`✗ AI returned error: ${result.error}`)
        }
      } catch (aiError) {
        const errorMsg = aiError instanceof Error ? aiError.message : String(aiError)
        console.warn(`✗ AI similarity calculation failed for research ${index + 1}, falling back to traditional method:`, errorMsg)
      }
      
      // If AI similarity succeeded, use it; otherwise fall back to traditional TF-IDF + embeddings
      let combinedTitleSim, combinedAbstractSim, overallSim, lexicalSim, semanticSim, similarityType
      
      if (aiSimilarity) {
        // Use AI-calculated similarity
        combinedTitleSim = aiSimilarity.titleSimilarity
        combinedAbstractSim = aiSimilarity.abstractSimilarity
        overallSim = aiSimilarity.overallSimilarity
        
        // For backward compatibility, set lexical and semantic based on AI result
        lexicalSim = overallSim * 0.4  // Approximate
        semanticSim = overallSim * 0.6  // Approximate
        
        // Determine similarity type based on AI reasoning
        if (overallSim > 0.7) {
          similarityType = 'Both'
        } else if (overallSim > 0.4) {
          similarityType = 'Conceptual'
        } else {
          similarityType = 'Lexical'
        }
      } else {
        // Fallback: Traditional lexical and semantic similarity calculation
        console.log(`Using fallback TF-IDF for research ${index + 1}`)
      // Lexical similarity
      const existingTitleVec = calculateTfIdf(research.title, allTitles)
      const existingAbstractVec = calculateTfIdf(research.abstract, allAbstracts)

      const titleLexicalSim = cosineSimilarity(proposedTitleVec, existingTitleVec)
      const abstractLexicalSim = cosineSimilarity(proposedConceptVec, existingAbstractVec)
      
      console.log(`TF-IDF scores: title=${(titleLexicalSim * 100).toFixed(1)}%, abstract=${(abstractLexicalSim * 100).toFixed(1)}%`)
      
      // Word overlap similarity
      const titleWords = new Set(preprocess(proposedTitle))
      const abstractWords = new Set(preprocess(proposedConcept))
      const existingTitleWords = new Set(preprocess(research.title))
      const existingAbstractWords = new Set(preprocess(research.abstract))
      
      const titleOverlap = titleWords.size > 0 
        ? [...titleWords].filter(w => existingTitleWords.has(w)).length / titleWords.size
        : 0
      const abstractOverlap = abstractWords.size > 0
        ? [...abstractWords].filter(w => existingAbstractWords.has(w)).length / abstractWords.size
        : 0
      
      const enhancedTitleLexical = titleLexicalSim * 0.7 + titleOverlap * 0.3
      const enhancedAbstractLexical = abstractLexicalSim * 0.7 + abstractOverlap * 0.3
      lexicalSim = enhancedTitleLexical * 0.4 + enhancedAbstractLexical * 0.6

      // Semantic similarity using embeddings
      let titleSemanticSim = 0
      let abstractSemanticSim = 0
      let semanticSim = 0

      if (proposedTitleEmbedding.length > 0) {
        const existingTitleEmbedding = await getEmbedding(research.title, genAI)
        if (existingTitleEmbedding.length > 0) {
          titleSemanticSim = cosineSimilarityEmbeddings(proposedTitleEmbedding, existingTitleEmbedding)
        }
      }

      if (proposedConceptEmbedding.length > 0) {
        const existingAbstractEmbedding = await getEmbedding(research.abstract, genAI)
        if (existingAbstractEmbedding.length > 0) {
          abstractSemanticSim = cosineSimilarityEmbeddings(proposedConceptEmbedding, existingAbstractEmbedding)
        }
      }

      semanticSim = titleSemanticSim * 0.4 + abstractSemanticSim * 0.6

      // Enhanced accuracy: Adjust weights based on whether semantic embeddings are available
      let combinedTitleSim, combinedAbstractSim
      
      if (proposedTitleEmbedding.length > 0 && titleSemanticSim > 0) {
        // Semantic embeddings available: Prioritize semantic similarity (30% lexical, 70% semantic)
        combinedTitleSim = enhancedTitleLexical * 0.30 + titleSemanticSim * 0.70
        combinedAbstractSim = enhancedAbstractLexical * 0.30 + abstractSemanticSim * 0.70
      } else {
        // Semantic embeddings unavailable: Use only lexical with improved accuracy
        console.warn('Semantic embeddings unavailable, using enhanced lexical similarity only')
        combinedTitleSim = enhancedTitleLexical
        combinedAbstractSim = enhancedAbstractLexical
      }
      
      // Boost overall similarity if both lexical and semantic are high (indicates strong match)
      let overallSim = combinedTitleSim * 0.4 + combinedAbstractSim * 0.6
      
      // Accuracy enhancement: If both similarities are high, boost the score
      if (lexicalSim > 0.6 && semanticSim > 0.6) {
        overallSim = Math.min(1, overallSim * 1.05) // 5% boost for strong matches
      }
      
      // Accuracy enhancement: If semantic is much higher than lexical, trust semantic more
      if (semanticSim > lexicalSim + 0.3) {
        overallSim = Math.min(1, overallSim * 1.03) // 3% boost for conceptual matches
      }

      // Determine similarity type
      if (lexicalSim > 0.5 && semanticSim > 0.5) {
        similarityType = 'Both'
      } else if (semanticSim > lexicalSim + 0.2) {
        similarityType = 'Conceptual'
      } else {
        similarityType = 'Lexical'
      }
      } // End of fallback block

      // Use AI reasoning as explanation if available (avoid redundant AI call)
      const explanation = aiSimilarity?.reasoning || await generateSimilarityExplanation(
        proposedTitle,
        proposedConcept,
        research.title,
        research.abstract,
        (lexicalSim || 0) * 100,
        (semanticSim || 0) * 100,
        genAI
      )

      // Generate verification only for high similarity matches (>40%) to save AI calls
      let verification = ''
      if (overallSim > 0.40 && aiSimilarity) {
        // Use AI reasoning as verification for high similarity matches
        verification = `=== SIMILARITY ANALYSIS ===

System Score Received:
- Title Similarity: ${(combinedTitleSim * 100).toFixed(1)}%
- Abstract Similarity: ${(combinedAbstractSim * 100).toFixed(1)}%
- Overall Similarity: ${(overallSim * 100).toFixed(1)}%

AI Accuracy Evaluation:
${aiSimilarity.reasoning}

Final Verdict:
The AI-calculated similarity of ${(overallSim * 100).toFixed(1)}% indicates ${
  overallSim >= 0.70 ? 'HIGH similarity - requires careful review for originality' :
  overallSim >= 0.40 ? 'MODERATE similarity - some overlap detected' :
  'LOW similarity - researches are sufficiently different'
}`
      }

      return {
        id: research.id,
        title: research.title,
        abstract: research.abstract,
        year: research.year,
        course: research.course,
        titleSimilarity: Math.round(combinedTitleSim * 10000) / 10000,
        abstractSimilarity: Math.round(combinedAbstractSim * 10000) / 10000,
        overallSimilarity: Math.round(overallSim * 10000) / 10000,
        lexicalSimilarity: Math.round((lexicalSim || 0) * 10000) / 10000,
        semanticSimilarity: Math.round((semanticSim || 0) * 10000) / 10000,
        similarityType: similarityType as 'Lexical' | 'Conceptual' | 'Both',
        explanation,
        verification
      }
    })
  )

  return results.sort((a, b) => b.overallSimilarity - a.overallSimilarity)
}

async function generateGeminiReport(
  proposedTitle: string,
  proposedConcept: string,
  similarities: Array<{
    id?: string
    title: string
    abstract: string
    year?: number
    course?: string
    titleSimilarity: number
    abstractSimilarity: number
    overallSimilarity: number
  }>
): Promise<string> {
  // Read Gemini API key from .env file
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing from .env file')
    throw new Error('GEMINI_API_KEY is not set in environment variables. Please add it to your .env file.')
  }

  // Get top 3 most similar researches
  const topSimilar = similarities.slice(0, 3)

  const prompt = `You are an expert research analyst. Analyze the similarity between a proposed research and existing researches.

PROPOSED RESEARCH:
Title: ${proposedTitle}
Concept: ${proposedConcept}

EXISTING RESEARCHES FROM DATABASE WITH SIMILARITY SCORES:
${topSimilar
  .map(
    (r, i) => `
${i + 1}. Title: ${r.title}
   Year: ${r.year || 'N/A'}
   Course: ${r.course || 'N/A'}
   Abstract: ${r.abstract}
   Title Similarity: ${(r.titleSimilarity * 100).toFixed(2)}%
   Abstract Similarity: ${(r.abstractSimilarity * 100).toFixed(2)}%
   Overall Similarity: ${(r.overallSimilarity * 100).toFixed(2)}%
`
  )
  .join('\n')}

Please generate a comprehensive similarity analysis report that includes:
1. Executive Summary - Overall assessment of similarity
2. Title Analysis - Comparison of proposed title with existing titles
3. Concept Analysis - Comparison of proposed concept with existing abstracts
4. Risk Assessment - Level of similarity risk (Low/Medium/High)
5. Recommendations - Suggestions for improving originality if needed
6. Conclusion - Final verdict on the proposed research

Format the report in a clear, professional manner suitable for academic review.`

  try {
    // Use Python script to call Gemini API
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    const input = JSON.stringify({
      action: 'report',
      proposedTitle,
      proposedConcept,
      similarities: topSimilar
    })
    
    const { stdout, stderr } = await execAsync(
      `echo '${input.replace(/'/g, "'\\''")}' | python3 /workspaces/detection_system/scripts/gemini_api.py`
    )
    
    if (stderr) {
      console.error('Python script stderr:', stderr)
    }
    
    const result = JSON.parse(stdout)
    
    if (result.success) {
      return result.report
    } else {
      throw new Error(result.error || 'Unknown error from Python script')
    }
  } catch (error) {
    console.error('Gemini API error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error
    })
    // Return a fallback report instead of throwing
    return `# Similarity Analysis Report

## Proposed Research
**Title:** ${proposedTitle}

**Concept:** ${proposedConcept}

## Top Similar Researches

${topSimilar.map((r, i) => `
### ${i + 1}. ${r.title}
- **Year:** ${r.year || 'N/A'}
- **Course:** ${r.course || 'N/A'}
- **Overall Similarity:** ${(r.overallSimilarity * 100).toFixed(2)}%
- **Title Similarity:** ${(r.titleSimilarity * 100).toFixed(2)}%
- **Abstract Similarity:** ${(r.abstractSimilarity * 100).toFixed(2)}%

**Abstract:** ${r.abstract}
`).join('\n')}

## Analysis Summary

${topSimilar.length > 0 && topSimilar[0].overallSimilarity > 0.7 
  ? '⚠️ **HIGH SIMILARITY DETECTED** - The proposed research shows high similarity with existing work. Consider revising to ensure originality.'
  : topSimilar.length > 0 && topSimilar[0].overallSimilarity > 0.4
  ? '⚡ **MODERATE SIMILARITY** - The proposed research has some overlap with existing work but maintains sufficient distinction.'
  : '✅ **LOW SIMILARITY** - The proposed research appears to be sufficiently original and distinct from existing work.'}

---
*Note: AI report generation temporarily unavailable. Using fallback format.*`
  }
}

// AI-Powered Similarity Calculation using Python Gemini API
async function calculateAISimilarity(
  proposedTitle: string,
  proposedConcept: string,
  existingResearches: Array<{ 
    id?: string
    title: string
    abstract: string
    year?: number
    course?: string
  }>,
  genAI: GoogleGenerativeAI
): Promise<Array<{
  id?: string
  title: string
  abstract: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
  lexicalSimilarity: number
  semanticSimilarity: number
  similarityType: 'Lexical' | 'Conceptual' | 'Both'
  explanation: string
  verification?: string
}>> {
  const results = []
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  console.log(`Calculating AI similarity for ${existingResearches.length} researches...`)
  console.log(`Proposed concept length: ${proposedConcept.length} characters`)

  // Process researches in batches of 3 with timeout
  const BATCH_SIZE = 3
  const TIMEOUT_MS = 30000 // 30 seconds per request (increased)

  for (let i = 0; i < existingResearches.length; i += BATCH_SIZE) {
    const batch = existingResearches.slice(i, i + BATCH_SIZE)
    
    const batchPromises = batch.map(async (existing) => {
      try {
        const input = JSON.stringify({
          action: 'calculate',
          proposedTitle,
          proposedConcept: proposedConcept.substring(0, 3000), // Limit to 3000 chars for faster processing
          existingTitle: existing.title,
          existingAbstract: existing.abstract
        })
        
        console.log(`⏳ Processing: "${existing.title.substring(0, 40)}..."`)
        
        // Execute Python script with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
        })
        
        const execPromise = execAsync(
          `echo '${input.replace(/'/g, "'\\''")}' | timeout 30 python3 /workspaces/detection_system/scripts/gemini_api.py`,
          { maxBuffer: 1024 * 1024 * 10, timeout: TIMEOUT_MS }
        )
        
        const { stdout, stderr } = await Promise.race([execPromise, timeoutPromise])
        
        if (stderr && !stderr.includes('injecting env')) {
          console.error('Python script stderr:', stderr)
        }
        
        const result = JSON.parse(stdout)
        
        if (result.success) {
          // AI calculation succeeded - note: Python returns values as decimals (0-1.0)
          const titleSim = result.titleSimilarity
          const abstractSim = result.abstractSimilarity
          const overallSim = result.overallSimilarity
          
          console.log(`✓ AI similarity for "${existing.title.substring(0, 50)}": ${(overallSim * 100).toFixed(1)}%`)
          
          return {
            ...existing,
            titleSimilarity: titleSim,
            abstractSimilarity: abstractSim,
            overallSimilarity: overallSim,
            lexicalSimilarity: overallSim,
            semanticSimilarity: overallSim,
            similarityType: 'Both' as const,
            explanation: result.reasoning || 'AI-powered similarity analysis',
            verification: `AI Analysis: ${(overallSim * 100).toFixed(1)}% similarity detected`
          }
        } else {
          throw new Error(result.error || 'AI calculation failed')
        }
      } catch (error) {
        console.error(`✗ AI similarity failed for "${existing.title.substring(0, 30)}", using TF-IDF fallback:`, error instanceof Error ? error.message : 'Unknown error')
        
        // Fallback to TF-IDF method for this research
        const tfidfResults = await calculateCosineSimilarity(
          proposedTitle,
          proposedConcept,
          [existing],
          genAI
        )
        
        return tfidfResults[0] || null
      }
    })

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.filter(r => r !== null))
  }

  // Sort by overall similarity (descending)
  results.sort((a, b) => b.overallSimilarity - a.overallSimilarity)

  console.log(`AI similarity complete. Top result: ${results[0]?.overallSimilarity ? (results[0].overallSimilarity * 100).toFixed(1) + '%' : 'N/A'}`)

  return results
}

// Request deduplication cache (prevents duplicate processing in development mode)
const requestCache = new Map<string, { promise: Promise<any>, timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.log(`=== Similarity Check API Started [${requestId}] ===`)
  const startTime = Date.now()
  
  try {
    console.log('Parsing request body...')
    const { proposedTitle, proposedConcept } = await request.json()

    if (!proposedTitle || !proposedConcept) {
      console.log('Missing required fields')
      return NextResponse.json(
        { error: 'Proposed title and concept are required' },
        { status: 400 }
      )
    }

    // Create cache key from request content
    const cacheKey = `${proposedTitle}:::${proposedConcept.substring(0, 200)}`
    
    // Check if identical request is already in progress or recently completed
    const cached = requestCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`[${requestId}] ♻️ Returning cached/in-progress result (duplicate request detected)`)
      const result = await cached.promise
      return NextResponse.json(result)
    }

    // Clean old cache entries
    for (const [key, value] of requestCache.entries()) {
      if ((now - value.timestamp) >= CACHE_TTL) {
        requestCache.delete(key)
      }
    }

    console.log('Request validated:', {
      titleLength: proposedTitle.length,
      conceptLength: proposedConcept.length
    })

    // Get Supabase client (using public client for similarity check - no auth required)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing')
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      )
    }

    console.log('Creating Supabase client...')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all existing researches from the database
    console.log('Fetching researches from database...')
    console.log('Supabase URL:', supabaseUrl)
    
    const { data: researches, error: dbError } = await supabase
      .from('researches')
      .select('id, title, abstract, year, course')
    
    console.log('Database query result:', { 
      count: researches?.length || 0, 
      error: dbError?.message,
      sample: researches?.slice(0, 2)
    })

    if (dbError) {
      console.error('Database error details:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch existing researches from database', 
          details: dbError.message,
          hint: 'Check if Row Level Security (RLS) policies allow public read access to researches table'
        },
        { status: 500 }
      )
    }

    const existingResearches = (researches || []).map(r => ({
      id: r.id,
      title: r.title || '',
      abstract: r.abstract || '',
      year: r.year,
      course: r.course,
    }))

    console.log(`Found ${existingResearches.length} researches in database to compare against`)
    
    // Log first few researches for debugging
    if (existingResearches.length > 0) {
      console.log('Sample researches:', existingResearches.slice(0, 3).map(r => ({
        id: r.id,
        title: r.title.substring(0, 50),
        abstractLength: r.abstract.length
      })))
    }

    // If no researches in database, return early
    if (existingResearches.length === 0) {
      return NextResponse.json({
        success: true,
        proposedTitle,
        proposedConcept,
        similarities: [],
        report: `No existing researches found in the database to compare against.\n\nYour proposed research:\nTitle: ${proposedTitle}\nConcept: ${proposedConcept}\n\nThis research appears to be unique as there are no existing researches in the database for comparison.`,
        totalComparisons: 0,
        message: 'No researches found in database for comparison'
      })
    }

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set in environment variables' },
        { status: 500 }
      )
    }
    const genAI = new GoogleGenerativeAI(apiKey)

    // Calculate similarity using hybrid approach: TF-IDF first, then AI for top matches
    console.log(`[${requestId}] Calculating TF-IDF similarity for all researches...`)
    console.log('Proposed title:', proposedTitle)
    console.log('Proposed concept length:', proposedConcept.length)
    
    // First pass: Fast TF-IDF similarity for all researches
    const tfidfSimilarities = await calculateCosineSimilarity(
      proposedTitle,
      proposedConcept,
      existingResearches,
      genAI
    )
    
    console.log(`[${requestId}] TF-IDF complete. Found ${tfidfSimilarities.length} comparisons.`)
    
    // AI analysis already done in calculateCosineSimilarity - no need for second pass!
    // Sort by overall similarity
    const similarities = tfidfSimilarities.sort((a, b) => b.overallSimilarity - a.overallSimilarity)

    console.log(`Similarity calculation complete. Found ${similarities.length} comparisons.`)
    
    // Log top 3 similarities for debugging
    if (similarities.length > 0) {
      console.log('Top 3 similarities:', similarities.slice(0, 3).map(s => ({
        title: s.title.substring(0, 50),
        overall: (s.overallSimilarity * 100).toFixed(2) + '%',
        lexical: (s.lexicalSimilarity * 100).toFixed(2) + '%',
        semantic: (s.semanticSimilarity * 100).toFixed(2) + '%',
        type: s.similarityType
      })))
    }

    // Generate report using Gemini API
    let report = ''
    try {
      // Use Node.js fs to write input to a temp file instead of echo
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tempDir = os.tmpdir()
      const inputFile = path.join(tempDir, `report-input-${Date.now()}.json`)
      
      const reportInput = {
        action: 'report',
        proposedTitle,
        proposedConcept,
        similarities: similarities.slice(0, 3).map(s => ({
          id: s.id,
          title: s.title,
          abstract: s.abstract,
          year: s.year,
          course: s.course,
          titleSimilarity: s.titleSimilarity,
          abstractSimilarity: s.abstractSimilarity,
          overallSimilarity: s.overallSimilarity,
          lexicalSimilarity: s.lexicalSimilarity,
          semanticSimilarity: s.semanticSimilarity,
          similarityType: s.similarityType,
          explanation: s.explanation,
          verification: s.verification
        }))
      }
      
      // Write to temp file
      fs.writeFileSync(inputFile, JSON.stringify(reportInput))
      
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      const { stdout: reportOutput } = await execAsync(
        `python3 /workspaces/detection_system/scripts/gemini_api.py < "${inputFile}"`,
        { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }
      )
      
      // Clean up temp file
      try {
        fs.unlinkSync(inputFile)
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError)
      }
      
      const reportResult = JSON.parse(reportOutput)
      
      if (reportResult.success) {
        report = reportResult.report
      } else {
        throw new Error(reportResult.error || 'Report generation failed')
      }
    } catch (geminiError) {
      console.error('Gemini error:', geminiError)
      // Return results even if Gemini fails
      report = `Similarity Analysis Report\n\n` +
        `Proposed Research Title: ${proposedTitle}\n\n` +
        `Proposed Research Concept: ${proposedConcept}\n\n` +
        `Similarity Results:\n` +
        similarities
          .slice(0, 5)
          .map(
            (s, i) =>
              `${i + 1}. ${s.title}\n   Overall Similarity: ${(s.overallSimilarity * 100).toFixed(2)}%\n`
          )
          .join('\n')
    }

    const resultData = {
      success: true,
      proposedTitle,
      proposedConcept,
      similarities: similarities.slice(0, 3), // Return top 3
      report,
      totalComparisons: similarities.length,
    }

    // Cache the result for deduplication
    requestCache.set(cacheKey, { 
      promise: Promise.resolve(resultData), 
      timestamp: Date.now() 
    })

    return NextResponse.json(resultData)
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error('=== Similarity Check API Error ===')
    console.error('Error after', elapsed, 'ms:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check similarity', 
        details: error instanceof Error ? error.message : String(error),
        elapsed: `${elapsed}ms`
      },
      { status: 500 }
    )
  } finally {
    const elapsed = Date.now() - startTime
    console.log(`=== Similarity Check API Complete [${requestId}] in ${elapsed}ms ===`)
  }
}

