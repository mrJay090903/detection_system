// Check what happens when logging in with different faculty accounts
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogin() {
  console.log('🔍 Checking Faculty Login Data...\n');

  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    console.log('✅ Currently logged in as:', session.user.email);
    console.log('   User ID:', session.user.id);
    
    // Check if faculty record exists
    const { data: faculty, error: facultyError } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (facultyError) {
      console.log('❌ No faculty record found for this user!');
      console.log('   Error:', facultyError.message);
      console.log('\n   This is why the dashboard shows no data!');
    } else {
      console.log('✅ Faculty record found:');
      console.log('   Name:', faculty.first_name, faculty.last_name);
      console.log('   Department:', faculty.department);
      console.log('   Email:', faculty.email);
      
      // Check researches
      const { data: researches, error: researchError } = await supabase
        .from('researches')
        .select('*')
        .eq('faculty_id', faculty.id);
      
      if (researchError) {
        console.log('\n❌ Error loading researches:', researchError.message);
      } else {
        console.log(`\n✅ Found ${researches?.length || 0} researches for this faculty`);
      }
    }
  } else {
    console.log('⚠️  No active session - user is not logged in');
    console.log('\nChecking all faculty records in database:');
    
    const { data: allFaculty, error } = await supabase
      .from('faculty')
      .select('id, email, first_name, last_name, department')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`\nFound ${allFaculty?.length || 0} faculty members in database:`);
      allFaculty?.forEach((f, i) => {
        console.log(`${i + 1}. ${f.email} - ${f.first_name} ${f.last_name} (${f.department})`);
      });
    }
  }

  console.log('\n✨ Check complete!\n');
}

checkLogin().catch(err => {
  console.error('❌ Error:', err);
});
