const { Octokit } = require("@octokit/rest");

// Config
const OWNER = process.env.GITHUB_OWNER || "rege-ontop89"; // Extracted from user context
const REPO = process.env.GITHUB_REPO || "schoolCBT-v2";
const BRANCH = "main";

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

// Helper: Get File Content
async function getFile(path) {
    try {
        const { data } = await octokit.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: path,
            ref: BRANCH,
        });

        // GitHub API returns content in base64
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading ${path}:`, error);
        return null;
    }
}

// Helper: Update/Create File
async function saveFile(path, content, message) {
    try {
        // 1. Get SHA of existing file (if it exists)
        let sha;
        try {
            const { data } = await octokit.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: path,
                ref: BRANCH,
            });
            sha = data.sha;
        } catch (e) {
            // File doesn't exist, fine
        }

        // 2. Commit update
        await octokit.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: path,
            message: message,
            content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
            sha: sha,
            branch: BRANCH,
        });
        return true;
    } catch (error) {
        console.error(`Error saving ${path}:`, error);
        throw error;
    }
}

exports.handler = async (event, context) => {
    const path = event.path.replace("/.netlify/functions/api", ""); // Strip prefix
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    // Headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };

    // CORS
    if (method === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        // ================= EXAMS =================
        if (path === "/exams" && method === "GET") {
            const manifest = (await getFile("exams/manifest.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify({ exams: manifest }) };
        }

        if (path === "/exams" && method === "POST") {
            const exam = body;
            // 1. Save Exam File
            await saveFile(`exams/${exam.examId}.json`, exam, `Create Exam: ${exam.metadata.title}`);

            // 2. Update Manifest
            const manifest = (await getFile("exams/manifest.json")) || [];
            const entry = {
                id: exam.examId,
                title: exam.metadata.title,
                subject: exam.metadata.subject,
                active: exam.active !== false,
                createdBy: exam.metadata.createdBy,
                createdAt: new Date().toISOString()
            };

            const idx = manifest.findIndex(e => e.id === exam.examId);
            if (idx > -1) manifest[idx] = { ...manifest[idx], ...entry };
            else manifest.push(entry);

            await saveFile("exams/manifest.json", manifest, `Update Manifest for ${exam.metadata.title}`);

            return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
        }

        // ================= EXAM DETAILS =================
        if (path.match(/\/exams\/[\w-]+$/) && method === "GET") {
            const id = path.split("/").pop();
            const exam = await getFile(`exams/${id}.json`);
            if (!exam) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not Found" }) };
            return { statusCode: 200, headers, body: JSON.stringify(exam) };
        }

        // ================= TOGGLE EXAM =================
        if (path.match(/\/exams\/[\w-]+\/toggle$/) && method === "PATCH") {
            const id = path.split("/")[2]; // /exams/:id/toggle
            const { active } = body;

            // 1. Update Exam File
            const exam = await getFile(`exams/${id}.json`);
            if (exam) {
                exam.active = active;
                await saveFile(`exams/${id}.json`, exam, `Toggle Exam ${id}`);
            }

            // 2. Update Manifest
            const manifest = (await getFile("exams/manifest.json")) || [];
            const idx = manifest.findIndex(e => e.id === id);
            if (idx > -1) {
                manifest[idx].active = active;
                await saveFile("exams/manifest.json", manifest, `Toggle Manifest ${id}`);
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // ================= QUESTIONS BANK =================
        if (path === "/questions" && method === "GET") {
            const questions = (await getFile("questions.json")) || [];
            return { statusCode: 200, headers, body: JSON.stringify(questions) };
        }

        if (path === "/questions" && method === "POST") {
            const newQs = body; // Array of questions
            const existing = (await getFile("questions.json")) || [];
            // Deduplicate logic simplified for brevity
            const updated = [...existing, ...newQs];
            await saveFile("questions.json", updated, "Add Questions to Bank");
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // ================= AUTH =================
        if (path === "/auth/login" && method === "POST") {
            const { username, password } = body;
            const users = (await getFile("users.json")) || [];
            const user = users.find(u => u.username === username && u.password === password); // Simple check

            if (user) return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: "Invalid credentials" }) };
        }

        // Default
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not Found" }) };

    } catch (error) {
        console.error("API Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
