# Research Similarity Detection System

## Features

- **Advanced Multi-Algorithm Detection**: Uses 7+ different algorithms to detect similarity
- **Concept-Based Analysis**: Compares the underlying concepts and ideas, not just text
- **Gemini AI Integration**: Generates comprehensive similarity analysis reports focused on conceptual similarity
- **Real-time Analysis**: Instant similarity checking with detailed results
- **PDF & Document Upload**: Upload PDF or DOCX files for automatic text extraction

## Detection Algorithms

The system uses multiple advanced algorithms to ensure comprehensive similarity detection:

1. **TF-IDF Cosine Similarity**: Lexical text similarity using term frequency analysis
2. **N-Gram Matching**: Detects phrase-level similarities
3. **Fingerprinting/Winnowing**: Identifies copied sections using hash-based matching
4. **Rabin-Karp Algorithm**: Pattern matching for detecting duplicate text patterns
5. **Longest Common Subsequence (LCS)**: Finds the longest sequence of matching words
6. **Sentence Similarity**: Compares sentence-level structure and content
7. **Concept Extraction & Matching**: **NEW** - Analyzes and compares the core concepts:
   - Problem Domain: What problem is being solved?
   - Methodology: How is the problem being solved?
   - Technology: What tools/tech are used?
   - Application Area: Where is it applied?
   - Outcomes: What are the expected results?

### Concept-Based Detection

The system now extracts and compares key concepts from both researches:

- **Problem Domain Analysis**: Identifies what problem each research is solving
- **Methodology Comparison**: Compares the approaches and methods used
- **Technology Stack**: Examines the technologies and tools employed
- **Application Context**: Analyzes where and how the research is applied
- **Outcome Assessment**: Compares expected results and contributions

This ensures that two researches using similar technologies but solving different problems are correctly identified as distinct, while researches addressing the same problem with different wording are flagged as similar.

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
3. **Multi-Algorithm Similarity Check**: Clicking "Check Similarity" triggers:
   - Fetches all existing researches from database
   - Runs 7+ different similarity detection algorithms:
     * TF-IDF vectorization for lexical similarity
     * N-gram matching for phrase detection
     * Fingerprinting for hash-based detection
     * Rabin-Karp for pattern matching
     * LCS for sequence similarity
     * Sentence-level comparison
     * **Concept extraction and matching** - NEW!
   - Compares proposed title vs existing titles (40% weight)
   - Compares proposed concept vs existing concepts (60% weight)
   - **Extracts and compares core concepts**: problem domain, methodology, technology, application area
4. **AI Analysis with Concept Focus**: 
   - Top similar researches are sent to Gemini API
   - AI performs deep conceptual analysis, not just text matching
   - AI evaluates if researches solve the same problem with the same approach
   - Generates comprehensive report focused on conceptual similarity
5. **Results Display**: Report is shown in a dialog with:
   - Similarity scores for top matches
   - Concept similarity breakdown
   - AI-generated detailed analysis emphasizing conceptual comparison
   - Recommendations

### Concept-Based Similarity Algorithm

The system now includes advanced concept extraction:

**Concept Categories Analyzed:**
- **Problem Domain** (35% weight): What problem is being solved?
- **Application Area** (30% weight): Where is it being applied?
- **Methodology** (20% weight): How is it being solved?
- **Technology** (10% weight): What technology is used?
- **Outcomes** (5% weight): What results are expected?

This ensures that:
- Two researches about "AI detection" are only marked similar if they detect the SAME thing
- Using AI for healthcare vs. education = LOW similarity (different applications)
- Same technology with different methodologies = MODERATE similarity
- Same problem with same approach = HIGH similarity

### Cosine Similarity Algorithm

The system uses TF-IDF (Term Frequency-Inverse Document Frequency) vectorization:
- Converts text into numerical vectors
- Calculates cosine similarity between vectors
- Enhanced with n-gram analysis and concept extraction
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
- **AI Similarity Assessment**: AI's own calculated percentages based on deep analysis
- **Core Concept Analysis**: Detailed comparison of the fundamental concepts
  - What problem each research solves
  - Whether they're the SAME core idea or different
- **Methodology Comparison**: How each research approaches the problem
- **Application Analysis**: Where and how each is applied
- **Conceptual Overlap Summary**: Clear verdict on whether concepts are the same
- **Improvement Suggestions**: How to differentiate the research concept

The AI focuses on conceptual similarity, not just word matching, ensuring that:
- Different applications of the same technology are marked as LOW similarity
- Same core concepts with different wording are correctly flagged as HIGH similarity
- Paraphrased research with identical concepts is detected
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

