#!/usr/bin/env node

/**
 * Algorithm Accuracy Testing Script
 * Tests the similarity detection algorithm against known test cases
 */

const http = require('http');

// Test cases with expected similarity ranges
const testCases = [
  {
    name: 'Test 1: Identical Text',
    userTitle: 'Machine Learning Applications',
    userConcept: 'The quick brown fox jumps over the lazy dog. This research explores various applications of machine learning in modern computing.',
    existingTitle: 'Machine Learning Applications',
    existingThesisBrief: 'The quick brown fox jumps over the lazy dog. This research explores various applications of machine learning in modern computing.',
    expectedRange: { min: 90, max: 100 },
    description: 'Identical text should yield very high similarity (90-100%)'
  },
  {
    name: 'Test 2: Paraphrased Content',
    userTitle: 'Climate Change Impact',
    userConcept: 'Global warming is a serious threat to humanity. Rising temperatures are causing sea levels to rise, extreme weather events to become more frequent, and ecosystems to collapse. Immediate action is required to mitigate these effects through reduction of greenhouse gas emissions.',
    existingTitle: 'Effects of Climate Change',
    existingThesisBrief: 'Climate change poses a significant danger to human civilization. Increasing heat is leading to ocean expansion, more severe storms, and biodiversity loss. Urgent measures are needed to address this crisis by cutting carbon dioxide output.',
    expectedRange: { min: 40, max: 70 },
    description: 'Heavily paraphrased but same topic (40-70%)'
  },
  {
    name: 'Test 3: Similar Topic, Different Approach',
    userTitle: 'Artificial Intelligence in Healthcare',
    userConcept: 'This research proposes a novel deep learning approach for early detection of skin cancer using convolutional neural networks. The methodology involves training on a dataset of 50,000 dermatological images with various types of melanomas.',
    existingTitle: 'Medical Diagnosis using AI',
    existingThesisBrief: 'This study examines the application of machine learning algorithms for predicting cardiovascular diseases. Statistical analysis was performed on patient health records including blood pressure, cholesterol levels, and lifestyle factors.',
    expectedRange: { min: 20, max: 40 },
    description: 'Same field (AI + Healthcare) but different diseases and methods (20-40%)'
  },
  {
    name: 'Test 4: Word Substitution',
    userTitle: 'Student Performance Analysis',
    userConcept: 'The student submitted their research paper on academic achievement factors. The study examines correlations between study habits, attendance rates, and final grades.',
    existingTitle: 'Learner Achievement Evaluation',
    existingThesisBrief: 'The pupil handed in their academic thesis on educational success elements. The investigation analyzes relationships between learning practices, class participation, and terminal scores.',
    expectedRange: { min: 30, max: 60 },
    description: 'Heavy synonym substitution but same meaning (30-60%)'
  },
  {
    name: 'Test 5: Completely Different Topics',
    userTitle: 'Quantum Computing Algorithms',
    userConcept: 'This research develops new quantum algorithms for solving complex optimization problems using quantum annealing techniques and superposition principles.',
    existingTitle: 'Ancient Roman Culinary Practices',
    existingThesisBrief: 'This historical study examines cooking methods and recipe traditions in ancient Rome, analyzing archaeological evidence from preserved kitchen artifacts and literary sources.',
    expectedRange: { min: 0, max: 10 },
    description: 'Completely unrelated topics (0-10%)'
  },
  {
    name: 'Test 6: Minimal Text',
    userTitle: 'Brief Study',
    userConcept: 'A short research concept with minimal content that barely meets the requirements.',
    existingTitle: 'Brief Study',
    existingThesisBrief: 'A short research concept with minimal content that barely meets the requirements.',
    expectedRange: { min: 90, max: 100 },
    description: 'Minimal identical text (90-100%)'
  },
  {
    name: 'Test 7: Different Language Style',
    userTitle: 'Impact of Social Media on Youth',
    userConcept: 'Social media platforms like Instagram, TikTok, and Facebook have profoundly influenced the behavior, communication patterns, and mental health of young people aged 13-25.',
    existingTitle: 'Social Media Effects on Teenagers',
    existingThesisBrief: 'Online social networking services such as Instagram, TikTok, and Facebook have significantly affected how young individuals communicate, behave, and experience psychological wellbeing.',
    expectedRange: { min: 50, max: 80 },
    description: 'Same content, slightly different wording (50-80%)'
  }
];

