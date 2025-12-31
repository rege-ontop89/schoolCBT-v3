import React, { useState, useEffect } from 'react';
import { ChevronDown, RefreshCw, AlertCircle, Trash2, Download, Plus, BookOpen } from 'lucide-react';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const QuestionBank = () => {
    const { settings: globalSettings } = useSettings();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [filterSubject, setFilterSubject] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('All');

    const [inactiveExams, setInactiveExams] = useState([]);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [isAddingToExam, setIsAddingToExam] = useState(false);

    // Load questions on mount and filter changes
    useEffect(() => {
        loadQuestions();
    }, [filterSubject, filterClass, filterDifficulty]);

    const loadQuestions = async () => {
        if (!filterSubject || !filterClass) {
            setQuestions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await api.getQuestions({
                subject: filterSubject,
                class: filterClass,
                difficulty: filterDifficulty === 'All' ? '' : filterDifficulty
            });
            setQuestions(result.questions.map(q => ({ ...q, selected: false })));
            setError(null);
        } catch (err) {
            console.error('Failed to load questions:', err);
            setError('Failed to load questions. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (id) => {
        setQuestions(questions.map(q =>
            q.id === id ? { ...q, selected: !q.selected } : q
        ));
    };

    const handleSelectAll = () => {
        const allSelected = filteredQuestions.every(q => q.selected);
        setQuestions(questions.map(q => ({
            ...q,
            selected: filteredQuestions.includes(q) ? !allSelected : q.selected
        })));
    };

    const handleDeleteSelected = async () => {
        const selectedIds = questions.filter(q => q.selected).map(q => q.id);
        if (selectedIds.length === 0) {
            alert('Please select questions to delete');
            return;
        }

        if (confirm(`Delete ${selectedIds.length} selected question(s)?`)) {
            setIsDeleting(true);
            try {
                await api.deleteQuestionsBulk(selectedIds);
                loadQuestions(); // Reload list
                alert('Questions deleted successfully');
            } catch (err) {
                alert('Failed to delete questions: ' + err.message);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleExportSelected = () => {
        const selectedQuestions = questions.filter(q => q.selected);
        if (selectedQuestions.length === 0) {
            alert('Please select questions to export');
            return;
        }

        // Create blob and download
        const blob = new Blob([JSON.stringify(selectedQuestions, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `question-bank-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleAddToExam = async () => {
        const selectedQuestions = questions.filter(q => q.selected);
        if (selectedQuestions.length === 0) {
            alert('Please select questions to add');
            return;
        }

        // Fetch inactive exams for the current class/subject
        try {
            setLoading(true);
            const allExams = await api.getExams();
            const matchingExams = allExams.filter(e =>
                !e.active &&
                e.class === filterClass &&
                e.subject === filterSubject
            );

            setInactiveExams(matchingExams);
            setIsExamModalOpen(true);
        } catch (err) {
            alert('Failed to load exams: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmAddToExam = async (examId) => {
        const selectedQuestions = questions.filter(q => q.selected);
        setIsAddingToExam(true);
        try {
            await api.appendQuestionsToExam(examId, selectedQuestions.map(q => ({
                text: q.text,
                difficulty: q.difficulty,
                options: q.options,
                correctAnswer: q.correctAnswer
            })));

            alert('Questions added to exam successfully!');
            setIsExamModalOpen(false);
            // Optionally clear selection
            setQuestions(questions.map(q => ({ ...q, selected: false })));
        } catch (err) {
            alert('Error adding questions: ' + err.message);
        } finally {
            setIsAddingToExam(false);
        }
    };

    const filteredQuestions = questions.filter(q => {
        const matchesDifficulty = filterDifficulty === 'All' || q.difficulty === filterDifficulty;
        return matchesDifficulty;
    });

    const selectedCount = filteredQuestions.filter(q => q.selected).length;

    // Hardcoded classes for initialization
    const availableClasses = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'];

    const getDifficultyColor = (difficulty) => {
        const colors = {
            'easy': 'bg-green-100 text-green-700',
            'medium': 'bg-yellow-100 text-yellow-700',
            'hard': 'bg-red-100 text-red-700',
        };
        return colors[difficulty?.toLowerCase()] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Question Bank Library</h1>
                    <p className="text-gray-600 mt-1">Manage and reuse questions across exams</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</label>
                            <div className="relative">
                                <select
                                    value={filterClass}
                                    onChange={(e) => setFilterClass(e.target.value)}
                                    className="w-full appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                >
                                    <option value="">Select Class</option>
                                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</label>
                            <div className="relative">
                                <select
                                    value={filterSubject}
                                    onChange={(e) => setFilterSubject(e.target.value)}
                                    className="w-full appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                >
                                    <option value="">Select Subject</option>
                                    {(globalSettings?.subjects || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Difficulty</label>
                            <div className="relative">
                                <select
                                    value={filterDifficulty}
                                    onChange={(e) => setFilterDifficulty(e.target.value)}
                                    className="w-full appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                >
                                    <option value="All">All Levels</option>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <button
                            onClick={handleSelectAll}
                            disabled={!filterClass || !filterSubject}
                            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            {filteredQuestions.length > 0 && filteredQuestions.every(q => q.selected) ? 'Deselect All' : 'Select All Items'}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Total Questions</p>
                        <p className="text-3xl font-bold text-gray-900">{questions.length}</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Filtered Results</p>
                        <p className="text-3xl font-bold text-gray-900">{filteredQuestions.length}</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Selected</p>
                        <p className="text-3xl font-bold text-primary">{selectedCount}</p>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={loadQuestions} className="underline ml-2">Try Again</button>
                    </div>
                )}

                {/* Questions List */}
                <div className="bg-white rounded-xl border border-gray-200 mb-6 min-h-[400px]">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Questions</h3>
                        {loading && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                            <RefreshCw className="w-8 h-8 animate-spin mb-2 text-primary" />
                            <p>Loading questions...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredQuestions.map((question) => (
                                <div key={question.id} className="p-4 hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-start space-x-4">
                                        <input
                                            type="checkbox"
                                            checked={question.selected}
                                            onChange={() => handleToggleSelect(question.id)}
                                            className="mt-1 w-4 h-4 text-primary rounded focus:ring-primary h-4 w-4"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 mb-2">{question.text}</p>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-500">{question.subject}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-500">{question.class}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(question.difficulty)}`}>
                                                    {question.difficulty}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (confirm('Delete this question?')) {
                                                    try {
                                                        await api.deleteQuestion(question.id);
                                                        loadQuestions();
                                                    } catch (err) { alert(err.message); }
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {filteredQuestions.length === 0 && !loading && (
                                <div className="p-12 text-center text-gray-500">
                                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">No questions found</p>
                                    <p className="text-sm">Try adjusting your filters or add new questions via an exam.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                    <button
                        onClick={handleAddToExam}
                        disabled={selectedCount === 0 || loading}
                        className="flex-1 primary-bg text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add to Inactive Exam ({selectedCount})</span>
                    </button>
                    <button
                        onClick={handleExportSelected}
                        disabled={selectedCount === 0 || loading}
                        className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                    >
                        <Download className="w-5 h-5 text-gray-400" />
                        <span>Export JSON</span>
                    </button>
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedCount === 0 || loading || isDeleting}
                        className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                    >
                        {isDeleting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        <span>Delete Selected</span>
                    </button>
                </div>

                {/* Exam Selection Modal */}
                {isExamModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Select Target Exam</h2>
                            <p className="text-sm text-gray-600 mb-6">
                                Showing inactive exams for <span className="font-semibold">{filterClass} {filterSubject}</span>.
                            </p>

                            <div className="space-y-3 max-h-[300px] overflow-auto mb-6 pr-2">
                                {inactiveExams.length > 0 ? (
                                    inactiveExams.map(exam => (
                                        <button
                                            key={exam.id}
                                            onClick={() => confirmAddToExam(exam.id)}
                                            disabled={isAddingToExam}
                                            className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex justify-between items-center group"
                                        >
                                            <div>
                                                <p className="font-bold text-gray-900">{exam.title}</p>
                                                <p className="text-xs text-gray-500">ID: {exam.id} • {exam.totalMarks} existing questions</p>
                                            </div>
                                            <Plus className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm font-medium">No inactive exams found</p>
                                        <p className="text-xs">Create a new exam as a draft first.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setIsExamModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                {inactiveExams.length === 0 && (
                                    <button
                                        onClick={() => {
                                            setIsExamModalOpen(false);
                                            // Navigation would happen here if we had an onNavigate prop
                                            alert('Go to "Create Exam" and save as draft first.');
                                        }}
                                        className="flex-1 px-4 py-2 primary-bg text-white font-medium rounded-lg hover:opacity-90"
                                    >
                                        Create New Draft
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;