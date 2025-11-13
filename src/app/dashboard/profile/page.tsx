import { getCurrentFaculty, type Faculty } from "@/lib/auth"

export default async function ProfilePage() {
  const faculty = await getCurrentFaculty()

  return (
    <div>
      <h1 className="text-2xl font-bold">Profile</h1>
      <pre className="mt-4">{JSON.stringify(faculty, null, 2)}</pre>
    </div>
  )
}