# Beginner's Troubleshooting Guide

Common issues and their solutions (written for beginners).

---

## Issue 1: "pnpm: command not found"

**What it means:** You don't have pnpm installed.

**Solution:**

### Option A: Install pnpm
```bash
npm install -g pnpm
```

Then try again:
```bash
pnpm install
```

### Option B: Use npm instead
If you have npm, you can use it:
```bash
npm install
npm run build
```

---

## Issue 2: "npm: command not found"

**What it means:** You don't have Node.js installed.

**Solution:**

1. Go to https://nodejs.org/
2. Download the LTS version (recommended)
3. Install it (just click Next → Next → Install)
4. Restart your terminal/command prompt
5. Try again

**How to verify it worked:**
```bash
node --version
npm --version
```

You should see version numbers like:
```
v20.11.0
10.2.4
```

---

## Issue 3: "No such file or directory"

**What it means:** You're in the wrong folder.

**Solution:**

### Find where your project is:

**Windows:**
```bash
cd C:\Users\YourName\Desktop\dayflow
```

**Mac/Linux:**
```bash
cd ~/Desktop/dayflow
```

Replace `dayflow` with your actual project folder name.

**How to verify you're in the right place:**
```bash
ls
```

You should see files like:
- `package.json`
- `src/`
- `node_modules/` (after running pnpm install)

---

## Issue 4: Build fails with errors

**Common error messages and solutions:**

### "Cannot find module..."
```bash
# Solution: Install dependencies
pnpm install
```

### "TypeScript error"
```bash
# Solution: Check the file mentioned in the error
# Usually means there's a typo or missing import
```

### "Out of memory"
```bash
# Solution: Close other applications
# Or increase Node memory:
NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
```

---

## Issue 5: "dist folder is empty" or "dist doesn't exist"

**What it means:** Build didn't complete successfully.

**Solution:**

1. Check if there were error messages during build
2. Try building again:
   ```bash
   pnpm run build
   ```
3. Look for error messages (red text)
4. If you see errors, share them for help

**How to verify it worked:**
```bash
ls dist/
```

You should see:
```
index.html
assets/
_redirects
```

---

## Issue 6: "404 Not Found" on deployed site

**What it means:** React Router isn't configured correctly.

**Solution:**

1. Make sure `_redirects` file exists in your `dist` folder:
   ```bash
   cat dist/_redirects
   ```

2. Should show:
   ```
   /*    /index.html   200
   ```

3. If not, rebuild:
   ```bash
   pnpm run build
   ```

4. Re-upload to Cloudflare

---

## Issue 7: Can't log in to Cloudflare

**Symptoms:**
- Password doesn't work
- Email not verified
- Can't find the dashboard

**Solutions:**

### Forgot password:
1. Go to https://dash.cloudflare.com
2. Click "Forgot password?"
3. Follow email instructions

### Email not verified:
1. Check your inbox (and spam folder!)
2. Click the verification link
3. Try logging in again

### Can't find Workers & Pages:
1. After logging in, you should see a sidebar
2. Click "Workers & Pages"
3. If you don't see it, your account might need activation
4. Wait a few minutes and refresh

---

## Issue 8: Upload to Cloudflare fails

**Common reasons:**

### Files too large:
- Make sure you're only uploading `dist/` contents
- Not the entire project
- `node_modules/` is NOT needed

### Wrong file format:
- Upload as-is, don't zip the files
- Just drag the files from `dist/` folder

### Browser issues:
- Try a different browser (Chrome usually works best)
- Clear cache (Ctrl+Shift+Del)
- Disable browser extensions temporarily

---

## Issue 9: "Authentication failed" on deployed app

**What it means:** Supabase credentials might be wrong.

**Solution:**

1. Double-check your Supabase credentials:
   - Open `src/app/lib/supabase.ts`
   - Verify the URL and Key match your Supabase dashboard

2. Rebuild and redeploy:
   ```bash
   pnpm run build
   # Then upload new dist/ folder to Cloudflare
   ```

3. Check browser console (F12) for detailed errors

---

## Issue 10: Tasks don't sync between devices

**What it means:** Database or authentication issue.

**Solution:**

### Check 1: Are you logged in?
- Sign out and sign in again
- Use the same email on both devices

### Check 2: Is Supabase working?
1. Go to your Supabase dashboard
2. Click "Table Editor"
3. Check if tasks table exists
4. If not, run the SQL from `supabase_setup.sql` again

### Check 3: Network issues?
- Open browser console (F12)
- Go to "Network" tab
- Look for red/failed requests
- Share screenshots if you see errors

---

## Issue 11: Blank page after deployment

**Symptoms:**
- Website loads but shows nothing
- Just white/black screen

**Solutions:**

### Solution 1: Check browser console
1. Press F12 (opens Developer Tools)
2. Look at "Console" tab
3. Look for red error messages
4. Common issues:
   - "Failed to fetch" → Supabase credentials wrong
   - "Cannot read property" → Build issue, rebuild

### Solution 2: Clear cache
1. Press Ctrl+Shift+Del (or Cmd+Shift+Del on Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh page (Ctrl+R or Cmd+R)

### Solution 3: Verify upload
1. Go to Cloudflare dashboard
2. Your project → "Deployments"
3. Click the latest deployment
4. Check if all files are there:
   - index.html
   - assets/
   - _redirects

---

## Issue 12: Can't find the dist folder

**Where to look:**

### Windows:
```
C:\Users\YourName\path\to\project\dist
```

### Mac:
```
/Users/YourName/path/to/project/dist
```

### Linux:
```
/home/yourname/path/to/project/dist
```

**How to get there in terminal:**

```bash
# First, go to your project
cd /path/to/project

# Then check if dist exists
ls -la dist/

# If it doesn't exist, build it
pnpm run build
```

---

## Issue 13: "Permission denied"

**On Windows:**
- Run terminal as Administrator:
  - Right-click Command Prompt
  - Click "Run as administrator"

**On Mac/Linux:**
```bash
sudo pnpm install
# Enter your password when prompted
```

---

## Still Stuck?

### Before asking for help, collect this info:

1. **What command did you run?**
   ```
   Example: pnpm run build
   ```

2. **What error message did you see?**
   ```
   Copy the entire error (red text)
   ```

3. **What's your operating system?**
   ```
   Windows 10, Mac OS, Linux, etc.
   ```

4. **Screenshot of the error:**
   - Press `Print Screen` key
   - Paste into a document
   - Share the image

5. **What you've already tried:**
   ```
   List the solutions you attempted
   ```

---

## Quick Diagnostic Commands

Run these to get helpful information:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check if in correct directory
pwd
ls

# Check if dist folder exists
ls dist/

# Check what's in dist
ls -la dist/

# Try building with verbose output
pnpm run build --verbose
```

---

## Emergency: Start Fresh

If everything is broken, start over:

```bash
# 1. Delete node_modules and dist
rm -rf node_modules dist

# 2. Reinstall
pnpm install

# 3. Rebuild
pnpm run build

# 4. Redeploy
```

---

**Remember:** Most issues are simple fixes! Don't give up. 💪

For more help:
- Read `CLOUDFLARE_DEPLOYMENT.md`
- Check `QUICK_START.md`
- Google the exact error message
- Ask in Cloudflare Community forum
