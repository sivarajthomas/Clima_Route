import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/apiservice';

type Settings = {
  temperatureUnit: 'C' | 'F';
  distanceUnit: 'km' | 'mi';
  timeFormat: '12' | '24';
  language: string;
};

const defaultSettings: Settings = {
  temperatureUnit: 'C',
  distanceUnit: 'km',
  timeFormat: '24',
  language: 'en-US'
};

const SettingsContext = createContext<{
  settings: Settings;
  setSettings: (s: Partial<Settings>) => Promise<void>;
}>({ settings: defaultSettings, setSettings: async () => {} });

export const SettingsProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setLocalSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem('clima_settings');
      if (raw) return JSON.parse(raw);
    } catch {}
    return defaultSettings;
  });

  useEffect(() => {
    (async () => {
      try {
        if (user?.email) {
          const s: any = await apiService.getUserSettings(user.email);
          if (s) {
            const mapped = {
              temperatureUnit: (s.TemperatureUnit || s.temperatureUnit || 'C') === 'F' ? 'F' : 'C',
              distanceUnit: (s.DistanceUnit || s.distanceUnit || 'km') === 'mi' ? 'mi' : 'km',
              timeFormat: (s.TimeFormat || s.timeFormat || '24') === '12' ? '12' : '24',
              language: s.Language || s.language || 'en-US'
            } as Settings;
            setLocalSettings(mapped);
            localStorage.setItem('clima_settings', JSON.stringify(mapped));
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [user?.email]);

  const setSettings = async (s: Partial<Settings>) => {
    const merged = { ...settings, ...s };
    setLocalSettings(merged);
    localStorage.setItem('clima_settings', JSON.stringify(merged));
    // persist to backend when user logged in
    try {
      if (user?.email) {
        await apiService.updateUserSettings(user.email, {
          TemperatureUnit: merged.temperatureUnit,
          DistanceUnit: merged.distanceUnit,
          TimeFormat: merged.timeFormat,
          Language: merged.language
        });
      }
    } catch (e) {
      console.error('Failed to persist settings', e);
    }
  };

  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

// Helpers
export function convertTemp(valueC: number, toUnit: 'C' | 'F') {
  if (toUnit === 'C') return Math.round(valueC * 10) / 10;
  return Math.round(((valueC * 9) / 5 + 32) * 10) / 10;
}

export function convertDistance(km: number, toUnit: 'km' | 'mi') {
  if (toUnit === 'km') return Math.round(km * 10) / 10;
  return Math.round((km * 0.621371) * 10) / 10;
}

export function formatTime(date: Date, format: '12' | '24') {
  if (format === '24') {
    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' });
}
