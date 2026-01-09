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
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"

function AIAnalysisContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [analysis, setAnalysis] = useState<string>("")
  const [activeTab, setActiveTab] = useState('ai-assessment')
  const [userTitle, setUserTitle] = useState('')
  const [existingTitle, setExistingTitle] = useState('')
  const [aiLexicalSimilarity, setAiLexicalSimilarity] = useState<number | null>(null)
  const [aiSemanticSimilarity, setAiSemanticSimilarity] = useState<number | null>(null)
  const [aiOverallSimilarity, setAiOverallSimilarity] = useState<number | null>(null)

  const lexicalSimilarity = parseFloat(searchParams.get('lexicalSimilarity') || '0')
  const semanticSimilarity = parseFloat(searchParams.get('semanticSimilarity') || '0')
  const overallSimilarity = parseFloat(searchParams.get('overallSimilarity') || '0')

  // Use AI similarities if available, otherwise fall back to algorithmic ones
  const displayLexical = aiLexicalSimilarity !== null ? aiLexicalSimilarity : lexicalSimilarity
  const displaySemantic = aiSemanticSimilarity !== null ? aiSemanticSimilarity : semanticSimilarity
  const displayOverall = aiOverallSimilarity !== null ? aiOverallSimilarity : overallSimilarity

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

    // Try to match sections with flexible patterns
    const section0Match = text.match(/SECTION 0[:\s]*AI Similarity Assessment\s*([\s\S]*?)(?=SECTION 1|$)/i)
    const section1Match = text.match(/SECTION 1[:\s]*Core Idea Match\s*([\s\S]*?)(?=SECTION 2|$)/i)
    const section2Match = text.match(/SECTION 2[:\s]*Key Overlaps\s*([\s\S]*?)(?=SECTION 3|$)/i)
    const section3Match = text.match(/SECTION 3[:\s]*Similarity Reason\s*([\s\S]*?)(?=SECTION 4|$)/i)
    const section4Match = text.match(/SECTION 4[:\s]*Improvement Suggestions\s*([\s\S]*?)$/i)

    if (section0Match) sections.aiAssessment = section0Match[1].trim()
    if (section1Match) sections.coreIdea = section1Match[1].trim()
    if (section2Match) sections.keyOverlaps = section2Match[1].trim()
    if (section3Match) sections.similarityReason = section3Match[1].trim()
    if (section4Match) sections.improvements = section4Match[1].trim()

    // If no sections found, try the entire text as core idea
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

  const sections = analysis ? parseAnalysis(analysis) : null

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        // Try to get data from sessionStorage first (for long text support)
        const aiAnalysisDataStr = sessionStorage.getItem('aiAnalysisData')
        let userTitleData, userConcept, existingTitleData, existingThesisBrief, lexicalSimilarity, semanticSimilarity, overallSimilarity

        if (aiAnalysisDataStr) {
          // Get data from sessionStorage and clear it
          const aiAnalysisData = JSON.parse(aiAnalysisDataStr)
          userTitleData = aiAnalysisData.userTitle
          userConcept = aiAnalysisData.userConcept
          existingTitleData = aiAnalysisData.existingTitle
          existingThesisBrief = aiAnalysisData.existingThesisBrief
          lexicalSimilarity = aiAnalysisData.lexicalSimilarity
          semanticSimilarity = aiAnalysisData.semanticSimilarity
          overallSimilarity = aiAnalysisData.overallSimilarity
          sessionStorage.removeItem('aiAnalysisData')
        } else {
          // Fallback to URL params (for backward compatibility)
          userTitleData = searchParams.get('userTitle')
          userConcept = searchParams.get('userConcept')
          existingTitleData = searchParams.get('existingTitle')
          existingThesisBrief = searchParams.get('existingThesisBrief')
          lexicalSimilarity = searchParams.get('lexicalSimilarity')
          semanticSimilarity = searchParams.get('semanticSimilarity')
          overallSimilarity = searchParams.get('overallSimilarity')
        }

        if (!userTitleData || !userConcept || !existingTitleData || !existingThesisBrief) {
          toast.error('Missing required data')
          router.push('/research-check')
          return
        }

        // Set titles for display
        setUserTitle(userTitleData)
        setExistingTitle(existingTitleData)

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
            lexicalSimilarity: parseFloat(lexicalSimilarity || '0'),
            semanticSimilarity: parseFloat(semanticSimilarity || '0'),
            overallSimilarity: parseFloat(overallSimilarity || '0'),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('AI Analysis API Error:', errorData)
          throw new Error(errorData.error || 'Failed to generate AI analysis')
        }

        const data = await response.json()
        setAnalysis(data.analysis)
        
        // Set AI-calculated similarities if available
        if (data.aiSimilarities) {
          if (data.aiSimilarities.lexical !== null) setAiLexicalSimilarity(data.aiSimilarities.lexical)
          if (data.aiSimilarities.semantic !== null) setAiSemanticSimilarity(data.aiSimilarities.semantic)
          if (data.aiSimilarities.overall !== null) setAiOverallSimilarity(data.aiSimilarities.overall)
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error generating AI analysis:', error)
        toast.error('Failed to generate AI analysis')
        router.push('/research-check')
      }
    }

    loadAnalysis()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white border border-gray-200 shadow">
                <Image src="/assets/bu-logo.png" width={40} height={40} alt="BU Logo" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">AI Research Analysis</h1>
                <p className="text-xs text-slate-600">Powered by Gemini AI</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <FileText className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="outline" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 max-w-6xl">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center border border-gray-100">
            <div className="relative inline-block">
              <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-5 animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Sparkles className="w-16 h-16 text-purple-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating AI Analysis</h2>
            <p className="text-gray-600">Our AI is analyzing the similarities between your research and the existing work...</p>
            <div className="mt-4 flex justify-center">
              <div className="w-56 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 animate-pulse"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Summary Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Analysis Summary
                </h2>
                <p className="text-indigo-100 text-xs mt-1">AI-powered comparison of your research with existing work</p>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Your Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                      <FileText className="w-4 h-4" />
                      Your Research
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed text-base">
                      {userTitle}
                    </p>
                  </div>
                  {/* Compared Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                      <FileText className="w-4 h-4" />
                      Compared With
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed text-base">
                      {existingTitle}
                    </p>
                  </div>
                </div>
                
                {/* AI Overall Similarity Percentage */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-semibold text-slate-900 mb-1 text-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                        AI Overall Similarity Percentage
                      </h3>
                      <p className="text-sm text-slate-600">
                        {(displayOverall * 100) < 15 
                          ? "Your research shows good originality with minimal overlap."
                          : (displayOverall * 100) < 30
                          ? "Some similarities detected. Review the recommendations below."
                          : "Significant similarities found. Revision strongly recommended."}
                      </p>
                    </div>
                    <div className={`px-5 py-2.5 rounded-xl font-bold text-xl shadow-md border-2 ${
                      (displayOverall * 100) < 15 ? 'bg-green-100 text-green-700 border-green-300' :
                      (displayOverall * 100) < 30 ? 'bg-amber-100 text-amber-700 border-amber-300' :
                      'bg-red-100 text-red-700 border-red-300'
                    }`}>
                      {(displayOverall * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area with Tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Column: Navigation */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sticky top-20">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 px-2">Analysis Sections</h3>
                  <nav className="flex flex-col gap-2">
                  <button 
                    onClick={() => setActiveTab('ai-assessment')}
                    className={`text-left px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === 'ai-assessment' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <Sparkles className="w-4 h-4" /> AI Similarity Assessment
                  </button>
                  <button 
                    onClick={() => setActiveTab('core-idea')}
                    className={`text-left px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === 'core-idea' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <BookOpen className="w-4 h-4" /> Core Idea Match
                  </button>
                  <button 
                    onClick={() => setActiveTab('overlaps')}
                    className={`text-left px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === 'overlaps' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <Layers className="w-4 h-4" /> Key Overlaps
                  </button>
                  <button 
                    onClick={() => setActiveTab('reason')}
                    className={`text-left px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === 'reason' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <BarChart3 className="w-4 h-4" /> Similarity Reason
                  </button>
                  <button 
                    onClick={() => setActiveTab('suggestions')}
                    className={`text-left px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === 'suggestions' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <Lightbulb className="w-4 h-4" /> Improvements
                  </button>
                </nav>
                </div>
              </div>

              {/* Right Column: Dynamic Content */}
              <div className="lg:col-span-3">
                {/* TAB: AI ASSESSMENT */}
                {activeTab === 'ai-assessment' && sections?.aiAssessment && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <Sparkles className="w-5 h-5" />
                          <h3 className="text-lg font-bold">AI Similarity Assessment</h3>
                        </div>
                      </div>
                      <div className="p-6 text-slate-700 leading-7 text-sm">
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
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <BookOpen className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Core Idea Analysis</h3>
                        </div>
                      </div>
                      <div className="p-6 text-slate-700 leading-7 text-sm">
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
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <Layers className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Key Overlap Areas</h3>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="space-y-4">
                          {cleanText(sections.keyOverlaps).split('\n').map((paragraph, idx) => (
                            paragraph.trim() && (
                              <div key={idx} className="flex gap-3">
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                                <p className="text-slate-700 leading-6 text-sm flex-1">
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
                    <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <BarChart3 className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Why These Similarities Exist</h3>
                        </div>
                      </div>
                      <div className="p-6 text-slate-700 leading-7 text-sm">
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
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-lg p-5 text-white">
                      <div className="flex items-center gap-3 mb-1">
                        <Lightbulb className="w-6 h-6" />
                        <h3 className="font-bold text-lg">Differentiation Strategy</h3>
                      </div>
                      <p className="text-green-50 text-xs">
                        Follow these recommendations to improve the originality and distinctiveness of your research.
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                          <Lightbulb className="w-5 h-5" />
                          <h3 className="text-lg font-bold">Recommended Actions</h3>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        {cleanText(sections.improvements).split('\n').map((paragraph, idx) => (
                          paragraph.trim() && (
                            <div key={idx} className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500 hover:shadow-sm transition-shadow">
                              <p className="text-slate-700 leading-6 text-sm">
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AIAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Analysis</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    }>
      <AIAnalysisContent />
    </Suspense>
  )
}
