# Quick Start Guide - Deploy DayFlow in 10 Minutes

Follow these steps in order. Don't skip any!

## ✅ Step 1: Check Supabase (DONE ✓)

You've already completed this! Your credentials are in `src/app/lib/supabase.ts`.

---

## ✅ Step 2: Install Dependencies

Open Terminal/Command Prompt and navigate to your project folder:

```bash
cd /path/to/dayflow-project
```

Then install dependencies:

```bash
pnpm install
```

**Expected output:** "Packages: +XX" and "Done in Xs"

---

## ✅ Step 3: Test Locally (Optional but Recommended)

Make sure everything works before deploying:

```bash
pnpm dev
```

**Expected output:** "Local: http://localhost:5173/"

Open that URL in your browser and:
- [ ] Sign up works
- [ ] Onboarding appears
- [ ] Can create tasks
- [ ] Dashboard shows tasks

Press `Ctrl + C` to stop the server when done.

---

## ✅ Step 4: Build for Production

This creates the files you'll upload to Cloudflare:

```bash
pnpm run build
```

**Expected output:**
```
✓ built in 15.32s
dist/index.html                  0.50 kB
dist/assets/index-xxx.js       250.15 kB
```

✅ **You now have a `dist` folder!** This is what you'll upload.

---

## ✅ Step 5: Create Cloudflare Account

1. Go to: https://cloudflare.com
2. Click "Sign up" (free!)
3. Enter email and password
4. Verify your email

---

## ✅ Step 6: Deploy to Cloudflare Pages

1. Login to Cloudflare dashboard
2. Click **"Workers & Pages"** (left sidebar)
3. Click **"Create application"**
4. Click **"Pages"** tab
5. Click **"Upload assets"**
6. Enter project name: `dayflow`
7. **Drag the entire `dist` folder** into the upload box
8. Click **"Deploy site"**
9. Wait 1-2 minutes

✅ **Done!** You'll get a URL like: `https://dayflow-xxx.pages.dev`

---

## ✅ Step 7: Test Your Live App

1. Open your Cloudflare URL
2. Sign up with a new account
3. Complete onboarding
4. Create a task
5. Check on your phone - it should sync!

---

## 🎉 You're Done!

Your DayFlow app is now live on the internet!

### What You Uploaded:
- ✅ `dist/` folder contents (built files)

### What You Did NOT Upload:
- ❌ `node_modules/` - too large
- ❌ `src/` - source code (already compiled in dist)
- ❌ Config files like `package.json`

---

## Common Issues

### ❌ "404 Not Found" on pages
**Fix:** The `_redirects` file is already in your project. Make sure you rebuilt after I created it:
```bash
pnpm run build
```
Then re-upload the new `dist` folder.

### ❌ "Failed to load tasks"
**Fix:** Check browser console (press F12). Verify your Supabase credentials are correct.

### ❌ Build errors
**Fix:** Share the error message for specific help.

---

## Quick Commands Reference

```bash
# Install dependencies (first time only)
pnpm install

# Test locally
pnpm dev

# Build for production
pnpm run build

# Deploy with Wrangler (optional method)
npm install -g wrangler
wrangler login
wrangler pages deploy dist --project-name=dayflow
```

---

## Need More Help?

- Read the full guide: `CLOUDFLARE_DEPLOYMENT.md`
- Check setup checklist: `SETUP_CHECKLIST.md`
- Supabase issues: `SUPABASE_SETUP.md`

---

## Update Your App Later

When you make changes:

1. Edit your code
2. Run `pnpm run build`
3. Go to Cloudflare → Your project → "Create new deployment"
4. Upload the new `dist` folder
5. Done!

---

**🚀 Happy planning with DayFlow!**
