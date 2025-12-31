import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, BookOpen, BarChart2, Edit2, Save, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

const Profile = ({ user, onUpdate }) => {
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user.name,
        email: user.email,
        password: ''
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchStats();
    }, [user.username]);

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const data = await api.getUserStats(user.username);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const updates = { name: formData.name, email: formData.email };
            if (formData.password) updates.password = formData.password;

            const result = await api.updateUser(user.id, updates);
            onUpdate(result.user);
            setEditing(false);
            setFormData({ ...formData, password: '' });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8 max-w-4xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
                        <p className="text-gray-600 mt-1">Manage your account and view performance</p>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span>{message.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Account Info */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Profile Details</h2>
                                {!editing && (
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="flex items-center space-x-2 text-primary hover:text-primary-hover font-medium text-sm"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        <span>Edit Profile</span>
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Name</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium py-2">{user.name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Username</label>
                                        <p className="text-gray-900 font-medium py-2">@{user.username}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address</label>
                                    {editing ? (
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    ) : (
                                        <p className="text-gray-900 font-medium py-2">{user.email || 'No email provided'}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                                        <div className="flex items-center space-x-2 py-2">
                                            <Shield className="w-4 h-4 text-primary" />
                                            <span className="text-gray-900 font-medium">{user.role}</span>
                                        </div>
                                    </div>
                                    {editing && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">New Password (Optional)</label>
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="Leave blank to keep current"
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                {editing && (
                                    <div className="flex items-center space-x-3 pt-4 border-t">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="px-6 py-2 primary-bg text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center space-x-2"
                                        >
                                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setEditing(false); setFormData({ name: user.name, email: user.email, password: '' }); }}
                                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                                        >
                                            <X className="w-4 h-4" />
                                            <span>Cancel</span>
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <h2 className="text-xl font-bold mb-6">Performance Statistics</h2>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-4 bg-primary-light rounded-xl border border-primary/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <BookOpen className="w-5 h-5 text-primary" />
                                        <span className="text-xs font-bold text-primary uppercase">Activity</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {loadingStats ? '...' : stats?.examsCreated || 0}
                                    </p>
                                    <p className="text-sm text-gray-600">Exams Created</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <BarChart2 className="w-5 h-5 text-green-600" />
                                        <span className="text-xs font-bold text-green-600 uppercase">Success</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {loadingStats ? '...' : `${stats?.avgPassRate || 0}%`}
                                    </p>
                                    <p className="text-sm text-gray-600">Avg. Pass Rate</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Activity Side */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 text-white shadow-lg primary-bg">
                            <h3 className="font-bold mb-4 opacity-90 uppercase text-xs tracking-wider">System Status</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm opacity-80">Account Type</span>
                                    <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded">{user.role}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm opacity-80">Last Login</span>
                                    <span className="text-sm font-bold">Today</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm opacity-80">Account Status</span>
                                    <span className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-sm font-bold">Active</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
