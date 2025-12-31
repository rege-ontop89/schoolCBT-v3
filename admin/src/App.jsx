import React, { useState, createContext, useContext, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, FileText, BookOpen, Settings as SettingsIcon, LogOut, User, FileCheck, RefreshCw } from 'lucide-react';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import api from './services/api';

// Import pages
import Dashboard from './pages/Dashboard';
import CreateExam from './pages/CreateExam';
import AllExams from './pages/AllExams';
import ExamDetails from './pages/ExamDetails';
import QuestionBank from './pages/QuestionBank';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

// Auth Context
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('cbt_admin_user');
        if (storedUser) setUser(JSON.parse(storedUser));
        setIsLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const result = await api.login(username, password);
            if (result.success) {
                const userData = {
                    ...result.user,
                    lastActivity: Date.now()
                };
                setUser(userData);
                localStorage.setItem('cbt_admin_user', JSON.stringify(userData));
                return { success: true };
            }
            return { success: false, error: 'Invalid credentials' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUserState = (newUserData) => {
        const updated = { ...user, ...newUserData };
        setUser(updated);
        localStorage.setItem('cbt_admin_user', JSON.stringify(updated));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('cbt_admin_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUserState, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

// ... LoginPage component (unchanged) ...
const LoginPage = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const result = await login(username, password);
            if (!result.success) {
                setError(result.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 primary-bg">
                        <FileCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">SchoolCBT Admin</h1>
                    <p className="text-gray-600 mt-2">Sign in to manage exams</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Enter username"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Enter password"
                        />
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 primary-bg primary-bg-hover flex items-center justify-center space-x-2"
                    >
                        {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                    </button>
                </form>

            </div>
        </div>
    );
};

// Sidebar Component
const Sidebar = ({ currentPage, onNavigate }) => {
    const { user, logout } = useAuth();
    const { settings } = useSettings();

    const schoolName = settings?.school?.name || "SchoolCBT";
    const logoUrl = settings?.school?.logoPath ? `http://localhost:3001${settings.school.logoPath}` : null;

    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'create', icon: PlusCircle, label: 'Create Exam' },
        { id: 'exams', icon: FileText, label: 'All Exams' },
        { id: 'bank', icon: BookOpen, label: 'Question Bank' },
        { id: 'settings', icon: SettingsIcon, label: 'Settings', role: 'Admin' },
    ];

    const filteredMenuItems = menuItems.filter(item => !item.role || item.role === user.role);

    return (
        <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center primary-bg overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <FileCheck className="w-6 h-6 text-white" />
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <h2 className="font-bold text-gray-900 truncate">{schoolName}</h2>
                        <p className="text-xs text-gray-500">CBT Admin</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {filteredMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentPage === item.id
                                ? 'bg-primary-light text-primary'
                                : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${currentPage === item.id ? 'text-primary' : ''}`} />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="px-4 pb-2 border-t border-gray-100">
                <button
                    onClick={() => onNavigate('profile')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mt-2 transition-colors ${currentPage === 'profile'
                        ? 'bg-primary-light text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <User className={`w-5 h-5 ${currentPage === 'profile' ? 'text-primary' : ''}`} />
                    <span className="font-medium text-sm">View Profile</span>
                </button>
            </div>

            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
};

// Utility to generate color shades
const getShade = (hex, factor) => {
    // Simple hex to shade logic (darken/lighten)
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));

    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Main App Component with Settings Context
const AppContent = () => {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [selectedExamId, setSelectedExamId] = useState(null);
    const { user, updateUserState, isLoading: authLoading } = useAuth();
    const { settings, loading: settingsLoading } = useSettings();

    const handleNavigate = (page, examId = null) => {
        setCurrentPage(page);
        setSelectedExamId(examId);
    };

    // Inject dynamic styles
    const primaryColor = settings?.school?.primaryColor || '#3b82f6';
    const primaryHover = getShade(primaryColor, 0.85);
    const primaryLight = `${primaryColor}15`; // 15% opacity

    const dynamicStyles = `
        :root {
            --primary-color: ${primaryColor};
            --primary-color-hover: ${primaryHover};
            --primary-color-light: ${primaryLight};
        }
        .primary-bg { background-color: var(--primary-color) !important; }
        .primary-bg-hover:hover { background-color: var(--primary-color-hover) !important; }
        .primary-text { color: var(--primary-color) !important; }
        .bg-primary-light { background-color: var(--primary-color-light) !important; }
        .text-primary { color: var(--primary-color) !important; }
        .focus\\:ring-primary:focus { --tw-ring-color: var(--primary-color) !important; }
        
        /* Override common Blue classes to respect Primary color */
        .bg-blue-600 { background-color: var(--primary-color) !important; }
        .hover\\:bg-blue-700:hover { background-color: var(--primary-color-hover) !important; }
        .text-blue-600 { color: var(--primary-color) !important; }
        .bg-blue-50 { background-color: var(--primary-color-light) !important; }
        .border-blue-600 { border-color: var(--primary-color) !important; }
    `;

    useEffect(() => {
        const styleTag = document.getElementById('dynamic-theme-styles') || document.createElement('style');
        styleTag.id = 'dynamic-theme-styles';
        styleTag.innerHTML = dynamicStyles;
        if (!document.getElementById('dynamic-theme-styles')) {
            document.head.appendChild(styleTag);
        }
    }, [primaryColor, dynamicStyles]);

    // Session Management & Activity Tracking
    const { logout } = useAuth();

    useEffect(() => {
        if (!user) return;

        const checkSession = () => {
            const storedUser = JSON.parse(localStorage.getItem('cbt_admin_user'));
            if (!storedUser) return;

            const now = Date.now();
            const inactiveTime = now - (storedUser.lastActivity || now);
            const TIMEOUT = 30 * 60 * 1000; // 30 minutes

            if (inactiveTime > TIMEOUT) {
                logout();
            }
        };

        const updateActivity = () => {
            const storedUser = JSON.parse(localStorage.getItem('cbt_admin_user'));
            if (storedUser) {
                storedUser.lastActivity = Date.now();
                localStorage.setItem('cbt_admin_user', JSON.stringify(storedUser));
            }
        };

        const interval = setInterval(checkSession, 60000); // Check every minute
        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keypress', updateActivity);
        window.addEventListener('click', updateActivity);

        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keypress', updateActivity);
            window.removeEventListener('click', updateActivity);
        };
    }, [user, logout]);

    if (authLoading || settingsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4 primary-text" />
                    <p className="text-gray-600">Loading system...</p>
                </div>
            </div>
        );
    }

    if (!user) return <LoginPage />;

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard user={user} onNavigate={handleNavigate} />;
            case 'create':
                return <CreateExam examId={selectedExamId} onNavigate={handleNavigate} user={user} />;
            case 'exams':
                return <AllExams onNavigate={handleNavigate} />;
            case 'details':
                return <ExamDetails examId={selectedExamId} onBack={() => handleNavigate('exams')} />;
            case 'bank':
                return <QuestionBank />;
            case 'settings':
                return user.role === 'Admin' ? <Settings user={user} /> : <Dashboard user={user} onNavigate={handleNavigate} />;
            case 'profile':
                return <Profile user={user} onUpdate={updateUserState} />;
            default:
                return <Dashboard user={user} onNavigate={handleNavigate} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
            {renderPage()}
        </div>
    );
};

// Export wrapped with Providers
const Main = () => (
    <AuthProvider>
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
    </AuthProvider>
);

export default Main;
