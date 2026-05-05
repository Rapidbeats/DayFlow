# Supabase Setup Guide for DayFlow

This guide will help you set up Supabase for the DayFlow application.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account
2. Click "New Project"
3. Enter a project name (e.g., "DayFlow")
4. Set a strong database password (save this!)
5. Choose a region closest to your users
6. Click "Create new project"

Wait a few minutes for your project to be provisioned.

## Step 2: Run the Database Migration

1. In your Supabase dashboard, click on "SQL Editor" in the left sidebar
2. Click "New Query"
3. Copy the entire contents of `supabase_setup.sql` from this project
4. Paste it into the SQL editor
5. Click "Run" (or press Ctrl/Cmd + Enter)

This will create:
- The `tasks` table with all necessary columns
- Indexes for faster queries
- Row Level Security (RLS) policies to protect user data
- Triggers for automatic timestamp updates

## Step 3: Get Your Supabase Credentials

1. In your Supabase dashboard, click on "Settings" (gear icon) in the left sidebar
2. Click on "API" under Project Settings
3. You'll see two important values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (a long JWT token)

## Step 4: Update the Application

Open `src/app/lib/supabase.ts` and replace these lines:

```typescript
const SUPABASE_URL = 'https://vapfpvnuitfejocpnnzl.supabase.co';
const SUPABASE_KEY = 'eyJhbGc...'; // long token
```

With your own credentials:

```typescript
const SUPABASE_URL = 'your-project-url-here';
const SUPABASE_KEY = 'your-anon-key-here';
```

## Step 5: Enable Email Authentication

1. In Supabase dashboard, go to "Authentication" → "Providers"
2. Make sure "Email" is enabled (it should be by default)
3. You can configure email templates under "Authentication" → "Email Templates"

## Step 6: Test the Application

1. Start your app with `pnpm dev`
2. Navigate to the app in your browser
3. Create a new account using the sign-up page
4. Complete the onboarding flow
5. Create some tasks
6. Sign out and sign in again - your tasks should persist!

## Verify Database Setup

To verify everything is working:

1. In Supabase, go to "Table Editor"
2. You should see the `tasks` table
3. After creating tasks in the app, they should appear here
4. The `user_id` column should match your authenticated user's ID

## Troubleshooting

### "Failed to load tasks from cloud"
- Check that your Supabase URL and Key are correct
- Verify the SQL migration ran successfully (check Table Editor for `tasks` table)
- Check the browser console for detailed error messages

### "Authentication failed"
- Make sure Email auth is enabled in Supabase
- Check that you're using a valid email format
- Password must be at least 6 characters

### Tasks not syncing
- Check the browser Network tab for failed API calls
- Verify Row Level Security policies were created (run the SQL migration again if needed)
- Make sure you're signed in (check `user` state in DevTools)

## Security Notes

⚠️ **Important**: The current setup includes hardcoded Supabase credentials in the source code. This is acceptable for:
- Personal projects
- Internal tools
- Proof of concepts

For production applications with sensitive data:
- Use environment variables (`.env` files)
- Never commit credentials to public repositories
- Consider additional authentication methods (OAuth, magic links, etc.)
- Set up rate limiting and abuse prevention

## Next Steps

Once everything is working:

1. Customize email templates in Supabase
2. Set up additional RLS policies if needed
3. Configure password policies under Authentication settings
4. Set up monitoring and alerts
5. Consider adding a password reset flow

Happy planning with DayFlow! 🎉
