import { fmtUC } from './utils';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';

// AI Components
import FeatureCard from './components/FeatureCard';
import AiSolveScreen from './components/AiSolveScreen';
import AiTutorScreen from './components/AiTutorScreen';
import SmartScheduleScreen from './components/SmartScheduleScreen';
import AiVisionScreen from './components/AiVisionScreen';
import DocumentMarketScreen from './components/DocumentMarketScreen';
import ErrandMarketScreen from './components/ErrandMarketScreen';
import ProductMarketScreen from './components/ProductMarketScreen';
import RideMarketScreen from './components/RideMarketScreen';
import PersonalMarketScreen from './components/PersonalMarketScreen';
import ImageCropperModal from './components/ImageCropperModal';
import AdminScreen from './components/AdminScreen';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
const PRIMARY_COLOR = "#4F46E5";
const PRIMARY_HOVER = "#4338CA";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    // Dòng thần thánh giúp xuyên qua màn hình cảnh báo của Ngrok
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json"
  }
});

// BI�U TƯỢNG CẢM X�aC (SVG outline thay emoji)
const REACTION_ICONS = {
  'LIKE': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  ),
  'HAHA': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  'SAD': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  'ANGRY': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <path d="M7.5 8.5 9 10" /><path d="M16.5 8.5 15 10" />
    </svg>
  ),
};
// Backward compat cho REACTION_EMOJIS dùng text
const REACTION_EMOJIS = { 'LIKE': '👍', 'HAHA': '😆', 'SAD': '😢', 'ANGRY': '😡' };

// === SVG OUTLINE ICONS ===
export const Icons = {
  Sun: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  AlertTriangle: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Cpu: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Play: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Home: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  BookOpen: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  ShoppingBag: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  MapPin: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Bell: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  MessageCircle: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Search: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Calendar: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Brain: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Mic: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  School: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 9 12 4 2 9l10 5 10-5zm0 0v6" /><path d="M6 10.6V16a6 6 0 0 0 12 0v-5.4" />
    </svg>
  ),
  User: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Users: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Rocket: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  ChevronRight: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronDown: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Settings: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Zap: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Package: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Bike: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
    </svg>
  ),
  Edit: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Target: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  FileText: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Paperclip: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  DollarSign: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Award: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  Send: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Camera: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Globe: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Filter: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  ImageIcon: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Target: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Home: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Star: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Phone: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  User: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  ArrowDownCircle: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  ),
  ArrowUpCircle: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </svg>
  ),
  Check: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Store: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Building: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M16 10h.01M8 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  ),
  CreditCard: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Flame: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  MapPin: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  RefreshCw: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Sparkles: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4M3 5h4" />
    </svg>
  ),
  CheckCircle: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 8 12 14 8 11" />
    </svg>
  ),
  Trash: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </svg>
  ),
  Eye: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Clock: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Printer: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Coffee: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  LogOut: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Image: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Send: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Share: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Link: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  ThumbsUp: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  ),
  Smile: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  MoreHorizontal: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
    </svg>
  ),
  Edit: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Eye: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Trash: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  X: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Menu: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Coin: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" /><path d="M15 9H9a2 2 0 0 0 0 4h6a2 2 0 0 1 0 4H8" />
    </svg>
  ),
  UC: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor" stroke="none">UC</text>
    </svg>
  ),
  Zap: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Clock: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Plus: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

// --- HìM TI� N ÍCH ---
const formatTimeAgo = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

const formatChatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const isSameYear = date.getFullYear() === now.getFullYear();
  const isSameDay = isSameYear && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  if (isSameDay) return timeStr;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  return isSameYear ? `${day}/${month} ${timeStr}` : `${day}/${month}/${date.getFullYear()} ${timeStr}`;
};

const renderContentWithLinks = (text) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold underline hover:opacity-80 break-all" style={{ color: '#4F46E5', textDecoration: 'underline' }}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const formatTaskDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatQnuTime = (timeInfo) => {
  if (!timeInfo) return "";
  const match = timeInfo.match(/(\d+)\s*\((.*?)\)->(\d+)\s*\((.*?)\)/);
  if (match) {
    let startT = match[2].replace('g', ':');
    let endT = match[4].replace('g', ':');
    return `${startT} - ${endT} (Tiết ${match[1]}-${match[3]})`;
  }
  return timeInfo;
};

