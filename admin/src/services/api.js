
// admin/src/services/api.js
// API service for admin panel - Real backend integration

import axios from 'axios';

// In production, always use the relative /api path which sends requests to Netlify Functions via netlify.toml redirects
// In development, use VITE_API_URL or localhost
const API_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:8888/.netlify/functions/api');

// Cache duration in milliseconds (2 minutes)
const CACHE_DURATION = 2 * 60 * 1000;

class ApiService {
    constructor() {
        this._cache = {};
    }

    // Get cached data if valid, otherwise return null
    _getCache(key) {
        const cached = this._cache[key];
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[API Cache] HIT: ${key}`);
            return cached.data;
        }
        return null;
    }

    // Set cache with current timestamp
    _setCache(key, data) {
        this._cache[key] = { data, timestamp: Date.now() };
    }

    // Invalidate specific cache keys (call after mutations)
    _invalidateCache(...keys) {
        keys.forEach(key => delete this._cache[key]);
    }

    // ==================== AUTH ====================


    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            // Check if response is actually JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Configuration Error: Expected JSON but received HTML from ${API_URL}/auth/login. Your VITE_API_URL is likely pointing to a website, not the API.`);
            }

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    // This happens when we get HTML (e.g., 404 page) instead of JSON
                    console.error('Non-JSON response received from:', `${API_URL}/auth/login`);
                    throw new Error(`Configuration Error: Connected to ${API_URL} but received HTML. Check VITE_API_URL.`);
                }
                throw new Error(errorData.error || 'Login failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // ==================== EXAMS ====================

    async getExams() {
        // Check cache first
        const cached = this._getCache('exams');
        if (cached) return cached;

        try {
            const response = await fetch(`${API_URL}/exams`);
            if (!response.ok) throw new Error('Failed to fetch exams');
            const data = await response.json();
            const exams = data.exams || [];
            this._setCache('exams', exams);
            return exams;
        } catch (error) {
            console.error('Error fetching exams:', error);
            throw error;
        }
    }

    async getExam(examId) {
        try {
            const response = await fetch(`${API_URL}/exams/${examId}`);
            if (!response.ok) throw new Error('Failed to fetch exam');
            return await response.json();
        } catch (error) {
            console.error('Error fetching exam:', error);
            throw error;
        }
    }

    async createExam(examData) {
        try {
            const response = await fetch(`${API_URL}/exams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(examData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create exam');
            }
            const result = await response.json();
            this._invalidateCache('exams', 'stats');
            return result;
        } catch (error) {
            console.error('Error creating exam:', error);
            throw error;
        }
    }

    async toggleExam(examId, active) {
        try {
            const response = await fetch(`${API_URL}/exams/${examId}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active }),
            });

            if (!response.ok) throw new Error('Failed to toggle exam');
            const result = await response.json();
            this._invalidateCache('exams', 'stats');
            return result;
        } catch (error) {
            console.error('Error toggling exam:', error);
            throw error;
        }
    }

    async deleteExam(examId) {
        try {
            const response = await fetch(`${API_URL}/exams/${examId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete exam');
            const result = await response.json();
            this._invalidateCache('exams', 'stats');
            return result;
        } catch (error) {
            console.error('Error deleting exam:', error);
            throw error;
        }
    }

    async appendQuestionsToExam(examId, questions) {
        try {
            const response = await fetch(`${API_URL}/exams/${examId}/append-questions`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ questions }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to append questions');
            }

            return await response.json();
        } catch (error) {
            console.error('Error appending questions:', error);
            throw error;
        }
    }

    // ==================== RESULTS ====================

    async getResults(examId) {
        try {
            const response = await fetch(`${API_URL}/results/${examId}`);
            if (!response.ok) throw new Error('Failed to fetch results');
            return await response.json();
        } catch (error) {
            console.error('Error fetching results:', error);
            throw error;
        }
    }

    // ==================== STATS ====================

    async getStats() {
        // Check cache first
        const cached = this._getCache('stats');
        if (cached) return cached;

        try {
            const response = await fetch(`${API_URL}/stats`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            this._setCache('stats', data.stats);
            return data.stats;
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }

    // ==================== HEALTH CHECK ====================

    async checkHealth() {
        try {
            const response = await fetch(`${API_URL}/health`);
            if (!response.ok) throw new Error('Server unreachable');
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }

    // ==================== SETTINGS ====================

    async getSettings() {
        try {
            const response = await fetch(`${API_URL}/settings`);
            if (!response.ok) throw new Error('Failed to fetch settings');
            const data = await response.json();
            return data.settings;
        } catch (error) {
            console.error('Error fetching settings:', error);
            throw error;
        }
    }

    async saveSettings(settings) {
        try {
            const response = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save settings');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    async testWebhook(webhookUrl) {
        try {
            const response = await fetch(`${API_URL}/settings/test-webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ webhookUrl }),
            });

            return await response.json();
        } catch (error) {
            console.error('Error testing webhook:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadLogo(file) {
        try {
            const formData = new FormData();
            formData.append('logo', file);

            const response = await fetch(`${API_URL}/settings/upload-logo`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload logo');
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    }

    // ==================== QUESTION BANK ====================

    async getQuestions(filters = {}) {
        try {
            const query = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_URL}/questions?${query}`);
            if (!response.ok) throw new Error('Failed to fetch questions');
            return await response.json();
        } catch (error) {
            console.error('Error fetching questions:', error);
            throw error;
        }
    }

    async saveQuestions(questions) {
        try {
            const response = await fetch(`${API_URL}/questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(questions),
            });
            if (!response.ok) throw new Error('Failed to save questions');
            return await response.json();
        } catch (error) {
            console.error('Error saving questions:', error);
            throw error;
        }
    }

    async deleteQuestion(id) {
        try {
            const response = await fetch(`${API_URL}/questions/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete question');
            return await response.json();
        } catch (error) {
            console.error('Error deleting question:', error);
            throw error;
        }
    }

    async deleteQuestionsBulk(ids) {
        try {
            const response = await fetch(`${API_URL}/questions/delete-bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids }),
            });
            if (!response.ok) throw new Error('Failed to delete questions');
            return await response.json();
        } catch (error) {
            console.error('Error in bulk delete:', error);
            throw error;
        }
    }

    // ==================== USERS ====================

    async getUsers() {
        try {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            return data.users;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    async createUser(userData) {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async toggleUser(id, active) {
        try {
            const response = await fetch(`${API_URL}/users/${id}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to toggle user status');
            }

            return await response.json();
        } catch (error) {
            console.error('Error toggling user status:', error);
            throw error;
        }
    }

    async deleteUser(id) {
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete user');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }

    async getUserStats(username) {
        try {
            const response = await fetch(`${API_URL}/users/${username}/stats`);
            if (!response.ok) throw new Error('Failed to fetch user stats');
            const data = await response.json();
            return data.stats;
        } catch (error) {
            console.error('Error fetching user stats:', error);
            throw error;
        }
    }

    async updateUser(id, updates) {
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }
}

export default new ApiService();