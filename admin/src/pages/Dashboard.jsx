import React, { useState, useEffect } from 'react';
import { FileText, Check, Users, Clock, PlusCircle, Activity } from 'lucide-react';
import api from '../services/api';

const StatsCard = ({ icon: Icon, label, value, color, loading }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600',
    };

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{label}</p>
                    {loading ? (
                        <div className="h-9 w-16 bg-gray-200 animate-pulse rounded"></div>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900">{value}</p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
};

const Dashboard = ({ user, onNavigate }) => {
    const [stats, setStats] = useState({
        totalExams: 0,
        activeExams: 0,
        studentsToday: 0,
        pendingSyncs: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await api.getStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statsData = [
        { icon: FileText, label: 'Total Exams', value: stats.totalExams, color: 'blue' },
        { icon: Check, label: 'Active Exams', value: stats.activeExams, color: 'green' },
        { icon: Users, label: 'Students Today', value: stats.studentsToday, color: 'purple' },
        { icon: Clock, label: 'Pending Syncs', value: stats.pendingSyncs, color: 'orange' },
    ];

    const recentActivity = [
        { icon: Check, text: '45 students completed English exam (JSS2)', time: '2 hours ago', color: 'green' },
        { icon: PlusCircle, text: 'Mathematics exam created by Mr. John', time: '5 hours ago', color: 'blue' },
        { icon: Activity, text: '12 students currently taking Physics exam', time: 'Just now', color: 'purple' },
    ];

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
                    <p className="text-gray-600 mt-1">{user?.school} CBT System</p>
                </div>

                <div className="grid grid-cols-4 gap-6 mb-8">
                    {statsData.map((stat, index) => (
                        <StatsCard key={index} {...stat} loading={loading} />
                    ))}
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Activity className="w-5 h-5 mr-2" />
                        Recent Activity
                    </h2>
                    <div className="space-y-4">
                        {stats.recentActivities && stats.recentActivities.length > 0 ? (
                            stats.recentActivities.map((activity, index) => {
                                const Icon = activity.icon === 'PlusCircle' ? PlusCircle : activity.icon === 'Check' ? Check : Activity;
                                const colorClasses = {
                                    green: 'bg-green-100 text-green-600',
                                    blue: 'bg-blue-100 text-blue-600',
                                    purple: 'bg-purple-100 text-purple-600',
                                };
                                const timeAgo = (dateStr) => {
                                    const date = new Date(dateStr);
                                    const diff = Math.floor((new Date() - date) / 1000); // seconds
                                    if (diff < 60) return 'Just now';
                                    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
                                    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
                                    return date.toLocaleDateString();
                                };

                                return (
                                    <div key={index} className="flex items-start space-x-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClasses[activity.color] || colorClasses.purple}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-900">{activity.text}</p>
                                            <p className="text-xs text-gray-500 mt-1">{timeAgo(activity.time)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex space-x-4">
                    <button
                        onClick={() => onNavigate('create')}
                        className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span>Create New Exam</span>
                    </button>
                    <button
                        onClick={() => onNavigate('exams')}
                        className="flex-1 bg-white text-gray-700 px-6 py-4 rounded-xl font-medium hover:bg-gray-50 transition-colors border border-gray-300 flex items-center justify-center space-x-2"
                    >
                        <FileText className="w-5 h-5" />
                        <span>View All Exams</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;