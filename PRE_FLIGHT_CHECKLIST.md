# Pre-Flight Checklist ✈️

Complete this checklist BEFORE deploying to catch issues early!

---

## ✅ 1. Supabase Verification

### Check Your Credentials

Open `src/app/lib/supabase.ts` and verify:

- [ ] `SUPABASE_URL` is set (looks like `https://xxxxx.supabase.co`)
- [ ] `SUPABASE_KEY` is set (long JWT token)
- [ ] Both values are from YOUR Supabase project (not the example ones)

### Test Your Database

1. Go to Supabase dashboard
2. Click "Table Editor"
3. Verify you see:
   - [ ] `tasks` table exists
   - [ ] Columns: id, user_id, name, date, time, cat, dur, notes, done, created, etc.

---

## ✅ 2. Local Environment Setup

### Node.js Check

Run in terminal:
```bash
node --version
```

- [ ] Version is 16.x or higher (e.g., v20.11.0)

### Install Dependencies

```bash
pnpm install
```

- [ ] Completes without errors
- [ ] Creates `node_modules/` folder
- [ ] Shows "Done in Xs"

---

## ✅ 3. Local Testing (Recommended)

### Run Development Server

```bash
pnpm dev
```

- [ ] Server starts without errors
- [ ] Shows URL like `http://localhost:5173/`
- [ ] No red error messages in terminal

### Test Features

Open the localhost URL and test:

#### Authentication
- [ ] Can access sign-up page
- [ ] Can create account (use test email)
- [ ] Redirected to onboarding after signup
- [ ] No errors in browser console (F12)

#### Onboarding
- [ ] Step 1: Name input works
- [ ] Step 2: Sleep schedule works
- [ ] Step 3: Routines work
- [ ] Step 4: Work hours work
- [ ] Can complete all steps
- [ ] Redirected to Dashboard after completion

#### Dashboard
- [ ] Shows personalized greeting
- [ ] Shows correct date
- [ ] Progress ring appears
- [ ] No console errors

#### Task Management
- [ ] FAB (+ button) appears
- [ ] Can create a new task
- [ ] Task appears in list
- [ ] Can mark task as done
- [ ] Can navigate between pages

#### Navigation
- [ ] Can go to Dashboard
- [ ] Can go to Schedule
- [ ] Can go to Tasks
- [ ] Can go to Settings
- [ ] Active tab highlights correctly

#### Settings
- [ ] Can change theme
- [ ] Theme changes instantly
- [ ] Can sign out

### Stop Server
Press `Ctrl + C` to stop when testing is done.

---

## ✅ 4. Production Build Check

### Run Build

```bash
pnpm run build
```

Expected output:
- [ ] Completes without errors
- [ ] Shows "✓ built in Xs"
- [ ] Lists generated files
- [ ] No red error messages

### Verify Build Output

```bash
ls dist/
```

Should see:
- [ ] `index.html` file
- [ ] `assets/` folder
- [ ] `_redirects` file

Check file sizes:
```bash
du -sh dist/
```

- [ ] Total size is ~1-3 MB (reasonable)
- [ ] NOT 500+ MB (that would mean node_modules got included - ERROR!)

### Verify _redirects

```bash
cat dist/_redirects
```

Should show:
- [ ] `/*    /index.html   200`

---

## ✅ 5. Pre-Upload Verification

### Files Ready

- [ ] `dist/` folder exists
- [ ] Contains `index.html`
- [ ] Contains `assets/` folder with JS and CSS files
- [ ] Contains `_redirects` file
- [ ] Total size is small (1-3 MB)

### NOT Including

- [ ] NOT uploading `node_modules/`
- [ ] NOT uploading `src/`
- [ ] NOT uploading config files
- [ ] Only uploading `dist/` contents

---

## ✅ 6. Cloudflare Account Ready

### Account Created
- [ ] Have Cloudflare account
- [ ] Email verified
- [ ] Can log in to dashboard

### Know Where to Go
- [ ] Can find "Workers & Pages" in sidebar
- [ ] Know how to click "Create application"
- [ ] Know how to click "Pages" → "Upload assets"

---

## ✅ 7. Final Checklist

Before uploading:

### Documentation
- [ ] Read `START_HERE.md`
- [ ] Read `QUICK_START.md`
- [ ] Have `UPLOAD_GUIDE.md` open for reference
- [ ] Bookmarked `TROUBLESHOOTING.md` just in case

### Ready to Deploy
- [ ] Built app successfully
- [ ] `dist/` folder ready
- [ ] Cloudflare account ready
- [ ] Supabase configured and tested
- [ ] Feeling confident! 💪

---

## 🚨 Red Flags (Stop if you see these!)

### ❌ Build Errors
If build fails:
1. Read the error message
2. Check `TROUBLESHOOTING.md`
3. Fix the issue before deploying
4. DON'T deploy a broken build!

### ❌ Missing Files
If dist/ doesn't have these files:
- `index.html`
- `assets/` folder
- `_redirects`

**Solution:** Something's wrong with build. Check `TROUBLESHOOTING.md` → Issue 5.

### ❌ Huge File Sizes
If `dist/` is 50+ MB:
- Something's wrong
- Probably including wrong files
- DON'T upload - it will fail!

**Solution:** Delete `dist/`, run `pnpm run build` again.

### ❌ Console Errors During Local Test
If you see red errors in browser console (F12):
- Investigate before deploying
- Common issues:
  - Supabase credentials wrong
  - Missing dependencies
  - Code errors

**Solution:** Fix errors locally first, then deploy.

---

## 🎯 You're Ready When...

- ✅ All checkboxes above are checked
- ✅ Local test successful
- ✅ Build completed successfully
- ✅ dist/ folder looks correct
- ✅ No red flags
- ✅ Feeling prepared

---

## 🚀 Next Steps

If all checks pass:

1. **Go to QUICK_START.md** → Step 5 onwards
2. **Deploy to Cloudflare**
3. **Test your live site**
4. **Share with friends!**

---

## 📊 Quick Diagnostic

Run these to verify everything:

```bash
# Where am I?
pwd

# Do I have the right files?
ls -la

# Is Node.js installed?
node --version

# Are dependencies installed?
ls node_modules | wc -l

# Did build work?
ls dist/

# What's in dist?
ls -la dist/

# Is _redirects there?
cat dist/_redirects
```

All these should work without errors.

---

## 💡 Pro Tips

1. **Test locally first** - Save time by catching issues before deployment
2. **Keep credentials safe** - Don't share your Supabase keys publicly
3. **Bookmark TROUBLESHOOTING.md** - You might need it!
4. **Take your time** - Better to go slow and get it right
5. **Ask for help** - If stuck, provide error messages and what you tried

---

## ✈️ Clear for Takeoff?

If you've completed this checklist:

**🟢 GREEN LIGHT - You're ready to deploy!**

Proceed to **QUICK_START.md** Step 5 and deploy!

---

If anything failed:

**🟡 YELLOW LIGHT - Fix issues first**

Check **TROUBLESHOOTING.md** for solutions.

---

**Good luck! You've got this! 🚀**
