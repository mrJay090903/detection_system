"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Sparkles, CheckCircle2, Brain, FileSearch, BarChart3, Shield } from "lucide-react"

interface LoadingScreenProps {
  currentStage?: number
  totalStages?: number
  stageLabel?: string
}

const informationalMessages = [
  {
    title: "Processing Your Research Input",
    message: "Analyzing your research title and concept. Preparing your submission for comprehensive similarity detection against our academic database."
  },
  {
    title: "Running Algorithm-Based Analysis",
    message: "Executing multi-algorithm similarity detection using TF-IDF, N-Gram, Cosine Similarity, Fingerprinting, and Rabin-Karp on database entries."
  },
  {
    title: "Comparing Against Database",
    message: "Scanning through the entire research database to identify the most similar existing studies. Filtering top candidates for detailed evaluation."
  },
  {
    title: "Computing Similarity Scores",
    message: "Calculating lexical, semantic, and conceptual similarity percentages. Applying multi-algorithm composite scoring for accurate detection."
  },
  {
    title: "Evaluating Problem Similarity",
    message: "Analyzing if your research addresses the same core problem as existing studies. Determining acceptance status based on academic standards."
  },
  {
    title: "Generating Detailed Report",
    message: "Compiling comprehensive analysis with similarity breakdowns, algorithm scores, and specific recommendations for your research."
  },
  {
    title: "Quality Verification",
    message: "Cross-checking all calculations and similarity metrics. Ensuring accuracy and reliability of the plagiarism detection results."
  },
  {
    title: "Finalizing Your Results",
    message: "Preparing the final similarity report with acceptance status, detailed explanations, and actionable guidance for your research submission."
  }
]

const stages = [
  { icon: FileSearch, label: "Processing Input", color: "text-blue-400" },
  { icon: Shield, label: "Similarity Detection", color: "text-purple-400" },
  { icon: BarChart3, label: "Analyzing Results", color: "text-indigo-400" },
  { icon: Sparkles, label: "Generating Report", color: "text-amber-400" },
  { icon: CheckCircle2, label: "Finalizing Results", color: "text-emerald-400" }
]

export function LoadingScreen({ currentStage = 1, totalStages = 5, stageLabel }: LoadingScreenProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Rotate informational messages every 5 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % informationalMessages.length)
    }, 5000)

    return () => clearInterval(messageInterval)
  }, [])

  // Animate progress bar
  useEffect(() => {
    const targetProgress = (currentStage / totalStages) * 100
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= targetProgress) {
          clearInterval(progressInterval)
          return targetProgress
        }
        return Math.min(prev + 1, targetProgress)
      })
    }, 20)

    return () => clearInterval(progressInterval)
  }, [currentStage, totalStages])

  const currentStageInfo = stages[currentStage - 1] || stages[0]
  const StageIcon = currentStageInfo.icon

  if (!mounted) return null

  const currentMessage = informationalMessages[currentMessageIndex]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-slate-900/60" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Main content with glassmorphism */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/10 backdrop-blur-2xl rounded-3xl p-10 border border-white/20 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Logo/Icon Animation */}
            <motion.div
              className="flex justify-center mb-6"
             
              
            >
              <div className="relative">
                <StageIcon className={`w-16 h-16 ${currentStageInfo.color} drop-shadow-lg`} />
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 blur-xl opacity-40"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
              </div>
            </motion.div>

            {/* Stage Information */}
            <div className="text-center mb-6">
              <motion.h2
                key={currentStage}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-white mb-2 drop-shadow-lg"
              >
                {stageLabel || currentStageInfo.label}
              </motion.h2>
              <p className="text-white/70 text-base font-medium">
                Stage {currentStage} of {totalStages}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="bg-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm border border-white/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 shadow-lg"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-white/80 text-sm text-center mt-2.5 font-semibold">
                {Math.round(progress)}% Complete
              </p>
            </div>

            {/* Stage Indicators */}
            <div className="flex justify-center gap-2.5 mb-8">
              {stages.map((stage, index) => {
                const StageIconSmall = stage.icon
                return (
                  <motion.div
                    key={index}
                    className={`flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all backdrop-blur-sm ${
                      index < currentStage
                        ? "bg-green-400/80 border-green-300 shadow-lg shadow-green-500/30"
                        : index === currentStage - 1
                        ? "bg-blue-400/80 border-blue-300 shadow-lg shadow-blue-500/40 scale-110"
                        : "bg-white/5 border-white/20"
                    }`}
                    animate={
                      index === currentStage - 1
                        ? {
                            scale: [1.1, 1.15, 1.1],
                          }
                        : {}
                    }
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  >
                    <StageIconSmall className="w-5 h-5 text-white drop-shadow" />
                  </motion.div>
                )
              })}
            </div>

            {/* Informational Message with Animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl">
                  <div className="flex items-center justify-center gap-2.5 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-300 drop-shadow-lg" />
                    <h3 className="text-white font-bold text-lg">{currentMessage.title}</h3>
                  </div>
                  <p className="text-white/90 text-base leading-relaxed">
                    {currentMessage.message}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Spinning loader */}
            <motion.div
              className="flex justify-center mt-6"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-7 h-7 text-white/60 drop-shadow" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
