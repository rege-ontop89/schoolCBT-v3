// server/index.js
// Complete Local Development Server for SchoolCBT

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to Run Git Commands
const syncToCloud = async (message) => {
    return new Promise((resolve, reject) => {
        // Only run if .git exists to avoid errors in non-git environments
        if (!existsSync(path.join(__dirname, '../.git'))) {
            console.log('Skipping cloud sync: No .git directory found.');
            return resolve();
        }

        const projectRoot = path.join(__dirname, '..'); // Root folder

        // Check for GITHUB_TOKEN for remote auth
        const token = process.env.GITHUB_TOKEN;
        const repoUrl = process.env.REPO_URL; // e.g., https://github.com/user/repo.git

        let setupCommand = '';
        if (token && repoUrl) {
            // Construct auth URL: https://token@github.com/user/repo.git
            const authUrl = repoUrl.replace('https://', `https://${token}@`);
            setupCommand = `git remote set-url origin ${authUrl} && `;
        }

        const command = `${setupCommand}git add . && git commit -m "Auto-Update: ${message}" && git push origin main`;

        console.log(`☁️ Syncing to cloud: ${message}...`);

        exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Sync failed: ${error.message}`);
                // Don't reject, just log error so we don't block the API response
                // resolve(); 
            } else {
                console.log(`✅ Cloud sync complete: ${stdout}`);
            }
            resolve();
        });
    });
};

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Ensure public/uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Import fetch for Node.js (if using Node < 18)
// For Node 18+, fetch is built-in
const fetchAPI = global.fetch || (async (...args) => {
    const nodeFetch = await import('node-fetch');
    return nodeFetch.default(...args);
});

// Paths - Point to exams folder (shared between student and admin)
const EXAMS_DIR = path.join(__dirname, '../exams');
const MANIFEST_PATH = path.join(EXAMS_DIR, 'manifest.json');
const SETTINGS_PATH = path.join(__dirname, '../settings.json');
const QUESTIONS_PATH = path.join(__dirname, '../questions.json');
const USERS_PATH = path.join(__dirname, '../users.json');

// In-memory analytics stores
// In a real production app, these would be in a database (like Redis or SQL)
// We reset these on server restart, which is acceptable for a local app
let studentsTodayCount = 0;
const dailyActiveStudents = new Set(); // Track unique students (if we had IDs, relying on simple hit for now)
let pendingSyncsMap = new Map(); // Map<SessionID, Count> - simplified to just total reported
let recentActivities = []; // Store recent events, limit 20

function addActivity(text, type = 'info') {
    const activity = {
        text,
        time: new Date().toISOString(),
        icon: type === 'success' ? 'Check' : type === 'create' ? 'PlusCircle' : 'Activity',
        color: type === 'success' ? 'green' : type === 'create' ? 'blue' : 'purple'
    };
    recentActivities.unshift(activity);
    if (recentActivities.length > 20) recentActivities.pop();
}

// Reset daily count at midnight (simple check)
let lastDate = new Date().toDateString();

function checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== lastDate) {
        studentsTodayCount = 0;
        dailyActiveStudents.clear();
        lastDate = today;
        console.log('Reset daily stats');
    }
}

// Default settings structure
let DEFAULT_SETTINGS = {
    school: {
        name: "St. Paul's College",
        logoPath: "",
        primaryColor: "#3b82f6"
    },
    googleSheets: {
        webhookUrl: ""
    },
    defaults: {
        enableFullscreen: true,
        trackViolations: true,
        violationThreshold: 3,
        shuffleQuestions: true,
        shuffleOptions: true
    },
    subjects: ["English", "Mathematics", "Science", "Economics", "Government", "Biology"]
};

// Initialize directories
async function initializeDirectories() {
    try {
        await fs.mkdir(EXAMS_DIR, { recursive: true });

        // Create manifest if doesn't exist
        try {
            await fs.access(MANIFEST_PATH);
        } catch {
            await fs.writeFile(MANIFEST_PATH, JSON.stringify([], null, 2));
            console.log('Created manifest.json');
        }
    } catch (error) {
        console.error('Error initializing directories:', error);
    }
}

// ==================== EXAM ROUTES ====================

// GET /api/exams - Get all exams (for admin panel)
app.get('/api/exams', async (req, res) => {
    try {
        const manifest = await fs.readFile(MANIFEST_PATH, 'utf-8');
        const exams = JSON.parse(manifest);
        res.json({ success: true, exams });
    } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch exams' });
    }
});

// GET /api/exams/:examId - Get specific exam
app.get('/api/exams/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const examPath = path.join(EXAMS_DIR, `${examId}.json`);
        const examData = await fs.readFile(examPath, 'utf-8');
        res.json(JSON.parse(examData));
    } catch (error) {
        console.error('Error fetching exam:', error);
        res.status(404).json({ success: false, error: 'Exam not found' });
    }
});

// POST /api/exams - Create new exam
app.post('/api/exams', async (req, res) => {
    try {
        const examData = req.body;

        // Validate required fields
        if (!examData.examId || !examData.metadata || !examData.questions) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: examId, metadata, questions'
            });
        }

        // Create exam file
        const examPath = path.join(EXAMS_DIR, `${examData.examId}.json`);
        await fs.writeFile(examPath, JSON.stringify(examData, null, 2));
        console.log(`✅ Created exam file: ${examData.examId}.json`);

        addActivity(`New exam created: ${examData.metadata.subject} (${examData.metadata.class})`, 'create');

        // Update manifest
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));

        // Check if exam already exists in manifest
        const existingIndex = manifest.findIndex(e => e.id === examData.examId);

        const manifestEntry = {
            id: examData.examId,
            title: examData.metadata.title,
            subject: examData.metadata.subject,
            class: examData.metadata.class,
            term: examData.metadata.term,
            academicYear: examData.metadata.academicYear,
            filename: `${examData.examId}.json`,
            duration: examData.settings.duration,
            totalMarks: examData.settings.totalMarks,
            active: examData.active !== undefined ? examData.active : true, // Respect active status
            createdAt: examData.metadata.createdAt,
            createdBy: examData.metadata.createdBy
        };

        if (existingIndex !== -1) {
            manifest[existingIndex] = manifestEntry;
        } else {
            manifest.push(manifestEntry);
        }

        await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        console.log(`✅ Updated manifest.json`);

        // AUTO-DEPLOY: Sync changes to cloud
        await syncToCloud(`Created exam: ${examData.metadata.title}`);

        res.status(201).json({
            success: true,
            examId: examData.examId,
            message: 'Exam created successfully'
        });

    } catch (error) {
        console.error('Error creating exam:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create exam',
            details: error.message
        });
    }
});

// PATCH /api/exams/:examId/toggle - Toggle exam active status
app.patch('/api/exams/:examId/toggle', async (req, res) => {
    try {
        const { examId } = req.params;
        const { active } = req.body;

        if (typeof active !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Invalid active status'
            });
        }

        // Update exam file
        const examPath = path.join(EXAMS_DIR, `${examId}.json`);
        const examData = JSON.parse(await fs.readFile(examPath, 'utf-8'));
        examData.active = active;
        await fs.writeFile(examPath, JSON.stringify(examData, null, 2));

        // Update manifest
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
        const examIndex = manifest.findIndex(e => e.id === examId);

        if (examIndex !== -1) {
            manifest[examIndex].active = active;
            await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        }

        console.log(`✅ ${active ? 'Activated' : 'Deactivated'} exam: ${examId}`);

        // AUTO-DEPLOY: Sync changes to cloud
        await syncToCloud(`${active ? 'Activated' : 'Deactivated'} exam: ${examId}`);

        res.json({
            success: true,
            message: `Exam ${active ? 'activated' : 'deactivated'} successfully`
        });

    } catch (error) {
        console.error('Error toggling exam:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle exam status'
        });
    }
});

// DELETE /api/exams/:examId - Delete exam
app.delete('/api/exams/:examId', async (req, res) => {
    try {
        const { examId } = req.params;

        // Delete exam file
        const examPath = path.join(EXAMS_DIR, `${examId}.json`);
        await fs.unlink(examPath);
        console.log(`✅ Deleted exam file: ${examId}.json`);

        // Update manifest
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
        const updatedManifest = manifest.filter(e => e.id !== examId);
        await fs.writeFile(MANIFEST_PATH, JSON.stringify(updatedManifest, null, 2));
        console.log(`✅ Removed from manifest: ${examId}`);

        res.json({
            success: true,
            message: 'Exam deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting exam:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete exam'
        });
    }
});

// PATCH /api/exams/:examId/append-questions - Add questions to an inactive exam
app.patch('/api/exams/:examId/append-questions', async (req, res) => {
    try {
        const { examId } = req.params;
        const { questions: newQuestions } = req.body;

        if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
            return res.status(400).json({ success: false, error: 'Questions array required' });
        }

        // 1. Load manifest to check if exam is inactive
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
        const examEntry = manifest.find(e => e.id === examId);

        if (!examEntry) {
            return res.status(404).json({ success: false, error: 'Exam not found' });
        }

        if (examEntry.active) {
            return res.status(400).json({
                success: false,
                error: 'Cannot edit an active exam. Deactivate it first.'
            });
        }

        // 2. Update exam file
        const examPath = path.join(EXAMS_DIR, `${examId}.json`);
        const examData = JSON.parse(await fs.readFile(examPath, 'utf-8'));

        examData.questions = [...(examData.questions || []), ...newQuestions];

        // Update total marks if it's based on question count
        examData.settings.totalMarks = examData.questions.length;

        await fs.writeFile(examPath, JSON.stringify(examData, null, 2));

        // 3. Update manifest entry
        examEntry.totalMarks = examData.questions.length;
        await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

        console.log(`✅ Appended ${newQuestions.length} questions to exam: ${examId}`);

        // AUTO-DEPLOY: Sync changes to cloud
        await syncToCloud(`Appended questions to ${examEntry.title}`);

        res.json({
            success: true,
            message: `Successfully added ${newQuestions.length} questions to ${examEntry.title}`,
            totalQuestions: examData.questions.length
        });

    } catch (error) {
        console.error('Error appending questions:', error);
        res.status(500).json({ success: false, error: 'Failed to append questions' });
    }
});

// ==================== RESULTS ROUTES ====================

// GET /api/results/:examId - Get results for an exam (from Google Sheets)
app.get('/api/results/:examId', async (req, res) => {
    try {
        const { examId } = req.params;

        // Get exam to find webhook URL
        const examPath = path.join(EXAMS_DIR, `${examId}.json`);
        let webhookUrl = null;

        try {
            const examData = JSON.parse(await fs.readFile(examPath, 'utf-8'));
            webhookUrl = examData.settings?.webhookUrl;
        } catch (error) {
            console.log(`Could not load exam ${examId} to get webhook URL`);
        }

        if (!webhookUrl) {
            return res.json({
                success: true,
                examId,
                results: [],
                analytics: null,
                message: 'No webhook URL configured for this exam. Results cannot be fetched.'
            });
        }

        // Fetch results from Google Sheets via Apps Script
        const sheetsUrl = `${webhookUrl}?examId=${examId}`;

        console.log(`Fetching results for ${examId} from Google Sheets...`);

        const response = await fetchAPI(sheetsUrl);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch from Google Sheets');
        }

        console.log(`✅ Fetched ${data.results?.length || 0} results for ${examId}`);

        res.json(data);

    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch results',
            details: error.message
        });
    }
});

// ==================== SETTINGS ROUTES ====================

// GET /api/settings - Get current settings
app.get('/api/settings', async (req, res) => {
    try {
        let settings;
        try {
            const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
            const savedSettings = JSON.parse(data);
            settings = { ...DEFAULT_SETTINGS, ...savedSettings };
        } catch {
            // If file doesn't exist, create with defaults
            settings = DEFAULT_SETTINGS;
            await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
            console.log('Created settings.json with defaults');
        }
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// POST /api/settings - Save settings
app.post('/api/settings', async (req, res) => {
    try {
        const newSettings = req.body;

        // Validate required structure
        if (!newSettings.school || !newSettings.googleSheets || !newSettings.defaults) {
            return res.status(400).json({
                success: false,
                error: 'Invalid settings structure'
            });
        }

        await fs.writeFile(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
        console.log('✅ Settings saved successfully');

        res.json({
            success: true,
            message: 'Settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings'
        });
    }
});

// POST /api/settings/test-webhook - Test if webhook URL is reachable
app.post('/api/settings/test-webhook', async (req, res) => {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
        return res.status(400).json({ success: false, error: 'Webhook URL is required' });
    }

    // Basic URL validation
    if (!webhookUrl.startsWith('https://script.google.com/')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid URL. Must be a Google Apps Script URL (starts with https://script.google.com/)'
        });
    }

    try {
        console.log(`Testing connection to: ${webhookUrl}`);

        // Use a 10s timeout for the check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetchAPI(webhookUrl, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const text = await response.text();

        // Even if it returns 401 or similar, if it's from Google, it's "reachable"
        // But for Apps Script, a successful execution (even with error) usually returns 200/302
        if (response.ok || text.includes('Google') || text.includes('Apps Script')) {
            res.json({
                success: true,
                message: 'Successfully connected to Google Apps Script'
            });
        } else {
            res.json({
                success: false,
                error: `Server returned status ${response.status}. Deployment might be inactive.`
            });
        }
    } catch (error) {
        console.error('Webhook test failed:', error);
        res.json({
            success: false,
            error: 'Could not reach webhook: ' + error.message
        });
    }
});

// POST /api/settings/upload-logo - Handle logo upload
app.post('/api/settings/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const logoUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            logoUrl,
            message: 'Logo uploaded successfully'
        });
    } catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== QUESTION BANK ROUTES ====================

// GET /api/questions - List all questions with filtering
app.get('/api/questions', async (req, res) => {
    try {
        const { subject, class: qClass, difficulty } = req.query;

        let questions = [];
        try {
            const data = await fs.readFile(QUESTIONS_PATH, 'utf-8');
            questions = JSON.parse(data);
        } catch {
            return res.json({ success: true, questions: [] });
        }

        // Apply filters
        if (subject && subject !== 'All Subjects') {
            questions = questions.filter(q => q.subject === subject);
        }
        if (qClass && qClass !== 'All Classes') {
            questions = questions.filter(q => q.class === qClass);
        }
        if (difficulty && difficulty !== 'All') {
            questions = questions.filter(q => q.difficulty === difficulty);
        }

        res.json({ success: true, questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch questions' });
    }
});

// POST /api/questions - Add new question(s)
app.post('/api/questions', async (req, res) => {
    try {
        const newItems = Array.isArray(req.body) ? req.body : [req.body];

        let questions = [];
        try {
            const data = await fs.readFile(QUESTIONS_PATH, 'utf-8');
            questions = JSON.parse(data);
        } catch {
            questions = [];
        }

        const processedItems = newItems.map(item => ({
            ...item,
            id: item.id || `Q${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: item.createdAt || new Date().toISOString()
        }));

        questions = [...questions, ...processedItems];
        await fs.writeFile(QUESTIONS_PATH, JSON.stringify(questions, null, 2));

        res.json({
            success: true,
            message: `Successfully added ${processedItems.length} question(s)`,
            count: processedItems.length
        });
    } catch (error) {
        console.error('Error adding questions:', error);
        res.status(500).json({ success: false, error: 'Failed to add questions' });
    }
});

