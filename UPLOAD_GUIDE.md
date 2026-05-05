# What to Upload to Cloudflare - Visual Guide

## 📦 Your Project Structure

```
dayflow/
├── 📁 node_modules/          ❌ DON'T UPLOAD (too large)
├── 📁 src/                    ❌ DON'T UPLOAD (source code)
├── 📁 public/                 ❌ DON'T UPLOAD (gets compiled into dist)
├── 📁 dist/                   ✅ UPLOAD THIS ENTIRE FOLDER!
│   ├── 📄 index.html
│   ├── 📁 assets/
│   │   ├── index-abc123.js
│   │   ├── index-xyz789.css
│   │   └── ...
│   └── 📄 _redirects
├── 📄 package.json            ❌ DON'T UPLOAD
├── 📄 vite.config.ts          ❌ DON'T UPLOAD
├── 📄 tsconfig.json           ❌ DON'T UPLOAD
└── 📄 README.md               ❌ DON'T UPLOAD
```

---

## 🎯 Step-by-Step: What Happens

### Before Build:
```
Your Project
    │
    ├── src/ (React code)
    ├── public/ (static files)
    └── node_modules/ (dependencies)
```

### After `pnpm run build`:
```
Your Project
    │
    ├── dist/ ← NEW FOLDER CREATED!
    │   ├── index.html
    │   └── assets/
    │       ├── compiled.js
    │       └── compiled.css
    │
    └── (everything else stays the same)
```

### What You Upload to Cloudflare:
```
Cloudflare Pages
    │
    └── 📁 Upload ONLY the contents of dist/
        ├── index.html
        └── assets/
            ├── compiled.js
            └── compiled.css
```

---

## 📊 File Sizes (Approximate)

| Folder/File | Size | Upload? |
|-------------|------|---------|
| `node_modules/` | ~500 MB | ❌ NO |
| `src/` | ~1 MB | ❌ NO |
| `dist/` | ~1-2 MB | ✅ YES |
| `package.json` | ~2 KB | ❌ NO |
| Config files | ~50 KB | ❌ NO |

**Total upload size: ~1-2 MB** (very small!)

---

## 🖼️ Cloudflare Upload Interface

When you drag and drop, you should see something like this:

```
┌─────────────────────────────────────┐
│  Drag your files here               │
│                                      │
│  📄 index.html               0.5 KB │
│  📁 assets/                          │
│     📄 index-abc123.js     250 KB   │
│     📄 index-xyz789.css     15 KB   │
│  📄 _redirects              0.1 KB  │
│                                      │
│  [Deploy site]                      │
└─────────────────────────────────────┘
```

---

## ✅ Checklist Before Upload

- [ ] Ran `pnpm run build` successfully
- [ ] See a `dist/` folder in your project
- [ ] Inside `dist/`, you see:
  - [ ] `index.html` file
  - [ ] `assets/` folder
  - [ ] `_redirects` file
- [ ] File sizes look reasonable (1-2 MB total)
- [ ] NOT uploading `node_modules/` or `src/`

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Uploading the Wrong Folder
```
DON'T DO THIS:
├── Upload "src/" ← WRONG!
└── Upload entire project ← WRONG!

DO THIS:
└── Upload "dist/" folder contents ← CORRECT!
```

### ❌ Mistake 2: Uploading the dist Folder Itself
```
WRONG:
Upload → dist/ (as a folder)

CORRECT:
Upload → contents of dist/ (all files inside)
```

### ❌ Mistake 3: Forgetting to Build
```
If you don't see a dist/ folder:
1. Run: pnpm run build
2. Wait for it to complete
3. Now you should have dist/
```

---

## 🎯 Two Ways to Upload

### Method 1: Drag & Drop (Easiest)

1. Open your project folder
2. Open the `dist` folder
3. Select ALL files inside `dist`
4. Drag them to Cloudflare Pages upload box

### Method 2: Select from Computer

1. Click "Select from computer" in Cloudflare
2. Navigate to your project → `dist` folder
3. Select ALL files
4. Click "Open"

---

## 📝 Summary

**ONLY upload these:**
```
✅ dist/index.html
✅ dist/assets/ (entire folder)
✅ dist/_redirects
✅ Any other files in dist/
```

**NEVER upload these:**
```
❌ node_modules/
❌ src/
❌ public/
❌ package.json
❌ vite.config.ts
❌ Any .ts or .tsx files
❌ Any configuration files
```

---

## 🧪 Test Before Deploy

Before uploading, verify your build:

```bash
# 1. Build
pnpm run build

# 2. Check dist folder exists
ls dist/

# 3. Should see:
index.html
assets/
_redirects
```

If you see these files, you're ready to upload!

---

## 📞 Need Help?

If you're stuck:

1. **Check the dist folder exists:**
   ```bash
   ls dist/
   ```

2. **Verify files are there:**
   ```bash
   ls -la dist/
   ```

3. **Rebuild if needed:**
   ```bash
   pnpm run build
   ```

4. **Share the error message** if build fails

---

**Remember: You ONLY upload the `dist/` folder contents, nothing else!** 🎯
