# Two-Stage Similarity Detection Pipeline

## Overview

This system implements a **two-stage pipeline** for research similarity detection, following academic best practices for distinguishing between **text overlap** and **conceptual similarity**.

## The Problem with Single-Stage Cosine Similarity

❌ **Why Cosine Alone Gives High Percentages Even When Concepts Differ:**

Cosine similarity rewards:
- Same academic structure (Abstract, Methodology, Evaluation, etc.)
- Same generic terms ("web-based system", "information system", "users", "ISO 25010")
- Similar phrasing patterns
- Common research terminology

**These are NOT indicators of concept identity.**

### Example:
```
Research A: "Web-based Student Attendance System using QR Code"
Research B: "Web-based Content Management System for E-Commerce"

❌ Cosine Similarity: 72% (HIGH)
✅ Concept Similarity: 12% (LOW - different problems!)
```

## Two-Stage Pipeline Architecture

### Stage 1: Text Similarity (Fast Filtering)
**Goal:** Quickly identify candidates with textual overlap

**Method:** 
- TF-IDF vectorization
- Cosine similarity calculation
- Returns top-K most similar documents

**What it measures:**
- Word/phrase overlap
- Academic structure similarity
- Generic terminology usage

**Range:** 0-100%
- 30-70% is common for research papers in the same field
- High text similarity is NORMAL and ACCEPTABLE

---

### Stage 2: Concept Similarity (Problem-Based Decision)
**Goal:** Determine if the core research problem is the same

**Method:**
- Problem Identity Test (4 criteria)
- LLM-based concept analysis
- Formula-based adjustment

**What it measures:**
- Same problem being solved?
- Same target users/beneficiaries?
- Same application domain?
- Same research intent?

**Academic Rule:**
- **If problems differ:** Concept similarity capped at **10-15%**
- **If problems same:** Concept similarity can be **40-95%**

---

## Concept Similarity Formulas

### Different Problems (Core Overlap ≤ 25%)
```javascript
S_concept = min(0.15, 0.2 × S_text)
```

**Example:**
- Text Similarity: 65%
- Concept Similarity: min(15%, 0.2 × 0.65) = **13%** ✅ CAPPED

**Breakdown:**
- Generic system classification: 5-7%
- Shared framework/methodology: 2-3%
- Common academic patterns: 2-3%
- **Total: 9-13%**

---

### Same Problems (Core Overlap ≥ 75%)
```javascript
S_concept = clamp(0.30 + 0.70 × S_text, 0, 1)
```

**Example:**
- Text Similarity: 65%
- Concept Similarity: 0.30 + 0.70 × 0.65 = **76%** ⚠️ HIGH

---

### Partially Related (25% < Overlap < 75%)
```javascript
// Interpolate between formulas
different_formula = min(0.15, 0.2 × S_text)
same_formula = 0.30 + 0.70 × S_text

S_concept = different_formula × (1 - overlap_ratio) + same_formula × overlap_ratio
```

---

## Problem Identity Test (4 Criteria)

The AI evaluates:

1. ✓ **Same problem being solved?** [YES/NO]
2. ✓ **Same target users?** [YES/NO]
3. ✓ **Same domain/area?** [YES/NO]
4. ✓ **Same research intent?** [YES/NO]

**Core Problem Overlap:**
- 0 YES answers → 0% overlap
- 1-2 YES answers → 25% overlap
- 3 YES answers → 50-75% overlap
- 4 YES answers → 100% overlap

---

## Output Format

### Two Separate Percentages

```json
{
  "textSimilarity": "65%",
  "conceptSimilarity": "12%",
  "problemIdentity": {
    "sameProblem": false,
    "sameUsers": false,
    "sameDomain": false,
    "sameIntent": false,
    "coreOverlap": 0
  },
  "similarityRationale": "Problems are different (0% overlap). Concept similarity capped at 10-15% per academic standards. Only generic/structural overlap is counted."
}
```

### UI Display

