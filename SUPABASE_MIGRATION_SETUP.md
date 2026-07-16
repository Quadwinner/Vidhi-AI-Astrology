# Supabase Migration Setup Guide

Complete guide to set up Supabase migrations in a new project.

---

## 📋 Prerequisites

1. **Node.js** (v18+)
2. **Supabase Account** (https://supabase.com)
3. **Supabase CLI** (install below)

---

## 🔧 Step 1: Install Supabase CLI

### Option A: Using npm (Recommended)

```bash
npm install -g supabase
```

### Option B: Using Homebrew (macOS/Linux)

```bash
brew install supabase/tap/supabase
```

### Option C: Using Scoop (Windows)

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Verify Installation

```bash
supabase --version
```

---

## 🚀 Step 2: Initialize Supabase in Your Project

### 2.1 Navigate to Your Project Root

```bash
cd /path/to/your/project
```

### 2.2 Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate. After login, you'll be authenticated.

### 2.3 Link to Your Supabase Project

```bash
supabase link --project-ref your-project-ref
```

**How to get project-ref:**
- Go to your Supabase Dashboard
- Select your project
- Go to **Settings** → **General**
- Copy the **Reference ID** (looks like: `abcdefghijklmnop`)

**OR** if you haven't created a project yet:

```bash
supabase projects create your-project-name
```

### 2.4 Initialize Supabase in Your Project

```bash
supabase init
```

This creates:
```
your-project/
├── supabase/
│   ├── config.toml          # Supabase configuration
│   ├── migrations/          # SQL migration files
│   └── functions/           # Edge Functions (optional)
```

---

## 📝 Step 3: Create Your First Migration

### 3.1 Create a New Migration File

```bash
supabase migration new create_users_table
```

This creates a file like:
```
supabase/migrations/20250131120000_create_users_table.sql
```

### 3.2 Write Your SQL Migration

Edit the migration file:

```sql
-- supabase/migrations/20250131120000_create_users_table.sql

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy (example: users can read their own data)
CREATE POLICY "Users can read own data"
ON public.users
FOR SELECT
USING (auth.uid() = id);
```

---

## 🚀 Step 4: Apply Migrations to Supabase

### 4.1 Push Migrations to Remote Database

```bash
supabase db push
```

This command:
- ✅ Reads all migration files in `supabase/migrations/`
- ✅ Applies them to your **remote Supabase database** (production)
- ✅ Only runs migrations that haven't been applied yet
- ✅ Shows you which migrations will be applied

### 4.2 Alternative: Apply Specific Migration

```bash
supabase migration up
```

---

## 🔄 Step 5: Common Migration Commands

### Create New Migration

```bash
supabase migration new migration_name
```

### List All Migrations

```bash
supabase migration list
```

### Check Migration Status

```bash
supabase db remote commit
```

### Reset Database (⚠️ DANGER: Deletes all data)

```bash
supabase db reset
```

### Pull Remote Schema (Get existing schema from Supabase)

```bash
supabase db pull
```

This creates a new migration file with your current remote schema.

---

## 📦 Step 6: Migration File Naming Convention

Supabase migrations use **timestamp-based naming**:

```
YYYYMMDDHHMMSS_migration_name.sql
```

**Example:**
```
20250131120000_create_users_table.sql
20250131120100_add_phone_to_users.sql
20250131120200_create_profiles_table.sql
```

**Why?** Timestamps ensure migrations run in chronological order.

---

## 🎯 Step 7: Complete Setup Example

### For a New Project:

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Create new project (or link existing)
supabase projects create my-new-project

# 4. Initialize in your codebase
cd /path/to/your/project
supabase init

# 5. Link to your project
supabase link --project-ref your-project-ref

# 6. Create first migration
supabase migration new initial_schema

# 7. Edit the migration file with your SQL
# Edit: supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql

# 8. Apply to remote database
supabase db push
```

---

## 🔐 Step 8: Environment Variables

### Get Your Project Credentials

```bash
supabase status
```

This shows:
- **API URL**: `https://your-project-ref.supabase.co`
- **anon key**: `eyJhbGc...`
- **service_role key**: `eyJhbGc...` (keep secret!)

### Add to Your `.env` File

```bash
# .env
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 📚 Step 9: Migration Best Practices

### ✅ DO:

1. **One logical change per migration**
   ```sql
   -- Good: Single purpose
   20250131120000_add_email_to_users.sql
   ```

2. **Use IF NOT EXISTS for safety**
   ```sql
   CREATE TABLE IF NOT EXISTS users (...);
   ```

3. **Add rollback comments**
   ```sql
   -- Rollback: DROP TABLE IF EXISTS users;
   ```

4. **Test migrations locally first**
   ```bash
   supabase start  # Start local Supabase
   supabase db reset  # Apply migrations locally
   ```

### ❌ DON'T:

1. **Don't edit applied migrations** (create new ones instead)
2. **Don't delete migration files** (they're history)
3. **Don't use DROP CASCADE** without careful consideration
4. **Don't commit sensitive data** in migrations

---

## 🛠️ Step 10: Advanced Commands

### Generate TypeScript Types from Database

```bash
supabase gen types typescript --project-id your-project-ref > src/types/supabase.ts
```

### Start Local Supabase (for development)

```bash
supabase start
```

This runs:
- PostgreSQL on `localhost:54322`
- Supabase Studio on `localhost:54323`
- API on `localhost:54321`

### Stop Local Supabase

```bash
supabase stop
```

### Apply Migrations to Local Database

```bash
supabase db reset  # Resets and applies all migrations
```

---

## 📋 Step 11: Migration Workflow Example

### Scenario: Add a new column to users table

```bash
# 1. Create migration
supabase migration new add_phone_to_users

# 2. Edit migration file
# File: supabase/migrations/20250131120300_add_phone_to_users.sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

CREATE INDEX IF NOT EXISTS idx_users_phone 
ON public.users(phone_number);

# 3. Test locally (optional)
supabase start
supabase db reset

# 4. Apply to remote
supabase db push

# 5. Verify
# Check Supabase Dashboard → Table Editor → users table
```

---

## 🔍 Step 12: Troubleshooting

### Migration Already Applied Error

```bash
# Check which migrations are applied
supabase migration list

# If migration shows as applied but shouldn't be, you may need to:
# 1. Mark it as not applied in Supabase dashboard
# 2. Or create a new migration to fix the issue
```

### Connection Error

```bash
# Re-link your project
supabase link --project-ref your-project-ref

# Or check your credentials
supabase status
```

### Migration Failed

```bash
# Check the error message
# Fix the SQL in the migration file
# Create a new migration to fix the issue (don't edit old ones)
supabase migration new fix_users_table
```

---

## 📖 Step 13: Useful Resources

- **Supabase CLI Docs**: https://supabase.com/docs/reference/cli
- **Migration Guide**: https://supabase.com/docs/guides/cli/local-development#database-migrations
- **SQL Editor**: Use Supabase Dashboard → SQL Editor for quick queries

---

## 🎯 Quick Reference Commands

```bash
# Setup
supabase login
supabase init
supabase link --project-ref <ref>

# Migrations
supabase migration new <name>
supabase db push
supabase migration list

# Local Development
supabase start
supabase stop
supabase db reset

# Status
supabase status
```

---

## ✅ Checklist for New Project

- [ ] Install Supabase CLI
- [ ] Login to Supabase
- [ ] Create/link Supabase project
- [ ] Run `supabase init`
- [ ] Create first migration
- [ ] Write SQL schema
- [ ] Run `supabase db push`
- [ ] Verify in Supabase Dashboard
- [ ] Add environment variables to `.env`
- [ ] Test connection from your app

---

**That's it!** You're now ready to manage your Supabase database with migrations. 🚀
