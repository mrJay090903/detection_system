"use client"

import { Suspense } from "react"
import { SimilarityResults } from "@/components/similarity-results"
import { Loader2 } from "lucide-react"

export default function SimilarityResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Analyzing similarity...</p>
        </div>
      </div>
    }>
      <SimilarityResults />
    </Suspense>
  )
}
