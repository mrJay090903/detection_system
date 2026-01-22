#!/usr/bin/env node

/**
 * Direct Algorithm Unit Tests
 * Tests similarity algorithms with specific text pairs
 */

const http = require('http');

const CONFIG = {
  baseUrl: 'http://localhost:3001',
  testDelay: 1000,
};

// Direct comparison test cases
const directTests = [
  {
    name: 'Test 1: Identical Titles & Concepts',
    title: 'Machine Learning Applications in Healthcare',
    concept: 'This research explores various applications of machine learning in modern healthcare. We focus on deep learning, neural networks, and classification algorithms for medical diagnosis.',
    expectedMin: 85,
    expectedMax: 100,
    priority: 'CRITICAL'
  },
  {
    name: 'Test 2: Paraphrased Content',
    title: 'Climate Change Impact Studies',
    concept: 'Global warming is a serious threat to humanity. Rising temperatures are causing sea levels to rise, extreme weather events to become more frequent, and ecosystems to collapse.',
    expectedMin: 3,
    expectedMax: 15,
    priority: 'HIGH'
  },
  {
    name: 'Test 3: IoT Smart Home System',
    title: 'Smart Home Automation Using IoT',
    concept: 'Development of a smart home automation system using IoT sensors and mobile application. The system controls lighting, temperature, security cameras, and appliances remotely. Implementation uses Arduino, ESP8266, and Firebase cloud database for real-time monitoring and control.',
    expectedMin: 3,
    expectedMax: 15,
    priority: 'HIGH'
  },
  {
    name: 'Test 4: Blockchain Research',
    title: 'Blockchain Technology in Supply Chain',
    concept: 'This research explores the application of blockchain technology to improve transparency and traceability in supply chain management. The proposed system uses smart contracts and distributed ledger technology to automate verification processes.',
    expectedMin: 3,
    expectedMax: 15,
    priority: 'MEDIUM'
  },
  {
    name: 'Test 5: Mobile Learning App',
    title: 'Mobile Learning Application Development',
    concept: 'This research develops a mobile learning application for mathematics education. The app features interactive lessons, gamification elements, progress tracking, and personalized learning paths. Target users are high school students aged 15-18.',
    expectedMin: 3,
    expectedMax: 15,
    priority: 'MEDIUM'
  }
];

// AI Quality tests
const aiQualityTests = [
  {
    name: 'High Similarity - Blockchain',
    userTitle: 'Blockchain-Based Supply Chain Management System',
    userConcept: 'This study implements a blockchain solution for supply chain tracking. The system leverages smart contracts to automate verification processes and uses distributed ledgers to ensure transparency across all stakeholders. The proposed architecture includes nodes for suppliers, manufacturers, distributors, and retailers.',
    existingTitle: 'Blockchain Technology in Supply Chain Logistics',
    existingThesisBrief: 'This research explores blockchain implementation for supply chain transparency. Using smart contract technology and distributed ledger systems, the platform enables automated verification and real-time tracking. The architecture supports multiple stakeholder types including suppliers, manufacturers, and retailers.',
    similarities: { lexical: 0.70, semantic: 0.75, overall: 0.72 },
    expectedQuality: 'HIGH'
  },
  {
    name: 'Moderate Similarity - Sentiment Analysis',
    userTitle: 'Social Media Sentiment Analysis Tool',
    userConcept: 'Development of a sentiment analysis system for analyzing public opinion on social media platforms. The tool uses natural language processing and machine learning techniques to classify posts as positive, negative, or neutral.',
    existingTitle: 'Twitter Opinion Mining System',
    existingThesisBrief: 'This project creates a system for extracting opinions from Twitter data. The methodology employs text mining algorithms and sentiment classification models to categorize tweets by emotional tone.',
    similarities: { lexical: 0.40, semantic: 0.45, overall: 0.42 },
    expectedQuality: 'MODERATE'
  },
  {
    name: 'Low Similarity - Different Domains',
    userTitle: 'Solar Panel Efficiency Optimization',
    userConcept: 'This research optimizes solar panel efficiency using predictive maintenance algorithms and machine learning models to forecast panel degradation.',
    existingTitle: 'Traffic Light Control System',
    existingThesisBrief: 'Development of an intelligent traffic light management system using computer vision and real-time vehicle detection algorithms.',
    similarities: { lexical: 0.05, semantic: 0.08, overall: 0.06 },
    expectedQuality: 'LOW'
  }
];

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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

