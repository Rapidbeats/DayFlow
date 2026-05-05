# Cloudflare Pages Deployment Guide

This guide will help you deploy your DayFlow app to Cloudflare Pages (beginner-friendly).

## Prerequisites

✅ You've already completed:
- Supabase setup
- Updated credentials in `src/app/lib/supabase.ts`

What you need:
- A Cloudflare account (free tier works!)
- Node.js installed on your computer
- Your app files on your computer

---

## Step 1: Build Your App for Production

Before deploying, you need to create a production build of your app.

### 1.1 Open Terminal/Command Prompt

**Windows:**
- Press `Win + R`, type `cmd`, press Enter

**Mac:**
- Press `Cmd + Space`, type `terminal`, press Enter

**Linux:**
- Press `Ctrl + Alt + T`

### 1.2 Navigate to Your Project Folder

```bash
cd /path/to/your/dayflow-project
```

Replace `/path/to/your/dayflow-project` with the actual path. For example:
- Windows: `cd C:\Users\YourName\Desktop\dayflow`
- Mac/Linux: `cd ~/Desktop/dayflow`

### 1.3 Install Dependencies (if you haven't already)

```bash
pnpm install
```

If you don't have pnpm installed, install it first:
```bash
npm install -g pnpm
```

### 1.4 Build the App

```bash
pnpm run build
```

This creates a `dist` folder with your production-ready app. Wait for it to complete (usually takes 10-30 seconds).

You should see a message like:
```
✓ built in 15.32s
dist/index.html                  0.50 kB │ gzip:  0.32 kB
dist/assets/index-xxx.js       250.15 kB │ gzip: 85.23 kB
```

---

## Step 2: Prepare Files for Upload

