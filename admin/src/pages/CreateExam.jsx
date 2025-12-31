import React, { useState, useEffect } from 'react';
import { ChevronDown, BookOpen, Plus, X, Search, RefreshCw, FileCheck, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { parseSimpleFormat } from '../utils/parser';
import { useSettings } from '../context/SettingsContext';

const CreateExam = ({ examId, onNavigate, user }) => {
    const { settings: globalSettings } = useSettings();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [examData, setExamData] = useState({
        examId: '',
        title: '',
        subject: '',
        class: '',
        term: 'First Term',
        academicYear: '2024/2025',
        duration: 40,
        passMark: 50,
        createdBy: user?.username || 'Admin',
        instructions: 'Answer all questions.',
        webhookUrl: '',
        questionsPerStudent: 20,
        shuffleQuestions: true,
        shuffleOptions: true,
        showResults: false,
        allowReview: false,
        active: false // New field for draft status
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [pastedText, setPastedText] = useState('');
    const [parsedExam, setParsedExam] = useState(null);
    const [parseError, setParseError] = useState('');

    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [bankQuestions, setBankQuestions] = useState([]);
    const [bankLoading, setBankLoading] = useState(false);
    const [bankSearch, setBankSearch] = useState('');

    // Load exam data if in edit mode
    useEffect(() => {
        if (examId) {
            loadExam(examId);
        }
    }, [examId]);

    // Auto-fill webhook from global settings for NEW exams
    useEffect(() => {
        if (!examId && globalSettings?.googleSheets?.webhookUrl && !examData.webhookUrl) {
            setExamData(prev => ({
                ...prev,
                webhookUrl: globalSettings.googleSheets.webhookUrl
            }));
        }
    }, [globalSettings, examId]);

    const loadExam = async (id) => {
        setIsLoading(true);
        setIsEditMode(true);
        try {
            const data = await api.getExam(id);
            if (data) {
                setExamData({
                    examId: data.id,
                    title: data.metadata.title,
                    subject: data.metadata.subject,
                    class: data.metadata.class,
                    term: data.metadata.term,
                    academicYear: data.metadata.academicYear,
                    duration: data.settings.duration,
                    passMark: data.settings.passMark,
                    createdBy: data.metadata.createdBy,
                    instructions: data.metadata.instructions,
                    webhookUrl: data.settings.webhookUrl,
                    questionsPerStudent: data.settings.questionsPerStudent || data.questions.length,
                    shuffleQuestions: data.settings.shuffleQuestions,
                    shuffleOptions: data.settings.shuffleOptions,
                    showResults: data.settings.showResults,
                    allowReview: data.settings.allowReview,
                    active: data.active
                });

                // Convert questions back to text format
                const formattedText = data.questions.map((q, i) => {
                    let optionsText = '';
                    const qText = q.questionText || q.text || 'Question text missing';

                    // Handle options: Schema uses object {A:..., B:...}, Editor might hold Array
                    if (Array.isArray(q.options)) {
                        optionsText = q.options.map((opt, optIdx) =>
                            `${String.fromCharCode(65 + optIdx)}) ${opt}${optIdx === q.correctAnswer ? '*' : ''}`
                        ).join('\n');
                    } else if (typeof q.options === 'object' && q.options !== null) {
                        // Convert {A, B, C, D} object to ordered text
                        optionsText = ['A', 'B', 'C', 'D'].filter(key => q.options[key]).map(key => {
                            const isCorrect = key === q.correctAnswer;
                            return `${key}) ${q.options[key]}${isCorrect ? '*' : ''}`;
                        }).join('\n');
                    }

                    const difficulty = q.difficulty || 'MEDIUM'; // Auto-detect or default
                    return `${i + 1}. ${qText} [${difficulty.toUpperCase()}]\n${optionsText}`;
                }).join('\n\n');

                setPastedText(formattedText);

                // Immediately parse to validate
                const initialResult = { ...data, examId: data.id };
                setParsedExam(initialResult);
            }
        } catch (err) {
            console.error('Failed to load exam:', err);
            alert('Failed to load exam data for editing.');
        } finally {
            setIsLoading(false);
        }
    };

    // Check for pending questions from Question Bank (Legacy - kept for compatibility)
    useEffect(() => {
        const pendingQuestions = sessionStorage.getItem('pending_exam_questions');
        if (pendingQuestions) {
            try {
                const questions = JSON.parse(pendingQuestions);
                // Convert questions back to the format the parser expects, or just manually build the parsedExam
                const formattedText = questions.map((q, i) => {
                    const optionsText = q.options.map((opt, optIdx) =>
                        `${String.fromCharCode(65 + optIdx)}) ${opt}${optIdx === q.correctAnswer ? '*' : ''}`
                    ).join('\n');
                    return `${i + 1}. ${q.text} [${q.difficulty.toUpperCase()}]\n${optionsText}`;
                }).join('\n\n');

                setPastedText(formattedText);
                setStep(2); // Jump to question step
                sessionStorage.removeItem('pending_exam_questions');
            } catch (err) {
                console.error('Failed to load pending questions:', err);
            }
        }
    }, []);

    const sampleInput = `1. Choose the correct plural form of the word "child". [EASY]
A) Childs
B) Childes
C) Children*
D) Childrens

2. Which of the following is a noun? [MEDIUM]
A) Quickly
B) Happiness*
C) Run
D) Blue

3. Choose the correct sentence. [MEDIUM]
A) She don't like rice.
B) She doesn't likes rice.
C) She doesn't like rice.*
D) She don't likes rice.

4. What is the opposite of the word "ancient"? [HARD]
A) Old
B) Modern*
C) Past
D) Former

5. Choose the correct spelling. [EASY]
A) Neccessary
B) Necesary
C) Necessary*
D) Nessessary`;

    const handleNext = () => {
        if (step === 1) {
            if (!examData.examId || !examData.title || !examData.subject || !examData.class) {
                alert('Please fill in all required fields (Exam ID, Title, Subject, Class)');
                return;
            }
        }
        if (step === 2 && !parsedExam) {
            alert('Please paste questions and click "Parse & Validate" first');
            return;
        }
        if (step === 3) {
            if (examData.questionsPerStudent > parsedExam.questions.length) {
                alert(`Questions per student cannot exceed total questions`);
                return;
            }
        }
        if (step < 4) setStep(step + 1);
    };

    const handleParse = () => {
        try {
            const questions = parseSimpleFormat(pastedText);
            if (questions.length === 0) throw new Error('No questions found');

            const result = {
                id: examData.examId,
                examId: examData.examId,
                version: '1.0.0',
                metadata: {
                    title: examData.title,
                    subject: examData.subject,
                    class: examData.class,
                    term: examData.term,
                    academicYear: examData.academicYear,
                    createdAt: examData.createdAt || new Date().toISOString(),
                    createdBy: examData.createdBy,
                    instructions: examData.instructions || 'Answer all questions.'
                },
                settings: {
                    duration: examData.duration,
                    totalMarks: questions.length,
                    passMark: examData.passMark,
                    webhookUrl: examData.webhookUrl || '',
                    shuffleQuestions: examData.shuffleQuestions,
                    shuffleOptions: examData.shuffleOptions,
                    showResults: examData.showResults,
                    allowReview: examData.allowReview,
                    autoSubmitOnViolation: true,
                    violationThreshold: 3,
                    strictMode: false,
                    questionsPerStudent: examData.questionsPerStudent
                },
                questions,
                active: examData.active
            };

            setParsedExam(result);
            setParseError('');
        } catch (error) {
            setParseError(error.message);
            setParsedExam(null);
        }
    };

    const handlePublish = async (activate = false) => {
        if (!parsedExam) {
            alert('Please parse and validate questions first');
            return;
        }

        setIsSubmitting(true);

        try {
            const finalExamData = {
                ...parsedExam,
                active: activate,
                metadata: {
                    ...parsedExam.metadata,
                    updatedAt: new Date().toISOString()
                }
            };

            const response = await api.createExam(finalExamData);

            if (response.success) {
                // Deduplicate and save to bank
                try {
                    const existingBank = await api.getQuestions();
                    const existingTexts = new Set(existingBank.questions.map(q => (q.questionText || q.text || '').toLowerCase().trim()));

                    const newQuestions = parsedExam.questions.filter(q => {
                        const qText = q.questionText || q.text || '';
                        return !existingTexts.has(qText.toLowerCase().trim());
                    }).map(q => ({
                        text: q.questionText || q.text, // Normalized for Bank API if it expects 'text' or 'questionText'
                        subject: parsedExam.metadata.subject,
                        class: parsedExam.metadata.class,
                        difficulty: q.difficulty,
                        options: q.options,
                        correctAnswer: q.correctAnswer
                    }));

                    if (newQuestions.length > 0) {
                        await api.saveQuestions(newQuestions);
                    }
                } catch (bankErr) {
                    console.error('Bank sync error:', bankErr);
                }

                alert(`✅ Exam ${activate ? 'published and activated' : 'saved as draft'} successfully!`);
                onNavigate('exams');
            } else {
                throw new Error(response.error || 'Failed to preserve exam');
            }
        } catch (error) {
            console.error('Publish error:', error);
            alert(`❌ Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenBank = async () => {
        if (!examData.class || !examData.subject) {
            alert('Please select Class and Subject in Step 1 first.');
            setStep(1);
            return;
        }
        setIsBankModalOpen(true);
        setBankLoading(true);
        try {
            const result = await api.getQuestions({
                class: examData.class,
                subject: examData.subject
            });
            setBankQuestions(result.questions.map(q => ({ ...q, selected: false })));
        } catch (err) {
            console.error('Bank load error:', err);
        } finally {
            setBankLoading(false);
        }
    };

    const handleImportSelected = () => {
        const selected = bankQuestions.filter(q => q.selected);
        if (selected.length === 0) return;

        // Determine starting number
        const matches = pastedText.match(/^\d+\./gm);
        let lastNum = 0;
        if (matches) {
            lastNum = Math.max(...matches.map(m => parseInt(m.split('.')[0])));
        }

        const newText = selected.map((q, i) => {
            let optionsText = '';
            // Handle options object vs array
            if (Array.isArray(q.options)) {
                optionsText = q.options.map((opt, optIdx) =>
                    `${String.fromCharCode(65 + optIdx)}) ${opt}${optIdx === q.correctAnswer ? '*' : ''}`
                ).join('\n');
            } else if (typeof q.options === 'object') {
                optionsText = ['A', 'B', 'C', 'D'].map(key => {
                    const isCorrect = key === q.correctAnswer;
                    return `${key}) ${q.options[key]}${isCorrect ? '*' : ''}`;
                }).join('\n');
            }

            const difficultyTag = q.difficulty ? ` [${q.difficulty.toUpperCase()}]` : '';
            const qText = q.questionText || q.text || 'Question Text Missing';
            return `${lastNum + i + 1}. ${qText}${difficultyTag}\n${optionsText}`;
        }).join('\n\n');

        setPastedText(prev => prev.trim() ? prev.trim() + '\n\n' + newText : newText);
        setIsBankModalOpen(false);
        alert(`Imported ${selected.length} questions.`);
    };

    // --- Sub-renderers for clean layout ---

    const renderExamDetails = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">1</span>
                Exam Details
            </h2>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Exam ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={examData.examId}
                            onChange={(e) => setExamData({ ...examData, examId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g., ENG-2025-001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={examData.title}
                            onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g., English First Term Examination"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={examData.subject}
                            onChange={(e) => setExamData({ ...examData, subject: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                        >
                            <option value="">Select subject</option>
                            {(globalSettings?.subjects || []).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Class <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={examData.class}
                            onChange={(e) => setExamData({ ...examData, class: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                        >
                            <option value="">Select class</option>
                            <option value="JSS 1">JSS 1</option>
                            <option value="JSS 2">JSS 2</option>
                            <option value="JSS 3">JSS 3</option>
                            <option value="SS 1">SS 1</option>
                            <option value="SS 2">SS 2</option>
                            <option value="SS 3">SS 3</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                        <select
                            value={examData.term}
                            onChange={(e) => setExamData({ ...examData, term: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                        >
                            <option>First Term</option>
                            <option>Second Term</option>
                            <option>Third Term</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duration (mins)</label>
                        <input
                            type="number"
                            value={examData.duration}
                            onChange={(e) => setExamData({ ...examData, duration: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pass Mark (%)</label>
                        <input
                            type="number"
                            value={examData.passMark}
                            onChange={(e) => setExamData({ ...examData, passMark: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                    <textarea
                        value={examData.instructions}
                        onChange={(e) => setExamData({ ...examData, instructions: e.target.value })}
                        placeholder="Enter exam instructions..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
        </div>
    );

    const renderQuestionSection = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">2</span>
                Question Editor
            </h2>

            <div className="mb-4 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPastedText(sampleInput)}
                        className="text-xs text-blue-700 hover:text-blue-800 font-bold px-3 py-1.5 bg-white rounded border border-blue-200 shadow-sm"
                    >
                        📄 Load Sample Format
                    </button>
                    <button
                        onClick={handleOpenBank}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md"
                    >
                        <BookOpen className="w-3 h-3" />
                        <span>Question Bank</span>
                    </button>
                </div>
                <div className="text-xs text-blue-600 font-medium italic">
                    Format: 1. Question? [Difficulty] Options A...D with * on correct.
                </div>
            </div>

            <div className="mb-4">
                <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your questions here..."
                    rows={isEditMode ? 20 : 15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm shadow-inner"
                />
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleParse}
                    className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black transition-all shadow-lg flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>Validate Questions</span>
                </button>
                {parsedExam && (
                    <span className="text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full border border-green-100">
                        ✓ {parsedExam.questions.length} Questions Verified
                    </span>
                )}
            </div>

            {parseError && (
                <div className="mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100 font-medium">
                    ⚠️ {parseError}
                </div>
            )}
        </div>
    );

    const renderConfigSection = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">3</span>
                Configuration & Logic
            </h2>

            <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Questions Per Student
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={examData.questionsPerStudent}
                            onChange={(e) => setExamData({ ...examData, questionsPerStudent: parseInt(e.target.value) })}
                            max={parsedExam?.questions.length || 100}
                            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                        />
                        <span className="text-sm text-gray-500">
                            out of {parsedExam?.questions.length || 0} total questions.
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={examData.shuffleQuestions}
                            onChange={(e) => setExamData({ ...examData, shuffleQuestions: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded mr-3"
                        />
                        <div>
                            <p className="text-sm font-bold text-gray-900">Shuffle Questions</p>
                            <p className="text-xs text-gray-500">Each student gets a different order</p>
                        </div>
                    </label>
                    <label className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={examData.shuffleOptions}
                            onChange={(e) => setExamData({ ...examData, shuffleOptions: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded mr-3"
                        />
                        <div>
                            <p className="text-sm font-bold text-gray-900">Shuffle Options</p>
                            <p className="text-xs text-gray-500">Randomize A, B, C, D order</p>
                        </div>
                    </label>
                </div>

                <label className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={examData.showResults}
                        onChange={(e) => setExamData({ ...examData, showResults: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded mr-3"
                    />
                    <div>
                        <p className="text-sm font-bold text-blue-900">Show Instant Results</p>
                        <p className="text-xs text-blue-700">Display score immediately after submission</p>
                    </div>
                </label>
            </div>
        </div>
    );

    const renderReviewSummary = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">4</span>
                Review & Save
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Exam Information</h3>
                    <div className="space-y-3">
                        <div>
                            <span className="text-xs text-gray-400 block">Title</span>
                            <span className="text-base font-bold text-gray-900">{parsedExam?.metadata.title || examData.title}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-400 block">Class</span>
                                <span className="text-sm font-medium text-gray-700">{examData.class}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block">Subject</span>
                                <span className="text-sm font-medium text-gray-700">{examData.subject}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Settings & Config</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-xs text-gray-400 block mb-1">Duration</span>
                            <span className="text-base font-bold text-gray-900">{examData.duration} <span className="text-xs font-normal text-gray-500">mins</span></span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-xs text-gray-400 block mb-1">Pass Mark</span>
                            <span className="text-base font-bold text-gray-900">{examData.passMark}<span className="text-xs font-normal text-gray-500">%</span></span>
                        </div>
                        <div className="col-span-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-400 block">Questions</span>
                                <span className="text-sm font-bold text-gray-900">
                                    {examData.questionsPerStudent} / {parsedExam?.questions.length || 0}
                                </span>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${parsedExam ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {parsedExam ? 'Verified' : 'Pending'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-gray-100">
                <button
                    onClick={() => handlePublish(false)}
                    disabled={isSubmitting || !parsedExam}
                    className="flex-1 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                    {isSubmitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                    onClick={() => handlePublish(true)}
                    disabled={isSubmitting || !parsedExam}
                    className="flex-[2] px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" />
                    <span>Publish Exam</span>
                </button>
            </div>
            {!parsedExam && (
                <p className="text-xs text-center mt-4 text-red-500 font-medium">
                    Please validate questions in Step 2 before publishing.
                </p>
            )}
        </div>
    );

    const renderBankModal = () => {
        if (!isBankModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border animate-in fade-in zoom-in duration-200">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Import Questions</h2>
                            <p className="text-xs text-gray-500 mt-1">Available for {examData.class} • {examData.subject}</p>
                        </div>
                        <button onClick={() => setIsBankModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search bank..."
                                value={bankSearch}
                                onChange={(e) => setBankSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        {bankLoading ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-3">
                                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                                <p className="text-sm font-medium text-gray-500">Searching bank...</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {bankQuestions
                                    .filter(q => (q.questionText || q.text || '').toLowerCase().includes(bankSearch.toLowerCase()))
                                    .map((q, idx) => {
                                        const difficultyColor = {
                                            'easy': 'bg-green-100 text-green-700 border-green-200',
                                            'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
                                            'hard': 'bg-red-100 text-red-700 border-red-200'
                                        }[q.difficulty?.toLowerCase()] || 'bg-gray-100 text-gray-500 border-gray-200';

                                        return (
                                            <div
                                                key={q.id || idx}
                                                className={`p-4 hover:bg-blue-50/50 cursor-pointer transition-all rounded-xl flex items-start gap-4 border-2 ${q.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'}`}
                                                onClick={() => {
                                                    setBankQuestions(prev => prev.map(item =>
                                                        item.id === q.id ? { ...item, selected: !item.selected } : item
                                                    ));
                                                }}
                                            >
                                                <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${q.selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                                    {q.selected && <Plus className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{q.questionText || q.text}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${difficultyColor}`}>
                                                            {q.difficulty || 'MEDIUM'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-bold">{Object.keys(q.options || {}).length} options</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {bankQuestions.length === 0 && (
                                    <div className="p-12 text-center">
                                        <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-500 font-bold">No questions found</p>
                                        <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or class selection</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t bg-gray-50/50 flex justify-between items-center">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider">
                            {bankQuestions.filter(q => q.selected).length} selected
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsBankModalOpen(false)}
                                className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-200 rounded-xl text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImportSelected}
                                disabled={!bankQuestions.some(q => q.selected)}
                                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Selected</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium tracking-wide">Loading exam data...</p>
                </div>
            </div>
        );
    }

    if (isEditMode) {
        return (
            <div className="flex-1 overflow-auto bg-gray-50">
                <div className="p-8 max-w-5xl mx-auto pb-32">
                    <div className="mb-8 flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Edit Exam</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                Updating <span className="text-blue-600">"{examData.title || 'Untitled'}"</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-black rounded-lg border border-orange-200 uppercase tracking-widest">
                                Editor View
                            </span>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {renderExamDetails()}
                        {renderQuestionSection()}
                        {renderConfigSection()}
                    </div>

                    {/* Fixed Bottom Review Bar for Edit Mode */}
                    <div className="fixed bottom-0 right-0 left-64 bg-white/80 backdrop-blur-md border-t p-6 z-40 shadow-2xl">
                        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
                            <div className="flex-1 grid grid-cols-3 gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Class</p>
                                    <p className="text-sm font-bold text-gray-700">{examData.class || '---'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</p>
                                    <p className="text-sm font-bold text-gray-700">{examData.subject || '---'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified Qs</p>
                                    <p className={`text-sm font-bold ${parsedExam ? 'text-green-600' : 'text-orange-500'}`}>
                                        {parsedExam?.questions.length || 0} Ready
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => onNavigate('exams')}
                                    className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handlePublish(false)}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black disabled:opacity-50 transition-all shadow-lg min-w-[140px]"
                                >
                                    {isSubmitting ? '...' : 'Save Draft'}
                                </button>
                                <button
                                    onClick={() => handlePublish(true)}
                                    disabled={isSubmitting || !parsedExam}
                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg min-w-[180px]"
                                >
                                    Publish & Activate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {renderBankModal()}
            </div>
        );
    }

    // Default: Multi-step Wizard View for Creating
    return (
        <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-8 max-w-4xl mx-auto pb-24">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Create New Exam</h1>
                    <p className="text-gray-500 font-medium mt-1">Step {step} of 4 • Configure your assessment</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex items-center space-x-3">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex-1">
                                <div className={`h-2.5 rounded-full transition-all duration-500 ${s <= step ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-200'}`} />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <span className={step >= 1 ? 'text-blue-600' : ''}>Details</span>
                        <span className={step >= 2 ? 'text-blue-600' : ''}>Questions</span>
                        <span className={step >= 3 ? 'text-blue-600' : ''}>Config</span>
                        <span className={step >= 4 ? 'text-blue-600' : ''}>Review</span>
                    </div>
                </div>

                {/* Step Rendering */}
                <div className="mb-8">
                    {step === 1 && renderExamDetails()}
                    {step === 2 && renderQuestionSection()}
                    {step === 3 && renderConfigSection()}
                    {step === 4 && renderReviewSummary()}
                </div>

                {/* Wizard Navigation */}
                <div className="flex justify-between items-center mt-12 bg-white/50 backdrop-blur p-4 rounded-2xl border border-gray-100">
                    <button
                        onClick={() => step > 1 && setStep(step - 1)}
                        disabled={step === 1}
                        className="px-8 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        ← Previous
                    </button>

                    <div className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">
                        {step < 4 ? `Up Next: ${['Questions', 'Configuration', 'Review'][step - 1]}` : 'Ready to Launch'}
                    </div>

                    {step < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={step === 2 && !parsedExam}
                            className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
                        >
                            Continue →
                        </button>
                    ) : null}
                </div>
            </div>

            {renderBankModal()}
        </div>
    );
};

export default CreateExam;
