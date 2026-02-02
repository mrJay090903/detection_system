"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { COURSES } from "@/lib/constants"
import { Check, ChevronRight, ChevronLeft, Upload, FileText, BarChart3, Home, Eye, Sparkles, AlertTriangle, CheckCircle, BookOpen, Calendar, Users, FileCheck, ScrollText } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileDragAndDrop } from "@/components/ui/file-drag-and-drop"
import { LoadingScreen } from "@/components/ui/loading-screen"

interface StepData {
  course: string
  title: string
  concept: string
  file: File | null
  fileContent: string
  analysisResult?: any
}

const steps = [
  { id: 1, name: "Select Course", icon: FileText },
  { id: 2, name: "Research Details", icon: Upload },
  { id: 3, name: "Analysis Report", icon: BarChart3 },
]

export default function ResearchCheckPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(1)
  const [stageLabel, setStageLabel] = useState("Extracting Content")
  const [selectedResearch, setSelectedResearch] = useState<any>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  // Helper function to clean titles by removing "BU Thematic Area:" prefix
  const cleanTitle = (title: string): string => {
    if (!title) return title
    return title.replace(/^bu thematic area:\s*/i, '').trim()
  }
  const [stepData, setStepData] = useState<StepData>({
    course: "",
    title: "",
    concept: "",
    file: null,
    fileContent: "",
  })

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('researchCheckState')
    if (savedState) {
      try {
        const { currentStep: savedStep, stepData: savedData } = JSON.parse(savedState)
        setCurrentStep(savedStep)
        setStepData(savedData)
        // Clear the saved state after restoring
        sessionStorage.removeItem('researchCheckState')
      } catch (error) {
        console.error('Error restoring state:', error)
      }
    }
  }, [])

  const handleNext = async () => {
    // Validation for each step
    if (currentStep === 1 && !stepData.course) {
      toast.error("Please select a course")
      return
    }
    
    if (currentStep === 2) {
      // Validate that we have content from either file or manual entry
      const hasFileContent = stepData.fileContent && stepData.fileContent.trim().length > 0
      const hasManualEntry = stepData.title && stepData.title.trim().length > 0 && 
                             stepData.concept && stepData.concept.trim().length > 0
      
      // Allow proceeding if either file is uploaded OR both title and concept are entered
      if (!hasFileContent && !hasManualEntry) {
        toast.error("Please either upload a file with content OR enter both title and concept manually")
        return
      }
      
      // Perform similarity check
      await handleSimilarityCheck()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSimilarityCheck = async () => {
    setIsLoading(true)
    setLoadingStage(1)
    setStageLabel("Processing Input")
    
    // Give React time to render the loading screen
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      // Use file content if available, otherwise use textarea content
      const textToCheck = stepData.fileContent.trim() || stepData.concept.trim()
      
      // Try to extract title from file content if no manual title is provided
      let titleToUse = stepData.title.trim()
      
      if (!titleToUse && stepData.fileContent) {
        // Try to extract title from file content
        const lines = stepData.fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        
        // Look for "Proposed Title:" or "Title:" prefix
        const titleLine = lines.find(line => 
          line.toLowerCase().startsWith('proposed title:') || 
          line.toLowerCase().startsWith('title:') ||
          line.toLowerCase().startsWith('research title:')
        )
        
        if (titleLine) {
          // Extract the title after the prefix
          titleToUse = titleLine
            .replace(/^(proposed title:|title:|research title:)/i, '')
            .trim()
          
          // Remove 'BU Thematic Area:' prefix if present
          titleToUse = titleToUse.replace(/^bu thematic area:\s*/i, '').trim()
          
          // Stop capturing at BU Thematic Area if it appears later
          const buThematicIndex = titleToUse.toLowerCase().indexOf('bu thematic area')
          if (buThematicIndex !== -1) {
            titleToUse = titleToUse.substring(0, buThematicIndex).trim()
          }
          
          console.log('Extracted title from labeled line:', titleToUse)
        } else if (lines.length > 0) {
          // Use first non-empty line as title
          const firstLine = lines[0]
          titleToUse = firstLine.length > 0 && firstLine.length < 200 ? firstLine : 'Research Document'
          console.log('Using first line as title:', titleToUse)
        }
      }
      
      if (!titleToUse) {
        titleToUse = 'Untitled Research'
      }

      console.log('Submitting to API:', {
        title: titleToUse,
        conceptLength: textToCheck.length,
        conceptPreview: textToCheck.substring(0, 100),
        titleSource: stepData.title.trim() ? 'manual' : 'extracted'
      })

      // Stage 2: Algorithm Analysis
      await new Promise(resolve => setTimeout(resolve, 800))
      setLoadingStage(2)
      setStageLabel("Algorithm Analysis")

      // Perform similarity check
      const response = await fetch('/api/similarity/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedTitle: titleToUse,
          proposedConcept: textToCheck,
        }),
      })

      // Stage 3: Similarity Detection
      setLoadingStage(3)
      setStageLabel("Similarity Detection")

      console.log('API Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Similarity check failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        throw new Error(errorData.error || `Failed to check similarity (${response.status})`)
      }

      // Stage 4: Generating Report
      setLoadingStage(4)
      setStageLabel("Generating Report")
      await new Promise(resolve => setTimeout(resolve, 500))

      const result = await response.json()
      
      // Stage 5: Finalizing Results
      setLoadingStage(5)
      setStageLabel("Finalizing Results")
      await new Promise(resolve => setTimeout(resolve, 300))
      
      console.log('Similarity check successful:', {
        hasResult: !!result,
        hasSimilarities: !!(result.similarities),
        similaritiesCount: result.similarities?.length
      })
      
      setStepData(prev => ({
        ...prev,
        analysisResult: result,
      }))

      setCurrentStep(3)
    } catch (error) {
      console.error('Error checking similarity:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to analyze research. Please try again.')
    } finally {
      setIsLoading(false)
      setLoadingStage(1)
    }
  }

  const handleFileContentRead = (content: string, title?: string) => {
    console.log('File content read:', {
      length: content.length,
      preview: content.substring(0, 100),
      isEmpty: !content || content.trim().length === 0,
      title: title
    })
    
    // Show warning if content is empty
    if (!content || content.trim().length === 0) {
      toast.error('No text could be extracted from the file. Please try a different file or enter the content manually.')
      return
    }

    // Auto-populate both title and concept fields with extracted content
    const updates: Partial<StepData> = {
      fileContent: content,
    }

    // If title was extracted from API, use it
    if (title && title !== 'Untitled Research') {
      updates.title = title
    }

    // Always populate concept with the extracted content so user can edit
    updates.concept = content

    setStepData(prev => ({ ...prev, ...updates }))
    
    // Show success message
    if (title && title !== 'Untitled Research') {
      toast.success(`✓ File uploaded! Title and content extracted. You can now edit the fields below.`, {
        duration: 5000
      })
    } else {
      toast.success(`✓ File uploaded successfully! ${content.length.toLocaleString()} characters extracted. You can now edit the fields below.`)
    }
  }

  // Auto-analyze function - directly analyze file without manual input
  const handleAutoAnalyze = async () => {
    if (!stepData.fileContent) {
      toast.error('Please upload a file first')
      return
    }

    setIsLoading(true)
    
    try {
      // Extract title from file content (first line or from prefix), excluding BU Thematic Area
      const lines = stepData.fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
      const titleLine = lines.find(line => {
        const lowerLine = line.toLowerCase()
        const isTitleLine = lowerLine.startsWith('proposed title:') || 
                           lowerLine.startsWith('title:') ||
                           lowerLine.startsWith('research title:')
        const isBUThematicArea = lowerLine.includes('bu thematic area:')
        return isTitleLine && !isBUThematicArea
      })
      
      let extractedTitle = 'Untitled Research'
      if (titleLine) {
        // Extract just the title after the prefix
        extractedTitle = titleLine
          .replace(/^(proposed title:|title:|research title:)/i, '')
          .trim()
          .split(/[\n\r]/)[0]  // Take only first line
        
        // Remove 'BU Thematic Area:' prefix if present
        extractedTitle = extractedTitle.replace(/^bu thematic area:\s*/i, '').trim()
        
        // Stop capturing at BU Thematic Area if it appears later
        const buThematicIndex = extractedTitle.toLowerCase().indexOf('bu thematic area')
        if (buThematicIndex !== -1) {
          extractedTitle = extractedTitle.substring(0, buThematicIndex).trim()
        }
        
        // Take only the first sentence before a period (if any)
        extractedTitle = extractedTitle.split(/[.]/)[0].trim()
      } else if (lines.length > 0) {
        // Find first line that's not BU Thematic Area and is short enough
        const firstValidLine = lines.find(line => 
          !line.toLowerCase().includes('bu thematic area:') && line.length < 200
        )
        if (firstValidLine) {
          extractedTitle = firstValidLine
        }
      }

      // Limit title to 500 chars (API limit)
      if (extractedTitle.length > 500) {
        extractedTitle = extractedTitle.substring(0, 500).trim()
      }

      toast.loading('Analyzing document automatically...', { id: 'auto-analyze' })

      // Perform similarity check
      const response = await fetch('/api/similarity/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedTitle: extractedTitle,
          proposedConcept: stepData.fileContent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to analyze (${response.status})`)
      }

      const result = await response.json()
      
      setStepData(prev => ({
        ...prev,
        title: extractedTitle,
        concept: stepData.fileContent,
        analysisResult: result,
      }))

      toast.success('Analysis complete!', { id: 'auto-analyze' })
      setCurrentStep(3)
    } catch (error) {
      console.error('Error in auto-analyze:', error)
      toast.error(error instanceof Error ? error.message : 'Auto-analysis failed', { id: 'auto-analyze' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setStepData({
      course: "",
      title: "",
      concept: "",
      file: null,
      fileContent: "",
    })
  }

  return (
    <>
      {/* Loading Screen Overlay */}
      {isLoading && (
        <LoadingScreen 
          currentStage={loadingStage} 
          totalStages={5}
          stageLabel={stageLabel}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header - Fixed */}
      <header className="bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 w-full z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white border border-gray-200 shadow">
                <Image src="/assets/bu-logo.png" width={40} height={40} alt="BU Logo" className="object-cover" />
              </div>
              <div className="font-bold tracking-wide text-lg">
                <span className="text-[#3896DA]">BICOL</span> <span className="text-[#F86D1B]">UNIVERSITY</span>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
  

          {/* Stepper Card (Stepper Navigation removed) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-8 md:p-12"
          >

            {/* Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="min-h-[400px]"
              >
                {/* Step 1: Course Selection */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-800">Select Your Course</h3>
                      <p className="text-gray-600 mb-6">Choose your program to help us find relevant research comparisons</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {COURSES.map((course, index) => (
                          <motion.button
                            key={course}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setStepData({ ...stepData, course })}
                            className={`
                              p-4 rounded-lg border-2 text-left transition-all duration-200
                              ${stepData.course === course
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${
                                stepData.course === course ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                {course}
                              </span>
                              {stepData.course === course && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <Check className="w-5 h-5 text-blue-600" />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      
                      {stepData.course && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <p className="text-sm text-green-800">
                            <strong>Selected:</strong> {stepData.course}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Title and Concept/File Upload */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div>
                      <div className="text-center mb-8">
                        <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                          Enter Research Details
                        </h3>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                          Enter your research details manually below, or upload your research document for instant extraction
                        </p>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Manual Entry Form - Primary Option */}
                        <div className="grid gap-6">
                          {/* Title Input */}
                          <div className="group">
                            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 border-2 border-gray-200 hover:border-blue-400 transition-all duration-300 hover:shadow-lg">
                              <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <label htmlFor="title" className="text-base font-bold text-gray-800">
                                  Research Title <span className="text-red-500">*</span>
                                </label>
                              </div>
                              <input
                                id="title"
                                type="text"
                                placeholder="Enter your research title here..."
                                value={stepData.title}
                                onChange={(e) => setStepData({ ...stepData, title: e.target.value })}
                                className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                              />
                              {stepData.title && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="font-semibold">{stepData.title.length} characters • Ready for analysis</span>
                                </motion.div>
                              )}
                            </div>
                          </div>

                          {/* Concept/Thesis Brief Input */}
                          <div className="group">
                            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg">
                              <div className="flex items-center gap-2 mb-3">
                                <ScrollText className="w-5 h-5 text-purple-600" />
                                <label htmlFor="concept" className="text-base font-bold text-gray-800">
                                  Research Concept / Thesis Brief <span className="text-red-500">*</span>
                                </label>
                              </div>
                              <textarea
                                id="concept"
                                placeholder="Enter your research concept, abstract, or thesis brief here..."
                                value={stepData.concept}
                                onChange={(e) => setStepData({ ...stepData, concept: e.target.value })}
                                rows={8}
                                className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none bg-white"
                              />
                              {stepData.concept && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-3 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="font-semibold">Content added</span>
                                  </div>
                                  <div className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                                    {stepData.concept.length.toLocaleString()} characters • 
                                    {Math.ceil(stepData.concept.split(/\s+/).length).toLocaleString()} words
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Divider with OR */}
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t-2 border-gray-300"></div>
                          </div>
                          <div className="relative flex justify-center">
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 font-medium rounded-full text-xs border border-gray-300">
                              OR UPLOAD FILE
                            </span>
                          </div>
                        </div>

                        {/* File Upload Section - Compact */}
                        <div className="text-center">
                          <FileDragAndDrop onFileContentRead={handleFileContentRead} />
                          <p className="text-xs text-gray-500 mt-2">Drag & drop PDF or DOCX file, or click to browse</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Analysis Report */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-800">Similarity Analysis Report</h3>
                      
                      {stepData.analysisResult ? (
                        <div className="space-y-6">
                          {/* Display the top match score as overall similarity */}
                          {stepData.analysisResult.similarities && stepData.analysisResult.similarities.length > 0 && (
                            <>
                              <div className="p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="text-2xl font-bold text-gray-800">Highest Similarity Detected</h4>
                                  <div className={`text-5xl font-bold ${
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'text-red-600' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'text-orange-600' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'text-yellow-600' :
                                    'text-green-600'
                                  }`}>
                                    {(stepData.analysisResult.similarities[0].overallSimilarity * 100).toFixed(1)}%
                                  </div>
                                </div>
                                
                                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stepData.analysisResult.similarities[0].overallSimilarity * 100}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full transition-all duration-500 ${
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'bg-red-500' :
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'bg-orange-500' :
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'bg-yellow-500' :
                                      'bg-green-500'
                                    }`}
                                  />
                                </div>

                                {/* Interpretation Message */}
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.5 }}
                                  className={`mt-6 p-4 rounded-lg ${
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'bg-red-100 border border-red-300' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'bg-orange-100 border border-orange-300' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'bg-yellow-100 border border-yellow-300' :
                                    'bg-green-100 border border-green-300'
                                  }`}
                                >
                                  {(stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? (
                                    <div>
                                      <p className="font-bold text-red-800 mb-2">⚠️ High Similarity - Often Rejected</p>
                                      <p className="text-sm text-red-700">
                                        Similarity scores above 30% are often rejected. Significant revision is required. 
                                        Please rewrite substantial portions of your research to improve originality.
                                      </p>
                                    </div>
                                  ) : (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? (
                                    <div>
                                      <p className="font-bold text-orange-800 mb-2">⚠️ Moderate Similarity - Requires Revision</p>
                                      <p className="text-sm text-orange-700">
                                        Similarity scores above 20% typically require revision. Please review and revise 
                                        sections with high similarity to improve originality before submission.
                                      </p>
                                    </div>
                                  ) : (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? (
                                    <div>
                                      <p className="font-bold text-yellow-800 mb-2">⚠️ Acceptable with Caution</p>
                                      <p className="text-sm text-yellow-700">
                                        Similarity between 15-20% is borderline. Review similar sections and consider minor 
                                        revisions to ensure all sources are properly cited.
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="font-bold text-green-800 mb-2">✓ Acceptable Similarity Level</p>
                                      <p className="text-sm text-green-700">
                                        Below 10-15% is generally considered safe and acceptable for research publications 
                                        and postgraduate theses. Ensure all references are properly cited.
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              </div>

                              {/* Similarity Guidelines */}
                              <div className="p-6 bg-white border border-gray-200 rounded-lg">
                                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5" />
                                  Similarity Score Guidelines
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Below 10-15%: Safe & Acceptable</p>
                                      <p className="text-xs text-gray-600">Generally considered acceptable for research publications and postgraduate theses.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">15-20%: Borderline</p>
                                      <p className="text-xs text-gray-600">May be acceptable but requires careful review and proper citations.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-orange-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Above 20%: Requires Revision</p>
                                      <p className="text-xs text-gray-600">Typically requires revision before submission.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Above 30%: Often Rejected</p>
                                      <p className="text-xs text-gray-600">Significant revision required; may be rejected without substantial changes.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Your Research Document Preview */}
                              {stepData.fileContent && (
                                <motion.div
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl"
                                >
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="text-lg font-semibold text-gray-800">Your Research Document</h4>
                                      <p className="text-sm text-gray-600">
                                        {stepData.fileContent.length.toLocaleString()} characters • 
                                        {Math.ceil(stepData.fileContent.split(/\s+/).length)} words
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white rounded-lg p-5 border border-indigo-100 max-h-[400px] overflow-y-auto">
                                    <div className="prose prose-sm max-w-none">
                                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {stepData.fileContent.substring(0, 2000)}
                                        {stepData.fileContent.length > 2000 && (
                                          <span className="text-gray-500 italic">
                                            ... (showing first 2000 characters)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-4 flex items-center gap-2 text-xs text-indigo-700">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Document content loaded and analyzed</span>
                                  </div>
                                </motion.div>
                              )}

                              <div className="space-y-4">
                                <h4 className="text-lg font-semibold text-gray-800">Similar Research Found </h4>
                                {stepData.analysisResult.similarities.map((match: any, index: number) => (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <h5 className="font-medium text-gray-800 mb-2">{cleanTitle(match.title)}</h5>
                                        <p className="text-sm text-gray-600">Course: {match.course} | Year: {match.year}</p>
                                      </div>
                                      <div className="ml-4">
                                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                                          (match.overallSimilarity * 100) > 30 ? 'bg-red-100 text-red-700' :
                                          (match.overallSimilarity * 100) > 20 ? 'bg-orange-100 text-orange-700' :
                                          (match.overallSimilarity * 100) > 15 ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>
                                          {(match.overallSimilarity * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          // Prepare the concept text - use file content if available, otherwise concept field
                                          const userConceptText = (stepData.fileContent || '').trim() || (stepData.concept || '').trim()
                                          
                                          // Try to extract title from file content if no manual title
                                          let userTitleText = (stepData.title || '').trim()
                                          
                                          if (!userTitleText && stepData.fileContent) {
                                            // Try to extract title from file content using same logic, excluding BU Thematic Area
                                            const lines = stepData.fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                                            
                                            // Look for "Proposed Title:" or "Title:" prefix, but exclude BU Thematic Area
                                            const titleLine = lines.find(line => {
                                              const lowerLine = line.toLowerCase()
                                              const isTitleLine = lowerLine.startsWith('proposed title:') || 
                                                                 lowerLine.startsWith('title:') ||
                                                                 lowerLine.startsWith('research title:')
                                              const isBUThematicArea = lowerLine.includes('bu thematic area:')
                                              return isTitleLine && !isBUThematicArea
                                            })
                                            
                                            if (titleLine) {
                                              // Extract the title after the prefix
                                              userTitleText = titleLine
                                                .replace(/^(proposed title:|title:|research title:)/i, '')
                                                .trim()
                                                .split(/[\n\r]/)[0]  // Take only first line
                                                .substring(0, 500)   // Limit to 500 chars
                                                .trim()
                                              console.log('Extracted title from labeled line for AI:', userTitleText)
                                            } else if (lines.length > 0) {
                                              // Use first non-empty line as title that's not BU Thematic Area
                                              const firstValidLine = lines.find(line => 
                                                !line.toLowerCase().includes('bu thematic area:') && 
                                                line.length > 0 && 
                                                line.length < 200
                                              )
                                              userTitleText = firstValidLine || 'Research Document'
                                              console.log('Using first line as title for AI:', userTitleText)
                                            }
                                          }
                                          
                                          if (!userTitleText) {
                                            userTitleText = 'Untitled Research'
                                          }
                                          
                                          // Validate that we have the required concept data
                                          if (!userConceptText || userConceptText.length < 50) {
                                            toast.error('Insufficient content for AI analysis. Please ensure your file or manual entry has enough text (at least 50 characters).')
                                            return
                                          }
                                          
                                          console.log('Analyzing with AI:', {
                                            userTitle: userTitleText,
                                            userConceptLength: userConceptText.length,
                                            existingTitle: match.title,
                                            existingThesisBriefLength: match.thesis_brief?.length || 0
                                          })
                                          
                                          // Store the current state in sessionStorage
                                          sessionStorage.setItem('researchCheckState', JSON.stringify({
                                            currentStep: 3,
                                            stepData: stepData
                                          }))
                                          
                                          // Store AI analysis data in sessionStorage to handle long text
                                          sessionStorage.setItem('aiAnalysisData', JSON.stringify({
                                            userTitle: userTitleText,
                                            userConcept: userConceptText,
                                            existingTitle: match.title,
                                            existingThesisBrief: match.thesis_brief,
                                            lexicalSimilarity: (match.lexicalSimilarity || match.overallSimilarity || 0).toString(),
                                            semanticSimilarity: (match.semanticSimilarity || match.overallSimilarity || 0).toString(),
                                            overallSimilarity: (match.overallSimilarity || 0).toString(),
                                          }))
                                          
                                          window.location.href = '/analysis-reports'
                                        }}
                                        className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        Analyze with AI
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedResearch(match)
                                          setShowDetailsDialog(true)
                                        }}
                                        className="gap-2"
                                      >
                                        <Eye className="w-4 h-4" />
                                        View Details
                                      </Button>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Note:</strong> This analysis is for reference only. Please consult with your advisor 
                              for guidance on improving the originality of your research.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <BarChart3 className="w-20 h-20 text-gray-400 mx-auto mb-4 animate-pulse" />
                          <p className="text-gray-600 text-lg">Processing your analysis...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isLoading}
                className="gap-2 h-12 px-6"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={isLoading}
                  className="gap-2 h-12 px-8 bg-[#fca311] hover:bg-[#e59200]"
                  size="lg"
                >
                  {isLoading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      {currentStep === 2 ? 'Analyze' : 'Next'}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button 
                    onClick={handleReset} 
                    variant="outline"
                    className="gap-2 h-12 px-6"
                    size="lg"
                  >
                    Check Another
                  </Button>
                  <Link href="/">
                    <Button className="gap-2 h-12 px-8 bg-[#fca311] hover:bg-[#e59200]" size="lg">
                      Done
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Research Details Modal - Pure Tailwind */}
      {showDetailsDialog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailsDialog(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" onClick={() => setShowDetailsDialog(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 border-b border-white/20">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                <button
                  onClick={() => setShowDetailsDialog(false)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="relative flex flex-col items-center justify-center gap-2 py-2">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white">Research Details</h2>
                  </div>
                  <p className="text-indigo-100 mt-1 text-center">Comprehensive information about the similar research found</p>
                </div>
              </div>
              
              {/* Scrollable Content */}
              {selectedResearch && (
                <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-8 py-6">
                  <div className="space-y-6">
                {/* Similarity Score - Enhanced */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden p-6 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl shadow-xl"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Overall Similarity Score
                      </h3>
                      <p className="text-sm text-blue-100">Multi-algorithm analysis result</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`inline-flex items-center justify-center px-8 py-4 rounded-2xl text-4xl font-black shadow-2xl ${
                          (selectedResearch.overallSimilarity * 100) > 30 ? 'bg-red-500 text-white' :
                          (selectedResearch.overallSimilarity * 100) > 20 ? 'bg-orange-500 text-white' :
                          (selectedResearch.overallSimilarity * 100) > 15 ? 'bg-yellow-400 text-gray-900' :
                          'bg-green-500 text-white'
                        }`}>
                          {(selectedResearch.overallSimilarity * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-white/80 mt-2 font-medium">
                          {(selectedResearch.overallSimilarity * 100) > 30 ? 'High Similarity' :
                           (selectedResearch.overallSimilarity * 100) > 20 ? 'Moderate Similarity' :
                           (selectedResearch.overallSimilarity * 100) > 15 ? 'Low Similarity' :
                           'Very Low Similarity'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedResearch.overallSimilarity * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-white shadow-lg"
                    />
                  </div>
                </motion.div>

                {/* Research Information - Card Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Course Card */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-xs font-bold text-blue-700 uppercase tracking-wider">Course</Label>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{selectedResearch.course}</p>
                  </motion.div>

                  {/* Year Card */}
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-xs font-bold text-purple-700 uppercase tracking-wider">Year</Label>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{selectedResearch.year}</p>
                  </motion.div>
                </div>

                {/* Title Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-xl border-2 border-gray-300 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-700 to-slate-900 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Research Title</Label>
                  </div>
                  <p className="text-xl font-bold text-gray-900 leading-relaxed">{cleanTitle(selectedResearch.title)}</p>
                </motion.div>

                {/* Researchers Card */}
                {selectedResearch.researchers && selectedResearch.researchers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border-2 border-emerald-200 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <Label className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                        Researcher{selectedResearch.researchers.length > 1 ? 's' : ''} ({selectedResearch.researchers.length})
                      </Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedResearch.researchers.map((researcher: string, index: number) => (
                        <motion.span 
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-emerald-300 rounded-full text-sm font-semibold text-emerald-900 shadow-sm hover:shadow-md hover:scale-105 transition-all"
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                            {index + 1}
                          </div>
                          {researcher}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Thesis Brief Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border-2 border-amber-300 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <ScrollText className="w-5 h-5 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-amber-700 uppercase tracking-wider">Thesis Brief / Abstract</Label>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-amber-200 max-h-80 overflow-y-auto shadow-inner">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                      {selectedResearch.thesis_brief}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                    <FileText className="w-3 h-3" />
                    <span>{selectedResearch.thesis_brief.length.toLocaleString()} characters</span>
                  </div>
                </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
