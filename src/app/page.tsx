"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import LiquidEther from "@/components/ui/LiquidEther"
import { LoginForm } from "@/components/ui/login-form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function Home() {
  const [proposedTitle, setProposedTitle] = useState("")
  const [proposedConcept, setProposedConcept] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckSimilarity = () => {
    if (!proposedTitle.trim() || !proposedConcept.trim()) {
      toast.error("Please fill in both research title and concept")
      return
    }

    // Navigate to results page with query parameters
    const params = new URLSearchParams({
      title: proposedTitle.trim(),
      concept: proposedConcept.trim(),
    })
    window.location.href = `/similarity-results?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Effect */}
      <div className="absolute inset-0 -z-10">
        <LiquidEther
          mouseForce={15}
          cursorSize={80}
          colors={['#1e40af', '#3b82f6', '#93c5fd']}
          autoDemo={true}
          className="w-full h-full"
        />
      </div>

      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image 
              src="/file.svg" 
              alt="Logo" 
              width={32} 
              height={32} 
            />
            <h1 className="text-xl font-bold">Research Concept Detection</h1>
          </div>
          <LoginForm />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Research Concept Similarity Detection
            </h1>
            <p className="text-lg text-muted-foreground">
              Detect similarities between research concepts to ensure originality and avoid duplication
            </p>
          </div>

          {/* Input Form */}
          <div className="space-y-6 p-6 bg-card rounded-lg shadow-lg border">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="mb-2">
                  Proposed Research Title
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Enter your research title"
                  value={proposedTitle}
                  onChange={(e) => setProposedTitle(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="concept" className="mb-2">
                  Research Concept
                </Label>
                <Textarea
                  id="concept"
                  rows={6}
                  placeholder="Describe your research concept..."
                  value={proposedConcept}
                  onChange={(e) => setProposedConcept(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleCheckSimilarity}
                disabled={isLoading || !proposedTitle.trim() || !proposedConcept.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Similarity...
                  </>
                ) : (
                  "Check Similarity"
                )}
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Instant Analysis</h3>
              <p className="text-sm text-muted-foreground">Get immediate results on concept similarity</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Advanced Detection</h3>
              <p className="text-sm text-muted-foreground">Using sophisticated algorithms for accuracy</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Detailed Reports</h3>
              <p className="text-sm text-muted-foreground">Comprehensive similarity analysis reports</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
