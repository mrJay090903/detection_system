"use client"

import { useState, useEffect } from "react"
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

export default function AIAnalysisClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')
  const [analysis, setAnalysis] = useState<string>("")
  const [activeTab, setActiveTab] = useState('ai-assessment')
  const [userTitle, setUserTitle] = useState('')
  const [existingTitle, setExistingTitle] = useState('')
  const [userConcept, setUserConcept] = useState('')
  const [aiLexicalSimilarity, setAiLexicalSimilarity] = useState<number | null>(null)
  const [aiSemanticSimilarity, setAiSemanticSimilarity] = useState<number | null>(null)
  const [aiOverallSimilarity, setAiOverallSimilarity] = useState<number | null>(null)
  const [textSimilarity, setTextSimilarity] = useState<number | null>(null)
  const [conceptSimilarity, setConceptSimilarity] = useState<number | null>(null)
  const [problemIdentity, setProblemIdentity] = useState<any>(null)
  const [academicRuleApplied, setAcademicRuleApplied] = useState<boolean>(false)
  const [similarityRationale, setSimilarityRationale] = useState<string | null>(null)
  const [pipelineExplanation, setPipelineExplanation] = useState<any>(null)
  const [error, setError] = useState<{ message: string; details?: string; isQuotaError?: boolean; retryAfter?: number } | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // SerpAPI web search results
  const [matchBreakdown, setMatchBreakdown] = useState<any>(null)
  const [textHighlights, setTextHighlights] = useState<any[]>([])
  const [webCitations, setWebCitations] = useState<any[]>([])
  const [serpVerification, setSerpVerification] = useState<any>(null)
  const [fieldAssessment, setFieldAssessment] = useState<any>(null)
  const [activeResultTab, setActiveResultTab] = useState<'breakdown' | 'highlights' | 'citations'>('breakdown')

  const lexicalSimilarity = parseFloat(searchParams.get('lexicalSimilarity') || '0')
  const semanticSimilarity = parseFloat(searchParams.get('semanticSimilarity') || '0')
  const overallSimilarity = parseFloat(searchParams.get('overallSimilarity') || '0')

  // Two-stage pipeline: Use new text/concept similarities if available
  const displayText = textSimilarity !== null ? textSimilarity : (aiLexicalSimilarity !== null ? aiLexicalSimilarity : lexicalSimilarity)
  const displayConcept = conceptSimilarity !== null ? conceptSimilarity : (aiSemanticSimilarity !== null ? aiSemanticSimilarity : semanticSimilarity)
  const displayOverall = aiOverallSimilarity !== null ? aiOverallSimilarity : overallSimilarity

  const metrics = {
    text: { 
      score: displayText * 100, 
      label: 'Text Similarity (Lexical)', 
      description: 'Cosine similarity - word/phrase overlap including methodology & tech stack',
      status: (displayText * 100) < 30 ? 'low' : (displayText * 100) < 60 ? 'medium' : 'high',
      color: (displayText * 100) < 30 ? 'bg-blue-500' : (displayText * 100) < 60 ? 'bg-blue-600' : 'bg-blue-700'
    },
    concept: { 
      score: displayConcept * 100, 
      label: 'Concept Similarity (AI Semantic)', 
      description: 'AI evaluation of core research problem similarity',
      status: (displayConcept * 100) < 40 ? 'low' : (displayConcept * 100) < 60 ? 'medium' : 'high',
      color: (displayConcept * 100) < 40 ? 'bg-green-500' : (displayConcept * 100) < 60 ? 'bg-amber-500' : 'bg-red-500'
    },
    overall: { 
      score: displayOverall * 100, 
      label: 'Overall Assessment', 
      description: 'Reflects concept similarity per academic standards',
      status: (displayOverall * 100) < 40 ? 'low' : (displayOverall * 100) < 60 ? 'medium' : 'high',
      color: (displayOverall * 100) < 40 ? 'bg-blue-600' : (displayOverall * 100) < 60 ? 'bg-amber-500' : 'bg-red-600'
    }
  }

  // The rest of the client logic (parsing, loading, UI) is identical to previous implementation.
  // For brevity, reuse the same helper functions and UI markup as before.

  const parseAnalysis = (text: string) => {
    const sections = {
      aiAssessment: '',
      coreIdea: '',
      keyOverlaps: '',
      similarityReason: '',
      improvements: ''
    }

    const genericSectionRegex = /SECTION\s*(\d+)\s*[:\-]?\s*([^\n\r]*)\n?([\s\S]*?)(?=(?:SECTION\s*\d+\s*[:\-]?\s*[^\n\r]*\n?)|$)/ig
    let match: RegExpExecArray | null
    while ((match = genericSectionRegex.exec(text)) !== null) {
      const num = parseInt(match[1], 10)
      const heading = (match[2] || '').trim()
      const content = (match[3] || '').trim()

      if (num === 0 || /ai\s*similar/i.test(heading)) {
        sections.aiAssessment = content || sections.aiAssessment
      } else if (num === 1 || /core|concept|idea/i.test(heading)) {
        sections.coreIdea = content || sections.coreIdea
      } else if (num === 2 || /method|approach|key|overlap/i.test(heading)) {
        if (/overlap/i.test(heading)) {
          sections.keyOverlaps = content || sections.keyOverlaps
        } else {
          sections.similarityReason = content || sections.similarityReason
        }
      } else if (num === 3 || /application|use case|similarity reason|why/i.test(heading)) {
        sections.similarityReason = content || sections.similarityReason
      } else if (num >= 4 || /improv|suggest|recommend|conclusion|summary/i.test(heading)) {
        sections.improvements = content || sections.improvements
      }
    }

    if (!sections.aiAssessment) {
      const m = text.match(/AI\s*Similarity\s*Assessment[:\s]*([\s\S]*?)(?=SECTION\s*\d+|$)/i)
      if (m) sections.aiAssessment = m[1].trim()
    }

    if (!sections.coreIdea) {
      const m = text.match(/(?:SECTION\s*1[:\s]*[^\n\r]*\n)?(Core\s*(?:Concept|Idea)[^\n\r]*[:\s]*)([\s\S]*?)(?=SECTION\s*\d+|$)/i)
      if (m) sections.coreIdea = (m[2] || '').trim()
    }

    if (!sections.keyOverlaps) {
      const m = text.match(/(Key\s*Overlaps|Conceptual\s*Overlap\s*Summary|Overlap)[\s\S]*?(?=SECTION\s*\d+|$)/i)
      if (m) sections.keyOverlaps = m[0].replace(/^(Key\s*Overlaps[:\s]*)/i, '').trim()
    }

    if (!sections.similarityReason) {
      const m = text.match(/(Similarity\s*Reason|Why\s*These\s*Similarities\s*Exist|Methodology[\s\S]*?)(?=SECTION\s*\d+|$)/i)
      if (m) sections.similarityReason = m[0].replace(/^(Similarity\s*Reason[:\s]*|Why\s*These\s*Similarities\s*Exist[:\s]*)/i, '').trim()
    }

    if (!sections.improvements) {
      const m = text.match(/(Improvement\s*Suggestions|Recommendations|Suggested\s*Actions|Improvement)[\s\S]*?(?=SECTION\s*\d+|$)/i)
      if (m) sections.improvements = m[0].replace(/^(Improvement\s*Suggestions[:\s]*|Recommendations[:\s]*)/i, '').trim()
    }

    if (!sections.aiAssessment && !sections.coreIdea && !sections.keyOverlaps && !sections.similarityReason && !sections.improvements) {
      sections.coreIdea = text
    }

    return sections
  }

  const cleanText = (text: string) => {
    return text
      .replace(/\*\*/g, '')  // Remove bold markers
      .replace(/##\s*/g, '')  // Remove heading markers
      .replace(/\*/g, '')     // Remove italic markers
      .replace(/^\s*-\s*/gm, '• ') // Convert dashes to bullets
  }

  const extractProposedTitle = (text: string): string | null => {
    const patterns = [
      /Proposed Title:\s*([^\n\r]+)/i,
      /Title:\s*([^\n\r]+)/i,
      /Research Title:\s*([^\n\r]+)/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let title = match[1].trim()
          .split(/[\n\r]/)[0]

        // Remove 'BU Thematic Area:' prefix if present
        title = title.replace(/^bu thematic area:\s*/i, '').trim()
        
        // Stop capturing at BU Thematic Area if it appears later
        const buThematicIndex = title.toLowerCase().indexOf('bu thematic area')
        if (buThematicIndex !== -1) {
          title = title.substring(0, buThematicIndex).trim()
        }

        title = title
          .substring(0, 500)
          .trim()
        title = title.replace(/[,;:]\s*$/, '')
        title = title.replace(/\s+/g, ' ')
        title = title.replace(/[*_~`]/g, '')
        return title || null
      }
    }

    return null
  }

  const sections = analysis ? parseAnalysis(analysis) : null
  const extractedTitle = userConcept ? extractProposedTitle(userConcept) : null
  const displayTitle = extractedTitle || userTitle || 'Research Document'

  useEffect(() => {
    // Progress simulation and loadAnalysis (kept same as before)
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

    const messageTimeout1 = setTimeout(() => setLoadingMessage('Analyzing research content...'), 2000)
    const messageTimeout2 = setTimeout(() => setLoadingMessage('Comparing with existing research...'), 5000)
    const messageTimeout3 = setTimeout(() => setLoadingMessage('Generating AI insights...'), 8000)
    const messageTimeout4 = setTimeout(() => setLoadingMessage('Finalizing analysis...'), 12000)

    const loadAnalysis = async () => {
      try {
        setProgress(10)
        setLoadingMessage('Loading your research data...')

        const aiAnalysisDataStr = sessionStorage.getItem('aiAnalysisData')
        let userTitleData, userConcept, existingTitleData, existingThesisBrief, lexicalSimilarityStr, semanticSimilarityStr, overallSimilarityStr

        if (aiAnalysisDataStr) {
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
          userTitleData = searchParams.get('userTitle')
          userConcept = searchParams.get('userConcept')
          existingTitleData = searchParams.get('existingTitle')
          existingThesisBrief = searchParams.get('existingThesisBrief')
          lexicalSimilarityStr = searchParams.get('lexicalSimilarity')
          semanticSimilarityStr = searchParams.get('semanticSimilarity')
          overallSimilarityStr = searchParams.get('overallSimilarity')
        }

        if (!userTitleData || !userConcept || !existingTitleData || !existingThesisBrief) {
          console.error('Missing required data for AI analysis:', {
            hasUserTitle: !!userTitleData,
            hasUserConcept: !!userConcept,
            hasExistingTitle: !!existingTitleData,
            hasExistingThesisBrief: !!existingThesisBrief,
            userConceptLength: userConcept?.length || 0,
            existingThesisBriefLength: existingThesisBrief?.length || 0
          })
          toast.error('Missing required data. Please go back and ensure you uploaded a file or entered all required information.')
          router.push('/research-check')
          return
        }

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
            rawResponseText = await response.text()
            if (rawResponseText) errorData = JSON.parse(rawResponseText)
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
            console.error('Raw response text:', rawResponseText)
          }

          if (response.status === 429 || errorData.isQuotaError) {
            const retryAfter = errorData.retryAfter || 60;
            const friendlyMessage = errorData.message || 'The AI analysis service has reached its daily usage limit. Please try again later (typically resets every 24 hours).';
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

          const errorMessage = errorData.message || errorData.error || errorData.details || rawResponseText.substring(0, 200) || `Server error (${response.status}): ${response.statusText}`

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

        // Two-stage pipeline results
        if (data.textSimilarity !== undefined) {
          setTextSimilarity(parseFloat(data.textSimilarity) / 100)
        }
        if (data.conceptSimilarity !== undefined) {
          setConceptSimilarity(parseFloat(data.conceptSimilarity) / 100)
        }
        
        // Backward compatibility with traditional metrics
        if (data.aiSimilarities) {
          if (data.aiSimilarities.lexical !== null) setAiLexicalSimilarity(data.aiSimilarities.lexical)
          if (data.aiSimilarities.semantic !== null) setAiSemanticSimilarity(data.aiSimilarities.semantic)
          if (data.aiSimilarities.overall !== null) setAiOverallSimilarity(data.aiSimilarities.overall)
        }

        // Store academic rule information
        if (data.problemIdentity) {
          setProblemIdentity(data.problemIdentity)
        }
        if (data.academicRuleApplied !== undefined) {
          setAcademicRuleApplied(data.academicRuleApplied)
        }
        if (data.similarityRationale) {
          setSimilarityRationale(data.similarityRationale)
        }
        if (data.pipelineExplanation) {
          setPipelineExplanation(data.pipelineExplanation)
        }

        // SerpAPI web search data
        if (data.matchBreakdown) {
          setMatchBreakdown(data.matchBreakdown)
        }
        if (data.textHighlights) {
          setTextHighlights(data.textHighlights)
        }
        if (data.webCitations) {
          setWebCitations(data.webCitations)
        }
        if (data.serpVerification) {
          setSerpVerification(data.serpVerification)
        }
        if (data.fieldAssessment) {
          setFieldAssessment(data.fieldAssessment)
        }

        setProgress(100)
        setLoadingMessage('Analysis complete!')

        clearInterval(progressInterval)
        clearTimeout(messageTimeout1)
        clearTimeout(messageTimeout2)
        clearTimeout(messageTimeout3)
        clearTimeout(messageTimeout4)

        setTimeout(() => setIsLoading(false), 500)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        console.error('Error generating AI analysis:', { error, message: errorMessage, type: error instanceof Error ? error.constructor.name : typeof error })
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50">
      {/* UI markup copied from the original page component */}
      {/* ...existing UI... */}
      <main className="container mx-auto px-6 py-6 max-w-6xl">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-10 border border-red-100"
          >
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <AlertTriangle className="w-20 h-20 text-red-500 mx-auto" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{error.message}</h2>
              <p className="text-gray-600 mb-6">{error.details}</p>
              
              {error.isQuotaError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left max-w-2xl mx-auto">
                  <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    API Quota Exceeded
                  </h3>
                  <p className="text-sm text-amber-800 mb-2">
                    The AI service has reached its usage limits. This typically happens when:
                  </p>
                  <ul className="text-sm text-amber-800 list-disc list-inside space-y-1 mb-3">
                    <li>Daily API quota has been exhausted</li>
                    <li>Too many requests in a short period</li>
                    <li>All configured AI models (OpenAI & Gemini) are unavailable</li>
                  </ul>
                  <p className="text-sm text-amber-800">
                    {error.retryAfter ? `Please retry in approximately ${error.retryAfter} seconds.` : 'API quotas typically reset every 24 hours.'}
                  </p>
                </div>
              )}

              {!error.isQuotaError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left max-w-2xl mx-auto">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Analysis Error
                  </h3>
                  <p className="text-sm text-red-800 mb-2">
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
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Go Back
                </Button>
              </div>
              
              {retryCount > 0 && (
                <p className="text-sm text-gray-500 mt-4">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>
          </motion.div>
        ) : isLoading ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center border border-gray-100">
            <div className="relative inline-block mb-6">
              <Sparkles className="w-20 h-20 text-purple-600 mx-auto animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Sparkles className="w-20 h-20 text-purple-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Generating AI Analysis</h2>
            <p className="text-gray-600 mb-6">{loadingMessage}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-7 h-7 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-900">AI Analysis Complete</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <span>Comparing:</span>
                <span className="font-medium text-gray-700">{displayTitle}</span>
                <span>vs</span>
                <span className="font-medium text-gray-700">{existingTitle}</span>
              </div>

              {/* Similarity Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {Object.entries(metrics).map(([key, metric]) => (
                  <div key={key} className="p-4 rounded-xl bg-gray-50 border">
                    <div className="text-xs text-gray-500 mb-1">{metric.label}</div>
                    <div className="text-3xl font-bold text-gray-900">{metric.score.toFixed(1)}%</div>
                    <div className="text-xs text-gray-400 mt-1">{metric.description}</div>
                    <div className={`h-1.5 mt-2 rounded-full ${metric.color}`} style={{ width: `${Math.min(metric.score, 100)}%` }} />
                  </div>
                ))}
              </div>

              {/* Problem Identity */}
              {problemIdentity && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Problem Comparison: {problemIdentity.problemComparison}</span>
                  </div>
                  <p className="text-xs text-blue-700">{similarityRationale}</p>
                </div>
              )}

              {/* 4-Field Assessment */}
              {fieldAssessment?.scores && (
                <div className="p-4 rounded-xl bg-gray-50 border mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    4-Field Conceptual Assessment
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Problem/Need', value: fieldAssessment.scores.problemNeed, rationale: fieldAssessment.rationales?.problemNeed },
                      { label: 'Objectives', value: fieldAssessment.scores.objectives, rationale: fieldAssessment.rationales?.objectives },
                      { label: 'Scope/Context', value: fieldAssessment.scores.scopeContext, rationale: fieldAssessment.rationales?.scopeContext },
                      { label: 'Inputs/Outputs', value: fieldAssessment.scores.inputsOutputs, rationale: fieldAssessment.rationales?.inputsOutputs },
                    ].map((field) => (
                      <div key={field.label} className="p-3 bg-white rounded-lg border" title={field.rationale || ''}>
                        <div className="text-[10px] text-gray-500 mb-1">{field.label}</div>
                        <div className="text-lg font-bold text-gray-900">{field.value !== null && field.value !== undefined ? `${field.value}%` : 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                  {fieldAssessment.average !== null && (
                    <div className="mt-3 text-center p-2 bg-white rounded-lg border">
                      <span className="text-xs text-gray-500">Average: </span>
                      <span className="text-sm font-bold text-gray-900">{fieldAssessment.average}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* SerpAPI Verification Badge */}
              {serpVerification?.enabled && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-green-800">Web Search Verification (SerpAPI)</span>
                    <p className="text-xs text-green-700">
                      {serpVerification.matchesVerified}/{serpVerification.matchesTotal} matches verified
                      &nbsp;•&nbsp;
                      {serpVerification.highlightsVerified}/{serpVerification.highlightsTotal} highlights verified
                      &nbsp;•&nbsp;
                      {serpVerification.totalWebCitations} web citations found
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border">
              {[
                { key: 'breakdown' as const, label: 'Match Breakdown', icon: <Layers className="w-4 h-4" />, count: matchBreakdown?.matches?.length || 0 },
                { key: 'highlights' as const, label: 'Text Highlights', icon: <FileText className="w-4 h-4" />, count: textHighlights.length },
                { key: 'citations' as const, label: 'Web Citations', icon: <BookOpen className="w-4 h-4" />, count: webCitations.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveResultTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeResultTab === tab.key
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                      activeResultTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* MATCH BREAKDOWN TAB */}
            {activeResultTab === 'breakdown' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {matchBreakdown?.matches?.length > 0 ? (
                  matchBreakdown.matches.map((match: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">MATCH #{idx + 1}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{match.type}</span>
                            {match.year && match.year !== 'N/A' && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">{match.year}</span>
                            )}
                            {match.serpVerified && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Web Verified
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-gray-900">{match.name}</h3>
                          {match.link && match.link !== 'N/A' && match.link !== '' && (
                            <a href={match.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                              {match.link}
                            </a>
                          )}
                        </div>
                        {match.rubric?.overall !== null && (
                          <div className={`text-center px-3 py-2 rounded-lg ${
                            match.rubric.overall >= 50 ? 'bg-red-50 text-red-700' :
                            match.rubric.overall >= 30 ? 'bg-orange-50 text-orange-700' :
                            'bg-green-50 text-green-700'
                          }`}>
                            <div className="text-xl font-bold">{match.rubric.overall}%</div>
                            <div className="text-[10px]">Overall</div>
                          </div>
                        )}
                      </div>

                      {/* Rubric Scores */}
                      {match.rubric && (
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          {[
                            { label: 'Problem', value: match.rubric.problem },
                            { label: 'Objectives', value: match.rubric.objectives },
                            { label: 'Inputs', value: match.rubric.inputs },
                            { label: 'Method', value: match.rubric.method },
                            { label: 'Users', value: match.rubric.users },
                          ].map((score) => (
                            <div key={score.label} className="text-center p-2 bg-gray-50 rounded-lg">
                              <div className="text-[10px] text-gray-500">{score.label}</div>
                              <div className="text-sm font-semibold">{score.value !== null ? `${score.value}%` : 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Why It Matches */}
                      {match.whyMatches?.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Why It Matches:</div>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {match.whyMatches.map((reason: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-orange-500 mt-0.5">•</span>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* What Is Different */}
                      {match.whatsDifferent?.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-600 mb-1">What Is Different:</div>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {match.whatsDifferent.map((diff: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-green-500 mt-0.5">•</span>
                                {diff}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* SerpAPI Web Results for this match */}
                      {match.serpResults?.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            Internet Sources Found ({match.serpResults.length})
                          </div>
                          <div className="space-y-2">
                            {match.serpResults.slice(0, 3).map((result: any, ri: number) => (
                              <div key={ri} className="p-2 bg-green-50/50 rounded-lg border border-green-100">
                                <a href={result.link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 hover:underline line-clamp-1">
                                  {result.title}
                                </a>
                                <p className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{result.snippet}</p>
                                <div className="text-[10px] text-gray-400 mt-0.5">{result.source}{result.date ? ` • ${result.date}` : ''}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                    <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No match breakdown entries found in the AI analysis.</p>
                  </div>
                )}

                {/* Similarity Conclusion */}
                {matchBreakdown?.conclusion && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Similarity Conclusion
                    </h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{matchBreakdown.conclusion}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* TEXT HIGHLIGHTS TAB */}
            {activeResultTab === 'highlights' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {textHighlights.length > 0 ? (
                  textHighlights.map((highlight: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">HIGHLIGHT #{idx + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            highlight.matchType === 'Exact Copy' ? 'bg-red-100 text-red-700' :
                            highlight.matchType === 'Close Paraphrase' ? 'bg-orange-100 text-orange-700' :
                            highlight.matchType === 'Patchwriting' ? 'bg-yellow-100 text-yellow-700' :
                            highlight.matchType === 'Common Knowledge' ? 'bg-gray-100 text-gray-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {highlight.matchType}
                          </span>
                          {highlight.serpVerified && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Web Verified
                            </span>
                          )}
                        </div>
                        <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                          highlight.similarity >= 80 ? 'bg-red-100 text-red-700' :
                          highlight.similarity >= 50 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {highlight.similarity}%
                        </div>
                      </div>

                      {/* Matched Text */}
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                        <p className="text-sm text-gray-800 italic">"{highlight.matchedText}"</p>
                      </div>

                      {/* Source Info */}
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Source:</span>
                          <span className="text-gray-700">{highlight.source}</span>
                        </div>
                        {highlight.sourceUrl && highlight.sourceUrl !== 'N/A' && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium">URL:</span>
                            <a href={highlight.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                              {highlight.sourceUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* SerpAPI Results for highlight */}
                      {(highlight.serpResults?.length > 0 || highlight.scholarResults?.length > 0) && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            Internet Sources Found
                          </div>
                          <div className="space-y-2">
                            {[...(highlight.serpResults || []), ...(highlight.scholarResults || [])].slice(0, 4).map((result: any, ri: number) => (
                              <div key={ri} className="p-2 bg-green-50/50 rounded-lg border border-green-100">
                                <a href={result.link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 hover:underline line-clamp-1">
                                  {result.title}
                                </a>
                                <p className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{result.snippet}</p>
                                <div className="text-[10px] text-gray-400 mt-0.5">{result.source}{result.date ? ` • ${result.date}` : ''}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No text highlights found. The proposed text appears to be original.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* WEB CITATIONS TAB */}
            {activeResultTab === 'citations' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {webCitations.length > 0 ? (
                  <>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <p className="text-sm text-gray-600">
                        Found <span className="font-bold text-gray-900">{webCitations.length}</span> unique web citations related to the proposed research.
                        These are real internet sources found via SerpAPI Google Search and Google Scholar.
                      </p>
                    </div>
                    {webCitations.map((citation: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 hover:underline line-clamp-2">
                              {citation.title}
                            </a>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-3">{citation.snippet}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                              <span>{citation.source}</span>
                              {citation.date && <span>• {citation.date}</span>}
                              <span className={`px-1.5 py-0.5 rounded-full ${
                                citation.foundVia === 'breakdown' ? 'bg-purple-100 text-purple-600' :
                                citation.foundVia === 'highlight' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                via {citation.foundVia}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">No web citations found.</p>
                    <p className="text-xs text-gray-400">
                      {serpVerification?.enabled
                        ? 'SerpAPI search did not find matching sources on the internet.'
                        : 'Add SERPAPI_API_KEY to your environment to enable real web search verification.'}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Raw AI Analysis (collapsed) */}
            {analysis && (
              <details className="bg-white rounded-xl shadow-sm border">
                <summary className="cursor-pointer p-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                  View Raw AI Analysis Output
                </summary>
                <div className="p-4 pt-0">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-[400px] overflow-y-auto">{analysis}</pre>
                </div>
              </details>
            )}

            {/* Back Button */}
            <div className="flex justify-center">
              <Button
                onClick={() => router.push('/research-check')}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Check Another Research
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
