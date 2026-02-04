export const COURSES = [
,
  'BS in Computer Science',
  'BS in Information System',
  'BS in Information Technology',
  'BS in Information Technology (Animation)',
] as const

export type Course = typeof COURSES[number]