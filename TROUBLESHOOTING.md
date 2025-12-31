# Cloud Deployment Troubleshooting

You are facing three common issues. Here is how to fix them efficiently.

## 1. "Student Page Not Found" (404)
**Cause**: When you configured Netlify to build the Admin Panel (`admin/dist`), it stopped serving the root folder (`/student`). Netlify can only serve one "Site" configuration at a time.

**Solution**: You need **Two Sites** on Netlify connected to the *same* GitHub repository.
1.  **Site A (Existing - Rename to "Student Portal")**:
    *   **Publish Directory**: `.` (Root)
    *   **Build Command**: `(empty)`
    *   *This will bring back the Student Exam page.*

2.  **Site B (Create New - Name "Admin Panel")**:
    *   Click "Add new site" -> Import from Git -> Select `school-cbt` repo again.
    *   **Base Directory**: `admin`
    *   **Publish Directory**: `dist`
    *   **Build Command**: `npm run build`
    *   **Env Variable**: `VITE_API_URL` = `https://school-cbt-server.onrender.com/api`

## 2. "Unexpected token <... not valid JSON"
**Cause**: The Admin Panel is trying to talk to the Server, but it's hitting a "Page Not Found" (HTML) page instead. This happens if `VITE_API_URL` is wrong.

**Fix**:
1.  Go to your **Admin Panel Site** settings on Netlify.
2.  Check **Environment Variables**.
3.  Ensure `VITE_API_URL` is exactly `https://school-cbt-server.onrender.com/api` (using your *actual* Render URL).
    *   **Common Mistake**: Putting the Netlify URL here. It MUST be the Render URL.
    *   **Common Mistake**: Forgetting `/api` at the end.

## 3. Demo Credentials
**Status**: I have removed the text "Demo: username..." from the code. It will disappear next time you deploy (push to GitHub).
