# Cloud Admin Deployment Guide

To allow teachers to access the Admin Panel from anywhere, you need to host the **Server** (Brain) online.

## Prerequisites
1.  **GitHub Account**: You already have this.
2.  **Render Account**: Go to [render.com](https://render.com) and sign up (Free tier works).
3.  **GitHub Token**:
    *   GitHub -> Settings -> Developer Settings -> Personal access tokens -> Tokens (classic).
    *   Generate new token -> Select `repo` scope -> Copy it.

---

## Part 1: Deploy the Server (The "Brain")
1.  **Dashboard**: On Render, Click **"New +"** -> **"Web Service"**.
2.  **Connect**: Select your `school-cbt` repo from GitHub.
3.  **Settings**:
    *   **Name**: `school-cbt-server`
    *   **Root Directory**: `server` (Important!)
    *   **Runtime**: Node
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
4.  **Environment Variables** (Advanced section):
    *   `PORT`: `3001`
    *   `GITHUB_TOKEN`: (Paste the token you copied)
    *   `REPO_URL`: (Your GitHub repo URL, e.g., `https://github.com/user/school-cbt.git`)
5.  Click **Create Web Service**.
    *   *Result*: Render will give you a URL like `https://school-cbt-server.onrender.com`. Copy this!

---

## Part 2: Deploy the Admin UI (The "Face")
Now we deploy the Admin Panel to Netlify, but point it to your new Cloud Server.

1.  **Netlify**: Go to your Site Settings.
2.  **Build & Deploy** -> **Environment variables**:
    *   Key: `VITE_API_URL`
    *   Value: `https://school-cbt-server.onrender.com/api` (The Render URL + `/api`)
3.  **Build Settings**:
    *   **Base directory**: `admin`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `dist`
4.  **Redeploy**: Trigger a deploy (or push a small change to GitHub).

---

## Final Result
*   **Admin URL**: `https://your-site.netlify.app/admin` (or wherever Netlify put it).
*   **Access**: Teachers can login from home.
*   **Magic**: When they "Publish", the Render Server receives it, writes to its disk, and **Pushes back to GitHub** using the Token.
