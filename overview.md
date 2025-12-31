# Critical Codebase Overview

The SchoolCBT system is a **lightweight, file-based assessment platform** leveraging a "Server + Client + Cloud" hybrid architecture. It avoids complex databases (SQL/Mongo) in favor of JSON files and Google Sheets.

## 1. System Architecture
*   **Backend (`/server`)**: A Node.js/Express server acting as the "Brain".
    *   **Storage**: Uses local JSON files (`exams/`, `users.json`, `questions.json`) instead of a database.
    *   **Role**: Serves APIs, manages authentication, and proxies requests to Google Sheets for analytics.
*   **Admin Dashboard (`/admin`)**: A React (Vite) application for Teachers/Admins.
    *   **Role**: Exam creation, question bank management, and system configuration.
*   **Student Portal (`/student`)**: A lightweight, standalone HTML/JS client.
    *   **Role**: Consumes JSON exams and submits answers. It is designed to work even with intermittent internet (has offline queuing).
*   **Data Layer (Results)**: **Google Sheets**.
    *   The system DOES NOT store exam results locally. It sends them via Webhook to a Google Sheet. The Admin dashboard fetches them back *from the sheet* via the server.

---

## 2. Workflows

### 👮 Admin / Teacher Workflow
1.  **Login**: Authenticates against `users.json` (Managed in Settings).
2.  **Create Exam**:
    *   Teacher inputs details (Class, Subject).
    *   **Input Method**: Pastes raw text questions -> System parses them into structured JSON.
    *   **Question Bank**: Imported questions are deduplicated and stored in `questions.json` for reuse.
3.  **Publish**: The exam is saved as a JSON file in the `exams/` directory and added to `manifest.json`.
4.  **Monitor**: "Dashboard" fetches live stats via the Server Proxy (which queries the Google Sheet).

### 🎓 Student Workflow
1.  **Access**: Opens `index.html` (hosted online or on the Teacher's LAN IP).
2.  **Selection**: Fetches `manifest.json` to see available active exams.
3.  **Authentication**: Simple identification (Name/Seat No) - No password required for students.
4.  **Examination**:
    *   Questions loaded from the specific JSON file (e.g., `exams/MATH-101.json`).
    *   **Security**: Fullscreen enforcement and tab-switch detection (Integrity Module).
5.  **Submission**:
    *   **Online**: Sends result payload directly to the Google Apps Script Webhook.
    *   **Offline/Failed**: Queues result in LocalStorage and retries when connection is available.

## 3. Critical Observations
*   **Connectivity**: The system relies heavily on the **Google Sheets Webhook** for results. If the internet is down, students can *take* exams (if loaded via LAN), but results will sit in their browser (LocalStorage) until they reconnect.
*   **Security**: Student auth is trust-based (no password). Integrity is client-side (can be bypassed by savvy users, but sufficient for general proctoring).
*   **Scalability**: Excellent for single schools. JSON storage is fast but might get unwieldy if you have thousands of active exams simultaneously (unlikely).
