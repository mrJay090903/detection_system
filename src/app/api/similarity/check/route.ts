import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

// Generate comprehensive explanation for similarity
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
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    
    const prompt = `You are a helpful research assistant. Explain in simple, easy-to-understand language why a proposed research is similar to an existing research. Use plain English, avoid jargon, and make it easy for anyone to understand.

PROPOSED RESEARCH:
Title: "${proposedTitle}"
Concept/Abstract: "${proposedConcept}"

EXISTING RESEARCH FROM DATABASE:
Title: "${existingTitle}"
Abstract: "${existingAbstract}"

SIMILARITY SCORES:
Lexical Similarity: ${(lexicalSim * 100).toFixed(2)}% (word-based matching)
Semantic Similarity: ${(semanticSim * 100).toFixed(2)}% (meaning-based matching)

IMPORTANT: Compare these two researches:
1. Proposed Title: "${proposedTitle}" vs Existing Title: "${existingTitle}"
2. Proposed Abstract: "${proposedConcept}" vs Existing Abstract: "${existingAbstract}"

Write a SPECIFIC and DETAILED explanation that clearly explains WHY they are similar. Follow this EXACT format:

**Explanation:** [Write a detailed paragraph starting with "Both studies share..."]

FORMAT REQUIREMENTS:
1. Start with: "Both studies share the same purpose of [EXACT purpose from both abstracts - quote specific phrases]"

2. Then say: "The methods ([list EXACT method names from BOTH abstracts - e.g., BERT, cosine similarity, NLP, IoT, etc.]) and objectives ([list EXACT objectives from BOTH abstracts - e.g., academic integrity, plagiarism detection, etc.]) are nearly identical, despite different wording."

3. Add 2-4 more sentences that are SPECIFIC about:
   - What EXACT technologies appear in BOTH abstracts? (e.g., "both use BERT", "both employ cosine similarity", "both utilize NLP")
   - What EXACT objectives/goals are mentioned in BOTH? (e.g., "both aim to detect plagiarism", "both focus on academic integrity")
   - What EXACT problem domain do BOTH address? (e.g., "both target academic papers", "both focus on research similarity")
   - What EXACT tools, frameworks, or approaches do BOTH mention? (List them specifically)

EXAMPLE OF GOOD EXPLANATION:
"Both studies share the same purpose of detecting plagiarism and text similarity in academic works using AI and NLP. The methods (BERT, cosine similarity) and objectives (academic integrity) are nearly identical, despite different wording. Both researches utilize transformer-based models like BERT to identify semantic similarities in academic papers. Both employ cosine similarity algorithms to measure text similarity. Both aim to maintain academic integrity and prevent plagiarism in academic writing. The target domain is identical - both focus on academic research papers and student theses."

CRITICAL REQUIREMENTS:
- Start with "Both studies share..." or "Both researches share..."
- Mention EXACT technology names from BOTH abstracts (BERT, RoBERTa, cosine similarity, NLP, IoT, etc.)
- Mention EXACT objectives from BOTH abstracts (academic integrity, plagiarism detection, etc.)
- Quote or reference specific phrases that appear in BOTH abstracts
- Be EXTREMELY SPECIFIC - don't say "both use AI" say "both use BERT and NLP"
- Don't be vague - always mention exact names of technologies, methods, or objectives
- List ALL technologies/methods that appear in BOTH abstracts
- Make it clear WHY they are similar by citing exact, specific similarities
- Write in simple, clear language but be very specific about details

WRITING STYLE:
- Use simple, everyday language - like explaining to a friend
- Avoid academic jargon - say "they use the same method" not "they employ identical methodologies"
- Use examples - "both mention BERT" instead of "both utilize transformer architectures"
- Be direct - "These are very similar" not "There exists a high degree of similarity"
- Keep sentences short and clear
- Use bullet points or lists when helpful
- Make it easy to understand - imagine explaining to someone who isn't a researcher`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Error generating explanation:', error)
    // Deep comprehensive fallback explanation
    const avgSim = ((lexicalSim + semanticSim) / 2) * 100
    const isConceptual = semanticSim > lexicalSim + 0.15
    const isLexical = lexicalSim > semanticSim + 0.15
    const lexicalPercent = (lexicalSim * 100).toFixed(1)
    const semanticPercent = (semanticSim * 100).toFixed(1)
    
    if (avgSim >= 70) {
      return `**Are the titles similar?** 
Yes, the titles "${proposedTitle}" and "${existingTitle}" share similar words and talk about the same topic.

**What problem are they solving?**
Both researches are trying to solve the same problem. ${isConceptual ? `Even though they use different words, they mean the same thing - like saying "car" vs "automobile". The semantic similarity (${semanticPercent}%) is much higher than word similarity (${lexicalPercent}%), which means they have the same ideas even if written differently.` : isLexical ? `They use many of the same words (${lexicalPercent}% word similarity), showing they're talking about the same thing.` : `They are very similar in both words (${lexicalPercent}%) and meaning (${semanticPercent}%).`}

**What methods do they use?**
Both researches use similar technologies, tools, or methods to solve the problem.

**What makes them similar?**
- They share many of the same words and phrases
- They use similar technologies or tools
- They have the same goals or objectives
- They solve the same problem in similar ways

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means these two researches are very similar. ${isConceptual ? `Even though the words are different, the ideas are the same.` : `They use many of the same words and have similar ideas.`}

**Bottom line**
These researches are too similar - they might be copies or lack originality. You should review them carefully.`
    } else if (avgSim >= 40) {
      return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" share some similar words, but they might focus on slightly different things.

**What problem are they solving?**
${isConceptual ? `They might be solving related problems, but not exactly the same. The meaning similarity (${semanticPercent}%) is higher than word similarity (${lexicalPercent}%), so they have similar ideas but different wording.` : isLexical ? `They share some words (${lexicalPercent}% word similarity), which means they're in the same research area, but they might solve different problems.` : `They have some overlap in both words (${lexicalPercent}%) and meaning (${semanticPercent}%), but they're not identical.`}

**What methods do they use?**
They might use some similar tools or methods, but also have differences in their approach.

**What makes them similar?**
- They share some words or phrases
- They might use some of the same technologies
- They're in the same research area
- But they have enough differences to be considered separate

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means they're somewhat similar but not too much. They're related but different enough.

**Bottom line**
These researches are somewhat similar but different enough. They're probably okay, but you should still review them to make sure they're original enough.`
    } else {
      return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" are different and talk about different topics.

**What problem are they solving?**
They are solving different problems. ${isConceptual ? `Even though there might be a small connection in meaning (${semanticPercent}%), they are clearly different researches.` : `They don't share many words (${lexicalPercent}%) or similar meanings (${semanticPercent}%).`}

**What methods do they use?**
They use different methods, tools, or technologies to solve their problems.

**What makes them similar?**
Not much - they are different researches with different goals and methods.

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which is low. This means they are different researches.

**Bottom line**
These researches are different enough - they are original and don't overlap much.`
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

  // Process all researches with both lexical and semantic similarity
  const results = await Promise.all(
    existingResearches.map(async (research, index) => {
      // Lexical similarity
      const existingTitleVec = calculateTfIdf(research.title, allTitles)
      const existingAbstractVec = calculateTfIdf(research.abstract, allAbstracts)

      const titleLexicalSim = cosineSimilarity(proposedTitleVec, existingTitleVec)
      const abstractLexicalSim = cosineSimilarity(proposedConceptVec, existingAbstractVec)
      
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
      const lexicalSim = enhancedTitleLexical * 0.4 + enhancedAbstractLexical * 0.6

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

      // Enhanced accuracy: Prioritize semantic similarity more (25% lexical, 75% semantic)
      // This improves accuracy for detecting conceptual similarity even with different wording
      const combinedTitleSim = enhancedTitleLexical * 0.25 + titleSemanticSim * 0.75
      const combinedAbstractSim = enhancedAbstractLexical * 0.25 + abstractSemanticSim * 0.75
      
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
      let similarityType: 'Lexical' | 'Conceptual' | 'Both'
      if (lexicalSim > 0.5 && semanticSim > 0.5) {
        similarityType = 'Both'
      } else if (semanticSim > lexicalSim + 0.2) {
        similarityType = 'Conceptual'
      } else {
        similarityType = 'Lexical'
      }

      // Generate explanation
      const explanation = await generateSimilarityExplanation(
        proposedTitle,
        proposedConcept,
        research.title,
        research.abstract,
        lexicalSim,
        semanticSim,
        genAI
      )

      return {
        id: research.id,
        title: research.title,
        abstract: research.abstract,
        year: research.year,
        course: research.course,
        titleSimilarity: Math.round(combinedTitleSim * 10000) / 10000,
        abstractSimilarity: Math.round(combinedAbstractSim * 10000) / 10000,
        overallSimilarity: Math.round(overallSim * 10000) / 10000,
        lexicalSimilarity: Math.round(lexicalSim * 10000) / 10000,
        semanticSimilarity: Math.round(semanticSim * 10000) / 10000,
        similarityType,
        explanation,
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

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Get top 5 most similar researches
  const topSimilar = similarities.slice(0, 5)

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
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Gemini API error:', error)
    throw new Error('Failed to generate report from Gemini API')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { proposedTitle, proposedConcept } = await request.json()

    if (!proposedTitle || !proposedConcept) {
      return NextResponse.json(
        { error: 'Proposed title and concept are required' },
        { status: 400 }
      )
    }

    // Get Supabase client (using public client for similarity check - no auth required)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      )
    }

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

    // Calculate similarity (lexical + semantic)
    console.log('Calculating similarity (lexical + semantic)...')
    console.log('Proposed title:', proposedTitle)
    console.log('Proposed concept length:', proposedConcept.length)
    
    const similarities = await calculateCosineSimilarity(
      proposedTitle,
      proposedConcept,
      existingResearches,
      genAI
    )

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
      report = await generateGeminiReport(
        proposedTitle,
        proposedConcept,
        similarities
      )
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

    return NextResponse.json({
      success: true,
      proposedTitle,
      proposedConcept,
      similarities: similarities.slice(0, 10), // Return top 10
      report,
      totalComparisons: similarities.length,
    })
  } catch (error) {
    console.error('Similarity check error:', error)
    return NextResponse.json(
      { error: 'Failed to check similarity', details: String(error) },
      { status: 500 }
    )
  }
}