async function runTest(testCase, testNumber, total) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running ${testCase.name} (${testNumber}/${total})`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Expected Range: ${testCase.expectedRange.min}% - ${testCase.expectedRange.max}%`);
    
    const postData = JSON.stringify({
      userTitle: testCase.userTitle,
      userConcept: testCase.userConcept,
      existingTitle: testCase.existingTitle,
      existingThesisBrief: testCase.existingThesisBrief
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/similarity/check',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.results && response.results.length > 0) {
            const result = response.results[0];
            const overallSimilarity = (result.overallSimilarity * 100).toFixed(2);
            const lexicalSimilarity = (result.lexicalSimilarity * 100).toFixed(2);
            const semanticSimilarity = (result.semanticSimilarity * 100).toFixed(2);
            
            const isPass = parseFloat(overallSimilarity) >= testCase.expectedRange.min && 
                          parseFloat(overallSimilarity) <= testCase.expectedRange.max;
            
            console.log(`\nResults:`);
            console.log(`  Overall Similarity:  ${overallSimilarity}%`);
            console.log(`  Lexical Similarity:  ${lexicalSimilarity}%`);
            console.log(`  Semantic Similarity: ${semanticSimilarity}%`);
            console.log(`\n  Status: ${isPass ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!isPass) {
              console.log(`  ⚠️  Expected: ${testCase.expectedRange.min}%-${testCase.expectedRange.max}%, Got: ${overallSimilarity}%`);
            }
            
            resolve({
              name: testCase.name,
              passed: isPass,
              expectedMin: testCase.expectedRange.min,
              expectedMax: testCase.expectedRange.max,
              actualOverall: parseFloat(overallSimilarity),
              actualLexical: parseFloat(lexicalSimilarity),
              actualSemantic: parseFloat(semanticSimilarity)
            });
          } else {
            console.log('❌ ERROR: Invalid response format');
            console.log(response);
            resolve({ name: testCase.name, passed: false, error: 'Invalid response' });
          }
        } catch (error) {
          console.log('❌ ERROR: Failed to parse response');
          console.log(error.message);
          console.log('Response:', data);
          resolve({ name: testCase.name, passed: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ ERROR: Request failed');
      console.log(error.message);
      resolve({ name: testCase.name, passed: false, error: error.message });
    });

    req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('SIMILARITY ALGORITHM ACCURACY TESTING');
  console.log('='.repeat(80));
  console.log(`Total Test Cases: ${testCases.length}`);
  console.log(`Target URL: http://localhost:3001/api/similarity/check`);
  console.log('='.repeat(80));

  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i + 1, testCases.length);
    results.push(result);
    
    // Wait a bit between requests to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  
  console.log(`\nTotal Tests:  ${results.length}`);
  console.log(`Passed:       ${passed} ✅`);
  console.log(`Failed:       ${failed} ❌`);
  console.log(`Pass Rate:    ${passRate}%`);
  
  console.log('\n' + '-'.repeat(80));
  console.log('Detailed Results:');
  console.log('-'.repeat(80));
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${index + 1}. ${result.name}: ${status}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (!result.passed) {
      console.log(`   Expected: ${result.expectedMin}%-${result.expectedMax}%`);
      console.log(`   Got:      ${result.actualOverall}%`);
    } else {
      console.log(`   Result:   ${result.actualOverall}% (expected ${result.expectedMin}%-${result.expectedMax}%)`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  if (passRate < 70) {
    console.log('⚠️  CRITICAL: Algorithm accuracy is below 70%. Major improvements needed.');
    console.log('Recommendations:');
    console.log('  - Review similarity calculation weights');
    console.log('  - Adjust semantic analysis parameters');
    console.log('  - Consider implementing additional algorithms');
  } else if (passRate < 85) {
    console.log('⚠️  MODERATE: Algorithm accuracy is acceptable but could be improved.');
    console.log('Recommendations:');
    console.log('  - Fine-tune algorithm weights');
    console.log('  - Add more test cases for edge scenarios');
  } else {
    console.log('✅ GOOD: Algorithm accuracy is performing well.');
    console.log('Consider adding more complex test cases for continuous improvement.');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n');
}

// Run tests
console.log('Starting algorithm accuracy tests...');
console.log('Make sure the dev server is running on http://localhost:3001\n');

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
