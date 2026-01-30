"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Send } from "lucide-react"

interface FeedbackFormProps {
  trigger?: React.ReactNode
}

type LikertValue = 1 | 2 | 3 | 4 | 5

interface FeedbackData {
  name: string
  email: string
  role: string
  functionalCompleteness: LikertValue | null
  functionalCorrectness: LikertValue | null
  functionalAppropriateness: LikertValue | null
  appropriatenessRecognizability: LikertValue | null
  learnability: LikertValue | null
  operability: LikertValue | null
  userErrorProtection: LikertValue | null
  userInterfaceAesthetics: LikertValue | null
  accessibility: LikertValue | null
  comments: string
  suggestions: string
}

const likertLabels = {
  1: "Very Poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent"
}

export function FeedbackForm({ trigger }: FeedbackFormProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<FeedbackData>({
    name: "",
    email: "",
    role: "",
    functionalCompleteness: null,
    functionalCorrectness: null,
    functionalAppropriateness: null,
    appropriatenessRecognizability: null,
    learnability: null,
    operability: null,
    userErrorProtection: null,
    userInterfaceAesthetics: null,
    accessibility: null,
    comments: "",
    suggestions: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name || !formData.email || !formData.role) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!formData.functionalCompleteness || !formData.functionalCorrectness || 
        !formData.functionalAppropriateness || !formData.appropriatenessRecognizability ||
        !formData.learnability || !formData.operability || !formData.userErrorProtection ||
        !formData.userInterfaceAesthetics || !formData.accessibility) {
      toast.error("Please rate all quality characteristics")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      toast.success("Thank you for your feedback! We appreciate your input.")
      setOpen(false)
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        role: "",
        functionalCompleteness: null,
        functionalCorrectness: null,
        functionalAppropriateness: null,
        appropriatenessRecognizability: null,
        learnability: null,
        operability: null,
        userErrorProtection: null,
        userInterfaceAesthetics: null,
        accessibility: null,
        comments: "",
        suggestions: ""
      })
    } catch (error) {
      console.error('Feedback submission error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback')
    } finally {
      setIsLoading(false)
    }
  }

  const renderLikertScale = (
    question: string,
    value: LikertValue | null,
    onChange: (value: LikertValue) => void
  ) => {
    const emojis = ['😞', '😕', '😐', '😊', '😄']
    
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question}</Label>
        <div className="flex items-center justify-between gap-2">
          {([1, 2, 3, 4, 5] as LikertValue[]).map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all hover:scale-110 ${
                value === rating
                  ? 'border-[#fca311] bg-[#fca311]/10 shadow-md scale-110'
                  : 'border-gray-200 hover:border-[#fca311]/50'
              }`}
            >
              <span className="text-3xl">
                {emojis[rating - 1]}
              </span>
              <span className="text-xs font-medium">{rating}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 px-1">
          <span>{likertLabels[1]}</span>
          <span>{likertLabels[5]}</span>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-[#fca311] hover:bg-[#e59200]">
            Give Feedback
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Share Your Feedback</DialogTitle>
          <DialogDescription>
            Help us improve the Research Similarity Detection System by sharing your experience
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Personal Information */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-700">Personal Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your.email@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="e.g., Student, Faculty, Researcher"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* ISO 25010 Quality Characteristics */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-bold text-sm text-blue-900 mb-1">FUNCTIONAL SUITABILITY</h3>
              <p className="text-xs text-blue-700">Degree to which the system provides functions that meet stated and implied needs</p>
            </div>

            {renderLikertScale(
              "1. Functional Completeness - Does the system provide all necessary functions?",
              formData.functionalCompleteness,
              (value) => setFormData(prev => ({ ...prev, functionalCompleteness: value }))
            )}

            {renderLikertScale(
              "2. Functional Correctness - Does the system provide correct results?",
              formData.functionalCorrectness,
              (value) => setFormData(prev => ({ ...prev, functionalCorrectness: value }))
            )}

            {renderLikertScale(
              "3. Functional Appropriateness - Are the functions appropriate for specified tasks?",
              formData.functionalAppropriateness,
              (value) => setFormData(prev => ({ ...prev, functionalAppropriateness: value }))
            )}

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 mt-8">
              <h3 className="font-bold text-sm text-purple-900 mb-1">INTERACTION CAPABILITY</h3>
              <p className="text-xs text-purple-700">Degree to which the system can be used by specified users to achieve specified goals</p>
            </div>

            {renderLikertScale(
              "4. Appropriateness Recognizability - Can you easily recognize if the system is appropriate for your needs?",
              formData.appropriatenessRecognizability,
              (value) => setFormData(prev => ({ ...prev, appropriatenessRecognizability: value }))
            )}

            {renderLikertScale(
              "5. Learnability - How easy is it to learn to use the system?",
              formData.learnability,
              (value) => setFormData(prev => ({ ...prev, learnability: value }))
            )}

            {renderLikertScale(
              "6. Operability - How easy is it to operate and control the system?",
              formData.operability,
              (value) => setFormData(prev => ({ ...prev, operability: value }))
            )}

            {renderLikertScale(
              "7. User Error Protection - Does the system protect against user errors?",
              formData.userErrorProtection,
              (value) => setFormData(prev => ({ ...prev, userErrorProtection: value }))
            )}

            {renderLikertScale(
              "8. User Interface Aesthetics - Is the user interface pleasing and satisfying?",
              formData.userInterfaceAesthetics,
              (value) => setFormData(prev => ({ ...prev, userInterfaceAesthetics: value }))
            )}

            {renderLikertScale(
              "9. Accessibility - Can the system be used by people with diverse capabilities?",
              formData.accessibility,
              (value) => setFormData(prev => ({ ...prev, accessibility: value }))
            )}
          </div>

          {/* Open-ended Questions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">Additional Feedback</h3>

            <div className="space-y-2">
              <Label htmlFor="comments">What did you like most about the system?</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Share your positive experience..."
                className="h-24 resize-none"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="suggestions">What improvements would you suggest?</Label>
              <Textarea
                id="suggestions"
                value={formData.suggestions}
                onChange={(e) => setFormData(prev => ({ ...prev, suggestions: e.target.value }))}
                placeholder="Share your suggestions for improvement..."
                className="h-24 resize-none"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#fca311] hover:bg-[#e59200] gap-2"
            >
              {isLoading ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
