#!/bin/bash

# Migration Script: Rename abstract to thesis_brief
# Date: 2026-01-07
# Description: Applies the database migration to rename the abstract column to thesis_brief

echo "================================================"
echo "Database Migration: abstract → thesis_brief"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found."
    echo "📝 Please apply the migration manually in Supabase Studio:"
    echo "   1. Go to your Supabase Dashboard"
    echo "   2. Navigate to SQL Editor"
    echo "   3. Run the migration file: supabase/migrations/20260107_rename_abstract_to_thesis_brief.sql"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory"
    echo "📝 Please run this script from your project root"
    echo ""
    exit 1
fi

echo "📂 Found Supabase configuration"
echo ""

# Confirm before proceeding
echo "⚠️  This will rename the 'abstract' column to 'thesis_brief' in your database."
echo "⚠️  Make sure you have a backup before proceeding!"
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🚀 Applying migration..."
echo ""

# Apply migration
supabase migration up

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. ✅ Deploy your application with the updated code"
    echo "2. ✅ Test creating a new research entry"
    echo "3. ✅ Test editing an existing research entry"
    echo "4. ✅ Test similarity checking functionality"
    echo ""
    echo "📄 See MIGRATION_ABSTRACT_TO_THESIS_BRIEF.md for details"
else
    echo ""
    echo "❌ Migration failed!"
    echo "📝 Please check the error message above and try again"
    echo "📝 You can also apply the migration manually in Supabase Studio"
    echo ""
    exit 1
fi

echo "================================================"
echo "Migration Complete!"
echo "================================================"
