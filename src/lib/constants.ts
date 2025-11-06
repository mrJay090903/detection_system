export const COURSES = [
  'Bachelor of Elementary Education',
  'BSED Major in English',
  'BSED Major in Math',
  'BS in Automotive Technology',
  'BS in Computer Engineering',
  'BS in Computer Science',
  'BS in Electrical Technology',
  'BS in Electronics Engineering',
  'BS in Electronics Technology',
  'BS in Entrepreneurship',
  'BS in Information System',
  'BS in Information Technology',
  'BS in Information Technology (Animation)',
  'BS in Mechanical Technology',
  'BS in Nursing',
  'BTLed-ICT',
  'BTLED-Home Economics'
] as const

export type Course = typeof COURSES[number]