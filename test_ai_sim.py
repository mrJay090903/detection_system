#!/usr/bin/env python3
import json
import sys
from scripts.gemini_api import calculate_ai_similarity

# Test cases
test1_title = "Development of an AI-Powered Plagiarism Detection Tool for Academic Research Papers"
test1_concept = "This research presents the development of an AI-powered plagiarism detection tool"

test2_title = "Smart Waste Segregation System Using IoT and Machine Learning for Urban Communities"
test2_concept = "This study presents the development of a Smart Waste Segregation System that utilizes Internet of Things"

print("Testing AI Similarity Calculation\n")
print(f"Test 1: {test1_title[:50]}...")
print(f"Test 2: {test2_title[:50]}...\n")

result = calculate_ai_similarity(test1_title, test1_concept, test2_title, test2_concept)

print("Result:")
print(json.dumps(result, indent=2))

if result.get('success'):
    print(f"\n✓ Title Similarity: {result['titleSimilarity'] * 100:.1f}%")
    print(f"✓ Abstract Similarity: {result['abstractSimilarity'] * 100:.1f}%")
    print(f"✓ Overall Similarity: {result['overallSimilarity'] * 100:.1f}%")
    print(f"\nReasoning: {result.get('reasoning', 'No reasoning provided')}")
else:
    print(f"\n✗ Error: {result.get('error')}")
