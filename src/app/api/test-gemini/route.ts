import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Test Python Gemini API connection
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    const testInput = JSON.stringify({
      action: 'explanation',
      proposedTitle: 'Test Research Title',
      proposedConcept: 'This is a test research concept to verify Gemini API connectivity.',
      existingTitle: 'Similar Research Title',
      existingAbstract: 'This is a similar research abstract for testing purposes.',
      lexicalSim: 45.5,
      semanticSim: 60.2
    })
    
    console.log('Testing Gemini API connection...')
    
    const { stdout, stderr } = await execAsync(
      `echo '${testInput.replace(/'/g, "'\\''")}' | python3 /workspaces/detection_system/scripts/gemini_api.py`,
      { timeout: 30000 } // 30 second timeout
    )
    
    if (stderr) {
      console.log('Python stderr (warnings):', stderr)
    }
    
    console.log('Python stdout:', stdout)
    
    try {
      const result = JSON.parse(stdout)
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Gemini API is working correctly! Connection established via Python backend.',
          details: {
            model: result.model_used || 'Unknown',
            response: result.explanation,
            timestamp: new Date().toISOString()
          }
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'Gemini API returned an error',
          details: {
            error: result.error,
            timestamp: new Date().toISOString()
          }
        })
      }
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        message: 'Failed to parse Python script output',
        details: {
          stdout,
          stderr,
          parseError: parseError instanceof Error ? parseError.message : String(parseError)
        }
      })
    }
  } catch (error) {
    console.error('Gemini API test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Failed to execute Gemini API test',
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
