# Admin Panel Setup Guide

## Quick Start
1. Server is running at: http://localhost:3000
2. Admin panel URL: http://localhost:3000/admin

## Setting Up Admin Access

### Method 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to "Table Editor" → "users" table
3. Find your user account (by email)
4. Edit the row and set `is_admin` to `true`
5. Save the changes

### Method 2: Using SQL Editor
Run this SQL in your Supabase SQL editor:
```sql
UPDATE users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

### Method 3: Using the Console (if you have access)
```javascript
// In your browser console on the app
const { data: user } = await supabase.auth.getUser();
console.log('Current user ID:', user.user?.id);

// Then use this ID in the SQL update
```

## Admin Panel Features

### Dashboard Tab
- User statistics and analytics
- Export functionality for all data
- Real-time metrics

### Blog Management Tab
- Create, edit, delete blog posts
- Publish/unpublish functionality
- Rich text editing with featured images

### Price & Settings Tab
- Manage coin pricing across currencies
- System settings configuration
- Activate/deactivate price tiers

## Troubleshooting

### Can't Access Admin Panel?
1. Make sure you're logged in
2. Verify `is_admin = true` in your user record
3. Check browser console for any errors
4. Ensure your Supabase configuration is correct

### Edge Functions Not Working?
The admin panel uses edge functions for advanced operations. Make sure:
1. Your Supabase service role key is configured
2. The admin-operations function is deployed
3. Your user has proper permissions

## Database Schema Requirements

Your Supabase database should have these tables:
- `users` (with `is_admin` boolean column)
- `blogs` (for blog management)
- `prices` (for coin pricing)
- `settings` (for system configuration)

## Security Notes
- Admin panel is protected by authentication
- Only users with `is_admin = true` can access
- All admin operations use service-level permissions
- Edge functions provide secure server-side operations