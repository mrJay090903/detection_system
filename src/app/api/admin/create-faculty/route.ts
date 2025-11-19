import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a server-side Supabase client for API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials")
  throw new Error("Server configuration error")
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  console.log("=== Create Faculty API Called ===")
  try {
    const body = await request.json()
    console.log("Request body:", { ...body, password: "[REDACTED]" })
    
    const { email, password, firstName, lastName, department } = body

    // Validate input
    if (!email || !password || !firstName || !lastName || !department) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // Create auth user with email confirmation disabled
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          first_name: firstName,
          last_name: lastName,
          department: department,
        },
      }
    })

    if (authError) {
      console.error("Auth error:", authError)
      
      // Check if it's a "User already registered" error
      if (authError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "This email is already registered. Please use a different email address." },
          { status: 400 }
        )
      }
      
      // Check if it's an email confirmation error
      if (authError.message.includes("confirmation email") || authError.message.includes("email")) {
        return NextResponse.json(
          { 
            error: "Email confirmation is enabled in Supabase. Please go to: Supabase Dashboard → Authentication → Email Auth → Disable 'Confirm email' setting.",
            details: authError.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      console.error("No user returned from signUp")
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      )
    }

    console.log("User created successfully:", authData.user.id)

    // The database trigger should automatically create the faculty record
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1500))

    console.log("Checking for faculty record...")
    
    // Verify the faculty record was created
    const { data: facultyData, error: facultyError } = await supabase
      .from("faculty")
      .select("*")
      .eq("id", authData.user.id)
      .single()

    console.log("Faculty query result:", { facultyData, facultyError })

    if (facultyError || !facultyData) {
      console.log("Faculty record not found, creating manually...")
      
      // If trigger failed, create manually
      const { error: insertError } = await supabase
        .from("faculty")
        .insert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          department: department,
        })

      if (insertError) {
        console.error("Manual insert error:", insertError)
        return NextResponse.json(
          { error: "Failed to create faculty record", details: insertError.message },
          { status: 500 }
        )
      }
      
      console.log("Faculty record created manually")
    } else {
      console.log("Faculty record created by trigger")
    }

    console.log("Faculty creation completed successfully")
    
    return NextResponse.json({
      success: true,
      user: authData.user,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
