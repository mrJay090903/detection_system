"""
Cosine Similarity Algorithm for Research Title and Abstract Comparison
This script calculates cosine similarity between proposed research and existing researches.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import sys
from typing import List, Dict, Tuple


def preprocess_text(text: str) -> str:
    """Preprocess text by converting to lowercase and removing extra spaces."""
    if not text:
        return ""
    return text.lower().strip()


def calculate_cosine_similarity(
    proposed_title: str,
    proposed_concept: str,
    existing_titles: List[str],
    existing_abstracts: List[str]
) -> List[Dict]:
    """
    Calculate cosine similarity between proposed research and existing researches.
    
    Args:
        proposed_title: The proposed research title
        proposed_concept: The proposed research concept/abstract
        existing_titles: List of existing research titles
        existing_abstracts: List of existing research abstracts
    
    Returns:
        List of dictionaries containing similarity scores and research info
    """
    # Preprocess texts
    proposed_title_processed = preprocess_text(proposed_title)
    proposed_concept_processed = preprocess_text(proposed_concept)
    
    existing_titles_processed = [preprocess_text(title) for title in existing_titles]
    existing_abstracts_processed = [preprocess_text(abstract) for abstract in existing_abstracts]
    
    results = []
    
    # Calculate title similarity
    if proposed_title_processed and existing_titles_processed:
        # Combine proposed title with existing titles for vectorization
        all_titles = [proposed_title_processed] + existing_titles_processed
        
        # Use TF-IDF vectorizer for title comparison
        title_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        try:
            title_vectors = title_vectorizer.fit_transform(all_titles)
            title_similarities = cosine_similarity(
                title_vectors[0:1],  # Proposed title
                title_vectors[1:]    # Existing titles
            )[0]
        except Exception as e:
            print(f"Error in title similarity calculation: {e}", file=sys.stderr)
            title_similarities = [0.0] * len(existing_titles)
    else:
        title_similarities = [0.0] * len(existing_titles)
    
    # Calculate abstract/concept similarity
    if proposed_concept_processed and existing_abstracts_processed:
        # Combine proposed concept with existing abstracts for vectorization
        all_abstracts = [proposed_concept_processed] + existing_abstracts_processed
        
        # Use TF-IDF vectorizer for abstract comparison
        abstract_vectorizer = TfidfVectorizer(max_features=2000, stop_words='english')
        try:
            abstract_vectors = abstract_vectorizer.fit_transform(all_abstracts)
            abstract_similarities = cosine_similarity(
                abstract_vectors[0:1],  # Proposed concept
                abstract_vectors[1:]    # Existing abstracts
            )[0]
        except Exception as e:
            print(f"Error in abstract similarity calculation: {e}", file=sys.stderr)
            abstract_similarities = [0.0] * len(existing_abstracts)
    else:
        abstract_similarities = [0.0] * len(existing_abstracts)
    
    # Combine similarities (weighted average: 40% title, 60% abstract)
    for i in range(len(existing_titles)):
        title_sim = float(title_similarities[i]) if i < len(title_similarities) else 0.0
        abstract_sim = float(abstract_similarities[i]) if i < len(abstract_similarities) else 0.0
        
        # Weighted average
        overall_similarity = (title_sim * 0.4) + (abstract_sim * 0.6)
        
        results.append({
            "index": i,
            "title": existing_titles[i],
            "abstract": existing_abstracts[i],
            "title_similarity": round(title_sim, 4),
            "abstract_similarity": round(abstract_sim, 4),
            "overall_similarity": round(overall_similarity, 4)
        })
    
    # Sort by overall similarity (descending)
    results.sort(key=lambda x: x["overall_similarity"], reverse=True)
    
    return results


def main():
    """Main function to run cosine similarity check."""
    try:
        # Read input from stdin (JSON format)
        input_data = json.load(sys.stdin)
        
        proposed_title = input_data.get("proposed_title", "")
        proposed_concept = input_data.get("proposed_concept", "")
        existing_researches = input_data.get("existing_researches", [])
        
        # Extract titles and abstracts
        existing_titles = [r.get("title", "") for r in existing_researches]
        existing_abstracts = [r.get("abstract", "") for r in existing_researches]
        
        # Calculate similarities
        results = calculate_cosine_similarity(
            proposed_title,
            proposed_concept,
            existing_titles,
            existing_abstracts
        )
        
        # Output results as JSON
        output = {
            "success": True,
            "proposed_title": proposed_title,
            "proposed_concept": proposed_concept,
            "similarities": results,
            "total_comparisons": len(results)
        }
        
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


