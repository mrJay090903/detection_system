"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SimilarityResult {
  id?: string
  title: string
  abstract: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
}

interface SimilarityResponse {
  success: boolean
  proposedTitle: string
  proposedConcept: string
  similarities: SimilarityResult[]
  report: string
  totalComparisons: number
}

export function SimilarityReportDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SimilarityResponse | null
}) {
  if (!result) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Similarity Analysis Report</DialogTitle>
          <DialogDescription>
            Detailed analysis of your proposed research against existing researches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Proposed Research Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proposed Research</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-sm font-medium">Title:</Label>
                <p className="text-sm mt-1">{result.proposedTitle}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Concept:</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {result.proposedConcept}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top Similar Researches */}
          {result.similarities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Top Similar Researches ({result.similarities.length} shown)
                </CardTitle>
                <CardDescription>
                  Total comparisons: {result.totalComparisons}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.similarities.map((similarity, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">
                            {index + 1}. {similarity.title}
                          </h4>
                          {(similarity.year || similarity.course) && (
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {similarity.year && (
                                <span>Year: {similarity.year}</span>
                              )}
                              {similarity.course && (
                                <span>• Course: {similarity.course}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-primary">
                            {(similarity.overallSimilarity * 100).toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Overall Similarity
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {similarity.abstract}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                        <span>
                          Title: {(similarity.titleSimilarity * 100).toFixed(2)}%
                        </span>
                        <span>
                          Abstract:{" "}
                          {(similarity.abstractSimilarity * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Generated Report */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI-Generated Analysis Report</CardTitle>
              <CardDescription>
                Comprehensive analysis powered by Google Gemini AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {result.report}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