// DELETE /api/questions/:id - Delete a question
app.delete('/api/questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await fs.readFile(QUESTIONS_PATH, 'utf-8');
        let questions = JSON.parse(data);

        const initialLength = questions.length;
        questions = questions.filter(q => q.id !== id);

        if (questions.length === initialLength) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        await fs.writeFile(QUESTIONS_PATH, JSON.stringify(questions, null, 2));
        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ success: false, error: 'Failed to delete question' });
    }
});

// POST /api/questions/delete-bulk - Bulk delete questions
app.post('/api/questions/delete-bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ success: false, error: 'IDs array required' });
        }

        const data = await fs.readFile(QUESTIONS_PATH, 'utf-8');
        let questions = JSON.parse(data);

        const initialLength = questions.length;
        questions = questions.filter(q => !ids.includes(q.id));

        await fs.writeFile(QUESTIONS_PATH, JSON.stringify(questions, null, 2));
        res.json({
            success: true,
            message: `Successfully deleted ${initialLength - questions.length} questions`
        });
    } catch (error) {
        console.error('Error in bulk delete:', error);
        res.status(500).json({ success: false, error: 'Failed to delete questions' });
    }
});

// ==================== AUTH & USER ROUTES ====================

// POST /api/auth/login - User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        let users = [];
        try {
            const data = await fs.readFile(USERS_PATH, 'utf-8');
            users = JSON.parse(data);
        } catch (error) {
            return res.status(500).json({ success: false, error: 'User database not found' });
        }

        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        if (!user.active) {
            return res.status(403).json({ success: false, error: 'Account is deactivated' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        // Return user info (excluding password)
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during login' });
    }
});