```
📊 Two-Stage Analysis Results

Stage 1: Text Similarity
├─ Score: 65%
├─ Type: Word/phrase overlap (cosine)
└─ Includes: Generic terms, academic structure, methodology

Stage 2: Concept Similarity
├─ Score: 12% ✅ ACCEPTABLE
├─ Type: Same research problem?
└─ Status: Problems are different - cap applied

Overall Assessment: 13% (Reflects concept, not text)
```

---

## Academic Standards Compliance

This approach follows:
- ✅ **Thesis proposal defense** standards
- ✅ **Ethics and originality review** criteria
- ✅ **Conceptual plagiarism assessment** guidelines
- ✅ **CHED-aligned evaluation** requirements

### Key Rule:
> **If research problems are NOT the same, conceptual similarity must NOT exceed 10-15%.**

This rule is used in:
- Thesis proposal defenses
- Ethics and originality reviews
- Conceptual plagiarism assessments
- CHED-aligned evaluations

---

## Why This Approach Works

### ✅ Addresses the Core Issue
- High text similarity ≠ High concept similarity
- Different research problems using similar technology = LOW concept similarity

### ✅ Academic Accuracy
- Only counts conceptual overlap when problems are the same
- Properly categorizes generic/structural/methodological overlap

### ✅ Clear to Students
- Students see TWO numbers with clear explanations
- Understand that high text similarity is often normal
- Focus on concept similarity for academic integrity

---

## Implementation Files

### Backend
- **`src/app/api/ai-analysis/route.ts`**
  - Two-stage pipeline logic
  - Problem identity extraction
  - Concept similarity formulas
  - Academic rule enforcement

### Frontend
- **`src/components/AIAnalysisClient.tsx`**
  - Display both text and concept similarity
  - Show problem identity details
  - Explain rationale clearly

---

## Usage Examples

### Case 1: Different Problems
```
Your Research: "QR Code-Based Student Attendance System"
Existing Research: "E-Commerce Content Management System"

Text Similarity: 68% (both are web-based systems, use databases, evaluation frameworks)
Concept Similarity: 11% ✅ (different problems - cap applied)
Verdict: ACCEPTABLE - Different research despite generic similarities
```

### Case 2: Same Problem
```
Your Research: "Machine Learning-Based Crop Disease Detection"
Existing Research: "CNN-Based Plant Disease Detection System"

Text Similarity: 72%
Concept Similarity: 81% ⚠️ (same problem - detecting plant diseases)
Verdict: HIGH SIMILARITY - Requires differentiation
```

### Case 3: Related But Different Focus
```
Your Research: "AI Chatbot for Customer Service"
Existing Research: "AI Chatbot for Mental Health Support"

Text Similarity: 65%
Concept Similarity: 28% (same technology, different application)
Verdict: MEDIUM - Consider further differentiation
```

---

## Best Practices

### For Document Processing
1. **Split into weighted sections**
   - Title (high weight)
   - Abstract/Problem Statement (highest weight)
   - Objectives/Scope (high weight)
   - Methodology (medium weight)
   - Tools/Technologies (low weight)

2. **Focus concept checking on:**
   - Problem statement
   - Research objectives
   - Target users/beneficiaries
   - **NOT on methodology paragraphs**

### For LLM Prompts
1. **Clear distinction between stages**
   - Stage 1: "What words/phrases overlap?"
   - Stage 2: "Is it the SAME research problem?"

2. **Explicit cap enforcement**
   - If problems differ → max 15%
   - If problems same → scale with text similarity

3. **Structured output**
   - Problem Identity Test first
   - Then text similarity
   - Then concept similarity (adjusted)

---

## Future Enhancements

### Stage 1 Improvements
- [ ] Use embeddings (BERT, GPT) for better semantic understanding
- [ ] Implement proper candidate retrieval (top-K from thousands)
- [ ] Add section-based weighting

### Stage 2 Improvements
- [ ] Fine-tuned classifier for problem matching
- [ ] Extract problem statements automatically
- [ ] Multi-dimensional concept analysis

### UI Improvements
- [ ] Visual pipeline diagram
- [ ] Interactive breakdown
- [ ] Comparison table for problem criteria

---

## References

- CHED Handbook on Research Ethics
- IEEE Research Integrity Guidelines
- Academic Plagiarism Detection Standards
- Cosine Similarity in Information Retrieval
