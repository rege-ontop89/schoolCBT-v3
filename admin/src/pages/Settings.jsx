import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X, User, FileCheck, RefreshCw, CheckCircle, AlertCircle, Upload, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const Settings = () => {
    const { settings: globalSettings, updateSettingsState } = useSettings();

    // Local form state
    const [settings, setSettings] = useState({
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
        subjects: []
    });

    const [newSubject, setNewSubject] = useState('');

    // Sync local state when global settings load
    useEffect(() => {
        if (globalSettings) {
            setSettings(globalSettings);
        }
    }, [globalSettings]);

    // UI state
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const fileInputRef = useRef(null);

    // Teacher accounts
    const [teachers, setTeachers] = useState([]);
    const [loadingTeachers, setLoadingTeachers] = useState(false);
    const [showAddTeacher, setShowAddTeacher] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userStats, setUserStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [newTeacher, setNewTeacher] = useState({ name: '', email: '', username: '', password: '', role: 'Teacher' });

    // Fetch teachers on mount
    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
            const data = await api.getUsers();
            setTeachers(data);
        } catch (error) {
            console.error('Failed to fetch teachers:', error);
        } finally {
            setLoadingTeachers(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        setSaveMessage(null);
        try {
            await api.saveSettings(settings);
            // Update global state immediately
            updateSettingsState(settings);
            setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setSaveMessage({ type: 'error', text: 'Failed to save settings: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!settings.googleSheets.webhookUrl) {
            setWebhookStatus({ success: false, message: 'Please enter a webhook URL first' });
            return;
        }

        setTestingWebhook(true);
        setWebhookStatus(null);

        try {
            const result = await api.testWebhook(settings.googleSheets.webhookUrl);
            setWebhookStatus({
                success: result.success,
                message: result.success ? result.message : result.error
            });
        } catch (error) {
            setWebhookStatus({ success: false, message: error.message });
        } finally {
            setTestingWebhook(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Simple validation
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        setUploadingLogo(true);
        try {
            const result = await api.uploadLogo(file);
            updateSettings('school', 'logoPath', result.logoUrl);
            alert('Logo uploaded successfully! Click "Save All Settings" to finalize.');
        } catch (error) {
            alert('Failed to upload logo: ' + error.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    const updateSettings = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleAddTeacher = async () => {
        if (!newTeacher.name || !newTeacher.email || !newTeacher.username || !newTeacher.password) {
            alert('Please fill in all fields');
            return;
        }
        try {
            await api.createUser(newTeacher);
            setNewTeacher({ name: '', email: '', username: '', password: '', role: 'Teacher' });
            setShowAddTeacher(false);
            fetchTeachers();
        } catch (error) {
            alert('Failed to add teacher: ' + error.message);
        }
    };

    const handleToggleTeacher = async (id, active) => {
        try {
            await api.toggleUser(id, active);
            fetchTeachers();
        } catch (error) {
            alert('Failed to update status: ' + error.message);
        }
    };

    const handleDeleteTeacher = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.deleteUser(id);
            fetchTeachers();
        } catch (error) {
            alert('Failed to delete teacher: ' + error.message);
        }
    };

    const handleViewUser = async (user) => {
        setSelectedUser(user);
        setShowPassword(false);
        setLoadingStats(true);
        try {
            const stats = await api.getUserStats(user.username);
            setUserStats(stats);
        } catch (error) {
            console.error('Failed to fetch user stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleAddSubject = () => {
        if (!newSubject.trim()) return;
        if ((settings.subjects || []).includes(newSubject.trim())) {
            alert('Subject already exists');
            return;
        }
        setSettings(prev => ({
            ...prev,
            subjects: [...(prev.subjects || []), newSubject.trim()]
        }));
        setNewSubject('');
    };

    const handleRemoveSubject = (subject) => {
        setSettings(prev => ({
            ...prev,
            subjects: prev.subjects.filter(s => s !== subject)
        }));
    };

    const logoUrl = settings.school.logoPath ? `http://localhost:3001${settings.school.logoPath}` : null;

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-600 mt-1">Manage system configuration</p>
                </div>

                {saveMessage && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${saveMessage.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {saveMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span>{saveMessage.text}</span>
                    </div>
                )}

                {/* School Information */}
                <div className="bg-white rounded-xl p-6 border mb-6">
                    <h2 className="text-xl font-bold mb-6">School Information</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                            <input
                                type="text"
                                value={settings.school.name}
                                onChange={(e) => updateSettings('school', 'name', e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
                            <div className="flex items-center space-x-6">
                                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border">
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        disabled={uploadingLogo}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center space-x-2 disabled:opacity-50"
                                    >
                                        {uploadingLogo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                                    </button>
                                    <p className="text-xs text-gray-500">Max size 2MB. Recommended: Square PNG or JPG.</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="color"
                                    value={settings.school.primaryColor}
                                    onChange={(e) => updateSettings('school', 'primaryColor', e.target.value)}
                                    className="w-16 h-10 rounded border cursor-pointer"
                                />
                                <span className="text-sm text-gray-600 font-mono">{settings.school.primaryColor}</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden flex">
                                    <div className="h-full w-full primary-bg"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Google Sheets Integration */}
                <div className="bg-white rounded-xl p-6 border mb-6">
                    <h2 className="text-xl font-bold mb-6">Google Sheets Integration</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                            <input
                                type="text"
                                value={settings.googleSheets.webhookUrl}
                                onChange={(e) => updateSettings('googleSheets', 'webhookUrl', e.target.value)}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleTestConnection}
                                disabled={testingWebhook}
                                className="px-4 py-2 primary-bg text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center space-x-2"
                            >
                                {testingWebhook && <RefreshCw className="w-4 h-4 animate-spin" />}
                                <span>{testingWebhook ? 'Testing...' : 'Test Connection'}</span>
                            </button>
                            {webhookStatus && (
                                <div className={`flex items-center space-x-2 text-sm ${webhookStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {webhookStatus.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    <span>{webhookStatus.message}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Subject Management */}
                <div className="bg-white rounded-xl p-6 border mb-6">
                    <h2 className="text-xl font-bold mb-6">Subject Management</h2>
                    <p className="text-sm text-gray-600 mb-4">Register subjects that will be available for selection during exam creation.</p>

                    <div className="flex space-x-2 mb-6">
                        <input
                            type="text"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
                            placeholder="Enter subject name (e.g. Further Mathematics)"
                            className="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                            onClick={handleAddSubject}
                            className="px-4 py-2 primary-bg text-white rounded-lg font-medium hover:opacity-90 flex items-center space-x-2"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Add</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(settings.subjects || []).map(subject => (
                            <div key={subject} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg group">
                                <span className="text-sm font-medium text-gray-700">{subject}</span>
                                <button
                                    onClick={() => handleRemoveSubject(subject)}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {(!settings.subjects || settings.subjects.length === 0) && (
                            <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                No subjects registered yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Default Exam Settings */}
                <div className="bg-white rounded-xl p-6 border mb-6">
                    <h2 className="text-xl font-bold mb-6">Default Exam Settings</h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-700">Violation threshold</span>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="number"
                                    value={settings.defaults.violationThreshold}
                                    onChange={(e) => updateSettings('defaults', 'violationThreshold', parseInt(e.target.value) || 3)}
                                    className="w-16 px-2 py-1 border rounded text-center"
                                />
                                <span className="text-sm text-gray-500">violations</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-700">Shuffle questions by default</span>
                            <input
                                type="checkbox"
                                checked={settings.defaults.shuffleQuestions}
                                onChange={(e) => updateSettings('defaults', 'shuffleQuestions', e.target.checked)}
                                className="w-5 h-5 text-primary rounded"
                            />
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-700">Shuffle options by default</span>
                            <input
                                type="checkbox"
                                checked={settings.defaults.shuffleOptions}
                                onChange={(e) => updateSettings('defaults', 'shuffleOptions', e.target.checked)}
                                className="w-5 h-5 text-primary rounded"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full bg-primary text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg primary-bg primary-bg-hover mb-12"
                >
                    {saving && <RefreshCw className="w-5 h-5 animate-spin" />}
                    <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
                </button>

                {/* Teacher Accounts */}
                <div className="bg-white rounded-xl p-6 border mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold">Teacher Accounts</h2>
                            <p className="text-sm text-gray-600">Manage access for other teachers</p>
                        </div>
                        <button
                            onClick={() => setShowAddTeacher(true)}
                            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center space-x-2 primary-bg primary-bg-hover"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Add Teacher</span>
                        </button>
                    </div>

                    <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {teachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewUser(teacher)}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{teacher.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.role}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${teacher.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {teacher.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-3" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleToggleTeacher(teacher.id, !teacher.active)}
                                                    className="text-primary hover:text-primary-hover text-primary"
                                                >
                                                    {teacher.active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTeacher(teacher.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {teachers.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            {loadingTeachers ? 'Loading...' : 'No teacher accounts found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Teacher Modal */}
                {showAddTeacher && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full relative">
                            <button onClick={() => setShowAddTeacher(false)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                            <h3 className="text-xl font-bold mb-6">Add New Teacher</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        value={newTeacher.name}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="e.g. Mr. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                                    <input
                                        type="text"
                                        value={newTeacher.username}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="jdoe2025"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={newTeacher.email}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="j.doe@school.ng"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                    <input
                                        type="password"
                                        value={newTeacher.password}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="Set initial password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                    <select
                                        value={newTeacher.role}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, role: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="Teacher">Teacher</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddTeacher}
                                    className="w-full primary-bg text-white py-3 rounded-xl font-medium shadow-lg hover:opacity-90 mt-4"
                                >
                                    Add Teacher
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-8 max-w-lg w-full relative">
                        <button onClick={() => setSelectedUser(null)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center">
                                <User className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">{selectedUser.name}</h3>
                                <p className="text-gray-600">@{selectedUser.username} • {selectedUser.role}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-4 bg-gray-50 rounded-xl border">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Pass Rate</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loadingStats ? '...' : `${userStats?.avgPassRate || 0}%`}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Exams Created</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loadingStats ? '...' : userStats?.examsCreated || 0}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b text-sm">
                                <span className="text-gray-500">Email</span>
                                <span className="font-medium">{selectedUser.email}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b text-sm">
                                <span className="text-gray-500">Total Students</span>
                                <span className="font-medium">{loadingStats ? '...' : userStats?.totalStudents || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b text-sm">
                                <span className="text-gray-500">Account status</span>
                                <span className={`font-bold ${selectedUser.active ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedUser.active ? 'Active' : 'Deactivated'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b text-sm">
                                <span className="text-gray-500">Password</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                                        {showPassword ? (selectedUser.plainPassword || 'No plain text saved') : '••••••••'}
                                    </span>
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        title={showPassword ? "Hide Password" : "Show Password"}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedUser(null)}
                            className="w-full mt-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;