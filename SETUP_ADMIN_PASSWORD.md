# Admin-only password management

This build uses a Vercel Serverless Function at `/api/admin-password`.

## 1. Vercel Environment Variables
Add these as **Secret** values for **Production**:

Photo project:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Video project:
- `SUPABASE_VIDEO_URL`
- `SUPABASE_VIDEO_ANON_KEY`
- `SUPABASE_VIDEO_SERVICE_ROLE_KEY`

Never put a service-role key in frontend JavaScript.

## 2. Important: redeploy from the correct root
The folder containing `index.html`, `api/`, `js/`, and `vercel.json` must be the Vercel project root.

Correct:
```
api/admin-password.js
index.html
js/gallery.js
vercel.json
```

Incorrect:
```
New-Room-main/api/admin-password.js
```
if `New-Room-main` is not the configured Vercel Root Directory.

After uploading/pushing this build, create a **new deployment**. Existing deployments do not automatically receive new files.

## 3. Test the function
Open:
`https://YOUR-DOMAIN.vercel.app/api/admin-password`

A response of `405 Method Not Allowed` is expected for a browser GET and proves the route exists. A `404` means the API file was not included in the deployed root or the deployment did not contain this build.

## 4. Supabase
No Edge Function is required by this build. The password operation is performed server-side by the Vercel function using the service-role key.
