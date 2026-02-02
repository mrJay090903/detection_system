// Test script for Gemini Semantic Similarity Scoring
// Run with: node scripts/test_gemini_similarity.js

import { scoreSemanticSimilarity, formatScores } from '../src/lib/gemini-similarity.ts'

async function testGeminiSimilarity() {
  console.log('='.repeat(70))
  console.log('GEMINI SEMANTIC SIMILARITY TEST')
  console.log('='.repeat(70))
  console.log()

  // Test Case 1: High Similarity
  console.log('📋 TEST CASE 1: High Similarity (Same Topic, Different Wording)')
  console.log('-'.repeat(70))
  
  const test1Result = await scoreSemanticSimilarity(
    'Real-time Drowsiness Detection Using CNN',
    `This research develops a real-time drowsiness detection system for drivers 
     using Convolutional Neural Networks (CNN). The system analyzes facial features 
     from video frames to detect signs of drowsiness such as eye closure and yawning. 
     The goal is to prevent accidents by alerting drivers when drowsiness is detected.`,
    
    'Driver Fatigue Monitoring System Using Deep Learning',
    `This study presents a driver fatigue monitoring system that uses deep learning 
     techniques to analyze driver behavior. The system processes real-time video data 
     to identify fatigue indicators including prolonged eye closure and frequent yawning. 
     An alert mechanism notifies the driver to prevent potential accidents.`,
    
    2 // retries
  )
  
  console.log(formatScores(test1Result))
  console.log()

  // Test Case 2: Medium Similarity
  console.log('📋 TEST CASE 2: Medium Similarity (Related but Different Focus)')
  console.log('-'.repeat(70))
  
  const test2Result = await scoreSemanticSimilarity(
    'Drowsiness Detection in Vehicle Drivers',
    `A system to detect drowsiness in vehicle drivers using computer vision 
     and machine learning algorithms to analyze facial expressions and eye movements.`,
    
    'Student Attention Monitoring in Online Classes',
    `A system to monitor student attention levels during online classes using 
     computer vision to detect face orientation and eye tracking to measure engagement.`,
    
    2
  )
  
  console.log(formatScores(test2Result))
  console.log()

  // Test Case 3: Low Similarity
  console.log('📋 TEST CASE 3: Low Similarity (Different Topics)')
  console.log('-'.repeat(70))
  
  const test3Result = await scoreSemanticSimilarity(
    'Driver Drowsiness Detection System',
    `A real-time system that detects driver drowsiness using facial feature 
     analysis and deep learning to prevent traffic accidents.`,
    
    'Automated Plant Disease Classification',
    `A system that uses machine learning to automatically classify plant diseases 
     from leaf images to help farmers identify and treat crop diseases early.`,
    
    2
  )
  
  console.log(formatScores(test3Result))
  console.log()

  // Summary
  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log()
  console.log(`Test 1 (High):   ${test1Result.weightedPercentage}%`)
  console.log(`Test 2 (Medium): ${test2Result.weightedPercentage}%`)
  console.log(`Test 3 (Low):    ${test3Result.weightedPercentage}%`)
  console.log()
  
  // Validation
  const allValid = test1Result.isValid && test2Result.isValid && test3Result.isValid
  console.log(`✅ All tests ${allValid ? 'PASSED' : 'FAILED'}`)
  console.log()
  
  if (!allValid) {
    console.error('❌ Some tests failed:')
    if (!test1Result.isValid) console.error(`  - Test 1: ${test1Result.error}`)
    if (!test2Result.isValid) console.error(`  - Test 2: ${test2Result.error}`)
    if (!test3Result.isValid) console.error(`  - Test 3: ${test3Result.error}`)
  }
  
  return allValid
}

// Run tests
testGeminiSimilarity()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Test execution failed:', error)
    process.exit(1)
  })
