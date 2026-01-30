import AIAnalysisClient from '@/components/AIAnalysisClient'
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading AI analysis...</div>}>
      <AIAnalysisClient />
    </Suspense>
  )
}

