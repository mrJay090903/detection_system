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
  Eye,
  Globe,
  Bot,
  ExternalLink
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
  const [winstonHighlights, setWinstonHighlights] = useState<any[]>([])
  const [winstonSources, setWinstonSources] = useState<any[]>([])
  const [winstonSummary, setWinstonSummary] = useState<any>(null)
  const [copyscapeHighlights, setCopyscapeHighlights] = useState<any[]>([])
  const [copyscapeSummary, setCopyscapeSummary] = useState<any>(null)
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
        console.log(' Found concept similarity via fallback:', sections.conceptSimilarity)
      } else {
        console.warn('ï¸ Could not find concept similarity in analysis text')
      }
    } else {
      console.log(' Found concept similarity:', sections.conceptSimilarity)
    }

    // FALLBACK: If text similarity is still empty, try to find cosine similarity
    if (!sections.textSimilarity) {
      const fallbackTextMatch = text.match(/(?:cosine|text(?:ual)?)\s*similarity[\s:]*(\d+(?:\.\d+)?)\s*%/i)
      if (fallbackTextMatch) {
        sections.textSimilarity = fallbackTextMatch[1] + '%'
        console.log(' Found text similarity via fallback:', sections.textSimilarity)
      } else {
        console.warn('ï¸ Could not find text similarity in analysis text')
      }
    } else {
      console.log(' Found text similarity:', sections.textSimilarity)
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
        console.log(' Using concept similarity from parsed text:', parsedValue)
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
    const messageTimeout1 = setTimeout(() => setLoadingMessage('Analyzing research content with AI...'), 2000)
    const messageTimeout2 = setTimeout(() => setLoadingMessage('Verifying sources on the web...'), 8000)
    const messageTimeout3 = setTimeout(() => setLoadingMessage('Finalizing analysis...'), 14000)

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
        
        // Set Winston AI results if available
        console.log('[Winston AI Frontend] Received data:', {
          hasHighlights: !!data.winstonHighlights,
          hasSources: !!data.winstonSources,
          hasSummary: !!data.winstonSummary,
          highlightsCount: data.winstonHighlights?.length || 0,
          sourcesCount: data.winstonSources?.length || 0,
          summary: data.winstonSummary
        });
        if (data.winstonHighlights) {
          console.log('[Winston AI Frontend] First 3 highlights:', data.winstonHighlights.slice(0, 3));
          setWinstonHighlights(data.winstonHighlights)
        }
        if (data.winstonSources) {
          console.log('[Winston AI Frontend] First 3 sources:', data.winstonSources.slice(0, 3));
          setWinstonSources(data.winstonSources)
        }
        if (data.winstonSummary) {
          setWinstonSummary(data.winstonSummary)
        }
        
        // Set Copyscape results if available
        if (data.copyscapeHighlights) {
          setCopyscapeHighlights(data.copyscapeHighlights)
        }
        if (data.copyscapeSummary) {
          setCopyscapeSummary(data.copyscapeSummary)
        }
        
        // Complete progress
        setProgress(100)
        setLoadingMessage('Analysis complete!')
        
        // Clear intervals and timeouts
        clearInterval(progressInterval)
        clearTimeout(messageTimeout1)
        clearTimeout(messageTimeout2)
        clearTimeout(messageTimeout3)
        
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
                <p className="text-indigo-100 text-sm">Comprehensive comparison of your research with existing work</p>
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
                          <p className="text-xs text-indigo-600 font-medium mb-2"> Title extracted from document</p>
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
                      { id: 'plagiarism', icon: <AlertTriangle className="w-4 h-4" />, label: 'Text Highlights', desc: 'Plagiarism detection', priority: true },
                      { id: 'recommendations', icon: <Lightbulb className="w-4 h-4" />, label: 'Recommendations', desc: 'Improvement suggestions' },
                    ].map((tab: any, idx) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                          activeTab === tab.id
                            ? tab.priority ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                            : tab.priority ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                          activeTab === tab.id ? 'bg-white/20' : tab.priority ? 'bg-purple-100' : 'bg-slate-100'
                        }`}>
                          {tab.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                            {tab.label}
                            {tab.priority && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-700'
                              }`}>
                                #1
                              </span>
                            )}
                          </div>
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
                    className="space-y-4"
                  >
                    {fieldAssessment?.scores && (() => {
                      const recs = fieldAssessment?.recommendations;

                      const fields = [
                        {
                          key: 'problemNeed',
                          label: 'Problem / Need',
                          shortLabel: 'Problem',
                          icon: '',
                          what: 'Research gap or problem being solved',
                          howScored: 'HIGH = same exact problem; MEDIUM = same domain + gap; LOW = different problem.',
                          value: fieldAssessment.scores.problemNeed,
                          rationale: fieldAssessment.rationales?.problemNeed,
                          highAction: 'Your research problem mirrors an existing study closely — redefine the problem or narrow its scope to differentiate.',
                          medAction: 'There is partial overlap in the problem area — sharpen your unique angle or add constraints.',
                          lowAction: 'Your problem statement is sufficiently distinct from existing work.',
                          questions: ['What specific problem are you solving?', 'Is this the exact same gap or a related one?', 'Can you narrow the problem further?'],
                        },
                        {
                          key: 'objectives',
                          label: 'Objectives',
                          shortLabel: 'Objectives',
                          icon: '',
                          what: 'Stated goals, deliverables, and aims of the research',
                          howScored: 'HIGH = same system/output type; MEDIUM = some goal overlap; LOW = fundamentally different.',
                          value: fieldAssessment.scores.objectives,
                          rationale: fieldAssessment.rationales?.objectives,
                          highAction: 'Your objectives closely resemble an existing study — rephrase goals with unique metrics or deliverables.',
                          medAction: 'Some objectives overlap — clarify what makes your deliverables different.',
                          lowAction: 'Your objectives are well differentiated.',
                          questions: ['What type of system/output will you produce?', 'Are your deliverables unique?', 'How do your goals differ from existing work?'],
                        },
                        {
                          key: 'scopeContext',
                          label: 'Scope / Context',
                          shortLabel: 'Scope',
                          icon: '',
                          what: 'Domain, setting, target institution or users',
                          howScored: 'HIGH = same institution/environment; MEDIUM = related domain; LOW = different context.',
                          value: fieldAssessment.scores.scopeContext,
                          rationale: fieldAssessment.rationales?.scopeContext,
                          highAction: 'Your scope and context are very similar to another study — target a different population, location, or setting.',
                          medAction: 'Related scope detected — emphasize unique contextual factors (location, demographics, constraints).',
                          lowAction: 'Your scope and context are distinct enough.',
                          questions: ['Who are your target users?', 'Where will this be deployed?', 'What makes your context unique?'],
                        },
                        {
                          key: 'inputsOutputs',
                          label: 'Inputs / Outputs',
                          shortLabel: 'I/O',
                          icon: '',
                          what: 'Datasets, methods, system inputs, expected results and deliverables',
                          howScored: 'HIGH = same data model/output; MEDIUM = partially overlapping; LOW = different approach.',
                          value: fieldAssessment.scores.inputsOutputs,
                          rationale: fieldAssessment.rationales?.inputsOutputs,
                          highAction: 'Your data/methods closely match existing work — use different datasets, techniques, or output formats.',
                          medAction: 'Partial overlap in approach — highlight unique technical contributions or data sources.',
                          lowAction: 'Your inputs and outputs are sufficiently unique.',
                          questions: ['What data sources will you use?', 'What is the expected output format?', 'How does your approach differ technically?'],
                        },
                      ];

                      const getLevel = (v: number | null) => {
                        if (v === null || v === undefined) return { label: 'N/A', tier: 'none', bar: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500', ring: 'border-gray-200', bg: 'bg-white', icon: '—', textColor: 'text-gray-400' };
                        if (v >= 75) return { label: 'High Overlap', tier: 'high', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', ring: 'border-red-200', bg: 'bg-red-50/40', icon: '', textColor: 'text-red-600' };
                        if (v >= 45) return { label: 'Moderate Overlap', tier: 'medium', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', ring: 'border-amber-200', bg: 'bg-amber-50/40', icon: '', textColor: 'text-amber-600' };
                        return { label: 'Low Overlap', tier: 'low', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-200', bg: 'bg-emerald-50/30', icon: '', textColor: 'text-emerald-600' };
                      };

                      const avg = fieldAssessment.average;
                      const avgLevel = getLevel(avg);
                      const highCount = fields.filter(f => f.value !== null && f.value !== undefined && f.value >= 75).length;
                      const medCount = fields.filter(f => f.value !== null && f.value !== undefined && f.value >= 45 && f.value < 75).length;
                      const lowCount = fields.filter(f => f.value !== null && f.value !== undefined && f.value < 45).length;
                      const statusText = highCount >= 2 ? 'Significant Revision Needed' : highCount === 1 ? 'Partial Revision Needed' : medCount >= 2 ? 'Minor Adjustments Recommended' : 'Research Appears Novel';
                      const statusColor = highCount >= 2 ? 'text-red-700 bg-red-50 border-red-200' : highCount === 1 ? 'text-orange-700 bg-orange-50 border-orange-200' : medCount >= 2 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200';

                      const getFocusForField = (fieldLabel: string) => {
                        if (!recs?.focusAreas?.length) return [];
                        const keywords = fieldLabel.toLowerCase().replace(/\//g, ' ').split(/\s+/).filter((w: string) => w.length > 2);
                        return recs.focusAreas.filter((fa: string) => {
                          const faLow = fa.toLowerCase();
                          return keywords.some((kw: string) => faLow.includes(kw));
                        });
                      };

                      return (
                        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                          {/* Header */}
                          <div className="px-5 pt-4 pb-3 border-b bg-gradient-to-r from-slate-50 to-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-purple-600" />
                                <span className="text-sm font-bold text-gray-800">4-Field Conceptual Assessment</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>{statusText}</span>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
                              Compares your proposed research with the existing study across four core dimensions to identify conceptual overlap.
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px]">
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 75-100% High Overlap</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 45-74% Moderate</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 0-44% Low / Distinct</span>
                              <span className="flex items-center gap-1 text-gray-400">|</span>
                              {highCount > 0 && <span className="font-semibold text-red-600">{highCount} High</span>}
                              {medCount > 0 && <span className="font-semibold text-amber-600">{medCount} Moderate</span>}
                              {lowCount > 0 && <span className="font-semibold text-emerald-600">{lowCount} Low</span>}
                            </div>
                          </div>

                          {/* Proposed vs Existing Summary */}
                          {(sections?.proposedResearch || sections?.existingResearch) && (
                            <div className="px-5 py-3 border-b bg-gray-50/60">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600 mb-1"> Your Proposed Research</div>
                                  <p className="text-[11px] text-gray-700 leading-relaxed">{sections.proposedResearch || 'Not extracted'}</p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1"> Existing Research (Database)</div>
                                  <p className="text-[11px] text-gray-700 leading-relaxed">{sections.existingResearch || 'Not extracted'}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Quick Visual Comparison */}
                          <div className="px-5 py-3 border-b">
                            <div className="text-[10px] font-semibold text-gray-600 mb-2.5 uppercase tracking-wide">Overview — Score Comparison</div>
                            <div className="space-y-2">
                              {fields.map((field) => {
                                const level = getLevel(field.value);
                                const pct = field.value ?? 0;
                                return (
                                  <div key={field.key} className="flex items-center gap-2">
                                    <span className="text-xs w-20 text-gray-600 font-medium truncate">{field.icon} {field.shortLabel}</span>
                                    <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden relative">
                                      <div className={`h-full rounded-full transition-all duration-700 ${level.bar}`} style={{ width: `${pct}%` }} />
                                      <div className="absolute top-0 left-[45%] w-px h-full bg-gray-300/50" />
                                      <div className="absolute top-0 left-[75%] w-px h-full bg-gray-300/50" />
                                    </div>
                                    <span className={`text-sm font-bold w-12 text-right ${level.textColor}`}>
                                      {field.value !== null && field.value !== undefined ? `${field.value}%` : '—'}
                                    </span>
                                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full w-16 text-center ${level.badge}`}>
                                      {level.label.replace(' Overlap', '')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Detailed Field Cards */}
                          <div className="divide-y">
                            {fields.map((field, fi) => {
                              const level = getLevel(field.value);
                              const pct = field.value ?? 0;
                              const needsAttention = field.value !== null && field.value !== undefined && field.value >= 45;
                              const fieldFocus = getFocusForField(field.label);
                              const actionText = level.tier === 'high' ? field.highAction : level.tier === 'medium' ? field.medAction : level.tier === 'low' ? field.lowAction : '';

                              return (
                                <div key={field.key} className={`px-5 py-4 ${level.bg}`}>
                                  {/* Field Header */}
                                  <div className="flex items-center justify-between mb-2 gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="text-xl leading-none shrink-0">{field.icon}</span>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-bold text-gray-800">{field.label}</span>
                                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${level.badge}`}>{level.icon} {level.label}</span>
                                          {needsAttention ? (
                                            <span className="text-[8px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full"> Needs Attention</span>
                                          ) : level.tier === 'low' ? (
                                            <span className="text-[8px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full"> Distinct</span>
                                          ) : null}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{field.what}</p>
                                      </div>
                                    </div>
                                    <span className={`text-2xl font-extrabold leading-none shrink-0 ${level.textColor}`}>
                                      {field.value !== null && field.value !== undefined ? `${field.value}%` : '—'}
                                    </span>
                                  </div>

                                  {/* Progress bar with scale markers */}
                                  <div className="relative mb-3">
                                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-700 ${level.bar}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-0.5 text-[8px] text-gray-300 px-0.5">
                                      <span>0%</span><span className="text-gray-400">|45%</span><span className="text-gray-400">|75%</span><span>100%</span>
                                    </div>
                                  </div>

                                  {/* Content Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
                                    {field.rationale && (
                                      <div className={`text-[11px] text-gray-700 bg-white rounded-lg px-3 py-2.5 border ${level.ring} leading-relaxed`}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-[10px]"></span>
                                          <span className="font-bold text-gray-800 text-[10px] uppercase tracking-wide">AI Analysis</span>
                                        </div>
                                        {field.rationale}
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      {actionText && (
                                        <div className={`text-[10px] leading-relaxed px-3 py-2 rounded-lg ${
                                          level.tier === 'high' ? 'bg-red-50 text-red-700 border border-red-200' :
                                          level.tier === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                          <span className="font-bold text-[10px]">{level.tier === 'low' ? ' Assessment: ' : '-> What to do: '}</span>
                                          {actionText}
                                        </div>
                                      )}
                                      <div className="text-[9px] text-gray-400 italic bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                                        <span className="font-semibold text-gray-500 not-italic">Scoring: </span>{field.howScored}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Guiding questions */}
                                  {needsAttention && field.questions && (
                                    <div className="text-[10px] bg-purple-50/60 border border-purple-100 rounded-lg px-3 py-2 mb-2">
                                      <span className="font-bold text-purple-700"> Questions to consider:</span>
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-purple-600">
                                        {field.questions.map((q: string, qi: number) => (
                                          <span key={qi}>• {q}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Focus area hints */}
                                  {fieldFocus.length > 0 && (
                                    <div className="space-y-1.5">
                                      {fieldFocus.slice(0, 3).map((fa: string, i: number) => (
                                        <div key={i} className="text-[10px] bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-orange-800 leading-snug">
                                          <span className="font-bold text-orange-700"> Specific Focus: </span>{fa}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Overall Average */}
                          {avg !== null && avg !== undefined && (
                            <div className="border-t">
                              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-gray-50">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-700">Overall Conceptual Overlap</span>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${avgLevel.badge}`}>{avgLevel.icon} {avgLevel.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3 min-w-40">
                                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${avgLevel.bar}`} style={{ width: `${avg}%` }} />
                                    </div>
                                    <span className={`text-2xl font-extrabold w-16 text-right ${avgLevel.textColor}`}>{avg}%</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {fields.map(f => {
                                    const fl = getLevel(f.value);
                                    return (
                                      <div key={f.key} className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${fl.badge} ${fl.ring}`}>
                                        <span>{f.icon}</span>
                                        <span className="font-semibold">{f.shortLabel}</span>
                                        <span className="font-bold">{f.value ?? '—'}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className={`text-[11px] leading-relaxed rounded-lg px-3.5 py-2.5 ${
                                  avg >= 75 ? 'bg-red-50 text-red-700 border border-red-200' :
                                  avg >= 45 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {avg >= 75
                                    ? ` An overall score of ${avg}% indicates significant conceptual overlap across multiple dimensions. ${highCount} of 4 fields scored High. Major revisions are strongly recommended before proceeding.`
                                    : avg >= 45
                                    ? ` An overall score of ${avg}% indicates moderate overlap. ${highCount > 0 ? `${highCount} field(s) scored High and ` : ''}${medCount} field(s) scored Moderate. Review the flagged fields above and refine your unique contributions.`
                                    : ` An overall score of ${avg}% indicates your research is conceptually distinct. ${lowCount} of 4 fields scored Low. Continue developing your proposal with confidence.`
                                  }
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Scoring Legend */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                      <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Similarity Score Guidelines</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-slate-600"><strong>Below 45%:</strong> Low / Distinct</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="text-slate-600"><strong>45-74%:</strong> Moderate Overlap</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-slate-600"><strong>75-100%:</strong> High Overlap</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-300"></div><span className="text-slate-600">N/A: No data available</span></div>
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
                    {(() => {
                      const _normalizeT = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                      const _existNorm = _normalizeT(existingTitle);
                      const _existWords = new Set(_existNorm.split(' ').filter((w: string) => w.length > 3));
                      const _filteredMatches = (matchBreakdown?.matches || []).filter((m: any) => {
                        const mNorm = _normalizeT(m.name || '');
                        if (!mNorm || !_existNorm) return true;
                        if (mNorm === _existNorm) return false;
                        if (_existNorm.includes(mNorm) || mNorm.includes(_existNorm)) return false;
                        const mWords = new Set(mNorm.split(' ').filter((w: string) => w.length > 3));
                        let overlap = 0;
                        for (const w of mWords) if (_existWords.has(w)) overlap++;
                        const ratio = overlap / Math.min(mWords.size, _existWords.size || 1);
                        return ratio < 0.7;
                      });
                      return _filteredMatches.length > 0 ? (
                      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
                          <div className="flex items-center gap-3 text-white">
                            <Search className="w-5 h-5" />
                            <div>
                              <h3 className="text-lg font-bold">Matched Sources</h3>
                              <p className="text-slate-300 text-xs mt-0.5">{_filteredMatches.length} external source(s) found — ranked by similarity</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-5">
                          {_filteredMatches.map((match: any, idx: number) => {
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
                            <h3 className="text-lg font-bold">No External Sources Found</h3>
                          </div>
                        </div>
                        <div className="p-8 text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                          <p className="text-lg font-semibold text-green-800 mb-2">No external match breakdown entries found</p>
                          <p className="text-sm text-slate-600">No closely matching external research papers, theses, apps, or projects were identified.</p>
                        </div>
                      </div>
                      );
                    })()}


                  </motion.div>
                )}

                {/* TAB: TEXT HIGHLIGHTS (PLAGIARISM DETECTION) */}
                {sections && activeTab === 'plagiarism' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Winston AI Results (Primary) */}
                    {winstonSummary && (winstonSummary.plagiarismScore > 0 || winstonSummary.highlightsCount > 0 || winstonSummary.sourcesCount > 0) ? (
                      <>
                        {/* Summary Card */}
                        <div className={`rounded-2xl shadow-lg border-2 overflow-hidden ${
                          winstonSummary.isPlagiarized ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                        }`}>
                          <div className={`px-6 py-4 ${
                            winstonSummary.isPlagiarized 
                              ? 'bg-gradient-to-r from-red-600 to-rose-600' 
                              : 'bg-gradient-to-r from-green-600 to-emerald-600'
                          }`}>
                            <div className="flex items-center gap-3 text-white">
                              {winstonSummary.isPlagiarized ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                              <div>
                                <h3 className="text-xl font-bold">Plagiarism Detection</h3>
                                <p className="text-xs mt-1 text-white/90">Advanced AI-powered plagiarism detection with text highlighting</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 bg-white">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className={`text-center p-3 rounded-xl border ${
                                winstonSummary.plagiarismScore >= 30 ? 'bg-red-50 border-red-100' :
                                winstonSummary.plagiarismScore >= 15 ? 'bg-orange-50 border-orange-100' :
                                'bg-green-50 border-green-100'
                              }`}>
                                <div className={`text-2xl font-bold ${
                                  winstonSummary.plagiarismScore >= 30 ? 'text-red-600' :
                                  winstonSummary.plagiarismScore >= 15 ? 'text-orange-600' :
                                  'text-green-600'
                                }`}>{Math.round(winstonSummary.plagiarismScore * 10) / 10}%</div>
                                <div className={`text-xs mt-1 ${
                                  winstonSummary.plagiarismScore >= 30 ? 'text-red-500' :
                                  winstonSummary.plagiarismScore >= 15 ? 'text-orange-500' :
                                  'text-green-500'
                                }`}>Plagiarism Score</div>
                              </div>
                              <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="text-2xl font-bold text-blue-600">{winstonSummary.highlightsCount}</div>
                                <div className="text-xs text-blue-500 mt-1">Text Highlights</div>
                              </div>
                              <div className="text-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                                <div className="text-2xl font-bold text-purple-600">{winstonSummary.sourcesCount}</div>
                                <div className="text-xs text-purple-500 mt-1">Sources Found</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Text with Highlights */}
                        {winstonHighlights.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                          <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600">
                            <div className="flex items-center gap-3 text-white">
                              <Highlighter className="w-5 h-5" />
                              <div>
                                <h3 className="text-lg font-bold">Your Text with Plagiarism Highlights</h3>
                                <p className="text-xs mt-1 text-indigo-100">Highlighted portions match external sources</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 max-h-[600px] overflow-y-auto">
                            <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-[system-ui]">
                              {(() => {
                                if (!userConcept) return <span className="text-slate-400 italic">No text available</span>;
                                
                                // Sort highlights by start position
                                const sortedHighlights = [...winstonHighlights].sort((a, b) => a.start - b.start);
                                
                                // Build segments
                                const segments: Array<{ text: string; highlight?: typeof sortedHighlights[0]; index: number }> = [];
                                let cursor = 0;
                                
                                sortedHighlights.forEach((highlight, i) => {
                                  // Add text before highlight
                                  if (highlight.start > cursor) {
                                    segments.push({ text: userConcept.slice(cursor, highlight.start), index: i * 2 });
                                  }
                                  // Add highlighted text
                                  segments.push({ 
                                    text: userConcept.slice(highlight.start, highlight.end), 
                                    highlight, 
                                    index: i * 2 + 1 
                                  });
                                  cursor = highlight.end;
                                });
                                
                                // Add remaining text
                                if (cursor < userConcept.length) {
                                  segments.push({ text: userConcept.slice(cursor), index: sortedHighlights.length * 2 });
                                }
                                
                                return segments.map((seg) => 
                                  seg.highlight ? (
                                    <span
                                      key={seg.index}
                                      className="bg-red-200 border-b-2 border-red-400 rounded-sm px-0.5 cursor-pointer relative group/hl inline"
                                      onClick={() => {
                                        if (seg.highlight?.url) {
                                          window.open(seg.highlight.url, '_blank');
                                        }
                                      }}
                                    >
                                      {seg.text}
                                      <span className="invisible group-hover/hl:visible absolute z-[100] left-0 top-full mt-1.5 w-80 bg-slate-900 text-white text-xs rounded-xl p-4 shadow-2xl border border-slate-700">
                                        <span className="flex items-center gap-2 mb-2">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/30 text-red-300">
                                            {Math.round(seg.highlight.score * 10) / 10}% Match
                                          </span>
                                        </span>
                                        <span className="block text-slate-300 text-[11px] mb-2 leading-relaxed font-semibold">{seg.highlight.title}</span>
                                        {seg.highlight.url && (
                                          <a
                                            href={seg.highlight.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 underline mt-1"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            View Source →
                                          </a>
                                        )}
                                      </span>
                                    </span>
                                  ) : (
                                    <span key={seg.index}>{seg.text}</span>
                                  )
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        )}

                        {/* Matched Sources List */}
                        {winstonSources.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                              <h3 className="text-lg font-semibold text-slate-800">Matching Sources</h3>
                              <p className="text-xs text-slate-500 mt-1">External sources containing similar content</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {winstonSources.map((source: any, idx: number) => (
                                <div key={idx} className="p-6 hover:bg-slate-50 transition-colors">
                                  <div className="flex items-start gap-4">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                                      source.plagiarismScore >= 30 ? 'bg-red-100 text-red-600' :
                                      source.plagiarismScore >= 15 ? 'bg-orange-100 text-orange-600' :
                                      'bg-amber-100 text-amber-600'
                                    }`}>
                                      <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <h4 className="text-base font-semibold text-slate-800 line-clamp-2">
                                          {source.title}
                                        </h4>
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold shrink-0 ${
                                          source.plagiarismScore >= 30 ? 'bg-red-100 text-red-700' :
                                          source.plagiarismScore >= 15 ? 'bg-orange-100 text-orange-700' :
                                          'bg-amber-100 text-amber-700'
                                        }`}>
                                          {Math.round(source.plagiarismScore * 10) / 10}% Match
                                        </span>
                                      </div>
                                      {source.matchedText && (
                                        <p className="text-sm text-slate-600 mb-3 line-clamp-3 italic">&quot;{source.matchedText}&quot;</p>
                                      )}
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                      >
                                        <Globe className="w-4 h-4" />
                                        View Source
                                      </a>
                                      <div className="mt-3 pt-3 border-t border-slate-100">
                                        <span className="text-xs text-slate-500 truncate block">{source.url}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : copyscapeHighlights && copyscapeHighlights.length > 0 ? (
                      <>
                        {/* Copyscape Results (Fallback) */}
                        <div className="bg-red-50 rounded-2xl shadow-lg border-2 border-red-200 overflow-hidden">
                          <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600">
                            <div className="flex items-center gap-3 text-white">
                              <AlertTriangle className="w-6 h-6" />
                              <div>
                                <h3 className="text-xl font-bold">Copyscape Plagiarism Detection</h3>
                                <p className="text-xs mt-1 text-red-100">Professional plagiarism detection</p>
                              </div>
                            </div>
                          </div>
                          {copyscapeSummary && (
                            <div className="p-6 bg-white">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                                  <div className="text-2xl font-bold text-red-600">{copyscapeSummary.count}</div>
                                  <div className="text-xs text-red-500 mt-1">Matches Found</div>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                                  <div className="text-2xl font-bold text-orange-600">{copyscapeSummary.allpercentmatched}%</div>
                                  <div className="text-xs text-orange-500 mt-1">Overall Match</div>
                                </div>
                                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                                  <div className="text-2xl font-bold text-amber-600">{copyscapeSummary.allwordsmatched}</div>
                                  <div className="text-xs text-amber-500 mt-1">Words Matched</div>
                                </div>
                                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="text-2xl font-bold text-slate-600">{copyscapeSummary.querywords}</div>
                                  <div className="text-xs text-slate-500 mt-1">Words Checked</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Matched Sources */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Matched Sources</h3>
                            <p className="text-xs text-slate-500 mt-1">External sources containing similar content</p>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {copyscapeHighlights.map((match: any, idx: number) => (
                              <div key={idx} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-4">
                                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                                    match.percentMatched >= 30 ? 'bg-red-100 text-red-600' :
                                    match.percentMatched >= 15 ? 'bg-orange-100 text-orange-600' :
                                    'bg-amber-100 text-amber-600'
                                  }`}>
                                    <AlertTriangle className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <h4 className="text-base font-semibold text-slate-800 line-clamp-2">
                                        {match.title}
                                      </h4>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                          match.percentMatched >= 30 ? 'bg-red-100 text-red-700' :
                                          match.percentMatched >= 15 ? 'bg-orange-100 text-orange-700' :
                                          'bg-amber-100 text-amber-700'
                                        }`}>
                                          {match.percentMatched}% Match
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">{match.snippet}</p>
                                    <a
                                      href={match.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                      <Globe className="w-4 h-4" />
                                      View Source
                                    </a>
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                      <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                          <FileText className="w-3 h-3" />
                                          {match.wordsMatched} words matched
                                        </span>
                                        <span className="truncate">{match.url}</span>
                                      </div>
                                    </div>
                                    {match.textMatched && (
                                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="text-xs font-semibold text-amber-700 uppercase mb-1">Matched Text:</div>
                                        <p className="text-sm text-amber-900 italic line-clamp-4">&quot;{match.textMatched}&quot;</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-lg border border-green-200 overflow-hidden">
                        <div className="p-10 text-center">
                          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-green-800 mb-2">No Plagiarism Detected</h3>
                          <p className="text-slate-600 max-w-md mx-auto">
                            {copyscapeSummary 
                              ? `Copyscape found no matches in external sources. Your text appears to be original.`
                              : `Plagiarism detection service not configured or unavailable.`
                            }
                          </p>
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
