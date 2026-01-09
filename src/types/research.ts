import { type Course } from "@/lib/constants"

export type Research = {
  id: string
  faculty_id: string
  title: string
  thesis_brief: string
  year: number
  course: Course
  researchers: string[]
  created_at: string
  updated_at: string
}

export type ResearchFormData = Omit<Research, 'id' | 'faculty_id' | 'created_at' | 'updated_at'>