# DayFlow - Setup Checklist

Use this checklist to ensure everything is set up correctly.

## ✅ Pre-Setup

- [ ] Node.js 16+ installed
- [ ] pnpm installed
- [ ] Supabase account created
- [ ] New Supabase project created

## ✅ Database Setup

- [ ] Opened Supabase SQL Editor
- [ ] Ran `supabase_setup.sql` script
- [ ] Verified `tasks` table appears in Table Editor
- [ ] Confirmed RLS policies are enabled

## ✅ Credentials Configuration

- [ ] Copied Supabase Project URL from Settings → API
- [ ] Copied anon/public key from Settings → API
- [ ] Updated `src/app/lib/supabase.ts` with your credentials
- [ ] Saved the file

## ✅ Application Setup

- [ ] Ran `pnpm install` (dependencies installed)
- [ ] Vite dev server is running
- [ ] App opens in browser without errors
- [ ] No console errors visible

## ✅ Authentication Testing

- [ ] Can access sign-up page (`/auth`)
- [ ] Can create a new account with email/password
- [ ] Receive email confirmation (if enabled)
- [ ] Can sign in with created account
- [ ] Redirected to onboarding after first sign-in

## ✅ Onboarding Testing

- [ ] Onboarding appears for new users
- [ ] Step 1: Can enter name
- [ ] Step 2: Can set weekday/weekend sleep times
- [ ] Step 3: Can set morning/evening routine durations
- [ ] Step 4: Can set work hours
- [ ] Successfully completes and goes to Dashboard

## ✅ Dashboard Testing

- [ ] Dashboard shows personalized greeting
- [ ] Shows correct date
- [ ] Progress ring displays correctly
- [ ] Can see today's tasks section

## ✅ Task Management

- [ ] FAB (+ button) is visible
- [ ] Clicking FAB opens task modal
- [ ] Can create a new task with:
  - [ ] Name
  - [ ] Date
  - [ ] Time
  - [ ] Category
  - [ ] Duration
  - [ ] Notes
- [ ] Task appears in Tasks page
- [ ] Task appears in Schedule if for today
- [ ] Can mark task as done
- [ ] Can delete task

## ✅ Navigation

- [ ] Can navigate to Dashboard
- [ ] Can navigate to Schedule
- [ ] Can navigate to Tasks
- [ ] Can navigate to Settings
- [ ] Active tab is highlighted in nav
- [ ] Header displays correctly on all pages

## ✅ Schedule Page

- [ ] Week strip shows dates correctly
- [ ] Can select different dates
- [ ] Today is highlighted
- [ ] Tasks for selected date appear
- [ ] Tasks show correct time and duration

## ✅ Tasks Page

- [ ] All tasks are listed
- [ ] Can filter by category
- [ ] Tasks show correct info
- [ ] Can toggle task completion
- [ ] Can delete tasks
- [ ] Deletion confirmation appears

## ✅ Settings Page

- [ ] Current theme is highlighted
- [ ] Can switch between all 8 themes:
  - [ ] Emerald
  - [ ] Amber
  - [ ] Sunset
  - [ ] Rose
  - [ ] Violet
  - [ ] Cyan
  - [ ] Blossom
  - [ ] Gold
- [ ] Theme changes are instant
- [ ] Shows user email
- [ ] Shows user name
- [ ] Can reset onboarding
- [ ] Can sign out

## ✅ Cloud Sync Testing

- [ ] Created tasks appear in Supabase Table Editor
- [ ] Sign out and sign in - tasks persist
- [ ] Open app on second device/browser
- [ ] Tasks sync to second device
- [ ] Edit task on device 1
- [ ] Changes appear on device 2 (may need refresh)
- [ ] Delete task on device 1
- [ ] Task disappears on device 2 (may need refresh)

## ✅ Offline Support

- [ ] Tasks are stored in localStorage
- [ ] App works without internet (after initial load)
- [ ] Tasks created offline appear when back online
- [ ] No errors when offline

## ✅ Responsive Design

- [ ] Looks good on desktop (1920px+)
- [ ] Looks good on tablet (768px)
- [ ] Looks good on mobile (375px)
- [ ] Header date hides on mobile
- [ ] Navigation is usable on all sizes

## 🐛 Common Issues

### "Authentication failed"
- Check Supabase credentials are correct
- Verify email auth is enabled in Supabase
- Password must be 6+ characters

### "Failed to load tasks"
- Check Supabase URL and key
- Verify SQL migration ran successfully
- Check browser console for errors

### Tasks not syncing
- Verify user is signed in
- Check network tab for failed requests
- Verify RLS policies exist

### Onboarding shows every time
- Check localStorage for `df_profile`
- Verify `setupDone: true` is saved

## ✅ Production Ready

- [ ] All tests above passed
- [ ] No console errors
- [ ] Sync works reliably
- [ ] Themes all work
- [ ] Performance is good
- [ ] Ready to use! 🎉

---

If all items are checked, your DayFlow app is ready to use!

For issues, check:
1. Browser console (F12)
2. Network tab for failed requests
3. Supabase logs in dashboard
4. `SUPABASE_SETUP.md` for setup help
