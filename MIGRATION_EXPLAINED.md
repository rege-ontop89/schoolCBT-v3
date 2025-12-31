# Migration Explained: From Local Server to Serverless Cloud

You asked for a system that works "from anywhere" without managing a complex server. We are shifting to a **Serverless Architecture**.

## 1. The Old Architecture (Harder to Scale)
*   **Computer A (Server)**: Runs `npm start`. Must be "ON" 24/7 for others to connect.
*   **Computer B (Admin)**: Connects to A.
*   **Problem**: If Computer A is off, nothing works. Hosting Computer A on the cloud (Render) costs money or sleeps on free tiers.

## 2. The New Architecture (Serverless "Git-CMS")
*   **Netlify**: Hosts BOTH the Website (Admin) AND the Backend (Functions).
*   **GitHub**: Acts as the "Database".
*   **No "Always On" Server**: The backend only "wakes up" for 100ms when you save an exam, then goes back to sleep.

## 3. How it Works
1.  **Admin** calls `/api/exams`.
2.  **Netlify Function** catches this.
3.  **Function** uses a "Key" (Token) to talk to GitHub.
    *   "Hey GitHub, give me the exams list."
    *   "Hey GitHub, save this new question."
4.  **GitHub** accepts the secure change.
5.  **Netlify** detects the change and updates the student site.

## 4. Your New Workflow
*   **Local**: Run `npm start`. It simulates the Cloud on your laptop.
*   **Deploy**: Just push to GitHub.
*   **Cost**: $0 (Free tiers for Netlify/GitHub are huge).
