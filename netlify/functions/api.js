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

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Content-Type": "application/json",
    };

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

        // --- AUTH & USER MANAGEMENT ---
        if (path === "/auth/login" && method === "POST") {
            const { username, password } = body;
            const users = (await getFile("users.json")) || [];

            // Allow admin/admin if users.json is empty/missing
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

        // CREATE USER
        if (path === "/users" && method === "POST") {
            const newUser = body; // { username, password, role }
            newUser.id = Date.now().toString();
            newUser.active = true;
            // Store plain password for demo/simplicity as requested, or hash it in real app
            newUser.plainPassword = newUser.password;

            const users = (await getFile("users.json")) || [];
            if (users.find(u => u.username === newUser.username)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Username already exists" }) };
            }

            users.push(newUser);
            await saveFile("users.json", users, `Create User: ${newUser.username}`);
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, user: newUser }) };
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
            // ... (keep existing GET /exams logic)
            const manifest = (await getFile("exams/manifest.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify({ exams: manifest }) };
        }

        // STATS (Dashboard)
        if (path === "/stats" && method === "GET") {
            const manifest = (await getFile("exams/manifest.json")) || [];
            const users = (await getFile("users.json")) || [];
            const recentActivity = []; // Would come from an 'activity.json' if implemented

            const stats = {
                totalExams: manifest.length,
                activeExams: manifest.filter(e => e.active).length,
                totalStudents: 0, // Placeholder
                totalTeachers: users.filter(u => u.role === 'teacher').length,
                recentActivity: recentActivity
            };
            return { statusCode: 200, headers, body: JSON.stringify({ stats }) };
        }

        // CREATE EXAM
        if (path === "/exams" && method === "POST") {
            const exam = body;
            await saveFile(`exams/${exam.examId}.json`, exam, `Create Exam: ${exam.metadata.title}`);
            const manifest = (await getFile("exams/manifest.json")) || [];
            const entry = {
                id: exam.examId,
                title: exam.metadata.title,
                subject: exam.metadata.subject,
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

        // EXAM TOGGLE (Keep existing)
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
            return { statusCode: 200, headers, body: JSON.stringify({ questions }) };
        }

        if (path === "/questions" && method === "POST") {
            const newQs = body;
            const existing = (await getFile("questions.json")) || [];
            const updated = [...existing, ...newQs]; // Simple append
            await saveFile("questions.json", updated, "Add Questions to Bank");
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // USER STATS
        if (path.match(/\/users\/[\w-]+\/stats$/) && method === "GET") {
            const identifier = path.split("/")[2]; // ID or Username
            const users = (await getFile("users.json")) || [];
            // Match by ID or Username
            const user = users.find(u => u.id === identifier || u.username === identifier);

            if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };

            // Calculate Stats (Real Calculation)
            const manifest = (await getFile("exams/manifest.json")) || [];
            let stats = {};

            if (user.role === 'teacher' || user.role === 'admin') {
                // Teacher Stats: Exams Created, Active Exams
                const createdExams = manifest.filter(e => e.createdBy === user.username || e.author === user.username);
                stats = {
                    examsCreated: createdExams.length,
                    activeExams: createdExams.filter(e => e.active).length,
                    totalQuestions: 0 // Placeholder as we'd need to fetch every exam file to count
                };
            } else {
                // Student Stats (Placeholder - requires results storage implementation)
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
            // Try to read a results file (e.g., results/EXAM_ID.json)
            // Ideally results are stored as individual files or a big JSON
            const results = (await getFile(`results/${examId}.json`)) || [];
            return { statusCode: 200, headers, body: JSON.stringify(results) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: `Route not found: ${method} ${path}` }) };
    } catch (error) {
        console.error("API Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};