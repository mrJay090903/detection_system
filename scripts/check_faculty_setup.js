// Diagnostic script to check faculty table setup and RLS policies
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSetup() {
  console.log('🔍 Checking Faculty Table Setup...\n');

  // 1. Check if faculty table exists and is accessible
  console.log('1️⃣ Testing faculty table access:');
  const { data: facultyData, error: facultyError } = await supabase
    .from('faculty')
    .select('*')
    .limit(1);
  
  if (facultyError) {
    console.log('❌ Error accessing faculty table:', facultyError.message);
  } else {
    console.log('✅ Faculty table accessible');
    console.log(`   Found ${facultyData?.length || 0} records`);
  }

  // 2. List all faculty members
  console.log('\n2️⃣ Current faculty members:');
  const { data: allFaculty, error: listError } = await supabase
    .from('faculty')
    .select('id, email, first_name, last_name, department, created_at')
    .order('created_at', { ascending: false });
  
  if (listError) {
    console.log('❌ Error listing faculty:', listError.message);
  } else {
    if (allFaculty && allFaculty.length > 0) {
      console.log(`✅ Found ${allFaculty.length} faculty members:`);
      allFaculty.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.first_name} ${f.last_name} (${f.email})`);
        console.log(`      Department: ${f.department}`);
        console.log(`      Created: ${new Date(f.created_at).toLocaleString()}`);
      });
    } else {
      console.log('⚠️  No faculty members found in database');
    }
  }

  // 3. Try to insert a test record (will fail if RLS blocks it)
  console.log('\n3️⃣ Testing INSERT permission:');
  const testId = '00000000-0000-0000-0000-000000000001';
  const testEmail = `test_${Date.now()}@example.com`;
  
  const { data: insertData, error: insertError } = await supabase
    .from('faculty')
    .insert({
      id: testId,
      email: testEmail,
      first_name: 'Test',
      last_name: 'User',
      department: 'COMPUTER STUDIES DEPARTMENT'
    })
    .select();
  
  if (insertError) {
    console.log('❌ INSERT blocked by RLS or constraint:', insertError.message);
    console.log('   Error details:', insertError);
  } else {
    console.log('✅ INSERT permission works!');
    // Clean up test record
    await supabase.from('faculty').delete().eq('id', testId);
  }

  // 4. Check auth users
  console.log('\n4️⃣ Checking auth.users table:');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.log('❌ Cannot access auth users (this is normal with anon key)');
  } else if (authData) {
    console.log(`✅ Found ${authData.users?.length || 0} auth users`);
  }

  console.log('\n✨ Diagnostic check complete!\n');
}

checkSetup().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
