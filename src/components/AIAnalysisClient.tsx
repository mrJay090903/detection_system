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

// ── Inline highlight utilities ────────────────────────────────────────────────
type HlSpan = {
  start: number; end: number;
  matchType: string; source: string; url: string;
  color: 'red' | 'orange' | 'yellow' | 'blue';
};
type TextSegment =
  | { text: string; highlighted: false }
  | { text: string; highlighted: true; span: HlSpan };

function getHighlightedSegments(
  text: string,
  textHighlights: any[],
  phraseHighlights: any[]
): TextSegment[] {
  if (!text?.trim()) return [];
  const spans: HlSpan[] = [];
  const lo = text.toLowerCase();

  // Strong matches from AI text highlights
  for (const h of textHighlights) {
    const needle = (h.matchedText || '').trim();
    if (needle.length < 10) continue;
    const idx = lo.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    spans.push({
      start: idx, end: idx + needle.length,
      matchType: h.matchType || 'Unknown',
      source: h.source || '',
      url: (h.sourceUrl && h.sourceUrl !== 'N/A' ? h.sourceUrl : '') ||
            h.serpResults?.[0]?.link || '',
      color:
        h.matchType === 'Exact Copy' ? 'red' :
        (h.matchType === 'Close Paraphrase' || (h.matchType || '').includes('Structural')) ? 'orange' :
        h.matchType === 'Patchwriting' ? 'yellow' : 'blue',
    });
  }

  // Lighter phrase matches (found on internet)
  for (const ph of phraseHighlights) {
    if (!ph.foundOnWeb) continue;
    const needle = (ph.phrase || '').trim();
    if (needle.length < 8) continue;
    const idx = lo.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const covered = spans.some(s => idx >= s.start && idx + needle.length <= s.end);
    if (covered) continue;
    spans.push({
      start: idx, end: idx + needle.length,
      matchType: 'Phrase Match',
      source: ph.bestSource || '',
      url: ph.bestUrl || '',
      color: 'blue',
    });
  }

  if (spans.length === 0) return [{ text, highlighted: false }];

  // Sort & merge overlapping spans
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: HlSpan[] = [];
  for (const s of spans) {
    const prev = merged[merged.length - 1];
    if (prev && s.start < prev.end) {
      if (s.end > prev.end) prev.end = s.end;
    } else {
      merged.push({ ...s });
    }
  }

  // Build output segments
  const result: TextSegment[] = [];
  let pos = 0;
  for (const span of merged) {
    if (span.start > pos) result.push({ text: text.slice(pos, span.start), highlighted: false });
    result.push({ text: text.slice(span.start, span.end), highlighted: true, span });
    pos = span.end;
  }
  if (pos < text.length) result.push({ text: text.slice(pos), highlighted: false });
  return result;
}

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
  const [phraseHighlights, setPhraseHighlights] = useState<any[]>([])
  const [webCitations, setWebCitations] = useState<any[]>([])
  const [serpVerification, setSerpVerification] = useState<any>(null)
  const [fieldAssessment, setFieldAssessment] = useState<any>(null)
  const [activeResultTab, setActiveResultTab] = useState<'breakdown' | 'highlights' | 'citations'>('breakdown')
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null)
  const [proposedText, setProposedText] = useState<string>('')
  const [selectedSpanIdx, setSelectedSpanIdx] = useState<number | null>(null)

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
        if (data.phraseHighlights) {
          setPhraseHighlights(data.phraseHighlights)
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
        if (data.proposedText) {
          setProposedText(data.proposedText)
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
              {fieldAssessment?.scores && (() => {
                const fields = [
                  {
                    key: 'problemNeed',
                    label: 'Problem / Need',
                    icon: '🎯',
                    description: 'How closely the research gap or problem being solved overlaps with existing work.',
                    value: fieldAssessment.scores.problemNeed,
                    rationale: fieldAssessment.rationales?.problemNeed,
                  },
                  {
                    key: 'objectives',
                    label: 'Objectives',
                    icon: '📌',
                    description: 'Degree to which the stated goals and aims mirror those of prior studies.',
                    value: fieldAssessment.scores.objectives,
                    rationale: fieldAssessment.rationales?.objectives,
                  },
                  {
                    key: 'scopeContext',
                    label: 'Scope / Context',
                    icon: '🗺️',
                    description: 'Similarity in the domain, boundary conditions, and setting of the research.',
                    value: fieldAssessment.scores.scopeContext,
                    rationale: fieldAssessment.rationales?.scopeContext,
                  },
                  {
                    key: 'inputsOutputs',
                    label: 'Inputs / Outputs',
                    icon: '⚙️',
                    description: 'Overlap in datasets, methods, deliverables, or expected results.',
                    value: fieldAssessment.scores.inputsOutputs,
                    rationale: fieldAssessment.rationales?.inputsOutputs,
                  },
                ];

                const getLevel = (v: number | null) => {
                  if (v === null || v === undefined) return { label: 'N/A', color: 'gray', bar: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500', ring: 'border-gray-200' };
                  if (v >= 75) return { label: 'High Overlap', color: 'red', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', ring: 'border-red-200' };
                  if (v >= 45) return { label: 'Moderate Overlap', color: 'amber', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', ring: 'border-amber-200' };
                  return { label: 'Low Overlap', color: 'green', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-200' };
                };

                const avg = fieldAssessment.average;
                const avgLevel = getLevel(avg);

                return (
                  <div className="rounded-2xl border bg-white shadow-sm mb-4 overflow-hidden">
                    {/* Header */}
                    <div className="px-5 pt-4 pb-3 border-b bg-gradient-to-r from-slate-50 to-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-gray-800">4-Field Conceptual Assessment</span>
                      </div>
                      <span className="text-xs text-gray-500">Measures overlap with existing research across 4 dimensions</span>
                    </div>

                    {/* Field Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x">
                      {fields.map((field, fi) => {
                        const level = getLevel(field.value);
                        const pct = field.value ?? 0;
                        return (
                          <div key={field.key} className={`p-4 ${fi >= 2 ? 'border-t' : ''}`}>
                            {/* Row 1: icon + label + badge */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg leading-none">{field.icon}</span>
                                <span className="text-sm font-semibold text-gray-800">{field.label}</span>
                              </div>
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${level.badge}`}>
                                {level.label}
                              </span>
                            </div>

                            {/* Row 2: description */}
                            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{field.description}</p>

                            {/* Row 3: progress bar + score */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${level.bar}`}
                                  style={{ width: field.value !== null && field.value !== undefined ? `${pct}%` : '0%' }}
                                />
                              </div>
                              <span className={`text-base font-bold w-12 text-right ${
                                level.color === 'red' ? 'text-red-600' :
                                level.color === 'amber' ? 'text-amber-600' :
                                level.color === 'green' ? 'text-emerald-600' : 'text-gray-400'
                              }`}>
                                {field.value !== null && field.value !== undefined ? `${field.value}%` : '—'}
                              </span>
                            </div>

                            {/* Row 4: rationale */}
                            {field.rationale && (
                              <div className={`text-[11px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border ${level.ring} leading-relaxed`}>
                                <span className="font-semibold text-gray-700">AI Rationale: </span>
                                {field.rationale}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Average Row */}
                    {avg !== null && avg !== undefined && (
                      <div className="px-5 py-3 border-t bg-gradient-to-r from-slate-50 to-gray-50 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Overall Conceptual Similarity</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${avgLevel.badge}`}>{avgLevel.label}</span>
                        </div>
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${avgLevel.bar}`} style={{ width: `${avg}%` }} />
                          </div>
                          <span className={`text-lg font-extrabold w-14 text-right ${
                            avgLevel.color === 'red' ? 'text-red-600' :
                            avgLevel.color === 'amber' ? 'text-amber-600' :
                            avgLevel.color === 'green' ? 'text-emerald-600' : 'text-gray-500'
                          }`}>{avg}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SerpAPI Verification Badge */}
              {serpVerification?.enabled && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-green-800">Web Search Verification (SerpAPI)</span>
                    <p className="text-xs text-green-700">
                      {serpVerification.matchesVerified}/{serpVerification.matchesTotal} matches verified
                      &nbsp;•&nbsp;
                      {serpVerification.phrasesFound ?? 0}/{serpVerification.phrasesTotal ?? 0} phrases found on web
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
                { key: 'highlights' as const, label: 'Text Highlights', icon: <FileText className="w-4 h-4" />, count: phraseHighlights.length + textHighlights.length },
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

                {/* ── SECTION 0: Inline Document Scan ── */}
                {proposedText && (() => {
                  const segments = getHighlightedSegments(proposedText, textHighlights, phraseHighlights);
                  const matchCount = segments.filter(s => s.highlighted).length;
                  return (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      {/* Header */}
                      <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-rose-50 border-b flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            Inline Document Scan
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">Every word and sentence scanned — flagged content highlighted inline. Click any highlight to see its internet source.</p>
                        </div>
                        {matchCount > 0 ? (
                          <span className="shrink-0 text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                            {matchCount} passage{matchCount !== 1 ? 's' : ''} flagged
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold">✓ No matches detected</span>
                        )}
                      </div>

                      <div className="p-5">
                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
                          <span className="text-[11px] font-semibold text-gray-600 mr-1">Legend:</span>
                          {[
                            { label: 'Exact Copy', bg: 'bg-red-200 text-red-800' },
                            { label: 'Close Paraphrase / Structural Copy', bg: 'bg-orange-200 text-orange-800' },
                            { label: 'Patchwriting', bg: 'bg-yellow-200 text-yellow-800' },
                            { label: 'Common Knowledge / Phrase Match', bg: 'bg-blue-100 text-blue-800' },
                          ].map(l => (
                            <span key={l.label} className={`text-[10px] font-medium px-2 py-0.5 rounded ${l.bg}`}>{l.label}</span>
                          ))}
                        </div>

                        {/* Rendered text with inline highlights */}
                        <div className="text-sm text-gray-800 leading-loose bg-gray-50 rounded-xl p-4 border select-text whitespace-pre-wrap">
                          {segments.map((seg, si) => {
                            if (!seg.highlighted) {
                              return <span key={si}>{seg.text}</span>;
                            }
                            const sp = (seg as { text: string; highlighted: true; span: HlSpan }).span;
                            const isOpen = selectedSpanIdx === si;
                            const bgClass =
                              sp.color === 'red'    ? 'bg-red-200 text-red-900 border-b-2 border-red-400' :
                              sp.color === 'orange' ? 'bg-orange-200 text-orange-900 border-b-2 border-orange-400' :
                              sp.color === 'yellow' ? 'bg-yellow-200 text-yellow-900 border-b-2 border-yellow-400' :
                                                      'bg-blue-100 text-blue-900 border-b-2 border-blue-300';
                            return (
                              <span key={si} className="relative inline">
                                <button
                                  onClick={() => setSelectedSpanIdx(isOpen ? null : si)}
                                  className={`${bgClass} rounded px-0.5 cursor-pointer hover:brightness-90 transition-all ${isOpen ? 'ring-2 ring-offset-1 ring-purple-500' : ''}`}
                                  title={`${sp.matchType} — click for source`}
                                >
                                  {seg.text}
                                </button>
                                {isOpen && (
                                  <span className="absolute top-full left-0 z-30 mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left text-xs text-gray-700 block">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                        sp.color === 'red' ? 'bg-red-100 text-red-700' :
                                        sp.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                        sp.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>{sp.matchType}</span>
                                      <button onClick={(e) => { e.stopPropagation(); setSelectedSpanIdx(null); }} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
                                    </div>
                                    {sp.source && (
                                      <p className="mb-1 text-gray-600"><span className="font-semibold text-gray-700">Source:</span> {sp.source}</p>
                                    )}
                                    {sp.url ? (
                                      <a href={sp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium mt-0.5">
                                        View on internet
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                      </a>
                                    ) : (
                                      <p className="text-gray-400 italic text-[10px] mt-0.5">No URL available</p>
                                    )}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SECTION 1: Key Phrase Internet Search ── */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        Key Phrase Internet Search
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {phraseHighlights.length} phrases extracted from your research — click any phrase to see internet matches
                      </p>
                    </div>
                    {serpVerification?.enabled && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                        {phraseHighlights.filter((p: any) => p.foundOnWeb).length}/{phraseHighlights.length} found on web
                      </span>
                    )}
                  </div>

                  {phraseHighlights.length > 0 ? (
                    <div className="p-5">
                      {/* Phrase Chips */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {phraseHighlights.map((p: any, idx: number) => {
                          const isExpanded = expandedPhrase === idx
                          const found = p.foundOnWeb
                          return (
                            <button
                              key={idx}
                              onClick={() => setExpandedPhrase(isExpanded ? null : idx)}
                              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                p.isTitle
                                  ? 'bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200'
                                  : found
                                  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              } ${isExpanded ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                            >
                              {p.isTitle && (
                                <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">TITLE</span>
                              )}
                              <span className="max-w-[200px] truncate">{p.phrase}</span>
                              {found ? (
                                <span className="shrink-0 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                                  !
                                </span>
                              ) : (
                                <span className="shrink-0 w-4 h-4 rounded-full bg-green-400 text-white text-[9px] flex items-center justify-center">
                                  ✓
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-4">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Found on internet (possible match)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span> Not found (likely original)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-400 inline-block"></span> Title phrase</span>
                      </div>

                      {/* Expanded phrase detail */}
                      {expandedPhrase !== null && phraseHighlights[expandedPhrase] && (() => {
                        const ph = phraseHighlights[expandedPhrase]
                        const allResults = [...(ph.serpResults || []), ...(ph.scholarResults || [])]
                        return (
                          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-800 mb-1">
                                  Searching for: &ldquo;
                                  {ph.bestUrl ? (
                                    <a
                                      href={ph.bestUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
                                    >
                                      {ph.phrase}
                                    </a>
                                  ) : (
                                    <span className="text-blue-700">{ph.phrase}</span>
                                  )}
                                  &rdquo;
                                </p>
                                {ph.foundOnWeb ? (
                                  <span className="text-xs text-red-600 font-medium">⚠ This phrase was found on the internet — {allResults.length} source(s) matched</span>
                                ) : (
                                  <span className="text-xs text-green-600 font-medium">✓ No internet matches found for this phrase</span>
                                )}
                              </div>
                              <button onClick={() => setExpandedPhrase(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
                            </div>

                            {allResults.length > 0 ? (
                              <div className="space-y-2">
                                {allResults.slice(0, 6).map((result: any, ri: number) => (
                                  <div key={ri} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                    <a
                                      href={result.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline line-clamp-2 block"
                                    >
                                      {result.title}
                                    </a>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{result.snippet}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[10px] text-gray-400">{result.source}</span>
                                      {result.date && <span className="text-[10px] text-gray-400">• {result.date}</span>}
                                      <a
                                        href={result.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                                      >
                                        Visit →
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 italic">No web results found for this phrase.</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-gray-400 text-sm">Key phrase extraction will appear here after analysis.</p>
                    </div>
                  )}
                </div>

                {/* ── SECTION 2: AI Text Highlights ── */}
                {textHighlights.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      AI-Detected Text Matches ({textHighlights.length})
                    </h3>
                    <div className="space-y-3">
                      {textHighlights.map((highlight: any, idx: number) => {
                        const bestUrl = highlight.sourceUrl && highlight.sourceUrl !== 'N/A'
                          ? highlight.sourceUrl
                          : highlight.serpResults?.[0]?.link || highlight.scholarResults?.[0]?.link || ''
                        return (
                          <div key={idx} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">#{idx + 1}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  highlight.matchType === 'Exact Copy' ? 'bg-red-100 text-red-700' :
                                  highlight.matchType === 'Close Paraphrase' ? 'bg-orange-100 text-orange-700' :
                                  highlight.matchType === 'Patchwriting' ? 'bg-yellow-100 text-yellow-700' :
                                  highlight.matchType === 'Common Knowledge' ? 'bg-gray-100 text-gray-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>{highlight.matchType}</span>
                                {highlight.serpVerified && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Web Verified
                                  </span>
                                )}
                              </div>
                              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                                highlight.similarity >= 80 ? 'bg-red-100 text-red-700' :
                                highlight.similarity >= 50 ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{highlight.similarity}%</span>
                            </div>

                            {/* Clickable matched text */}
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                              {bestUrl ? (
                                <a
                                  href={bestUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-800 italic hover:text-blue-600 hover:underline cursor-pointer"
                                  title={`View source: ${bestUrl}`}
                                >
                                  &ldquo;{highlight.matchedText}&rdquo;
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-60"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                              ) : (
                                <p className="text-sm text-gray-800 italic">&ldquo;{highlight.matchedText}&rdquo;</p>
                              )}
                            </div>

                            {/* Source info */}
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium">Source:</span>
                                {bestUrl ? (
                                  <a href={bestUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{highlight.source}</a>
                                ) : (
                                  <span className="text-gray-700">{highlight.source}</span>
                                )}
                              </div>
                              {bestUrl && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 font-medium">URL:</span>
                                  <a href={bestUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{bestUrl}</a>
                                </div>
                              )}
                            </div>

                            {/* SerpAPI results */}
                            {[...(highlight.serpResults || []), ...(highlight.scholarResults || [])].length > 0 && (
                              <div className="mt-3 pt-3 border-t space-y-1.5">
                                <div className="text-[10px] font-semibold text-green-700 mb-1 flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                  Internet sources
                                </div>
                                {[...(highlight.serpResults || []), ...(highlight.scholarResults || [])].slice(0, 3).map((r: any, ri: number) => (
                                  <div key={ri} className="flex items-start gap-2 p-2 bg-green-50/50 rounded border border-green-100">
                                    <div className="flex-1 min-w-0">
                                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-blue-700 hover:underline line-clamp-1">{r.title}</a>
                                      <p className="text-[9px] text-gray-500 line-clamp-1">{r.snippet}</p>
                                    </div>
                                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">→</a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {phraseHighlights.length === 0 && textHighlights.length === 0 && (
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
