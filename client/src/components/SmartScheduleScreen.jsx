import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Icons } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

const SmartScheduleScreen = ({ onBack, tasks = [], qnuSchedules = [], userId, user, showAlert, showConfirm }) => {
  const [activeTab, setActiveTab] = useState('smart'); // 'smart' (Lịch thông minh), 'marks' (Kết quả học tập)
  const [celebratingId, setCelebratingId] = useState(null);
  
  // Exams state
  const [exams, setExams] = useState([]);
  const [showExamForm, setShowExamForm] = useState(false);
  const [examForm, setExamForm] = useState({ subject: '', examDate: '', examTime: '', room: '' });

  // Marks/Grades state
  const [marks, setMarks] = useState([]);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [isSyncingMarks, setIsSyncingMarks] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [qnuCreds, setQnuCreds] = useState({ username: user?.qnuUsername || '', password: '' });
  const [marksFilter, setMarksFilter] = useState('ALL'); // 'ALL', 'PASSED', 'FAILED'
  const [searchMarkQuery, setSearchMarkQuery] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [doneSuggestions, setDoneSuggestions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`smart_done_${userId}`)) || []; }
    catch { return []; }
  });
  const [suggestDay, setSuggestDay] = useState('Hôm nay');
  const [suggestDropdownOpen, setSuggestDropdownOpen] = useState(false);

  // Fetch exams
  const fetchExams = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`/api/exams/${userId}`);
      if (res.data.success) setExams(res.data.data || []);
    } catch (e) {}
  }, [userId]);

  // Fetch marks từ database
  const fetchMarks = useCallback(async () => {
    if (!userId) return;
    setIsLoadingMarks(true);
    try {
      const res = await axios.get(`/api/qnu/marks/${userId}`);
      if (res.data.success) setMarks(res.data.data || []);
    } catch (e) {
      console.error("Lỗi lấy điểm:", e);
    } finally {
      setIsLoadingMarks(false);
    }
  }, [userId]);

  useEffect(() => { 
    fetchExams();
    fetchMarks();
  }, [fetchExams, fetchMarks]);

  // Đồng bộ điểm từ QNU API
  const handleSyncMarks = async (e) => {
    e.preventDefault();
    if (!qnuCreds.username || !qnuCreds.password) {
      return showAlert("Vui lòng nhập đầy đủ Mã sinh viên và Mật khẩu đào tạo!", "warning");
    }
    setIsSyncingMarks(true);
    try {
      const res = await axios.post('/api/qnu/sync-marks', {
        userId,
        username: qnuCreds.username,
        password: qnuCreds.password
      });
      if (res.data.success) {
        setMarks(res.data.data || []);
        showAlert(res.data.message || "Đồng bộ điểm thành công!", "success");
        setShowSyncModal(false);
        // Cập nhật qnuUsername trong local storage nếu có thay đổi
        if (user) {
          const updatedUser = { ...user, qnuUsername: qnuCreds.username };
          localStorage.setItem('universe_user', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {
      console.error("Lỗi đồng bộ điểm QNU:", err);
      showAlert(err.response?.data?.message || err.message || "Không thể đồng bộ điểm. Vui lòng kiểm tra lại tài khoản!", "error");
    } finally {
      setIsSyncingMarks(false);
    }
  };

  // Generate suggestions based on schedules, exams, tasks
  useEffect(() => {
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayOptions = ["Hôm nay", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentDayStr = dayNames[today.getDay()];
    
    // Calculate target date based on suggestDay
    let targetDate = new Date(today);
    let targetDayStr = currentDayStr;
    
    if (suggestDay !== "Hôm nay") {
      targetDayStr = suggestDay;
      const targetIndex = dayNames.indexOf(suggestDay);
      const currentIndex = today.getDay();
      let diff = targetIndex - currentIndex;
      if (diff <= 0) diff += 7;
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
    }
    
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const parseVnDate = (dateStr) => { if (!dateStr) return null; const parts = dateStr.split('/'); if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]); return null; };
    
    const items = [];
    
    // 1. Add classes from QNU schedule for target day
    const todaysClasses = qnuSchedules.filter(s => {
      if (s.dayOfWeek !== targetDayStr) return false;
      if (!s.startDate || !s.endDate) return true;
      const start = parseVnDate(s.startDate);
      const end = parseVnDate(s.endDate);
      if (!start || !end) return true;
      
      // Nếu là dữ liệu cũ của học kỳ trước (đã kết thúc), vẫn hiển thị theo thứ để phục vụ demo
      if (end < new Date()) return true;
      
      return targetDate >= start && targetDate <= end;
    });
    
    todaysClasses.forEach(s => {
      items.push({
        id: `class-${s.id}`,
        type: 'class',
        subject: s.subjectName,
        task: `Lớp học tại ${s.room || 'chưa rõ phòng'}`,
        time: formatQnuTime(s.timeInfo),
        sortTime: extractStartTime(s.timeInfo),
      });
    });
    
    // 2. Add exams happening on target day
    exams.forEach(e => {
      if (e.examDate === targetDateStr) {
        items.push({
          id: `exam-${e.id}`,
          type: 'exam',
          subject: `THI: ${e.subject}`,
          task: `Phòng: ${e.room || 'chưa rõ'}`,
          time: e.examTime || '',
          sortTime: e.examTime || '00:00',
        });
      }
    });
    
    // 3. Add upcoming tasks (deadline within 3 days of target)
    tasks.forEach(t => {
      const taskDate = new Date(t.dueDate);
      taskDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((taskDate - targetDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays <= 3) {
        items.push({
          id: `task-${t.id}`,
          type: 'task',
          subject: t.title,
          task: t.isLMS ? 'Đồng bộ từ hệ thống học tập' : 'Bài tập cá nhân',
          time: `Hạn chót: ${formatDateVN(t.dueDate)}`,
          sortTime: '23:59',
        });
      }
    });
    
    // Sort items by time
    items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
    
    // 4. If free, add a free session suggestion
    if (items.length === 0) {
      items.push({
        id: 'free',
        type: 'free',
        subject: 'Hôm nay bạn rảnh rỗi!',
        task: 'Tận hưởng ngày nghỉ hoặc đọc thêm sách tại UniVerse nhé.',
        time: '',
        sortTime: '00:00'
      });
    }
    
    setSuggestions(items);
  }, [suggestDay, qnuSchedules, exams, tasks]);

  // Weekly progress calculation
  const getWeeklyProgress = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0: CN, 1: T2, ..., 6: T7
    
    // Get start of week (Monday) and end of week (Sunday)
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    
    // Filter tasks for this week
    const weeklyTasks = tasks.filter(t => {
      const d = new Date(t.dueDate);
      return d >= monday && d <= sunday;
    });
    
    // Filter exams for this week
    const weeklyExams = exams.filter(e => {
      const d = new Date(e.examDate);
      return d >= monday && d <= sunday;
    });
    
    const total = weeklyTasks.length + weeklyExams.length;
    const taskIds = weeklyTasks.map(t => `task-${t.id}`);
    const examIds = weeklyExams.map(e => `exam-${e.id}`);
    const allIds = [...taskIds, ...examIds];
    
    const done = allIds.filter(id => doneSuggestions.includes(id)).length;
    const percent = total === 0 ? 100 : Math.round((done / total) * 100);
    
    return { done, total, percent };
  };

  const progress = getWeeklyProgress();

  const toggleSuggestionDone = (id) => {
    let nextDone;
    if (doneSuggestions.includes(id)) {
      nextDone = doneSuggestions.filter(item => item !== id);
    } else {
      nextDone = [...doneSuggestions, id];
      // Celebrate sound/animation trigger
      setCelebratingId(id);
      setTimeout(() => setCelebratingId(null), 1000);
    }
    setDoneSuggestions(nextDone);
    localStorage.setItem(`smart_done_${userId}`, JSON.stringify(nextDone));
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/exams', { ...examForm, userId });
      if (res.data.success) {
        setExams([res.data.data, ...exams]);
        setExamForm({ subject: '', examDate: '', examTime: '', room: '' });
        setShowExamForm(false);
        showAlert("Đã thêm lịch thi mới thành công!", "success");
      }
    } catch (err) {
      showAlert("Lỗi khi thêm lịch thi!");
    }
  };

  const handleDeleteExam = (id) => {
    showConfirm("Bạn có chắc chắn muốn xóa lịch thi này không?", async () => {
      try {
        const res = await axios.delete(`/api/exams/${id}`);
        if (res.data.success) {
          setExams(exams.filter(e => e.id !== id));
          showAlert("Đã xóa lịch thi thành công!", "info");
        }
      } catch (err) {
        showAlert("Lỗi khi xóa lịch thi!");
      }
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'class': return <Icons.BookOpen className="w-3.5 h-3.5" />;
      case 'exam': return <Icons.AlertTriangle className="w-3.5 h-3.5" />;
      case 'task': return <Icons.CheckSquare className="w-3.5 h-3.5" />;
      case 'free': return <Icons.Sun className="w-3.5 h-3.5" />;
      default: return <Icons.Zap className="w-3.5 h-3.5" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'class': return { dot: 'bg-zinc-800', text: 'text-zinc-700', border: 'border-zinc-200', bg: 'bg-zinc-50/60' };
      case 'exam': return { dot: 'bg-red-500', text: 'text-red-600', border: 'border-red-200/60', bg: 'bg-red-50/40' };
      case 'task': return { dot: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200/60', bg: 'bg-amber-50/40' };
      case 'free': return { dot: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200/60', bg: 'bg-emerald-50/40' };
      default: return { dot: 'bg-zinc-400', text: 'text-zinc-500', border: 'border-zinc-100', bg: 'bg-zinc-50/40' };
    }
  };

  const upcomingExams = exams.filter(e => {
    const examDate = new Date(e.examDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    return examDate >= today;
  });

  // Thống kê điểm số (GPA, Tín chỉ tích lũy)
  const getMarksStats = () => {
    const validGrades = marks.filter(m => m.co_diem && m.grade10 !== null);
    if (validGrades.length === 0) return { gpa10: 0, gpa4: 0, totalCredits: 0 };

    let totalCredits = 0;
    let sum10 = 0;
    let sum4 = 0;
    let creditsForGpa = 0;

    validGrades.forEach(g => {
      const tc = g.credits;
      if (g.result === 'Dat') {
        totalCredits += tc;
      }
      if (g.grade10 !== null && g.grade4 !== null) {
        sum10 += (g.grade10 * tc);
        sum4 += (g.grade4 * tc);
        creditsForGpa += tc;
      }
    });

    return {
      gpa10: creditsForGpa > 0 ? (sum10 / creditsForGpa).toFixed(2) : 0,
      gpa4: creditsForGpa > 0 ? (sum4 / creditsForGpa).toFixed(2) : 0,
      totalCredits
    };
  };

  const stats = getMarksStats();

  // Nhóm điểm theo học kỳ
  const getSemesterGroups = () => {
    const groups = {};
    marks.forEach(m => {
      const sem = m.semester || 'Học kỳ khác';
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push(m);
    });
    // Sắp xếp các học kỳ mới nhất lên trên
    return Object.keys(groups).sort().reverse().reduce((obj, key) => {
      obj[key] = groups[key];
      return obj;
    }, {});
  };

  const semesterGroups = getSemesterGroups();

  // Lọc điểm theo điều kiện tìm kiếm và filter
  const filterMarks = (marksList) => {
    return marksList.filter(m => {
      const matchSearch = m.subject.toLowerCase().includes(searchMarkQuery.toLowerCase()) || 
                          m.subjectId.toLowerCase().includes(searchMarkQuery.toLowerCase());
      
      if (!matchSearch) return false;

      if (marksFilter === 'PASSED') return m.result === 'Dat';
      if (marksFilter === 'FAILED') return m.result === 'Khong dat';
      return true;
    });
  };

  const dayOptions = ["Hôm nay", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes popOut {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2) translateY(-8px); opacity: 0.7; }
          100% { transform: scale(1) translateY(-16px); opacity: 0; }
        }
        .celebrate-anim::after {
          content: "✓ Done";
          position: absolute;
          right: -16px;
          top: -8px;
          color: #18181b;
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.02em;
          animation: popOut 0.8s ease-out forwards;
          pointer-events: none;
        }
      `}</style>

      {/* ─── HEADER TABS ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 bg-zinc-100 p-0.5 rounded-lg">
          <button 
            onClick={() => setActiveTab('smart')} 
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200 ${activeTab === 'smart' ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Icons.Zap className="w-3.5 h-3.5" />
            Lịch & Công việc
          </button>
          <button 
            onClick={() => setActiveTab('marks')} 
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200 ${activeTab === 'marks' ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Icons.Award className="w-3.5 h-3.5" />
            Kết quả học tập
          </button>
        </div>
        <button onClick={onBack} className="hidden sm:flex items-center gap-1 text-[12px] text-zinc-400 hover:text-zinc-600 font-medium px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors">
          <Icons.X className="w-3.5 h-3.5" />
          Đóng
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'smart' && (
          <motion.div 
            key="smart-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* ─── 1. PROGRESS OVERVIEW ─── */}
            <div className="bg-zinc-900 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-white/90">Tiến độ tuần này</h3>
                  <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">
                    {progress.total === 0 ? 'Chưa có mục tiêu nào trong tuần.' 
                      : `Hoàn thành ${progress.done}/${progress.total} mục tiêu`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[28px] font-semibold tracking-tight tabular-nums">{progress.percent}<span className="text-[16px] text-zinc-500 font-normal">%</span></span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${progress.percent >= 100 ? 'bg-emerald-400' : 'bg-white'}`} 
                  style={{ width: `${progress.percent}%` }}
                ></div>
              </div>
              {progress.total > 0 && (
                <p className="text-[11px] text-zinc-500 mt-3 font-medium">
                  {progress.percent >= 100 ? 'Hoàn thành xuất sắc tuần này.' : progress.percent >= 80 ? 'Gần hoàn thành — cố gắng thêm.' : progress.percent >= 50 ? 'Nửa chặng đường.' : 'Bắt đầu thôi.'}
                </p>
              )}
            </div>

            {/* ─── 2. LỊCH THI ─── */}
            <div className="bg-white rounded-xl border border-zinc-200/70 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <h4 className="text-[13px] font-semibold text-zinc-800 tracking-tight">Lịch thi sắp tới</h4>
                  {upcomingExams.length > 0 && <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{upcomingExams.length}</span>}
                </div>
                <button 
                  onClick={() => setShowExamForm(!showExamForm)} 
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors ${showExamForm ? 'bg-zinc-100 text-zinc-600' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'}`}
                >
                  {showExamForm ? 'Hủy' : '+ Thêm'}
                </button>
              </div>

              <AnimatePresence>
                {showExamForm && (
                  <motion.form 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddExam} 
                    className="px-5 py-4 border-b border-zinc-100 overflow-hidden bg-zinc-50/50"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Tên môn học</label>
                        <input type="text" placeholder="VD: Toán cao cấp" required value={examForm.subject} onChange={e => setExamForm({...examForm, subject: e.target.value})} className="w-full border border-zinc-200 px-3 py-2 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Ngày thi</label>
                        <input type="date" required value={examForm.examDate} onChange={e => setExamForm({...examForm, examDate: e.target.value})} className="w-full border border-zinc-200 px-3 py-2 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Giờ thi</label>
                        <input type="time" value={examForm.examTime} onChange={e => setExamForm({...examForm, examTime: e.target.value})} className="w-full border border-zinc-200 px-3 py-2 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Phòng thi</label>
                        <input type="text" placeholder="VD: A3.204" value={examForm.room} onChange={e => setExamForm({...examForm, room: e.target.value})} className="w-full border border-zinc-200 px-3 py-2 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-3">
                      <button type="submit" className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-lg text-[12px] hover:bg-zinc-800 transition-colors">Lưu lịch thi</button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="px-5 py-4">
                {upcomingExams.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[12px] text-zinc-400 font-medium">Chưa có lịch thi nào sắp tới.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingExams.map(exam => {
                      const examDate = new Date(exam.examDate);
                      const today = new Date(); today.setHours(0,0,0,0);
                      const daysLeft = Math.ceil((examDate - today) / (1000*60*60*24));
                      const isUrgent = daysLeft <= 3;
                      
                      return (
                        <div key={exam.id} className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors relative group ${isUrgent ? 'border-red-200/70 bg-red-50/30' : 'border-zinc-100 bg-zinc-50/30 hover:bg-zinc-50'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isUrgent ? 'bg-red-500' : 'bg-zinc-300'}`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-zinc-800 truncate tracking-tight">{exam.subject}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1"><Icons.Calendar className="w-3 h-3" />{formatDateVN(exam.examDate)}</span>
                              {exam.examTime && <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1"><Icons.Clock className="w-3 h-3" />{exam.examTime}</span>}
                              {exam.room && <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1"><Icons.MapPin className="w-3 h-3" />{exam.room}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${daysLeft === 0 ? 'bg-red-500 text-white' : isUrgent ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                            {daysLeft === 0 ? 'Hôm nay' : daysLeft === 1 ? 'Ngày mai' : `${daysLeft} ngày`}
                          </span>
                          <button onClick={() => handleDeleteExam(exam.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all p-1 rounded">
                            <Icons.X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ─── 3. GỢI Ý CÔNG VIỆC ─── */}
            <div className="bg-white rounded-xl border border-zinc-200/70 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                  <h4 className="text-[13px] font-semibold text-zinc-800 tracking-tight">
                    Công việc {suggestDay === 'Hôm nay' ? 'hôm nay' : suggestDay.toLowerCase()}
                  </h4>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setSuggestDropdownOpen(!suggestDropdownOpen)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <Icons.Calendar className="w-3 h-3 text-zinc-400" />
                    {suggestDay}
                    <Icons.ChevronDown className="w-3 h-3 text-zinc-400" />
                  </button>
                  {suggestDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-36 bg-white border border-zinc-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-lg z-20 overflow-y-auto max-h-[200px] py-0.5">
                      {dayOptions.map(day => (
                        <div key={day} onClick={() => { setSuggestDay(day); setSuggestDropdownOpen(false); }} className={`px-3 py-2 text-[12px] font-medium cursor-pointer transition-colors ${suggestDay === day ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}`}>
                          {day}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {suggestions.map(item => {
                  const isDone = doneSuggestions.includes(item.id);
                  const canToggle = item.type !== 'free';
                  const colors = getTypeColor(item.type);
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-start gap-3.5 px-5 py-3.5 transition-all duration-200 relative ${isDone ? 'opacity-50' : 'hover:bg-zinc-50/60'}`}
                    >
                      {canToggle ? (
                        <div 
                          onClick={() => toggleSuggestionDone(item.id)} 
                          className={`mt-0.5 w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 border cursor-pointer transition-all duration-200 ${isDone ? 'bg-zinc-800 border-zinc-800' : 'border-zinc-300 bg-white hover:border-zinc-500'} ${celebratingId === item.id ? 'celebrate-anim' : ''}`}
                        >
                          {isDone && <Icons.Check className="w-3 h-3 text-white" />}
                        </div>
                      ) : (
                        <div className={`mt-0.5 w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 ${colors.text}`}>
                          {getTypeIcon(item.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <p className={`text-[13px] font-medium tracking-tight leading-tight ${isDone ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                            {item.subject}
                          </p>
                        </div>
                        <p className={`text-[11px] mt-1 ml-3.5 leading-relaxed ${isDone ? 'text-zinc-400' : 'text-zinc-500'}`}>{item.task}</p>
                        {item.time && (
                          <span className={`text-[10px] font-medium mt-2 ml-3.5 inline-flex items-center gap-1 px-2 py-0.5 rounded border ${isDone ? 'bg-zinc-50 border-zinc-100 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>
                            <Icons.Clock className="w-3 h-3" /> {item.time}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'marks' && (
          <motion.div 
            key="marks-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* ─── STATS ROW ─── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-zinc-200/70 rounded-xl px-4 py-4 relative overflow-hidden">
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1.5">GPA hệ 4</span>
                <span className="text-[22px] font-semibold tracking-tight text-zinc-900 tabular-nums">{stats.gpa4}</span>
                <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-zinc-50 rounded-full"></div>
              </div>
              <div className="bg-white border border-zinc-200/70 rounded-xl px-4 py-4 relative overflow-hidden">
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1.5">GPA hệ 10</span>
                <span className="text-[22px] font-semibold tracking-tight text-zinc-900 tabular-nums">{stats.gpa10}</span>
                <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-zinc-50 rounded-full"></div>
              </div>
              <div className="bg-white border border-zinc-200/70 rounded-xl px-4 py-4 relative overflow-hidden">
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1.5">Tín chỉ</span>
                <span className="text-[22px] font-semibold tracking-tight text-zinc-900 tabular-nums">{stats.totalCredits}<span className="text-[13px] text-zinc-400 font-normal ml-0.5">TC</span></span>
                <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-zinc-50 rounded-full"></div>
              </div>
            </div>

            {/* ─── TOOLBAR ─── */}
            <div className="bg-white rounded-xl border border-zinc-200/70 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {[
                  { key: 'ALL', label: `Tất cả (${marks.length})` },
                  { key: 'PASSED', label: `Đạt (${marks.filter(m => m.co_diem && m.result === 'Dat').length})` },
                  { key: 'FAILED', label: `Học lại (${marks.filter(m => m.co_diem && m.result === 'Khong dat').length})` },
                ].map(f => (
                  <button 
                    key={f.key}
                    onClick={() => setMarksFilter(f.key)} 
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${marksFilter === f.key ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-44">
                  <input 
                    type="text" 
                    placeholder="Tìm môn..."
                    value={searchMarkQuery}
                    onChange={e => setSearchMarkQuery(e.target.value)}
                    className="w-full border border-zinc-200 py-1.5 pl-7 pr-3 rounded-lg outline-none focus:border-zinc-400 text-[12px] bg-white text-zinc-800 transition-colors"
                  />
                  <Icons.Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-[9px]" />
                </div>
                <button 
                  onClick={() => setShowSyncModal(true)} 
                  className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors flex-shrink-0"
                >
                  <Icons.RefreshCw className={`w-3 h-3 ${isSyncingMarks ? 'animate-spin' : ''}`} />
                  Đồng bộ QNU
                </button>
              </div>
            </div>

            {/* ─── GRADES TABLE ─── */}
            {isLoadingMarks ? (
              <div className="text-center py-16 bg-white rounded-xl border border-zinc-200/70">
                <Icons.RefreshCw className="w-5 h-5 text-zinc-400 animate-spin mx-auto mb-3" />
                <p className="text-[12px] text-zinc-400 font-medium">Đang tải bảng điểm...</p>
              </div>
            ) : Object.keys(semesterGroups).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-zinc-200">
                <Icons.Award className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                <p className="text-[13px] font-medium text-zinc-500 mb-1">Chưa có dữ liệu điểm.</p>
                <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">Nhấn "Đồng bộ QNU" để lấy điểm từ cổng đào tạo.</p>
                <button 
                  onClick={() => setShowSyncModal(true)}
                  className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-lg text-[12px] hover:bg-zinc-800 transition-colors"
                >
                  Kết nối tài khoản
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(semesterGroups).map(([semesterName, semesterMarks]) => {
                  const filtered = filterMarks(semesterMarks);
                  if (filtered.length === 0) return null;

                  return (
                    <div key={semesterName} className="bg-white rounded-xl border border-zinc-200/70 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
                        <span className="text-[12px] font-semibold text-zinc-700 tracking-tight">{semesterName}</span>
                        <span className="text-[10px] font-medium text-zinc-400">{filtered.length} học phần</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-100">
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Mã HP</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Tên học phần</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center">TC</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center">Hệ 10</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center">Hệ 4</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center">Chữ</th>
                              <th className="py-2.5 px-4 text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center">KQ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(m => {
                              // Màu sắc dựa trên điểm chữ
                              let markColor = 'text-zinc-700';
                              let badgeStyle = 'bg-zinc-100 text-zinc-600';
                              
                              if (m.gradeLetter === 'F') {
                                markColor = 'text-red-600 font-semibold';
                                badgeStyle = 'bg-red-50 text-red-600';
                              } else if (['D', 'D+'].includes(m.gradeLetter)) {
                                markColor = 'text-amber-600 font-medium';
                                badgeStyle = 'bg-amber-50 text-amber-700';
                              } else if (['A', 'A+', 'B+', 'B'].includes(m.gradeLetter)) {
                                markColor = 'text-emerald-600 font-semibold';
                                badgeStyle = 'bg-emerald-50 text-emerald-700';
                              }

                              return (
                                <tr key={m.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                                  <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400">{m.subjectId}</td>
                                  <td className="py-2.5 px-4 text-[12px] font-medium text-zinc-800">{m.subject}</td>
                                  <td className="py-2.5 px-4 text-[12px] text-center font-medium text-zinc-600 tabular-nums">{m.credits}</td>
                                  <td className="py-2.5 px-4 text-[13px] text-center font-semibold tabular-nums">{m.grade10 !== null ? m.grade10 : '—'}</td>
                                  <td className="py-2.5 px-4 text-[12px] text-center font-medium tabular-nums">{m.grade4 !== null ? m.grade4 : '—'}</td>
                                  <td className={`py-2.5 px-4 text-[12px] text-center ${markColor}`}>{m.gradeLetter || '—'}</td>
                                  <td className="py-2.5 px-4 text-center">
                                    {m.hasGrade ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeStyle}`}>
                                        {m.result === 'Dat' ? 'Đạt' : 'Tạch'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-300 font-medium">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SYNC MODAL ─── */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-xl p-6 w-full max-w-[380px] border border-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative"
            >
              <button 
                onClick={() => setShowSyncModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5"
              >
                <Icons.X className="w-4 h-4" />
              </button>
              
              <div className="mb-5">
                <h4 className="text-[15px] font-semibold text-zinc-900 tracking-tight">Đồng bộ điểm QNU</h4>
                <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">Kết nối với cổng đào tạo để cập nhật điểm mới nhất.</p>
              </div>

              <form onSubmit={handleSyncMarks} className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Mã sinh viên</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Nhập mã sinh viên..."
                    value={qnuCreds.username} 
                    onChange={e => setQnuCreds({ ...qnuCreds, username: e.target.value })}
                    className="w-full border border-zinc-200 px-3 py-2.5 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Mật khẩu</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Mật khẩu cổng đào tạo..."
                    value={qnuCreds.password} 
                    onChange={e => setQnuCreds({ ...qnuCreds, password: e.target.value })}
                    className="w-full border border-zinc-200 px-3 py-2.5 rounded-lg outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 text-[13px] bg-white text-zinc-800 transition-colors"
                  />
                </div>

                <div className="pt-1">
                  <button 
                    type="submit" 
                    disabled={isSyncingMarks}
                    className="w-full py-2.5 bg-zinc-900 text-white font-medium rounded-lg text-[12px] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncingMarks ? (
                      <>
                        <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Đang đồng bộ...
                      </>
                    ) : (
                      <>
                        <Icons.RefreshCw className="w-3.5 h-3.5" />
                        Bắt đầu đồng bộ
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper functions
function extractStartTime(timeInfo) {
  if (!timeInfo) return '99:99';
  const match = timeInfo.match(/(\d+)\s*\(/);
  if (match) {
    const period = parseInt(match[1]);
    const timeMap = { 1:'07:00',2:'07:50',3:'09:00',4:'09:50',5:'10:40',6:'13:00',7:'13:50',8:'15:00',9:'15:50',10:'16:40',11:'17:30',12:'18:15',13:'19:00',14:'19:50',15:'20:40' };
    return timeMap[period] || '99:99';
  }
  return '99:99';
}

function formatQnuTime(timeInfo) {
  if (!timeInfo) return "";
  const match = timeInfo.match(/(\d+)\s*\((.*?)\)/);
  if (match) {
    let startT = match[2].replace('g', ':');
    return `${startT} (Tiết ${match[1]})`;
  }
  return timeInfo;
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default SmartScheduleScreen;
export { formatQnuTime };
