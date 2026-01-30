import { NextRequest, NextResponse } from 'next/server'

// Configure the email address to receive feedback
const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || 'feedback@bicoluniversity.edu.ph'
const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL || 'noreply@bicoluniversity.edu.ph'

interface FeedbackData {
  name: string
  email: string
  role: string
  functionalCompleteness: number
  functionalCorrectness: number
  functionalAppropriateness: number
  appropriatenessRecognizability: number
  learnability: number
  operability: number
  userErrorProtection: number
  userInterfaceAesthetics: number
  accessibility: number
  comments: string
  suggestions: string
}

const likertLabels: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent"
}

function getRatingEmoji(rating: number): string {
  const emojis = ['😞', '😕', '😐', '😊', '😄']
  returnfunctionalSuitability = (
    data.functionalCompleteness + 
    data.functionalCorrectness + 
    data.functionalAppropriateness
  ) / 3

  const interactionCapability = (
    data.appropriatenessRecognizability +
    data.learnability +
    data.operability +
    data.userErrorProtection +
    data.userInterfaceAesthetics +
    data.accessibility
  ) / 6

  const avgRating = (
    data.functionalCompleteness + 
    data.functionalCorrectness + 
    data.functionalAppropriateness +
    data.appropriatenessRecognizability +
    data.learnability +
    data.operability +
    data.userErrorProtection +
    data.userInterfaceAesthetics +
    data.accessibility
  ) / 9a.accuracy + 
    data.helpfulness + 
    data.design + 
    data.overallSatisfaction
  ) / 5

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #fca311 0%, #e59200 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          background: #fff;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
        }
        .info-section {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 25px;
        }
        .info-row {
          display: flex;
          margin-bottom: 8px;
        }
        .info-label {
          font-weight: bold;
          width: 80px;
          color: #666;
        }
        .info-value {
          color: #333;
        }
        .rating-section {
          margin-bottom: 25px;
        }
        .rating-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 12px;
          border-left: 4px solid #fca311;
        }
        .rating-question {
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .rating-value {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
        }
        .rating-stars {
          color: #fca311;
        }
        .rating-label {
          color: #666;
          font-size: 14px;
        }
        .average-rating {
          background: linear-gradient(135deg, #fca311 0%, #e59200 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 25px;
        }
        .average-rating .score {
          font-size: 48px;
          font-weight: bold;
          margin: 10px 0;
        }
        .comments-section {
          margin-bottom: 20px;
        }
        .comments-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
          font-size: 16px;
        }
        .comments-text {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          color: #555;
          font-style: italic;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          color: #888;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 New Feedback Received</h1>
        <p style="margin: 5px 0 0 0;">Research Similarity Detection System</p>
      </div>
      
      <div class="content">
        <div class="info-section">
          <h3 sOverall Average Rating</div>
          <div class="score">${avgRating.toFixed(1)} / 5.0</div>
          <div style="font-size: 32px;">${getRatingEmoji(Math.round(avgRating))}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9;">Functional Suitability</div>
            <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${functionalSuitability.toFixed(1)}</div>
            <div style="font-size: 12px; opacity: 0.8;">Completeness • Correctness • Appropriateness</div>
          </div>
          <div style="background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9;">Interaction Capability</div>
            <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${interactionCapability.toFixed(1)}</div>
            <div style="font-size: 12px; opacity: 0.8;">Usability • Aesthetics • Accessibility</div>
          </div>
        </div>

        <div class="rating-section">
          <h3 style="color: #3b82f6;">Functional Suitability (ISO 25010)</h3>
          
          <div class="rating-item">
            <div class="rating-question">Functional Completeness</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.functionalCompleteness)}${'☆'.repeat(5 - data.functionalCompleteness)}</span>
              <span>${data.functionalCompleteness}/5</span>
              <span class="rating-label">(${likertLabels[data.functionalCompleteness]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Functional Correctness</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.functionalCorrectness)}${'☆'.repeat(5 - data.functionalCorrectness)}</span>
              <span>${data.functionalCorrectness}/5</span>
              <span class="rating-label">(${likertLabels[data.functionalCorrectness]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Functional Appropriateness</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.functionalAppropriateness)}${'☆'.repeat(5 - data.functionalAppropriateness)}</span>
              <span>${data.functionalAppropriateness}/5</span>
              <span class="rating-label">(${likertLabels[data.functionalAppropriateness]})</span>
            </div>
          </div>
        </div>

        <div class="rating-section">
          <h3 style="color: #a855f7;">Interaction Capability (ISO 25010)</h3>
          
          <div class="rating-item">
            <div class="rating-question">Appropriateness Recognizability</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.appropriatenessRecognizability)}${'☆'.repeat(5 - data.appropriatenessRecognizability)}</span>
              <span>${data.appropriatenessRecognizability}/5</span>
              <span class="rating-label">(${likertLabels[data.appropriatenessRecognizability]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Learnability</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.learnability)}${'☆'.repeat(5 - data.learnability)}</span>
              <span>${data.learnability}/5</span>
              <span class="rating-label">(${likertLabels[data.learnability]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Operability</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.operability)}${'☆'.repeat(5 - data.operability)}</span>
              <span>${data.operability}/5</span>
              <span class="rating-label">(${likertLabels[data.operability]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">User Error Protection</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.userErrorProtection)}${'☆'.repeat(5 - data.userErrorProtection)}</span>
              <span>${data.userErrorProtection}/5</span>
              <span class="rating-label">(${likertLabels[data.userErrorProtection]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">User Interface Aesthetics</div>
            <dfunctionalCompleteness || !data.functionalCorrectness || 
        !data.functionalAppropriateness || !data.appropriatenessRecognizability ||
        !data.learnability || !data.operability || !data.userErrorProtection ||
        !data.userInterfaceAesthetics || !data.accessibility) {
      return NextResponse.json(
        { error: 'All quality characteristiclass="rating-label">(${likertLabels[data.userInterfaceAesthetics]})</span>
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Accessibility</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.accessibility)}${'☆'.repeat(5 - data.accessibility)}</span>
              <span>${data.accessibility}/5</span>
              <span class="rating-label">(${likertLabels[data.accessibility
            <div class="rating-question">Helpfulness for Research</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.helpfulness)}${'☆'.repeat(5 - data.helpfulness)}</span>
              <span>${data.helpfulness}/5</span>
              <span class="rating-label">(${likertLabels[data.helpfulness]})</span>
            </div>
ISO 25010 Quality Characteristics (1-5 scale):

FUNCTIONAL SUITABILITY:
- Functional Completeness: ${data.functionalCompleteness}/5 (${likertLabels[data.functionalCompleteness]})
- Functional Correctness: ${data.functionalCorrectness}/5 (${likertLabels[data.functionalCorrectness]})
- Functional Appropriateness: ${data.functionalAppropriateness}/5 (${likertLabels[data.functionalAppropriateness]})

INTERACTION CAPABILITY:
- Appropriateness Recognizability: ${data.appropriatenessRecognizability}/5 (${likertLabels[data.appropriatenessRecognizability]})
- Learnability: ${data.learnability}/5 (${likertLabels[data.learnability]})
- Operability: ${data.operability}/5 (${likertLabels[data.operability]})
- User Error Protection: ${data.userErrorProtection}/5 (${likertLabels[data.userErrorProtection]})
- User Interface Aesthetics: ${data.userInterfaceAesthetics}/5 (${likertLabels[data.userInterfaceAesthetics]})
- Accessibility: ${data.accessibility}/5 (${likertLabels[data.accessibility]})

Average Rating: ${((data.functionalCompleteness + data.functionalCorrectness + data.functionalAppropriateness + data.appropriatenessRecognizability + data.learnability + data.operability + data.userErrorProtection + data.userInterfaceAesthetics + data.accessibility) / 9
            </div>
          </div>

          <div class="rating-item">
            <div class="rating-question">Overall Satisfaction</div>
            <div class="rating-value">
              <span class="rating-stars">${'★'.repeat(data.overallSatisfaction)}${'☆'.repeat(5 - data.overallSatisfaction)}</span>
              <span>${data.overallSatisfaction}/5</span>
              <span class="rating-label">(${likertLabels[data.overallSatisfaction]})</span>
            </div>
          </div>functionalCompleteness + data.functionalCorrectness + data.functionalAppropriateness + data.appropriatenessRecognizability + data.learnability + data.operability + data.userErrorProtection + data.userInterfaceAesthetics + data.accessibility) / 9
        </div>

        ${data.comments ? `
          <div class="comments-section">
            <div class="comments-title">💭 What they liked most:</div>
            <div class="comments-text">${data.comments}</div>
          </div>
        ` : ''}

        ${data.suggestions ? `
          <div class="comments-section">
            <div class="comments-title">💡 Suggestions for improvement:</div>
            <div class="comments-text">${data.suggestions}</div>
          </div>
        ` : ''}

        <div class="footer">
          <p>This feedback was submitted through the Research Similarity Detection System</p>
          <p>Bicol University Polangui Campus</p>
        </div>functionalCompleteness + data.functionalCorrectness + data.functionalAppropriateness + data.appropriatenessRecognizability + data.learnability + data.operability + data.userErrorProtection + data.userInterfaceAesthetics + data.accessibility) / 9
      </div>
    </body>
    </html>
  `
}

export async function POST(request: NextRequest) {
  try {
    const data: FeedbackData = await request.json()

    // Validation
    if (!data.name || !data.email || !data.role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!data.easeOfUse || !data.accuracy || !data.helpfulness || 
        !data.design || !data.overallSatisfaction) {
      return NextResponse.json(
        { error: 'All ratings are required' },
        { status: 400 }
      )
    }

    // Generate email content
    const emailHTML = generateEmailHTML(data)
    const emailText = `
New Feedback Received - Research Similarity Detection System

Respondent Information:
Name: ${data.name}
Email: ${data.email}
Role: ${data.role}
Date: ${new Date().toLocaleString()}

Ratings (1-5 scale):
- Ease of Use: ${data.easeOfUse}/5 (${likertLabels[data.easeOfUse]})
- Accuracy: ${data.accuracy}/5 (${likertLabels[data.accuracy]})
- Helpfulness: ${data.helpfulness}/5 (${likertLabels[data.helpfulness]})
- Design: ${data.design}/5 (${likertLabels[data.design]})
- Overall Satisfaction: ${data.overallSatisfaction}/5 (${likertLabels[data.overallSatisfaction]})

Average Rating: ${((data.easeOfUse + data.accuracy + data.helpfulness + data.design + data.overallSatisfaction) / 5).toFixed(1)}/5

Comments: ${data.comments || 'N/A'}

Suggestions: ${data.suggestions || 'N/A'}
    `

    // Send email using Supabase Edge Function or your email service
    // For now, we'll use a simple email API approach
    
    // Option 1: Using Resend (recommended)
    if (process.env.RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: SYSTEM_EMAIL,
          to: FEEDBACK_EMAIL,
          subject: `New Feedback: ${data.name} (${data.role}) - ${((data.easeOfUse + data.accuracy + data.helpfulness + data.design + data.overallSatisfaction) / 5).toFixed(1)}/5 Rating`,
          html: emailHTML,
          text: emailText
        }),
      })

      if (!resendResponse.ok) {
        throw new Error('Failed to send email via Resend')
      }
    }

    // Log feedback to console for debugging
    console.log('[Feedback] New submission:', {
      name: data.name,
      email: data.email,
      role: data.role,
      averageRating: ((data.easeOfUse + data.accuracy + data.helpfulness + data.design + data.overallSatisfaction) / 5).toFixed(1),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully'
    })

  } catch (error) {
    console.error('[Feedback] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: String(error) },
      { status: 500 }
    )
  }
}
