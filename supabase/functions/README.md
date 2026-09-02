# Edge Function admin-password

Deploy this function after running `supabase/admin_password_security.sql`.

Using Supabase CLI:

```bash
supabase functions deploy admin-password
```

The function uses the logged-in user's JWT for authorization and the server-side
`SUPABASE_SERVICE_ROLE_KEY` to call `auth.admin.updateUserById`. Never put the
service-role key in browser JavaScript.
