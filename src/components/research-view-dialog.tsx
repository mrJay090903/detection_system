"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Research } from "@/types/research"
import { 
  CalendarIcon, 
  GraduationCapIcon, 
  Users2Icon, 
  ScrollTextIcon,
  XIcon
} from "lucide-react"
import { format } from "date-fns"

interface ResearchViewDialogProps {
  research: Research
  trigger?: React.ReactNode
  onEdit?: () => void
}

export function ResearchViewDialog({ research, trigger, onEdit }: ResearchViewDialogProps) {
  const formattedDate = format(new Date(research.created_at), "MMMM d, yyyy")

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">View Details</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] p-0">
        {/* Header Section with Background */}
        <div className="relative bg-primary/10 p-6 pb-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {research.title}
            </DialogTitle>
            <DialogDescription className="text-primary mt-2">
              Added on {formattedDate}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Section */}
        <div className="p-6 pt-4">
          <div className="grid gap-6">
            {/* Year and Course Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <div className="mt-1">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Year</h4>
                  <p className="text-sm text-muted-foreground mt-1">{research.year}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1">
                  <GraduationCapIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Course</h4>
                  <p className="text-sm text-muted-foreground mt-1">{research.course}</p>
                </div>
              </div>
            </div>

            {/* Researchers Section */}
            <div className="flex items-start gap-2 pb-4 border-b">
              <div className="mt-1">
                <Users2Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Researchers</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {research.researchers.map((researcher, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                    >
                      {researcher}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Thesis Brief Section */}
            <div className="flex items-start gap-2">
              <div className="mt-1">
                <ScrollTextIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Thesis Brief
                  <span className="text-xs text-muted-foreground font-normal">
                    (Scroll to read more)
                  </span>
                </h4>
                <div className="relative mt-2 bg-muted/50 rounded-lg">
                  <div className="absolute right-3 top-2 h-6 w-6 bg-linear-to-l from-muted/50 to-transparent" />
                  <div className="absolute right-0 top-2 w-3 h-6 bg-muted/50" />
                  <div 
                    className="max-h-[200px] overflow-y-auto pr-4 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent hover:scrollbar-thumb-primary/20 scroll-smooth"
                    style={{
                      maskImage: 'linear-gradient(to bottom, transparent, black 10px, black 90%, transparent)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10px, black 90%, transparent)'
                    }}
                  >
                    {research.thesis_brief}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-6 pt-0">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onEdit?.()}
          >
            Edit Research
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}