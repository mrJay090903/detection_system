#!/usr/bin/env python3
import os
import sys
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def calculate_ai_similarity(proposed_title, proposed_concept, existing_title, existing_abstract):
    """Calculate similarity using AI semantic understanding"""
    try:
        # Normalize text for comparison
        def normalize(text):
            return ' '.join(text.strip().lower().split())
        
        # Quick exact match check
        title_exact = normalize(proposed_title) == normalize(existing_title)
        concept_exact = normalize(proposed_concept) == normalize(existing_abstract)
        
        # Also check if concept starts with abstract (in case concept is longer)
        concept_contains_abstract = normalize(proposed_concept).startswith(normalize(existing_abstract))
        abstract_contains_concept = normalize(existing_abstract).startswith(normalize(proposed_concept))
        
        if title_exact and (concept_exact or concept_contains_abstract or abstract_contains_concept):
            return {
                "success": True,
                "titleSimilarity": 1.0,
                "abstractSimilarity": 1.0,
                "overallSimilarity": 1.0,
                "reasoning": "Exact match detected - 100% identical content",
                "model_used": "exact_match"
            }
        
        # Configure Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {"error": "GEMINI_API_KEY not found in environment variables"}
        
        client = genai.Client(api_key=api_key)
        
        # Try multiple models in order of preference
        models_to_try = [
            'models/gemini-2.0-flash-lite',  # Fast, efficient model for long content
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest'
        ]
        
        last_error = None
        
        prompt = f"""You are an AI Research Similarity Analyzer. Calculate EXACT similarity scores.

PROPOSED RESEARCH:
Title: "{proposed_title}"
Concept: "{proposed_concept}"

EXISTING RESEARCH:
Title: "{existing_title}"
Abstract: "{existing_abstract}"

SCORING ALGORITHM:
1. Count total words in both texts
2. Count exact matching words (case-insensitive)
3. Calculate word match percentage
4. Apply scoring:
   - 95-100% matching words → 100 score
   - 90-94% matching words → 98 score  
   - 85-89% matching words → 95 score
   - 80-84% matching words → 90 score
   - 70-79% matching words → 85 score
   - 60-69% matching words → 75 score
   - 50-59% matching words → 65 score
   - Below 50% → Use semantic similarity

IMPORTANT:
- If texts are identical (same words, same order) → MUST return 100
- If only whitespace/punctuation differs → MUST return 100
- Count word overlaps precisely before semantic analysis

Return ONLY JSON (no markdown):
{{"titleSimilarity": <0-100>, "abstractSimilarity": <0-100>, "overallSimilarity": <0-100>, "reasoning": "<explanation>"}}"""

        for model_name in models_to_try:
            try:
                # Generate content using current model
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                
                # Parse the JSON response
                response_text = response.text.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith('```'):
                    response_text = response_text.split('\n', 1)[1]
                    response_text = response_text.rsplit('\n```', 1)[0]
                if response_text.startswith('json'):
                    response_text = response_text[4:].strip()
                
                result = json.loads(response_text)
                
                return {
                    "success": True,
                    "titleSimilarity": result.get("titleSimilarity", 0) / 100.0,
                    "abstractSimilarity": result.get("abstractSimilarity", 0) / 100.0,
                    "overallSimilarity": result.get("overallSimilarity", 0) / 100.0,
                    "reasoning": result.get("reasoning", ""),
                    "model_used": model_name
                }
            except Exception as model_error:
                last_error = str(model_error)
                # If it's a quota error, try next model
                if '429' in str(model_error) or 'RESOURCE_EXHAUSTED' in str(model_error):
                    continue
                # For other errors, try next model too
                continue
        
        # If all models failed, return the last error
        return {
            "success": False,
            "error": f"All models failed. Last error: {last_error}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def verify_similarity_scores(proposed_title, proposed_concept, existing_title, existing_abstract, title_sim, abstract_sim, overall_sim):
    """Verify and correct similarity scores using AI"""
    try:
        # Configure Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {"error": "GEMINI_API_KEY not found in environment variables"}
        
        client = genai.Client(api_key=api_key)
        
        # Try multiple models in order of preference
        models_to_try = [
            'models/gemini-2.0-flash-lite',  # Fast, efficient model for long content
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest'
        ]
        
        last_error = None
        
        prompt = f"""You are an AI assistant for a Research Similarity Detection System.

Your job is to evaluate the accuracy of similarity scores produced by a cosine similarity algorithm.

PROPOSED RESEARCH:
Title: "{proposed_title}"
Concept: "{proposed_concept}"

EXISTING RESEARCH:
Title: "{existing_title}"
Abstract: "{existing_abstract}"

SYSTEM'S COMPUTED SCORES:
- Title Similarity: {title_sim:.2f}%
- Abstract Similarity: {abstract_sim:.2f}%
- Overall Similarity: {overall_sim:.2f}%

Your task is to:

1. Verify if the cosine similarity scores make sense by checking:
   - Wording similarity
   - Sentence structure
   - Shared keywords
   - Shared themes
   - Shared system features
   - Problem being solved
   - Method used
   - Output or deliverables

2. Correct the similarity score if necessary using this guideline:
   - 0–39% → Low Similarity
   - 40–69% → Moderate Similarity
   - 70–100% → High Similarity

3. Provide your own similarity computation reasoning with manual breakdown

4. Return response in this EXACT format:

=== SIMILARITY ACCURACY CHECK ===

System Score Received:
- Title Similarity: {title_sim:.2f}%
- Abstract Similarity: {abstract_sim:.2f}%
- Overall Similarity: {overall_sim:.2f}%

AI Accuracy Evaluation:
[Explain if the system's scores are correct, too high, too low, or incorrect. Compare actual keyword overlap, theme similarity, and problem/method similarity.]

Corrected Similarity (if needed):
- Title Similarity: [Your corrected %]
- Abstract Similarity: [Your corrected %]
- Overall Similarity: [Your corrected %]
(If system scores are correct, keep them the same)

Reasoning:
[Explain specific keywords found in BOTH texts, shared phrases, concept overlap, functional similarities, method similarities. Be SPECIFIC with examples.]

Final Assessment:
[State: Low / Moderate / High Similarity]
[Provide clear explanation of why, with specific examples]

IMPORTANT RULES:
- Base judgment ONLY on text comparison and semantic overlap
- Do NOT generate random scores
- Keep explanations clear and simple
- Be SPECIFIC about what is similar or different"""

        for model_name in models_to_try:
            try:
                # Generate content using current model
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                
                return {
                    "success": True,
                    "verification": response.text,
                    "model_used": model_name
                }
            except Exception as model_error:
                last_error = str(model_error)
                # If it's a quota error, try next model
                if '429' in str(model_error) or 'RESOURCE_EXHAUSTED' in str(model_error):
                    continue
                # For other errors, try next model too
                continue
        
        # If all models failed, return the last error
        return {
            "success": False,
            "error": f"All models failed. Last error: {last_error}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def generate_similarity_explanation(proposed_title, proposed_concept, existing_title, existing_abstract, lexical_sim, semantic_sim):
    """Generate similarity explanation using Gemini API"""
    try:
        # Configure Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {"error": "GEMINI_API_KEY not found in environment variables"}
        
        client = genai.Client(api_key=api_key)
        
        # Try multiple models in order of preference
        models_to_try = [
            'models/gemini-2.0-flash-lite',  # Fast, efficient model for long content
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest',
            'models/gemini-2.5-pro',
            'models/gemini-pro-latest'
        ]
        
        last_error = None
        
        for model_name in models_to_try:
            try:
                prompt = f"""You are a friendly teacher explaining research similarity to students. Make it simple and easy to understand.

PROPOSED RESEARCH:
Title: "{proposed_title}"
Concept: "{proposed_concept}"

EXISTING RESEARCH:
Title: "{existing_title}"
Abstract: "{existing_abstract}"

SIMILARITY SCORES:
- Word Matching: {lexical_sim:.1f}%
- Meaning Matching: {semantic_sim:.1f}%

Explain the similarity in the SIMPLEST way possible. Use this EXACT format:

**How similar are they?**
[In 1-2 simple sentences, tell if they are very similar, somewhat similar, or different. Use everyday language like "almost the same" or "pretty different".]

**What are they both trying to do?**
[In 2-3 simple sentences, explain the main goal or problem both researches want to solve. Use simple words - avoid technical jargon.]

**How are they doing it?**
[In 2-3 simple sentences, list the tools, methods, or technologies they both use. Be specific but simple - like "both use blockchain" or "both use mobile apps".]

**Why should you care about this similarity?**
[Write 3-4 simple sentences explaining what this similarity means. Start with "Both of these researches..." and explain in plain English why they are similar. Mention specific things they have in common. Make it conversational and easy to read.]

**What's the bottom line?**
[In 1-2 sentences, give a clear verdict: Are they too similar (might be copying)? Somewhat similar (same field but different enough)? Or different (totally unique)? Then give simple advice.]

RULES:
- Use SIMPLE everyday words - like you're explaining to a friend
- NO academic jargon or complex terms
- Be SPECIFIC - mention exact technologies, methods, or goals from the abstracts
- Make it CONVERSATIONAL and friendly
- Keep it SHORT and to the point"""
        
                # Generate content using current model
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                
                return {
                    "success": True,
                    "explanation": response.text,
                    "model_used": model_name
                }
            except Exception as model_error:
                last_error = str(model_error)
                # If it's a quota error, try next model
                if '429' in str(model_error) or 'RESOURCE_EXHAUSTED' in str(model_error):
                    continue
                # For other errors, try next model too
                continue
        
        # If all models failed, return the last error
        return {
            "success": False,
            "error": f"All models failed. Last error: {last_error}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def generate_report(proposed_title, proposed_concept, similarities):
    """Generate comprehensive similarity report using Gemini API"""
    try:
        # Debug logging
        import sys
        print(f"DEBUG: Received {len(similarities)} similarities", file=sys.stderr)
        if len(similarities) > 0:
            print(f"DEBUG: First similarity keys: {similarities[0].keys()}", file=sys.stderr)
            print(f"DEBUG: titleSimilarity value: {similarities[0].get('titleSimilarity')}", file=sys.stderr)
        
        # Configure Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {"error": "GEMINI_API_KEY not found in environment variables"}
        
        client = genai.Client(api_key=api_key)
        
        # Try multiple models in order of preference
        models_to_try = [
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest',
            'models/gemini-2.5-pro',
            'models/gemini-pro-latest'
        ]
        
        last_error = None
        
        # Format top similarities
        top_similar = similarities[:3]
        similar_text = ""
        for i, r in enumerate(top_similar):
            # Safely get similarity values with defaults
            title_sim = r.get('titleSimilarity', 0) or 0
            abstract_sim = r.get('abstractSimilarity', 0) or 0
            overall_sim = r.get('overallSimilarity', 0) or 0
            
            print(f"DEBUG: Research {i}: title_sim={title_sim}, abstract_sim={abstract_sim}, overall_sim={overall_sim}", file=sys.stderr)
            
            similar_text += f"""
{i + 1}. Title: {r.get('title', 'Unknown')}
   Year: {r.get('year', 'N/A')}
   Course: {r.get('course', 'N/A')}
   Abstract: {r.get('abstract', 'No abstract available')}
   Title Similarity: {title_sim * 100:.1f}%
   Concept Similarity: {abstract_sim * 100:.1f}%
   Overall Similarity: {overall_sim * 100:.1f}%
"""
        
        prompt = f"""You are an expert research analyst. Analyze the similarity between a proposed research and existing researches.

PROPOSED RESEARCH:
Title: {proposed_title}
Concept: {proposed_concept}

EXISTING RESEARCHES FROM DATABASE WITH SIMILARITY SCORES:
{similar_text}

Please generate a comprehensive similarity analysis report that includes:
1. Executive Summary - Overall assessment of similarity
2. Title Analysis - Comparison of proposed title with existing titles
3. Concept Analysis - Comparison of proposed concept with existing abstracts
4. Risk Assessment - Level of similarity risk (Low/Medium/High)
5. Recommendations - Suggestions for improving originality if needed
6. Conclusion - Final verdict on the proposed research

Format the report in a clear, professional manner suitable for academic review."""
        
        for model_name in models_to_try:
            try:
                # Generate content using current model
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                
                return {
                    "success": True,
                    "report": response.text,
                    "model_used": model_name
                }
            except Exception as model_error:
                last_error = str(model_error)
                # If it's a quota error, try next model
                if '429' in str(model_error) or 'RESOURCE_EXHAUSTED' in str(model_error):
                    continue
                # For other errors, try next model too
                continue
        
        # If all models failed, return the last error
        return {
            "success": False,
            "error": f"All models failed. Last error: {last_error}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # Read input from stdin
    try:
        input_data = json.loads(sys.stdin.read())
        
        action = input_data.get('action')
        
        if action == 'calculate':
            result = calculate_ai_similarity(
                input_data['proposedTitle'],
                input_data['proposedConcept'],
                input_data['existingTitle'],
                input_data['existingAbstract']
            )
        elif action == 'explanation':
            result = generate_similarity_explanation(
                input_data['proposedTitle'],
                input_data['proposedConcept'],
                input_data['existingTitle'],
                input_data['existingAbstract'],
                input_data['lexicalSim'],
                input_data['semanticSim']
            )
        elif action == 'report':
            result = generate_report(
                input_data['proposedTitle'],
                input_data['proposedConcept'],
                input_data['similarities']
            )
        elif action == 'verify':
            result = verify_similarity_scores(
                input_data['proposedTitle'],
                input_data['proposedConcept'],
                input_data['existingTitle'],
                input_data['existingAbstract'],
                input_data['titleSimilarity'],
                input_data['abstractSimilarity'],
                input_data['overallSimilarity']
            )
        else:
            result = {"error": "Invalid action"}
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
