import { fmtUC } from '../utils';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icons } from '../App';

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

// --- LOGIC PHÂN LOẠI / SẮP XẾP ---
const STATUS_PRIORITY = {
  'PENDING': 1,
  'ACTIVE': 2,
  'ACCEPTED': 3,
  'IN_PROGRESS': 3,
  'DELIVERING': 4,
  'COMPLETED': 5,
  'SOLD': 5,
  'CANCELLED': 6
};

const getStatusPriority = (status) => STATUS_PRIORITY[status] || 99;

const sortItems = (items) => {
  return [...items].sort((a, b) => {
    const priorityA = getStatusPriority(a.status);
    const priorityB = getStatusPriority(b.status);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

const PersonalMarketScreen = ({ user, panicMode, onChat }) => {
  const CATEGORIES = [
    { id: 'DOCUMENT', name: 'Tài liệu', icon: <Icons.BookOpen className="w-4 h-4 text-zinc-400" /> },
    { id: 'ERRAND', name: 'Mua hộ', icon: <Icons.Coffee className="w-4 h-4 text-zinc-400" /> },
    { id: 'ITEM', name: 'Đồ cũ', icon: <Icons.ShoppingBag className="w-4 h-4 text-zinc-400" /> },
    { id: 'RIDE', name: 'Đi chung xe', icon: <Icons.Bike className="w-4 h-4 text-zinc-400" /> }
  ];

  const [data, setData] = useState({ requests: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  
  // State quản lý mở/đóng các accordion category
  const [expandedCats, setExpandedCats] = useState({});
  // State quản lý xem tất cả của từng category
  const [viewAllCats, setViewAllCats] = useState({});

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const fetchMyOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/market/my-orders/${user.id}`);
      if (res.data.status === 200) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleViewAll = (catId) => {
    setViewAllCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const getStatusColor = (status) => {
    if (status === 'COMPLETED' || status === 'SOLD') return panicMode ? 'text-zinc-300 bg-zinc-800 border-zinc-700' : 'text-zinc-800 bg-zinc-100 border-zinc-200';
    if (status === 'CANCELLED') return panicMode ? 'text-zinc-500 bg-zinc-900 border-zinc-800' : 'text-zinc-400 bg-zinc-50 border-zinc-150';
    if (status === 'PENDING' || status === 'ACTIVE') return panicMode ? 'text-zinc-200 bg-zinc-850 border-zinc-750' : 'text-zinc-900 bg-zinc-100 border-zinc-250';
    return panicMode ? 'text-zinc-300 bg-zinc-800 border-zinc-700' : 'text-zinc-800 bg-zinc-100 border-zinc-200';
  };

  const renderItem = (item) => {
    return (
      <div key={`${item.category}-${item.id}`} className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${panicMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-1 gap-2">
            <h4 className="font-bold text-sm leading-tight flex-1 line-clamp-2" style={{ wordBreak: 'break-word' }}>{item.title}</h4>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border whitespace-nowrap ${getStatusColor(item.status)}`}>
              {item.status}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-3 gap-3">
            <p className={`text-[11px] font-medium ${panicMode ? 'bg-zinc-850 text-zinc-400' : 'bg-zinc-50 text-zinc-500'} px-2.5 py-1 rounded flex items-center gap-1.5`}>
              <Icons.Clock className="w-3.5 h-3.5 text-zinc-400" /> Cập nhật: {formatTimeAgo(item.createdAt)}
            </p>
            {item.targetUser ? (
              <button 
                onClick={(e) => { e.preventDefault(); onChat && onChat(item.targetUser, `Chào bạn về đơn hàng: ${item.title}`); }} 
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 w-full sm:w-auto justify-center ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700'}`}
              >
                <Icons.MessageCircle className="w-3.5 h-3.5" /> Phản hồi
              </button>
            ) : (
              <span className={`text-xs italic ${panicMode ? 'text-zinc-500' : 'text-zinc-450'}`}>Chưa có giao dịch viên</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryGroup = (cat, items) => {
    let catItems = sortItems(items.filter(i => i.category === cat.id));
    if (catItems.length === 0) return null;

    const isExpanded = expandedCats[cat.id];
    const isViewAll = viewAllCats[cat.id];
    const displayItems = isViewAll ? catItems : catItems.slice(0, 5);

    return (
      <div key={cat.id} className={`mb-4 rounded-xl border overflow-hidden ${panicMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <div 
          onClick={() => toggleCategory(cat.id)}
          className={`w-full flex flex-col sm:flex-row items-center justify-between p-3.5 cursor-pointer transition ${panicMode ? 'bg-zinc-850 hover:bg-zinc-800' : 'bg-zinc-50 hover:bg-zinc-100'}`}
        >
          <div className="flex items-center gap-3 w-full">
            <span className="flex items-center justify-center">{cat.icon}</span>
            <span className={`font-bold text-xs uppercase tracking-wider ${panicMode ? 'text-white' : 'text-zinc-800'}`}>{cat.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${panicMode ? 'bg-zinc-900 text-zinc-500' : 'bg-zinc-200 text-zinc-650'}`}>
              ({catItems.length})
            </span>
          </div>
          <span className={`text-sm font-bold ml-auto ${panicMode ? 'text-zinc-500' : 'text-zinc-600'}`}>{isExpanded ? '⌃' : '⌄'}</span>
        </div>
        
        {isExpanded && (
          <div className={`p-3 flex flex-col gap-3 ${panicMode ? 'bg-zinc-900' : 'bg-white'}`}>
            {displayItems.map(item => renderItem(item))}
            
            {catItems.length > 5 && (
              <button 
                onClick={() => toggleViewAll(cat.id)}
                className={`py-2 mt-2 text-xs font-bold text-center rounded-lg border transition ${isViewAll ? (panicMode ? 'border-zinc-800 text-zinc-400 hover:bg-zinc-850' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100') : (panicMode ? 'border-zinc-800 bg-zinc-850 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100')}`}
              >
                {isViewAll ? 'Thu gọn bớt ⌃' : `Xem tất cả ${catItems.length} đơn ⌄`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const currentItems = activeTab === 'requests' ? data.requests : data.offers;

  return (
    <div className={`w-full ${panicMode ? 'text-white' : 'text-black'}`}>
      <div className={`flex gap-2 mb-4 border-b pb-4 ${panicMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <button 
          onClick={() => setActiveTab('requests')} 
          className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 ${activeTab === 'requests' ? (panicMode ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-950 text-white shadow') : (panicMode ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}`}
        >
          <Icons.ArrowDownCircle className="w-4 h-4 mr-1" /> Đơn Mua / Nhờ
          <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'requests' ? 'bg-white/20' : (panicMode ? 'bg-zinc-800' : 'bg-zinc-200')}`}>{data.requests?.length || 0}</span>
        </button>
        <button 
          onClick={() => setActiveTab('offers')} 
          className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 ${activeTab === 'offers' ? (panicMode ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-950 text-white shadow') : (panicMode ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}`}
        >
          <Icons.ArrowUpCircle className="w-4 h-4 mr-1" /> Đơn Nhận Làm / Chở
          <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'offers' ? 'bg-white/20' : (panicMode ? 'bg-zinc-800' : 'bg-zinc-200')}`}>{data.offers?.length || 0}</span>
        </button>
      </div>

      <div className="mt-2 min-h-[250px]">
        {loading ? (
          <div className="flex justify-center flex-col gap-2 py-10 items-center">
            <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${panicMode ? 'border-white' : 'border-zinc-900'}`}></div>
            <p className="text-zinc-400 text-xs font-bold">Đang tải dữ liệu chợ cá nhân...</p>
          </div>
        ) : (
          <div className="animate-fade-in space-y-1">
            {currentItems?.length === 0 ? (
              <div className={`text-center py-10 font-bold rounded-xl flex flex-col items-center justify-center gap-2 ${panicMode ? 'bg-zinc-900 border border-zinc-800 text-zinc-500' : 'bg-zinc-50 border border-zinc-150 text-zinc-400'}`}>
                <Icons.Package className="w-8 h-8 text-zinc-300" /> Bạn chưa có giao dịch nào ở mục này.
              </div>
            ) : (
              CATEGORIES.map(cat => renderCategoryGroup(cat, currentItems))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default PersonalMarketScreen;
