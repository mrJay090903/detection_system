"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText } from "lucide-react"

interface UploadedFileViewDialogProps {
  fileName: string
  fileContent: string
  triggerText?: string
}

export function UploadedFileViewDialog({
  fileName,
  fileContent,
  triggerText = "View Upload",
}: UploadedFileViewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Uploaded File Content</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          <div className="whitespace-pre-wrap text-sm">
            {fileContent}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