const processTimeInfo = (timeInfo) => {
  if (!timeInfo) return { start: 99, end: 99 };
  const m = timeInfo.match(/(\d+)\s*\((.*?)\)->(\d+)\s*\((.*?)\)/);
  if (m) return { start: parseInt(m[1]), end: parseInt(m[3]) };
  const m2 = timeInfo.match(/(\d+)\s*\(/);
  return m2 ? { start: parseInt(m2[1]), end: parseInt(m2[1]) } : { start: 99, end: 99 };
};

const removeAccents = (str) => { return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''; };
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const UserAvatar = ({ user, size = "w-10 h-10", textSize = "text-lg", onClick }) => {
  const cursorClass = onClick ? 'cursor-pointer' : '';
  if (user?.avatarUrl) return <img onClick={onClick} src={user.avatarUrl} alt="avatar" className={`${size} rounded-full object-cover border border-slate-200 ${cursorClass}`} />;
  return <div onClick={onClick} className={`${size} bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold ${textSize} uppercase ${cursorClass}`}>{user?.fullName ? user.fullName[0] : user?.username?.[0] || '?'}</div>;
};

const getActiveStatus = (lastActiveDate, showActivity) => {
  if (!showActivity) return { text: '', isOnline: false };
  if (!lastActiveDate) return { text: '', isOnline: false };
  const diffMinutes = Math.floor((new Date() - new Date(lastActiveDate)) / 60000);
  if (diffMinutes < 3) return { text: 'Đang hoạt động', isOnline: true };
  if (diffMinutes < 60) return { text: `Hoạt động ${diffMinutes} phút trước`, isOnline: false };
  if (diffMinutes < 1440) return { text: `Hoạt động ${Math.floor(diffMinutes / 60)} giờ trước`, isOnline: false };
  return { text: `Hoạt động ${Math.floor(diffMinutes / 1440)} ngày trước`, isOnline: false };
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) { recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = 'vi-VN'; }


// ==========================================
// APP CHÍNH (USER BRNH THƯSNG)
// ==========================================
const getInitialUrlState = () => {
  const hash = window.location.hash.replace('#', '') || 'campus-feed';
  const parts = hash.split('/');
  return { tab: parts[0], sub: parts[1] || null };
};

function App() {
  const initNav = getInitialUrlState();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('universe_user')) || null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', fullName: '', major: '' });
  const [authError, setAuthError] = useState('');

  // UI States
  const [activeTab, setActiveTab] = useState(initNav.tab);
  const [activeAiScreen, setActiveAiScreen] = useState(null);
  const [studySubView, setStudySubView] = useState(initNav.tab === 'study' ? initNav.sub : null); // 'schedule', 'quiz', 'live-class'
  const [scheduleTab, setScheduleTab] = useState('qnu'); // 'qnu' or 'smart'
  const [showAiTutorFloat, setShowAiTutorFloat] = useState(false);
  const [aiTutorMinimized, setAiTutorMinimized] = useState(false);
  const [aiTutorTucked, setAiTutorTucked] = useState(false);
  const [coins, setCoins] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [panicMode, setPanicMode] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [qnuDropdownOpen, setQnuDropdownOpen] = useState(false);
  const [showCheckInWarning, setShowCheckInWarning] = useState(false);

  // ===== H  THỐNG POPUP TH NG BÁO ĐẸP =====
  const [globalAlert, setGlobalAlert] = useState(null); // { msg, type: 'success'|'error'|'info'|'warning' }
  const [globalConfirm, setGlobalConfirm] = useState(null); // { msg, resolve }
  const [globalPrompt, setGlobalPrompt] = useState(null); // { msg, defaultVal, resolve }
  const [promptInputVal, setPromptInputVal] = useState('');

  const showAlert = (msg, type = 'info') => {
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    setGlobalAlert({ msg, type });
  };
  const showConfirm = (msg) => {
    return new Promise((resolve) => {
      setGlobalConfirm({ msg, resolve });
    });
  };
  const showPrompt = (msg, defaultVal = '') => {
    return new Promise((resolve) => {
      setPromptInputVal(defaultVal);
      setGlobalPrompt({ msg, defaultVal, resolve });
    });
  };
  const popupProps = { showAlert, showConfirm, showPrompt };


  // Cropper States
  const [cropperImage, setCropperImage] = useState(null);
  const [cropperField, setCropperField] = useState(null);
  const [cropperAspect, setCropperAspect] = useState(1);

  // L9ch sử tìm kiếm
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('universe_recent_searches')) || []; }
    catch (e) { return []; }
  });
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchInputRef = useRef(null);

  // States Dữ li!u
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingPosts, setViewingPosts] = useState([]);
  const [viewingHidden, setViewingHidden] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [expandedComments, setExpandedComments] = useState({});
  const [newCommentTexts, setNewCommentTexts] = useState({});
  const [replyingTo, setReplyingTo] = useState({});
  const [shareModalData, setShareModalData] = useState(null);
  const [shareText, setShareText] = useState("");
  const [activeReactionPopup, setActiveReactionPopup] = useState(null);
  const [newPostImage, setNewPostImage] = useState(null);
  const [newPostImageFile, setNewPostImageFile] = useState(null);
  const [newChatImage, setNewChatImage] = useState(null);
  const [activeMsgReact, setActiveMsgReact] = useState(null);
  const [openPostMenu, setOpenPostMenu] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [chatRefItem, setChatRefItem] = useState(null);
  // HELPER: Lấy tên hiển thị cho các loại item khác nhau
  const getRefTitle = (item, type) => {
    if (!item) return 'Không rõ';
    if (item.title) return item.title;
    if (item.name) return item.name;
    if (type === 'RIDE' && item.departure) return `${item.departure} → ${item.destination}`;
    return 'Sản phẩm';
  };

  const [chatRefType, setChatRefType] = useState(null);
  const [showTransHistory, setShowTransHistory] = useState(false);
  const [transHistoryData, setTransHistoryData] = useState([]);
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [showRefDetailModal, setShowRefDetailModal] = useState(false);
  const [acceptedOfferIds, setAcceptedOfferIds] = useState(new Set());
  const [rejectedOfferIds, setRejectedOfferIds] = useState(new Set());
  const [marketRefreshKey, setMarketRefreshKey] = useState(0);
  const messagesEndRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newPostContent, setNewPostContent] = useState("");

  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [isDraftingId, setIsDraftingId] = useState(null);

  // Thêm States cho QNU TKB
  const [qnuSchedules, setQnuSchedules] = useState([]);
  const [showQnuLogin, setShowQnuLogin] = useState(false);
  const [qnuForm, setQnuForm] = useState({ username: '', password: '' });
  const [isSyncingQnu, setIsSyncingQnu] = useState(false);
  const [qnuSyncError, setQnuSyncError] = useState('');
  const [qnuFilterDay, setQnuFilterDay] = useState("Hôm nay");
  const [qnuViewMode, setQnuViewMode] = useState("list");

  const [market, setMarket] = useState([]);
  const [marketTab, setMarketTab] = useState(initNav.tab === 'market' ? (initNav.sub || 'NOTES') : 'NOTES');
  const [showMarketMenu, setShowMarketMenu] = useState(false);

  const [liveTranscript, setLiveTranscript] = useState("Vui lòng bật Mic và bắt đầu nói...");
  const [isDictating, setIsDictating] = useState(false);
  const [hasPaidTranscript, setHasPaidTranscript] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrOutput, setOcrOutput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.showActivity) {
      const interval = setInterval(() => { socket.emit('ping_active', user.id); }, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id, user?.showActivity]);

  // --- Đồng bộ thay đổi Hash vào trạng thái React ---
  useEffect(() => {
    const handlePopState = () => {
      const state = getInitialUrlState();
      setActiveTab(state.tab);
      if (state.tab === 'market') setMarketTab(state.sub || 'NOTES');
      if (state.tab === 'study') setStudySubView(state.sub || null);
    };
    window.addEventListener('hashchange', handlePopState);
    return () => window.removeEventListener('hashchange', handlePopState);
  }, []);

  // --- Push trạng thái React vào URL Hash ---
  useEffect(() => {
    const currentHash = window.location.hash.replace('#', '');
    let newHash = activeTab;
    if (activeTab === 'market') {
      newHash += `/${marketTab}`;
    } else if (activeTab === 'study' && studySubView) {
      newHash += `/${studySubView}`;
    }

    if (currentHash !== newHash) {
      // Dùng pushState để tạo record lịch sử hỗ trợ Back/Forward tránh render liên tục
      window.history.pushState(null, '', `#${newHash}`);
    }
  }, [activeTab, marketTab, studySubView]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      setCoins(user.coins);
      socket.emit('register_user', user.id);
      fetchData(); fetchFriends(); fetchProfileInfo();
    }
    const handleReceiveMessage = (msg) => {
      if (activeChat && (msg.senderId === activeChat.id || msg.receiverId === activeChat.id)) { setMessages(prev => [...prev, msg]); }
      fetchFriends();
    };
    const handleReceiveNotif = (notif) => { setNotifications(prev => [notif, ...prev]); };
    const handleReceiveTranscript = (text) => setLiveTranscript(prev => prev + " " + text);
    const handleUserStatusChange = () => fetchFriends();

    socket.on('receive_message', handleReceiveMessage);
    socket.on('new_notification', handleReceiveNotif);
    socket.on('live_transcript_receive', handleReceiveTranscript);
    socket.on('user_status_change', handleUserStatusChange);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('new_notification', handleReceiveNotif);
      socket.off('live_transcript_receive', handleReceiveTranscript);
      socket.off('user_status_change', handleUserStatusChange);
    }
  }, [user?.id, activeChat?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleLogout = () => { localStorage.clear(); window.location.replace('/'); };

  if (user && user.role === 'ADMIN') return <AdminScreen user={user} onLogout={handleLogout} />;

  const fetchData = async () => {
    if (!user) return;
    try {
      const [p, t, n, m, qnu] = await Promise.all([
        axios.get(`/api/posts?userId=${user.id}`),
        axios.get(`/api/tasks/${user.id}`),
        axios.get(`/api/notifications/${user.id}`),
        axios.get(`/api/market`),
        axios.get(`/api/qnu/schedules/${user.id}`)
      ]);
      setPosts(p.data || []);
      setTasks(t.data || []);
      setNotifications(n.data || []);
      setMarket(m.data || []);
      if (qnu.data.success) {
        setQnuSchedules(qnu.data.data || []);
      }
    } catch (err) { }
  };
  const fetchFriends = async () => { if (!user) return; try { const res = await axios.get(`/api/friends/${user.id}`); setFriends(res.data.friends || []); setPendingRequests(res.data.pendingRequests || []); setSentRequests(res.data.sentRequests || []); } catch (err) { } };
  const fetchProfileInfo = async () => { if (!user) return; try { const res = await axios.get(`/api/users/${user.id}/profile`); setProfileForm(res.data.profile); setUser(prev => { if (!prev || !localStorage.getItem('universe_user')) return null; const up = { ...prev, ...res.data.profile }; localStorage.setItem('universe_user', JSON.stringify(up)); return up; }); } catch (e) { } };

  const handleImageUploadLocal = async (file) => {
    if (!file) return null; const formData = new FormData(); formData.append('image', file);
    try { const res = await axios.post('/api/upload', formData); return res.data.url; } catch (err) { return null; }
  }

  const toggleDictation = () => {
    if (!recognition) return showAlert("Trình duyệt không hỗ trợ.");
    if (isDictating) { recognition.stop(); setIsDictating(false); } else { setLiveTranscript(""); recognition.start(); setIsDictating(true); recognition.onresult = (event) => { let finalTranscript = ''; for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' '; } if (finalTranscript) { socket.emit('live_transcript_send', finalTranscript); setLiveTranscript(prev => prev + " " + finalTranscript); } }; recognition.onerror = (e) => { setIsDictating(false); if (e.error === 'not-allowed') showAlert("Cấp quyền Mic!"); }; recognition.onend = () => { if (isDictating) recognition.start(); }; }
  };

  const handleAddPost = async (e) => { e.preventDefault(); if (!newPostContent.trim() && !newPostImage) return; let imageUrl = null; if (newPostImageFile) imageUrl = await handleImageUploadLocal(newPostImageFile); await axios.post('/api/posts', { content: newPostContent, userId: user.id, imageUrl }); setNewPostContent(""); setNewPostImage(null); setNewPostImageFile(null); fetchData(); if (activeTab === 'user-profile') openUserProfile(user.id); };
  const handleReport = async (targetType, targetId) => {
    const reason = await showPrompt("Nhập lý do báo cáo:");
    if (!reason) return;
    try {
      await axios.post('/api/reports', { reporterId: user.id, targetType, targetId, reason });
      showAlert('Đã gửi báo cáo thành công! Cảm ơn bạn.', 'success');
    } catch (e) { showAlert('Lỗi khi gửi báo cáo: ' + e.message, 'error'); }
  };
  popupProps.onReport = handleReport;

  const handleDeletePost = async (postId) => { if (window.confirm("Xóa bài viết này vĩnh viễn?")) { await axios.delete(`/api/posts/${postId}`); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); } };
  const handleEditPostSubmit = async (postId) => { await axios.put(`/api/posts/${postId}`, { content: editPostContent }); setEditingPostId(null); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); };
  const handleHidePost = async (postId) => { await axios.post(`/api/posts/${postId}/hide`, { userId: user.id }); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); };
  const handleReactPost = async (e, postId, type) => { e.stopPropagation(); await axios.post(`/api/posts/${postId}/react`, { userId: user.id, type }); setActiveReactionPopup(null); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); };
  const handleLikeComment = async (commentId) => { await axios.post(`/api/comments/${commentId}/like`, { userId: user.id }); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); };
  const handleCommentSubmit = async (e, postId) => { e.preventDefault(); const content = newCommentTexts[postId]; if (!content?.trim()) return; await axios.post(`/api/posts/${postId}/comment`, { userId: user.id, content, parentId: replyingTo[postId] || null }); setNewCommentTexts({ ...newCommentTexts, [postId]: "" }); setReplyingTo({ ...replyingTo, [postId]: null }); fetchData(); if (activeTab === 'user-profile') openUserProfile(viewingProfile.id); };
  const handleShareSubmit = async () => { if (!shareModalData) return; const postUrl = `http://localhost:3000/post/${shareModalData.id}`; const finalContent = `${shareText}\n\n--- ️ Chia sẻ bài viết của ${shareModalData.user.fullName || shareModalData.user.username} ---\n${postUrl}\n\n"${shareModalData.content}"`; await axios.post('/api/posts', { content: finalContent, userId: user.id }); setShareModalData(null); setShareText(""); fetchData(); showAlert("Đã chia sẻ lên Bảng tin!"); };
  const handleShareToMessenger = (friendId, friendName) => { const postUrl = `http://localhost:3000/post/${shareModalData.id}`; const shareContent = `Hãy xem bài viết này:\n${postUrl}\n\n"${shareModalData.content}"`; socket.emit('private_message', { senderId: user.id, receiverId: friendId, content: shareContent }); setShareModalData(null); showAlert(`Đã gửi cho ${friendName}!`); fetchFriends(); };
  const copyPostLink = (postId) => { navigator.clipboard.writeText(`http://localhost:3000/post/${postId}`); showAlert("Đã sao chép liên kết!"); };

  const handleAddTask = async (e) => { e.preventDefault(); if (!newTaskDate) return showAlert("Chọn hạn nộp!"); await axios.post('/api/tasks', { title: newTaskTitle, dueDate: newTaskDate, color: `border-indigo-500`, userId: user.id }); setNewTaskTitle(""); setNewTaskDate(""); fetchData(); };
  const handleLMSScan = async () => { const res = await axios.post('/api/tasks/scan-lms', { userId: user.id }); fetchData(); showAlert(res.data.message); };

  // Hàm xử lý đồng bộ TKB QNU
  const handleQnuSync = async (e) => {
    e.preventDefault();
    setQnuSyncError('');
    setIsSyncingQnu(true);

    try {
      const res = await axios.post('/api/qnu/sync', { 
        userId: user.id, 
        username: qnuForm.username, 
        password: qnuForm.password 
      }, { timeout: 60000 }); // 60s timeout cho Playwright

      if (res.data.success) {
        showAlert(res.data.message, "success");
        setShowQnuLogin(false);
        fetchData(); // Refresh UI
      } else {
        setQnuSyncError(res.data.message || 'Lỗi đồng bộ. Kiểm tra lại tài khoản.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setQnuSyncError('⏱️ Quá thời gian chờ - trang QNU đang chậm hoặc không thể truy cập từ mạng hiện tại. Thông tin đã được lưu, hệ thống sẽ tự đồng bộ lúc 00:00.');
      } else if (errMsg?.includes('ket noi') || errMsg?.includes('truy cap') || errMsg?.includes('503')) {
        setQnuSyncError('🌐 ' + errMsg);
      } else {
        setQnuSyncError(errMsg || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSyncingQnu(false);
    }
  };

  const handleDraftToAction = async (id) => { setIsDraftingId(id); try { await axios.post(`/api/tasks/${id}/draft`); fetchData(); } catch (err) { } setIsDraftingId(null); };
  const handleDeleteTask = async (id) => { await axios.delete(`/api/tasks/${id}`); fetchData(); };

  const handleMarketChat = (itemAuthor, refItem, predefinedMsg, refType) => {
    openChat(itemAuthor, refItem, refType);
    if (predefinedMsg) setNewMessageContent(predefinedMsg);
  };
  const handleBuyItem = async (item) => { if (coins < item.reward) return showAlert("Không đủ UC!"); const res = await axios.post('/api/market/buy', { itemId: item.id, buyerId: user.id }); if (res.data.success) { setCoins(res.data.newCoinBalance); fetchData(); showAlert("Thanh toán thành công!"); } else { showAlert(res.data.message); } };
  const handleMarketGPSPost = async (type) => {
    if (!navigator.geolocation) return showAlert("Không hỗ trợ GPS");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const loc = await showPrompt('Nhập địa điểm bạn đang đứng (VD: Canteen Khu B, Thư viện...):');
      if (!loc) return;
      try {
        if (type === 'ERRAND') {
          const content = `📍 Mình hiện đang ở [${loc}] và có nhận chạy vặt nha! (Trạng thái tự động cập nhật qua định vị hệ thống). Ai cần mua gì trên trường nhắn mình nhé! #CampusShipper`;
          await axios.post('/api/posts', { content, userId: user.id });
          fetchData();
          showAlert("Đã bật tín hiệu nhận đơn thành công!");
        } else if (type === 'RIDE') {
          const content = `📍 Mình hiện đang ở [${loc}] và có xe tự do. (Trạng thái tự động cập nhật qua định vị hệ thống). Ai cần đi chung hay mua cháo gì nhắn gửi mình nhé!`;
          await axios.post('/api/posts', { content, userId: user.id });
          fetchData();
          showAlert("Đã tải trạng thái tìm khách thành công!");
        }
      } catch (err) {
        showAlert("Lỗi khi đăng trạng thái!");
      }
    }, (err) => showAlert("Vui lòng cấp quyền GPS trên trình duyệt để sử dụng tính năng này!"));
  };
  const handleScanImage = async () => { if (!selectedImage) return showAlert("Chọn ảnh bài giảng!"); setIsOcrLoading(true); setOcrOutput("AI đang quét..."); const formData = new FormData(); formData.append('image', selectedImage); try { const res = await axios.post('/api/ai/ocr', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); setOcrOutput(res.data.output); } catch (error) { setOcrOutput("Lỗi!"); } finally { setIsOcrLoading(false); } };

  const handleAuthSubmit = async (e) => { e.preventDefault(); setAuthError(''); try { const res = await axios.post(`${authMode === 'login' ? '/api/auth/login' : '/api/auth/register'}`, authForm); if (res.data.success) { setUser(res.data.user); localStorage.setItem('universe_user', JSON.stringify(res.data.user)); } else { setAuthError(res.data.message); } } catch (err) { } };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    // Đọc file ảnh dưới dạng Data URL để load vào cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImage(reader.result);
      setCropperField(field);
      setCropperAspect(field === 'avatarUrl' ? 1 : 16 / 9);
    };
    reader.readAsDataURL(file);

    // Reset input file value to allow choosing the same file again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob) => {
    setCropperImage(null);
    setIsUploading(true);

    // Convert Blob to File object to send to backend
    const file = new File([croppedBlob], `${cropperField}_${Date.now()}.jpg`, { type: "image/jpeg" });
    const url = await handleImageUploadLocal(file);

    if (url) {
      setProfileForm(prev => ({ ...prev, [cropperField]: url }));
      showAlert(`Đã tải ảnh ${cropperField === 'avatarUrl' ? 'đại diện' : 'bìa'} lên thành công! Nhấn Lưu Hồ Sơ để hoàn tất.`);
    } else {
      showAlert("Lỗi khi tải ảnh lên!");
    }

    setIsUploading(false);
    setCropperField(null);
  };

  const handleUpdateProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      // Bỏ qua các field nội bộ hoặc relationship có thể làm crash hàm Prisma Update
      const { id, createdAt, lastActive, role, coins, password, username, friends, posts, comments, reactions, schedules, marketItems, ...validData } = profileForm;
      const res = await axios.put(`/api/users/${user.id}`, validData);
      if (res.data.success) {
        setUser({ ...user, ...res.data.user });
        localStorage.setItem('universe_user', JSON.stringify({ ...user, ...res.data.user }));
        setShowProfileEditModal(false);
        showAlert("Đã lưu hồ sơ thành công!");
        fetchData();
        if (activeTab === 'user-profile') openUserProfile(user.id);
      } else {
        showAlert(res.data.message || "Lỗi khi cập nhật hồ sơ!");
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi hệ thống khi cập nhật hồ sơ (Có thể dữ liệu không hợp lệ!).");
    }
  };
  const openUserProfile = async (userId) => {
    setSearchQuery("");
    setSearchResults([]);
    setShowMobileSearch(false);
    setShowMobileMenu(false);
    setShowRecentSearches(false);
    setActiveTab('user-profile');
    setViewingHidden(false);
    try { const res = await axios.get(`/api/users/${userId}/profile`); setViewingProfile(res.data.profile); setViewingPosts(res.data.posts || []); } catch (error) { }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setShowRecentSearches(q.length === 0);

    if (q.length > 1) {
      const res = await axios.get(`/api/users/search?q=${q}`);
      setSearchResults(res.data.filter(u => u.id !== user.id));
    } else {
      setSearchResults([]);
    }
  };

  const saveRecentSearch = (queryOrUser) => {
    if (!queryOrUser) return;
    const isUserObj = typeof queryOrUser === 'object';
    const label = isUserObj ? (queryOrUser.fullName || queryOrUser.username) : queryOrUser.trim();
    if (!label) return;

    let updatedSearches = [label, ...recentSearches.filter(s => s !== label)].slice(0, 10);
    setRecentSearches(updatedSearches);
    localStorage.setItem('universe_recent_searches', JSON.stringify(updatedSearches));
  };

  const handleRecentSearchClick = (query) => {
    setSearchQuery(query);
    setShowRecentSearches(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      // Tự động gọi API tìm kiếm
      const event = { target: { value: query } };
      handleSearch(event);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('universe_recent_searches');
  };

  const handleAddFriend = async (friendId) => { await axios.post('/api/friends/request', { userId: user.id, friendId }); showAlert("Đã gửi lời mời!"); setSearchQuery(""); setSearchResults([]); fetchFriends(); };
  const handleAcceptFriend = async (reqId) => { await axios.put('/api/friends/accept', { reqId }); fetchFriends(); };
  const handleDeclineFriend = async (reqId) => { await axios.delete(`/api/friends/decline/${reqId}`); fetchFriends(); };

  const openChat = async (friend, refItem = null, refType = null) => {
    setActiveChat(friend);
    setChatRefItem(refItem);
    setChatRefType(refType);
    setShowTransHistory(false);
    setShowChatSettings(false);
    socket.emit('mark_as_read', { userId: user.id, friendId: friend.id });
    const params = refItem && refType ? `?refType=${refType}&refId=${refItem.id}` : '';
    const res = await axios.get(`/api/messages/${user.id}/${friend.id}${params}`);
    setMessages(res.data || []);
    fetchFriends();
  };
  const loadTransHistory = async (friendId) => {
    try {
      const res = await axios.get(`/api/messages/${user.id}/${friendId}/transactions`);
      if (res.data.success) setTransHistoryData(res.data.transactions);
    } catch (e) { }
  };
  const sendMessage = async (e) => {
    e.preventDefault(); if (!newMessageContent.trim() && !newChatImage) return;
    let imageUrl = null; if (newChatImage) imageUrl = await handleImageUploadLocal(newChatImage);
    const msgData = {
      senderId: user.id, receiverId: activeChat.id, content: newMessageContent, imageUrl,
      referenceId: chatRefItem ? chatRefItem.id : undefined,
      referenceType: chatRefType || undefined
    };
    socket.emit('private_message', msgData);
    setMessages(prev => [...prev, { ...msgData, id: Date.now(), createdAt: new Date().toISOString() }]);
    setNewMessageContent(""); setNewChatImage(null); fetchFriends();
  };

  const sendOffer = async (e) => {
    e.preventDefault();
    if (!offerPrice || isNaN(offerPrice) || Number(offerPrice) <= 0) return showAlert('Vui lòng nhập giá hợp lệ!', 'warning');
    const title = chatRefItem?.title || 'sản phẩm';
    const content = `__OFFER__:${offerPrice}:${title}`;
    const msgData = {
      senderId: user.id, receiverId: activeChat.id, content,
      referenceId: chatRefItem?.id, referenceType: chatRefType
    };
    socket.emit('private_message', msgData);
    setMessages(prev => [...prev, { ...msgData, id: Date.now(), createdAt: new Date().toISOString() }]);
    setOfferPrice(''); setShowOfferInput(false); fetchFriends();
  };

  const handleAcceptOffer = async (msg) => {
    const parts = msg.content.replace('__OFFER__:', '').split(':');
    const price = parts[0];
    try {
      if (chatRefType === 'DOCUMENT' && chatRefItem) {
        const myRole = chatRefItem.authorId === user.id ? 'seller' : 'buyer';
        const partnerRole = myRole === 'seller' ? 'buyer' : 'seller';
        // Xác nhận phía mình
        await axios.post(`/api/documents/confirm-sale/${chatRefItem.id}`, {
          userId: user.id, role: myRole, partnerId: activeChat.id
        });
        // Xác nhận phía đối tác (họ đã đồng ý khi gửi đề xuất)
        try {
          await axios.post(`/api/documents/confirm-sale/${chatRefItem.id}`, {
            userId: activeChat.id, role: partnerRole, partnerId: user.id
          });
        } catch (_) { /* nếu đã xác nhận rồi thì bỏ qua */ }
      } else if (chatRefType === 'ERRAND' && chatRefItem) {
        await axios.put(`/api/errands/complete/${chatRefItem.id}`, { requesterId: user.id });
      }
      // Đánh dấu offer đã được chấp nhận locally
      setAcceptedOfferIds(prev => new Set([...prev, msg.id]));
      // Buộc marketplace re-fetch để ẩn sản phẩm đã bán
      setMarketRefreshKey(k => k + 1);
      // Gửi tin nhắn xác nhận
      const acceptMsg = { senderId: user.id, receiverId: activeChat.id, content: `__OFFER_ACCEPTED__:${price}:${chatRefItem?.title}`, referenceId: chatRefItem?.id, referenceType: chatRefType };
      socket.emit('private_message', acceptMsg);
      setMessages(prev => [...prev, { ...acceptMsg, id: Date.now(), createdAt: new Date().toISOString() }]);
      showAlert(`Đã chốt đơn ${fmtUC(price)} UC! Giao dịch hoàn tất.`, 'success');
      setChatRefItem(null); setChatRefType(null);
    } catch (err) { showAlert(err.response?.data?.message || 'Lỗi xác nhận!', 'error'); }
  };

  const handleRejectOffer = (msgId) => {
    setRejectedOfferIds(prev => new Set([...prev, msgId]));
    const rejectMsg = { senderId: user.id, receiverId: activeChat.id, content: `__OFFER_REJECTED__`, referenceId: chatRefItem?.id, referenceType: chatRefType };
    socket.emit('private_message', rejectMsg);
    setMessages(prev => [...prev, { ...rejectMsg, id: Date.now(), createdAt: new Date().toISOString() }]);
  };
  const handleReactMessage = async (msgId, type) => { await axios.post(`/api/messages/${msgId}/react`, { userId: user.id, type }); const res = await axios.get(`/api/messages/${user.id}/${activeChat.id}`); setMessages(res.data || []); setActiveMsgReact(null); };
  const handleCheckIn = () => {
    if (!user.schoolLat || !user.schoolLng || !user.schoolName) {
      setShowCheckInWarning(true);
      return;
    }

    if (!navigator.geolocation) return showAlert("Trình duyệt không hỗ trợ GPS.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await axios.post('/api/users/checkin', {
            userId: user.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setCoins(res.data.coins);
          showAlert(res.data.message);
        } catch (err) {
          showAlert(err.response?.data?.message || "Lỗi máy chủ khi điểm danh.");
        }
      },
      (err) => showAlert("Vui lòng bật quyền truy cập Vị trí (GPS) trên thiết bị/trình duyệt của bạn!")
    );
  };

  // --- Click Thông báo nhảy tới Bài viết ---
  const handleNotifClick = (notif) => {
    setShowNotif(false);
    if (notif.type === 'RIDE_MATCH_SUGGESTION') {
      // Điến thẳng tab Chuyến xe
      setActiveTab('market');
      setActiveMarketTab('RIDE');
      return;
    }
    if (notif.postId) {
      setActiveTab('campus-feed');
      setTimeout(() => {
        const postElement = document.getElementById(`post-${notif.postId}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          postElement.classList.add('ring-4', 'ring-indigo-500', 'transition-all', 'duration-500');
          setTimeout(() => postElement.classList.remove('ring-4', 'ring-indigo-500'), 2000);
        } else { showAlert("Không tìm thấy bài viết (Có thể đã bị xóa/ẩn)."); }
      }, 300);
    }
  };

  const unreadNotifs = notifications.filter(n => !n.isRead).length;
  const unreadMsgs = friends.filter(f => f.latestMessage && !f.latestMessage.isRead && f.latestMessage.senderId !== user.id).length;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50 font-sans px-4 relative overflow-hidden">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-[400px] border border-indigo-100 z-10">
          <div className="text-center mb-6"><h1 className="text-4xl font-black text-indigo-600 flex items-center justify-center gap-2">🚀 UniVerse</h1><p className="text-gray-500 mt-2 text-sm">Hệ sinh thái thông minh cho sinh viên</p></div>
          <div className="flex bg-indigo-50 rounded-lg p-1 mb-6"><button className={`flex-1 py-2 font-bold text-sm transition rounded ${authMode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`} onClick={() => setAuthMode('login')}>Đăng Nhập</button><button className={`flex-1 py-2 font-bold text-sm transition rounded ${authMode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`} onClick={() => setAuthMode('register')}>Đăng Ký</button></div>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'register' && (<><input type="text" placeholder="Họ và Tên" required className="w-full bg-gray-50 border border-transparent focus:border-rose-600 p-3 rounded-lg outline-none text-black" value={authForm.fullName} onChange={e => setAuthForm({ ...authForm, fullName: e.target.value })} /><input type="text" placeholder="Lớp / Chuyên ngành" required className="w-full bg-gray-50 border border-transparent focus:border-rose-600 p-3 rounded-lg outline-none text-black" value={authForm.major} onChange={e => setAuthForm({ ...authForm, major: e.target.value })} /></>)}
            <input type="text" placeholder="Tên đăng nhập" required className="w-full bg-gray-50 border border-transparent focus:border-rose-600 p-3 rounded-lg outline-none text-black" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
            <input type="password" placeholder="Mật khẩu" required className="w-full bg-gray-50 border border-transparent focus:border-rose-600 p-3 rounded-lg outline-none text-black" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
            {authError && <p className="text-red-500 text-sm font-bold text-center">{authError}</p>}
            <button type="submit" className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-[15px] uppercase tracking-wider transition shadow-lg">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
          </form>
        </div>
      </div>
    );
  }

  const MENU_ITEMS = [
    { id: 'campus-feed', icon: <Icons.Home className="w-5 h-5" />, label: 'Bảng tin' },
    { id: 'study-manager', icon: <Icons.BookOpen className="w-5 h-5" />, label: 'Quản lý học tập' },
    { id: 'market', icon: <Icons.ShoppingBag className="w-5 h-5" />, label: 'Chợ sinh viên' }
  ];

  const MARKET_TABS = [
    { id: 'NOTES', icon: <Icons.BookOpen className="w-4 h-4" />, label: 'Tài liệu' },
    { id: 'ERRAND', icon: <Icons.Zap className="w-4 h-4" />, label: 'Mua hộ' },
    { id: 'PRODUCT', icon: <Icons.Package className="w-4 h-4" />, label: 'Đồ cũ' },
    { id: 'RIDE', icon: <Icons.Bike className="w-4 h-4" />, label: 'Đi xe chung' },
    { id: 'PERSONAL', icon: <Icons.User className="w-4 h-4" />, label: 'Quản lý' }
  ];

  let currentPostsToRender = activeTab === 'user-profile' ? viewingPosts : posts;
  if (activeTab === 'user-profile' && viewingProfile?.id === user.id) { currentPostsToRender = viewingHidden ? viewingPosts.filter(p => p.isHidden) : viewingPosts.filter(p => !p.isHidden); }
  else if (activeTab === 'user-profile') { currentPostsToRender = viewingPosts.filter(p => !p.isHidden); }
  // Ẩn bài viết quá 3 ngày trên bảng tin chính
  if (activeTab === 'campus-feed') {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    currentPostsToRender = currentPostsToRender.filter(p => new Date(p.createdAt) >= threeDaysAgo);
  }

  const filteredTasks = (tasks || []).filter(t => removeAccents(t.title).includes(removeAccents(taskSearchQuery)));
  const filteredMarket = (market || []).filter(m => m.category === marketTab);
  const filteredMessages = messages.filter(m => removeAccents(m.content).includes(removeAccents(chatSearchQuery)));

  const renderComments = (commentList, postId, isReply = false) => {
    return commentList.map(cmt => {
      const hasLikedCmt = cmt.likes?.some(l => l.userId === user.id);
      return (
        <div key={cmt.id} className={`flex gap-2 mb-3 ${isReply ? 'ml-10 mt-2' : ''}`}>
          <UserAvatar user={cmt.user} size="w-8 h-8" textSize="text-xs" onClick={() => openUserProfile(cmt.user.id)} />
          <div className="flex flex-col w-full">
            <div className={`px-3 py-2 rounded-2xl max-w-fit ${panicMode ? 'bg-slate-700 text-gray-200' : 'bg-[#F0F2F5] text-black'}`}>
              <p className="font-bold text-[13px] leading-tight cursor-pointer hover:underline" onClick={() => openUserProfile(cmt.user.id)}>{cmt.user.fullName || cmt.user.username}</p>
              <p className="text-[14px] leading-snug">{cmt.content}</p>
            </div>
            <div className="flex items-center gap-3 ml-2 mt-1 text-[11px] font-bold text-gray-500">
              <span>{formatTimeAgo(cmt.createdAt)}</span>
              <span className={`cursor-pointer hover:underline ${hasLikedCmt ? 'text-indigo-600' : ''}`} onClick={() => handleLikeComment(cmt.id)}>Thích {cmt.likes?.length > 0 ? `(${cmt.likes.length})` : ''}</span>
              <span className="cursor-pointer hover:underline" onClick={() => { setReplyingTo({ ...replyingTo, [postId]: cmt.id }); setTimeout(() => document.getElementById(`comment-input-${postId}`)?.focus(), 100); }}>Phản hồi</span>
            </div>
            {cmt.replies && cmt.replies.length > 0 && renderComments(cmt.replies, postId, true)}
          </div>
        </div>
      );
    });
  };

  return (
    <div className={`h-screen overflow-hidden ${panicMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans`}>
      {/* ===== HEADER ===== */}
      <header className={`h-14 w-full fixed top-0 flex items-center justify-between px-4 z-40 shadow-sm ${panicMode ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-200'}`}>
        <div className="flex items-center gap-2 lg:w-[240px]">
          {!showMobileSearch && (
            <div onClick={() => setActiveTab('campus-feed')} className="w-9 h-9 border-2 border-slate-900 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 hover:bg-slate-900 hover:text-white transition-all group">
              <Icons.Rocket className="w-5 h-5" />
            </div>
          )}
          {!showMobileSearch && <span onClick={() => setActiveTab('campus-feed')} className="font-black text-[17px] tracking-tight cursor-pointer hidden sm:block select-none" style={{ letterSpacing: '-0.5px' }}>UniVerse</span>}
          <div className={`relative z-50 flex-1 ${showMobileSearch ? 'block w-full' : 'hidden md:block'}`}>
            <div className="flex items-center gap-2">
              {showMobileSearch && <button onClick={() => setShowMobileSearch(false)} className="text-slate-500 p-1"><Icons.ChevronRight className="w-5 h-5 rotate-180" /></button>}
              <div className="relative w-full">
                <input
                  type="text"
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={handleSearch}
                  onFocus={() => { if (searchQuery.length === 0) setShowRecentSearches(true); }}
                  onBlur={() => { setTimeout(() => setShowRecentSearches(false), 200); }}
                  placeholder="Tìm tên, lớp..."
                  autoFocus={showMobileSearch}
                  className={`rounded-full pl-9 pr-4 py-2 text-[14px] outline-none w-full md:w-[220px] border transition-all ${panicMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-100 text-slate-900 border-transparent focus:border-indigo-300 focus:bg-white'}`}
                />
                <Icons.Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>
            {showRecentSearches && recentSearches.length > 0 && searchQuery.length === 0 && (
              <div className={`absolute top-12 left-0 w-full md:w-[300px] border shadow-xl rounded-2xl p-2 z-50 ${panicMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between items-center mb-2 px-2">
                  <span className="font-semibold text-sm text-slate-500">Gần đây</span>
                  <button onClick={clearRecentSearches} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">Xóa tất cả</button>
                </div>
                {recentSearches.map((search, idx) => (
                  <div key={idx} onClick={() => handleRecentSearchClick(search)} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500"><Icons.Clock className="w-3.5 h-3.5" /></div>
                    <span className="text-sm font-medium flex-1 truncate">{search}</span>
                    <button onClick={(e) => { e.stopPropagation(); setRecentSearches(recentSearches.filter(s => s !== search)); localStorage.setItem('universe_recent_searches', JSON.stringify(recentSearches.filter(s => s !== search))); }} className="text-slate-300 hover:text-slate-500 px-2 py-1"><Icons.X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {searchResults.length > 0 && (
              <div className={`absolute top-12 left-0 w-full md:w-[300px] border shadow-xl rounded-2xl p-2 z-50 ${panicMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                {searchResults.map(s => (
                  <div key={s.id} className={`flex justify-between items-center p-2 rounded-xl ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => { saveRecentSearch(s); openUserProfile(s.id); }}>
                      <UserAvatar user={s} size="w-9 h-9" />
                      <div><p className="text-sm font-semibold leading-tight">{s.fullName || s.username}</p><p className="text-[11px] text-slate-500">{s.major || 'Sinh viên'}</p></div>
                    </div>
                    {!friends.find(f => f.id === s.id) && !pendingRequests.find(r => r.id === s.id) && (
                      <button onClick={(e) => { e.stopPropagation(); saveRecentSearch(s); handleAddFriend(s.id); }} className="text-xs bg-indigo-50 px-2.5 py-1.5 rounded-lg font-semibold text-indigo-600 hover:bg-indigo-100">Kết bạn</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {!showMobileSearch && <button onClick={() => setShowMobileSearch(true)} className="md:hidden w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center"><Icons.Search className="w-4 h-4 text-slate-500" /></button>}
        </div>

        {!showMobileSearch && (
          <div className="flex items-center gap-1.5 justify-end lg:w-[240px]">
            {/* Chat button */}
            <div className="relative">
              <button onClick={() => { setShowMessageDropdown(!showMessageDropdown); setShowNotif(false); setShowProfileDropdown(false); }} className={`w-9 h-9 rounded-full flex items-center justify-center transition relative ${panicMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <Icons.MessageCircle className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                {unreadMsgs > 0 && <span className="badge">{unreadMsgs}</span>}
              </button>
              {showMessageDropdown && (
                <div className={`fixed top-14 left-0 w-full h-[calc(100vh-56px)] md:absolute md:top-full md:right-0 md:left-auto md:w-[360px] md:h-auto md:max-h-[80vh] md:mt-2 md:rounded-2xl shadow-2xl md:border p-2 z-50 overflow-y-auto flex flex-col ${panicMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                  <div className="flex justify-between items-center p-3 border-b md:border-none border-slate-100">
                    <h4 className="font-bold text-xl">Chat</h4>
                    <button className="md:hidden w-8 h-8 bg-slate-100 rounded-full font-bold text-slate-600 flex items-center justify-center" onClick={() => setShowMessageDropdown(false)}><Icons.X className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-2 flex-1">
                    {friends.length === 0 ? <p className="p-4 text-center text-slate-400 text-sm">Chưa có bạn bè</p> : friends.map(friend => {
                      const lastMsg = friend.latestMessage; const isMe = lastMsg?.senderId === user.id;
                      const status = getActiveStatus(friend.lastActive, friend.showActivity);
                      return (
                        <div key={friend.id} onClick={() => { openChat(friend); setShowMessageDropdown(false); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                          <div className="relative">
                            <UserAvatar user={friend} size="w-11 h-11" />
                            {status.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className={`font-semibold text-[15px] ${!isMe && lastMsg && !lastMsg.isRead ? (panicMode ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>{friend.fullName || friend.username}</h4>
                            <p className={`text-[13px] truncate ${!isMe && lastMsg && !lastMsg.isRead ? 'font-semibold text-indigo-600' : 'text-slate-400'}`}>{lastMsg ? (isMe ? `Bạn: ${lastMsg.content}` : lastMsg.content) : 'Bắt đầu trò chuyện'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] text-slate-400">{lastMsg ? formatTimeAgo(lastMsg.createdAt) : ''}</span>
                            {lastMsg && !isMe && !lastMsg.isRead && <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notification button */}
            <div className="relative">
              <button onClick={() => { setShowNotif(!showNotif); setShowMessageDropdown(false); setShowProfileDropdown(false); socket.emit('mark_notif_read', user.id); }} className={`w-9 h-9 rounded-full flex items-center justify-center relative transition ${panicMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <Icons.Bell className="w-[18px] h-[18px]" />
                {unreadNotifs > 0 && <span className="badge">{unreadNotifs}</span>}
              </button>
              {showNotif && (
                <div className={`fixed top-14 left-0 w-full h-[calc(100vh-56px)] md:absolute md:top-full md:right-0 md:left-auto md:w-[360px] md:h-auto md:max-h-[80vh] md:mt-2 md:rounded-2xl shadow-2xl md:border p-2 z-50 overflow-y-auto ${panicMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                  <div className="flex justify-between items-center p-3 border-b md:border-none border-slate-100">
                    <h4 className="font-bold text-xl">Thông báo</h4>
                    <button className="md:hidden w-8 h-8 bg-slate-100 rounded-full font-bold text-slate-600 flex items-center justify-center" onClick={() => setShowNotif(false)}><Icons.X className="w-4 h-4" /></button>
                  </div>
                  {notifications.length === 0 ? <p className="p-4 text-center text-slate-400 text-sm">Trống.</p> : notifications.map(n => (
                    <div key={n.id} onClick={() => handleNotifClick(n)} className={`flex items-start gap-3 p-3 rounded-xl border-b border-slate-100 cursor-pointer ${!n.isRead ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} ${n.type === 'RIDE_MATCH_SUGGESTION' ? '!bg-emerald-50/60 border-emerald-100' : ''} ${panicMode ? 'border-slate-700 hover:bg-slate-700' : ''}`}>
                      {n.type === 'RIDE_MATCH_SUGGESTION'
                        ? <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center text-xl flex-shrink-0">🚗</div>
                        : <UserAvatar user={n.sourceUser || { fullName: 'Hệ thống' }} size="w-11 h-11" textSize="text-sm" onClick={(e) => { e.stopPropagation(); if (n.sourceUser) openUserProfile(n.sourceUserId); }} />
                      }
                      <div className="flex-1">
                        {n.type === 'RIDE_MATCH_SUGGESTION'
                          ? <p className="text-[13px] leading-snug font-medium text-emerald-800">{n.content}</p>
                          : <p className="text-[14px] leading-snug"><span className="font-semibold">{n.sourceUser?.fullName || n.sourceUser?.username || 'Hệ thống'}</span> {n.content}</p>
                        }
                        <p className="text-[11px] font-semibold mt-1 ${n.type === 'RIDE_MATCH_SUGGESTION' ? 'text-emerald-600' : 'text-indigo-600'}">{formatTimeAgo(n.createdAt)}</p>
                        {n.type === 'RIDE_MATCH_SUGGESTION' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNotifClick(n); }}
                            className="mt-2 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition"
                          >
                            Xem chuyến ngay →
                          </button>
                        )}
                        {n.type === 'SOCIAL' && n.content.includes('gửi lời mời') && n.sourceUserId && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={(e) => { e.stopPropagation(); handleAcceptFriend(pendingRequests.find(r => r.id === n.sourceUserId)?.reqId); }} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-700">Chấp nhận</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile button - desktop */}
            <div className="relative hidden md:block">
              <div onClick={() => { setShowProfileDropdown(!showProfileDropdown); setShowNotif(false); setShowMessageDropdown(false); }} className="cursor-pointer hover:opacity-80 transition relative">
                <UserAvatar user={user} size="w-9 h-9" />
                <span className="absolute bottom-0 right-0 bg-slate-100 border border-slate-200 rounded-full w-4 h-4 flex items-center justify-center text-slate-600">
                  <Icons.ChevronDown className="w-2.5 h-2.5" />
                </span>
              </div>
              {showProfileDropdown && (
                <div className={`fixed top-14 left-0 w-full h-[calc(100vh-56px)] md:absolute md:top-full md:right-0 md:left-auto md:w-[260px] md:h-auto md:mt-2 md:rounded-2xl shadow-2xl md:border p-3 z-50 ${panicMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                  <div onClick={() => { openUserProfile(user.id); setShowProfileDropdown(false); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 shadow-sm border border-slate-100 mb-3 ${panicMode ? 'border-slate-700 hover:bg-slate-700' : ''}`}>
                    <UserAvatar user={user} size="w-11 h-11" textSize="text-xl" />
                    <div><h4 className="font-semibold text-[15px] leading-tight">{user.fullName || user.username}</h4><p className="text-[12px] text-slate-400">Xem trang cá nhân</p></div>
                  </div>

                  <hr className="my-2 border-slate-100" />
                  <div onClick={() => setPanicMode(!panicMode)} className={`p-2.5 flex items-center gap-3 font-semibold cursor-pointer rounded-xl text-[14px] ${panicMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <Icons.Zap className="w-4 h-4" /> {panicMode ? "Tắt Panic Mode" : "Bật Panic Mode"}
                  </div>
                  <div onClick={() => { setShowProfileEditModal(true); setShowProfileDropdown(false); }} className={`p-2.5 flex items-center gap-3 font-semibold cursor-pointer rounded-xl text-[14px] ${panicMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <Icons.Settings className="w-4 h-4" /> Chỉnh sửa hồ sơ
                  </div>
                  <div onClick={handleLogout} className={`p-2.5 flex items-center gap-3 font-semibold cursor-pointer rounded-xl text-[14px] text-red-500 ${panicMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'}`}>
                    <Icons.LogOut className="w-4 h-4" /> Đăng xuất
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ===== MAIN LAYOUT: 3 CỘT ===== */}
      <div className="flex mt-14 h-[calc(100vh-3.5rem)] w-full">
        {/* CỘT TRÁI - Sidebar Navigation (20%) */}
        <aside className={`w-[220px] xl:w-[240px] flex-shrink-0 p-3 hidden md:flex flex-col overflow-y-auto hover-scrollbar border-r ${panicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {/* User avatar small */}
          <div onClick={() => openUserProfile(user.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-3 ${panicMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
            <UserAvatar user={user} size="w-9 h-9" />
            <span className="font-semibold text-[14px] truncate">{user.fullName || user.username}</span>
          </div>
          {/* Navigation items */}
          {MENU_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 w-full text-left p-3 rounded-xl transition ${activeTab === item.id ? 'bg-indigo-50 text-indigo-700 font-bold' : (panicMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50 font-medium')}`}>
              <div className={`${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <span className="text-[15px]">{item.label}</span>
            </button>
          ))}
          <hr className={`my-3 ${panicMode ? 'border-slate-700' : 'border-slate-100'}`} />
          <p className="text-slate-400 text-[11px] font-bold px-3 mb-2 uppercase tracking-wider">PHÍM TẮT</p>
          <button onClick={handleCheckIn} className={`flex items-center gap-3 w-full text-left p-3 rounded-xl transition ${panicMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
            <div className="text-slate-400">
              <Icons.MapPin className="w-5 h-5" />
            </div>
            <span className="text-[15px]">Check-in tại Lớp</span>
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto flex justify-center px-0 md:px-4 py-0 md:py-4 pb-20 md:pb-6 bg-transparent relative">
          <div className="w-full max-w-[620px]">

            {activeTab === 'campus-feed' && (
              <div className="space-y-3 pt-2 sm:pt-0">
                {/* Form Đăng bài */}
                <div className={`p-4 rounded-2xl shadow-sm ${panicMode ? 'bg-slate-800' : 'bg-white'}`}>
                  <form onSubmit={handleAddPost}>
                    <div className="flex gap-3 mb-3">
                      <UserAvatar user={user} />
                      <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)} placeholder={`${user.fullName || user.username} ơi, bạn đang nghĩ gì thế?`} className={`flex-1 rounded-2xl px-4 py-3 outline-none text-[14px] resize-none border ${panicMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-transparent focus:border-indigo-200 focus:bg-white'} transition`} rows="1"></textarea>
                    </div>
                    {newPostImage && (
                      <div className="relative mb-3 w-28 h-28">
                        <img src={newPostImage} className="w-full h-full object-cover rounded-xl border border-slate-200" alt="upload" />
                        <button type="button" onClick={() => { setNewPostImage(null); setNewPostImageFile(null); }} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full w-5 h-5 flex items-center justify-center"><Icons.X className="w-3 h-3" /></button>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                      <label className="cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition text-slate-500">
                        <Icons.Image className="w-5 h-5" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) { setNewPostImageFile(e.target.files[0]); setNewPostImage(URL.createObjectURL(e.target.files[0])); } }} />
                      </label>
                      <button type="submit" disabled={!newPostContent.trim() && !newPostImage} className="bg-indigo-600 disabled:bg-indigo-300 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition">Đăng bài</button>
                    </div>
                  </form>
                </div>

                {currentPostsToRender.map(post => {
                  const isOwner = post.userId === user.id;
                  const myReaction = post.reactions?.find(r => r.userId === user.id);
                  const showComments = expandedComments[post.id];
                  const uniqueReactions = [...new Set(post.reactions?.map(r => r.type) || [])];

                  return (
                    <div id={`post-${post.id}`} key={post.id} className={`rounded-2xl shadow-sm mb-3 ${panicMode ? 'bg-slate-800' : 'bg-white'}`}>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => openUserProfile(post.user.id)}>
                            <UserAvatar user={post.user} />
                            <div>
                              <p className={`font-semibold text-[14px] hover:underline leading-tight ${panicMode ? 'text-white' : 'text-slate-900'}`}>{post.user.fullName || post.user.username}</p>
                              <p className="text-[11px] text-slate-400">{formatTimeAgo(post.createdAt)} {post.user.major ? `⬢ ${post.user.major}` : ''}</p>
                            </div>
                          </div>
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenPostMenu(openPostMenu === post.id ? null : post.id); }} className={`text-slate-400 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center ${panicMode ? 'hover:bg-slate-700' : ''}`}><Icons.MoreHorizontal className="w-4 h-4" /></button>
                            {openPostMenu === post.id && (
                              <>
                                <div className="fixed inset-0 z-[9]" onClick={() => setOpenPostMenu(null)} />
                                <div className={`absolute right-0 mt-1 w-36 border shadow-xl rounded-xl z-10 overflow-hidden ${panicMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                                  {isOwner ? (
                                    <>
                                      <div onClick={() => { setEditingPostId(post.id); setEditPostContent(post.content); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Edit className="w-3.5 h-3.5" /> Chỉnh sửa</div>
                                      <div onClick={() => { handleHidePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Eye className="w-3.5 h-3.5" /> {post.isHidden ? 'Bỏ ẩn' : 'Ẩn bài'}</div>
                                      <div onClick={() => { handleDeletePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer hover:bg-red-50 text-red-500 text-sm flex items-center gap-2`}><Icons.Trash className="w-3.5 h-3.5" /> Xóa bài</div>
                                    </>
                                  ) : (
                                    <>
                                      <div onClick={() => { handleHidePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Eye className="w-3.5 h-3.5" /> Ẩn bài viết</div>
                                      <div onClick={() => { handleReport('POST', post.id); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 text-red-500 hover:bg-red-50`}><Icons.AlertTriangle className="w-3.5 h-3.5" /> Báo cáo vi phạm</div>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {editingPostId === post.id ? (
                          <div className="mb-3">
                            <textarea value={editPostContent} onChange={e => setEditPostContent(e.target.value)} className={`w-full border p-2 rounded-xl outline-none text-sm ${panicMode ? 'bg-slate-700 border-slate-600 text-white focus:border-indigo-400' : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-indigo-400'}`} rows="3" />
                            <div className="flex justify-end gap-2 mt-2">
                              <button onClick={() => setEditingPostId(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200">Hủy</button>
                              <button onClick={() => handleEditPostSubmit(post.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Lưu</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className={`text-[14px] whitespace-pre-wrap mb-3 leading-relaxed ${panicMode ? 'text-slate-200' : 'text-slate-800'}`}>{renderContentWithLinks(post.content)}</p>
                            {post.imageUrl && <img src={post.imageUrl} className="w-full rounded-2xl border border-slate-100 mb-3 cursor-pointer" alt="post" onClick={() => setViewingImage(post.imageUrl)} />}
                          </div>
                        )}

                        {(post.reactions?.length > 0 || post.comments?.length > 0) && (
                          <div className="flex justify-between items-center text-[12px] text-slate-400 mb-2 px-1">
                            <span className="flex items-center gap-1.5">
                              {post.reactions?.length > 0 && (
                                <>
                                  <div className="flex -space-x-0.5">{uniqueReactions.slice(0, 3).map((rType, i) => <span key={i} className="z-10 text-slate-600">{REACTION_ICONS[rType]}</span>)}</div>
                                  <span>{post.reactions.length}</span>
                                </>
                              )}
                            </span>
                            <span className="cursor-pointer hover:underline" onClick={() => setExpandedComments({ ...expandedComments, [post.id]: true })}>{post.comments?.length > 0 ? `${post.comments?.length} bình luận` : ''}</span>
                          </div>
                        )}
                        <hr className={`my-2 ${panicMode ? 'border-slate-700' : 'border-slate-100'}`} />

                        <div className="flex gap-1">
                          <div className="relative group/react flex items-center" onMouseLeave={() => setActiveReactionPopup(null)}>
                            <button onMouseEnter={() => setActiveReactionPopup(post.id)} onClick={(e) => handleReactPost(e, post.id, myReaction ? myReaction.type : 'LIKE')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${myReaction ? 'text-indigo-600 bg-indigo-50' : `text-slate-500 ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}`}>
                              {myReaction ? REACTION_ICONS[myReaction.type] : <Icons.ThumbsUp className="w-4 h-4" />}
                              <span className="text-[12px] hidden sm:inline">{myReaction ? 'Đã thích' : 'Thích'}</span>
                            </button>
                            <div className="absolute bottom-full left-0 hidden group-hover/react:flex z-50 pb-2">
                              <div className={`reaction-bar flex flex-row items-center gap-1.5 p-1.5 rounded-full shadow-xl bg-white border ${panicMode ? 'bg-slate-700 border-slate-600' : 'border-slate-100'}`}>
                                {Object.keys(REACTION_ICONS).map(key => (
                                  <button key={key} onClick={(e) => handleReactPost(e, post.id, key)} className={`w-9 h-9 flex flex-row items-center justify-center rounded-full hover:scale-125 transition-transform origin-bottom p-1.5 ${panicMode ? 'hover:bg-slate-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>{REACTION_ICONS[key]}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setExpandedComments({ ...expandedComments, [post.id]: !showComments })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 transition ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                            <Icons.MessageCircle className="w-4 h-4" /><span className="text-[12px] hidden sm:inline">Bình luận</span>
                          </button>
                          <button onClick={() => setShareModalData(post)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 transition ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                            <Icons.Share className="w-4 h-4" /><span className="text-[12px] hidden sm:inline">Chia sẻ</span>
                          </button>
                        </div>
                      </div>

                      {showComments && (
                        <div className={`pt-2 px-4 pb-4 border-t ${panicMode ? 'border-slate-700' : 'border-slate-100'}`}>
                          {renderComments(post.comments || [], post.id)}
                          <div className="mt-2">
                            {replyingTo[post.id] && (
                              <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 p-2 rounded-lg flex justify-between items-center w-fit mb-2">
                                Đang trả lời... <button onClick={() => setReplyingTo({ ...replyingTo, [post.id]: null })} className="text-slate-400 hover:text-red-500 ml-3"><Icons.X className="w-3 h-3" /></button>
                              </div>
                            )}
                            <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex gap-2 items-center">
                              <UserAvatar user={user} size="w-8 h-8" textSize="text-xs" />
                              <div className={`flex-1 flex rounded-2xl overflow-hidden items-center pr-2 border ${panicMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                <input id={`comment-input-${post.id}`} type="text" value={newCommentTexts[post.id] || ""} onChange={e => setNewCommentTexts({ ...newCommentTexts, [post.id]: e.target.value })} placeholder="Viết bình luận..." className={`flex-1 bg-transparent px-3 py-2 outline-none text-[13px] ${panicMode ? 'text-white' : 'text-slate-800'}`} />
                                <button type="submit" disabled={!newCommentTexts[post.id]?.trim()} className="text-indigo-600 px-2 hover:scale-110 disabled:text-slate-300 transition"><Icons.Send className="w-4 h-4" /></button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'user-profile' && viewingProfile && (
              <div className="space-y-4 pt-2 sm:pt-0">
                <div className={`sm:rounded-xl shadow-sm sm:border overflow-hidden bg-white mb-4`}>
                  <div className="h-40 sm:h-60 w-full bg-gray-300 relative cursor-pointer" onClick={() => viewingProfile.coverUrl && setViewingImage(viewingProfile.coverUrl)}>
                    {viewingProfile.coverUrl ? <img src={viewingProfile.coverUrl} className="w-full h-full object-cover" alt="cover" /> : <div className="w-full h-full bg-gradient-to-r from-indigo-300 to-indigo-600"></div>}
                  </div>
                  <div className="px-4 sm:px-6 pb-6 relative">
                    <div className="absolute -top-16 sm:-top-20 border-4 border-white w-32 h-32 sm:w-40 sm:h-40 rounded-full shadow-md bg-white overflow-hidden">
                      <UserAvatar user={viewingProfile} size="w-full h-full" textSize="text-5xl sm:text-6xl" onClick={() => viewingProfile.avatarUrl && setViewingImage(viewingProfile.avatarUrl)} />
                    </div>

                    <div className="pt-20 sm:pt-24 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black">{viewingProfile.fullName || viewingProfile.username}</h2>
                        {viewingProfile.showMajor && <p className="text-gray-500 font-bold mt-1 text-[14px] sm:text-[15px]"><Icons.BookOpen className="w-4 h-4 mr-1 cursor-pointer inline-block" /> Lớp: {viewingProfile.major || 'Đang cập nhật'}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {viewingProfile.id !== user.id && (
                          <>
                            {/* Nút Kết bạn / Trạng thái bạn bè */}
                            {friends.find(f => f.id === viewingProfile.id) ? (
                              <button className="bg-gray-200 text-gray-600 px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center cursor-default">
                                <Icons.Check className="w-5 h-5 text-indigo-600" /> Bạn bè
                              </button>
                            ) : sentRequests.find(r => r.id === viewingProfile.id) ? (
                              <button className="bg-gray-100 text-gray-500 px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center cursor-default">
                                <Icons.Clock className="w-5 h-5" /> Đã gửi lời mời
                              </button>
                            ) : pendingRequests.find(r => r.id === viewingProfile.id) ? (
                              <button onClick={() => handleAcceptFriend(pendingRequests.find(r => r.id === viewingProfile.id).reqId)} className="bg-indigo-600 text-white px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center hover:bg-indigo-700 animate-pulse">
                                Chấp nhận kết bạn
                              </button>
                            ) : (
                              <button onClick={() => handleAddFriend(viewingProfile.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center hover:bg-indigo-700">
                                <Icons.Plus className="w-5 h-5" /> Kết bạn
                              </button>
                            )}

                            {/* Nút Nhắn tin - Luôn hiển thị cho người khác */}
                            <button onClick={() => openChat(viewingProfile)} className="bg-gray-200 text-black px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center hover:bg-gray-300 transition">
                              <Icons.MessageCircle className="w-[18px] h-[18px]" /> Nhắn tin
                            </button>
                          </>
                        )}

                        {viewingProfile.id === user.id && (
                          <button onClick={() => setShowProfileEditModal(true)} className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded-md font-bold flex gap-2 items-center flex-1 justify-center transition">
                            <Icons.Edit className="w-4 h-4 mr-1" /> Chỉnh sửa hồ sơ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`px-4 sm:px-6 pb-6 border-t pt-4 flex flex-col gap-2 text-[14px] sm:text-[15px] ${panicMode ? 'border-gray-700 text-gray-200' : 'border-gray-200 text-gray-700'}`}>
                    <h3 className={`font-bold text-lg mb-1 ${panicMode ? 'text-white' : 'text-black'}`}>Giới thiệu</h3>
                    {viewingProfile.showBio && viewingProfile.bio && <p className="flex items-center"><Icons.FileText className="w-4 h-4 text-slate-500 mr-2" /> {viewingProfile.bio}</p>}
                    {viewingProfile.showHometown && viewingProfile.hometown && <p className="flex items-center"><Icons.MapPin className="w-4 h-4 text-slate-500 mr-2" /> Đến từ&nbsp;<span className={`font-bold ${panicMode ? 'text-white' : 'text-black'}`}>{viewingProfile.hometown}</span></p>}
                    {viewingProfile.showDob && viewingProfile.dob && <p className="flex items-center"><Icons.Calendar className="w-4 h-4 text-slate-500 mr-2" /> Sinh ngày&nbsp;<span className={`font-bold ${panicMode ? 'text-white' : 'text-black'}`}>{new Date(viewingProfile.dob).toLocaleDateString('vi-VN')}</span></p>}
                    {viewingProfile.showGender && viewingProfile.gender && <p className="flex items-center"><Icons.User className="w-4 h-4 text-slate-500 mr-2" /> Giới tính:&nbsp;<span className={`font-bold ${panicMode ? 'text-white' : 'text-black'}`}>{viewingProfile.gender}</span></p>}
                  </div>
                </div>

                {viewingProfile.id === user.id && (
                  <div className="flex gap-4 border-b mb-4">
                    <button onClick={() => setViewingHidden(false)} className={`pb-2 font-bold ${!viewingHidden ? 'border-b-2 border-rose-600 text-indigo-600' : 'text-gray-500'}`}>Bài viết công khai</button>
                    <button onClick={() => setViewingHidden(true)} className={`pb-2 font-bold ${viewingHidden ? 'border-b-2 border-rose-600 text-indigo-600' : 'text-gray-500'}`}>Bài viết đã ẩn</button>
                  </div>
                )}

                <div className="space-y-3 sm:space-y-4">
                  {currentPostsToRender.length === 0 ? (
                    <p className="text-center py-10 font-bold text-gray-400">Không có bài viết.</p>
                  ) : currentPostsToRender.map(post => {
                    const isOwner = post.userId === user.id;
                    const myReaction = post.reactions?.find(r => r.userId === user.id);
                    const showComments = expandedComments[post.id];
                    const uniqueReactions = [...new Set(post.reactions?.map(r => r.type) || [])];

                    return (
                      <div id={`post-${post.id}`} key={post.id} className={`p-4 sm:rounded-xl shadow-sm sm:border ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(post.user.id)}>
                            <UserAvatar user={post.user} />
                            <div>
                              <p className={`font-bold text-[15px] hover:underline leading-tight ${panicMode ? 'text-white' : 'text-black'}`}>{post.user.fullName || post.user.username}</p>
                              <p className="text-[12px] text-gray-500">{formatTimeAgo(post.createdAt)} {post.user.major ? `⬢ ${post.user.major}` : ''}</p>
                            </div>
                          </div>

                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenPostMenu(openPostMenu === post.id ? null : post.id); }} className={`text-slate-400 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center ${panicMode ? 'hover:bg-slate-700' : ''}`}><Icons.MoreHorizontal className="w-4 h-4" /></button>
                            {openPostMenu === post.id && (
                              <>
                                <div className="fixed inset-0 z-[9]" onClick={() => setOpenPostMenu(null)} />
                                <div className={`absolute right-0 mt-1 w-36 border shadow-xl rounded-xl z-10 overflow-hidden ${panicMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                                  {isOwner ? (
                                    <>
                                      <div onClick={() => { setEditingPostId(post.id); setEditPostContent(post.content); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Edit className="w-3.5 h-3.5" /> Chỉnh sửa</div>
                                      <div onClick={() => { handleHidePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Eye className="w-3.5 h-3.5" /> {post.isHidden ? 'Bỏ ẩn' : 'Ẩn bài'}</div>
                                      <div onClick={() => { handleDeletePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer hover:bg-red-50 text-red-500 text-sm flex items-center gap-2`}><Icons.Trash className="w-3.5 h-3.5" /> Xóa bài</div>
                                    </>
                                  ) : (
                                    <>
                                      <div onClick={() => { handleHidePost(post.id); setOpenPostMenu(null); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 ${panicMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'}`}><Icons.Eye className="w-3.5 h-3.5" /> Ẩn bài viết</div>
                                      <div onClick={() => { handleReport('POST', post.id); }} className={`p-2.5 cursor-pointer text-sm flex items-center gap-2 text-red-500 hover:bg-red-50`}><Icons.AlertTriangle className="w-3.5 h-3.5" /> Báo cáo vi phạm</div>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {editingPostId === post.id ? (
                          <div className="mb-3">
                            <textarea value={editPostContent} onChange={e => setEditPostContent(e.target.value)} className={`w-full border p-2 rounded-lg outline-none text-sm ${panicMode ? 'bg-slate-700 border-gray-600 text-white focus:border-indigo-400' : 'bg-gray-50 text-black focus:border-indigo-400'}`} rows="3" />
                            <div className="flex justify-end gap-2 mt-2"><button onClick={() => setEditingPostId(null)} className="px-3 py-1 bg-gray-200 rounded-lg text-sm font-bold text-black hover:bg-gray-300">Hủy</button><button onClick={() => handleEditPostSubmit(post.id)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Lưu</button></div>
                          </div>
                        ) : (
                          <div>
                            <p className={`text-[15px] whitespace-pre-wrap mb-3 ${panicMode ? 'text-gray-200' : 'text-black'}`}>{post.content}</p>
                            {post.imageUrl && <img src={post.imageUrl} className="w-full rounded-lg border border-gray-200 mb-3 cursor-pointer" alt="post" onClick={() => setViewingImage(post.imageUrl)} />}
                          </div>
                        )}

                        {(post.reactions?.length > 0 || post.comments?.length > 0) && (
                          <div className="flex justify-between items-center text-[12px] text-slate-400 mb-2 px-1">
                            <span className="flex items-center gap-1.5">
                              {post.reactions?.length > 0 && (
                                <>
                                  <div className="flex -space-x-0.5">{uniqueReactions.slice(0, 3).map((rType, i) => <span key={i} className="z-10 text-slate-600">{REACTION_ICONS[rType]}</span>)}</div>
                                  <span>{post.reactions.length}</span>
                                </>
                              )}
                            </span>
                            <span className="cursor-pointer hover:underline" onClick={() => setExpandedComments({ ...expandedComments, [post.id]: true })}>{post.comments?.length > 0 ? `${post.comments?.length} bình luận` : ''}</span>
                          </div>
                        )}
                        <hr className={`my-2 ${panicMode ? 'border-slate-700' : 'border-slate-100'}`} />

                        <div className="flex gap-1">
                          <div className="relative group/react flex items-center" onMouseLeave={() => setActiveReactionPopup(null)}>
                            <button onMouseEnter={() => setActiveReactionPopup(post.id)} onClick={(e) => handleReactPost(e, post.id, myReaction ? myReaction.type : 'LIKE')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${myReaction ? 'text-indigo-600 bg-indigo-50' : `text-slate-500 ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}`}>
                              {myReaction ? REACTION_ICONS[myReaction.type] : <Icons.ThumbsUp className="w-4 h-4" />}
                              <span className="text-[12px] hidden sm:inline">{myReaction ? 'Đã thích' : 'Thích'}</span>
                            </button>
                            <div className="absolute bottom-full left-0 hidden group-hover/react:flex z-50 pb-2">
                              <div className={`reaction-bar flex flex-row items-center gap-1.5 p-1.5 rounded-full shadow-xl bg-white border ${panicMode ? 'bg-slate-700 border-slate-600' : 'border-slate-100'}`}>
                                {Object.keys(REACTION_ICONS).map(key => (
                                  <button key={key} onClick={(e) => handleReactPost(e, post.id, key)} className={`w-9 h-9 flex flex-row items-center justify-center rounded-full hover:scale-125 transition-transform origin-bottom p-1.5 ${panicMode ? 'hover:bg-slate-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>{REACTION_ICONS[key]}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setExpandedComments({ ...expandedComments, [post.id]: !showComments })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 transition ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                            <Icons.MessageCircle className="w-4 h-4" /><span className="text-[12px] hidden sm:inline">Bình luận</span>
                          </button>
                          <button onClick={() => setShareModalData(post)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 transition ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                            <Icons.Share className="w-4 h-4" /><span className="text-[12px] hidden sm:inline">Chia sẻ</span>
                          </button>
                        </div>

                        {showComments && (
                          <div className={`mt-3 pt-3 border-t px-4 pb-3 ${panicMode ? 'border-slate-700' : 'border-slate-100'}`}>
                            {renderComments(post.comments || [], post.id)}
                            <div className="mt-2">
                              {replyingTo[post.id] && (
                                <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 p-2 rounded-lg flex justify-between items-center w-fit mb-2">
                                  Đang trả lời... <button onClick={() => setReplyingTo({ ...replyingTo, [post.id]: null })} className="text-slate-400 hover:text-red-500 ml-3"><Icons.X className="w-3 h-3" /></button>
                                </div>
                              )}
                              <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex gap-2 items-center">
                                <UserAvatar user={user} size="w-8 h-8" textSize="text-xs" />
                                <div className={`flex-1 flex rounded-2xl overflow-hidden items-center pr-2 border ${panicMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                  <input id={`comment-input-${post.id}`} type="text" value={newCommentTexts[post.id] || ""} onChange={e => setNewCommentTexts({ ...newCommentTexts, [post.id]: e.target.value })} placeholder="Viết bình luận..." className={`flex-1 bg-transparent px-3 py-2 outline-none text-[13px] ${panicMode ? 'text-white' : 'text-slate-800'}`} />
                                  <button type="submit" disabled={!newCommentTexts[post.id]?.trim()} className="text-indigo-600 px-2 hover:scale-110 disabled:text-slate-300 transition">
                                    <Icons.Send className="w-4 h-4" />
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'study-manager' && (
              <div className={studySubView ? "" : "space-y-4 pt-2 sm:pt-0"}>

                {/* === SUB-VIEW: XEM THỜI KHÓA BIỂU === */}
                {studySubView === 'schedule' ? (
                  <div className="space-y-4">
                    <button onClick={() => setStudySubView(null)} className="flex items-center gap-2 font-bold text-indigo-600 hover:text-indigo-700 mb-2 text-[15px]">
                      <span className="text-xl">❮</span> Quay lại Quản lý học tập
                    </button>

                    {/* TAB CHUYỂN ĐỔI */}
                    <div className={`flex gap-1 p-1.5 sm:rounded-2xl ${panicMode ? 'bg-slate-800' : 'bg-gray-100'} overflow-hidden shadow-inner`}>
                      <button onClick={() => setScheduleTab('qnu')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${scheduleTab === 'qnu' ? 'bg-white shadow text-rose-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Icons.Calendar className="w-4 h-4" /> Lịch học QNU
                      </button>
                      <button onClick={() => setScheduleTab('smart')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${scheduleTab === 'smart' ? 'bg-white shadow text-rose-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Icons.Zap className="w-4 h-4" /> Lịch Thông Minh
                      </button>
                    </div>

                    {/* NỘI DUNG TAB: LỊCH HỌC QNU */}
                    {scheduleTab === 'qnu' && (
                      <div className={`p-5 sm:rounded-2xl shadow-sm border relative ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 rounded-l-2xl"></div>
                        <div className="flex justify-between items-center mb-4 pl-3">
                          <h4 className="font-bold text-lg flex items-center gap-2"><Icons.Calendar className="w-5 h-5 text-indigo-500" /> Lịch học QNU - {qnuFilterDay === "Hôm nay" ? "Hôm nay" : qnuFilterDay}</h4>
                          <button onClick={() => setShowQnuLogin(!showQnuLogin)} className="text-sm bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1.5">
                            {qnuSchedules.length > 0 ? <><Icons.RefreshCw className="w-3.5 h-3.5" /> Đồng bộ lại</> : <><Icons.Link className="w-3.5 h-3.5" /> Kết nối QNU</>}
                          </button>
                        </div>

                        {showQnuLogin && (
                          <div className={`mb-4 p-4 rounded-xl border ${panicMode ? 'bg-slate-700 border-gray-600' : 'bg-indigo-50 border-indigo-200'}`}>
                            <h5 className="font-bold mb-2 text-sm">Nhập tài khoản Đăng ký tín chỉ QNU</h5>
                            <form onSubmit={handleQnuSync} className="flex flex-col sm:flex-row gap-2">
                              <input type="text" placeholder="Mã sinh viên" required value={qnuForm.username} onChange={e => setQnuForm({ ...qnuForm, username: e.target.value })} className={`flex-1 border p-2.5 rounded-lg outline-none text-sm ${panicMode ? 'bg-slate-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`} />
                              <input type="password" placeholder="Mật khẩu" required value={qnuForm.password} onChange={e => setQnuForm({ ...qnuForm, password: e.target.value })} className={`flex-1 border p-2.5 rounded-lg outline-none text-sm ${panicMode ? 'bg-slate-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`} />
                              <button type="submit" disabled={isSyncingQnu} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:bg-indigo-300 transition w-full sm:w-auto">
                                {isSyncingQnu ? "Đang đồng bộ..." : "Đồng bộ TKB"}
                              </button>
                            </form>
                            {isSyncingQnu && <p className="text-indigo-600 text-[13px] font-bold mt-3 animate-pulse"><Icons.Clock className="w-4 h-4 inline mr-1" /> Quá trình đồng bộ có thể mất ít phút, vui lòng đợi...</p>}
                            {qnuSyncError && <p className="text-red-500 text-xs font-bold mt-2">{qnuSyncError}</p>}
                          </div>
                        )}

                        {(() => {
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
                          const currentDayStr = dayNames[today.getDay()];
                          const targetDayStr = qnuFilterDay === "Hôm nay" ? currentDayStr : qnuFilterDay;
                          const parseVnDate = (dateStr) => { if (!dateStr) return null; const parts = dateStr.split('/'); if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]); return null; };
                          const todaysClasses = qnuSchedules.filter(s => {
                            if (s.dayOfWeek !== targetDayStr) return false;
                            return true; // Hiển thị tất cả lịch của thứ này, không check startDate/endDate tĩnh nữa vì user có thể xem lịch cũ
                          });
                          const dayOptions = ["Hôm nay", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
                          return (
                            <>
                              <div className="flex justify-between items-center mb-4 pl-3">
                                <div className="flex gap-2 relative">
                                  <button onClick={() => setQnuDropdownOpen(!qnuDropdownOpen)} className="px-5 py-2.5 text-[14px] rounded-xl font-bold border transition bg-indigo-600 text-white border-indigo-600 shadow-md flex items-center gap-2 outline-none hover:bg-indigo-700">
                                    <Icons.Calendar className="w-4 h-4" /> {qnuFilterDay} <span className="text-[10px]">{qnuDropdownOpen ? '▲' : '▼'}</span>
                                  </button>
                                  {qnuDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-xl z-20 overflow-y-auto max-h-[148px] custom-scrollbar">
                                      {dayOptions.map(day => (
                                        <div key={day} onClick={() => { setQnuFilterDay(day); setQnuDropdownOpen(false); }} className={`px-4 py-2.5 text-sm cursor-pointer transition flex items-center gap-2 ${qnuFilterDay === day ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-500' : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent hover:border-gray-200'}`}>
                                          {day}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                  <button onClick={() => setQnuViewMode('list')} className={`p-1.5 rounded-md transition ${qnuViewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                  </button>
                                  <button onClick={() => setQnuViewMode('grid')} className={`p-1.5 rounded-md transition ${qnuViewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                  </button>
                                </div>
                              </div>
                              {qnuViewMode === 'grid' ? (
                                <div className="overflow-x-auto pb-4 custom-scrollbar mx-3">
                                  <table className="w-full border-collapse min-w-[800px] text-sm bg-white border border-gray-200">
                                    <thead>
                                      <tr>
                                        <th className="border border-gray-200 p-2 bg-slate-50 text-slate-700 w-[120px]">Ca học</th>
                                        {dayOptions.slice(1).map(d => <th key={d} className="border border-gray-200 p-2 bg-indigo-50 text-indigo-800 font-bold">{d === "Chủ Nhật" ? d : d.replace("Thứ", "T.")}</th>)}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[{ name: 'Sáng (1-5)', min: 1, max: 5 }, { name: 'Chiều (6-10)', min: 6, max: 10 }, { name: 'Tối (11-15)', min: 11, max: 15 }].map(session => (
                                        <tr key={session.name}>
                                          <td className="border border-gray-200 p-2 font-bold text-center bg-slate-50 text-gray-700">{session.name}</td>
                                          {dayOptions.slice(1).map(day => {
                                            const cellClasses = qnuSchedules.filter(c => {
                                              if (c.dayOfWeek !== day) return false;
                                              const { start } = processTimeInfo(c.timeInfo);
                                              return start >= session.min && start <= session.max;
                                            });
                                            return (
                                              <td key={day} className="border border-gray-200 p-1.5 align-top bg-white hover:bg-gray-50 transition w-[130px]">
                                                {cellClasses.map(cls => (
                                                  <div key={cls.id} className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                                                    <div className="font-bold text-[13px] text-indigo-700 leading-snug mb-1">{cls.subjectName}</div>
                                                    <div className="text-[11px] text-gray-600 flex items-center gap-1 mb-0.5 whitespace-nowrap"><Icons.Clock className="w-3 h-3 text-rose-500" /> {formatQnuTime(cls.timeInfo)}</div>
                                                    <div className="text-[11px] text-gray-600 flex items-center gap-1"><Icons.MapPin className="w-3 h-3 text-rose-500" /> {cls.room}</div>
                                                  </div>
                                                ))}
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                todaysClasses.length === 0 ? (
                                  <p className="text-sm text-gray-500 pl-3 mb-2 font-bold">Trống trải. Không có môn học nào vào {targetDayStr.toLowerCase()}.</p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-3">
                                    {todaysClasses.map(s => (
                                      <div key={s.id} className={`p-4 rounded-xl border border-l-4 border-l-indigo-400 ${panicMode ? 'bg-slate-700 border-gray-600' : 'bg-white border-gray-200 hover:shadow-md transition'}`}>
                                        <p className="font-black text-[15px] text-gray-800 leading-tight mb-1 flex items-center gap-1.5"><Icons.BookOpen className="w-4 h-4 text-indigo-500" /> {s.subjectName}</p>
                                        <p className="text-[12px] text-gray-500 font-medium mb-2 flex items-center gap-1 ml-0.5"><Icons.User className="w-3.5 h-3.5" /> {s.teacher || 'Chưa cập nhật'}</p>
                                        <div className="flex gap-2 text-[12px] text-gray-700 font-bold mt-1">
                                          <span className={`px-2.5 py-1 rounded-lg shadow-sm border flex items-center gap-1 ${panicMode ? 'bg-slate-800 text-gray-200 border-gray-600' : 'bg-gray-50 border-gray-200'}`}><Icons.Clock className="w-3 h-3 text-rose-500" /> {formatQnuTime(s.timeInfo)}</span>
                                          <span className={`px-2.5 py-1 rounded-lg shadow-sm border flex items-center gap-1 ${panicMode ? 'bg-slate-800 text-gray-200 border-gray-600' : 'bg-gray-50 border-gray-200'}`}><Icons.MapPin className="w-3 h-3 text-rose-500" /> {s.room}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* NỘI DUNG TAB: LỊCH HỌC THÔNG MINH */}
                    {scheduleTab === 'smart' && (
                      <SmartScheduleScreen onBack={() => setStudySubView(null)} tasks={tasks} qnuSchedules={qnuSchedules} userId={user.id} {...popupProps} />
                    )}
                  </div>

                ) : studySubView === 'classroom' ? (
                  <div className="space-y-4">
                    <button onClick={() => setStudySubView(null)} className="flex items-center gap-2 font-bold text-indigo-600 hover:text-indigo-700 mb-2 text-[15px]">
                      <span className="text-xl">❮</span> Quay lại Quản lý học tập
                    </button>

                    {/* 2. KIỂM TRA BÀI TẬP TRÊN GOOGLE CLASSROOM */}
                    <div className={`p-5 sm:rounded-2xl shadow-sm border relative overflow-hidden ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
                      <div className="flex justify-between items-center mb-4 pl-3">
                        <div>
                          <h4 className="font-bold text-lg flex items-center gap-2"><Icons.School className="w-6 h-6" /> Kiểm tra bài tập trên Google Classroom</h4>
                          <p className="text-[13px] text-gray-500 mt-1 pl-0.5">Đăng nhập tài khoản Google để đồng bộ bài tập từ Classroom</p>
                        </div>
                        <GoogleClassroomSyncButton userId={user.id} onSyncSuccess={fetchData} showAlert={showAlert} />
                      </div>

                      {/* FORM THÊM BÀI TẬP THỦ CÔNG */}
                      <div className={`pl-3 pt-3 border-t ${panicMode ? 'border-gray-700' : 'border-gray-100'}`}>
                        <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
                          <input type="text" placeholder="Tên bài tập..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required className={`flex-1 border p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
                          <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} required className={`w-full sm:w-40 border p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
                          <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition text-sm">+ Thêm bài tập</button>
                        </form>
                      </div>
                    </div>

                    {/* 3. DANH SÁCH BÀI TẬP */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredTasks.length === 0 ? <p className="text-center col-span-full py-4 text-gray-400 font-bold">Không tìm thấy bài tập nào.</p> : (
                        <>
                          {filteredTasks.filter(t => {
                              // So sánh theo chuỗi YYYY-MM-DD để tránh lỗi múi giờ
                              const dueDateStr = t.dueDate ? t.dueDate.slice(0,10) : '';
                              const todayStr = new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd format
                              return dueDateStr >= todayStr;
                            }).map(t => (
                            <div key={t.id} className={`p-5 rounded-2xl shadow-sm border border-l-4 ${t.isLMS ? 'border-l-green-500' : 'border-l-indigo-500'} flex flex-col justify-between ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 pr-2">
                                    {t.isLMS && <span className="text-[10px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded mb-1 inline-block">📚 Classroom</span>}
                                    <h4 className={`font-bold text-[16px] leading-tight ${panicMode ? 'text-white' : 'text-gray-800'}`}>{t.title}</h4>
                                  </div>
                                  <button onClick={() => handleDeleteTask(t.id)} className="text-slate-400 hover:text-red-500 transition flex-shrink-0"><Icons.Trash className="w-5 h-5 opacity-80" /></button>
                                </div>
                                <p className="text-sm text-gray-500 font-medium pb-2 border-b border-gray-100 mb-2 flex items-center gap-1.5"><Icons.Clock className="w-4 h-4 opacity-80" /> Hạn chót: {formatTaskDate(t.dueDate)}</p>
                              </div>
                              {!t.draftResult ? (
                                <button onClick={() => showAlert('Tính năng Draft-to-Action (AI) đang được phát triển và sẽ sớm ra mắt! 🚀\nStay tuned!', 'info')} disabled={isDraftingId === t.id} className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center ${panicMode ? 'bg-slate-700 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>{isDraftingId === t.id ? <><Icons.Clock className="w-4 h-4 animate-spin mr-1.5" /> Đang xử lý...</> : <><Icons.Zap className="w-4 h-4 mr-1.5" /> Draft-to-Action (AI)</>}</button>
                              ) : (
                                <div className={`mt-2 p-3 rounded-xl border text-[13px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${panicMode ? 'bg-slate-700 border-gray-600 text-gray-200' : 'bg-indigo-50 border-indigo-100 text-gray-700'}`}>{t.draftResult}</div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                ) : (
                  /* === TRANG CHÍNH QUẢN LÝ HỌC TẬP === */
                  <>
                    {/* 1. THANH TÌM KIẾM */}
                    <div className={`p-4 sm:rounded-2xl shadow-sm border ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <input type="text" placeholder="🔍 Tìm kiếm bài tập, môn học, lịch hôm nay..." value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} className={`w-full border p-3 rounded-xl outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
                    </div>

                    {/* 2. THANH KIỂM TRA BÀI TẬP CLASSROOM */}
                    <div onClick={() => setStudySubView('classroom')} className={`p-5 sm:rounded-2xl shadow-sm border cursor-pointer hover:shadow-md transition flex items-center justify-between group ${panicMode ? 'bg-slate-800 border-gray-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-green-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center text-slate-500"><Icons.School className="w-6 h-6" /></div>
                        <div>
                          <h4 className={`font-bold text-[16px] ${panicMode ? 'text-white' : 'text-gray-800'}`}>Kiểm tra bài tập trên Google Classroom</h4>
                          <p className="text-[13px] text-gray-500">Đăng nhập tài khoản Google để đồng bộ bài tập từ Classroom</p>
                        </div>
                      </div>
                      <span className="text-gray-400 group-hover:text-green-500 text-xl font-bold transition">❯</span>
                    </div>

                    {/* 4. THANH XEM THỜI KHÓA BIỂU */}
                    <div onClick={() => setStudySubView('schedule')} className={`p-5 sm:rounded-2xl shadow-sm border cursor-pointer hover:shadow-md transition flex items-center justify-between group ${panicMode ? 'bg-slate-800 border-gray-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-blue-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center text-slate-500"><Icons.Calendar className="w-6 h-6" /></div>
                        <div>
                          <h4 className={`font-bold text-[16px] ${panicMode ? 'text-white' : 'text-gray-800'}`}>Xem thời khóa biểu</h4>
                          <p className="text-[13px] text-gray-500">Lịch học QNU & Lịch học thông minh</p>
                        </div>
                      </div>
                      <span className="text-gray-400 group-hover:text-blue-500 text-xl font-bold transition">❯</span>
                    </div>


                  </>
                )}
              </div>
            )}

            {activeTab === 'market' && (
              <div className="space-y-4 pt-2 sm:pt-0">
                <div className={`p-4 sm:p-6 sm:rounded-3xl shadow-sm border ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-2xl font-black flex items-center gap-2 ${panicMode ? 'text-white' : 'text-gray-800'}`}><Icons.ShoppingBag className="w-7 h-7" /> Chợ Sinh Viên</h3>
                    {/* Hamburger menu - mobile only */}
                    <div className="relative sm:hidden">
                      <button onClick={() => setShowMarketMenu(!showMarketMenu)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${showMarketMenu ? 'bg-indigo-600 text-white' : (panicMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}>
                        <Icons.Menu className="w-5 h-5" />
                      </button>
                      {showMarketMenu && (
                        <>
                          <div className="fixed inset-0 z-[9]" onClick={() => setShowMarketMenu(false)} />
                          <div className={`absolute right-0 mt-2 w-52 rounded-xl shadow-2xl border z-10 overflow-hidden ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`} style={{ animation: 'popIn 0.18s cubic-bezier(.34,1.56,.64,1)' }}>
                            {MARKET_TABS.map(t => (
                              <button key={t.id} onClick={() => { setMarketTab(t.id); setShowMarketMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold transition ${marketTab === t.id ? (panicMode ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-500') : (panicMode ? 'text-gray-300 hover:bg-slate-700 border-l-4 border-transparent' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent')}`}>
                                {t.icon}
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Desktop tabs - hidden on mobile */}
                  <div className="hidden sm:flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {MARKET_TABS.map(t => (
                      <button key={t.id} onClick={() => setMarketTab(t.id)} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition flex items-center gap-1.5 ${marketTab === t.id ? 'bg-indigo-600 text-white' : (panicMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}>
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Mobile: show active tab pill */}
                  <div className="flex sm:hidden mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[12px] font-bold">
                      {MARKET_TABS.find(t => t.id === marketTab)?.icon}
                      {MARKET_TABS.find(t => t.id === marketTab)?.label}
                    </span>
                  </div>

                  <div className={`border border-dashed p-4 sm:p-5 rounded-2xl mb-6 ${panicMode ? 'bg-slate-700 border-gray-600' : 'bg-indigo-50 border-indigo-200'}`}>
                    {marketTab !== 'ERRAND' ? (
                      <div className="space-y-3">
                        {marketTab === 'NOTES' && (<DocumentMarketScreen key={marketRefreshKey} user={user} panicMode={panicMode} onBuy={handleBuyItem} onChat={handleMarketChat} onOpenProfile={openUserProfile} {...popupProps} />)}
                        {marketTab === 'PRODUCT' && (<ProductMarketScreen user={user} panicMode={panicMode} onChat={handleMarketChat} onOpenProfile={openUserProfile} {...popupProps} />)}
                        {marketTab === 'RIDE' && (<RideMarketScreen user={user} panicMode={panicMode} onGpsPost={handleMarketGPSPost} onChat={handleMarketChat} onOpenProfile={openUserProfile} {...popupProps} />)}
                        {marketTab === 'PERSONAL' && (<PersonalMarketScreen user={user} panicMode={panicMode} onChat={handleMarketChat} onOpenProfile={openUserProfile} {...popupProps} />)}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <ErrandMarketScreen user={user} panicMode={panicMode} onGpsPost={handleMarketGPSPost} onChat={handleMarketChat} onOpenProfile={openUserProfile} {...popupProps} />
                      </div>
                    )}
                  </div>

                  {marketTab !== 'PERSONAL' && marketTab !== 'ERRAND' && marketTab !== 'NOTES' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredMarket.length === 0 ? null : filteredMarket.map(item => (
                        <div key={item.id} className={`border rounded-xl flex flex-col justify-between shadow-sm overflow-hidden hover:shadow-md transition ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          {item.category === 'PRODUCT' && item.imageUrl && <img src={item.imageUrl} className="w-full h-40 object-cover" alt="product" />}
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md uppercase">{item.category}</span><span className="text-[12px] font-bold text-gray-500">{item.location || item.author.major || 'QNU'}</span></div>
                            <h4 className={`font-bold text-[16px] leading-tight mb-1 ${panicMode ? 'text-white' : 'text-gray-800'}`}>{item.title}</h4>
                            {item.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>}
                            {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 underline mb-2 block">📎 Xem trước file</a>}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200"><UserAvatar user={item.author} size="w-8 h-8" textSize="text-[12px]" /><p className={`text-xs font-bold ${panicMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.author.fullName || item.author.username}</p></div>
                          </div>
                          <div className={`p-4 pt-0 ${panicMode ? 'bg-slate-800' : 'bg-white'}`}>
                            {item.category === 'NOTES' && (<button onClick={() => handleBuyItem(item)} className={`w-full py-2 rounded-lg font-bold text-sm transition ${panicMode ? 'bg-slate-700 text-white hover:bg-indigo-600' : 'bg-[#E4E6EB] text-black hover:bg-indigo-600 hover:text-white'}`}>Mua ngay ({fmtUC(item.reward)} UC)</button>)}
                            {item.category === 'ERRAND' && (<button onClick={() => handleMarketChat(item.author, `Chào bạn, mình thấy bạn đang ở ${item.location}. Bạn mua hộ mình đồ này được không, mình gửi ${fmtUC(item.reward)} UC nhé!`)} className="w-full bg-green-500 text-white py-2 rounded-lg font-bold text-sm flex justify-center gap-2 hover:bg-green-600">🏃 Nhờ mua hộ ({fmtUC(item.reward)} UC)</button>)}
                            {item.category === 'PRODUCT' && (<button onClick={() => handleMarketChat(item.author, `Chào Shop, mình muốn hỏi mua món: "${item.title}". Hàng còn không ạ?`)} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-700">💬 Chat với Shop</button>)}
                            {item.category === 'RIDE' && (<button onClick={() => handleMarketChat(item.author, `Chào bạn, mình nhận chuyến đi: "${item.title}" với giá ${fmtUC(item.reward)} UC nhé.`)} className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold text-sm hover:bg-orange-600">🛵 Nhận chuyến ({fmtUC(item.reward)} UC)</button>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="h-32 w-full block md:hidden"></div>
          </div>
        </main>

        {/* RIGHT SIDEBAR - Widget */}
        <aside className={`w-[240px] xl:w-[260px] flex-shrink-0 p-3 hidden xl:flex flex-col overflow-y-auto hover-scrollbar border-l ${panicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {pendingRequests.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Lời mời kết bạn</h3>
              {pendingRequests.map(req => (
                <div key={req.reqId} className={`p-3 rounded-xl mb-2 ${panicMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="flex gap-2.5 items-center mb-2">
                    <UserAvatar user={req} size="w-9 h-9" textSize="text-xs" />
                    <p className="font-semibold text-sm leading-tight">{req.fullName || req.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptFriend(req.reqId)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg font-semibold text-xs">Xác nhận</button>
                    <button onClick={() => handleDeclineFriend(req.reqId)} className={`flex-1 py-1.5 rounded-lg font-semibold text-xs ${panicMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>Xóa</button>
                  </div>
                </div>
              ))}
              <hr className={`my-3 ${panicMode ? 'border-slate-700' : 'border-slate-100'}`} />
            </div>
          )}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Đang Online</h3>
          <div className="space-y-0.5">
            {friends.map(friend => {
              const status = getActiveStatus(friend.lastActive, friend.showActivity);
              return (
                <div key={friend.id} onClick={() => openChat(friend)} className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer ${panicMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                  <div className="relative">
                    <UserAvatar user={friend} size="w-8 h-8" />
                    {status.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <span className={`font-medium text-[13px] flex-1 truncate ${status.isOnline ? (panicMode ? 'text-white' : 'text-slate-800') : 'text-slate-400'}`}>{friend.fullName || friend.username}</span>
                  {!status.isOnline && <span className="text-[10px] text-slate-300">{status.text}</span>}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* BOTTOM NAV - Mobile only */}
      <nav className={`md:hidden fixed bottom-0 w-full border-t flex justify-around items-stretch h-[60px] z-40 ${panicMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        {MENU_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center gap-1 flex-1 cursor-pointer text-[9px] font-bold uppercase tracking-wider transition relative border-none bg-transparent ${activeTab === item.id ? 'text-indigo-600' : (panicMode ? 'text-slate-400' : 'text-slate-400')}`}>
            {activeTab === item.id && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-600 rounded-full" />}
            <span className={`${activeTab === item.id ? 'text-indigo-600' : ''}`}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={() => setShowMobileMenu(true)} className={`flex flex-col items-center justify-center gap-1 flex-1 cursor-pointer text-[9px] font-bold uppercase tracking-wider transition relative border-none bg-transparent ${panicMode ? 'text-slate-400' : 'text-slate-400'}`}>
          <Icons.Menu className="w-5 h-5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* MODAL MENU MOBILE */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowMobileMenu(false)}>
          <div className={`w-full rounded-t-2xl p-4 shadow-2xl animate-slide-up ${panicMode ? 'bg-slate-800 text-white' : 'bg-white text-black'}`} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>

            <div onClick={() => { openUserProfile(user.id); setShowMobileMenu(false); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-4 ${panicMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
              <UserAvatar user={user} size="w-12 h-12" textSize="text-xl" />
              <div><h4 className="font-bold text-lg">{user.fullName || user.username}</h4><p className="text-sm text-gray-500">Xem trang cá nhân</p></div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div onClick={() => { handleCheckIn(); setShowMobileMenu(false); }} className={`p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer active:scale-95 ${panicMode ? 'bg-slate-700' : 'bg-green-50'}`}><span className="text-xl mb-1">📍</span><span className="font-bold text-green-600">Check-in Lớp</span></div>
            </div>

            <div className="space-y-2">
              <button onClick={() => { setPanicMode(!panicMode); setShowMobileMenu(false); }} className={`w-full text-left p-3 font-bold rounded-xl ${panicMode ? 'bg-red-600 text-white' : 'text-orange-600 bg-orange-50'}`}>🚨 Panic Mode</button>
              <button onClick={() => { setShowProfileEditModal(true); setShowMobileMenu(false); }} className={`w-full text-left p-3 font-bold rounded-xl ${panicMode ? 'bg-slate-700 text-white' : 'text-gray-700 bg-gray-100'}`}>✏️ Chỉnh sửa hồ sơ</button>
              <button onClick={handleLogout} className={`w-full text-left p-3 font-bold rounded-xl ${panicMode ? 'bg-slate-700 text-red-400' : 'text-red-500 bg-red-50'}`}>🚪 Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {viewingImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full text-xl font-bold transition flex items-center justify-center">✕</button>
          <img src={viewingImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* MODAL SHARE */}
      {shareModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className={`w-full max-w-[500px] rounded-xl shadow-2xl flex flex-col relative overflow-hidden ${panicMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 border border-gray-200'}`} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className={`flex justify-center items-center p-4 border-b relative ${panicMode ? 'border-gray-700' : 'border-gray-200'}`}><h3 className="text-xl font-bold">Chia sẻ</h3><button onClick={() => setShareModalData(null)} className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg absolute right-4 transition ${panicMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}><Icons.X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-4 flex gap-3"><UserAvatar user={user} size="w-10 h-10" /><div className="flex-1"><p className="font-bold text-[15px]">{user.fullName || user.username}</p><textarea value={shareText} onChange={e => setShareText(e.target.value)} placeholder="Hãy nói gì đó về nội dung này..." className={`w-full bg-transparent mt-2 outline-none resize-none text-[16px] min-h-[60px] ${panicMode ? 'placeholder-gray-400 text-white' : 'placeholder-gray-500 text-black'}`}></textarea></div></div>
            <div className={`px-4 pb-4 border-b ${panicMode ? 'border-gray-700' : 'border-gray-200'}`}><button onClick={handleShareSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition shadow-md">Chia sẻ ngay</button></div>
            <div className={`p-4 ${panicMode ? 'bg-slate-800' : 'bg-gray-50'}`}><h4 className="font-bold text-[15px] mb-3">Gửi bằng Messenger</h4><div className="flex gap-4 overflow-x-auto pb-2 hover-scrollbar">{friends.length === 0 ? <p className="text-sm text-gray-400">Bạn chưa có bạn bè để gửi.</p> : friends.map(f => (<div key={f.id} onClick={() => handleShareToMessenger(f.id, f.fullName || f.username)} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-70 min-w-[60px] transition transform hover:scale-105"><UserAvatar user={f} size="w-12 h-12" textSize="text-xl" /><span className="text-[11px] text-center leading-tight truncate w-full">{f.fullName || f.username}</span></div>))}</div><div className={`flex justify-around mt-4 pt-4 border-t ${panicMode ? 'border-gray-700' : 'border-gray-200'}`}><div onClick={() => copyPostLink(shareModalData.id)} className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80"><div className={`w-12 h-12 rounded-full flex items-center justify-center transition border ${panicMode ? 'bg-slate-700 border-gray-600 text-gray-300 hover:bg-slate-600' : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'}`}><Icons.Link className="w-5 h-5" /></div><span className="text-[12px] font-bold">Sao chép link</span></div></div></div>
          </div>
        </div>
      )}

      {/* CHAT 1-1 VỚI TÍNH NĂNG CÀI ĐẶT ONLINE & REACTION (CHUẨN MESSENGER) */}
      {activeChat && (
        <div className={`fixed bottom-[60px] md:bottom-0 right-0 md:right-20 w-full md:w-[330px] md:rounded-t-xl shadow-[0_0_30px_rgba(0,0,0,0.3)] z-[70] flex flex-col h-[calc(100vh-60px)] md:h-[450px] ${panicMode ? 'bg-slate-800 text-white border border-gray-700' : 'bg-white text-black border border-gray-300'}`}>

          <div className={`border-b p-3 md:rounded-t-xl flex justify-between items-center shadow-sm relative ${panicMode ? 'border-gray-700 bg-slate-800' : 'bg-white'}`}>
            <div className={`flex items-center gap-2 cursor-pointer p-1 rounded-lg ${panicMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`} onClick={() => { openUserProfile(activeChat.id); setActiveChat(null); }}>
              <UserAvatar user={activeChat} size="w-8 h-8" textSize="text-xs" />
              <div>
                <p className="font-bold text-[15px] leading-tight">{activeChat.fullName || activeChat.username}</p>
                <p className={`text-[10px] ${getActiveStatus(activeChat.lastActive, activeChat.showActivity).isOnline ? 'text-green-500 font-bold' : 'text-gray-400'}`}>
                  {getActiveStatus(activeChat.lastActive, activeChat.showActivity).text}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setShowChatSettings(!showChatSettings); setShowTransHistory(false); if (!showChatSettings) loadTransHistory(activeChat.id); }} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${panicMode ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-200'}`}><Icons.Settings className="w-[18px] h-[18px]" /></button>
              <button onClick={() => { setActiveChat(null); setChatRefItem(null); setChatRefType(null); }} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${panicMode ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-200'}`}><Icons.X className="w-5 h-5" /></button>
            </div>

            {showChatSettings && (
              <div className={`absolute top-full right-0 mt-1 w-64 border shadow-2xl rounded-lg p-3 z-50 ${panicMode ? 'bg-slate-800 border-gray-700 text-white' : 'bg-white text-black border-gray-200'}`}>
                <label className="flex items-center justify-between text-sm font-bold cursor-pointer border-b pb-2 mb-2 border-gray-200">
                  Hiện trạng thái hoạt động
                  <input type="checkbox" checked={profileForm.showActivity ?? true} onChange={e => { setProfileForm({ ...profileForm, showActivity: e.target.checked }); handleUpdateProfile(e); }} className="w-4 h-4 accent-indigo-600" />
                </label>
                <div className="flex flex-col mb-2">
                  <span className="text-xs font-bold text-gray-500 mb-1">Tìm kiếm trong đoạn chat</span>
                  <input type="text" placeholder="Gõ từ khóa..." value={chatSearchQuery} onChange={e => setChatSearchQuery(e.target.value)} className={`w-full p-2 rounded outline-none text-sm ${panicMode ? 'bg-slate-700' : 'bg-gray-100'}`} />
                </div>
                <button onClick={() => { setShowTransHistory(!showTransHistory); setShowChatSettings(false); }} className="w-full flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg p-2 transition">
                  <Icons.FileText className="w-4 h-4" /> Xem lịch sử giao dịch
                </button>
              </div>
            )}
          </div>

          {/* BANNER SẢN PHẨM ĐANG THƯƠNG LƯỢNG */}
          {chatRefItem && !showTransHistory && (
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-indigo-50 text-indigo-800" style={{ fontSize: 12 }}>
              <Icons.ShoppingBag className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-semibold flex-1 truncate">2 bạn đang chat về:
                <button
                  onClick={() => setShowRefDetailModal(true)}
                  className="ml-1 text-rose-600 hover:underline font-bold truncate max-w-[140px] inline-block align-bottom"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}
                >{chatRefItem.title}</button>
              </span>
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => setShowOfferInput(v => !v)}
                  className="text-[10px] font-bold whitespace-nowrap px-2 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >Chốt giá</button>
                <button onClick={() => setChatRefItem(null)} className="text-indigo-400 hover:text-indigo-600 font-bold ml-1"><Icons.X className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          {/* MODAL CHI TIẾT SẢN PHẨM ĐANG THƯƠNG LƯỢNG */}
          {showRefDetailModal && chatRefItem && (
            <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4" onClick={() => setShowRefDetailModal(false)}>
              <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ animation: 'popIn 0.2s cubic-bezier(.34,1.56,.64,1)' }}>
                <div style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>
                    {chatRefType === 'DOCUMENT' ? '📄 Chi tiết tài liệu'
                      : chatRefType === 'ERRAND' ? '🛵 Chi tiết đơn mua hộ'
                        : chatRefType === 'PRODUCT' ? '📦 Chi tiết sản phẩm'
                          : chatRefType === 'RIDE' ? '🚗 Chi tiết chuyến đi'
                            : 'Chi tiết'}
                  </span>
                  <button onClick={() => setShowRefDetailModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>✕</button>
                </div>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: '#1e293b', lineHeight: 1.4 }}>
                    {chatRefItem.title || chatRefItem.name || (chatRefType === 'RIDE' ? `${chatRefItem.departure} → ${chatRefItem.destination}` : 'Không có tên')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

                    {/* DOCUMENT fields */}
                    {chatRefType === 'DOCUMENT' && chatRefItem.subject && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>MÔN HỌC</div><div style={{ fontWeight: 700, fontSize: 12 }}>📚 {chatRefItem.subject}</div></div>}
                    {chatRefType === 'DOCUMENT' && chatRefItem.lecturer && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>GIẢNG VIÊN</div><div style={{ fontWeight: 700, fontSize: 12 }}>👨‍🏫 {chatRefItem.lecturer}</div></div>}

                    {/* ERRAND fields */}
                    {chatRefType === 'ERRAND' && chatRefItem.locationBuy && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>MUA TẠI</div><div style={{ fontWeight: 700, fontSize: 12 }}>📍 {chatRefItem.locationBuy}</div></div>}
                    {chatRefType === 'ERRAND' && chatRefItem.locationDrop && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>GIAO ĐẾN</div><div style={{ fontWeight: 700, fontSize: 12 }}>🏢 {chatRefItem.locationDrop}</div></div>}
                    {chatRefType === 'ERRAND' && chatRefItem.category && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>LOẠI</div><div style={{ fontWeight: 700, fontSize: 12 }}>{chatRefItem.category === 'FOOD' ? '🍜 Đồ ăn/Nước' : chatRefItem.category === 'PRINT' ? '🖨️ In ấn' : '📦 Lấy đồ'}</div></div>}

                    {/* PRODUCT fields */}
                    {chatRefType === 'PRODUCT' && chatRefItem.condition && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>TÌNH TRẠNG</div><div style={{ fontWeight: 700, fontSize: 12 }}>🏷️ {chatRefItem.condition}</div></div>}
                    {chatRefType === 'PRODUCT' && chatRefItem.category && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>DANH MỤC</div><div style={{ fontWeight: 700, fontSize: 12 }}>🗂️ {chatRefItem.category}</div></div>}
                    {chatRefType === 'PRODUCT' && chatRefItem.description && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px', gridColumn: '1/-1' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>MÔ TẢ</div><div style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>{chatRefItem.description}</div></div>}

                    {/* RIDE fields */}
                    {chatRefType === 'RIDE' && chatRefItem.departure && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>ĐIỂM ĐI</div><div style={{ fontWeight: 700, fontSize: 12 }}>📍 {chatRefItem.departure}</div></div>}
                    {chatRefType === 'RIDE' && chatRefItem.destination && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>ĐIỂM ĐẾN</div><div style={{ fontWeight: 700, fontSize: 12 }}>🏁 {chatRefItem.destination}</div></div>}
                    {chatRefType === 'RIDE' && chatRefItem.departureTime && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>THỜI GIAN</div><div style={{ fontWeight: 700, fontSize: 12 }}>🕐 {new Date(chatRefItem.departureTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div></div>}
                    {chatRefType === 'RIDE' && chatRefItem.seats && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>CHỖ TRỐNG</div><div style={{ fontWeight: 700, fontSize: 12 }}>💺 {chatRefItem.seats} chỗ</div></div>}
                    {chatRefType === 'RIDE' && chatRefItem.vehicleType && <div style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>PHƯƠNG TIỆN</div><div style={{ fontWeight: 700, fontSize: 12 }}>🚗 {chatRefItem.vehicleType}</div></div>}

                    {/* PRICE (all types) */}
                    {(chatRefItem.price || chatRefItem.fee || chatRefItem.reward) && (
                      <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 12px', gridColumn: '1/-1' }}>
                        <div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontWeight: 700 }}>{chatRefType === 'ERRAND' ? 'PHÍ MUA HỘ' : chatRefType === 'RIDE' ? 'GIÁ CHUYẾN' : 'GIÁ'}</div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: '#e11d48' }}>{fmtUC(chatRefItem.price || chatRefItem.fee || chatRefItem.reward)} UC</div>
                      </div>
                    )}
                  </div>
                  <form onSubmit={(e) => { sendOffer(e); setShowRefDetailModal(false); }} style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        placeholder="Nhập giá muốn chốt (UC)"
                        value={offerPrice}
                        onChange={e => setOfferPrice(e.target.value)}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '2px solid #e2e8f0', outline: 'none', fontSize: 14 }}
                        onFocus={e => e.target.style.borderColor = '#4F46E5'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      />
                      <button type="submit" style={{ padding: '10px 18px', borderRadius: 10, background: '#4F46E5', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Gửi đề xuất</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}


          {/* PANEL LỊCH SỪ GIAO DỊCH */}
          {showTransHistory && (
            <div className={`flex-1 overflow-y-auto p-3 ${panicMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[14px]">Lịch sử giao dịch</h4>
                <button onClick={() => setShowTransHistory(false)} className="text-xs text-indigo-600 font-bold">Quay lại chat →</button>
              </div>
              {transHistoryData.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center mt-8">Chưa có giao dịch nào.</p>
              ) : transHistoryData.map((tx, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-xl mb-2 cursor-pointer border transition ${panicMode ? 'bg-slate-800 border-gray-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-indigo-50'}`}
                  onClick={() => {
                    setChatRefItem(tx.item);
                    setChatRefType(tx.type);
                    axios.get(`/api/messages/${user.id}/${activeChat.id}?refType=${tx.type}&refId=${tx.item.id}`).then(r => setMessages(r.data || []));
                    setShowTransHistory(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    {tx.type === 'DOCUMENT' ? <Icons.FileText className="w-4 h-4 text-indigo-600" /> : tx.type === 'PRODUCT' ? <Icons.ShoppingBag className="w-4 h-4 text-indigo-600" /> : <Icons.MessageCircle className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[12px] truncate">{tx.item.title}</p>
                    <p className="text-[10px] text-gray-400">{tx.type === 'DOCUMENT' ? 'Tài liệu' : tx.type === 'PRODUCT' ? 'Sản phẩm' : tx.type === 'ERRAND' ? 'Mua hộ' : 'Xe chung'} • {fmtUC(tx.item.price || tx.item.reward || 0)} UC</p>
                    {tx.hash && (
                      <p className="text-[9px] text-green-600 font-mono flex items-center gap-1 mt-0.5" title="Giao dịch đã được mã hoá chống giả mạo">
                        <Icons.CheckCircle className="w-3 h-3" /> Tx: {tx.hash.substring(0, 10)}...
                      </p>
                    )}
                  </div>
                  <Icons.ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          )}

          {!showTransHistory && <div className={`flex-1 overflow-y-auto p-3 space-y-4 flex flex-col ${panicMode ? 'bg-slate-900' : 'bg-[#F0F2F5]'}`}>
            {filteredMessages.map(m => {
              const isMe = m.senderId === user.id;
              const uniqueReactions = [...new Set(m.reactions?.map(r => r.type) || [])];

              const isOffer = m.content?.startsWith('__OFFER__:');
              const isOfferAccepted = m.content?.startsWith('__OFFER_ACCEPTED__:');
              const isOfferRejected = m.content === '__OFFER_REJECTED__';

              if (isOffer) {
                const parts = m.content.replace('__OFFER__:', '').split(':');
                const price = parts[0];
                const itemTitle = parts.slice(1).join(':');
                const isThisAccepted = acceptedOfferIds.has(m.id) ||
                  messages.some(x => x.content?.startsWith('__OFFER_ACCEPTED__:'));
                const isThisRejected = rejectedOfferIds.has(m.id) ||
                  messages.some(x => x.content === '__OFFER_REJECTED__');
                const borderColor = isThisAccepted ? '#22c55e' : isThisRejected ? '#f87171' : '#4F46E5';
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div style={{ width: 210, background: isMe ? '#EEF2FF' : '#fff', border: `2px solid ${borderColor}`, borderRadius: 14, padding: '10px 12px', boxShadow: '0 2px 8px rgba(79,70,229,0.08)' }}>
                      <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 3 }}>💰 ĐỀ XUẤT GIÁ</div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>"{itemTitle}"</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#4F46E5', marginBottom: 8 }}>{fmtUC(price)} UC</div>
                      {isThisAccepted
                        ? <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, textAlign: 'center', background: '#f0fdf4', borderRadius: 6, padding: '4px 0' }}>✅ Đã chốt đơn</div>
                        : isThisRejected
                          ? <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, textAlign: 'center', background: '#fef2f2', borderRadius: 6, padding: '4px 0' }}>❌ Đã từ chối</div>
                          : !isMe
                            ? <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleAcceptOffer(m)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: '#22c55e', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✓ Chấp nhận</button>
                              <button onClick={() => handleRejectOffer(m.id)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✕ Từ chối</button>
                            </div>
                            : <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>Đang chờ phản hồi...</div>
                      }
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">{formatChatTime(m.createdAt)}</span>
                  </div>
                );
              }

              if (isOfferAccepted) {
                const price = m.content.replace('__OFFER_ACCEPTED__:', '').split(':')[0];
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div style={{ maxWidth: '80%', background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 14, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>✅ Đã chốt đơn {fmtUC(price)} UC — Giao dịch thành công!</div>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">{formatChatTime(m.createdAt)}</span>
                  </div>
                );
              }

              if (isOfferRejected) {
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div style={{ maxWidth: '80%', background: '#fef2f2', border: '2px solid #f87171', borderRadius: 14, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>❌ Đã từ chối đề xuất giá</div>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">{formatChatTime(m.createdAt)}</span>
                  </div>
                );
              }

              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group/msg`}>
                  <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`px-4 py-2 max-w-[80%] rounded-2xl text-[15px] relative ${isMe ? 'bg-indigo-600 text-white' : (panicMode ? 'bg-slate-700 text-white' : 'bg-white border border-gray-200 text-black')}`}>
                      {m.imageUrl && <img src={m.imageUrl} alt="chat" className="w-full rounded-lg mb-2 cursor-pointer" onClick={() => setViewingImage(m.imageUrl)} />}
                      {renderContentWithLinks(m.content)}
                      {uniqueReactions.length > 0 && (
                        <div className="absolute -bottom-2 -right-2 bg-white border rounded-full px-1 py-0.5 flex gap-0.5 shadow-sm">
                          {uniqueReactions.map(type => <span key={type} className="text-slate-600 block scale-[0.6] -mx-0.5">{REACTION_ICONS[type]}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="relative opacity-100 md:opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <button onClick={() => setActiveMsgReact(activeMsgReact === m.id ? null : m.id)} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-sm border transition ${panicMode ? 'bg-slate-700 hover:bg-slate-600 border-gray-600 text-slate-300' : 'bg-white hover:bg-gray-100 border-gray-200 text-slate-500 hover:text-indigo-600'}`}><Icons.Smile className="w-4 h-4" /></button>
                      {activeMsgReact === m.id && (
                        <div className={`absolute bottom-full mb-1 right-0 bg-white border border-gray-100 shadow-xl rounded-full p-1.5 flex gap-1 z-[80] animate-slide-up`}>
                          {Object.keys(REACTION_ICONS).map(key => (
                            <button key={key} onClick={() => { handleReactMessage(m.id, key); setActiveMsgReact(null); }} className={`w-8 h-8 flex flex-row items-center justify-center rounded-full hover:scale-125 transition-transform p-1.5 ${panicMode ? 'hover:bg-slate-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>{REACTION_ICONS[key]}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{formatChatTime(m.createdAt)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>}

          {!showTransHistory && <form onSubmit={showOfferInput ? sendOffer : sendMessage} className={`p-2 border-t flex flex-col gap-2 ${panicMode ? 'bg-slate-800 border-gray-700' : 'bg-white'}`}>
            {newChatImage && (
              <div className="relative w-16 h-16 ml-2 mt-2">
                <img src={URL.createObjectURL(newChatImage)} className="w-full h-full object-cover rounded-md" alt="upload" />
                <button type="button" onClick={() => setNewChatImage(null)} className="absolute -top-1 -right-1 bg-gray-800 text-white w-4 h-4 rounded-full text-xs flex items-center justify-center">✕</button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              {!showOfferInput && (
                <label className="cursor-pointer pl-2 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition">
                  <Icons.Image className="w-[22px] h-[22px]" /> <input type="file" accept="image/*" className="hidden" onChange={e => setNewChatImage(e.target.files[0])} />
                </label>
              )}
              {showOfferInput && chatRefItem
                ? <>
                  <input
                    type="number"
                    autoFocus
                    placeholder="Nhập giá đề xuất (UC)..."
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    className={`flex-1 rounded-full px-4 py-2 outline-none text-[14px] border-2 border-indigo-300 focus:border-indigo-500 ${panicMode ? 'bg-slate-700 text-white' : 'bg-white text-black'}`}
                  />
                  <button type="submit" style={{ padding: '8px 14px', borderRadius: 20, background: '#4F46E5', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>💰 Gửi</button>
                  <button type="button" onClick={() => setShowOfferInput(false)} style={{ padding: '8px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer' }}>✕</button>
                </>
                : <>
                  <input type="text" value={newMessageContent} onChange={e => setNewMessageContent(e.target.value)} placeholder="Aa" className={`flex-1 rounded-full px-4 py-2 outline-none text-[15px] ${panicMode ? 'bg-slate-700 text-white' : 'bg-[#F0F2F5] text-black'}`} />
                  <button type="submit" disabled={!newMessageContent.trim() && !newChatImage} className="px-2 group">
                    <Icons.Send className={`w-5 h-5 ${(!newMessageContent.trim() && !newChatImage) ? 'text-gray-400' : 'text-indigo-600 group-hover:scale-110 transition'}`} />
                  </button>
                </>
              }
            </div>
          </form>}
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showProfileEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4">
          <div className={`p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg border max-h-[90vh] overflow-y-auto hover-scrollbar ${panicMode ? 'bg-slate-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-black'}`}>
            <div className={`flex justify-between items-center mb-6 border-b pb-4 ${panicMode ? 'border-gray-700' : ''}`}><h3 className="text-xl font-black">Chỉnh sửa hồ sơ</h3><button onClick={() => setShowProfileEditModal(false)} className={`w-8 h-8 rounded-full font-bold flex items-center justify-center ${panicMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}><Icons.X className="w-4 h-4" /></button></div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Tên hiển thị</label><input type="text" value={profileForm.fullName || ''} onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`} /></div>
                <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2"><input type="checkbox" checked={profileForm.showMajor ?? true} onChange={e => setProfileForm({ ...profileForm, showMajor: e.target.checked })} className="w-3 h-3" /> Hiện Lớp/Ngành</label><input type="text" value={profileForm.major || ''} onChange={e => setProfileForm({ ...profileForm, major: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`} /></div>
                <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2"><input type="checkbox" checked={profileForm.showDob ?? true} onChange={e => setProfileForm({ ...profileForm, showDob: e.target.checked })} className="w-3 h-3" /> Hiện Ngày sinh</label><input type="date" value={profileForm.dob || ''} onChange={e => setProfileForm({ ...profileForm, dob: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`} /></div>
                <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2"><input type="checkbox" checked={profileForm.showGender ?? true} onChange={e => setProfileForm({ ...profileForm, showGender: e.target.checked })} className="w-3 h-3" /> Hiện Giới tính</label><select value={profileForm.gender || ''} onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`}><option value="">Chọn giới tính</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">Tên trường Đại học đang học</label><input type="text" placeholder="VD: Đại học Quy Nhơn" value={profileForm.schoolName || ''} onChange={e => setProfileForm({ ...profileForm, schoolName: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`} /></div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">Định vị GPS (Dùng cho Check-in)</label>
                  <div className="flex flex-row gap-2 w-full">
                    <input type="text" readOnly placeholder="Nhấn nút tải tọa độ" value={profileForm.schoolLat ? `${profileForm.schoolLat}, ${profileForm.schoolLng}` : ''} className={`flex-1 border p-2.5 rounded-lg outline-none text-sm w-full min-w-0 ${panicMode ? 'bg-slate-600 border-gray-500 text-gray-300' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`} />
                    <button type="button" onClick={async () => {
                      if (!profileForm.schoolName) return showAlert("Vui lòng nhập tên trường Đại học đang học!");
                      try {
                        const searchQ = encodeURIComponent(profileForm.schoolName);
                        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${searchQ}&format=json&limit=1`);
                        const json = await r.json();
                        if (json && json.length > 0) {
                          setProfileForm({ ...profileForm, schoolLat: parseFloat(json[0].lat), schoolLng: parseFloat(json[0].lon) });
                          showAlert("✅ Lấy định vị thành công!");
                        } else {
                          showAlert("Không tìm thấy tọa độ. Vui lòng nhập cụ thể tên trường hơn!");
                        }
                      } catch (err) { showAlert("Lỗi khi lấy định vị."); }
                    }} className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 sm:px-4 py-2 rounded-lg text-sm whitespace-nowrap flex-shrink-0 flex items-center gap-1.5"><Icons.MapPin className="w-4 h-4" /> Lấy tọa độ</button>
                  </div>
                </div>
              </div>
              <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2"><input type="checkbox" checked={profileForm.showHometown ?? true} onChange={e => setProfileForm({ ...profileForm, showHometown: e.target.checked })} className="w-3 h-3" /> Hiện Quê quán</label><input type="text" placeholder="VD: Hà Nội, Việt Nam" value={profileForm.hometown || ''} onChange={e => setProfileForm({ ...profileForm, hometown: e.target.value })} className={`w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`} /></div>
              <div><label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-2"><input type="checkbox" checked={profileForm.showBio ?? true} onChange={e => setProfileForm({ ...profileForm, showBio: e.target.checked })} className="w-3 h-3" /> Hiện Tiểu sử</label><textarea value={profileForm.bio || ''} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} rows="2" className={`w-full border p-2.5 rounded-lg outline-none resize-none focus:border-indigo-500 ${panicMode ? 'bg-slate-700 border-gray-600 text-white' : 'bg-white'}`}></textarea></div>
              <div className={`border-t pt-4 ${panicMode ? 'border-gray-700' : ''}`}>
                <p className="text-sm font-bold mb-2">Ảnh Đại Diện & Ảnh Bìa</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full border-4 border-gray-200 overflow-hidden shadow-sm bg-gray-100 relative group">
                      {profileForm.avatarUrl ? (
                        <img src={profileForm.avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl"><Icons.User className="w-8 h-8 text-slate-400" /></div>
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                        <span className="text-white text-xs font-bold text-center flex flex-col items-center gap-1"><Icons.Camera className="w-4 h-4" /> Đổi Avatar</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatarUrl')} />
                      </label>
                    </div>
                    <label className={`text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition flex items-center gap-2 ${panicMode ? 'bg-slate-700 hover:bg-slate-600 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border'}`}>
                      Chọn Avatar
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatarUrl')} />
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="w-full h-24 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden shadow-sm bg-gray-100 relative group">
                      {profileForm.coverUrl ? (
                        <img src={profileForm.coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl"><Icons.Image className="w-8 h-8 text-slate-400" /></div>
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                        <span className="text-white text-xs font-bold text-center flex flex-col items-center gap-1"><Icons.Camera className="w-4 h-4" /> Đổi Ảnh Bìa</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverUrl')} />
                      </label>
                    </div>
                    <label className={`text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition flex items-center gap-2 ${panicMode ? 'bg-slate-700 hover:bg-slate-600 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border'}`}>
                      Chọn Ảnh Bìa
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverUrl')} />
                    </label>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={isUploading} className={`w-full ${isUploading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-lg mt-4 shadow-md transition`}>
                {isUploading ? "Đang xử lý ảnh..." : "Lưu Hồ Sơ"}
              </button>
            </form>
          </div>

          {/* CROPPER MODAL */}
          {cropperImage && (
            <ImageCropperModal
              imageSrc={cropperImage}
              aspectRatio={cropperAspect}
              onCancel={() => { setCropperImage(null); setCropperField(null); }}
              onCropDone={handleCropComplete}
              onError={(msg) => showAlert(msg, 'error')}
            />
          )}
        </div>
      )}


      {/* ===== GLOBAL POPUP SYSTEM ===== */}
      {/* ALERT POPUP */}
      {globalAlert && (() => {
        const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const colorMap = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#e11d48' };
        const bgMap = { success: '#f0fdf4', error: '#fef2f2', warning: '#fffbeb', info: '#fff1f2' };
        const t = globalAlert.type || 'info';
        return (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setGlobalAlert(null)} style={{ backdropFilter: 'blur(4px)' }}>
            <div className={`max-w-sm w-full shadow-2xl rounded-2xl overflow-hidden`} style={{ animation: 'popIn 0.22s cubic-bezier(.34,1.56,.64,1)' }} onClick={e => e.stopPropagation()}>
              <div style={{ background: 'white', padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{iconMap[t]}</span>
                <span style={{ color: '#4F46E5', fontWeight: 800, fontSize: 17, flex: 1 }}>Thông báo</span>
                <button onClick={() => setGlobalAlert(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✕</button>
              </div>
              <div style={{ background: 'white', padding: '18px 22px 20px' }}>
                <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{globalAlert.msg}</p>
                <button onClick={() => setGlobalAlert(null)} style={{ marginTop: 18, width: '100%', padding: '11px 0', borderRadius: 12, background: '#4F46E5', border: 'none', color: 'white', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>Đã hiểu</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM POPUP */}
      {globalConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="max-w-sm w-full shadow-2xl rounded-2xl overflow-hidden" style={{ animation: 'popIn 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ background: 'white', padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 24 }}>❓</span>
              <span style={{ color: '#4F46E5', fontWeight: 800, fontSize: 17 }}>Xác nhận</span>
            </div>
            <div style={{ background: 'white', padding: '18px 22px 20px' }}>
              <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{globalConfirm.msg}</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => { globalConfirm.resolve(false); setGlobalConfirm(null); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#f1f5f9', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>Hủy</button>
                <button onClick={() => { globalConfirm.resolve(true); setGlobalConfirm(null); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#4F46E5', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROMPT POPUP */}
      {globalPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="max-w-sm w-full shadow-2xl rounded-2xl overflow-hidden" style={{ animation: 'popIn 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ background: 'white', padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 24 }}>✏️</span>
              <span style={{ color: '#4F46E5', fontWeight: 800, fontSize: 17 }}>Nhập thông tin</span>
            </div>
            <div style={{ background: 'white', padding: '18px 22px 20px' }}>
              <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-line' }}>{globalPrompt.msg}</p>
              <input
                autoFocus
                value={promptInputVal}
                onChange={e => setPromptInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { globalPrompt.resolve(promptInputVal); setGlobalPrompt(null); } if (e.key === 'Escape') { globalPrompt.resolve(null); setGlobalPrompt(null); } }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '2px solid #e2e8f0', outline: 'none', fontSize: 14.5, boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#4F46E5'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => { globalPrompt.resolve(null); setGlobalPrompt(null); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#f1f5f9', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>Hủy</button>
                <button onClick={() => { globalPrompt.resolve(promptInputVal); setGlobalPrompt(null); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#4F46E5', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN WARNING MODAL */}
      {showCheckInWarning && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-slide-up ${panicMode ? 'bg-slate-800 text-white border border-gray-700' : 'bg-white text-black border border-gray-200'}`}>
            <h3 className="text-xl font-bold mb-3 text-indigo-600 flex items-center gap-2">⚠️ Lỗi điểm danh</h3>
            <p className="mb-6 text-sm">Bạn chưa điền Tên trường và Định vị GPS của trường đang học. Để tiếp tục điểm danh vào lớp, vui lòng cập nhật thông tin này trong phần Chỉnh sửa hồ sơ.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCheckInWarning(false)} className={`px-4 py-2 font-bold rounded-lg ${panicMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} transition`}>Trở lại</button>
              <button onClick={() => { setShowCheckInWarning(false); setShowMobileMenu(false); setShowProfileEditModal(true); }} className="px-4 py-2 font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Cập nhật ngay</button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING AI TUTOR BUTTON - Hiển thị mọi tab */}
      {aiTutorTucked ? (
        <button
          onClick={() => { setAiTutorTucked(false); setShowAiTutorFloat(true); setAiTutorMinimized(false); }}
          className="fixed right-0 bottom-[120px] md:bottom-[60px] w-8 h-12 bg-[#9C27B0] hover:bg-[#7B1FA2] text-white rounded-l-xl shadow-lg flex items-center justify-center text-lg z-[80] transition-all hover:w-10"
          title="Mở UniBot"
        >
          ❮
        </button>
      ) : showAiTutorFloat ? (
        <div className="fixed bottom-[80px] md:bottom-6 right-4 md:right-6 w-[90vw] max-w-[380px] h-[500px] md:h-[520px] z-[80] flex flex-col rounded-2xl shadow-[0_0_40px_rgba(156,39,176,0.3)] border border-purple-200 overflow-hidden bg-white">
          <div className="bg-[#9C27B0] p-3 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">🤖</div>
              <div>
                <h4 className="font-bold text-[15px]">UniBot</h4>
                <p className="text-[11px] text-purple-200">Sẵn sàng giải đáp mọi thứ</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setShowAiTutorFloat(false); setAiTutorMinimized(true); }}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold transition"
                title="Thu nhỏ"
              >➖</button>
              <button
                onClick={() => { setShowAiTutorFloat(false); setAiTutorTucked(true); setAiTutorMinimized(false); }}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold transition"
                title="Đóng & Nép vào góc"
              >✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <AiTutorScreen onBack={() => setShowAiTutorFloat(false)} user={user} isFloating={true} />
          </div>
        </div>
      ) : (
        <motion.div
          drag
          dragMomentum={false}
          className="fixed bottom-[80px] right-6 z-[80] cursor-grab active:cursor-grabbing"
          initial={{ y: 0 }}
        >
          {aiTutorMinimized ? (
            <button
              onClick={() => { setAiTutorMinimized(false); setShowAiTutorFloat(true); }}
              className="w-12 h-12 bg-[#9C27B0] hover:bg-[#7B1FA2] text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-all hover:scale-110 opacity-80 hover:opacity-100 touch-none"
              title="Mở lại UniBot"
            >
              🤖
            </button>
          ) : (
            <button
              onClick={() => setShowAiTutorFloat(true)}
              className="w-14 h-14 bg-[#9C27B0] hover:bg-[#7B1FA2] text-white rounded-full shadow-[0_4px_20px_rgba(156,39,176,0.5)] flex items-center justify-center text-2xl transition-all hover:scale-110 touch-none"
              title="Mở UniBot"
            >
              🤖
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// KHỐI COMPONENT CHỨA LOGIC ĐĂNG NHẬP GOOGLE CLASSROOM
const GoogleClassroomSyncButton = ({ userId, onSyncSuccess, showAlert }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSyncMock = async () => {
    setIsSyncing(true);
    try {
      const res = await axios.post('/api/tasks/sync-google', {
        userId,
        code: 'MOCK_CODE'
      });
      if (res.data.success) {
        setSyncResult({ message: res.data.message });
        onSyncSuccess();
      } else {
        showAlert(res.data.message);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || "Lỗi đồng bộ giả lập. Vui lòng thử lại.");
    } finally {
      setIsSyncing(false);
    }
  };

  const login = useGoogleLogin({
    flow: 'auth-code', // Yêu cầu trả về Authorization Code (để lấy Refresh Token) thay vì Access Token
    onSuccess: async (codeResponse) => {
      setIsSyncing(true);
      try {
        const res = await axios.post('/api/tasks/sync-google', {
          userId,
          code: codeResponse.code
        });
        if (res.data.success) {
          setSyncResult({ message: res.data.message });
          onSyncSuccess();
        } else {
          showAlert(res.data.message);
        }
      } catch (err) {
        showAlert(err.response?.data?.message || "Lỗi đồng bộ. Vui lòng thử lại.");
      } finally {
        setIsSyncing(false);
      }
    },
    onError: (error) => {
      console.error("Đăng nhập Google thất bại", error);
      showAlert("Lỗi đăng nhập Google!");
    },
    // Chú ý: Yêu cầu cấp quyền xem Classroom CourseWork
    scope: 'https://www.googleapis.com/auth/classroom.coursework.me.readonly https://www.googleapis.com/auth/classroom.courses.readonly'
  });

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        onClick={() => login()}
        disabled={isSyncing}
        className="bg-white flex items-center justify-center gap-2 text-green-700 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow border border-green-200 hover:bg-green-50 transition active-scale"
        title="Liên kết và đồng bộ trực tiếp từ tài khoản Google của bạn"
      >
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/59/Google_Classroom_Logo.png" alt="Google Classroom" className="w-4 h-4" />
        {isSyncing ? "Đang đồng bộ..." : "Đăng nhập Google"}
      </button>



      {/* Popup thông báo thành công */}
      {syncResult && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center" style={{ animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Đồng bộ thành công!</h3>
            <p className="text-sm text-gray-500 mb-6">{syncResult.message}</p>
            <button
              onClick={() => {
                setSyncResult(null);
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }}
              className="bg-indigo-600 text-white font-bold w-full py-2.5 rounded-xl hover:bg-indigo-700 transition"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// BẢO TÀN BẢO ỨNG DỤNG TRONG GOOGLE OAUTH PROVIDER
// THAY THẾ CHỖ NÀY BẰNG CLIENT ID CỦA BẠN (HOẶC LOAD TỪ .ENV CHÍNH LÀ 'import.meta.env.VITE_GOOGLE_CLIENT_ID')
const AppWrapper = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE"}>
    <App />
  </GoogleOAuthProvider>
);

export default AppWrapper;

