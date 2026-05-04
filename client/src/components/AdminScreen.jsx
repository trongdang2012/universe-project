import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

// Component Avatar Đơn giản
const AdminUserAvatar = ({ user, size = "w-10 h-10", textSize = "text-lg" }) => {
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="avatar" className={`${size} rounded-full object-cover border border-slate-200`} />;
  return <div className={`${size} bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold ${textSize} uppercase`}>{user?.fullName ? user.fullName[0] : user?.username?.[0] || '?'}</div>;
};

const AdminScreen = ({ user, onLogout }) => {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [contentList, setContentList] = useState([]);
  const [ledgerStatus, setLedgerStatus] = useState(null);

  // Setup axios instance cho Admin, đính kèm headers
  const adminAxios = axios.create({
    baseURL: 'http://localhost:5000/api/admin',
    headers: { 'admin-id': user?.id }
  });

  useEffect(() => {
    if (tab === 'dashboard') fetchStats();
    if (tab === 'users') fetchUsers();
    if (tab === 'reports') fetchReports();
    if (tab === 'content') fetchContent(); // Mượn tạm posts
    if (tab === 'ledger') fetchLedgerAudit();
  }, [tab]);

  const fetchStats = async () => {
    try { const res = await adminAxios.get('/stats'); setStats(res.data.data); } catch(e) { console.error(e); }
  };
  const fetchUsers = async () => {
    try { const res = await adminAxios.get('/users'); setUsers(res.data.data); } catch(e) { console.error(e); }
  };
  const fetchReports = async () => {
    try { const res = await adminAxios.get('/reports'); setReports(res.data.data); } catch(e) { console.error(e); }
  };
  const fetchContent = async () => {
    // Tạm thời fetch posts, có thể mở rộng sau này lấy cả marketItems
    try { const res = await axios.get('http://localhost:5000/api/posts'); setContentList(res.data); } catch(e) { console.error(e); }
  };
  const fetchLedgerAudit = async () => {
    try {
      setLedgerStatus({ loading: true });
      const res = await adminAxios.get('/ledger/verify');
      setLedgerStatus({ loading: false, data: res.data.data });
    } catch(e) {
      setLedgerStatus({ loading: false, error: 'Lỗi khi kiểm toán' });
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Cảnh báo: Sẽ xóa toàn bộ dữ liệu của người dùng này. Tiếp tục?')) return;
    try { await adminAxios.delete(`/users/${id}`); fetchUsers(); } catch(e) { alert(e.response?.data?.message || 'Lỗi'); }
  };

  const handleResolveReport = async (id, status) => {
    try { await adminAxios.put(`/reports/${id}/resolve`, { status }); fetchReports(); } catch(e) { alert('Lỗi'); }
  };

  const handleDeleteContent = async (type, id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nội dung vi phạm này?')) return;
    try { await adminAxios.delete(`/content/${type}/${id}`); fetchContent(); } catch(e) { alert('Lỗi'); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
      <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-600/30">
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">UniVerse Admin</h1>
            <p className="text-sm font-semibold text-indigo-600">Bảng điều khiển hệ thống</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2">
          <span>Đăng xuất</span>
        </button>
      </div>

      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {['dashboard', 'users', 'content', 'reports', 'ledger'].map(t => (
          <button 
            key={t}
            onClick={() => setTab(t)} 
            className={`px-6 py-2.5 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-2 ${tab === t ? 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {t === 'dashboard' && '📊 Tổng quan'}
            {t === 'users' && `👥 Sinh viên (${users.length || 0})`}
            {t === 'content' && '📝 Kiểm duyệt nội dung'}
            {t === 'reports' && '🚨 Báo cáo vi phạm'}
            {t === 'ledger' && '🔐 Kiểm toán Sổ cái'}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === 'dashboard' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">👥</div>
              <div className="text-slate-500 font-semibold mb-1">Tổng Số Sinh Viên</div>
              <div className="text-3xl font-black text-slate-800">{stats.totalUsers}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">💬</div>
              <div className="text-slate-500 font-semibold mb-1">Tổng Confessions</div>
              <div className="text-3xl font-black text-slate-800">{stats.totalPosts}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">🛒</div>
              <div className="text-slate-500 font-semibold mb-1">Tổng Đồ Cũ Market</div>
              <div className="text-3xl font-black text-slate-800">{stats.totalMarketItems}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">🚨</div>
              <div className="text-slate-500 font-semibold mb-1">Báo Cáo Đang Chờ</div>
              <div className="text-3xl font-black text-red-600">{stats.totalReports}</div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                  <th className="p-4 font-bold">ID</th>
                  <th className="p-4 font-bold">Sinh viên</th>
                  <th className="p-4 font-bold">Ngày tham gia</th>
                  <th className="p-4 font-bold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4 font-medium text-slate-500">#{u.id}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <AdminUserAvatar user={u} size="w-10 h-10" />
                        <div>
                          <div className="font-bold text-slate-800">{u.fullName || 'Chưa cập nhật'}</div>
                          <div className="text-xs text-slate-500">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4">
                      <button onClick={() => handleDeleteUser(u.id)} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-red-500 hover:text-white transition">Xóa vĩnh viễn</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'content' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contentList.map(p => (
              <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <AdminUserAvatar user={p.user} size="w-8 h-8" textSize="text-xs" />
                  <div>
                    <span className="font-bold text-sm text-slate-800">{p.user?.fullName || p.user?.username}</span>
                    <div className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                </div>
                <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl mb-4 flex-1 break-words">
                  {p.content}
                </div>
                <button onClick={() => handleDeleteContent('POST', p.id)} className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-bold hover:bg-red-500 hover:text-white transition">Gỡ bài viết</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="grid grid-cols-1 gap-4">
            {reports.length === 0 && <div className="text-center py-12 text-slate-500">🎉 Tuyệt vời! Không có báo cáo vi phạm nào.</div>}
            {reports.map((r) => (
              <div key={r.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${r.status !== 'PENDING' ? 'border-slate-200 opacity-60' : 'border-red-200'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${r.status === 'PENDING' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                      <span className="text-sm font-bold text-slate-600">Loại: {r.targetType}</span>
                      <span className="text-sm text-slate-500">| ID: {r.targetId}</span>
                    </div>
                    <p className="font-bold text-slate-800">Lý do báo cáo: <span className="text-red-500 font-medium">{r.reason}</span></p>
                    <p className="text-xs text-slate-500 mt-2">Người báo cáo: {r.reporter?.fullName} • {new Date(r.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleResolveReport(r.id, 'REJECTED')} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">Bỏ qua</button>
                      <button onClick={() => handleResolveReport(r.id, 'RESOLVED')} className="px-5 py-2.5 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-700 transition">Đã xử lý</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'ledger' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="text-2xl">🔐</span> Kiểm toán tính toàn vẹn của Sổ cái (Ledger Audit)</h2>
            {ledgerStatus?.loading && <p className="text-slate-500 font-medium">Đang tiến hành kiểm toán hệ thống...</p>}
            {ledgerStatus?.error && <p className="text-red-500 font-medium">{ledgerStatus.error}</p>}
            {ledgerStatus?.data && (
              <div>
                <div className={`p-4 rounded-xl border ${ledgerStatus.data.isValid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} mb-6`}>
                  <p className="font-bold text-lg flex items-center gap-2">
                    {ledgerStatus.data.isValid ? '✅ Sổ cái toàn vẹn, không có dấu hiệu giả mạo' : '❌ CẢNH BÁO: Phát hiện sự cố hoặc can thiệp dữ liệu trên Sổ cái!'}
                  </p>
                  <p className="mt-1">{ledgerStatus.data.message}</p>
                </div>
                {ledgerStatus.data.invalidTransactions && ledgerStatus.data.invalidTransactions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3">Các giao dịch lỗi:</h3>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-xs text-red-600">{JSON.stringify(ledgerStatus.data.invalidTransactions, null, 2)}</pre>
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <button onClick={fetchLedgerAudit} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-indigo-700">Chạy lại Kiểm toán</button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminScreen;
