# DayFlow — Daily Planner

A modern daily planning and task management application built with React, Tailwind CSS, and Supabase.

## Features

- ✅ **Task Management** - Create, edit, delete, and organize tasks by category
- 📅 **Schedule View** - Visual timeline for daily planning with week navigation
- 🎨 **8 Beautiful Themes** - Emerald, Amber, Sunset, Rose, Violet, Cyan, Blossom, and Gold
- 🔄 **Cross-Device Sync** - Automatic cloud synchronization via Supabase
- 👤 **User Authentication** - Secure sign up/sign in with email and password
- 🌅 **Personalized Onboarding** - 4-step setup for sleep schedule, routines, and work hours
- 📊 **Progress Tracking** - Daily task completion statistics
- 💾 **Local Storage** - Works offline with automatic sync when online

## Getting Started

### Prerequisites

- Node.js 16+ and pnpm
- A Supabase account and project

### Setup Instructions

1. **Set up Supabase Database**

   Run the SQL script in `supabase_setup.sql` in your Supabase SQL Editor to create the necessary tables and policies.

2. **Update Supabase Credentials**

   Open `src/app/lib/supabase.ts` and replace the hardcoded credentials with your own:
   ```typescript
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_KEY = 'your-anon-key';
   ```

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Run the App**
   The Vite dev server should already be running. If not, start it with:
   ```bash
   pnpm dev
   ```

## Sync Improvements

The app now includes enhanced cross-device synchronization:

- **Conflict Resolution** - Automatically merges tasks from multiple devices using timestamps
- **Bidirectional Sync** - Local changes are uploaded to cloud and cloud changes are downloaded
- **Delete Sync** - Task deletions are properly synchronized across devices
- **Smart Merging** - Keeps the most recent version of each task when conflicts occur

## Onboarding Flow

New users are guided through a dedicated 4-step onboarding:

1. **Name** - Personalize your experience
2. **Sleep Schedule** - Set weekday and weekend sleep times
3. **Routines** - Configure morning and evening routine durations
4. **Work Hours** - Define your typical work schedule

The onboarding is shown only once per user and is separate from the main app interface.

## Architecture

- **React Router** - Multi-page navigation with protected routes
- **AuthContext** - Centralized authentication and sync state management
- **Tailwind CSS v4** - Custom theme variables with dark mode aesthetics
- **Supabase** - Backend authentication and real-time database
- **Local Storage** - Offline-first with cloud backup

## Project Structure

```
src/
├── app/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (Auth)
│   ├── lib/            # Utilities (themes, storage, supabase)
│   ├── pages/          # Route pages
│   ├── routes.ts       # Router configuration
│   └── App.tsx         # Main app component
├── styles/
│   ├── fonts.css       # Google Fonts imports
│   └── theme.css       # Tailwind theme and custom variables
└── imports/
    └── index.html      # Original HTML reference
```

## Themes

All 8 original themes are preserved:
- 🟢 Emerald (default)
- 🟡 Amber
- 🟠 Sunset
- 🌹 Rose
- 🟣 Violet
- 🔵 Cyan
- 🩷 Blossom
- 🟡 Gold

## Notes

- The blackhole transition effect has been removed for simplicity and better performance
- Onboarding is now a separate dedicated page
- Cross-device sync issues have been resolved with improved conflict resolution
- All theme colors match exactly with the original HTML version
