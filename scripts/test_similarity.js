#!/usr/bin/env node

// Test script to check similarity calculation with actual database data
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSimilarity() {
  console.log('🔍 Testing Similarity Detection System\n');

  // 1. Get all researches from database
  console.log('1️⃣ Fetching researches from database...');
  const { data: researches, error } = await supabase
    .from('researches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${researches?.length || 0} researches in database\n`);

  if (!researches || researches.length === 0) {
    console.log('⚠️  No researches in database to test with');
    return;
  }

  // 2. Show what's in the database
  console.log('2️⃣ Database contents:');
  researches.forEach((r, i) => {
    console.log(`\n${i + 1}. Title: ${r.title}`);
    console.log(`   Course: ${r.course}`);
    console.log(`   Year: ${r.year}`);
    console.log(`   Abstract length: ${r.abstract?.length || 0} characters`);
    if (r.abstract) {
      console.log(`   Abstract preview: ${r.abstract.substring(0, 100)}...`);
    }
  });

  // 3. Test similarity between first two researches
  if (researches.length >= 2) {
    console.log('\n3️⃣ Testing similarity between first two researches:');
    console.log(`\nResearch 1: "${researches[0].title}"`);
    console.log(`Research 2: "${researches[1].title}"`);

    // Simple word overlap test
    const words1 = new Set(
      researches[0].title.toLowerCase().split(/\s+/)
        .concat(researches[0].abstract?.toLowerCase().split(/\s+/) || [])
    );
    const words2 = new Set(
      researches[1].title.toLowerCase().split(/\s+/)
        .concat(researches[1].abstract?.toLowerCase().split(/\s+/) || [])
    );

    const commonWords = [...words1].filter(w => words2.has(w) && w.length > 3);
    const totalWords = new Set([...words1, ...words2]).size;
    const overlap = commonWords.length / totalWords;

    console.log(`\nSimple word overlap: ${(overlap * 100).toFixed(1)}%`);
    console.log(`Common words (>3 chars): ${commonWords.length}`);
    console.log(`Sample common words:`, commonWords.slice(0, 10).join(', '));
  }

  // 4. Test API endpoint
  console.log('\n4️⃣ Testing similarity API endpoint...');
  if (researches.length >= 1) {
    const testResearch = researches[0];
    
    console.log(`\nUsing research: "${testResearch.title}"`);
    console.log('Making API call to /api/similarity/check...');

    try {
      const response = await fetch('http://localhost:3000/api/similarity/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedTitle: testResearch.title,
          proposedConcept: testResearch.abstract || testResearch.title,
        }),
      });

      if (!response.ok) {
        console.log(`❌ API returned status ${response.status}`);
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
        return;
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ API call successful`);
        console.log(`Total comparisons: ${result.totalComparisons}`);
        console.log(`Top matches found: ${result.similarities?.length || 0}`);
        
        if (result.similarities && result.similarities.length > 0) {
          console.log('\nTop 3 matches:');
          result.similarities.slice(0, 3).forEach((s, i) => {
            console.log(`\n${i + 1}. ${s.title}`);
            console.log(`   Overall: ${(s.overallSimilarity * 100).toFixed(1)}%`);
            console.log(`   Title: ${(s.titleSimilarity * 100).toFixed(1)}%`);
            console.log(`   Abstract: ${(s.abstractSimilarity * 100).toFixed(1)}%`);
          });
        } else {
          console.log('⚠️  No similar matches found above 20% threshold');
        }
        
        if (result.report) {
          console.log('\n📄 AI Report generated: Yes');
          console.log(`Report length: ${result.report.length} characters`);
        } else {
          console.log('\n⚠️  AI Report: Not generated');
        }
      } else {
        console.log('❌ API returned error:', result.error);
      }
    } catch (apiError) {
      console.log('❌ API call failed:', apiError.message);
      console.log('\nMake sure the development server is running (npm run dev)');
    }
  }

  console.log('\n✨ Test complete!\n');
}

testSimilarity().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
