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
  BookOpen,
  Download,
  Printer
} from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"

function AnalysisReportsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [analysis, setAnalysis] = useState<string>("")
  const [activeTab, setActiveTab] = useState('ai-assessment')

  const lexicalSimilarity = parseFloat(searchParams.get('lexicalSimilarity') || '0')
  const semanticSimilarity = parseFloat(searchParams.get('semanticSimilarity') || '0')
  const overallSimilarity = parseFloat(searchParams.get('overallSimilarity') || '0')

  const metrics = {
    lexical: { 
      score: lexicalSimilarity * 100, 
      label: 'Lexical Similarity', 
      status: (lexicalSimilarity * 100) < 15 ? 'low' : (lexicalSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (lexicalSimilarity * 100) < 15 ? 'bg-green-500' : (lexicalSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    semantic: { 
      score: semanticSimilarity * 100, 
      label: 'Semantic Similarity', 
      status: (semanticSimilarity * 100) < 15 ? 'low' : (semanticSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (semanticSimilarity * 100) < 15 ? 'bg-green-500' : (semanticSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    overall: { 
      score: overallSimilarity * 100, 
      label: 'Overall Similarity', 
      status: (overallSimilarity * 100) < 15 ? 'low' : (overallSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (overallSimilarity * 100) < 15 ? 'bg-blue-600' : (overallSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-600'
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
        // Get data from URL params
        const userTitle = searchParams.get('userTitle')
        const userConcept = searchParams.get('userConcept')
        const existingTitle = searchParams.get('existingTitle')
        const existingAbstract = searchParams.get('existingAbstract')
        const lexicalSimilarity = searchParams.get('lexicalSimilarity')
        const semanticSimilarity = searchParams.get('semanticSimilarity')
        const overallSimilarity = searchParams.get('overallSimilarity')

        if (!userTitle || !userConcept || !existingTitle || !existingAbstract) {
          toast.error('Missing required data')
          router.push('/research-check')
          return
        }

        const response = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userTitle,
            userConcept,
            existingTitle,
            existingAbstract,
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
        setIsLoading(false)
      } catch (error) {
        console.error('Error generating AI analysis:', error)
        toast.error('Failed to generate AI analysis')
        router.push('/research-check')
      }
    }

    loadAnalysis()
  }, [searchParams, router])

  const handleExport = () => {
    window.print()
  }

  const handleDownload = () => {
    const content = `
RESEARCH COMPARATIVE ANALYSIS REPORT
Generated: ${new Date().toLocaleDateString()}

Your Research: ${searchParams.get('userTitle')}
Compared With: ${searchParams.get('existingTitle')}

OVERALL SIMILARITY: ${(overallSimilarity * 100).toFixed(1)}%
Lexical Similarity: ${(lexicalSimilarity * 100).toFixed(1)}%
Semantic Similarity: ${(semanticSimilarity * 100).toFixed(1)}%

${analysis}
    `.trim()

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-report-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Report downloaded successfully')
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload} className="gap-2 hover:bg-slate-100">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button variant="outline" onClick={handleExport} className="gap-2 hover:bg-slate-100">
                <Printer className="w-4 h-4" />
                Print PDF
              </Button>
              <Button variant="outline" onClick={() => router.push('/research-check')} className="gap-2 hover:bg-slate-100">
                <ArrowLeft className="w-4 h-4" />
                Back to Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="relative inline-block">
              <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Sparkles className="w-16 h-16 text-purple-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating AI Analysis</h2>
            <p className="text-gray-600">Our AI is analyzing the similarities between your research and the existing work...</p>
            <div className="mt-4 flex justify-center">
              <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 animate-pulse"></div>
              </div>
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
                  {/* Your Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold uppercase tracking-wide">
                      <FileText className="w-4 h-4" />
                      Your Research
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed text-lg">
                      {searchParams.get('userTitle')}
                    </p>
                  </div>
                  {/* Compared Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold uppercase tracking-wide">
                      <FileText className="w-4 h-4" />
                      Compared With
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed text-lg">
                      {searchParams.get('existingTitle')}
                    </p>
                  </div>
                </div>
                
                {/* Overall Assessment */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-semibold text-slate-900 mb-1 text-lg">Overall Assessment</h3>
                      <p className="text-sm text-slate-600">
                        {(overallSimilarity * 100) < 15 
                          ? "✓ Your research shows good originality with minimal overlap."
                          : (overallSimilarity * 100) < 30
                          ? "⚠ Some similarities detected. Review the recommendations below."
                          : "⚠ Significant similarities found. Revision strongly recommended."}
                      </p>
                    </div>
                    <div className={`px-6 py-3 rounded-xl font-bold text-2xl shadow-lg ${
                      (overallSimilarity * 100) < 15 ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                      (overallSimilarity * 100) < 30 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                      'bg-red-100 text-red-700 border-2 border-red-300'
                    }`}>
                      {(overallSimilarity * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

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
