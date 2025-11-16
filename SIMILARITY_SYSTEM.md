# Research Similarity Detection System

## Features

- **Cosine Similarity Algorithm**: Compares proposed research titles and concepts against existing researches
- **Gemini AI Integration**: Generates comprehensive similarity analysis reports
- **Real-time Analysis**: Instant similarity checking with detailed results
- **PDF & Document Upload**: Upload PDF or DOCX files for automatic text extraction

## Setup Instructions

### 1. Environment Variables

Add the Gemini API key to your `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

(Your Supabase variables should already be in `.env`)

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file

### 3. Python Script (Optional)

If you want to use the Python script directly:

```bash
# Install Python dependencies
pip install -r scripts/requirements.txt

# Run the script
python scripts/cosine_similarity.py
```

The Python script expects JSON input via stdin:
```json
{
  "proposed_title": "Your research title",
  "proposed_concept": "Your research concept",
  "existing_researches": [
    {
      "title": "Existing title",
      "abstract": "Existing abstract"
    }
  ]
}
```

## How It Works

### Flow

1. **User Input**: User enters research title and concept on the landing page, OR uploads a PDF/DOCX file
2. **File Upload (Optional)**: 
   - Click "Upload PDF or DOCX" button
   - Select a PDF (.pdf) or Word document (.docx) file (max 10MB)
   - Text is automatically extracted and populated in the concept field
3. **Similarity Check**: Clicking "Check Similarity" triggers:
   - Fetches all existing researches from database
   - Calculates cosine similarity using TF-IDF vectorization
   - Compares proposed title vs existing titles (40% weight)
   - Compares proposed concept vs existing abstracts (60% weight)
4. **Report Generation**: 
   - Top similar researches are sent to Gemini API
   - Gemini generates a comprehensive analysis report
5. **Results Display**: Report is shown in a dialog with:
   - Similarity scores for top matches
   - AI-generated detailed analysis
   - Recommendations

### Cosine Similarity Algorithm

The system uses TF-IDF (Term Frequency-Inverse Document Frequency) vectorization:
- Converts text into numerical vectors
- Calculates cosine similarity between vectors
- Returns similarity scores from 0 (no similarity) to 1 (identical)

### PDF/Document Upload Feature

The system supports uploading documents for text extraction:
- **Supported formats**: PDF (.pdf) and Word Documents (.docx)
- **File size limit**: 10MB maximum
- **Text extraction**: Uses `pdf-parse` for PDFs and `mammoth` for DOCX files
- **Auto-fill**: Extracted text is automatically populated in the research concept field
- The extracted text is then processed using the same TF-IDF vectorization algorithm

### Gemini AI Report

The AI report includes:
- Executive Summary
- Title Analysis
- Concept Analysis
- Risk Assessment (Low/Medium/High)
- Recommendations
- Conclusion

## API Endpoints

### POST `/api/extract-text`

**Request:**
- Content-Type: multipart/form-data
- Body: FormData with 'file' field containing PDF or DOCX file

**Response:**
```json
{
  "success": true,
  "text": "Extracted text content...",
  "fileName": "document.pdf",
  "fileSize": 12345,
  "extractedLength": 500
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

### POST `/api/similarity/check`

**Request Body:**
```json
{
  "proposedTitle": "Your research title",
  "proposedConcept": "Your research concept description"
}
```

**Response:**
```json
{
  "success": true,
  "proposedTitle": "Your research title",
  "proposedConcept": "Your research concept",
  "similarities": [
    {
      "title": "Existing research title",
      "abstract": "Existing abstract",
      "titleSimilarity": 0.85,
      "abstractSimilarity": 0.72,
      "overallSimilarity": 0.77
    }
  ],
  "report": "AI-generated report text...",
  "totalComparisons": 10
}
```

## Usage

### Method 1: Manual Text Entry

1. Navigate to the landing page
2. Enter your proposed research title
3. Enter your research concept/abstract
4. Click "Check Similarity"
5. Review the similarity report in the dialog

### Method 2: Document Upload

1. Navigate to the landing page
2. Enter your proposed research title
3. Click "Upload PDF or DOCX" button
4. Select your PDF or DOCX file (max 10MB)
5. The text will be automatically extracted and filled in the concept field
6. Click "Check Similarity"
7. Review the similarity report in the dialog

## Notes

- The system compares against all non-archived researches in the database
- Similarity scores are percentages (0-100%)
- Higher scores indicate more similarity
- The AI report provides context and recommendations beyond raw scores
- Supported file formats for upload: PDF (.pdf), Word Document (.docx)
- Legacy Word format (.doc) is not supported - please convert to .docx or PDF
- Maximum file size: 10MB