async function testSimilarityEndpoint(testCase, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${index}/${total}] ${testCase.name} [${testCase.priority}]`);
  console.log(`${'='.repeat(80)}`);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/similarity/check',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const postData = {
    proposedTitle: testCase.title,
    proposedConcept: testCase.concept
  };

  try {
    const start = Date.now();
    const response = await makeRequest(options, postData);
    const duration = Date.now() - start;
    
    if (response.statusCode !== 200) {
      console.log(`❌ FAILED: HTTP ${response.statusCode}`);
      return {
        name: testCase.name,
        passed: false,
        error: `HTTP ${response.statusCode}`,
        priority: testCase.priority
      };
    }

    // Get the top similarity from results
    const topSimilarity = response.data.similarities?.[0];
    if (!topSimilarity) {
      console.log(`✅ PASSED: No similar research found (0% similarity)`);
      return {
        name: testCase.name,
        passed: testCase.expectedMin === 0,
        priority: testCase.priority,
        actual: { overall: 0, responseTime: duration }
      };
    }

    const overall = (topSimilarity.overallSimilarity * 100).toFixed(2);
    const passed = parseFloat(overall) >= testCase.expectedMin && parseFloat(overall) <= testCase.expectedMax;

    console.log(`Expected: ${testCase.expectedMin}% - ${testCase.expectedMax}%`);
    console.log(`Results:`);
    console.log(`  Overall: ${overall}% ${passed ? '✅' : '❌'}`);
    console.log(`  Against: ${topSimilarity.title.substring(0, 60)}...`);
    console.log(`  Response Time: ${duration}ms`);

    return {
      name: testCase.name,
      passed,
      priority: testCase.priority,
      expected: { min: testCase.expectedMin, max: testCase.expectedMax },
      actual: { overall: parseFloat(overall), responseTime: duration },
      matchedWith: topSimilarity.title.substring(0, 60)
    };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return {
      name: testCase.name,
      passed: false,
      error: error.message,
      priority: testCase.priority
    };
  }
}

async function testAIQuality(testCase, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${index}/${total}] AI: ${testCase.name}`);
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
      console.log(`❌ FAILED: HTTP ${response.statusCode}`);
      return { name: testCase.name, passed: false, error: `HTTP ${response.statusCode}` };
    }

    const analysis = response.data.analysis;
    const length = analysis?.length || 0;
    const hasRecommendations = length > 500;
    const mentionsSimilarity = analysis?.toLowerCase().includes('similar') || false;
    const mentionsComparison = analysis?.toLowerCase().includes('research') || false;

    const qualityScore = (
      (hasRecommendations ? 35 : 0) +
      (mentionsSimilarity ? 30 : 0) +
      (mentionsComparison ? 25 : 0) +
      (duration < 10000 ? 10 : duration < 20000 ? 5 : 0)
    );

    const passed = qualityScore >= 70;

    console.log(`Quality: ${qualityScore}/100 ${passed ? '✅' : '❌'}`);
    console.log(`  Analysis Length: ${length} chars`);
    console.log(`  Has Recommendations: ${hasRecommendations ? '✅' : '❌'}`);
    console.log(`  Mentions Similarity: ${mentionsSimilarity ? '✅' : '❌'}`);
    console.log(`  Response Time: ${duration}ms`);

    return {
      name: testCase.name,
      passed,
      qualityScore,
      responseTime: duration,
      analysisLength: length
    };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { name: testCase.name, passed: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n' + '█'.repeat(80));
  console.log('ALGORITHM & AI QUALITY TESTING SUITE');
  console.log('█'.repeat(80));
  console.log(`Test Server: ${CONFIG.baseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('█'.repeat(80));

  // Phase 1: Algorithm Tests
  console.log('\n\n' + '▓'.repeat(80));
  console.log('PHASE 1: ALGORITHM TESTING (Against Database)');
  console.log('▓'.repeat(80));

  const algorithmResults = [];
  for (let i = 0; i < directTests.length; i++) {
    const result = await testSimilarityEndpoint(directTests[i], i + 1, directTests.length);
    algorithmResults.push(result);
    if (i < directTests.length - 1) await delay(CONFIG.testDelay);
  }

  // Phase 2: AI Quality Tests
  console.log('\n\n' + '▓'.repeat(80));
  console.log('PHASE 2: AI ANALYSIS QUALITY TESTING');
  console.log('▓'.repeat(80));

  const aiResults = [];
  for (let i = 0; i < aiQualityTests.length; i++) {
    const result = await testAIQuality(aiQualityTests[i], i + 1, aiQualityTests.length);
    aiResults.push(result);
    if (i < aiQualityTests.length - 1) await delay(CONFIG.testDelay);
  }

  // Results Summary
  console.log('\n\n' + '█'.repeat(80));
  console.log('TEST RESULTS SUMMARY');
  console.log('█'.repeat(80));

  const algPassed = algorithmResults.filter(r => r.passed).length;
  const algFailed = algorithmResults.filter(r => !r.passed).length;
  const algPassRate = (algPassed / algorithmResults.length * 100).toFixed(1);

  console.log('\n📊 ALGORITHM TESTING:');
  console.log(`  Total:     ${algorithmResults.length}`);
  console.log(`  Passed:    ${algPassed} ✅`);
  console.log(`  Failed:    ${algFailed} ❌`);
  console.log(`  Pass Rate: ${algPassRate}%`);

  const avgResponseTime = algorithmResults
    .filter(r => r.actual?.responseTime)
    .reduce((sum, r) => sum + r.actual.responseTime, 0) / algorithmResults.length;
  console.log(`  Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);

  const criticalFailures = algorithmResults.filter(r => !r.passed && r.priority === 'CRITICAL');
  if (criticalFailures.length > 0) {
    console.log(`\n  🚨 CRITICAL FAILURES: ${criticalFailures.length}`);
    criticalFailures.forEach(f => console.log(`    - ${f.name}`));
  }

  const aiPassed = aiResults.filter(r => r.passed).length;
  const aiFailed = aiResults.filter(r => !r.passed).length;
  const aiPassRate = (aiPassed / aiResults.length * 100).toFixed(1);
  const avgAITime = aiResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / aiResults.length;
  const avgQuality = aiResults.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / aiResults.length;

  console.log('\n🤖 AI ANALYSIS TESTING:');
  console.log(`  Total:              ${aiResults.length}`);
  console.log(`  Passed:             ${aiPassed} ✅`);
  console.log(`  Failed:             ${aiFailed} ❌`);
  console.log(`  Pass Rate:          ${aiPassRate}%`);
  console.log(`  Avg Response Time:  ${avgAITime.toFixed(0)}ms`);
  console.log(`  Avg Quality Score:  ${avgQuality.toFixed(1)}/100`);

  // Performance Grades
  console.log('\n' + '█'.repeat(80));
  console.log('PERFORMANCE GRADES');
  console.log('█'.repeat(80));

  const getGrade = (score) => {
    if (score >= 90) return 'A+ (Excellent)';
    if (score >= 80) return 'A  (Very Good)';
    if (score >= 70) return 'B  (Good)';
    if (score >= 60) return 'C  (Acceptable)';
    return 'F  (Needs Improvement)';
  };

  console.log(`\nAlgorithm Accuracy: ${getGrade(parseFloat(algPassRate))}`);
  console.log(`AI Quality:         ${getGrade(parseFloat(aiPassRate))}`);
  console.log(`Response Speed:     ${avgResponseTime < 1000 ? 'A+ (Excellent)' : avgResponseTime < 2000 ? 'A  (Very Good)' : 'B  (Good)'}`);
  console.log(`AI Speed:           ${avgAITime < 10000 ? 'A+ (Excellent)' : avgAITime < 20000 ? 'A  (Very Good)' : 'B  (Good)'}`);

  const overallScore = (parseFloat(algPassRate) + parseFloat(aiPassRate)) / 2;
  console.log(`\n Overall System Grade: ${getGrade(overallScore)}`);

  console.log('\n' + '█'.repeat(80));
  console.log('Testing completed!');
  console.log('█'.repeat(80) + '\n');

  return {
    algorithm: { passed: algPassed, failed: algFailed, passRate: parseFloat(algPassRate) },
    ai: { passed: aiPassed, failed: aiFailed, passRate: parseFloat(aiPassRate) },
    overallScore
  };
}

console.log('Starting tests...\n');
runTests()
  .then(results => {
    process.exit(results.overallScore >= 70 ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