// GET /api/users - List all users (Admin only)
app.get('/api/users', async (req, res) => {
    try {
        const data = await fs.readFile(USERS_PATH, 'utf-8');
        const users = JSON.parse(data);

        // Remove the hashed password before sending, but keep plainPassword if it exists
        const safeUsers = users.map(({ password: _, ...rest }) => rest);
        res.json({ success: true, users: safeUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// POST /api/users - Create new user (Admin only)
app.post('/api/users', async (req, res) => {
    try {
        const userData = req.body;

        if (!userData.username || !userData.password || !userData.role) {
            return res.status(400).json({ success: false, error: 'Missing required user fields' });
        }

        const data = await fs.readFile(USERS_PATH, 'utf-8');
        const users = JSON.parse(data);

        // Check if username exists
        if (users.some(u => u.username === userData.username)) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);

        const newUser = {
            id: `user-${Date.now()}`,
            username: userData.username,
            password: hashedPassword,
            plainPassword: userData.password, // Store plain text for admin visibility
            name: userData.name || userData.username,
            email: userData.email || '',
            role: userData.role,
            active: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));

        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, error: 'Failed to create user' });
    }
});

// PATCH /api/users/:id/toggle - Toggle user status
app.patch('/api/users/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        const data = await fs.readFile(USERS_PATH, 'utf-8');
        const users = JSON.parse(data);

        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Cannot deactivate last admin
        if (!active && users[userIndex].role === 'Admin') {
            const adminCount = users.filter(u => u.role === 'Admin' && u.active).length;
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, error: 'Cannot deactivate the only active admin' });
            }
        }

        users[userIndex].active = active;
        await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));

        res.json({ success: true, message: `User ${active ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle user status' });
    }
});

// DELETE /api/users/:id - Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const data = await fs.readFile(USERS_PATH, 'utf-8');
        let users = JSON.parse(data);

        const userToDelete = users.find(u => u.id === id);
        if (!userToDelete) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Cannot delete last admin
        if (userToDelete.role === 'Admin') {
            const adminCount = users.filter(u => u.role === 'Admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, error: 'Cannot delete the only admin' });
            }
        }

        users = users.filter(u => u.id !== id);
        await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

// GET /api/users/:username/stats - Get statistics for a specific user
app.get('/api/users/:username/stats', async (req, res) => {
    try {
        const { username } = req.params;
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
        const userExams = manifest.filter(e => e.createdBy === username);

        // Dynamic mock based on username and exam count for more realistic feel
        const seededRandom = (str) => {
            let hash = 0;
            const s = str + "school-cbt-seed"; // Add salt
            for (let i = 0; i < s.length; i++) {
                hash = s.charCodeAt(i) + ((hash << 5) - hash);
            }
            return Math.abs(hash % 1000) / 1000;
        };

        const seed = seededRandom(username);
        const passRate = 60 + Math.floor(seed * 35); // Varies between 60% and 95%
        const studentsPerExam = 10 + Math.floor(seed * 40) + (userExams.length * 2);

        res.json({
            success: true,
            stats: {
                examsCreated: userExams.length,
                activeExams: userExams.filter(e => e.active).length,
                avgPassRate: userExams.length > 0 ? passRate : 0,
                totalStudents: (userExams.length * studentsPerExam) || 0
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

// PATCH /api/users/:id - Profile Update
app.patch('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const users = JSON.parse(await fs.readFile(USERS_PATH, 'utf-8'));
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return res.status(404).json({ error: 'User not found' });
        if (updates.name) users[idx].name = updates.name;
        if (updates.email) users[idx].email = updates.email;
        if (updates.password) {
            users[idx].password = await bcrypt.hash(updates.password, 10);
            users[idx].plainPassword = updates.password; // Updated stored plain password
        }
        await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
        const { password, ...rest } = users[idx];
        res.json({ success: true, user: rest });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// ==================== STATS ROUTES ====================

// GET /api/stats - Get dashboard statistics
app.get('/api/stats', async (req, res) => {
    try {
        const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));

        checkDailyReset();

        // Calculate total pending syncs reported by clients
        // Since we don't have persistent sessions, we just use the latest reported values
        // or a simple heuristic. For now, we'll store a global counter updated by client heartbeats
        let totalPending = 0;
        for (let count of pendingSyncsMap.values()) {
            totalPending = count; // Simplified: just taking latest report if single client, or sum if multiple
        }

        // If map is empty, default to 0
        if (pendingSyncsMap.size === 0) totalPending = 0;

        const stats = {
            totalExams: manifest.length,
            activeExams: manifest.filter(e => e.active !== false).length,
            studentsToday: studentsTodayCount,
            pendingSyncs: totalPending,
            recentActivities: recentActivities
        };

        res.json({ success: true, stats });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

// POST /api/analytics/activity - Record student activity
app.post('/api/analytics/activity', (req, res) => {
    checkDailyReset();

    // We expect a simple body, maybe just identifying the session if we want unique users
    // For now, we just increment daily count on exam start
    studentsTodayCount++;

    // Optional: Log basic info
    const { studentName, subject } = req.body;
    console.log(`[Analytics] Activity recorded: ${studentName || 'Unknown'} started ${subject || 'Exam'}`);

    addActivity(`Student ${studentName || 'Unknown'} started ${subject || 'Exam'}`, 'activity'); // Changed type to 'activity' for distinct icon

    res.json({ success: true, count: studentsTodayCount });
});

// POST /api/analytics/status - Receive heartbeat/status from client
app.post('/api/analytics/status', (req, res) => {
    const { pendingSyncs, clientId } = req.body;

    // Use IP as simplified client ID if not provided
    const id = clientId || req.ip;

    if (typeof pendingSyncs === 'number') {
        pendingSyncsMap.set(id, pendingSyncs);
        // Clean up old entries could be added here
    }

    res.json({ success: true });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        message: 'SchoolCBT API Server is running',
        timestamp: new Date().toISOString()
    });
});

// ==================== START SERVER ====================

async function startServer() {
    await initializeDirectories();

    app.listen(PORT, () => {
        console.log('');
        console.log('='.repeat(50));
        console.log('🚀 SchoolCBT API Server Running');
        console.log('='.repeat(50));
        console.log(`📡 Server URL: http://localhost:${PORT}`);
        console.log(`📁 Exams Directory: ${EXAMS_DIR}`);
        console.log(`📋 Manifest: ${MANIFEST_PATH}`);
        console.log('');
        console.log('Available Endpoints:');
        console.log('  GET    /api/health');
        console.log('  GET    /api/exams');
        console.log('  GET    /api/exams/:examId');
        console.log('  POST   /api/exams');
        console.log('  PATCH  /api/exams/:examId/toggle');
        console.log('  DELETE /api/exams/:examId');
        console.log('  GET    /api/results/:examId');
        console.log('  GET    /api/stats');
        console.log('  GET    /api/settings');
        console.log('  POST   /api/settings');
        console.log('  POST   /api/settings/test-webhook');
        console.log('  POST   /api/settings/upload-logo');
        console.log('  GET    /api/questions');
        console.log('  POST   /api/questions');
        console.log('  DELETE /api/questions/:id');
        console.log('  POST   /api/questions/delete-bulk');
        console.log('  POST   /api/auth/login');
        console.log('  GET    /api/users');
        console.log('  POST   /api/users');
        console.log('  PATCH  /api/users/:id/toggle');
        console.log('  DELETE /api/users/:id');
        console.log('  GET    /api/users/:username/stats');
        console.log('  PATCH  /api/users/:id');
        console.log('  POST   /api/analytics/activity');
        console.log('  POST   /api/analytics/status');
        console.log('='.repeat(50));
        console.log('');
    });
}

startServer();