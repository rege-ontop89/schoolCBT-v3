/**
 * SchoolCBT Sheets Submission Module
 * Handles result submission to Google Sheets via Apps Script webhook
 * 
 * @version 1.0.0
 * @author Sheets Integration Agent
 */

const SheetsSubmitter = (function () {
    // Configuration - Must be set before use
    let _config = {
        webhookUrl: '', // Google Apps Script Web App URL
        maxRetries: 3,
        retryDelay: 2000 // ms
    };

    /**
     * Configure the submitter
     * @param {Object} config - { webhookUrl: string }
     */
    function configure(config) {
        if (config.webhookUrl) {
            _config.webhookUrl = config.webhookUrl;
        }
        if (config.maxRetries !== undefined) {
            _config.maxRetries = config.maxRetries;
        }
    }

    // Offline Queue Management
    const QUEUE_KEY = 'pending_submissions';

    function getQueue() {
        try {
            return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function addToQueue(data) {
        const queue = getQueue();
        queue.push(data);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    function removeFromQueue(submissionId) {
        const queue = getQueue();
        const newQueue = queue.filter(item => item.submissionId !== submissionId);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        return newQueue.length;
    }

    /**
     * Report status to Admin Server
     * Used for "Pending Syncs" dashboard statistic
     */
    async function reportStatus() {
        const queue = getQueue();
        try {
            await fetch('http://localhost:3001/api/analytics/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pendingSyncs: queue.length })
            });
        } catch (e) {
            // If admin server is unreachable, just ignore
        }
    }

    /**
     * Try to process the offline queue
     */
    async function processQueue() {
        const queue = getQueue();
        if (queue.length === 0) return;

        console.log(`[SheetsSubmitter] Processing ${queue.length} pending items...`);

        for (const item of queue) {
            const result = await submit(item, true); // true = isRetry
            if (result.success) {
                removeFromQueue(item.submissionId);
            }
        }

        // Report updated status
        reportStatus();
    }

    /**
     * Submit result to Google Sheets
     * @param {Object} resultData - Data conforming to results.schema.json
     * @param {boolean} isRetry - internal flag
     * @returns {Promise<Object>} - { success, submissionId, timestamp, error }
     */
    async function submit(resultData, isRetry = false) {
        if (!_config.webhookUrl) {
            // If no webhook, it's always "pending" technically, but we won't queue if not configured to sync
            return {
                success: false,
                submissionId: resultData.submissionId,
                timestamp: new Date().toISOString(),
                error: 'Webhook URL not configured. Results saved locally only.'
            };
        }

        let lastError = null;
        let success = false;

        for (let attempt = 1; attempt <= _config.maxRetries; attempt++) {
            try {
                // Check online status first
                if (!navigator.onLine) throw new Error('Browser is offline');

                const response = await fetch(_config.webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(resultData)
                });

                success = true;
                break;

            } catch (error) {
                lastError = error;
                console.warn(`Submission attempt ${attempt} failed:`, error);
                if (attempt < _config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, _config.retryDelay));
                }
            }
        }

        if (success) {
            return {
                success: true,
                submissionId: resultData.submissionId,
                timestamp: new Date().toISOString(),
                error: null
            };
        } else {
            // Failed after retries -> Queue it if not already verifying queue
            if (!isRetry) {
                console.log('[SheetsSubmitter] Submission failed, adding to offline queue');
                addToQueue(resultData);
                reportStatus(); // Report new pending count
            }

            return {
                success: false,
                submissionId: resultData.submissionId,
                timestamp: new Date().toISOString(),
                error: `Network error after ${_config.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
            };
        }
    }

    // Public API
    return {
        configure,
        generateSubmissionId,
        submit,
        reportStatus,
        processQueue
    };
})();

// Export for module systems or attach to window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SheetsSubmitter;
} else {
    window.SheetsSubmitter = SheetsSubmitter;
}
