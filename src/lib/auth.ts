import { supabase } from "./supabase"

export type Faculty = {
  id: string
  first_name: string
  last_name: string
  department: string
  email: string
}

export async function signIn(email: string, password: string) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    throw new Error(authError.message)
  }

  if (!authData.user) {
    throw new Error('No user returned from authentication')
  }

  // Fetch faculty profile
  const { data: facultyData, error: facultyError } = await supabase
    .from('faculty')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (facultyError) {
    throw new Error('Not authorized as faculty')
  }

  return {
    user: authData.user,
    faculty: facultyData as Faculty,
  }
}

export async function signOut() {
  try {
    // Clear Supabase session
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Supabase signOut error:', error)
      // Continue anyway to clear local storage
    }

    // Clear any stored credentials
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rememberedEmail')
      sessionStorage.clear()
    }

  } catch (error) {
    console.error('Sign out error:', error)
    // Don't throw - allow user to be redirected anyway
  }
}

export async function getCurrentFaculty() {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user) {
      return null
    }

    const { data: faculty, error: facultyError } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', session.user.id)
      .single()
   
    if (facultyError) {
      return null
    }

    return faculty as Faculty
  } catch (error) {
    console.error('getCurrentFaculty error:', error)
    return null
  }
}