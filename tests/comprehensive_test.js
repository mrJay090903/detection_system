#!/usr/bin/env node

/**
 * Comprehensive AI & Algorithm Testing Suite
 * Tests both similarity algorithms and AI analysis quality
 */

const http = require('http');
const https = require('https');

// ============================================================================
// TEST CONFIGURATION
// ============================================================================
const CONFIG = {
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.GEMINI_API_KEY,
  testDelay: 1500, // ms between tests to avoid rate limiting
};

// ============================================================================
// ALGORITHM TEST CASES
// ============================================================================
const algorithmTests = [
  {
    name: 'Identical Text',
    userTitle: 'Machine Learning Applications in Healthcare',
    userConcept: 'The quick brown fox jumps over the lazy dog. This research explores various applications of machine learning in modern computing. We focus on deep learning, neural networks, and classification algorithms.',
    existingTitle: 'Machine Learning Applications in Healthcare',
    existingThesisBrief: 'The quick brown fox jumps over the lazy dog. This research explores various applications of machine learning in modern computing. We focus on deep learning, neural networks, and classification algorithms.',
    expected: { min: 85, max: 100 },
    priority: 'HIGH'
  },
  {
    name: 'Paraphrased Content',
    userTitle: 'Climate Change Impact',
    userConcept: 'Global warming is a serious threat to humanity. Rising temperatures are causing sea levels to rise, extreme weather events to become more frequent, and ecosystems to collapse. Immediate action is required to mitigate these effects through reduction of greenhouse gas emissions and adoption of renewable energy sources.',
    existingTitle: 'Effects of Climate Change',
    existingThesisBrief: 'Climate change poses a significant danger to human civilization. Increasing heat is leading to ocean expansion, more severe storms, and biodiversity loss. Urgent measures are needed to address this crisis by cutting carbon dioxide output and transitioning to clean energy alternatives.',
    expected: { min: 45, max: 75 },
    priority: 'HIGH'
  },
  {
    name: 'Similar Topic Different Methods',
    userTitle: 'AI for Skin Cancer Detection',
    userConcept: 'This research proposes a novel deep learning approach for early detection of skin cancer using convolutional neural networks. The methodology involves training on a dataset of 50,000 dermatological images with various types of melanomas. We employ transfer learning with ResNet-50 architecture.',
    existingTitle: 'Medical Diagnosis using AI',
    existingThesisBrief: 'This study examines the application of machine learning algorithms for predicting cardiovascular diseases. Statistical analysis was performed on patient health records including blood pressure, cholesterol levels, and lifestyle factors using logistic regression and random forests.',
    expected: { min: 15, max: 35 },
    priority: 'MEDIUM'
  },
  {
    name: 'Synonym Substitution',
    userTitle: 'Student Performance Analysis',
    userConcept: 'The student submitted their research paper on academic achievement factors. The study examines correlations between study habits, attendance rates, and final grades. Data was collected from 500 undergraduate students across multiple disciplines.',
    existingTitle: 'Learner Achievement Evaluation',
    existingThesisBrief: 'The pupil handed in their academic thesis on educational success elements. The investigation analyzes relationships between learning practices, class participation, and terminal scores. Information was gathered from 500 college learners in various fields.',
    expected: { min: 40, max: 70 },
    priority: 'HIGH'
  },
  {
    name: 'Completely Different Topics',
    userTitle: 'Quantum Computing Algorithms',
    userConcept: 'This research develops new quantum algorithms for solving complex optimization problems using quantum annealing techniques and superposition principles. We explore applications in cryptography and drug discovery.',
    existingTitle: 'Ancient Roman Culinary Practices',
    existingThesisBrief: 'This historical study examines cooking methods and recipe traditions in ancient Rome, analyzing archaeological evidence from preserved kitchen artifacts and literary sources from Apicius manuscripts.',
    expected: { min: 0, max: 8 },
    priority: 'HIGH'
  },
  {
    name: 'Partial Overlap',
    userTitle: 'Mobile Learning Applications',
    userConcept: 'This research develops a mobile learning application for mathematics education. The app features interactive lessons, gamification elements, and real-time progress tracking. Target users are high school students aged 15-18.',
    existingTitle: 'E-Learning Platform Development',
    existingThesisBrief: 'This project creates an e-learning platform for teaching computer science courses. The system includes video lectures, automated grading, discussion forums, and certification modules. The platform targets college students and working professionals.',
    expected: { min: 25, max: 45 },
    priority: 'MEDIUM'
  },
  {
    name: 'Same Research Different Year',
    userTitle: 'Smart Home Automation System',
    userConcept: 'Development of a smart home automation system using IoT sensors and mobile application. The system controls lighting, temperature, security cameras, and appliances remotely. Implementation uses Arduino, ESP8266, and Firebase cloud database.',
    existingTitle: 'Smart Home Automation System',
    existingThesisBrief: 'Development of a smart home automation system using IoT sensors and mobile application. The system controls lighting, temperature, security cameras, and appliances remotely. Implementation uses Arduino, ESP8266, and Firebase cloud database.',
    expected: { min: 85, max: 100 },
    priority: 'CRITICAL'
  }
];

