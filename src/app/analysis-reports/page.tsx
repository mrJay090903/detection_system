"use client"

import { useState, useEffect, Suspense } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Sparkles, 
  FileText, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  Lightbulb,
  BookOpen
} from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"

function AnalysisReportsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')
  const [analysis, setAnalysis] = useState<string>("")
  const [activeTab, setActiveTab] = useState('overview')
  const [userTitle, setUserTitle] = useState('')
  const [existingTitle, setExistingTitle] = useState('')
  const [userConcept, setUserConcept] = useState('')
  const [aiLexicalSimilarity, setAiLexicalSimilarity] = useState<number | null>(null)
  const [aiSemanticSimilarity, setAiSemanticSimilarity] = useState<number | null>(null)
  const [aiOverallSimilarity, setAiOverallSimilarity] = useState<number | null>(null)
  const [error, setError] = useState<{ message: string; details?: string; isQuotaError?: boolean; retryAfter?: number } | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const lexicalSimilarity = parseFloat(searchParams.get('lexicalSimilarity') || '0')
  const semanticSimilarity = parseFloat(searchParams.get('semanticSimilarity') || '0')
  const overallSimilarity = parseFloat(searchParams.get('overallSimilarity') || '0')

  // Use AI similarities if available, otherwise fall back to algorithmic ones
  // Blend AI and algorithmic similarities so the AI-reported percentage stays close to the underlying algorithm
  // If the AI value is missing, fall back to the algorithm; if it deviates significantly, return a conservative blend.
  function blendSimilarity(aiValue: number | null, algoValue: number): number {
    if (aiValue === null || aiValue === undefined) return algoValue
    const ai = Math.max(0, Math.min(1, aiValue))
    const algo = Math.max(0, Math.min(1, algoValue))

    const diff = Math.abs(ai - algo)
    // If within 5 percentage points, trust the AI directly
    if (diff <= 0.05) return ai

    // If AI is substantially higher than algorithm, bias toward the algorithm (reduce the AI percentage)
    if (ai > algo) {
      return Math.max(0, Math.min(1, ai * 0.4 + algo * 0.6))
    }

    // If AI is substantially lower than algorithm, bias toward the algorithm as well (avoid underreporting)
    return Math.max(0, Math.min(1, ai * 0.6 + algo * 0.4))
  }

  // Prefer direct AI-reported percentages when available. Otherwise fall back to blended values.
  const displayLexical = (aiLexicalSimilarity !== null && aiLexicalSimilarity !== undefined)
    ? aiLexicalSimilarity
    : blendSimilarity(aiLexicalSimilarity, lexicalSimilarity)

  const displaySemantic = (aiSemanticSimilarity !== null && aiSemanticSimilarity !== undefined)
    ? aiSemanticSimilarity
    : blendSimilarity(aiSemanticSimilarity, semanticSimilarity)

  const displayOverall = (aiOverallSimilarity !== null && aiOverallSimilarity !== undefined)
    ? aiOverallSimilarity
    : blendSimilarity(aiOverallSimilarity, overallSimilarity)

  const metrics = {
    lexical: { 
      score: displayLexical * 100, 
      label: 'Text Similarity (Lexical)', 
      description: 'Cosine similarity - word/phrase overlap including methodology & tech stack',
      status: (displayLexical * 100) < 30 ? 'low' : (displayLexical * 100) < 60 ? 'medium' : 'high',
      color: (displayLexical * 100) < 30 ? 'bg-blue-500' : (displayLexical * 100) < 60 ? 'bg-blue-600' : 'bg-blue-700'
    },
    semantic: { 
      score: displaySemantic * 100, 
      label: 'Concept Similarity (AI Semantic)', 
      description: 'AI evaluation of core research problem similarity',
      status: (displaySemantic * 100) < 15 ? 'low' : (displaySemantic * 100) < 30 ? 'medium' : 'high',
      color: (displaySemantic * 100) < 15 ? 'bg-green-500' : (displaySemantic * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    overall: { 
      score: displayOverall * 100, 
      label: 'Overall Assessment', 
      description: 'Reflects concept similarity per academic standards',
      status: (displayOverall * 100) < 15 ? 'low' : (displayOverall * 100) < 30 ? 'medium' : 'high',
      color: (displayOverall * 100) < 15 ? 'bg-blue-600' : (displayOverall * 100) < 30 ? 'bg-amber-500' : 'bg-red-600'
    }
  }

  // Parse AI analysis into sections
  const parseAnalysis = (text: string) => {
    const sections: any = {
      proposedResearch: '',
      existingResearch: '',
      problemComparison: '',
      textSimilarity: '',
      conceptSimilarity: '',
      acceptanceStatus: '',
      justification: '',
      finalVerdict: '',
      breakdown: '',
      breakdownTotal: '',
      breakdownInferredTotal: '',
      problemIdentityCheck: '',
      detailedComparison: '',
      similarityAnalysis: '',
      recommendations: ''
    }

    // Extract Proposed Research
    const proposedMatch = text.match(/Proposed Research:\s*([\s\S]+?)(?=\n\nExisting Research:|\nExisting Research:)/i)
    if (proposedMatch) sections.proposedResearch = proposedMatch[1].trim()

    // Extract Existing Research
    const existingMatch = text.match(/Existing Research:\s*([\s\S]+?)(?=\n\nProblem Comparison Result:|\nProblem Comparison Result:)/i)
    if (existingMatch) sections.existingResearch = existingMatch[1].trim()

    // Extract Problem Comparison Result
    const comparisonMatch = text.match(/Problem Comparison Result:\s*(SAME|DIFFERENT)/i)
    if (comparisonMatch) sections.problemComparison = comparisonMatch[1].toUpperCase()

    // Extract Text Similarity
    const textSimMatch = text.match(/Cosine Similarity \(Textual\):\s*(\d+(?:\.\d+)?)\s*%/i)
    if (textSimMatch) sections.textSimilarity = textSimMatch[1] + '%'

    // Extract Concept Similarity - Try multiple patterns
    let conceptSimMatch = text.match(/Final Conceptual Similarity:\s*(\d+(?:\.\d+)?)\s*%/i)
    if (!conceptSimMatch) {
      // Try alternative patterns
      conceptSimMatch = text.match(/Conceptual Similarity:\s*(\d+(?:\.\d+)?)\s*%/i) ||
                        text.match(/Concept Similarity:\s*(\d+(?:\.\d+)?)\s*%/i) ||
                        text.match(/Final Concept Similarity:\s*(\d+(?:\.\d+)?)\s*%/i) ||
                        text.match(/conceptSimilarityPct['":\s]*(\d+(?:\.\d+)?)/i)
    }
    if (conceptSimMatch) sections.conceptSimilarity = conceptSimMatch[1] + '%'

    // Extract Acceptance Status
    const acceptanceMatch = text.match(/Acceptance Status:\s*(ACCEPTABLE|ACCEPTED|REJECTED|REVIEW|APPROVED)/i)
    if (acceptanceMatch) sections.acceptanceStatus = acceptanceMatch[1].toUpperCase()

    // Extract Justification
    const justificationMatch = text.match(/Justification:\s*([\s\S]+?)(?=\n\nFinal Verdict:|\nFinal Verdict:)/i)
    if (justificationMatch) sections.justification = justificationMatch[1].trim()

    // Extract Final Verdict
    const verdictMatch = text.match(/Final Verdict:\s*(.+?)(?=\n\n|BREAKDOWN|$)/i)
    if (verdictMatch) sections.finalVerdict = verdictMatch[1].trim()

    // Extract Breakdown
    const breakdownMatch = text.match(/BREAKDOWN[\s\S]+?(?=\n\nADDITIONAL ANALYSIS:|\nADDITIONAL ANALYSIS:|$)/i)
    if (breakdownMatch) {
      const breakdownText = breakdownMatch[0].trim()
      sections.breakdown = breakdownText

      // Try to extract an explicit total or overall percentage from the breakdown (e.g., "Total: 12%" or "Overall: 12%")
      const breakdownTotalMatch = breakdownText.match(/(?:total|overall)(?:\s*[:\-\s]+)?(\d+(?:\.\d+)?)\s*%/i)
      if (breakdownTotalMatch) {
        sections.breakdownTotal = breakdownTotalMatch[1] + '%'
      }

      // If the breakdown contains line items with percentages, attempt a simple sum fallback
      // (Use caution: this is a naive approach and only used if no explicit total is present)
      if (!sections.breakdownTotal) {
        const itemPercents = [...breakdownText.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => parseFloat(m[1]))
        if (itemPercents.length > 0) {
          const sum = itemPercents.reduce((a, b) => a + b, 0)
          // If sum looks reasonable (<= 100), expose it as an inferred total
          if (sum > 0 && sum <= 100) {
            sections.breakdownInferredTotal = sum + '%'
          }
        }
      }
    }

    // Extract Problem Identity Check
    const identityMatch = text.match(/Problem Identity Check:[\s\S]+?Core Problem Overlap:\s*\d+\s*%/i)
    if (identityMatch) sections.problemIdentityCheck = identityMatch[0].trim()

    // Extract Detailed Comparison
    const detailedMatch = text.match(/Detailed Comparison:[\s\S]+?(?=\n\nSimilarity Analysis:|\nSimilarity Analysis:)/i)
    if (detailedMatch) sections.detailedComparison = detailedMatch[0].trim()

    // Extract Similarity Analysis
    const analysisMatch = text.match(/Similarity Analysis:[\s\S]+?(?=\n\nRecommendations:|\nRecommendations:)/i)
    if (analysisMatch) sections.similarityAnalysis = analysisMatch[0].trim()

    // Extract Recommendations
    const recommendationsMatch = text.match(/Recommendations:\s*([\s\S]+?)$/i)
    if (recommendationsMatch) sections.recommendations = recommendationsMatch[1].trim()

    // FALLBACK: If concept similarity is still empty, try to find any percentage value
    // that might be the concept similarity (look for patterns near "concept" or "similarity")
    if (!sections.conceptSimilarity) {
      // Look for patterns like "concept similarity: 10%" or "conceptual similarity: 10%"
      const fallbackMatch = text.match(/(?:concept(?:ual)?\s*similarity|similarity\s*\(concept(?:ual)?\))[\s:]*(\d+(?:\.\d+)?)\s*%/i)
      if (fallbackMatch) {
        sections.conceptSimilarity = fallbackMatch[1] + '%'
        console.log('📊 Found concept similarity via fallback:', sections.conceptSimilarity)
      } else {
        console.warn('⚠️ Could not find concept similarity in analysis text')
      }
    } else {
      console.log('✅ Found concept similarity:', sections.conceptSimilarity)
    }

    // FALLBACK: If text similarity is still empty, try to find cosine similarity
    if (!sections.textSimilarity) {
      const fallbackTextMatch = text.match(/(?:cosine|text(?:ual)?)\s*similarity[\s:]*(\d+(?:\.\d+)?)\s*%/i)
      if (fallbackTextMatch) {
        sections.textSimilarity = fallbackTextMatch[1] + '%'
        console.log('📊 Found text similarity via fallback:', sections.textSimilarity)
      } else {
        console.warn('⚠️ Could not find text similarity in analysis text')
      }
    } else {
      console.log('✅ Found text similarity:', sections.textSimilarity)
    }

    return sections
  }

  // Clean up any remaining markdown formatting
  const cleanText = (text: string) => {
    return text
      .replace(/\*\*/g, '')  // Remove bold markers
      .replace(/##\s*/g, '')  // Remove heading markers
      .replace(/\*/g, '')     // Remove italic markers
      .replace(/^\s*-\s*/gm, '• ') // Convert dashes to bullets
  }

  // Extract proposed title from document content
  const extractProposedTitle = (text: string): string | null => {
    const patterns = [
      /Proposed Title:\s*([^\n\r]+)/i,
      /Title:\s*([^\n\r]+)/i,
      /Research Title:\s*([^\n\r]+)/i,
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        // Extract and clean the title, limit to 500 chars
        let title = match[1].trim()
          .split(/[\n\r]/)[0]  // Take only first line
        
        // Remove 'BU Thematic Area:' prefix if present
        title = title.replace(/^bu thematic area:\s*/i, '').trim()
        
        // Stop capturing at BU Thematic Area if it appears later
        const buThematicIndex = title.toLowerCase().indexOf('bu thematic area')
        if (buThematicIndex !== -1) {
          title = title.substring(0, buThematicIndex).trim()
        }
        
        title = title
          .substring(0, 500)   // Limit to 500 chars
          .trim()
        // Remove any trailing punctuation except periods at the end of sentences
        title = title.replace(/[,;:]\s*$/, '')
        // Remove any extra whitespace
        title = title.replace(/\s+/g, ' ')
        // Remove any markdown or special formatting
        title = title.replace(/[*_~`]/g, '')
        return title || null
      }
    }
    
    return null
  }

  const sections = analysis ? parseAnalysis(analysis) : null

  // If the breakdown contains an explicit total, prefer it for the displayed overall similarity
  useEffect(() => {
    if (!sections) return

    // If the breakdown has an explicit total, use it to set the AI overall similarity
    const breakdownTotalStr = (sections.breakdownTotal || sections.breakdownInferredTotal || '').toString()
    if (breakdownTotalStr) {
      const parsed = parseFloat(breakdownTotalStr.replace('%', ''))
      if (!isNaN(parsed)) {
        const parsedNormalized = Math.max(0, Math.min(1, parsed / 100))
        if (aiOverallSimilarity === null || Math.abs((aiOverallSimilarity || 0) - parsedNormalized) > 0.01) {
          console.log('Using breakdown total for overall similarity:', parsed + '%')
          setAiOverallSimilarity(parsedNormalized)
        }
      }
    }
  }, [sections])

  const extractedTitle = userConcept ? extractProposedTitle(userConcept) : null
  const displayTitle = extractedTitle || userTitle || 'Research Document'

  // FALLBACK: If AI didn't provide concept similarity in API response, extract from parsed text
  useEffect(() => {
    if (sections?.conceptSimilarity && (aiSemanticSimilarity === null || aiSemanticSimilarity === 0)) {
      const parsedValue = parseFloat(sections.conceptSimilarity) / 100
      if (!isNaN(parsedValue) && parsedValue > 0) {
        console.log('📊 Using concept similarity from parsed text:', parsedValue)
        setAiSemanticSimilarity(parsedValue)
      }
    }
  }, [sections, aiSemanticSimilarity])

  useEffect(() => {
    // Progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        const increment = Math.random() * 15 + 5
        return Math.min(prev + increment, 90)
      })
    }, 800)

    // Update loading messages
    const messageTimeout1 = setTimeout(() => setLoadingMessage('Analyzing research content...'), 2000)
    const messageTimeout2 = setTimeout(() => setLoadingMessage('Comparing with existing research...'), 5000)
    const messageTimeout3 = setTimeout(() => setLoadingMessage('Generating AI insights...'), 8000)
    const messageTimeout4 = setTimeout(() => setLoadingMessage('Finalizing analysis...'), 12000)

    const loadAnalysis = async () => {
      try {
        setProgress(10)
        setLoadingMessage('Loading your research data...')
        
        // Try to get data from sessionStorage first (for long text support)
        const aiAnalysisDataStr = sessionStorage.getItem('aiAnalysisData')
        let userTitleData, userConcept, existingTitleData, existingThesisBrief, lexicalSimilarityStr, semanticSimilarityStr, overallSimilarityStr

        if (aiAnalysisDataStr) {
          // Get data from sessionStorage and clear it
          const aiAnalysisData = JSON.parse(aiAnalysisDataStr)
          userTitleData = aiAnalysisData.userTitle
          userConcept = aiAnalysisData.userConcept
          existingTitleData = aiAnalysisData.existingTitle
          existingThesisBrief = aiAnalysisData.existingThesisBrief
          lexicalSimilarityStr = aiAnalysisData.lexicalSimilarity
          semanticSimilarityStr = aiAnalysisData.semanticSimilarity
          overallSimilarityStr = aiAnalysisData.overallSimilarity
          sessionStorage.removeItem('aiAnalysisData')
        } else {
          // Fallback to URL params (for backward compatibility)
          userTitleData = searchParams.get('userTitle')
          userConcept = searchParams.get('userConcept')
          existingTitleData = searchParams.get('existingTitle')
          existingThesisBrief = searchParams.get('existingThesisBrief')
          lexicalSimilarityStr = searchParams.get('lexicalSimilarity')
          semanticSimilarityStr = searchParams.get('semanticSimilarity')
          overallSimilarityStr = searchParams.get('overallSimilarity')
        }

        if (!userTitleData || !userConcept || !existingTitleData || !existingThesisBrief) {
          console.error('Missing required data for analysis report:', {
            hasUserTitle: !!userTitleData,
            hasUserConcept: !!userConcept,
            hasExistingTitle: !!existingTitleData,
            hasExistingThesisBrief: !!existingThesisBrief,
            userConceptLength: userConcept?.length || 0,
            existingThesisBriefLength: existingThesisBrief?.length || 0,
            fromSessionStorage: !!aiAnalysisDataStr
          })
          toast.error('Missing required data. Please go back and ensure you uploaded a file or entered all required information.')
          router.push('/research-check')
          return
        }

        // Set titles for display
        setUserTitle(userTitleData)
        setExistingTitle(existingTitleData)
        setUserConcept(userConcept)

        const response = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userTitle: userTitleData,
            userConcept,
            existingTitle: existingTitleData,
            existingThesisBrief,
            lexicalSimilarity: parseFloat(lexicalSimilarityStr || '0'),
            semanticSimilarity: parseFloat(semanticSimilarityStr || '0'),
            overallSimilarity: parseFloat(overallSimilarityStr || '0'),
          }),
        })

        if (!response.ok) {
          let errorData: any = {}
          let rawResponseText = ''
          
          try {
            // First, get the raw text
            rawResponseText = await response.text()
            // Try to parse it as JSON
            if (rawResponseText) {
              errorData = JSON.parse(rawResponseText)
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
            console.error('Raw response text:', rawResponseText)
          }
          
          console.error('AI Analysis API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            rawResponse: rawResponseText.substring(0, 500) // Log first 500 chars
          })
          
          // Handle quota errors specifically
          if (response.status === 429 || errorData.isQuotaError) {
            const retryAfter = errorData.retryAfter || 60;
            const friendlyMessage = errorData.message || 
              'The AI analysis service has reached its daily usage limit. Please try again later (typically resets every 24 hours).';
            
            // Clear progress indicators
            clearInterval(progressInterval)
            clearTimeout(messageTimeout1)
            clearTimeout(messageTimeout2)
            clearTimeout(messageTimeout3)
            clearTimeout(messageTimeout4)
            
            setError({
              message: friendlyMessage,
              details: errorData.details || 'API quota exceeded. This typically resets every 24 hours.',
              isQuotaError: true,
              retryAfter: retryAfter
            })
            setIsLoading(false)
            return
          }
          
          const errorMessage = errorData.message || errorData.error || errorData.details || 
                             rawResponseText.substring(0, 200) ||
                             `Server error (${response.status}): ${response.statusText}`
          
          // Clear progress indicators
          clearInterval(progressInterval)
          clearTimeout(messageTimeout1)
          clearTimeout(messageTimeout2)
          clearTimeout(messageTimeout3)
          clearTimeout(messageTimeout4)
          
          setError({
            message: 'AI Analysis Failed',
            details: errorMessage
          })
          setIsLoading(false)
          return
        }

        const data = await response.json()
        setAnalysis(data.analysis)
        
        // Set AI-calculated similarities if available
        if (data.aiSimilarities) {
          if (data.aiSimilarities.lexical !== null) setAiLexicalSimilarity(data.aiSimilarities.lexical)
          if (data.aiSimilarities.semantic !== null) setAiSemanticSimilarity(data.aiSimilarities.semantic)
          if (data.aiSimilarities.overall !== null) setAiOverallSimilarity(data.aiSimilarities.overall)
        }
        
        // Complete progress
        setProgress(100)
        setLoadingMessage('Analysis complete!')
        
        // Clear intervals and timeouts
        clearInterval(progressInterval)
        clearTimeout(messageTimeout1)
        clearTimeout(messageTimeout2)
        clearTimeout(messageTimeout3)
        clearTimeout(messageTimeout4)
        
        setTimeout(() => setIsLoading(false), 500)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        console.error('Error generating AI analysis:', {
          error,
          message: errorMessage,
          type: error instanceof Error ? error.constructor.name : typeof error
        })
        
        // Clear progress indicators
        clearInterval(progressInterval)
        clearTimeout(messageTimeout1)
        clearTimeout(messageTimeout2)
        clearTimeout(messageTimeout3)
        clearTimeout(messageTimeout4)
        
        setIsLoading(false)
        setError({
          message: 'AI Analysis Failed',
          details: errorMessage
        })
      }
    }

    loadAnalysis()
  }, [searchParams, router, retryCount])

  const handleRetry = () => {
    setError(null)
    setIsLoading(true)
    setProgress(0)
    setRetryCount(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white border border-gray-200 shadow">
                <Image src="/assets/bu-logo.png" width={40} height={40} alt="BU Logo" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Analysis Report</h1>
                <p className="text-sm text-slate-500">Powered by Gemini AI</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push('/research-check')} className="gap-2 hover:bg-slate-100">
              <ArrowLeft className="w-4 h-4" />
              Back to Results
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-12 border border-red-100"
          >
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <AlertTriangle className="w-20 h-20 text-red-500 mx-auto" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">{error.message}</h2>
              <p className="text-slate-600 mb-6">{error.details}</p>
              
              {error.isQuotaError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto">
                  <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5" />
                    API Quota Exceeded
                  </h3>
                  <p className="text-sm text-amber-800 mb-3">
                    The AI service has reached its usage limits. This typically happens when:
                  </p>
                  <ul className="text-sm text-amber-800 list-disc list-inside space-y-1 mb-4">
                    <li>Daily API quota has been exhausted</li>
                    <li>Too many requests in a short period</li>
                    <li>All configured AI models (OpenAI & Gemini) are unavailable</li>
                  </ul>
                  <p className="text-sm text-amber-800 font-medium">
                    {error.retryAfter ? `Please retry in approximately ${error.retryAfter} seconds.` : 'API quotas typically reset every 24 hours.'}
                  </p>
                </div>
              )}

              {!error.isQuotaError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5" />
                    Analysis Error
                  </h3>
                  <p className="text-sm text-red-800 mb-3">
                    The AI analysis encountered an error. This may be due to:
                  </p>
                  <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                    <li>Temporary service unavailability</li>
                    <li>Network connectivity issues</li>
                    <li>Invalid or incomplete research data</li>
                    <li>AI model configuration problems</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleRetry}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Retry Analysis
                </Button>
                <Button
                  onClick={() => router.push('/research-check')}
                  variant="outline"
                  size="lg"
                  className="px-8"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
              
              {retryCount > 0 && (
                <p className="text-sm text-slate-500 mt-4">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>
          </motion.div>
        ) : isLoading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-slate-200">
            <div className="mb-6">
             
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Generating Advanced AI Analysis</h2>
            <p className="text-slate-600 text-lg mb-6">{loadingMessage}</p>
            
            {/* Progress Bar */}
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">Analysis Progress</span>
                <span className="text-lg font-bold text-purple-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 transition-all duration-500 ease-out rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-4">This process may take 30-60 seconds depending on content length</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Analysis Summary</h2>
                </div>
                <p className="text-indigo-100 text-sm">AI-powered comparison of your research with existing work</p>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                
              
                </div>
                
                {/* AI Overall Similarity Percentage */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-semibold text-slate-900 mb-1 text-lg">AI Overall Similarity Percentage</h3>
                      <p className="text-sm text-slate-600">
                        {(displayOverall * 100) < 15 
                          ? "✓ Your research shows good originality with minimal overlap."
                          : (displayOverall * 100) < 30
                          ? "⚠ Some similarities detected. Review the recommendations below."
                          : "⚠ Significant similarities found. Revision strongly recommended."}
                      </p>
                    </div>
                    <div className={`px-6 py-3 rounded-xl font-bold text-2xl shadow-lg ${
                      (displayOverall * 100) < 15 ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                      (displayOverall * 100) < 30 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                      'bg-red-100 text-red-700 border-2 border-red-300'
                    }`}>
                      {(displayOverall * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Your Research Document Preview - Document Viewer Style */}
            {userConcept && userConcept.length > 100 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden"
              >
                {/* Document Header - File Manager Style */}
                <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-6 py-4 border-b border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-white">Your Research Document</h2>
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">ANALYZED</span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-300">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {userConcept.length.toLocaleString()} chars
                          </span>
                          <span>•</span>
                          <span>{Math.ceil(userConcept.split(/\s+/).length).toLocaleString()} words</span>
                          <span>•</span>
                          <span>{Math.ceil(userConcept.split(/\s+/).length / 200)} min read</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">AI Verified</span>
                    </div>
                  </div>
                </div>
                
                {/* Document Content - Paper Style */}
                <div className="p-8">
                  {/* Paper Container */}
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Paper Header with Lines */}
                    <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                    
                    {/* Document Content Area */}
                    <div className="p-10 max-h-[600px] overflow-y-auto" style={{ 
                      backgroundImage: 'linear-gradient(to bottom, transparent 95%, rgba(148, 163, 184, 0.1) 95%)',
                      backgroundSize: '100% 24px'
                    }}>
                      {/* Document Title */}
                      <div className="mb-6 pb-4 border-b-2 border-slate-200">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">{displayTitle}</h3>
                        {extractedTitle && (
                          <p className="text-xs text-indigo-600 font-medium mb-2">✓ Title extracted from document</p>
                        )}
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>Submitted for analysis</span>
                          <span>•</span>
                          <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                      </div>
                      
                      {/* Document Text */}
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-800 text-base leading-loose whitespace-pre-wrap font-serif" style={{ textAlign: 'justify', textIndent: '2em' }}>
                          {userConcept.substring(0, 3000)}
                          {userConcept.length > 3000 && (
                            <span className="text-slate-400 italic not-italic font-sans text-sm">
                              {' '}... (showing first 3000 characters of document)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Paper Footer */}
                    <div className="h-2 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200"></div>
                  </div>
                  
                  {/* Document Info Footer */}
                  <div className="mt-6 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-indigo-700 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span>This content was successfully analyzed by AI</span>
                    </div>
                    {userConcept.length > 3000 && (
                      <span className="text-slate-500">Full document: {userConcept.length.toLocaleString()} characters</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Metrics Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {Object.entries(metrics).map(([key, data]) => (
                <div key={key} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{data.label}</span>
                    {data.status === 'low' ? 
                      <CheckCircle className="w-5 h-5 text-green-500" /> : 
                      data.status === 'medium' ?
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> :
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    }
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-4xl font-bold text-slate-900">{data.score.toFixed(1)}%</span>
                    <span className="text-sm text-slate-400 mb-2">match found</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(data.score, 100)}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className={`h-3 rounded-full ${data.color} shadow-sm`}
                    ></motion.div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Main Content Area with Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Column: Navigation */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 px-2">Report Sections</h3>
                  <nav className="flex flex-col gap-2">
                    <button 
                      onClick={() => setActiveTab('overview')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'overview' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> Quick Overview
                    </button>
                    <button 
                      onClick={() => setActiveTab('comparison')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'comparison' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" /> Problem Comparison
                    </button>
                    <button 
                      onClick={() => setActiveTab('analysis')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'analysis' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" /> Similarity Analysis
                    </button>
                    <button 
                      onClick={() => setActiveTab('detailed')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'detailed' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-4 h-4" /> Detailed Breakdown
                    </button>
                    <button 
                      onClick={() => setActiveTab('recommendations')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'recommendations' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4" /> Recommendations
                    </button>
                  </nav>
                </div>
              </div>

              {/* Right Column: Dynamic Content */}
              <div className="lg:col-span-2">
                {!sections && (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
                    <p className="text-slate-600">No analysis data available</p>
                  </div>
                )}

                {/* TAB: OVERVIEW */}
                {sections && activeTab === 'overview' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Final Verdict Card */}
                    <div className={`rounded-2xl shadow-lg border-2 overflow-hidden ${
                      sections.problemComparison === 'DIFFERENT' 
                        ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                        : 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50'
                    }`}>
                      <div className={`px-6 py-5 ${
                        sections.problemComparison === 'DIFFERENT'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600'
                      }`}>
                        <div className="flex items-center gap-3 text-white">
                          {sections.problemComparison === 'DIFFERENT' ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : (
                            <AlertTriangle className="w-6 h-6" />
                          )}
                          <h3 className="text-xl font-bold">Final Verdict</h3>
                        </div>
                      </div>
                      <div className="p-8">
                        <p className="text-2xl font-bold text-slate-900 mb-4">{sections.finalVerdict}</p>
                        <div className="flex items-center gap-4 mb-6 flex-wrap">
                          <div className="px-4 py-2 bg-white rounded-lg shadow border border-slate-200">
                            <span className="text-sm text-slate-600">Problem Comparison:</span>
                            <span className={`ml-2 font-bold ${
                              sections.problemComparison === 'DIFFERENT' ? 'text-green-600' : 'text-amber-600'
                            }`}>{sections.problemComparison}</span>
                          </div>
                          {sections.acceptanceStatus && (
                            <div className={`px-4 py-2 rounded-lg shadow border-2 ${
                              sections.acceptanceStatus === 'ACCEPTABLE' || sections.acceptanceStatus === 'ACCEPTED' || sections.acceptanceStatus === 'APPROVED' || sections.acceptanceStatus === 'REVIEW'
                                ? 'bg-green-100 border-green-600 text-green-900'
                                : 'bg-red-100 border-red-600 text-red-900'
                            }`}>
                              <span className="text-sm font-semibold">Status:</span>
                              <span className="ml-2 font-bold">
                                {(sections.acceptanceStatus === 'ACCEPTABLE' || sections.acceptanceStatus === 'ACCEPTED' || sections.acceptanceStatus === 'APPROVED' || sections.acceptanceStatus === 'REVIEW') ? 'ACCEPTABLE' : sections.acceptanceStatus}
                              </span>
                            </div>
                          )}
                        </div>
                        {sections.acceptanceStatus && (
                          <div className={`mt-4 p-4 rounded-lg border-l-4 ${
                            sections.acceptanceStatus === 'ACCEPTABLE' || sections.acceptanceStatus === 'ACCEPTED' || sections.acceptanceStatus === 'APPROVED' || sections.acceptanceStatus === 'REVIEW'
                              ? 'bg-green-50 border-green-600'
                              : 'bg-red-50 border-red-600'
                          }`}>
                            <p className="text-sm font-medium">
                              {(sections.acceptanceStatus === 'ACCEPTABLE' || sections.acceptanceStatus === 'ACCEPTED' || sections.acceptanceStatus === 'APPROVED' || sections.acceptanceStatus === 'REVIEW') && '✓ Research ACCEPTABLE: Concept similarity is not more than 15%'}
                              {sections.acceptanceStatus === 'REJECTED' && '✗ Research REJECTED: Concept similarity exceeds 15% threshold - potential plagiarism'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Similarity Scores Card */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <BarChart3 className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Similarity Scores</h3>
                        </div>
                      </div>
                      <div className="p-8 grid md:grid-cols-2 gap-6">
                        <div className="p-6 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                          <div className="text-sm text-blue-700 font-semibold mb-2">Text Similarity (Lexical)</div>
                          <div className="text-4xl font-bold text-blue-900">{sections.textSimilarity || '0%'}</div>
                          <p className="text-sm text-blue-600 mt-2">Word & phrase overlap including methodology</p>
                        </div>
                        <div className={`p-6 rounded-xl border-l-4 ${
                          parseFloat(sections.conceptSimilarity || '0') <= 15
                            ? 'bg-green-50 border-green-500'
                            : 'bg-red-50 border-red-500'
                        }`}>
                          <div className={`text-sm font-semibold mb-2 ${
                            parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-700' : 'text-red-700'
                          }`}>Concept Similarity (AI Semantic)</div>
                          <div className={`text-4xl font-bold ${
                            parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-900' : 'text-red-900'
                          }`}>{sections.conceptSimilarity || '0%'}</div>
                          <p className={`text-sm mt-2 ${
                            parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-600' : 'text-red-600'
                          }`}>Core research problem similarity</p>
                        </div>
                      </div>
                    </div>

                    {/* Justification Card */}
                    {sections.justification && (
                      <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                          <div className="flex items-center gap-3 text-white">
                            <FileText className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Justification</h3>
                          </div>
                        </div>
                        <div className="p-8 text-slate-700 leading-8 text-base">
                          {(sections.justification || '').split('\n').map((paragraph: string, idx: number) => (
                            paragraph.trim() && (
                              <p key={idx} className="mb-4 last:mb-0">
                                {paragraph}
                              </p>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: COMPARISON */}
                {sections && activeTab === 'comparison' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <BookOpen className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Core Problem Comparison</h3>
                        </div>
                      </div>
                      <div className="p-8 space-y-6">
                        {/* Proposed Research */}
                        <div className="p-6 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                          <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Proposed Research (Your Submission)
                          </h4>
                          <p className="text-slate-700 leading-7">{sections.proposedResearch}</p>
                        </div>

                        {/* Existing Research */}
                        <div className="p-6 bg-purple-50 rounded-xl border-l-4 border-purple-500">
                          <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Existing Research (From Database)
                          </h4>
                          <p className="text-slate-700 leading-7">{sections.existingResearch}</p>
                        </div>

                        {/* Comparison Result */}
                        <div className={`p-6 rounded-xl border-l-4 ${
                          sections.problemComparison === 'DIFFERENT'
                            ? 'bg-green-50 border-green-500'
                            : 'bg-amber-50 border-amber-500'
                        }`}>
                          <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                            sections.problemComparison === 'DIFFERENT' ? 'text-green-900' : 'text-amber-900'
                          }`}>
                            {sections.problemComparison === 'DIFFERENT' ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <AlertTriangle className="w-5 h-5" />
                            )}
                            Problem Comparison Result
                          </h4>
                          <p className={`text-2xl font-bold ${
                            sections.problemComparison === 'DIFFERENT' ? 'text-green-700' : 'text-amber-700'
                          }`}>{sections.problemComparison}</p>
                        </div>
                      </div>
                    </div>

                    {/* Problem Identity Check */}
                    {sections.problemIdentityCheck && (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5">
                          <div className="flex items-center gap-3 text-white">
                            <Layers className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Problem Identity Check</h3>
                          </div>
                        </div>
                        <div className="p-8">
                          <div className="space-y-3 font-mono text-sm">
                            {(sections.problemIdentityCheck || '').split('\n').map((line: string, idx: number) => (
                              line.trim() && (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="flex-1 text-slate-700">{line}</div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: ANALYSIS */}
                {sections && activeTab === 'analysis' && sections.similarityAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <BarChart3 className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Similarity Analysis</h3>
                        </div>
                      </div>
                      <div className="p-8">
                        <div className="space-y-6">
                          {(sections.similarityAnalysis || '').split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                            const isHeading = line.startsWith('-') && line.includes(':')
                            if (isHeading) {
                              const [heading, ...content] = line.substring(1).split(':')
                              return (
                                <div key={idx} className="space-y-2">
                                  <h4 className="font-bold text-purple-900 text-lg">{heading.trim()}</h4>
                                  <p className="text-slate-700 leading-7 pl-4">{content.join(':').trim()}</p>
                                </div>
                              )
                            }
                            return (
                              <p key={idx} className="text-slate-700 leading-7 pl-4">{line}</p>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: DETAILED */}
                {sections && activeTab === 'detailed' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Detailed Comparison */}
                    {sections.detailedComparison && (
                      <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                          <div className="flex items-center gap-3 text-white">
                            <Layers className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Detailed Comparison</h3>
                          </div>
                        </div>
                        <div className="p-8">
                          <div className="space-y-6">
                            {(sections.detailedComparison || '').split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                              const isMainHeading = line.includes('Research Focus:')
                              const isSubHeading = line.startsWith('-')
                              
                              if (isMainHeading) {
                                return (
                                  <h4 key={idx} className="font-bold text-indigo-900 text-xl mt-6 first:mt-0">
                                    {line.replace(':', '')}
                                  </h4>
                                )
                              } else if (isSubHeading) {
                                const [label, ...content] = line.substring(1).split(':')
                                return (
                                  <div key={idx} className="flex gap-3 p-4 bg-indigo-50 rounded-lg">
                                    <span className="font-semibold text-indigo-700 min-w-[100px]">{label.trim()}:</span>
                                    <span className="text-slate-700 flex-1">{content.join(':').trim()}</span>
                                  </div>
                                )
                              }
                              return null
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Breakdown */}
                    {sections.breakdown && (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5">
                          <div className="flex items-center gap-3 text-white">
                            <BarChart3 className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Similarity Breakdown</h3>
                          </div>
                        </div>
                        <div className="p-8">
                          <div className="space-y-3 font-mono text-sm">
                            {(sections.breakdown || '').split('\n').map((line: string, idx: number) => (
                              line.trim() && (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="flex-1 text-slate-700">{line}</div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: RECOMMENDATIONS */}
                {sections && activeTab === 'recommendations' && sections.recommendations && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-amber-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <Lightbulb className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Recommendations</h3>
                        </div>
                      </div>
                      <div className="p-8 text-slate-700 leading-8 text-base">
                        {(sections.recommendations || '').split('\n').map((paragraph: string, idx: number) => (
                          paragraph.trim() && (
                            <p key={idx} className="mb-4 last:mb-0">
                              {paragraph}
                            </p>
                          )
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AnalysisReportsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
            <div className="absolute inset-0 animate-ping opacity-20">
              <Sparkles className="w-16 h-16 text-purple-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Analysis Report</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    }>
      <AnalysisReportsContent />
    </Suspense>
  )
}
