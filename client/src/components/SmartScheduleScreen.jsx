import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Icons } from '../App';

const SmartScheduleScreen = ({ onBack, tasks = [], qnuSchedules = [], userId, showAlert, showConfirm }) => {
  const [celebratingId, setCelebratingId] = useState(null);
  // Exams state
  const [exams, setExams] = useState([]);
  const [showExamForm, setShowExamForm] = useState(false);
  const [examForm, setExamForm] = useState({ subject: '', examDate: '', examTime: '', room: '' });

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

  useEffect(() => { fetchExams(); }, [fetchExams]);

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
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((dueDate - targetDate) / (1000*60*60*24));
      if (diffDays >= 0 && diffDays <= 2) {
        const urgency = diffDays === 0 ? '⚠️ Hạn hôm nay' : diffDays === 1 ? '📌 Mai là hạn' : '📋 Còn 2 ngày';
        items.push({
          id: `task-${t.id}`,
          type: 'task',
          subject: t.title,
          task: urgency,
          time: `Hạn: ${formatDateVN(t.dueDate)}`,
          sortTime: '23:59',
        });
      }
    });
    
    // 4. Add study suggestions for exams coming within 7 days
    exams.forEach(e => {
      const examDate = new Date(e.examDate);
      examDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((examDate - targetDate) / (1000*60*60*24));
      if (diffDays > 0 && diffDays <= 7 && e.examDate !== targetDateStr) {
        items.push({
          id: `study-exam-${e.id}`,
          type: 'study',
          subject: `Ôn tập: ${e.subject}`,
          task: `Thi trong ${diffDays} ngày nữa`,
          time: '20:00 - 22:00',
          sortTime: '20:00',
        });
      }
    });
    
    // Sort by time
    items.sort((a, b) => (a.sortTime || '').localeCompare(b.sortTime || ''));
    
    // If empty, add a default
    if (items.length === 0) {
      items.push({
        id: 'free',
        type: 'free',
        subject: 'Ngày rảnh!',
        task: 'Không có lịch học. Hãy nghỉ ngơi hoặc ôn bài 📚',
        time: '',
        sortTime: '',
      });
    }
    
    setSuggestions(items);
  }, [suggestDay, qnuSchedules, tasks, exams]);

  // Save done suggestions
  useEffect(() => {
    if (userId) localStorage.setItem(`smart_done_${userId}`, JSON.stringify(doneSuggestions));
  }, [doneSuggestions, userId]);

  // Calculate progress
  const getWeekProgress = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Get start of week (Monday)
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(today.getDate() + diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    let total = 0;
    let done = 0;
    
    // Count tasks due this week
    tasks.forEach(t => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0,0,0,0);
      if (dueDate >= startOfWeek && dueDate <= endOfWeek) {
        total++;
        if (t.draftResult) done++;
      }
    });

    // Count ALL actionable suggestions as total (fixed number)
    const actionable = suggestions.filter(s => s.type !== 'free');
    total += actionable.length;
    
    // Count ticked suggestions as done
    actionable.forEach(s => {
      if (doneSuggestions.includes(s.id)) done++;
    });
    
    if (total === 0) return { percent: 0, done: 0, total: 0 };
    return { percent: Math.min(100, Math.round((done / total) * 100)), done, total };
  };

  const progress = getWeekProgress();

  // Exam handlers
  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!examForm.subject || !examForm.examDate) return;
    try {
      await axios.post('/api/exams', { ...examForm, userId });
      setExamForm({ subject: '', examDate: '', examTime: '', room: '' });
      setShowExamForm(false);
      fetchExams();
    } catch (err) { showAlert('Lỗi thêm lịch thi! Vui lòng thử lại.', 'error'); }
  };

  const handleDeleteExam = async (id) => {
    const confirmed = await showConfirm('Xóa lịch thi này?');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/exams/${id}`);
      fetchExams();
    } catch (err) {}
  };

  const toggleSuggestionDone = (id) => {
    setDoneSuggestions(prev => {
      const isCurrentlyDone = prev.includes(id);
      if (!isCurrentlyDone) {
        setCelebratingId(id);
        setTimeout(() => setCelebratingId(null), 1000);
        return [...prev, id];
      } else {
        return prev.filter(x => x !== id);
      }
    });
  };

  // Helpers
  const dayOptions = ["Hôm nay", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

  const getTypeIcon = (type) => {
    switch(type) {
      case 'class': return <Icons.School className="w-4 h-4" />;
      case 'exam': return <Icons.Edit className="w-4 h-4 text-rose-500" />;
      case 'task': return <Icons.CheckCircle className="w-4 h-4 text-indigo-500" />;
      case 'study': return <Icons.Brain className="w-4 h-4 text-purple-500" />;
      case 'free': return <Icons.Sun className="w-4 h-4 text-green-500" />;
      default: return <Icons.MapPin className="w-4 h-4" />;
    }
  };

  const getTypeBorderColor = (type) => {
    switch(type) {
      case 'class': return 'border-l-blue-500';
      case 'exam': return 'border-l-red-500';
      case 'task': return 'border-l-amber-500';
      case 'study': return 'border-l-purple-500';
      case 'free': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  // Calculate upcoming exams count
  const upcomingExams = exams.filter(e => {
    const examDate = new Date(e.examDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    return examDate >= today;
  });

  return (
    <div className="space-y-4">
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
      {/* 1. THANH TIẾN ĐỘ TUẦN */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 sm:rounded-2xl text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"><Icons.Zap className="w-6 h-6 text-yellow-300" /></div>
          <div>
            <h4 className="font-black text-lg">Lịch Học Thông Minh</h4>
            <p className="text-indigo-100 text-[13px]">AI tối ưu hoá thời gian cho một bộ não lười.</p>
          </div>
        </div>

        <div className="bg-white/15 p-4 rounded-2xl border border-white/20 backdrop-blur-md">
          <div className="flex justify-between items-end mb-2">
            <h5 className="font-bold text-[15px]">Tiến độ tuần này</h5>
            <span className="font-black text-xl text-yellow-300">{progress.percent}%</span>
          </div>
          <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden shadow-inner">
            <div className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(253,224,71,0.5)] ${progress.percent === 100 ? 'bg-green-400' : 'bg-yellow-300'}`} style={{ width: `${progress.percent}%` }}></div>
          </div>
          <p className="text-[12px] mt-2 text-indigo-100">
            {progress.total === 0 ? 'Chưa có công việc nào trong tuần.' 
              : `Hoàn thành ${progress.done}/${progress.total} mục tiêu. ${progress.percent >= 100 ? 'Quá đỉnh! 🎉' : progress.percent >= 80 ? 'Xuất sắc! 🔥' : progress.percent >= 50 ? 'Cố lên nhé 🚀' : 'Bắt đầu thôi nào 💪'}`}
          </p>
        </div>
      </div>

      {/* 2. LỊCH THI */}
      <div className="bg-white p-5 sm:rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-black text-[16px] text-gray-800 flex items-center gap-2">
            <span className="bg-rose-100 text-rose-600 w-8 h-8 rounded-lg flex items-center justify-center"><Icons.Edit className="w-4 h-4" /></span>
            Lịch thi
            {upcomingExams.length > 0 && <span className="text-[11px] bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">{upcomingExams.length} sắp thi</span>}
          </h4>
          <button onClick={() => setShowExamForm(!showExamForm)} className={`text-sm font-bold px-3 py-1.5 rounded-lg transition ${showExamForm ? 'bg-gray-200 text-gray-600' : 'bg-rose-100 text-rose-600 hover:bg-rose-200'}`}>
            {showExamForm ? '✕ Đóng' : '+ Thêm lịch thi'}
          </button>
        </div>

        {showExamForm && (
          <form onSubmit={handleAddExam} className="p-4 bg-red-50 rounded-xl mb-4 border border-red-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Tên môn thi *" required value={examForm.subject} onChange={e => setExamForm({...examForm, subject: e.target.value})} className="border p-2.5 rounded-lg outline-none focus:border-red-400 text-sm bg-white border-gray-300" />
              <input type="date" required value={examForm.examDate} onChange={e => setExamForm({...examForm, examDate: e.target.value})} className="border p-2.5 rounded-lg outline-none focus:border-red-400 text-sm bg-white border-gray-300" />
              <input type="time" value={examForm.examTime} onChange={e => setExamForm({...examForm, examTime: e.target.value})} className="border p-2.5 rounded-lg outline-none focus:border-red-400 text-sm bg-white border-gray-300" placeholder="Giờ thi" />
              <input type="text" placeholder="Phòng thi" value={examForm.room} onChange={e => setExamForm({...examForm, room: e.target.value})} className="border p-2.5 rounded-lg outline-none focus:border-red-400 text-sm bg-white border-gray-300" />
            </div>
            <button type="submit" className="bg-rose-600 text-white font-bold px-5 py-2 rounded-lg text-sm hover:bg-rose-700 transition w-full sm:w-auto">Lưu lịch thi</button>
          </form>
        )}

        {upcomingExams.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Chưa có lịch thi nào. Nhấn "Thêm lịch thi" để bắt đầu.</p>
        ) : (
          <div className="space-y-2">
            {upcomingExams.map(exam => {
              const examDate = new Date(exam.examDate);
              const today = new Date(); today.setHours(0,0,0,0);
              const daysLeft = Math.ceil((examDate - today) / (1000*60*60*24));
              const isUrgent = daysLeft <= 3;
              
              return (
                <div key={exam.id} className={`p-3 rounded-xl border flex items-center gap-3 transition ${isUrgent ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-rose-200 text-rose-700' : 'bg-gray-200 text-gray-600'}`}>
                    {isUrgent ? <Icons.AlertTriangle className="w-5 h-5" /> : <Icons.FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-gray-800 truncate">{exam.subject}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[11px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded border text-gray-600"><Icons.Calendar className="w-3 h-3" /> {formatDateVN(exam.examDate)}</span>
                      {exam.examTime && <span className="text-[11px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded border text-gray-600"><Icons.Clock className="w-3 h-3" /> {exam.examTime}</span>}
                      {exam.room && <span className="text-[11px] font-bold bg-white px-2 py-0.5 flex items-center gap-1 rounded border text-gray-600"><Icons.MapPin className="w-3 h-3" /> {exam.room}</span>}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {daysLeft === 0 ? '🔥 HÔM NAY' : daysLeft === 1 ? '⚡ NGÀY MAI' : `Còn ${daysLeft} ngày`}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-300 hover:text-red-500 text-lg flex-shrink-0 transition">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. GỢI Ý HÔM NAY */}
      <div className="bg-white p-5 sm:rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-black text-[16px] text-gray-800 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center"><Icons.Cpu className="w-4 h-4" /></span>
            Gợi ý {suggestDay === 'Hôm nay' ? 'hôm nay' : suggestDay.toLowerCase()}
          </h4>
          <div className="relative">
            <button onClick={() => setSuggestDropdownOpen(!suggestDropdownOpen)} className="px-4 py-2 text-[13px] rounded-lg font-bold border bg-indigo-600 text-white border-indigo-600 flex items-center gap-2 outline-none shadow-sm hover:bg-indigo-700 transition">
              <Icons.Calendar className="w-4 h-4" /> {suggestDay} <span className="text-[9px]">{suggestDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {suggestDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 shadow-xl rounded-xl z-10 overflow-y-auto max-h-[200px]">
                {dayOptions.map(day => (
                  <div key={day} onClick={() => { setSuggestDay(day); setSuggestDropdownOpen(false); }} className={`px-3 py-2 text-sm cursor-pointer transition ${suggestDay === day ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {day}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          {suggestions.map(item => {
            const isDone = doneSuggestions.includes(item.id);
            const canToggle = item.type !== 'free';
            
            return (
              <div key={item.id} className={`p-3.5 rounded-xl flex items-start gap-3 transition border border-l-4 relative ${getTypeBorderColor(item.type)} ${isDone ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:shadow-md'}`}>
                {canToggle && (
                  <div onClick={() => toggleSuggestionDone(item.id)} className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border-2 cursor-pointer transition ${isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white hover:border-indigo-400'} ${celebratingId === item.id ? 'celebrate-anim' : ''}`}>
                    {isDone && <Icons.Check className="w-4 h-4 text-white" />}
                  </div>
                )}
                {!canToggle && (
                  <div className="mt-0.5 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-lg">
                    {getTypeIcon(item.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-[14px] leading-tight mb-0.5 flex items-center gap-1.5 ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {getTypeIcon(item.type)} {item.subject}
                  </p>
                  <p className={`text-[12px] leading-snug ${isDone ? 'text-gray-400' : 'text-gray-500'}`}>{item.task}</p>
                  {item.time && (
                    <span className={`text-[11px] font-bold mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded ${isDone ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Icons.Clock className="w-3 h-3" /> {item.time}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
  const match = timeInfo.match(/(\d+)\s*\((.*?)\)->(\d+)\s*\((.*?)\)/);
  if (match) {
    let startT = match[2].replace('g', ':');
    let endT = match[4].replace('g', ':');
    return `${startT} - ${endT} (Tiết ${match[1]}-${match[3]})`;
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
