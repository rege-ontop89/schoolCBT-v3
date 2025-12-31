# Added Things - Settings Persistence System

> **Date**: 2025-12-30  
> **Feature**: Settings Persistence System (Gap Fix #1)

---

## Summary

The admin panel Settings page now **persists all changes** to the server. Previously, settings were only stored in React state and lost on refresh. Now they are saved to a `settings.json` file and loaded on page mount.

---

## Files Created

### 1. `settings.json`
**Location**: `c:\Users\HP USER\Desktop\schoolCBT\settings.json`

**Why**: This file stores all admin panel settings persistently. Without a database, we use a JSON file.

**Structure**:
```json
{
  "school": {
    "name": "St. Paul's College",
    "logoPath": "",
    "primaryColor": "#3b82f6"
  },
  "googleSheets": {
    "webhookUrl": ""
  },
  "defaults": {
    "enableFullscreen": true,
    "trackViolations": true,
    "violationThreshold": 3,
    "shuffleQuestions": true,
    "shuffleOptions": true
  }
}
```

---

## Files Modified

### 2. `server/index.js`

**Changes Made**:

| What | Why |
|------|-----|
| Added `SETTINGS_PATH` constant | Points to `settings.json` location |
| Added `DEFAULT_SETTINGS` object | Fallback if file doesn't exist |
| Added `GET /api/settings` endpoint | Loads settings from file |
| Added `POST /api/settings` endpoint | Saves settings to file |
| Added `POST /api/settings/test-webhook` endpoint | Tests if webhook URL is reachable |
| Updated console log output | Lists new endpoints on server start |

**New Endpoints**:
- `GET /api/settings` - Returns current settings
- `POST /api/settings` - Saves new settings (body = settings object)
- `POST /api/settings/test-webhook` - Tests webhook connection (body = { webhookUrl })

---

### 3. `admin/src/services/api.js`

**Changes Made**:

| What | Why |
|------|-----|
| Added `getSettings()` method | Fetches settings from server |
| Added `saveSettings(settings)` method | Sends settings to server for saving |
| Added `testWebhook(webhookUrl)` method | Tests webhook connectivity via server |

**Usage Example**:
```javascript
// Load settings
const settings = await api.getSettings();

// Save settings
await api.saveSettings(settings);

// Test webhook
const result = await api.testWebhook('https://script.google.com/...');
console.log(result.success, result.message);
```

---

### 4. `admin/src/pages/Settings.jsx`

**Complete rewrite with these changes**:

| What | Why |
|------|-----|
| Added `useEffect` to load settings on mount | Settings load automatically when page opens |
| Added `loading` state | Shows spinner while loading |
| Connected "Save All Settings" button to API | Actually saves to server |
| Implemented real webhook testing | Server tests if URL is reachable |
| Added success/error messages | User sees feedback on save |
| Made violation threshold editable | Can change from default 3 |
| Made shuffle options toggleable | Checkboxes for shuffle settings |
| Added loading states for buttons | Shows spinner when saving/testing |
| Added info note about teacher accounts | Explains they're not yet persisted |

**UI Improvements**:
- Loading spinner on page load
- Green/red banner for save success/error
- "Testing..." state with spinner on webhook test
- Real-time status display after webhook test

---

## How It Works

### Loading Settings
1. User opens Settings page
2. `useEffect` calls `loadSettings()`
3. Frontend calls `api.getSettings()`
4. Server reads `settings.json` and returns data
5. React state is updated with settings
6. Form fields show current values

### Saving Settings
1. User changes form fields (state updates)
2. User clicks "Save All Settings"
3. `handleSaveSettings()` calls `api.saveSettings(settings)`
4. Server writes to `settings.json`
5. Success/error message shown to user

### Testing Webhook
1. User enters webhook URL
2. User clicks "Test Connection"
3. Server makes GET request to webhook
4. If reachable → shows green "✅ Webhook is reachable"
5. If fails → shows red "❌ [error message]"

---

## Teacher Accounts Note

Teacher accounts are still **local state only** in this phase. They will be persisted in the **Multi-User Authentication** phase (Gap Fix #3).

The UI shows a note: "ℹ️ Teacher accounts are not yet persisted to server."

---

## Testing

1. Start the server: `cd server && npm start`
2. Start admin panel: `cd admin && npm run dev`
3. Open Settings page
4. Change school name → Click "Save All Settings"
5. Refresh page → Settings should persist
6. Enter a webhook URL → Click "Test Connection"
7. Should see real success/failure status

---

## What's Next

- [x] Question Bank Backend & Storage (Gap Fix #2)
- [x] Multi-User Authentication (Gap Fix #3)

---

## Update: Global Settings Integration & Webhook Fix

> **Date**: 2025-12-30  
> **Feature**: Global UI Sync & Robust Testing (Gap Fix #1 Continued)

### 1. Global UI Reflection (School Name & Logo)
- **SettingsContext**: Created a global context in `admin/src/context/SettingsContext.jsx` that fetches settings on app load and makes them available to all components.
- **Sidebar Sync**: The sidebar now automatically reflects the School Name and Logo from the settings.
- **Auto-Sync**: When you click "Save All Settings", the UI updates immediately across the entire app without a refresh.
- **Tab Title**: The browser tab title now dynamically updates to `[School Name] | CBT Admin`.

### 2. Dynamic Primary Color (Theming)
- **Dynamic CSS Injection**: Created a theme engine in `App.jsx` that generates a dynamic `<style>` tag.
- **CSS Variables**: Added `:root` variables (`--primary-color`, etc.) in `index.css`.
- **Primary Color Sync**: Changing the "Primary Color" in settings now instantly changes the theme color of buttons, icons, highlights, and active states across the entire Admin Panel.
- **Shade Generation**: The system automatically generates hover shades (darker) and background shades (lightest) from your chosen color.

### 3. Real Logo Upload
- **Backend Storage**: Configured `multer` on the server to handle real image uploads.
- **Storage Path**: Images are stored in `server/public/uploads/`.
- **Static Serving**: The server now serves the `public` folder at `http://localhost:3001/uploads/`.
- **UI Integration**: Added an "Upload New Logo" button in Settings with a real-time preview.

### 4. Robust Webhook Test logic
- **Format Validation**: The server now validates that the URL starts with `https://script.google.com/`.
- **Real Connection Check**: The server performs a real fetch request with a 10-second timeout.
- **Detailed Feedback**: If the URL is fake or unreachable, it now shows a specific error message (e.g., "Connection timed out" or "Server returned status 404") instead of a generic success message.
