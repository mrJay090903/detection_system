#!/usr/bin/env python3
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    print("GEMINI_API_KEY not found")
    exit(1)

client = genai.Client(api_key=api_key)

print("Available models:")
try:
    for model in client.models.list():
        print(f"- {model.name}")
        if hasattr(model, 'supported_generation_methods'):
            print(f"  Methods: {model.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models: {e}")
