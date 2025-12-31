import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, Users, BarChart3, PieChart, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';

const ExamDetails = ({ examId, onBack }) => {
    const [examData, setExamData] = useState(null);
    const [resultsData, setResultsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadExamDetails();
    }, [examId]);

    const loadExamDetails = async () => {
        setLoading(true);
        setError(null);

        try {
            // Load exam metadata
            const exam = await api.getExam(examId);
            setExamData(exam);

            // Load results from Google Sheets
            const results = await api.getResults(examId);
            setResultsData(results);

        } catch (error) {
            console.error('Error loading exam details:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!resultsData || !resultsData.results || resultsData.results.length === 0) {
            alert('No results to export');
            return;
        }

        // Convert results to CSV
        const headers = Object.keys(resultsData.results[0]);
        const csvContent = [
            headers.join(','),
            ...resultsData.results.map(row =>
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${examId}-results.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleViewSheets = () => {
        if (!examData?.settings?.webhookUrl) {
            alert('No Google Sheets webhook configured for this exam');
            return;
        }

        // Extract spreadsheet ID from webhook URL
        // URL format: https://script.google.com/macros/s/SCRIPT_ID/exec
        // We need to direct to the actual spreadsheet
        alert('Opening Google Sheets...\n\nNote: You need to know your spreadsheet URL.\nThe webhook URL points to the script, not the spreadsheet.');
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading exam details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 overflow-auto bg-gray-50">
                <div className="p-8">
                    <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6">
                        <span>←</span>
                        <span>Back to All Exams</span>
                    </button>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-red-900 mb-2">Failed to Load Exam Details</h3>
                        <p className="text-red-700 mb-4">{error}</p>
                        <button onClick={loadExamDetails} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!resultsData || resultsData.results.length === 0) {
        return (
            <div className="flex-1 overflow-auto bg-gray-50">
                <div className="p-8">
                    <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6">
                        <span>←</span>
                        <span>Back to All Exams</span>
                    </button>

                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">{examData?.metadata?.title || 'Exam Details'}</h1>
                        <p className="text-gray-600 mt-1">{examData?.metadata?.class} • {examData?.metadata?.term}</p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                        <Users className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-yellow-900 mb-2">No Results Yet</h3>
                        <p className="text-yellow-700">No students have completed this exam yet.</p>
                    </div>
                </div>
            </div>
        );
    }

    const analytics = resultsData.analytics;
    const results = resultsData.results;

    // Score distribution for chart
    const scoreDistribution = analytics?.scoreDistribution ? [
        { range: '0-40%', count: analytics.scoreDistribution['0-40'], percentage: Math.round((analytics.scoreDistribution['0-40'] / results.length) * 100) },
        { range: '41-60%', count: analytics.scoreDistribution['41-60'], percentage: Math.round((analytics.scoreDistribution['41-60'] / results.length) * 100) },
        { range: '61-80%', count: analytics.scoreDistribution['61-80'], percentage: Math.round((analytics.scoreDistribution['61-80'] / results.length) * 100) },
        { range: '81-100%', count: analytics.scoreDistribution['81-100'], percentage: Math.round((analytics.scoreDistribution['81-100'] / results.length) * 100) },
    ] : [];

    // Time distribution for chart
    const timeDistribution = analytics?.timeDistribution ? [
        { range: '0-15 mins', count: analytics.timeDistribution['0-15'] },
        { range: '16-25 mins', count: analytics.timeDistribution['16-25'] },
        { range: '26-35 mins', count: analytics.timeDistribution['26-35'] },
        { range: '36+ mins', count: analytics.timeDistribution['36+'] },
    ] : [];

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8">
                {/* Back Button */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                        <span>←</span>
                        <span>Back to All Exams</span>
                    </button>
                    <button onClick={loadExamDetails} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh Data</span>
                    </button>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{examData?.metadata?.title || 'Exam Details'}</h1>
                    <p className="text-gray-600 mt-1">{examData?.metadata?.class} • {examData?.metadata?.term}</p>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Total Students</p>
                        <p className="text-3xl font-bold text-gray-900">{results.length}</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Average Score</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics?.averageScore || 0}%</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics?.passRate || 0}%</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Highest Score</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics?.highestScore || 0}%</p>
                    </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Score Distribution */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                            <BarChart3 className="w-5 h-5 mr-2" />
                            Score Distribution
                        </h3>
                        <div className="space-y-3">
                            {scoreDistribution.map((item, index) => (
                                <div key={index}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-700">{item.range}</span>
                                        <span className="text-gray-900 font-medium">{item.count} students ({item.percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-4">
                            💡 Most students scored between {scoreDistribution.sort((a, b) => b.count - a.count)[0]?.range || 'N/A'}
                        </p>
                    </div>

                    {/* Pass/Fail Pie Chart */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                            <PieChart className="w-5 h-5 mr-2" />
                            Pass/Fail Distribution
                        </h3>
                        <div className="flex items-center justify-center h-48">
                            <div className="relative w-48 h-48">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                    {/* Pass segment */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="20"
                                        strokeDasharray={`${(analytics?.passRate || 0) * 2.51} ${(100 - (analytics?.passRate || 0)) * 2.51}`}
                                    />
                                    {/* Fail segment */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#ef4444"
                                        strokeWidth="20"
                                        strokeDasharray={`${(100 - (analytics?.passRate || 0)) * 2.51} ${(analytics?.passRate || 0) * 2.51}`}
                                        strokeDashoffset={`-${(analytics?.passRate || 0) * 2.51}`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-gray-900">{analytics?.passRate || 0}%</p>
                                        <p className="text-xs text-gray-600">Pass Rate</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center space-x-6 mt-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-sm text-gray-700">Pass: {analytics?.passCount || 0} ({analytics?.passRate || 0}%)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-sm text-gray-700">Fail: {analytics?.failCount || 0} ({100 - (analytics?.passRate || 0)}%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Time Statistics */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                        <Clock className="w-5 h-5 mr-2" />
                        Time Usage Statistics
                    </h3>
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Average Time</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics?.averageTime || 0} mins</p>
                            <p className="text-xs text-gray-500">out of {examData?.settings?.duration || 0} mins</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Fastest Completion</p>
                            <p className="text-2xl font-bold text-green-600">{analytics?.fastestTime || 0} mins</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Slowest Completion</p>
                            <p className="text-2xl font-bold text-orange-600">{analytics?.slowestTime || 0} mins</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {timeDistribution.map((item, index) => (
                            <div key={index}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700">{item.range}</span>
                                    <span className="text-gray-900 font-medium">{item.count} students</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-purple-600 h-2 rounded-full transition-all"
                                        style={{ width: `${(item.count / results.length) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Integrity Violations */}
                {analytics?.violationStats?.studentsWithViolations > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                            Integrity Violations
                        </h3>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-900 font-medium">
                                {analytics.violationStats.studentsWithViolations} student(s) had integrity violations
                            </p>
                            <p className="text-red-700 text-sm mt-1">
                                Total violations: {analytics.violationStats.totalViolations}
                            </p>
                        </div>
                    </div>
                )}

                {/* Individual Results Table */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-2" />
                        Individual Results ({results.length} students)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student Name</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Seat</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Violations</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((student, index) => (
                                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm text-gray-900">{student['Student Name']}</td>
                                        <td className="py-3 px-4 text-sm text-gray-900">{student['Seat Number']}</td>
                                        <td className="py-3 px-4 text-sm text-gray-900">{student['Score']}</td>
                                        <td className="py-3 px-4 text-sm text-gray-900">{student['Percentage']}%</td>
                                        <td className="py-3 px-4 text-sm text-gray-900">{student['Duration Used']}m</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${student['Pass/Fail'] === 'Pass'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                {student['Pass/Fail']}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {student['Integrity Violations'] > 0 ? (
                                                <span className="text-sm text-orange-600 font-medium">
                                                    {student['Integrity Violations']} ⚠️
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-500">0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                    <button
                        onClick={handleExportCSV}
                        className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors border border-gray-300 flex items-center justify-center space-x-2"
                    >
                        <span>📥 Export as CSV</span>
                    </button>
                    <button
                        onClick={handleViewSheets}
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                        <span>📊 View in Google Sheets</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamDetails;