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
    { id: 'DOCUMENT', name: 'Tài liệu', icon: <Icons.BookOpen className="w-5 h-5 text-indigo-500" /> },
    { id: 'ERRAND', name: 'Mua hộ', icon: <Icons.Coffee className="w-5 h-5 text-orange-500" /> },
    { id: 'ITEM', name: 'Đồ cũ', icon: <Icons.ShoppingBag className="w-5 h-5 text-rose-500" /> },
    { id: 'RIDE', name: 'Đi chung xe', icon: <Icons.Bike className="w-5 h-5 text-green-500" /> }
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
    if (status === 'COMPLETED' || status === 'SOLD') return 'text-green-600 bg-green-50 border-green-200';
    if (status === 'CANCELLED') return 'text-red-600 bg-red-50 border-red-200';
    if (status === 'PENDING' || status === 'ACTIVE') return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const renderItem = (item) => {
    return (
      <div key={`${item.category}-${item.id}`} className={`p-4 rounded-xl border flex items-start gap-4 shadow-sm transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md ${panicMode ? 'bg-slate-800 border-gray-600 text-white' : 'bg-white border-gray-200'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-1 gap-2">
            <h4 className="font-bold text-[16px] leading-tight flex-1 line-clamp-2" style={{ wordBreak: 'break-word' }}>{item.title}</h4>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full max-w-max border whitespace-nowrap ${getStatusColor(item.status)}`}>
              {item.status}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-3 gap-3">
            <p className={`text-[12px] font-medium ${panicMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500'} px-2.5 py-1.5 rounded-lg flex items-center gap-1.5`}>
              <Icons.Clock className="w-4 h-4 text-slate-500" /> Cập nhật: {formatTimeAgo(item.createdAt)}
            </p>
            {item.targetUser ? (
              <button 
                onClick={(e) => { e.preventDefault(); onChat && onChat(item.targetUser, `Chào bạn về đơn hàng: ${item.title}`); }} 
                className={`text-[12px] px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 w-full sm:w-auto justify-center shadow-sm ${panicMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700'}`}
              >
                <Icons.MessageCircle className="w-4 h-4" /> Phản hồi
              </button>
            ) : (
              <span className={`text-[12px] italic ${panicMode ? 'text-gray-400' : 'text-gray-500'}`}>Chưa có giao dịch viên</span>
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
      <div key={cat.id} className={`mb-4 rounded-xl border overflow-hidden ${panicMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div 
          onClick={() => toggleCategory(cat.id)}
          className={`w-full flex flex-col sm:flex-row items-center justify-between p-4 cursor-pointer transition-colors ${panicMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-50 hover:bg-gray-100'}`}
        >
          <div className="flex items-center gap-3 w-full">
            <span className="flex items-center justify-center">{cat.icon}</span>
            <span className={`font-bold text-[15px] ${panicMode ? 'text-white' : 'text-gray-800'}`}>{cat.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${panicMode ? 'bg-slate-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
              ({catItems.length})
            </span>
          </div>
          <span className={`text-xl font-bold ml-auto ${panicMode ? 'text-gray-400' : 'text-gray-600'}`}>{isExpanded ? '⌃' : '⌄'}</span>
        </div>
        
        {isExpanded && (
          <div className={`p-4 flex flex-col gap-3 ${panicMode ? 'bg-slate-800' : 'bg-white'}`}>
            {displayItems.map(item => renderItem(item))}
            
            {catItems.length > 5 && (
              <button 
                onClick={() => toggleViewAll(cat.id)}
                className={`py-2 mt-2 text-sm font-bold text-center rounded-lg transition-colors border ${isViewAll ? (panicMode ? 'border-gray-600 text-gray-400 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50') : (panicMode ? 'border-blue-800 bg-blue-900/40 text-blue-400 hover:bg-blue-900/60' : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100')}`}
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
      <div className={`flex gap-2 mb-6 border-b pb-4 ${panicMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <button 
          onClick={() => setActiveTab('requests')} 
          className={`flex-1 py-3 font-bold rounded-xl text-[14px] sm:text-[15px] transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'requests' ? 'bg-rose-600 text-white shadow-lg transform scale-[1.02]' : (panicMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}
        >
          <Icons.ArrowDownCircle className="w-5 h-5 mr-1" /> Đơn Đang Mua / Nhờ
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{data.requests?.length || 0}</span>
        </button>
        <button 
          onClick={() => setActiveTab('offers')} 
          className={`flex-1 py-3 font-bold rounded-xl text-[14px] sm:text-[15px] transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'offers' ? 'bg-rose-600 text-white shadow-lg transform scale-[1.02]' : (panicMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}
        >
          <Icons.ArrowUpCircle className="w-5 h-5 mr-1" /> Tài Sản / Dịch Vụ Đang Trực Thuộc
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{data.offers?.length || 0}</span>
        </button>
      </div>

      <div className="mt-2 min-h-[300px]">
        {loading ? (
          <div className="flex justify-center flex-col gap-3 py-10 items-center">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-bold">Đang tải dữ liệu chợ cá nhân...</p>
          </div>
        ) : (
          <div className="animate-fade-in space-y-1">
            {currentItems?.length === 0 ? (
              <div className={`text-center py-10 font-bold rounded-xl flex flex-col items-center justify-center gap-2 ${panicMode ? 'bg-slate-800 text-gray-400' : 'bg-gray-50 text-gray-400'}`}>
                <Icons.Package className="w-10 h-10 text-slate-300" /> Bạn chưa có giao dịch nào ở mục này.
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