// ============================================================================
// AI ANALYSIS TEST CASES
// ============================================================================
const aiTests = [
  {
    name: 'High Similarity Detection',
    userTitle: 'Blockchain Technology in Supply Chain Management',
    userConcept: 'This research explores the application of blockchain technology to improve transparency and traceability in supply chain management. The proposed system uses smart contracts and distributed ledger technology.',
    existingTitle: 'Blockchain-Based Supply Chain Tracking System',
    existingThesisBrief: 'This study implements a blockchain solution for supply chain tracking. The system leverages smart contracts to automate verification processes and uses distributed ledgers to ensure transparency across all stakeholders.',
    similarities: { lexical: 0.65, semantic: 0.70, overall: 0.68 },
    expectedVerdict: 'HIGH_SIMILARITY',
    shouldFlag: true
  },
  {
    name: 'Moderate Similarity Detection',
    userTitle: 'Social Media Sentiment Analysis',
    userConcept: 'This research develops a sentiment analysis tool for analyzing public opinion on social media platforms. We use natural language processing and machine learning techniques.',
    existingTitle: 'Opinion Mining from Twitter Data',
    existingThesisBrief: 'This project creates a system for extracting opinions from Twitter posts. The methodology employs text mining algorithms and sentiment classification models.',
    similarities: { lexical: 0.35, semantic: 0.40, overall: 0.38 },
    expectedVerdict: 'MODERATE_SIMILARITY',
    shouldFlag: true
  },
  {
    name: 'Low Similarity Detection',
    userTitle: 'Renewable Energy Optimization',
    userConcept: 'This research optimizes solar panel efficiency using predictive maintenance algorithms.',
    existingTitle: 'Traffic Management System',
    existingThesisBrief: 'This study develops an intelligent traffic light control system using computer vision.',
    similarities: { lexical: 0.05, semantic: 0.08, overall: 0.07 },
    expectedVerdict: 'LOW_SIMILARITY',
    shouldFlag: false
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null,
            rawData: data
          });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: null, rawData: data, error: error.message });
        }
      });
    });
    
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ALGORITHM TESTING
// ============================================================================
async function testAlgorithm(testCase, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${index}/${total}] Testing: ${testCase.name} [${testCase.priority}]`);
  console.log(`${'='.repeat(80)}`);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/similarity/check',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const postData = {
    proposedTitle: testCase.userTitle,
    proposedConcept: testCase.userConcept,
  };

  try {
    const response = await makeRequest(options, postData);
    
    if (response.statusCode !== 200) {
      return {
        name: testCase.name,
        passed: false,
        error: `HTTP ${response.statusCode}`,
        priority: testCase.priority
      };
    }

    const result = response.data.results?.[0];
    if (!result) {
      return {
        name: testCase.name,
        passed: false,
        error: 'Invalid response format',
        priority: testCase.priority
      };
    }

    const overall = result.overallSimilarity * 100;
    const lexical = result.lexicalSimilarity * 100;
    const semantic = result.semanticSimilarity * 100;

    const passed = overall >= testCase.expected.min && overall <= testCase.expected.max;
    const deviation = passed ? 0 : Math.min(
      Math.abs(overall - testCase.expected.min),
      Math.abs(overall - testCase.expected.max)
    );

    console.log(`Expected: ${testCase.expected.min}% - ${testCase.expected.max}%`);
    console.log(`Results:`);
    console.log(`  Overall:  ${overall.toFixed(2)}% ${passed ? '✅' : '❌'}`);
    console.log(`  Lexical:  ${lexical.toFixed(2)}%`);
    console.log(`  Semantic: ${semantic.toFixed(2)}%`);
    
    if (!passed) {
      console.log(`  Deviation: ${deviation.toFixed(2)}% ${deviation > 20 ? '🚨 CRITICAL' : '⚠️'}`);
    }

    return {
      name: testCase.name,
      passed,
      priority: testCase.priority,
      expected: testCase.expected,
      actual: { overall, lexical, semantic },
      deviation
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      error: error.message,
      priority: testCase.priority
    };
  }
}

// ============================================================================
// AI ANALYSIS TESTING
// ============================================================================
async function testAI(testCase, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${index}/${total}] AI Test: ${testCase.name}`);
  console.log(`${'='.repeat(80)}`);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/ai-analysis',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const postData = {
    userTitle: testCase.userTitle,
    userConcept: testCase.userConcept,
    existingTitle: testCase.existingTitle,
    existingThesisBrief: testCase.existingThesisBrief,
    similarities: testCase.similarities
  };

  try {
    const start = Date.now();
    const response = await makeRequest(options, postData);
    const duration = Date.now() - start;

    if (response.statusCode !== 200) {
      return {
        name: testCase.name,
        passed: false,
        error: `HTTP ${response.statusCode}`,
        responseTime: duration
      };
    }

    const analysis = response.data.analysis;
    const hasRecommendations = analysis && analysis.length > 100;
    const hasSimilarityMention = analysis && analysis.toLowerCase().includes('similar');
    
    console.log(`Response Time: ${duration}ms`);
    console.log(`Analysis Length: ${analysis?.length || 0} chars`);
    console.log(`Has Recommendations: ${hasRecommendations ? '✅' : '❌'}`);
    console.log(`Mentions Similarity: ${hasSimilarityMention ? '✅' : '❌'}`);

    const qualityScore = (
      (hasRecommendations ? 40 : 0) +
      (hasSimilarityMention ? 30 : 0) +
      (duration < 10000 ? 30 : duration < 20000 ? 20 : 10)
    );

    return {
      name: testCase.name,
      passed: qualityScore >= 70,
      qualityScore,
      responseTime: duration,
      hasRecommendations,
      hasSimilarityMention,
      analysisLength: analysis?.length || 0
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      error: error.message
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function runComprehensiveTests() {
  console.log('\n' + '█'.repeat(80));
  console.log('COMPREHENSIVE AI & ALGORITHM TESTING SUITE');
  console.log('█'.repeat(80));
  console.log(`Test Server: ${CONFIG.baseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('█'.repeat(80));

  // Phase 1: Algorithm Tests
  console.log('\n\n' + '▓'.repeat(80));
  console.log('PHASE 1: SIMILARITY ALGORITHM TESTING');
  console.log('▓'.repeat(80));
  console.log(`Total Algorithm Tests: ${algorithmTests.length}`);

  const algorithmResults = [];
  for (let i = 0; i < algorithmTests.length; i++) {
    const result = await testAlgorithm(algorithmTests[i], i + 1, algorithmTests.length);
    algorithmResults.push(result);
    if (i < algorithmTests.length - 1) await delay(CONFIG.testDelay);
  }

  // Phase 2: AI Analysis Tests
  console.log('\n\n' + '▓'.repeat(80));
  console.log('PHASE 2: AI ANALYSIS QUALITY TESTING');
  console.log('▓'.repeat(80));
  console.log(`Total AI Tests: ${aiTests.length}`);

  const aiResults = [];
  for (let i = 0; i < aiTests.length; i++) {
    const result = await testAI(aiTests[i], i + 1, aiTests.length);
    aiResults.push(result);
    if (i < aiTests.length - 1) await delay(CONFIG.testDelay);
  }

  // ============================================================================
  // RESULTS ANALYSIS
  // ============================================================================
  console.log('\n\n' + '█'.repeat(80));
  console.log('TEST RESULTS SUMMARY');
  console.log('█'.repeat(80));

  // Algorithm Results
  const algPassed = algorithmResults.filter(r => r.passed).length;
  const algFailed = algorithmResults.filter(r => !r.passed).length;
  const algPassRate = (algPassed / algorithmResults.length * 100).toFixed(1);
  
  console.log('\n📊 ALGORITHM TESTING:');
  console.log(`  Total:     ${algorithmResults.length}`);
  console.log(`  Passed:    ${algPassed} ✅`);
  console.log(`  Failed:    ${algFailed} ❌`);
  console.log(`  Pass Rate: ${algPassRate}%`);

  // Critical failures
  const criticalFailures = algorithmResults.filter(r => !r.passed && r.priority === 'CRITICAL');
  if (criticalFailures.length > 0) {
    console.log(`\n  🚨 CRITICAL FAILURES: ${criticalFailures.length}`);
    criticalFailures.forEach(f => {
      console.log(`    - ${f.name}: ${f.error || `${f.deviation?.toFixed(2)}% deviation`}`);
    });
  }

  // High priority failures
  const highPriorityFailures = algorithmResults.filter(r => !r.passed && r.priority === 'HIGH');
  if (highPriorityFailures.length > 0) {
    console.log(`\n  ⚠️  HIGH PRIORITY FAILURES: ${highPriorityFailures.length}`);
    highPriorityFailures.forEach(f => {
      console.log(`    - ${f.name}: ${f.error || `Expected ${f.expected.min}-${f.expected.max}%, Got ${f.actual.overall.toFixed(2)}%`}`);
    });
  }

  // AI Results
  const aiPassed = aiResults.filter(r => r.passed).length;
  const aiFailed = aiResults.filter(r => !r.passed).length;
  const aiPassRate = (aiPassed / aiResults.length * 100).toFixed(1);
  const avgResponseTime = aiResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / aiResults.length;
  const avgQualityScore = aiResults.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / aiResults.length;

  console.log('\n🤖 AI ANALYSIS TESTING:');
  console.log(`  Total:              ${aiResults.length}`);
  console.log(`  Passed:             ${aiPassed} ✅`);
  console.log(`  Failed:             ${aiFailed} ❌`);
  console.log(`  Pass Rate:          ${aiPassRate}%`);
  console.log(`  Avg Response Time:  ${avgResponseTime.toFixed(0)}ms`);
  console.log(`  Avg Quality Score:  ${avgQualityScore.toFixed(1)}/100`);

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================
  console.log('\n' + '█'.repeat(80));
  console.log('RECOMMENDATIONS & ACTION ITEMS');
  console.log('█'.repeat(80));

  const recommendations = [];

  // Algorithm recommendations
  if (algPassRate < 70) {
    recommendations.push({
      priority: 'CRITICAL',
      area: 'Algorithm',
      issue: `Pass rate ${algPassRate}% is below 70%`,
      actions: [
        'Increase weight of semantic similarity in overall calculation',
        'Fine-tune n-gram size (currently 3, try 4-5)',
        'Add TF-IDF weighting to improve relevance scoring',
        'Implement preprocessing: stemming and lemmatization'
      ]
    });
  }

  if (criticalFailures.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      area: 'Algorithm',
      issue: 'Duplicate detection failing',
      actions: [
        'Review identical text detection threshold (should be >95%)',
        'Check for text normalization issues',
        'Verify n-gram generation for exact matches'
      ]
    });
  }

  if (highPriorityFailures.some(f => f.name.includes('Paraphrase') || f.name.includes('Synonym'))) {
    recommendations.push({
      priority: 'HIGH',
      area: 'Algorithm',
      issue: 'Paraphrase detection needs improvement',
      actions: [
        'Increase semantic similarity weight',
        'Implement word embedding similarity (Word2Vec/GloVe)',
        'Add sentence-level semantic comparison',
        'Consider using transformer-based embeddings'
      ]
    });
  }

  // AI recommendations
  if (aiPassRate < 80) {
    recommendations.push({
      priority: 'HIGH',
      area: 'AI Analysis',
      issue: `Quality score ${avgQualityScore.toFixed(1)}/100 is below 80`,
      actions: [
        'Improve prompt engineering for more detailed analysis',
        'Add specific guidelines for similarity interpretation',
        'Include more context about existing research',
        'Request structured output format'
      ]
    });
  }

  if (avgResponseTime > 15000) {
    recommendations.push({
      priority: 'MEDIUM',
      area: 'AI Analysis',
      issue: `Average response time ${avgResponseTime.toFixed(0)}ms is slow`,
      actions: [
        'Reduce input context size',
        'Implement request batching',
        'Add caching for similar analyses',
        'Consider using faster model variant'
      ]
    });
  }

  // Display recommendations
  if (recommendations.length === 0) {
    console.log('\n✅ All tests passing! System is performing well.');
    console.log('\nSuggested enhancements:');
    console.log('  - Add more edge case tests');
    console.log('  - Test with multilingual content');
    console.log('  - Benchmark against other similarity tools');
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`\n${i + 1}. [${rec.priority}] ${rec.area}: ${rec.issue}`);
      console.log('   Actions:');
      rec.actions.forEach(action => {
        console.log(`   → ${action}`);
      });
    });
  }

  // ============================================================================
  // IMPROVEMENT SUGGESTIONS
  // ============================================================================
  console.log('\n' + '█'.repeat(80));
  console.log('SUGGESTED IMPROVEMENTS');
  console.log('█'.repeat(80));

  console.log('\n🔧 Algorithm Enhancements:');
  console.log('  1. Implement weighted similarity scoring:');
  console.log('     - Lexical: 40%, Semantic: 60% (currently seems equal)');
  console.log('  2. Add preprocessing pipeline:');
  console.log('     - Stop word removal');
  console.log('     - Stemming/Lemmatization');
  console.log('     - Special character handling');
  console.log('  3. Implement sliding window comparison for long texts');
  console.log('  4. Add fuzzy string matching for title comparison');
  console.log('  5. Consider BERT/Sentence-BERT for semantic similarity');

  console.log('\n🤖 AI Analysis Enhancements:');
  console.log('  1. Structured prompt with clear sections:');
  console.log('     - Similarity assessment');
  console.log('     - Key differences');
  console.log('     - Recommendations');
  console.log('  2. Add confidence scoring to AI outputs');
  console.log('  3. Implement multi-model voting (compare 2-3 models)');
  console.log('  4. Add specialized prompts for different similarity ranges');
  console.log('  5. Include citation-specific analysis');

  console.log('\n' + '█'.repeat(80));
  console.log(`Testing completed at ${new Date().toISOString()}`);
  console.log('█'.repeat(80) + '\n');

  return {
    algorithm: { passed: algPassed, failed: algFailed, passRate: parseFloat(algPassRate) },
    ai: { passed: aiPassed, failed: aiFailed, passRate: parseFloat(aiPassRate) },
    recommendations
  };
}

// ============================================================================
// EXECUTION
// ============================================================================
console.log('Starting comprehensive testing...');
console.log('Ensure server is running on http://localhost:3001\n');

runComprehensiveTests()
  .then(results => {
    const overallPass = results.algorithm.passRate >= 70 && results.ai.passRate >= 80;
    process.exit(overallPass ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
