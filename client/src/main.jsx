import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWrapper from './App.jsx'
import axios from 'axios';

// ==========================================
// CẤU HÌNH GLOBAL CHO AXIOS (SIÊU QUAN TRỌNG)
// ==========================================
// 1. Tự động lấy URL của Backend từ biến môi trường (VITE_API_URL).
// Nếu chạy trên điện thoại, bạn cần đổi VITE_API_URL trong file .env thành link Ngrok của backend.
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'https://flashbulb-chemicals-partition.ngrok-free.dev';

// 2. Dòng thần thánh giúp API chui lọt qua bức tường cảnh báo của Ngrok
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
)
