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
  const [activeTab, setActiveTab] = useState('ai-assessment')
  const [userTitle, setUserTitle] = useState('')
  const [existingTitle, setExistingTitle] = useState('')
  const [userConcept, setUserConcept] = useState('')
  const [aiLexicalSimilarity, setAiLexicalSimilarity] = useState<number | null>(null)
  const [aiSemanticSimilarity, setAiSemanticSimilarity] = useState<number | null>(null)
  const [aiOverallSimilarity, setAiOverallSimilarity] = useState<number | null>(null)

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
      label: 'AI Lexical Similarity', 
      status: (displayLexical * 100) < 15 ? 'low' : (displayLexical * 100) < 30 ? 'medium' : 'high',
      color: (displayLexical * 100) < 15 ? 'bg-green-500' : (displayLexical * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    semantic: { 
      score: displaySemantic * 100, 
      label: 'AI Semantic Similarity', 
      status: (displaySemantic * 100) < 15 ? 'low' : (displaySemantic * 100) < 30 ? 'medium' : 'high',
      color: (displaySemantic * 100) < 15 ? 'bg-green-500' : (displaySemantic * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    overall: { 
      score: displayOverall * 100, 
      label: 'AI Overall Similarity', 
      status: (displayOverall * 100) < 15 ? 'low' : (displayOverall * 100) < 30 ? 'medium' : 'high',
      color: (displayOverall * 100) < 15 ? 'bg-blue-600' : (displayOverall * 100) < 30 ? 'bg-amber-500' : 'bg-red-600'
    }
  }

  // Parse AI analysis into sections
  const parseAnalysis = (text: string) => {
    const sections = {
      aiAssessment: '',
      coreIdea: '',
      keyOverlaps: '',
      similarityReason: '',
      improvements: ''
    }

    // Generic SECTION parser - captures `SECTION <n>: <heading>` and the following block until the next SECTION or end
    const genericSectionRegex = /SECTION\s*(\d+)\s*[:\-]?\s*([^\n\r]*)\n?([\s\S]*?)(?=(?:SECTION\s*\d+\s*[:\-]?\s*[^\n\r]*\n?)|$)/ig
    let match: RegExpExecArray | null
    while ((match = genericSectionRegex.exec(text)) !== null) {
      const num = parseInt(match[1], 10)
      const heading = (match[2] || '').trim()
      const content = (match[3] || '').trim()

      // Map section number / heading keywords to UI sections
      if (num === 0 || /ai\s*similar/i.test(heading)) {
        sections.aiAssessment = content || sections.aiAssessment
      } else if (num === 1 || /core|concept|idea/i.test(heading)) {
        sections.coreIdea = content || sections.coreIdea
      } else if (num === 2 || /method|approach|key|overlap/i.test(heading)) {
        // If heading explicitly mentions Overlap or Key Overlaps, prefer keyOverlaps
        if (/overlap/i.test(heading)) {
          sections.keyOverlaps = content || sections.keyOverlaps
        } else {
          // Methodology content may be relevant to the similarity reason section
          sections.similarityReason = content || sections.similarityReason
        }
      } else if (num === 3 || /application|use case|similarity reason|why/i.test(heading)) {
        sections.similarityReason = content || sections.similarityReason
      } else if (num >= 4 || /improv|suggest|recommend|conclusion|summary/i.test(heading)) {
        sections.improvements = content || sections.improvements
      }
    }

    // Fallbacks: Try keyword-based extraction if specific SECTION headings were not present
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

    // If still empty, put the whole text into coreIdea as a last resort
    if (!sections.aiAssessment && !sections.coreIdea && !sections.keyOverlaps && !sections.similarityReason && !sections.improvements) {
      sections.coreIdea = text
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
  const extractedTitle = userConcept ? extractProposedTitle(userConcept) : null
  const displayTitle = extractedTitle || userTitle || 'Research Document'

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
            
            toast.error(friendlyMessage, { 
              duration: 8000,
            })
            
            throw new Error(friendlyMessage)
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
          
          toast.error(errorMessage, { duration: 5000 })
          throw new Error(errorMessage)
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
        toast.error(`Failed to generate AI analysis: ${errorMessage}`, { duration: 6000 })
        
        // Delay redirect to allow user to see the error
        setTimeout(() => router.push('/research-check'), 2000)
      }
    }

    loadAnalysis()
  }, [searchParams, router])

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
        {isLoading ? (
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
                      onClick={() => setActiveTab('ai-assessment')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'ai-assessment' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> AI Similarity Assessment
                    </button>
                    <button 
                      onClick={() => setActiveTab('core-idea')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'core-idea' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" /> Core Idea Match
                    </button>
                    <button 
                      onClick={() => setActiveTab('overlaps')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'overlaps' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-4 h-4" /> Key Overlaps
                    </button>
                    <button 
                      onClick={() => setActiveTab('reason')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'reason' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" /> Similarity Reason
                    </button>
                    <button 
                      onClick={() => setActiveTab('suggestions')}
                      className={`text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                        activeTab === 'suggestions' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4" /> Improvements
                    </button>
                  </nav>
                </div>
              </div>

              {/* Right Column: Dynamic Content */}
              <div className="lg:col-span-2">
                {/* TAB: AI ASSESSMENT */}
                {activeTab === 'ai-assessment' && sections?.aiAssessment && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <Sparkles className="w-6 h-6" />
                          <h3 className="text-xl font-bold">AI Similarity Assessment</h3>
                        </div>
                      </div>
                      <div className="p-8 text-slate-700 leading-8 text-base">
                        {cleanText(sections.aiAssessment).split('\n').map((paragraph, idx) => (
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

                {/* TAB: CORE IDEA */}
                {activeTab === 'core-idea' && sections?.coreIdea && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <BookOpen className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Core Idea Analysis</h3>
                        </div>
                      </div>
                      <div className="p-8 text-slate-700 leading-8 text-base">
                        {cleanText(sections.coreIdea).split('\n').map((paragraph, idx) => (
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

                {/* TAB: OVERLAPS */}
                {activeTab === 'overlaps' && sections?.keyOverlaps && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <Layers className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Key Overlap Areas</h3>
                        </div>
                      </div>
                      <div className="p-8">
                        <div className="space-y-4">
                          {cleanText(sections.keyOverlaps).split('\n').map((paragraph, idx) => (
                            paragraph.trim() && (
                              <div key={idx} className="flex gap-3 p-4 bg-purple-50 rounded-xl border-l-4 border-purple-500">
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                                <p className="text-slate-700 leading-7 text-base flex-1">
                                  {paragraph}
                                </p>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: REASON */}
                {activeTab === 'reason' && sections?.similarityReason && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-amber-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <BarChart3 className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Why These Similarities Exist</h3>
                        </div>
                      </div>
                      <div className="p-8 text-slate-700 leading-8 text-base">
                        {cleanText(sections.similarityReason).split('\n').map((paragraph, idx) => (
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

                {/* TAB: SUGGESTIONS */}
                {activeTab === 'suggestions' && sections?.improvements && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-lg p-6 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <Lightbulb className="w-6 h-6" />
                        <h3 className="font-bold text-xl">Differentiation Strategy</h3>
                      </div>
                      <p className="text-green-100 text-sm">
                        Follow these recommendations to improve the originality and distinctiveness of your research.
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-green-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5">
                        <div className="flex items-center gap-3 text-white">
                          <Lightbulb className="w-6 h-6" />
                          <h3 className="text-xl font-bold">Recommended Actions</h3>
                        </div>
                      </div>
                      <div className="p-8 space-y-4">
                        {cleanText(sections.improvements).split('\n').map((paragraph, idx) => (
                          paragraph.trim() && (
                            <div key={idx} className="bg-green-50 rounded-xl p-5 shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow">
                              <p className="text-slate-700 leading-7 text-base">
                                {paragraph}
                              </p>
                            </div>
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
