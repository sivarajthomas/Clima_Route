import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/apiservice';

type BackgroundContextType = {
  bgUrl: string | null;
  condition: string | null;
};

const BackgroundContext = createContext<BackgroundContextType>({ bgUrl: null, condition: null });

export const BackgroundProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [condition, setCondition] = useState<string | null>(null);

  const mapConditionToAsset = (cond: string | undefined) => {
    const c = (cond || '').toLowerCase();
    // Use Vite-compatible dynamic URL
    if (c.includes('rain') || c.includes('storm') || c.includes('drizzle')) return new URL('../components/rainy sky.jpg', import.meta.url).href;
    if (c.includes('cloud') || c.includes('overcast') || c.includes('fog')) return new URL('../components/cloudy sky.jpg', import.meta.url).href;
    return new URL('../components/sky.jpg', import.meta.url).href;
  };

  const fetchAndSet = async () => {
    try {
      const w = await apiService.getWeatherForecast();
      const cond = w?.current?.condition || w?.current?.condition_text || null;
      setCondition(cond);
      const url = mapConditionToAsset(cond);
      setBgUrl(url);
    } catch (e) {
      // ignore; keep existing background
    }
  };

  useEffect(() => {
    fetchAndSet();
    const id = setInterval(fetchAndSet, 1000 * 60 * 60); // hourly
    return () => clearInterval(id);
  }, []);

  return <BackgroundContext.Provider value={{ bgUrl, condition }}>{children}</BackgroundContext.Provider>;
};

export const useBackground = () => useContext(BackgroundContext);
