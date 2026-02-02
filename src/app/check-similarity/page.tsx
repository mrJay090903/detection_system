"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Loader2, ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { FileDragAndDrop } from "@/components/ui/file-drag-and-drop"
import { LoadingScreen } from "@/components/ui/loading-screen"

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function CheckSimilarityPage() {
  const [proposedTitle, setProposedTitle] = useState("")
  const [proposedConcept, setProposedConcept] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(1)
  const [stageLabel, setStageLabel] = useState("Extracting Content")

  // Prevent scrolling when loading
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isLoading])

  const handleCheckSimilarity = async () => {
    // Use file content if available, otherwise use textarea content
    const conceptToCheck = fileContent.trim() || proposedConcept.trim()
    
    if (!proposedTitle.trim() || !conceptToCheck) {
      toast.error("Please fill in both research title and concept (or upload a file)")
      return
    }

    // Set loading state first
    setIsLoading(true)
    setLoadingStage(1)
    setStageLabel("Processing Input")

    // Give React time to render the loading screen
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      // Log what we're sending for debugging
      const payload = {
        proposedTitle: proposedTitle.trim(),
        proposedConcept: conceptToCheck,
      }
      
      console.log("Sending to API:", {
        proposedTitle: payload.proposedTitle,
        proposedConceptLength: payload.proposedConcept.length,
        proposedConceptPreview: payload.proposedConcept.substring(0, 100)
      })

      // Stage 2: Algorithm Analysis
      await new Promise(resolve => setTimeout(resolve, 800))
      setLoadingStage(2)
      setStageLabel("Algorithm Analysis")

      // Call the API directly to avoid URL length limits with large file content
      const response = await fetch("/api/similarity/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      // Stage 3: Similarity Detection
      setLoadingStage(3)
      setStageLabel("Similarity Detection")

      const data = await response.json()

      console.log("API Response:", {
        ok: response.ok,
        status: response.status,
        data: data
      })

      if (!response.ok) {
        throw new Error(data.error || "Failed to check similarity")
      }

      // Stage 4: Generating Report
      setLoadingStage(4)
      setStageLabel("Generating Report")
      await new Promise(resolve => setTimeout(resolve, 800))

      if (data.success) {
        // Stage 5: Finalizing Results
        setLoadingStage(5)
        setStageLabel("Finalizing Results")
        await new Promise(resolve => setTimeout(resolve, 500))

        // Store result in sessionStorage and navigate to results page
        sessionStorage.setItem("similarityResult", JSON.stringify(data))
        // Store file content if it was used
        if (fileContent.trim()) {
          sessionStorage.setItem("uploadedFileContent", fileContent.trim())
        }
        window.location.href = "/similarity-results"
      } else {
        throw new Error(data.error || "Unknown error occurred")
      }
    } catch (err) {
      console.error("Error checking similarity:", err)
      toast.error(err instanceof Error ? err.message : "Failed to check similarity")
      setIsLoading(false)
      setLoadingStage(1)
    }
  }

  const handleFileContentRead = (content: string, title?: string) => {
    // Store file content but don't display it in textarea
    setFileContent(content)
    
    // If title was extracted from the PDF, auto-fill the title field
    if (title && title !== 'Untitled Research' && !proposedTitle.trim()) {
      setProposedTitle(title)
    }
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

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header with Gradient Background */}
      <header className="relative bg-gradient-to-br from-[#2d4a5f] via-[#4a667d] to-[#7a6a5a] text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        
        <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-10">
          <Link href="/">
            <motion.div 
              className="flex items-center gap-3 group cursor-pointer"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <Image src="/assets/bu-logo.png" width={48} height={48} alt="BU Logo" className="object-cover" />
              </div>
              <div className="font-bold tracking-wide uppercase text-lg md:text-xl">
                <span className="text-white drop-shadow-lg">BICOL</span> <span className="text-[#fca311] drop-shadow-lg">UNIVERSITY</span>
              </div>
            </motion.div>
          </Link>

          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-semibold border border-white/30 hover:border-white transition-all duration-300 backdrop-blur-md inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </motion.button>
          </Link>
        </nav>
        
        {/* Hero Section */}
        <div className="container mx-auto px-6 py-16 relative z-10">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center space-y-6 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="inline-block">
              <span className="bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold border border-white/20 shadow-lg inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI-Powered Similarity Detection
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-2xl"
            >
              Check Your Research
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-gray-100 text-lg md:text-xl leading-relaxed font-light max-w-2xl mx-auto"
            >
              Upload your research paper or paste your concept to detect similarities and ensure originality
            </motion.p>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          {/* Input Form */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d4a5f] px-8 py-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-[#fca311]" />
                Submit Your Research
              </h2>
              <p className="text-gray-200 mt-2">Fill in the details below to check for similarities</p>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <Label htmlFor="title" className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">1</span>
                  Research Title
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Enter your research title"
                  value={proposedTitle}
                  onChange={(e) => setProposedTitle(e.target.value)}
                  disabled={isLoading}
                  className="h-12 text-base border-2 focus:border-[#fca311] transition-colors"
                />
              </div>

              <div>
                <Label htmlFor="concept-file" className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">2</span>
                  Upload Research Document (Optional)
                </Label>
                <FileDragAndDrop onFileContentRead={handleFileContentRead} />
              </div>

              <div>
                <Label htmlFor="concept" className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">3</span>
                  Research Concept
                </Label>
                <Textarea
                  id="concept"
                  rows={8}
                  placeholder={fileContent ? "File content loaded. You can edit or add more text here..." : "Describe your research concept in detail..."}
                  value={proposedConcept}
                  onChange={(e) => setProposedConcept(e.target.value)}
                  disabled={isLoading}
                  className="text-base border-2 focus:border-[#fca311] transition-colors resize-none"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {fileContent ? `${fileContent.length.toLocaleString()} characters from file` : 'Provide a detailed description of your research'}
                </p>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  className="w-full h-14 text-lg font-bold bg-[#fca311] hover:bg-[#e59200] text-white shadow-lg hover:shadow-xl transition-all duration-300" 
                  onClick={handleCheckSimilarity}
                  disabled={isLoading || !proposedTitle?.trim() || (!proposedConcept?.trim() && !fileContent?.trim())}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing Your Research...
                    </>
                  ) : (
                    <>
                      Check Similarity Now
                      <CheckCircle2 className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </div>

          
        </motion.div>
      </main>
    </div>
    </>
  )
}
