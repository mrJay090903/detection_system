"use client"

import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
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
  BookOpen,
  Shield,
  TrendingUp,
  Search,
  Target,
  ClipboardList,
  Info,
  Highlighter,
  Eye
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
  const [fieldAssessment, setFieldAssessment] = useState<any>(null)
  const [matchBreakdown, setMatchBreakdown] = useState<any>(null)
  const [textHighlights, setTextHighlights] = useState<any[]>([])
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

    // Extract Field Scores from === FIELD SCORES === section
    const fieldScoresMatch = text.match(/=== FIELD SCORES ===[\s\S]*?Problem\/Need:\s*\[?(\d+(?:\.\d+)?)%/i)
    if (fieldScoresMatch) {
      const pn = text.match(/Problem\/Need:\s*\[?(\d+(?:\.\d+)?)%/i)
      const ob = text.match(/Objectives:\s*\[?(\d+(?:\.\d+)?)%/i)
      const sc = text.match(/Scope\/Context:\s*\[?(\d+(?:\.\d+)?)%/i)
      const io = text.match(/Inputs\/Outputs:\s*\[?(\d+(?:\.\d+)?)%/i)
      sections.fieldScores = {
        problemNeed: pn ? parseFloat(pn[1]) : null,
        objectives: ob ? parseFloat(ob[1]) : null,
        scopeContext: sc ? parseFloat(sc[1]) : null,
        inputsOutputs: io ? parseFloat(io[1]) : null
      }
    }

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

    // Extract Recommendations (stop before TEXT MATCH HIGHLIGHTS or end)
    const recommendationsMatch = text.match(/Recommendations:\s*([\s\S]+?)(?=\n=== TEXT MATCH HIGHLIGHTS|TEXT MATCH HIGHLIGHTS|$)/i)
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

  // If the API didn't return an overall similarity, try inferring one from the AI breakdown text
  useEffect(() => {
    if (!sections) return
    // Only use this as a last-resort fallback — do NOT override the value already set from the API
    if (aiOverallSimilarity !== null && aiOverallSimilarity !== undefined) return

    const breakdownTotalStr = (sections.breakdownTotal || sections.breakdownInferredTotal || '').toString()
    if (breakdownTotalStr) {
      const parsed = parseFloat(breakdownTotalStr.replace('%', ''))
      if (!isNaN(parsed)) {
        const parsedNormalized = Math.max(0, Math.min(1, parsed / 100))
        console.log('Fallback: using breakdown total for overall similarity:', parsed + '%')
        setAiOverallSimilarity(parsedNormalized)
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
        
        // Set 4-field assessment if available
        if (data.fieldAssessment) {
          setFieldAssessment(data.fieldAssessment)
        }
        
        // Set match breakdown if available
        if (data.matchBreakdown) {
          setMatchBreakdown(data.matchBreakdown)
        }
        
        // Set text highlights if available
        if (data.textHighlights) {
          setTextHighlights(data.textHighlights)
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
                {/* Research Titles */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Your Research</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 leading-relaxed line-clamp-3">{userTitle || 'Untitled Research'}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Compared With</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 leading-relaxed line-clamp-3">{existingTitle || 'Existing Research'}</p>
                  </div>
                </div>
                
                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-2xl font-bold text-blue-700">{(displayLexical * 100).toFixed(0)}%</div>
                    <div className="text-xs text-slate-500 mt-1">Text Similarity</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className={`text-2xl font-bold ${(displaySemantic * 100) < 15 ? 'text-green-700' : (displaySemantic * 100) < 30 ? 'text-amber-700' : 'text-red-700'}`}>{(displaySemantic * 100).toFixed(0)}%</div>
                    <div className="text-xs text-slate-500 mt-1">Concept Similarity</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg border ${
                    (displayOverall * 100) < 15 ? 'bg-green-50 border-green-200' :
                    (displayOverall * 100) < 30 ? 'bg-amber-50 border-amber-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      (displayOverall * 100) < 15 ? 'text-green-700' :
                      (displayOverall * 100) < 30 ? 'text-amber-700' :
                      'text-red-700'
                    }`}>{(displayOverall * 100).toFixed(1)}%</div>
                    <div className="text-xs text-slate-500 mt-1">Overall Score</div>
                  </div>
                </div>
                
                {/* Verdict Banner */}
                <div className={`flex items-center gap-3 p-4 rounded-xl ${
                  (displayOverall * 100) < 15 
                    ? 'bg-green-50 border border-green-200' 
                    : (displayOverall * 100) < 30 
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {(displayOverall * 100) < 15 ? (
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <p className="text-sm font-medium text-slate-700">
                    {(displayOverall * 100) < 15 
                      ? "Your research shows good originality with minimal overlap. Proceed with confidence."
                      : (displayOverall * 100) < 30
                      ? "Some similarities detected. Review the detailed sections below for guidance."
                      : "Significant similarities found. Revision is strongly recommended before submission."}
                  </p>
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
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {Object.entries(metrics).map(([key, data]) => (
                <div key={key} className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">{data.label}</span>
                    {data.status === 'low' ? 
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : 
                      data.status === 'medium' ?
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> :
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    }
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-bold text-slate-900">{data.score.toFixed(1)}%</span>
                    <span className={`text-xs font-medium mb-1 px-2 py-0.5 rounded-full ${
                      data.status === 'low' ? 'bg-green-100 text-green-700' :
                      data.status === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {data.status === 'low' ? 'Low' : data.status === 'medium' ? 'Medium' : 'High'}
                    </span>
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
                  <nav className="flex flex-col gap-1.5">
                    {[
                      { id: 'overview', icon: <Sparkles className="w-4 h-4" />, label: 'Quick Overview', desc: 'Verdict & key scores' },
                      { id: 'comparison', icon: <BookOpen className="w-4 h-4" />, label: 'Problem Comparison', desc: 'Side-by-side analysis' },
                      { id: 'analysis', icon: <BarChart3 className="w-4 h-4" />, label: 'Similarity Analysis', desc: 'Text & concept breakdown' },
                      { id: 'fields', icon: <Target className="w-4 h-4" />, label: '4-Field Assessment', desc: 'Detailed field scores' },
                      { id: 'detailed', icon: <Search className="w-4 h-4" />, label: 'Match Breakdown', desc: 'External source matches' },
                      { id: 'highlights', icon: <Highlighter className="w-4 h-4" />, label: 'Text Highlights', desc: 'Flagged text passages' },
                      { id: 'recommendations', icon: <Lightbulb className="w-4 h-4" />, label: 'Recommendations', desc: 'Improvement suggestions' },
                    ].map((tab, idx) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                          activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
                        }`}>
                          {tab.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{tab.label}</div>
                          <div className={`text-[11px] truncate ${activeTab === tab.id ? 'text-indigo-100' : 'text-slate-400'}`}>{tab.desc}</div>
                        </div>
                      </button>
                    ))}
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
                    {/* Step 1: Final Verdict */}
                    <div className={`rounded-2xl shadow-lg overflow-hidden ${
                      sections.problemComparison === 'DIFFERENT' 
                        ? 'border border-green-200' 
                        : 'border border-amber-200'
                    }`}>
                      <div className={`px-6 py-4 ${
                        sections.problemComparison === 'DIFFERENT'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600'
                      }`}>
                        <div className="flex items-center gap-3 text-white">
                          <Shield className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Final Verdict</h3>
                        </div>
                      </div>
                      <div className="p-6 bg-white">
                        <p className="text-lg font-bold text-slate-900 mb-4">{sections.finalVerdict}</p>
                        
                        {/* Status Badges */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                            sections.problemComparison === 'DIFFERENT' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {sections.problemComparison === 'DIFFERENT' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            Problem: {sections.problemComparison}
                          </span>
                          
                          {sections.acceptanceStatus && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                              ['ACCEPTABLE', 'ACCEPTED', 'APPROVED', 'REVIEW'].includes(sections.acceptanceStatus)
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {['ACCEPTABLE', 'ACCEPTED', 'APPROVED', 'REVIEW'].includes(sections.acceptanceStatus) 
                                ? <CheckCircle className="w-3.5 h-3.5" /> 
                                : <AlertTriangle className="w-3.5 h-3.5" />}
                              {['ACCEPTABLE', 'ACCEPTED', 'APPROVED', 'REVIEW'].includes(sections.acceptanceStatus) ? 'ACCEPTABLE' : sections.acceptanceStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Similarity Score Cards - Clean Grid */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <BarChart3 className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Similarity Scores</h3>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Text Similarity */}
                          <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-blue-700 font-semibold">Text Similarity</span>
                              <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Lexical</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-900 mb-2">{sections.textSimilarity || '0%'}</div>
                            <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                              <div className="h-2 rounded-full bg-blue-500" style={{ width: sections.textSimilarity || '0%' }}></div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">Measures word and phrase overlap</p>
                          </div>
                          
                          {/* Concept Similarity */}
                          <div className={`p-5 rounded-xl border ${
                            parseFloat(sections.conceptSimilarity || '0') <= 15
                              ? 'bg-green-50 border-green-100'
                              : parseFloat(sections.conceptSimilarity || '0') <= 30
                              ? 'bg-amber-50 border-amber-100'
                              : 'bg-red-50 border-red-100'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-sm font-semibold ${
                                parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-700' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'text-amber-700' : 'text-red-700'
                              }`}>Concept Similarity</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-600 bg-green-100' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'text-amber-600 bg-amber-100' : 'text-red-600 bg-red-100'
                              }`}>AI Semantic</span>
                            </div>
                            <div className={`text-3xl font-bold mb-2 ${
                              parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-900' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'text-amber-900' : 'text-red-900'
                            }`}>{sections.conceptSimilarity || '0%'}</div>
                            <div className={`w-full rounded-full h-2 overflow-hidden ${
                              parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'bg-green-100' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'bg-amber-100' : 'bg-red-100'
                            }`}>
                              <div className={`h-2 rounded-full ${
                                parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'bg-green-500' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'bg-amber-500' : 'bg-red-500'
                              }`} style={{ width: sections.conceptSimilarity || '0%' }}></div>
                            </div>
                            <p className={`text-xs mt-2 ${
                              parseFloat(sections.conceptSimilarity || '0') <= 15 ? 'text-green-600' : parseFloat(sections.conceptSimilarity || '0') <= 30 ? 'text-amber-600' : 'text-red-600'
                            }`}>Core research idea overlap</p>
                          </div>
                        </div>
                        
                        {/* Score Legend */}
                        <div className="mt-4 flex items-center gap-4 justify-center flex-wrap text-xs text-slate-500">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Below 15%: Safe</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 15-30%: Review</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Above 30%: Revise</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Justification */}
                    {sections.justification && (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <ClipboardList className="w-5 h-5" />
                            <h3 className="text-lg font-bold">AI Justification</h3>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="space-y-3">
                            {(sections.justification || '').split('\n').filter((p: string) => p.trim()).map((paragraph: string, idx: number) => (
                              <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                                {paragraph.trim()}
                              </p>
                            ))}
                          </div>
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
                    {/* Side-by-Side Comparison */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <BookOpen className="w-5 h-5" />
                          <div>
                            <h3 className="text-lg font-bold">Core Problem Comparison</h3>
                            <p className="text-indigo-200 text-xs mt-0.5">How the AI summarized each research problem</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* Proposed Research */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Your Proposed Research</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{sections.proposedResearch || 'Not extracted from analysis'}</p>
                        </div>

                        {/* VS Divider */}
                        <div className="flex items-center gap-3 px-4">
                          <div className="flex-1 h-px bg-slate-200"></div>
                          <span className="text-xs font-bold text-slate-400 bg-white px-3">VS</span>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        {/* Existing Research */}
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Existing Research (Database)</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{sections.existingResearch || 'Not extracted from analysis'}</p>
                        </div>

                        {/* Result */}
                        <div className={`flex items-center gap-3 p-4 rounded-xl ${
                          sections.problemComparison === 'DIFFERENT'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-amber-50 border border-amber-200'
                        }`}>
                          {sections.problemComparison === 'DIFFERENT' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <span className="text-xs text-slate-500 font-medium">Comparison Result:</span>
                            <span className={`ml-2 text-sm font-bold ${
                              sections.problemComparison === 'DIFFERENT' ? 'text-green-700' : 'text-amber-700'
                            }`}>{sections.problemComparison || 'UNKNOWN'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Problem Identity Check */}
                    {sections.problemIdentityCheck && (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <Shield className="w-5 h-5" />
                            <h3 className="text-lg font-bold">Problem Identity Check</h3>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="space-y-2">
                            {(sections.problemIdentityCheck || '').split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                              const hasYes = /YES/i.test(line);
                              const hasNo = /NO/i.test(line);
                              const hasPercent = /\d+\s*%/.test(line);
                              return (
                                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                                  hasYes ? 'bg-amber-50 border border-amber-100' : hasNo ? 'bg-green-50 border border-green-100' : hasPercent ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-slate-100'
                                }`}>
                                  {hasYes && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                                  {hasNo && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                                  {!hasYes && !hasNo && <Info className="w-4 h-4 text-indigo-500 shrink-0" />}
                                  <span className="text-slate-700 font-mono text-xs">{line.trim()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: ANALYSIS */}
                {sections && activeTab === 'analysis' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Visual Score Comparison */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <TrendingUp className="w-5 h-5" />
                          <div>
                            <h3 className="text-lg font-bold">Score Comparison</h3>
                            <p className="text-purple-200 text-xs mt-0.5">How text overlap compares to conceptual overlap</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 space-y-5">
                        {/* Text Similarity Bar */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              <span className="text-sm font-semibold text-slate-700">Text Similarity (Lexical)</span>
                            </div>
                            <span className="text-lg font-bold text-blue-700">{(displayLexical * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(displayLexical * 100, 100)}%` }} transition={{ duration: 1 }} className="h-3 rounded-full bg-blue-500" />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Measures word, phrase, and structural overlap between both documents using cosine similarity and TF-IDF.</p>
                        </div>
                        
                        {/* Concept Similarity Bar */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${(displaySemantic * 100) < 15 ? 'bg-green-500' : (displaySemantic * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                              <span className="text-sm font-semibold text-slate-700">Concept Similarity (AI Semantic)</span>
                            </div>
                            <span className={`text-lg font-bold ${(displaySemantic * 100) < 15 ? 'text-green-700' : (displaySemantic * 100) < 30 ? 'text-amber-700' : 'text-red-700'}`}>{(displaySemantic * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(displaySemantic * 100, 100)}%` }} transition={{ duration: 1, delay: 0.2 }} className={`h-3 rounded-full ${(displaySemantic * 100) < 15 ? 'bg-green-500' : (displaySemantic * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'}`} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">AI evaluation of whether the core research problem, goals, and scope are fundamentally the same.</p>
                        </div>
                        
                        {/* Overall Bar */}
                        <div className="pt-3 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${(displayOverall * 100) < 15 ? 'bg-green-600' : (displayOverall * 100) < 30 ? 'bg-amber-600' : 'bg-red-600'}`}></div>
                              <span className="text-sm font-bold text-slate-800">Overall Assessment</span>
                            </div>
                            <span className={`text-xl font-bold ${(displayOverall * 100) < 15 ? 'text-green-700' : (displayOverall * 100) < 30 ? 'text-amber-700' : 'text-red-700'}`}>{(displayOverall * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(displayOverall * 100, 100)}%` }} transition={{ duration: 1.2, delay: 0.4 }} className={`h-4 rounded-full ${(displayOverall * 100) < 15 ? 'bg-green-600' : (displayOverall * 100) < 30 ? 'bg-amber-600' : 'bg-red-600'}`} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Weighted blend: 40% text similarity + 60% concept similarity. Prioritizes conceptual overlap for plagiarism detection.</p>
                        </div>
                      </div>
                    </div>

                    {/* Understanding the Scores */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <Info className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Understanding the Scores</h3>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <h4 className="font-semibold text-blue-800 text-sm mb-2 flex items-center gap-2">
                              <FileText className="w-4 h-4" /> What is Text Similarity?
                            </h4>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              Text similarity (lexical) measures how much the actual words and phrases overlap between both documents. A high score means many similar terms were used, but this does NOT necessarily mean the ideas are the same — shared academic vocabulary and methodology terms can inflate this score.
                            </p>
                          </div>
                          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                            <h4 className="font-semibold text-purple-800 text-sm mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" /> What is Concept Similarity?
                            </h4>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              Concept similarity (semantic) is an AI evaluation of whether both studies address the same core problem, target the same users, and aim for the same deliverables. This is the more important metric — two studies using different words can still be conceptually identical.
                            </p>
                          </div>
                        </div>
                        
                        {/* Interpretation Guide */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="font-semibold text-slate-700 text-sm mb-3">How to Interpret</h4>
                          <div className="space-y-2">
                            <div className="flex items-start gap-3 text-xs">
                              <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">Below 15%</span>
                              <span className="text-slate-600">Your research is clearly different. Safe to proceed with minimal changes.</span>
                            </div>
                            <div className="flex items-start gap-3 text-xs">
                              <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">15% — 30%</span>
                              <span className="text-slate-600">Some overlap detected. Review the specific areas of similarity and consider adjustments.</span>
                            </div>
                            <div className="flex items-start gap-3 text-xs">
                              <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">Above 30%</span>
                              <span className="text-slate-600">Significant similarity. Revision strongly recommended to differentiate your research.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Analysis Text (if AI provided it) */}
                    {sections.similarityAnalysis && (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <BarChart3 className="w-5 h-5" />
                            <h3 className="text-lg font-bold">Detailed Analysis</h3>
                          </div>
                        </div>
                        <div className="p-6 space-y-3">
                          {(sections.similarityAnalysis || '').split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                            const cleaned = line.replace(/^[-•]\s*/, '').trim();
                            const hasColon = cleaned.includes(':') && cleaned.indexOf(':') < 40;
                            if (hasColon) {
                              const [heading, ...rest] = cleaned.split(':');
                              return (
                                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="font-semibold text-slate-800 text-sm">{heading.trim()}:</span>
                                  <span className="text-sm text-slate-600 ml-1">{rest.join(':').trim()}</span>
                                </div>
                              );
                            }
                            return <p key={idx} className="text-sm text-slate-700 leading-relaxed pl-1">{cleaned}</p>;
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: 4-FIELD ASSESSMENT */}
                {sections && activeTab === 'fields' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* 5-Field Scores Overview */}
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-white">
                            <Target className="w-5 h-5" />
                            <div>
                              <h3 className="text-lg font-bold">4-Field Conceptual Assessment</h3>
                              <p className="text-indigo-200 text-xs mt-0.5">Each field scored 0-100% based on conceptual overlap</p>
                            </div>
                          </div>
                          {(fieldAssessment?.average ?? (sections.fieldScores ? Math.round(Object.values(sections.fieldScores as Record<string, number | null>).filter((v): v is number => v !== null).reduce((a: number, b: number) => a + b, 0) / Object.values(sections.fieldScores as Record<string, number | null>).filter((v): v is number => v !== null).length) : null)) !== null && (
                            <div className="text-right">
                              <div className="text-3xl font-bold text-white">
                                {fieldAssessment?.average ?? Math.round(Object.values(sections.fieldScores as Record<string, number | null>).filter((v): v is number => v !== null).reduce((a: number, b: number) => a + b, 0) / Object.values(sections.fieldScores as Record<string, number | null>).filter((v): v is number => v !== null).length)}%
                              </div>
                              <div className="text-indigo-200 text-sm">Average Score</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        {(() => {
                          const scores = fieldAssessment?.scores || sections.fieldScores || {};
                          const proposed = fieldAssessment?.proposed || {};
                          const existing = fieldAssessment?.existing || {};
                          const rationales = fieldAssessment?.rationales || {};
                          
                          const fields = [
                            { 
                              key: 'problemNeed', 
                              label: 'Problem/Need', 
                              icon: '🎯',
                              description: 'What real-world problem or need does the research address?',
                              proposedDetail: proposed.problem || '',
                              existingDetail: existing.problem || '',
                              rationale: rationales.problemNeed || '',
                              scoring: { high: '70-100%: Same core problem', medium: '40-69%: Related but different domains', low: '0-39%: Clearly different problems' }
                            },
                            { 
                              key: 'objectives', 
                              label: 'Objectives', 
                              icon: '🎯',
                              description: 'What are the goals, deliverables, or outcomes?',
                              proposedDetail: proposed.objectives || '',
                              existingDetail: existing.objectives || '',
                              rationale: rationales.objectives || '',
                              scoring: { high: '70-100%: Same system goals', medium: '40-69%: Partially overlapping', low: '0-39%: Completely different' }
                            },
                            { 
                              key: 'scopeContext', 
                              label: 'Scope/Context', 
                              icon: '🏛️',
                              description: 'Target institution, environment, users, or domain',
                              proposedDetail: proposed.scopeContext || '',
                              existingDetail: existing.scopeContext || '',
                              rationale: rationales.scopeContext || '',
                              scoring: { high: '70-100%: Same institution/users', medium: '40-69%: Related departments', low: '0-39%: Completely different context' }
                            },
                            { 
                              key: 'inputsOutputs', 
                              label: 'Inputs/Outputs', 
                              icon: '📊',
                              description: 'Compare input data types and produced outputs',
                              proposedDetail: proposed.inputsOutputs || '',
                              existingDetail: existing.inputsOutputs || '',
                              rationale: rationales.inputsOutputs || '',
                              scoring: { high: '70-100%: Same data model', medium: '40-69%: Partially overlapping', low: '0-39%: Different data types' }
                            },
                          ];
                          
                          return fields.map((field, idx) => {
                            const score = scores[field.key] as number | null;
                            const scoreLevel = score === null ? 'unknown' : score > 30 ? 'rejected' : score > 20 ? 'revision' : score >= 15 ? 'borderline' : 'safe';
                            const barColor = scoreLevel === 'rejected' ? 'bg-red-500' : scoreLevel === 'revision' ? 'bg-orange-500' : scoreLevel === 'borderline' ? 'bg-amber-500' : scoreLevel === 'safe' ? 'bg-green-500' : 'bg-slate-300';
                            const bgColor = scoreLevel === 'rejected' ? 'bg-red-50 border-red-200' : scoreLevel === 'revision' ? 'bg-orange-50 border-orange-200' : scoreLevel === 'borderline' ? 'bg-amber-50 border-amber-200' : scoreLevel === 'safe' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200';
                            const textColor = scoreLevel === 'rejected' ? 'text-red-700' : scoreLevel === 'revision' ? 'text-orange-700' : scoreLevel === 'borderline' ? 'text-amber-700' : scoreLevel === 'safe' ? 'text-green-700' : 'text-slate-500';
                            const badgeColor = scoreLevel === 'rejected' ? 'bg-red-100 text-red-800' : scoreLevel === 'revision' ? 'bg-orange-100 text-orange-800' : scoreLevel === 'borderline' ? 'bg-amber-100 text-amber-800' : scoreLevel === 'safe' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600';
                            const badgeText = scoreLevel === 'rejected' ? 'OFTEN REJECTED' : scoreLevel === 'revision' ? 'REQUIRES REVISION' : scoreLevel === 'borderline' ? 'BORDERLINE' : scoreLevel === 'safe' ? 'SAFE & ACCEPTABLE' : 'N/A';
                            
                            return (
                              <div key={field.key} className={`rounded-xl border overflow-hidden ${bgColor}`}>
                                <div className="p-5">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">{field.icon}</span>
                                      <div>
                                        <h4 className="font-bold text-slate-900 text-lg">{idx + 1}. {field.label}</h4>
                                        <p className="text-sm text-slate-500">{field.description}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-3xl font-bold ${textColor}`}>
                                        {score !== null ? `${score}%` : 'N/A'}
                                      </div>
                                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeColor}`}>
                                        {badgeText}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  {score !== null && (
                                    <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden mb-4">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(score, 100)}%` }}
                                        transition={{ duration: 0.8, delay: 0.1 * idx }}
                                        className={`h-3 rounded-full ${barColor}`}
                                      />
                                    </div>
                                  )}

                                  {/* Score Rationale */}
                                  {field.rationale && (
                                    <div className="bg-white/80 rounded-lg p-3 border border-indigo-100 mb-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Score Rationale</span>
                                      </div>
                                      <p className="text-sm text-slate-700 leading-relaxed">{field.rationale}</p>
                                    </div>
                                  )}
                                  
                                  {/* Proposed vs Existing Details */}
                                  {(field.proposedDetail || field.existingDetail) && (
                                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                                      {field.proposedDetail && (
                                        <div className="bg-white/70 rounded-lg p-3 border border-slate-200">
                                          <div className="text-xs font-semibold text-blue-600 mb-1 uppercase">Proposed</div>
                                          <p className="text-sm text-slate-700">{field.proposedDetail}</p>
                                        </div>
                                      )}
                                      {field.existingDetail && (
                                        <div className="bg-white/70 rounded-lg p-3 border border-slate-200">
                                          <div className="text-xs font-semibold text-purple-600 mb-1 uppercase">Existing</div>
                                          <p className="text-sm text-slate-700">{field.existingDetail}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* Scoring Legend */}
                      <div className="px-6 pb-6">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Similarity Score Guidelines</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <span className="text-slate-600"><strong>Below 15%:</strong> Safe & Acceptable</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                              <span className="text-slate-600"><strong>15-20%:</strong> Borderline</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                              <span className="text-slate-600"><strong>Above 20%:</strong> Requires Revision</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <span className="text-slate-600"><strong>Above 30%:</strong> Often Rejected</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-3">Final Conceptual Similarity = Average of all 4 fields. Below 15% = Safe, 15-20% = Borderline, Above 20% = Requires Revision, Above 30% = Often Rejected.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: MATCH BREAKDOWN & SOURCE LIST */}
                {sections && activeTab === 'detailed' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Similarity Conclusion */}
                    {matchBreakdown?.conclusion && (
                      <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <BarChart3 className="w-5 h-5" />
                            <div>
                              <h3 className="text-lg font-bold">Similarity Conclusion</h3>
                              <p className="text-indigo-200 text-xs mt-0.5">Overall findings from source matching</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6">
                          <p className="text-sm text-slate-700 leading-relaxed">{matchBreakdown.conclusion}</p>
                        </div>
                      </div>
                    )}

                    {/* Matched Sources */}
                    {matchBreakdown?.matches && matchBreakdown.matches.length > 0 ? (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <Search className="w-5 h-5" />
                            <div>
                              <h3 className="text-lg font-bold">Matched Sources</h3>
                              <p className="text-slate-300 text-xs mt-0.5">{matchBreakdown.matches.length} similar source(s) found — ranked by similarity</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-5">
                          {matchBreakdown.matches.map((match: any, idx: number) => {
                            const overallScore = match.rubric?.overall ?? 0;
                            const scoreColor = overallScore >= 60 ? 'text-red-700 bg-red-50 border-red-200' :
                              overallScore >= 30 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                              'text-green-700 bg-green-50 border-green-200';
                            const typeBadge: Record<string, string> = {
                              'Paper': 'bg-blue-100 text-blue-800',
                              'Thesis': 'bg-purple-100 text-purple-800',
                              'App': 'bg-emerald-100 text-emerald-800',
                              'GitHub': 'bg-slate-100 text-slate-800',
                              'Article': 'bg-amber-100 text-amber-800',
                            };
                            const badgeClass = typeBadge[match.type] || 'bg-slate-100 text-slate-700';
                            return (
                              <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Card Header */}
                                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
                                  <div className="flex items-start justify-between flex-wrap gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="bg-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-full">#{idx + 1}</span>
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>{match.type}</span>
                                        {match.year && match.year !== 'N/A' && (
                                          <span className="text-xs text-slate-500 font-medium">{match.year}</span>
                                        )}
                                      </div>
                                      <h4 className="font-bold text-slate-900 text-lg leading-tight">{match.name}</h4>
                                      {match.link && match.link !== '' && (
                                        <a href={match.link.startsWith('http') ? match.link : `https://${match.link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 underline break-all mt-1 block">
                                          {match.link}
                                        </a>
                                      )}
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl border-2 font-bold text-2xl ${scoreColor}`}>
                                      {overallScore}%
                                    </div>
                                  </div>
                                </div>
                                <div className="p-5 space-y-4">
                                  {/* Why It Matches */}
                                  {match.whyMatches && match.whyMatches.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-amber-600 uppercase mb-2 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Why It Matches
                                      </div>
                                      <ul className="space-y-1.5 pl-1">
                                        {match.whyMatches.map((bullet: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                                            {bullet}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {/* 5-Field Similarity Rubric */}
                                  {match.rubric && (
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                      <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Similarity Rubric</div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                          { key: 'problem', label: 'Problem/Need', weight: '25%' },
                                          { key: 'objectives', label: 'Objectives', weight: '25%' },
                                          { key: 'inputs', label: 'Inputs', weight: '15%' },
                                          { key: 'method', label: 'Method/Tech', weight: '25%' },
                                          { key: 'users', label: 'Users/Scope', weight: '10%' },
                                        ].map((field) => {
                                          const val = match.rubric[field.key];
                                          const barColor = val === null ? 'bg-slate-300' : val >= 60 ? 'bg-red-400' : val >= 30 ? 'bg-amber-400' : 'bg-green-400';
                                          return (
                                            <div key={field.key}>
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-slate-600 font-medium">{field.label}</span>
                                                <span className="text-xs font-bold text-slate-800">{val !== null ? `${val}%` : 'N/A'}</span>
                                              </div>
                                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(val ?? 0, 100)}%` }}></div>
                                              </div>
                                              <div className="text-[10px] text-slate-400 mt-0.5">weight: {field.weight}</div>
                                            </div>
                                          );
                                        })}
                                        <div className="col-span-2 md:col-span-1 flex items-center justify-center">
                                          <div className={`text-center px-4 py-2 rounded-lg border ${overallScore >= 60 ? 'bg-red-50 border-red-200' : overallScore >= 30 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Overall</div>
                                            <div className={`text-xl font-bold ${overallScore >= 60 ? 'text-red-700' : overallScore >= 30 ? 'text-amber-700' : 'text-green-700'}`}>{overallScore}%</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* What Is Different */}
                                  {match.whatsDifferent && match.whatsDifferent.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-green-600 uppercase mb-2 flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5" /> What Is Different
                                      </div>
                                      <ul className="space-y-1.5 pl-1">
                                        {match.whatsDifferent.map((bullet: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"></span>
                                            {bullet}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-lg border border-green-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <CheckCircle className="w-5 h-5" />
                            <h3 className="text-lg font-bold">No Similar Sources Found</h3>
                          </div>
                        </div>
                        <div className="p-8 text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                          <p className="text-lg font-semibold text-green-800 mb-2">The proposed study appears to be novel</p>
                          <p className="text-sm text-slate-600">No closely matching research papers, theses, apps, or projects were identified.</p>
                        </div>
                      </div>
                    )}


                  </motion.div>
                )}

                {/* TAB: TEXT HIGHLIGHTS (Turnitin-style) */}
                {activeTab === 'highlights' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Header */}
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <Highlighter className="w-5 h-5" />
                          <div>
                            <h3 className="text-lg font-bold">Text Match Highlights</h3>
                            <p className="text-purple-200 text-xs mt-0.5">Full-text view with flagged passages mapped to internet sources</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats bar */}
                      <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex flex-wrap gap-4 items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-purple-800">{textHighlights.length}</span>
                          <span className="text-purple-600">flagged passages</span>
                        </div>
                        <div className="h-4 w-px bg-purple-200" />
                        {['Exact Copy', 'Close Paraphrase', 'Patchwriting', 'Structural Copy', 'Common Knowledge'].map(type => {
                          const count = textHighlights.filter(h => (h.matchType || '').toLowerCase().includes(type.toLowerCase().split(' ')[0].toLowerCase())).length
                          if (count === 0) return null
                          const color = type === 'Exact Copy' ? 'bg-red-400' : type === 'Close Paraphrase' ? 'bg-orange-400' : type === 'Patchwriting' ? 'bg-yellow-400' : type === 'Structural Copy' ? 'bg-blue-400' : 'bg-slate-400'
                          return (
                            <div key={type} className="flex items-center gap-1.5">
                              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
                              <span className="text-slate-600">{count} {type}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Color legend */}
                      <div className="px-6 py-2.5 bg-white border-b border-purple-100 flex flex-wrap gap-3 items-center text-[11px]">
                        <span className="text-slate-500 font-medium mr-1">Legend:</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-300" /> Exact Copy</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-200 border border-orange-300" /> Close Paraphrase</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-300" /> Patchwriting</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200 border border-blue-300" /> Structural Copy</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-slate-200 border border-slate-300" /> Common Knowledge</span>
                      </div>
                    </div>

                    {textHighlights.length === 0 ? (
                      <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-10 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h4 className="text-lg font-bold text-green-800 mb-1">No Matches Detected</h4>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">The AI did not flag any specific text passages as matching existing internet sources. Your text appears original.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: Full text with inline highlights */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-semibold text-slate-700">Proposed Research Text</span>
                          </div>
                          <div className="p-5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-[system-ui] max-h-[700px] overflow-y-auto">
                            {(() => {
                              if (!userConcept) return <span className="text-slate-400 italic">No text available</span>
                              
                              // Build segments: find all highlights in text
                              type Segment = { text: string; highlight?: typeof textHighlights[0]; index: number }
                              const segments: Segment[] = []
                              
                              // Find positions of each highlight in the text using multiple strategies
                              const positions: { start: number; end: number; highlight: typeof textHighlights[0]; idx: number }[] = []
                              const lowerConcept = userConcept.toLowerCase()
                              
                              textHighlights.forEach((h, idx) => {
                                if (!h.matchedText) return
                                const searchText = h.matchedText.toLowerCase().trim()
                                if (searchText.length < 4) return
                                
                                // Strategy 1: Exact match (case-insensitive)
                                let pos = lowerConcept.indexOf(searchText)
                                if (pos !== -1) {
                                  positions.push({ start: pos, end: pos + searchText.length, highlight: h, idx })
                                  return
                                }
                                
                                // Strategy 2: Try matching without extra whitespace/punctuation
                                const normalizedSearch = searchText.replace(/[\s]+/g, ' ').replace(/[^\w\s]/g, '')
                                const normalizedConcept = lowerConcept.replace(/[\s]+/g, ' ').replace(/[^\w\s]/g, '')
                                const normalPos = normalizedConcept.indexOf(normalizedSearch)
                                if (normalPos !== -1 && normalizedSearch.length > 10) {
                                  // Map back to original text position approximately
                                  // Find the first word of the search in the original and the last word
                                  const firstWords = searchText.split(/\s+/).slice(0, 3).join('\\s+')
                                  const lastWords = searchText.split(/\s+/).slice(-3).join('\\s+')
                                  try {
                                    const startRegex = new RegExp(firstWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\s\+/g, '\\s+'), 'i')
                                    const startMatch = userConcept.match(startRegex)
                                    if (startMatch && startMatch.index !== undefined) {
                                      // Find the end by looking for last words after the start
                                      const endRegex = new RegExp(lastWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\s\+/g, '\\s+'), 'i')
                                      const remaining = userConcept.substring(startMatch.index)
                                      const endMatch = remaining.match(endRegex)
                                      if (endMatch && endMatch.index !== undefined) {
                                        const end = startMatch.index + endMatch.index + endMatch[0].length
                                        positions.push({ start: startMatch.index, end, highlight: h, idx })
                                        return
                                      }
                                    }
                                  } catch (e) { /* regex error, skip */ }
                                }
                                
                                // Strategy 3: Try a significant substring (first 60 chars or first sentence)
                                const subText = searchText.length > 60 ? searchText.substring(0, 60) : searchText
                                const subPos = lowerConcept.indexOf(subText)
                                if (subPos !== -1) {
                                  positions.push({ start: subPos, end: subPos + Math.min(searchText.length, userConcept.length - subPos), highlight: h, idx })
                                  return
                                }
                                
                                // Strategy 4: Try first 5+ words as a prefix match
                                const words = searchText.split(/\s+/)
                                if (words.length >= 5) {
                                  for (let wc = Math.min(words.length, 8); wc >= 4; wc--) {
                                    const partial = words.slice(0, wc).join(' ')
                                    const pPos = lowerConcept.indexOf(partial)
                                    if (pPos !== -1) {
                                      // Extend to cover the full expected length
                                      const endPos = Math.min(pPos + searchText.length, userConcept.length)
                                      positions.push({ start: pPos, end: endPos, highlight: h, idx })
                                      return
                                    }
                                  }
                                }
                              })
                              
                              // Sort by position and remove overlaps
                              positions.sort((a, b) => a.start - b.start)
                              const filtered: typeof positions = []
                              let lastEnd = 0
                              for (const p of positions) {
                                if (p.start >= lastEnd) {
                                  filtered.push(p)
                                  lastEnd = p.end
                                }
                              }
                              
                              // Build segments
                              let cursor = 0
                              filtered.forEach((p, i) => {
                                if (p.start > cursor) {
                                  segments.push({ text: userConcept.slice(cursor, p.start), index: i * 2 })
                                }
                                segments.push({ text: userConcept.slice(p.start, p.end), highlight: p.highlight, index: i * 2 + 1 })
                                cursor = p.end
                              })
                              if (cursor < userConcept.length) {
                                segments.push({ text: userConcept.slice(cursor), index: filtered.length * 2 })
                              }
                              
                              if (filtered.length === 0 && textHighlights.length > 0) {
                                // None matched in-text — show the raw text with a note
                                return (
                                  <>
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                                      {textHighlights.length} matches were found on the web but could not be highlighted inline. See the source panel for details.
                                    </div>
                                    <span>{userConcept}</span>
                                  </>
                                )
                              }
                              
                              const getHighlightClass = (matchType: string) => {
                                const t = (matchType || '').toLowerCase()
                                if (t.includes('exact')) return 'bg-red-200 border-b-2 border-red-400'
                                if (t.includes('paraphrase')) return 'bg-orange-200 border-b-2 border-orange-400'
                                if (t.includes('patchw')) return 'bg-yellow-200 border-b-2 border-yellow-400'
                                if (t.includes('structural')) return 'bg-blue-200 border-b-2 border-blue-400'
                                return 'bg-slate-200 border-b-2 border-slate-400'
                              }
                              
                              return segments.map((seg) => 
                                seg.highlight ? (
                                  <span
                                    key={seg.index}
                                    className={`${getHighlightClass(seg.highlight.matchType)} rounded-sm px-0.5 cursor-pointer relative group/hl inline`}
                                    onClick={() => {
                                      if (seg.highlight?.sourceUrl && seg.highlight.sourceUrl !== 'N/A') {
                                        window.open(seg.highlight.sourceUrl, '_blank')
                                      }
                                    }}
                                  >
                                    {seg.text}
                                    {/* Hover tooltip with source info + clickable link */}
                                    <span className="invisible group-hover/hl:visible absolute z-[100] left-0 top-full mt-1.5 w-80 bg-slate-900 text-white text-xs rounded-xl p-4 shadow-2xl border border-slate-700" style={{ pointerEvents: 'auto' }}>
                                      <span className="flex items-center gap-2 mb-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          (seg.highlight.matchType || '').toLowerCase().includes('exact') ? 'bg-red-500/30 text-red-300' :
                                          (seg.highlight.matchType || '').toLowerCase().includes('paraphrase') ? 'bg-orange-500/30 text-orange-300' :
                                          (seg.highlight.matchType || '').toLowerCase().includes('patchw') ? 'bg-yellow-500/30 text-yellow-300' :
                                          'bg-slate-500/30 text-slate-300'
                                        }`}>{seg.highlight.matchType}</span>
                                        {seg.highlight.similarity ? <span className="text-slate-400 text-[10px]">{seg.highlight.similarity}% match</span> : null}
                                      </span>
                                      <span className="block text-slate-300 text-[11px] mb-2 leading-relaxed">&ldquo;{seg.highlight.matchedText.substring(0, 120)}{seg.highlight.matchedText.length > 120 ? '...' : ''}&rdquo;</span>
                                      <span className="block text-slate-400 text-[10px] mb-1.5 font-medium">{seg.highlight.source}</span>
                                      {seg.highlight.sourceUrl && seg.highlight.sourceUrl !== 'N/A' && (
                                        <a
                                          href={seg.highlight.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 underline mt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          View Source ↗
                                        </a>
                                      )}
                                    </span>
                                  </span>
                                ) : (
                                  <span key={seg.index}>{seg.text}</span>
                                )
                              )
                            })()}
                          </div>
                        </div>

                        {/* RIGHT: Source panel */}
                        <div className="lg:col-span-1 space-y-4">
                          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                              <span className="text-sm font-semibold text-slate-700">Matched Sources</span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
                              {textHighlights.map((h, idx) => {
                                const badgeColor = (h.matchType || '').toLowerCase().includes('exact')
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : (h.matchType || '').toLowerCase().includes('paraphrase')
                                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                                  : (h.matchType || '').toLowerCase().includes('patchw')
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                  : (h.matchType || '').toLowerCase().includes('structural')
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                                
                                const dotColor = (h.matchType || '').toLowerCase().includes('exact')
                                  ? 'bg-red-400'
                                  : (h.matchType || '').toLowerCase().includes('paraphrase')
                                  ? 'bg-orange-400'
                                  : (h.matchType || '').toLowerCase().includes('patchw')
                                  ? 'bg-yellow-400'
                                  : (h.matchType || '').toLowerCase().includes('structural')
                                  ? 'bg-blue-400'
                                  : 'bg-slate-400'
                                
                                return (
                                  <div key={idx} className="p-3.5 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start gap-2 mb-2">
                                      <span className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full ${dotColor}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                            {h.matchType || 'Match'}
                                          </span>
                                          {h.similarity && (
                                            <span className="text-[10px] font-bold text-slate-600">{h.similarity}%</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2 mb-1.5">&quot;{h.matchedText}&quot;</p>
                                        {h.sourceUrl && h.sourceUrl !== 'N/A' ? (
                                          <a
                                            href={h.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium truncate block underline decoration-indigo-300 hover:decoration-indigo-500 transition-colors"
                                          >
                                            {h.source}
                                          </a>
                                        ) : (
                                          <p className="text-[11px] text-slate-500 truncate font-medium">{h.source}</p>
                                        )}
                                        {h.sourceUrl && h.sourceUrl !== 'N/A' && (
                                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">{h.sourceUrl}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: RECOMMENDATIONS */}
                {sections && activeTab === 'recommendations' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Overall Assessment Summary — based on Proposed vs Existing */}
                    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden border ${
                      sections.problemComparison === 'DIFFERENT' ? 'border-green-200' : 'border-red-200'
                    }`}>
                      <div className={`px-6 py-4 ${
                        sections.problemComparison === 'DIFFERENT'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                          : 'bg-gradient-to-r from-red-600 to-rose-600'
                      }`}>
                        <div className="flex items-center gap-3 text-white">
                          <Shield className="w-5 h-5" />
                          <div>
                            <h3 className="text-lg font-bold">Overall Assessment</h3>
                            <p className={`text-xs mt-0.5 ${
                              sections.problemComparison === 'DIFFERENT' ? 'text-green-100' : 'text-red-100'
                            }`}>Based on the comparison between Proposed and Existing research</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                            <span className="text-[10px] text-blue-500 font-medium block mb-1">Text Similarity</span>
                            <span className="text-lg font-bold text-blue-800">{(displayLexical * 100).toFixed(1)}%</span>
                          </div>
                          <div className={`p-3 rounded-xl border text-center ${
                            (displaySemantic * 100) < 15 ? 'bg-green-50 border-green-100' : (displaySemantic * 100) < 30 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                          }`}>
                            <span className={`text-[10px] font-medium block mb-1 ${
                              (displaySemantic * 100) < 15 ? 'text-green-500' : (displaySemantic * 100) < 30 ? 'text-amber-500' : 'text-red-500'
                            }`}>Concept Similarity</span>
                            <span className={`text-lg font-bold ${
                              (displaySemantic * 100) < 15 ? 'text-green-800' : (displaySemantic * 100) < 30 ? 'text-amber-800' : 'text-red-800'
                            }`}>{(displaySemantic * 100).toFixed(1)}%</span>
                          </div>
                          <div className={`p-3 rounded-xl border text-center ${
                            (displayOverall * 100) < 15 ? 'bg-green-50 border-green-100' : (displayOverall * 100) < 30 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                          }`}>
                            <span className={`text-[10px] font-medium block mb-1 ${
                              (displayOverall * 100) < 15 ? 'text-green-500' : (displayOverall * 100) < 30 ? 'text-amber-500' : 'text-red-500'
                            }`}>Overall Score</span>
                            <span className={`text-lg font-bold ${
                              (displayOverall * 100) < 15 ? 'text-green-800' : (displayOverall * 100) < 30 ? 'text-amber-800' : 'text-red-800'
                            }`}>{(displayOverall * 100).toFixed(1)}%</span>
                          </div>
                          <div className={`p-3 rounded-xl border text-center ${
                            sections.problemComparison === 'DIFFERENT' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'
                          }`}>
                            <span className="text-[10px] text-slate-500 font-medium block mb-1">Problem</span>
                            <span className={`text-lg font-bold ${
                              sections.problemComparison === 'DIFFERENT' ? 'text-green-800' : 'text-amber-800'
                            }`}>{sections.problemComparison || 'N/A'}</span>
                          </div>
                        </div>
                        {/* Verdict */}
                        <div className={`p-3 rounded-xl text-center text-sm font-semibold ${
                          sections.problemComparison === 'DIFFERENT'
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {sections.finalVerdict || sections.acceptanceStatus || 'Assessment complete'}
                        </div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    {(() => {
                      const rawRec = (sections.recommendations || '').trim()
                      if (!rawRec) return (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center gap-3 text-white">
                            <Lightbulb className="w-5 h-5" />
                            <h3 className="text-lg font-bold">Recommendations</h3>
                          </div>
                          <div className="p-10 text-center">
                            <p className="text-sm text-slate-500">No recommendations were generated.</p>
                          </div>
                        </div>
                      )

                      // Parse the 4 fixed sections
                      const parseSection = (label: string, nextLabel: string) => {
                        const pattern = new RegExp(
                          label + '[:\\s]*\\n([\\s\\S]*?)(?=' + nextLabel + '[:\\s]*\\n|$)',
                          'i'
                        )
                        const m = rawRec.match(pattern)
                        if (!m) return []
                        return m[1]
                          .split('\n')
                          .map((l: string) => l.replace(/^[-•*\d.)]\s*/, '').trim())
                          .filter((l: string) => l.length > 0)
                      }

                      const mainIssues = parseSection('MAIN ISSUES', 'REQUIRED CHANGES')
                      const requiredChanges = parseSection('REQUIRED CHANGES', 'SUGGESTED IMPROVEMENTS')
                      const suggested = parseSection('SUGGESTED IMPROVEMENTS', 'STRENGTHS')
                      const strengths = parseSection('STRENGTHS', '\\Z')

                      const sectionCard = (
                        title: string,
                        items: string[],
                        icon: React.ReactNode,
                        headerCls: string,
                        bulletCls: string
                      ) => (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                          <div className={`${headerCls} px-5 py-3 flex items-center gap-2 text-white`}>
                            {icon}
                            <h4 className="text-sm font-bold tracking-wide uppercase">{title}</h4>
                          </div>
                          <div className="px-5 py-4 space-y-2">
                            {items.length === 0
                              ? <p className="text-sm text-slate-400 italic">None</p>
                              : items.map((item: string, i: number) => (
                                  <div key={i} className="flex items-start gap-2.5">
                                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${bulletCls}`} />
                                    <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
                                  </div>
                                ))
                            }
                          </div>
                        </div>
                      )

                      return (
                        <div className="space-y-3">
                          {sectionCard('Main Issues', mainIssues, <AlertTriangle className="w-4 h-4" />, 'bg-gradient-to-r from-red-600 to-rose-600', 'bg-red-400')}
                          {sectionCard('Required Changes', requiredChanges, <Target className="w-4 h-4" />, 'bg-gradient-to-r from-orange-600 to-amber-600', 'bg-orange-400')}
                          {sectionCard('Suggested Improvements', suggested, <Lightbulb className="w-4 h-4" />, 'bg-gradient-to-r from-blue-600 to-indigo-600', 'bg-blue-400')}
                          {sectionCard('Strengths', strengths, <CheckCircle className="w-4 h-4" />, 'bg-gradient-to-r from-green-600 to-emerald-600', 'bg-green-400')}
                        </div>
                      )
                    })()}
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
