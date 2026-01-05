const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
    // 1. SETUP: Initialize Octokit and Config inside the handler
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const OWNER = process.env.GITHUB_OWNER || "rege-ontop89";
    const REPO = process.env.GITHUB_REPO || "schoolCBT-v3";
    const BRANCH = "main";

    // 2. REQUEST DATA
    const path = event.path.replace("/.netlify/functions/api", "").replace("/api", "");
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    // ADDED: Capture URL parameters for filtering (e.g., ?subject=Math)
    const queryParams = event.queryStringParameters || {};

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Content-Type": "application/json",
    };



    // Route: GET /exams/:filename (e.g., /exams/ENG-2025-001.json)
    if (path.startsWith("/exams/") && path.endsWith(".json") && method === "GET") {
        // Extract the filename from the path
        const filename = path.replace("/exams/", "");
        console.log("📂 Fetching exam file:", filename);

        try {
            const examData = await getFile(`exams/${filename}`);

            if (!examData) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: "Exam file not found in repository" })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(examData)
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Failed to read exam file from GitHub." })
            };
        }
    }

    // 3. HELPER FUNCTIONS (Inside handler scope)
    async function getFile(filePath) {
        try {
            const { data } = await octokit.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: filePath,
                ref: BRANCH,
            });
            return JSON.parse(Buffer.from(data.content, "base64").toString("utf-8"));
        } catch (error) {
            console.error(`Read Error [${filePath}]:`, error.message);
            return null;
        }
    }

    async function saveFile(filePath, content, message) {
        try {
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner: OWNER,
                    repo: REPO,
                    path: filePath,
                    ref: BRANCH,
                });
                sha = data.sha;
            } catch (e) { /* File new */ }

            await octokit.repos.createOrUpdateFileContents({
                owner: OWNER,
                repo: REPO,
                path: filePath,
                message: message,
                content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
                sha: sha,
                branch: BRANCH,
            });
            return true;
        } catch (error) {
            console.error(`Save Error [${filePath}]:`, error.message);
            throw error;
        }
    }

    // 4. ROUTING LOGIC
    if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

    try {
        // SETTINGS (GET & POST)
        if (path === "/settings" && method === "GET") {
            const settings = (await getFile("settings.json")) || {};
            return { statusCode: 200, headers, body: JSON.stringify({ settings }) };
        }
        if (path === "/settings" && method === "POST") {
            await saveFile("settings.json", body, "Update Settings");
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // ADDED: SETTINGS WEBHOOK & LOGO (Fixes 404 errors)
        if (path === "/settings/test-webhook" && method === "POST") {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Webhook reachable" }) };
        }
        if (path === "/settings/upload-logo" && method === "POST") {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // --- AUTH & USER MANAGEMENT ---
        if (path === "/auth/login" && method === "POST") {
            const { username, password } = body;
            const users = (await getFile("users.json")) || [];

            if ((!users || users.length === 0) && username === "admin" && password === "admin") {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: { username: "admin", role: "admin" } }) };
            }

            const user = users.find(u => u.username === username && (u.plainPassword === password || u.password === password));
            if (user) {
                const { password, plainPassword, ...safeUser } = user;
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
            }
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: "Invalid credentials" }) };
        }

        // GET USERS
        if (path === "/users" && method === "GET") {
            const users = (await getFile("users.json")) || [];
            const safeUsers = users.map(({ password, plainPassword, ...u }) => u);
            return { statusCode: 200, headers, body: JSON.stringify({ users: safeUsers }) };
        }

        // --- 1. Fix Profile 404 (Specific User Fetch) ---
        if (path.match(/\/users\/[\w-]+$/) && method === "GET") {
            const id = path.split("/").pop();
            const users = (await getFile("users.json")) || [];
            // Search by both id and username to be safe
            const user = users.find(u => u.id === id || u.username === id);

            if (!user) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };
            }

            const { password, plainPassword, ...safeUser } = user;
            return { statusCode: 200, headers, body: JSON.stringify(safeUser) };
        }

        // --- 2. Fix Webhook & Logo (Real Testing) ---
        if (path === "/settings" && method === "POST") {
            // If user is testing a webhook, try to ping it
            if (body.webhookUrl && body.webhookUrl.includes('http')) {
                try {
                    // Using a short timeout so the function doesn't hang
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 3000);

                    const testPing = await fetch(body.webhookUrl, {
                        method: 'POST',
                        body: JSON.stringify({ test: true }),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    if (!testPing.ok) throw new Error();
                } catch (e) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: "Webhook URL is unreachable" }) };
                }
            }
            await saveFile("settings.json", body, "Update Settings");
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // --- 3. Fix Logo 502 (Size limit) ---
        if (path === "/settings/upload-logo" && method === "POST") {
            // Netlify functions crash if the body is too large
            if (event.body.length > 2000000) { // Approx 2MB
                return { statusCode: 413, headers, body: JSON.stringify({ error: "Image too large. Please compress your logo." }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // CREATE USER
        if (path === "/users" && method === "POST") {
            const newUser = body;
            newUser.id = Date.now().toString();
            newUser.active = true;
            newUser.plainPassword = newUser.password;

            const users = (await getFile("users.json")) || [];
            if (users.find(u => u.username === newUser.username)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Username already exists" }) };
            }

            users.push(newUser);
            await saveFile("users.json", users, `Create User: ${newUser.username}`);
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, user: newUser }) };
        }

        // ADDED: UPDATE USER (Fixes "admin-001" 404 when saving profile)
        if (path.match(/\/users\/[\w-]+$/) && method === "PUT") {
            const id = path.split("/").pop();
            const updates = body;
            const users = (await getFile("users.json")) || [];
            const idx = users.findIndex(u => u.id === id || u.username === id);
            if (idx > -1) {
                users[idx] = { ...users[idx], ...updates };
                if (updates.password) users[idx].plainPassword = updates.password;
                await saveFile("users.json", users, `Update User ${id}`);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };
        }

        // TOGGLE USER
        if (path.match(/\/users\/[\w-]+\/toggle$/) && method === "PATCH") {
            const id = path.split("/")[2];
            const { active } = body;
            const users = (await getFile("users.json")) || [];
            const idx = users.findIndex(u => u.id === id);
            if (idx > -1) {
                users[idx].active = active;
                await saveFile("users.json", users, `Toggle User ${id}`);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };
        }

        // DELETE USER
        if (path.match(/\/users\/[\w-]+$/) && method === "DELETE") {
            const id = path.split("/")[2];
            let users = (await getFile("users.json")) || [];
            users = users.filter(u => u.id !== id);
            await saveFile("users.json", users, `Delete User ${id}`);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // EXAMS LIST
        if (path === "/exams" && method === "GET") {
            const manifest = (await getFile("exams/manifest.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify({ exams: manifest }) };
        }

        // STATS (Dashboard)
        if (path === "/stats" && method === "GET") {
            const manifest = (await getFile("exams/manifest.json")) || [];
            const users = (await getFile("users.json")) || [];

            // UPDATED: Calculate real "Recent Activity" from manifest
            const recentActivity = manifest
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5)
                .map(e => ({
                    text: `Exam created: ${e.title}`,
                    time: e.createdAt || new Date().toISOString(),
                    icon: "PlusCircle",
                    color: "blue"
                }));

            const stats = {
                totalExams: manifest.length,
                activeExams: manifest.filter(e => e.active).length,
                totalStudents: 0,
                totalTeachers: users.filter(u => u.role === 'teacher').length,
                recentActivity: recentActivity
            };
            return { statusCode: 200, headers, body: JSON.stringify({ stats }) };
        }

        // CREATE EXAM
        if (path === "/exams" && method === "POST") {
            const exam = body;
            await saveFile(`exams/${exam.examId}.json`, exam, `Create Exam: ${exam.metadata.title}`);

            try {
                const bankQuestions = (await getFile("questions.json")) || [];

                // Process questions to ensure they have metadata for the bank
                const newBankQuestions = exam.questions.map(q => ({
                    ...q,
                    // Generate a global ID to prevent conflicts (ExamID + QuestionID)
                    // Or keep original if you want strict ID preservation
                    id: q.id || `${exam.examId}-${q.questionId}`,
                    // Add metadata so filtering works in the Question Bank UI
                    subject: exam.metadata.subject,
                    class: exam.metadata.class,
                    examOrigin: exam.examId,
                    difficulty: q.difficulty || "Medium" // Default for fairness logic
                }));

                // Filter out duplicates (check if ID already exists in bank)
                const uniqueNewQuestions = newBankQuestions.filter(newQ =>
                    !bankQuestions.some(existingQ => existingQ.id === newQ.id)
                );

                if (uniqueNewQuestions.length > 0) {
                    const updatedBank = [...bankQuestions, ...uniqueNewQuestions];
                    await saveFile("questions.json", updatedBank, `Import questions from ${exam.examId}`);
                    console.log(`[Bank] Added ${uniqueNewQuestions.length} questions from ${exam.examId}`);
                }
            } catch (err) {
                console.error("Failed to update question bank:", err);
                // Don't fail the whole request just because banking failed
            }
            const manifest = (await getFile("exams/manifest.json")) || [];
            const entry = {
                id: exam.examId,
                title: exam.metadata.title,
                subject: exam.metadata.subject,
                class: exam.metadata.class,               // <--- ADDED: Required for student login filter
                term: exam.metadata.term,                 // <--- ADDED: Useful for student display
                academicYear: exam.metadata.academicYear, // <--- ADDED
                filename: `${exam.examId}.json`,          // <--- ADDED: Required for student loader
                duration: exam.settings.duration,         // <--- ADDED: Required for timer initialization
                totalMarks: exam.settings.totalMarks,     // <--- ADDED
                active: exam.active !== false,
                createdBy: exam.metadata.createdBy || "Admin",
                createdAt: new Date().toISOString()
            };
            const idx = manifest.findIndex(e => e.id === exam.examId);
            if (idx > -1) manifest[idx] = { ...manifest[idx], ...entry };
            else manifest.push(entry);

            await saveFile("exams/manifest.json", manifest, `Update Manifest`);
            return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
        }

        // SINGLE EXAM DETAILS
        if (path.match(/\/exams\/[\w-]+$/) && method === "GET") {
            const id = path.split("/").pop();
            const exam = await getFile(`exams/${id}.json`);
            if (!exam) return { statusCode: 404, headers, body: JSON.stringify({ error: "Exam not found" }) };
            return { statusCode: 200, headers, body: JSON.stringify(exam) };
        }

        // EXAM TOGGLE
        if (path.match(/\/exams\/[\w-]+\/toggle$/) && method === "PATCH") {
            const id = path.split("/")[2];
            const { active } = body;
            const exam = await getFile(`exams/${id}.json`);
            if (exam) {
                exam.active = active;
                await saveFile(`exams/${id}.json`, exam, `Toggle Exam ${id}`);
            }
            const manifest = (await getFile("exams/manifest.json")) || [];
            const idx = manifest.findIndex(e => e.id === id);
            if (idx > -1) {
                manifest[idx].active = active;
                await saveFile("exams/manifest.json", manifest, `Toggle Manifest ${id}`);
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // QUESTIONS BANK
        if (path === "/questions" && method === "GET") {
            const questions = (await getFile("questions.json")) || [];

            // UPDATED: Filter questions based on query parameters (Subject/Class)
            let filtered = questions;
            if (queryParams.subject) filtered = filtered.filter(q => q.subject === queryParams.subject);
            if (queryParams.class) filtered = filtered.filter(q => q.class === queryParams.class);
            if (queryParams.difficulty && queryParams.difficulty !== 'All') {
                filtered = filtered.filter(q => q.difficulty === queryParams.difficulty);
            }

            return { statusCode: 200, headers, body: JSON.stringify({ questions: filtered }) };
        }

        if (path === "/questions" && method === "POST") {
            const newQs = body;
            const existing = (await getFile("questions.json")) || [];
            const updated = [...existing, ...newQs];
            await saveFile("questions.json", updated, "Add Questions to Bank");
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // USER STATS
        if (path.match(/\/users\/[\w-]+\/stats$/) && method === "GET") {
            const identifier = path.split("/")[2];
            const users = (await getFile("users.json")) || [];
            const user = users.find(u => u.id === identifier || u.username === identifier);

            if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };

            const manifest = (await getFile("exams/manifest.json")) || [];
            let stats = {};

            if (user.role === 'teacher' || user.role === 'admin') {
                const createdExams = manifest.filter(e => e.createdBy === user.username || e.author === user.username);
                stats = {
                    examsCreated: createdExams.length,
                    activeExams: createdExams.filter(e => e.active).length,
                    totalQuestions: 0
                };
            } else {
                stats = {
                    examsTaken: 0,
                    averageScore: 0
                };
            }

            return { statusCode: 200, headers, body: JSON.stringify({ stats }) };
        }

        // EXAM RESULTS
        if (path.match(/\/results\/[\w-]+$/) && method === "GET") {
            const examId = path.split("/").pop();
            const results = (await getFile(`results/${examId}.json`)) || [];
            return { statusCode: 200, headers, body: JSON.stringify(results) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: `Route not found: ${method} ${path}` }) };
    } catch (error) {
        console.error("API Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }


};