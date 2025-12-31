# Deploying the All-in-One SchoolCBT

You have upgraded to the **Serverless Architecture**. This means you don't need a separate server anymore.

## 1. Setup GitHub Token
1.  Go to [GitHub Settings > Tokens](https://github.com/settings/tokens).
2.  Generate a new token (Classic) with `repo` scope.
3.  Copy it.

## 2. Deploy to Netlify
1.  Log in to [Netlify](https://app.netlify.com/).
2.  Click **"Add new site"** -> **"Import from existing project"**.
3.  Connect **GitHub** and select your `school-cbt` repo.
4.  **Crucial Settings**:
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `admin/dist`
    *   **Functions Directory**: `netlify/functions` (Netlify usually detects this)
5.  **Environment Variables** (Click "Advanced"):
    *   `GITHUB_TOKEN`: (Paste your token here)
    *   `VITE_API_URL`: `/.netlify/functions/api` (Exactly this!)
6.  Click **Deploy**.

## 3. Accessing the App
*   **Admin Panel**: `https://your-site.netlify.app/`
*   **Student Portal**: `https://your-site.netlify.app/student/`

## 4. Local Development
To run everything on your laptop:
1.  Create a `.env` file in the root folder.
2.  Add `GITHUB_TOKEN=your_token_here`.
3.  Run `npm start`.
4.  Open `http://localhost:8888`.
