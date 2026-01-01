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
        // SETTINGS
        if (path === "/settings" && method === "GET") {
            const settings = (await getFile("settings.json")) || {};
            return { statusCode: 200, headers, body: JSON.stringify({ settings }) };
        }

        // AUTH
        if (path === "/auth/login" && method === "POST") {
            const { username, password } = body;
            const users = (await getFile("users.json"));

            if (!users) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: "Database connection failed. Check GitHub Token." }) };
            }

            const user = users.find(u => u.username === username && u.password === password);
            if (user) return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: "Invalid credentials" }) };
        }

        // EXAMS LIST (Student & Admin)
        if (path === "/exams" && method === "GET") {
            const manifest = (await getFile("exams/manifest.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify({ exams: manifest }) };
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
                createdAt: new Date().toISOString()
            };
            const idx = manifest.findIndex(e => e.id === exam.examId);
            if (idx > -1) manifest[idx] = entry; else manifest.push(entry);
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

        // QUESTIONS BANK
        if (path === "/questions" && method === "GET") {
            const questions = (await getFile("questions.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify(questions) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: "Route not found" }) };

    } catch (error) {
        console.error("API Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};