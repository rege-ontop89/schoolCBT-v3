import React, { useState, useEffect } from 'react';
import { Check, X, Search, ChevronDown, BarChart3, FileText, RefreshCw } from 'lucide-react';
import api from '../services/api';

const AllExams = ({ onNavigate }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterClass, setFilterClass] = useState('All Classes');
    const [filterSubject, setFilterSubject] = useState('All Subjects');
    const [searchQuery, setSearchQuery] = useState('');

    // Load exams from API
    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        setLoading(true);
        try {
            const data = await api.getExams();
            setExams(data);
        } catch (error) {
            console.error('Failed to load exams:', error);
            alert('Failed to load exams. Please make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (examId) => {
        const exam = exams.find(e => e.id === examId);
        if (!exam) return;

        const newStatus = !exam.active;
        const action = newStatus ? 'activate' : 'deactivate';

        if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this exam? Students ${newStatus ? 'will' : "won't"} be able to access it.`)) {
            return;
        }

        try {
            await api.toggleExam(examId, newStatus);

            // Update local state
            setExams(exams.map(e =>
                e.id === examId ? { ...e, active: newStatus } : e
            ));

            alert(`Exam ${action}d successfully!`);
        } catch (error) {
            console.error(`Failed to ${action} exam:`, error);
            alert(`Failed to ${action} exam. Please try again.`);
        }
    };

    const handleDelete = async (examId) => {
        if (!confirm('⚠️ Delete this exam? This action cannot be undone. All results will remain in Google Sheets.')) {
            return;
        }

        try {
            await api.deleteExam(examId);

            // Remove from local state
            setExams(exams.filter(e => e.id !== examId));

            alert('Exam deleted successfully');
        } catch (error) {
            console.error('Failed to delete exam:', error);
            alert('Failed to delete exam. Please try again.');
        }
    };

    const filteredExams = exams.filter(exam => {
        const matchesClass = filterClass === 'All Classes' || exam.class === filterClass;
        const matchesSubject = filterSubject === 'All Subjects' || exam.subject === filterSubject;
        const matchesSearch =
            exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exam.subject.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesClass && matchesSubject && matchesSearch;
    });

    const classes = ['All Classes', ...new Set(exams.map(e => e.class))];
    const subjects = ['All Subjects', ...new Set(exams.map(e => e.subject))];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading exams...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">All Exams</h1>
                        <p className="text-gray-600 mt-1">Manage your exams</p>
                    </div>
                    <button
                        onClick={loadExams}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center space-x-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
                    <div className="flex items-center space-x-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search exams..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="relative">
                            <select
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                {classes.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>

                        <div className="relative">
                            <select
                                value={filterSubject}
                                onChange={(e) => setFilterSubject(e.target.value)}
                                className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                {subjects.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Results count */}
                <p className="text-sm text-gray-600 mb-4">
                    Showing {filteredExams.length} of {exams.length} exams
                </p>

                {/* Exams List */}
                <div className="space-y-4">
                    {filteredExams.map((exam) => (
                        <div
                            key={exam.id}
                            className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        {exam.active !== false ? (
                                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                                <Check className="w-4 h-4 text-green-600" />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                                                <FileText className="w-4 h-4 text-orange-600" />
                                            </div>
                                        )}
                                        <h3 className="text-xl font-bold text-gray-900">{exam.title}</h3>
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                                            {exam.class}
                                        </span>
                                        {exam.active === false && (
                                            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-bold rounded-full animate-pulse">
                                                DRAFT
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-600 mb-3">
                                        {exam.totalMarks || 'N/A'} questions | {exam.duration} mins | {exam.term}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                        Created: {new Date(exam.createdAt).toLocaleDateString()} by {exam.createdBy}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => onNavigate('details', exam.id)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        View Details
                                    </button>

                                    <button
                                        onClick={() => handleToggleActive(exam.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exam.active !== false
                                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                    >
                                        {exam.active !== false ? 'Deactivate' : 'Activate Exam'}
                                    </button>

                                    {!exam.active && (
                                        <button
                                            onClick={() => onNavigate('create', exam.id)}
                                            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                                        >
                                            Edit Exam
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleDelete(exam.id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredExams.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600">No exams found matching your filters</p>
                            <button
                                onClick={() => {
                                    setFilterClass('All Classes');
                                    setFilterSubject('All Subjects');
                                    setSearchQuery('');
                                }}
                                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AllExams;