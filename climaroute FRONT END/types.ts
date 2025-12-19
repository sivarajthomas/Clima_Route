
export interface RouteSegment {
  id: string;
  name: string;
  roadType: string;
  currentSpeed: number;
  recommendedSpeed: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface NotificationItem {
  id: string;
  category: 'Critical' | 'Route' | 'Status' | 'System' | 'General';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export interface DeliveryRecord {
  id: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  weather: string;
  status: 'Completed' | 'In Progress' | 'Delayed' | 'Pending';
  distance: string;
  duration: string;
}

export interface WeatherForecastItem {
  time: string;
  temp: number;
  condition: 'Sunny' | 'Cloudy' | 'Rain' | 'Storm' | 'Fog';
}

export interface DailyForecastItem {
  day: string;
  min: number;
  max: number;
  condition: 'Sunny' | 'Cloudy' | 'Rain' | 'Storm' | 'Fog';
}

export interface SpeedDataPoint {
  time: string;
  speed: number;
  optimized: number;
}

export interface RestPointItem {
  id: string;
  name: string;
  type: string;
  distance: string;
  safetyRating: 'High' | 'Medium' | 'Low';
  facilities: string[];
  coordinates?: { lat: number; lng: number };
}
