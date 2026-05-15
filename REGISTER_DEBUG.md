# Register Debug Guide

## Common Issues & Solutions

### 1. **Email Confirmation Required** (Most Common)
If users see no error and just get redirected, but can't log in afterward, **email confirmation is likely enabled**.

**Check in Supabase Dashboard:**
- Go to Authentication > Providers > Email
- Look for "Confirm email" setting
- If enabled, users need to click the confirmation link in their email

**For Development:** Ask your friend to disable email confirmation in Supabase or set up SMTP.

### 2. **Missing Environment Variables**
Ensure these are set in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. **Check Browser Console**
Open DevTools (F12) → Console tab to see any JavaScript errors during signup.

### 4. **Check Network Tab**
- In DevTools → Network tab
- Try registering and look for the request to Supabase
- Check if it returns HTTP 200 or an error code
- This shows what Supabase actually responded with

### 5. **Test with Console Logs**
The updated action now logs errors to the server console. Check your Next.js terminal output when attempting registration.

## Quick Test
1. Try registering with a test email
2. Check server terminal for error logs
3. Check browser console (F12)
4. Ask your friend to check Supabase Auth dashboard for the user
5. Share the exact error message you see

## Next Steps
Once you identify the issue, let me know:
- What error message appears (if any)
- Whether the user shows up in Supabase Auth
- What the server logs show
