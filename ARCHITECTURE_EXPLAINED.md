# 🛑 STOP: Read This First

You are seeing a blank page because **Node.js (the Server) cannot run on Netlify**.

## The Architecture (Simplified)

Imagine your system like a Restaurant:

1.  **The Kitchen (Admin Tool)**:
    *   This is where food (Exams) is made.
    *   It needs gas, fire, and knives (Node.js Server).
    *   **Location**: It stays **on the School's Laptop**. You cannot put the kitchen in the customer's mailbox (Netlify).

2.  **The Delivery Menu (Netlify)**:
    *   This is just a piece of paper (Static HTML/JSON) showing what's available.
    *   **Location**: hosted on **Netlify**.
    *   Students look at this to take exams.

## Why is the Admin Page Blank?
On your laptop, you run `npm start` and `npm run dev`. This starts the "Kitchen" engines.
Netlify is just a file hosting service. It does not run `npm start`. So when you try to open the Admin Panel there, it's like trying to cook on a piece of paper. It does nothing.

## The Correct Workflow

1.  **School Admin**: Uses the **Laptop**.
    *   Opens `http://localhost:5173`.
    *   Creates an Exam.
    *   **Magic Happens**: The local server automatically sends the new exam file to GitHub/Netlify (using the code we just wrote).

2.  **Student**: Uses **Netlify**.
    *   Opens `https://your-site.netlify.app/student`.
    *   Because the Admin machine "uploaded" the exam file, the student sees it there.

## Summary
*   **Admin URL**: `http://localhost:5173` (Only works on the School Laptop).
*   **Student URL**: `https://your-site.netlify.app/student` (Works for everyone).
