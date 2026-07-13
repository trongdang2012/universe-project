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
          subject: `🚨 THI: ${e.subject}`,
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
      case 'class': return <Icons.BookOpen className="w-4 h-4 text-indigo-500" />;
      case 'exam': return <Icons.AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'task': return <Icons.CheckSquare className="w-4 h-4 text-amber-500" />;
      case 'free': return '🌴';
      default: return <Icons.Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBorderColor = (type) => {
    switch (type) {
      case 'class': return 'border-l-indigo-500';
      case 'exam': return 'border-l-red-500';
      case 'task': return 'border-l-amber-500';
      case 'free': return 'border-l-green-500';
      default: return 'border-l-gray-300';
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

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes popOut {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3) translateY(-10px); opacity: 0.8; }
          100% { transform: scale(1) translateY(-20px); opacity: 0; }
        }
        .celebrate-anim::after {
          content: "🎉 +1";
          position: absolute;
          right: -20px;
          top: -10px;
          color: #f59e0b;
          font-weight: bold;
          font-size: 14px;
          animation: popOut 1s ease-out forwards;
          pointer-events: none;
        }
      `}</style>

      {/* HEADER TABS - Pill design */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex gap-1.5 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('smart')} 
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'smart' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
          >
            <Icons.Zap className="w-4 h-4" />
            Lịch Học & Task
          </button>
          <button 
            onClick={() => setActiveTab('marks')} 
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'marks' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
          >
            <Icons.Award className="w-4 h-4" />
            Kết Quả Học Tập
          </button>
        </div>
        <button onClick={onBack} className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-bold px-3 py-2 rounded-xl hover:bg-slate-50 transition">
          ✕ Đóng
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'smart' && (
          <motion.div 
            key="smart-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* 1. THANH TIẾN ĐỘ TUẦN */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/10">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                  <Icons.Zap className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h4 className="font-black text-xl tracking-tight">Lịch Học Thông Minh</h4>
                  <p className="text-indigo-100 text-xs">AI đồng hành và tối ưu hóa lộ trình cá nhân của bạn.</p>
                </div>
              </div>

              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-lg">
                <div className="flex justify-between items-end mb-2.5">
                  <h5 className="font-bold text-[14px]">Tiến độ tuần này</h5>
                  <span className="font-black text-2xl text-yellow-300">{progress.percent}%</span>
                </div>
                <div className="h-3.5 w-full bg-black/15 rounded-full overflow-hidden shadow-inner p-0.5 border border-white/5">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(253,224,71,0.5)] ${progress.percent === 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-yellow-300 to-amber-300'}`} 
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
                <p className="text-[12px] mt-2.5 text-indigo-100 font-medium">
                  {progress.total === 0 ? 'Chưa có công việc hoặc môn thi nào trong tuần.' 
                    : `Đã hoàn thành ${progress.done}/${progress.total} mục tiêu tuần. ${progress.percent >= 100 ? 'Quá đỉnh! 🎉' : progress.percent >= 80 ? 'Xuất sắc! 🔥' : progress.percent >= 50 ? 'Cố lên nhé 🚀' : 'Bắt đầu thôi nào 💪'}`}
                </p>
              </div>
            </div>

            {/* 2. LỊCH THI */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-[15px] text-slate-800 flex items-center gap-2">
                  <span className="bg-rose-50 text-rose-500 w-9 h-9 rounded-xl flex items-center justify-center border border-rose-100"><Icons.Edit className="w-4 h-4" /></span>
                  Lịch thi sắp tới
                  {upcomingExams.length > 0 && <span className="text-[10px] bg-rose-100 text-rose-600 font-black px-2.5 py-0.5 rounded-full">{upcomingExams.length}</span>}
                </h4>
                <button 
                  onClick={() => setShowExamForm(!showExamForm)} 
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all duration-300 active-scale ${showExamForm ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'}`}
                >
                  {showExamForm ? '✕ Hủy' : '+ Thêm lịch thi'}
                </button>
              </div>

              <AnimatePresence>
                {showExamForm && (
                  <motion.form 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddExam} 
                    className="p-4 bg-rose-50/50 rounded-2xl mb-4 border border-rose-100/50 space-y-3 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-rose-700 pl-1">Tên môn học</label>
                        <input type="text" placeholder="Môn thi *" required value={examForm.subject} onChange={e => setExamForm({...examForm, subject: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-xl outline-none focus:border-rose-400 text-sm bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-rose-700 pl-1">Ngày thi</label>
                        <input type="date" required value={examForm.examDate} onChange={e => setExamForm({...examForm, examDate: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-xl outline-none focus:border-rose-400 text-sm bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-rose-700 pl-1">Giờ thi (Không bắt buộc)</label>
                        <input type="time" value={examForm.examTime} onChange={e => setExamForm({...examForm, examTime: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-xl outline-none focus:border-rose-400 text-sm bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-rose-700 pl-1">Phòng thi (Không bắt buộc)</label>
                        <input type="text" placeholder="Ví dụ: A3.204" value={examForm.room} onChange={e => setExamForm({...examForm, room: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-xl outline-none focus:border-rose-400 text-sm bg-white" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="btn-gradient-rose font-bold px-6 py-2.5 rounded-xl text-xs active-scale">Lưu Lịch Thi</button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {upcomingExams.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Icons.FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-400">Bạn chưa có lịch thi nào sắp tới.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingExams.map(exam => {
                    const examDate = new Date(exam.examDate);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const daysLeft = Math.ceil((examDate - today) / (1000*60*60*24));
                    const isUrgent = daysLeft <= 3;
                    
                    return (
                      <div key={exam.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all duration-300 hover:shadow-sm relative group ${isUrgent ? 'bg-rose-50/80 border-rose-100' : 'bg-slate-50/70 border-slate-100 hover:bg-slate-50'}`}>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${isUrgent ? 'bg-rose-200/50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-500'}`}>
                          {isUrgent ? <Icons.AlertTriangle className="w-5 h-5" /> : <Icons.FileText className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-[14px] text-slate-800 truncate">{exam.subject}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600"><Icons.Calendar className="w-3 h-3 text-indigo-500" /> {formatDateVN(exam.examDate)}</span>
                            {exam.examTime && <span className="text-[10px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600"><Icons.Clock className="w-3 h-3 text-indigo-500" /> {exam.examTime}</span>}
                            {exam.room && <span className="text-[10px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600"><Icons.MapPin className="w-3 h-3 text-indigo-500" /> {exam.room}</span>}
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${daysLeft === 0 ? 'bg-rose-600 text-white' : isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {daysLeft === 0 ? '🔥 HÔM NAY' : daysLeft === 1 ? '⚡ NGÀY MAI' : `Còn ${daysLeft} ngày`}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteExam(exam.id)} className="opacity-0 group-hover:opacity-100 absolute -top-2.5 -right-2.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-all duration-300">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. GỢI Ý NHIỆM VỤ */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-[15px] text-slate-800 flex items-center gap-2">
                  <span className="bg-indigo-50 text-indigo-500 w-9 h-9 rounded-xl flex items-center justify-center border border-indigo-100"><Icons.Cpu className="w-4 h-4" /></span>
                  Gợi ý công việc {suggestDay === 'Hôm nay' ? 'hôm nay' : suggestDay.toLowerCase()}
                </h4>
                <div className="relative">
                  <button 
                    onClick={() => setSuggestDropdownOpen(!suggestDropdownOpen)} 
                    className="px-3.5 py-2 text-xs rounded-xl font-bold border bg-indigo-600 text-white border-indigo-600 flex items-center gap-2 outline-none shadow-sm hover:bg-indigo-700 transition active-scale"
                  >
                    <Icons.Calendar className="w-3.5 h-3.5" /> {suggestDay} <span className="text-[8px]">{suggestDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {suggestDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-40 bg-white border border-gray-100 shadow-xl rounded-2xl z-20 overflow-y-auto max-h-[200px] py-1 animate-slide-up">
                      {dayOptions.map(day => (
                        <div key={day} onClick={() => { setSuggestDay(day); setSuggestDropdownOpen(false); }} className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition ${suggestDay === day ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}>
                          {day}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {suggestions.map(item => {
                  const isDone = doneSuggestions.includes(item.id);
                  const canToggle = item.type !== 'free';
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl flex items-start gap-4 transition-all duration-300 border border-l-4 relative ${getTypeBorderColor(item.type)} ${isDone ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-slate-50/20 border-slate-100 hover:shadow-md hover:bg-white'}`}
                    >
                      {canToggle && (
                        <div 
                          onClick={() => toggleSuggestionDone(item.id)} 
                          className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 cursor-pointer transition-all duration-300 ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white hover:border-indigo-500'} ${celebratingId === item.id ? 'celebrate-anim' : ''}`}
                        >
                          {isDone && <Icons.Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      )}
                      {!canToggle && (
                        <div className="mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-base">
                          {getTypeIcon(item.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-[14px] leading-tight mb-1 flex items-center gap-1.5 ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.subject}
                        </p>
                        <p className={`text-[12px] font-medium leading-snug ${isDone ? 'text-slate-400' : 'text-slate-500'}`}>{item.task}</p>
                        {item.time && (
                          <span className={`text-[10px] font-bold mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isDone ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-indigo-50/50 border-indigo-100 text-indigo-600'}`}>
                            <Icons.Clock className="w-3.5 h-3.5 text-indigo-500" /> {item.time}
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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* THỐNG KÊ ĐIỂM SỐ - CARD TIỆN ÍCH */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-2xl text-white shadow-lg border border-indigo-400/20">
                <span className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider block mb-1">GPA Tích Lũy (4)</span>
                <span className="text-2xl font-black">{stats.gpa4}</span>
                <Icons.Award className="w-5 h-5 text-indigo-200/50 absolute right-3 bottom-3" />
              </div>
              <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-4 rounded-2xl text-white shadow-lg border border-violet-400/20">
                <span className="text-[10px] text-violet-100 font-bold uppercase tracking-wider block mb-1">GPA Hệ 10</span>
                <span className="text-2xl font-black">{stats.gpa10}</span>
                <Icons.BookOpen className="w-5 h-5 text-violet-200/50 absolute right-3 bottom-3" />
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl text-white shadow-lg border border-emerald-400/20">
                <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider block mb-1">Tín chỉ tích lũy</span>
                <span className="text-2xl font-black">{stats.totalCredits} TC</span>
                <Icons.Check className="w-5 h-5 text-emerald-200/50 absolute right-3 bottom-3" />
              </div>
            </div>

            {/* BỘ LỌC ĐIỂM THI VÀ ĐỒNG BỘ */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 items-center">
                <button 
                  onClick={() => setMarksFilter('ALL')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${marksFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  Tất cả ({marks.length})
                </button>
                <button 
                  onClick={() => setMarksFilter('PASSED')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${marksFilter === 'PASSED' ? 'bg-emerald-500 text-white' : 'bg-emerald-50/50 text-emerald-600 hover:bg-emerald-50'}`}
                >
                  Đạt môn ({marks.filter(m => m.co_diem && m.result === 'Dat').length})
                </button>
                <button 
                  onClick={() => setMarksFilter('FAILED')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${marksFilter === 'FAILED' ? 'bg-red-500 text-white' : 'bg-red-50/50 text-red-600 hover:bg-red-50'}`}
                >
                  Học lại ({marks.filter(m => m.co_diem && m.result === 'Khong dat').length})
                </button>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <input 
                    type="text" 
                    placeholder="Tìm môn học..."
                    value={searchMarkQuery}
                    onChange={e => setSearchMarkQuery(e.target.value)}
                    className="w-full border border-slate-200 py-1.5 pl-8 pr-3 rounded-xl outline-none focus:border-indigo-400 text-xs bg-slate-50/50"
                  />
                  <Icons.Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                <button 
                  onClick={() => setShowSyncModal(true)} 
                  className="bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold px-3.5 py-1.5 rounded-xl text-xs hover:bg-indigo-100 transition flex items-center gap-1.5 active-scale flex-shrink-0"
                >
                  <Icons.RefreshCw className={`w-3.5 h-3.5 ${isSyncingMarks ? 'animate-spin' : ''}`} />
                  Đồng bộ điểm QNU
                </button>
              </div>
            </div>

            {/* DANH SÁCH BẢNG ĐIỂM CHIA THEO HỌC KỲ */}
            {isLoadingMarks ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Icons.RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-500">Đang tải bảng điểm từ CSDL...</p>
              </div>
            ) : Object.keys(semesterGroups).length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 bg-slate-50/30">
                <Icons.Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 mb-1">Chưa có dữ liệu điểm học tập.</p>
                <p className="text-[11px] text-slate-400 mb-3">Nhấn "Đồng bộ điểm QNU" để cào điểm trực tiếp từ cổng đào tạo.</p>
                <button 
                  onClick={() => setShowSyncModal(true)}
                  className="btn-gradient-indigo px-4 py-2 rounded-xl text-xs font-bold active-scale"
                >
                  Kết nối tài khoản QNU
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(semesterGroups).map(([semesterName, semesterMarks]) => {
                  const filtered = filterMarks(semesterMarks);
                  if (filtered.length === 0) return null;

                  return (
                    <div key={semesterName} className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b border-gray-150 flex justify-between items-center">
                        <span className="font-extrabold text-[13px] text-slate-700">{semesterName}</span>
                        <span className="text-[10px] font-bold bg-white text-slate-500 border px-2.5 py-0.5 rounded-full">{filtered.length} học phần</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                              <th className="py-2.5 px-4 font-bold">Mã HP</th>
                              <th className="py-2.5 px-4 font-bold">Tên học phần</th>
                              <th className="py-2.5 px-4 font-bold text-center">Tín chỉ</th>
                              <th className="py-2.5 px-4 font-bold text-center">Hệ 10</th>
                              <th className="py-2.5 px-4 font-bold text-center">Hệ 4</th>
                              <th className="py-2.5 px-4 font-bold text-center">Điểm chữ</th>
                              <th className="py-2.5 px-4 font-bold text-center">Kết quả</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(m => {
                              // Màu sắc dựa trên điểm chữ
                              let markColor = 'text-slate-700';
                              let badgeColor = 'bg-slate-100 text-slate-600';
                              
                              if (m.gradeLetter === 'F') {
                                markColor = 'text-red-500 font-extrabold';
                                badgeColor = 'bg-red-50 text-red-600 border border-red-100';
                              } else if (['D', 'D+'].includes(m.gradeLetter)) {
                                markColor = 'text-amber-500 font-bold';
                                badgeColor = 'bg-amber-50 text-amber-600 border border-amber-100';
                              } else if (['A', 'A+', 'B+', 'B'].includes(m.gradeLetter)) {
                                markColor = 'text-emerald-500 font-extrabold';
                                badgeColor = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                              }

                              return (
                                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{m.subjectId}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800">{m.subject}</td>
                                  <td className="py-3 px-4 text-center font-bold text-slate-600">{m.credits}</td>
                                  <td className="py-3 px-4 text-center font-extrabold text-[13px]">{m.grade10 !== null ? m.grade10 : '-'}</td>
                                  <td className="py-3 px-4 text-center font-bold">{m.grade4 !== null ? m.grade4 : '-'}</td>
                                  <td className={`py-3 px-4 text-center ${markColor}`}>{m.gradeLetter || '-'}</td>
                                  <td className="py-3 px-4 text-center">
                                    {m.hasGrade ? (
                                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${badgeColor}`}>
                                        {m.result === 'Dat' ? 'Đạt' : 'Tạch'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 italic font-bold">Chưa có</span>
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

      {/* SYNC MARKS POPUP MODAL */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="bg-white rounded-3xl p-6 w-full max-w-[400px] border border-gray-100 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSyncModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold p-1 rounded-full hover:bg-slate-100 transition"
              >
                ✕
              </button>
              
              <div className="text-center mb-5 mt-2">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto mb-3">
                  <Icons.Award className="w-6 h-6" />
                </div>
                <h4 className="font-black text-lg text-slate-800">Đồng bộ điểm QNU</h4>
                <p className="text-xs text-slate-500 mt-1">Kết nối với hệ thống đào tạo để cập nhật điểm mới nhất.</p>
              </div>

              <form onSubmit={handleSyncMarks} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 pl-1 uppercase tracking-wider">Mã sinh viên (MSV)</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Nhập mã sinh viên..."
                    value={qnuCreds.username} 
                    onChange={e => setQnuCreds({ ...qnuCreds, username: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-2xl outline-none focus:border-indigo-500 text-sm bg-slate-50/50 text-slate-800"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 pl-1 uppercase tracking-wider">Mật khẩu cổng đào tạo</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Mật khẩu của bạn..."
                    value={qnuCreds.password} 
                    onChange={e => setQnuCreds({ ...qnuCreds, password: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-2xl outline-none focus:border-indigo-500 text-sm bg-slate-50/50 text-slate-800"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSyncingMarks}
                    className="w-full py-3.5 btn-gradient-indigo font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 active-scale disabled:opacity-50"
                  >
                    {isSyncingMarks ? (
                      <>
                        <Icons.RefreshCw className="w-4 h-4 animate-spin" />
                        Đang đồng bộ (mất 15s)...
                      </>
                    ) : (
                      <>
                        <Icons.RefreshCw className="w-4 h-4" />
                        Bắt đầu đồng bộ điểm
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
