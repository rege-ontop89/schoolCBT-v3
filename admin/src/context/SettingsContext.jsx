import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refreshSettings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getSettings();
            setSettings(data);
            setError(null);

            // Update document title if school name exists
            if (data?.school?.name) {
                document.title = `${data.school.name} | CBT Admin`;
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshSettings();
    }, [refreshSettings]);

    const updateSettingsState = (newSettings) => {
        setSettings(newSettings);
        if (newSettings?.school?.name) {
            document.title = `${newSettings.school.name} | CBT Admin`;
        }
    };

    const value = {
        settings,
        loading,
        error,
        refreshSettings,
        updateSettingsState
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
