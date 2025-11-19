// Check if the trigger exists and test faculty creation
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrigger() {
  console.log('🔍 Checking Database Trigger Setup...\n');

  // Create a test user to see if trigger fires
  const testEmail = `trigger_test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log('1️⃣ Creating test auth user...');
  console.log(`   Email: ${testEmail}`);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        first_name: 'Trigger',
        last_name: 'Test',
        department: 'COMPUTER STUDIES DEPARTMENT'
      }
    }
  });

  if (authError) {
    console.log('❌ Auth error:', authError.message);
    return;
  }

  console.log('✅ Auth user created successfully');
  console.log(`   User ID: ${authData.user?.id}`);

  // Wait for trigger to execute
  console.log('\n2️⃣ Waiting 2 seconds for trigger to execute...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if faculty record was created
  console.log('\n3️⃣ Checking if faculty record was created...');
  const { data: facultyData, error: facultyError } = await supabase
    .from('faculty')
    .select('*')
    .eq('id', authData.user?.id);

  if (facultyError) {
    console.log('❌ Error checking faculty:', facultyError.message);
  } else if (!facultyData || facultyData.length === 0) {
    console.log('❌ NO FACULTY RECORD FOUND!');
    console.log('   This means the trigger did NOT execute or failed silently');
    console.log('\n   Trying manual insert to test RLS policy...');
    
    // Try manual insert
    const { data: manualData, error: manualError } = await supabase
      .from('faculty')
      .insert({
        id: authData.user?.id,
        email: testEmail,
        first_name: 'Trigger',
        last_name: 'Test',
        department: 'COMPUTER STUDIES DEPARTMENT'
      })
      .select();

    if (manualError) {
      console.log('   ❌ Manual insert FAILED:', manualError.message);
      console.log('   Error code:', manualError.code);
      console.log('   Full error:', manualError);
    } else {
      console.log('   ✅ Manual insert SUCCEEDED!');
      console.log('   This means RLS allows INSERT but trigger is not working');
    }
  } else {
    console.log('✅ Faculty record found!');
    console.log('   Data:', facultyData[0]);
  }

  // List all faculty to see current state
  console.log('\n4️⃣ All faculty records:');
  const { data: allFaculty } = await supabase
    .from('faculty')
    .select('id, email, first_name, last_name, department');
  
  if (allFaculty && allFaculty.length > 0) {
    allFaculty.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.first_name} ${f.last_name} (${f.email}) - ${f.department}`);
    });
  } else {
    console.log('   No faculty records found');
  }

  console.log('\n✨ Check complete!\n');
}

checkTrigger().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