After building, you'll have a `dist` folder containing:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── (other assets)
└── (other files)
```

**✅ THIS IS THE FOLDER YOU'LL UPLOAD TO CLOUDFLARE**

---

## Step 3: Deploy to Cloudflare Pages

### Method A: Using Cloudflare Dashboard (Easiest for Beginners)

#### 3.1 Create a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com)
2. Click "Sign up" (it's free!)
3. Enter your email and create a password
4. Verify your email

#### 3.2 Go to Cloudflare Pages

1. Log in to your Cloudflare dashboard
2. Click "Workers & Pages" in the left sidebar
3. Click "Create application"
4. Click "Pages" tab
5. Click "Upload assets"

#### 3.3 Upload Your Built App

1. **Project name:** Enter `dayflow` (or any name you like)
2. **Production branch:** Keep as "main"
3. Click "Create project"
4. **Drag and drop** the entire `dist` folder into the upload area
   - OR click "Select from computer" and select all files inside the `dist` folder
5. Click "Deploy site"

Wait 1-2 minutes for deployment to complete.

#### 3.4 Access Your Live App

Once deployed, you'll see a success message with a URL like:
```
https://dayflow-xxx.pages.dev
```

🎉 **Your app is now live!** Click the URL to open it.

---

### Method B: Using Wrangler CLI (Alternative Method)

If you're comfortable with command line, you can use Wrangler:

#### 3.1 Install Wrangler

```bash
npm install -g wrangler
```

#### 3.2 Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate.

#### 3.3 Deploy

```bash
wrangler pages deploy dist --project-name=dayflow
```

Follow the prompts. Your app will be deployed automatically.

---

## Step 4: Configure Cloudflare Settings (Important!)

After deployment, you need to configure some settings for the app to work properly.

### 4.1 Set Up Redirects for React Router

1. In Cloudflare dashboard, go to your "dayflow" project
2. Click "Settings" tab
3. Scroll down to "Build settings"
4. Find "Functions and redirects"
5. Create a `_redirects` file:

**Option 1: Add via Dashboard**
- Unfortunately, Cloudflare Pages doesn't allow editing redirects in the dashboard
- You'll need to add this file before deploying

**Option 2: Add to Your Project (Recommended)**

Create a file at the root of your project (not inside src):

```bash
echo "/*    /index.html   200" > public/_redirects
```

Or manually create `public/_redirects` file with this content:
```
/*    /index.html   200
```

Then rebuild and redeploy:
```bash
pnpm run build
# Upload the new dist folder to Cloudflare
```

This ensures all routes (like `/tasks`, `/schedule`) work correctly.

---

## Step 5: Test Your Deployed App

1. Open your Cloudflare Pages URL (e.g., `https://dayflow-xxx.pages.dev`)
2. You should see the sign-in page
3. Create an account
4. Complete onboarding
5. Create some tasks
6. Test on multiple devices - they should sync!

---

## What Files Were Uploaded?

When you upload the `dist` folder, you're uploading:

```
✅ index.html           - Main HTML file
✅ assets/              - All JavaScript, CSS, and images
   ├── index-xxx.js     - Your React app code
   ├── index-xxx.css    - All styles
   └── (other assets)
✅ _redirects           - Routing configuration (if added)
```

**DO NOT upload these folders:**
- ❌ `node_modules/` - Too large, not needed
- ❌ `src/` - Source code, not needed (already compiled)
- ❌ `.git/` - Version control, not needed
- ❌ Root files like `package.json`, `vite.config.ts`, etc.

---

## Troubleshooting

### "404 Not Found" on Routes

**Problem:** Clicking links like `/tasks` or `/settings` shows 404.

**Solution:** Add the `_redirects` file as explained in Step 4.1.

### "Failed to Load Tasks"

**Problem:** Tasks don't load or sync doesn't work.

**Solution:**
1. Check browser console (F12) for errors
2. Verify Supabase credentials in `src/app/lib/supabase.ts`
3. Ensure Supabase SQL migration was run correctly
4. Check Network tab - are API calls failing?

### Blank Page After Deployment

**Problem:** Website loads but shows nothing.

**Solution:**
1. Check browser console (F12) for errors
2. Make sure you uploaded the `dist` folder contents, not the dist folder itself
3. Try clearing browser cache (Ctrl+Shift+Del)
4. Rebuild with `pnpm run build` and redeploy

### Build Failed

**Problem:** `pnpm run build` shows errors.

**Solution:**
1. Make sure all files are saved
2. Check for TypeScript errors
3. Run `pnpm install` again
4. Share the error message for specific help

---

## Custom Domain (Optional)

Want to use your own domain like `dayflow.com`?

1. In Cloudflare Pages dashboard, go to your project
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter your domain (you need to own it)
5. Follow the DNS configuration instructions
6. Wait 5-10 minutes for DNS to propagate

---

## Updating Your App

When you make changes to your app:

1. Make your changes in the code
2. Run `pnpm run build` again
3. Go to Cloudflare Pages dashboard
4. Click "Create new deployment"
5. Upload the new `dist` folder
6. Wait for deployment to complete

Or use Wrangler:
```bash
pnpm run build
wrangler pages deploy dist
```

---

## Environment Variables (If Needed in Future)

If you ever need to use environment variables (instead of hardcoded credentials):

1. Go to Cloudflare Pages dashboard
2. Click your project
3. Go to "Settings" → "Environment variables"
4. Add variables like:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_KEY`: Your Supabase key
5. In your code, use: `import.meta.env.VITE_SUPABASE_URL`

---

## Quick Reference

### Files/Folders to Upload to Cloudflare:
```
✅ dist/           (the entire contents after build)
```

### Files to NEVER Upload:
```
❌ node_modules/
❌ src/
❌ .git/
❌ package.json (and other config files)
```

### Commands Cheat Sheet:
```bash
pnpm install        # Install dependencies
pnpm run build      # Build for production
wrangler login      # Login to Cloudflare
wrangler pages deploy dist  # Deploy to Cloudflare
```

---

## Need Help?

- **Cloudflare Docs:** https://developers.cloudflare.com/pages/
- **Cloudflare Community:** https://community.cloudflare.com/
- **Video Tutorial:** Search YouTube for "Deploy React app to Cloudflare Pages"

---

## Success Checklist

- [ ] Built app with `pnpm run build`
- [ ] Created Cloudflare account
- [ ] Uploaded `dist` folder contents to Cloudflare Pages
- [ ] Added `_redirects` file for routing
- [ ] Tested sign-up/sign-in on live site
- [ ] Tasks sync across devices
- [ ] All pages (Dashboard, Schedule, Tasks, Settings) work
- [ ] Themes can be changed
- [ ] Mobile responsive design works

🎉 **Congratulations! Your DayFlow app is now live on Cloudflare!**
