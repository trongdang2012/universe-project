import { fmtUC } from '../utils';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Icons } from '../App';
import './ErrandMarket.css';

// ==========================================
// CONSTANTS & HELPERS
// ==========================================
const CAMPUS_LOCATIONS = [
  { name: 'Cổng Chính QNU', lat: 13.7587, lng: 109.2155 },
  { name: 'Thư viện Tầng 2', lat: 13.7595, lng: 109.2158 },
  { name: 'Canteen Khu B', lat: 13.7593, lng: 109.2154 },
  { name: 'Ký túc xá Khu C', lat: 13.7601, lng: 109.2145 },
  { name: 'Tiệm Photo cổng trường', lat: 13.7589, lng: 109.2150 },
  { name: 'Phòng 301 - Tòa A', lat: 13.7598, lng: 109.2160 },
  { name: 'Phòng 102 - Tòa B', lat: 13.7580, lng: 109.2165 },
  { name: 'Sân bóng KTX', lat: 13.7610, lng: 109.2135 }
];

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2-lat1) * (Math.PI/180);
  const dLon = (lon2-lon1) * (Math.PI/180); 
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const LocationAutocomplete = ({ value, onChange, placeholder, icon }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredLocations = CAMPUS_LOCATIONS.filter(loc => 
    loc.name.toLowerCase().includes(value.toLowerCase()) && loc.name !== value
  );

  return (
    <div className="errand-input-wrap relative" ref={wrapperRef}>
      <span className="errand-icon">{icon}</span>
      <input
        type="text"
        className="errand-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
      />
      {showDropdown && filteredLocations.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filteredLocations.map(loc => (
            <li 
              key={loc.name} 
              className="px-4 py-2 hover:bg-rose-50 cursor-pointer text-sm text-gray-700"
              onClick={() => {
                onChange(loc.name);
                setShowDropdown(false);
              }}
            >
              <Icons.MapPin className="w-4 h-4 inline mr-1.5 text-slate-500" /> {loc.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CustomModal = ({ config, onClose }) => {
  if (!config) return null;
  const { type, message, defaultValue, onConfirm } = config;
  const [inputValue, setInputValue] = useState(defaultValue || '');

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-scale-up">
        <h4 className="font-bold text-lg mb-3 text-gray-800">
          {type === 'alert' ? 'Thông báo' : type === 'confirm' ? 'Xác nhận' : 'Nhập thông tin'}
        </h4>
        <p className="text-sm text-gray-600 mb-5 whitespace-pre-wrap">{message}</p>
        
        {type === 'prompt' && (
          <input 
            type="text" 
            className="w-full border p-2 rounded-lg mb-4 outline-none focus:border-rose-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
        )}

        <div className="flex justify-end gap-2">
          {type !== 'alert' && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
              Hủy
            </button>
          )}
          <button 
            onClick={() => {
              if (type === 'prompt') onConfirm(inputValue);
              else if (type === 'confirm') onConfirm();
              onClose();
            }} 
            className="px-4 py-2 rounded-lg font-bold bg-rose-600 text-white hover:bg-rose-700 transition"
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
};

const ErrandCard = ({ errand, onAccept, onChat, onOpenProfile, onCardClick }) => (
  <div className="errand-card" onClick={() => onCardClick?.(errand)} style={{ cursor: 'pointer' }}>
    <div className="errand-card-header">
      <div className="errand-card-tags">
        <span className={`errand-card-type-tag ${errand.category?.toLowerCase() || 'food'}`}>
          {errand.category === 'FOOD' ? <><Icons.Coffee className="w-3.5 h-3.5 inline mr-1"/> ĐỒ ĂN</> : errand.category === 'PRINT' ? <><Icons.Printer className="w-3.5 h-3.5 inline mr-1"/> IN ẤN</> : <><Icons.Package className="w-3.5 h-3.5 inline mr-1"/> LẤY ĐỒ</>}
        </span>
        <span className="errand-card-status-tag flex items-center justify-center gap-1"><Icons.Clock className="w-3 h-3 text-slate-500" /> {errand.status}</span>
      </div>
      <div className="errand-card-reward">
        {errand.vndReward > 0 ? (
           <div className="errand-card-reward-value" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
             <Icons.DollarSign className="w-4 h-4" /> {new Intl.NumberFormat('vi-VN').format(errand.vndReward)} đ
           </div>
        ) : (
           <div className="errand-card-reward-value">{fmtUC(errand.fee)} UC</div>
        )}
        
        {errand.tipAmount > 0 && (
          <div className="errand-card-reward-tip flex items-center gap-1">
            <Icons.Flame className="w-3 h-3" /> +{errand.tipAmount} UC Tip
          </div>
        )}
      </div>
    </div>

    {/* Route Timeline */}
    <div className="errand-card-route">
      <div className="errand-route-point">
        <div className="errand-route-dot from"></div>
        <span className="errand-route-text">{errand.locationBuy}</span>
      </div>
      <span className="errand-route-arrow">➔</span>
      <div className="errand-route-point">
        <div className="errand-route-dot to"></div>
        <span className="errand-route-text">{errand.locationDrop}</span>
      </div>
    </div>

    <div className="errand-card-body">
      <div className="errand-card-title">{errand.title}</div>
      <div className="errand-card-requester" onClick={(e) => { e.stopPropagation(); onOpenProfile?.(errand.requester); }}>
        {errand.requester?.avatarUrl ? (
          <img src={errand.requester.avatarUrl} alt="avatar" className="errand-card-avatar" style={{ objectFit: 'cover', border: 'none' }} />
        ) : (
          <div className="errand-card-avatar">{errand.requester?.fullName?.charAt(0) || errand.requester?.username?.charAt(0) || 'U'}</div>
        )}
        <span className="errand-card-requester-name">
          {errand.requester?.fullName || errand.requester?.username} • Khoảng cách ~{errand.distance ? errand.distance.toFixed(1) : (Math.random() * 2 + 0.5).toFixed(1)}km
        </span>
      </div>
    </div>

    <div className="errand-card-footer">
      <span className="errand-card-time flex items-center gap-1 "><Icons.Clock className="w-3.5 h-3.5" /> {new Date(errand.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" className="errand-chat-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onChat?.(errand); }}>
          <Icons.MessageCircle className="w-3.5 h-3.5 mr-1" /> Nhắn tin
        </button>
        <button type="button" className="errand-accept-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onAccept?.(errand); }}>
          <Icons.CheckCircle className="w-3.5 h-3.5 mr-1" /> Nhận đơn
        </button>
      </div>
    </div>
  </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
const ErrandMarketScreen = ({ user, panicMode, onGpsPost, onChat, onOpenProfile }) => {
  const [activeTab, setActiveTab] = useState('can_help'); // 'can_help' | 'job_board'
  const [jobTab, setJobTab] = useState('doing'); // 'doing' | 'requested'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedErrand, setSelectedErrand] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Data fetching state
  const [pendingErrands, setPendingErrands] = useState([]);
  const [myRequested, setMyRequested] = useState([]);
  const [myRunning, setMyRunning] = useState([]);
  const [activeShippers, setActiveShippers] = useState([]);
  const [loading, setLoading] = useState(false);

  // View All states
  const [viewAllShippers, setViewAllShippers] = useState(false);
  const [viewAllPending, setViewAllPending] = useState(false);
  const [viewAllDoing, setViewAllDoing] = useState(false);
  const [viewAllRequested, setViewAllRequested] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistance, setFilterDistance] = useState('');
  const [filterPrice, setFilterPrice] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    locationBuy: '',
    locationDrop: '',
    fee: '1',
    tipAmount: '',
    vndReward: '',
  });

  // Modal Custom
  const [modalConfig, setModalConfig] = useState(null);
  const showAlert = (message) => setModalConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setModalConfig({ type: 'confirm', message, onConfirm });
  const showPrompt = (message, defaultValue, onConfirm) => setModalConfig({ type: 'prompt', message, defaultValue, onConfirm });

  const categories = [
    { id: 'FOOD', icon: <Icons.Coffee className="w-6 h-6 text-slate-600" />, label: 'Đồ ăn/Nước' },
    { id: 'PRINT', icon: <Icons.Printer className="w-6 h-6 text-slate-600" />, label: 'In tài liệu' },
    { id: 'PICKUP', icon: <Icons.Package className="w-6 h-6 text-slate-600" />, label: 'Lấy đồ ship' },
  ];

  const fetchPendingErrands = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/errands/pending');
      setPendingErrands(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyErrands = async () => {
    try {
      if (!user?.id) return;
      const res = await axios.get(`/api/errands/my/${user.id}`);
      setMyRequested(res.data.data.requested || []);
      setMyRunning(res.data.data.running || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActiveShippers = async () => {
    try {
      const res = await axios.get('/api/posts?type=shippers');
      setActiveShippers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'can_help') {
      fetchPendingErrands();
    } else if (activeTab === 'job_board') {
      fetchMyErrands();
    }
  }, [activeTab]);

  const handleGpsToggle = () => {
    if (!gpsActive && onGpsPost) {
      onGpsPost('ERRAND');
    }
    setGpsActive(!gpsActive);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedCategory) {
      showAlert("Vui lòng chọn loại yêu cầu (Đồ ăn, In ấn, Lấy đồ)!");
      return;
    }
    
    // Auto calculate distance if matched in predefined campus locations
    let computedDistance = null;
    const locBuyObj = CAMPUS_LOCATIONS.find(l => l.name === formData.locationBuy);
    const locDropObj = CAMPUS_LOCATIONS.find(l => l.name === formData.locationDrop);
    if (locBuyObj && locDropObj) {
      computedDistance = getDistanceFromLatLonInKm(locBuyObj.lat, locBuyObj.lng, locDropObj.lat, locDropObj.lng);
    }

    try {
      const payload = {
        title: formData.title,
        category: selectedCategory,
        locationBuy: formData.locationBuy,
        locationDrop: formData.locationDrop,
        distance: computedDistance,
        fee: parseInt(formData.fee) || 0,
        tipAmount: formData.tipAmount ? parseInt(formData.tipAmount) : 0,
        vndReward: parseInt(formData.vndReward) || 0,
        requesterId: user.id
      };
      
      const res = await axios.post('/api/errands', payload);
      showAlert(res.data.message || 'Tạo đơn nhờ mua thành công!');
      
      setFormData({ title: '', locationBuy: '', locationDrop: '', fee: '1', tipAmount: '', vndReward: '' });
      setSelectedCategory('');
      setShowCreateModal(false);
      setActiveTab('job_board');
      setJobTab('requested');
      fetchMyErrands();
    } catch (err) {
      showAlert(err.response?.data?.message || err.message || 'Lỗi tạo đơn');
    }
  };

  const handleAcceptErrand = async (errand) => {
    try {
      const res = await axios.put(`/api/errands/accept/${errand.id}`, { runnerId: user.id });
      showAlert(res.data.message || 'Nhận đơn thành công!');
      setPendingErrands(prev => prev.filter(e => e.id !== errand.id));
    } catch (err) {
      showAlert(err.response?.data?.message || err.message || 'Lỗi nhận đơn');
    }
  };

  const handleChatErrand = (errand, message) => {
    if (onChat) {
      onChat(errand.requester || errand.runner, errand, message || `Chào bạn, mình muốn trao đổi về đơn nhờ mua "${errand.title}" của bạn.`, 'ERRAND');
    }
  };

  // Shipper updates status to DELIVERING
  const handleDeliverErrand = (errand) => {
    showConfirm("Bạn đã lấy hàng và bắt đầu đi giao?", async () => {
      try {
        const res = await axios.put(`/api/errands/deliver/${errand.id}`, { runnerId: user.id });
        showAlert(res.data.message || 'Đã cập nhật trạng thái Đang giao!');
        fetchMyErrands();
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const handleCompleteErrand = (errand) => {
    showConfirm("Xác nhận đã nhận hàng xong và hệ thống sẽ chuyển UC cho người mua hộ?", async () => {
      try {
        const res = await axios.put(`/api/errands/complete/${errand.id}`, { requesterId: user.id });
        setTimeout(() => {
          showPrompt("Đã xác nhận hoàn thành! Nhập số sao (1-5) để đánh giá người mua hộ:", "5", async (score) => {
            if (score) {
              try {
                await axios.post('/api/users/rate', { raterId: user.id, ratedUserId: errand.runnerId, score });
                showAlert("Cảm ơn bạn đã đánh giá!");
              } catch (e) {}
            }
            fetchMyErrands();
          });
        }, 300);
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const handleCancelErrand = (errand) => {
    showConfirm(`Bạn có chắc chắn muốn hủy đơn "${errand.title}" không?`, async () => {
      try {
        const res = await axios.put(`/api/errands/cancel/${errand.id}`, { userId: user.id });
        showAlert(res.data.message || 'Đơn đã hủy thành công!');
        fetchMyErrands();
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const handleEditErrand = (errand) => {
    showPrompt("Nhập lại yêu cầu cần mua:", errand.title, async (newTitle) => {
      if (!newTitle) return;
      try {
        const res = await axios.put(`/api/errands/${errand.id}`, { 
          userId: user.id,
          title: newTitle,
        });
        showAlert(res.data.message || 'Cập nhật đơn thành công!');
        fetchMyErrands();
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const handleExcuseErrand = (errand) => {
    showConfirm("Xin thông cảm bị trễ để không bị hệ thống tự động hủy & phạt UC?", async () => {
      try {
        const res = await axios.put(`/api/errands/excuse/${errand.id}`, { runnerId: user.id });
        showAlert(res.data.message || 'Đã gửi yêu cầu thông cảm!');
        fetchMyErrands();
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const handleResolveExcuse = (errand, action) => {
    const actText = action === 'ACCEPT' ? "đồng ý thông cảm cho shipper" : "thu hồi đơn vui vẻ (không phạt Shipper)";
    showConfirm(`Bạn có muốn ${actText}?`, async () => {
      try {
        const res = await axios.put(`/api/errands/excuse-resolve/${errand.id}`, { requesterId: user.id, action });
        showAlert(res.data.message || 'Đã xử lý xong!');
        fetchMyErrands();
      } catch (err) {
        showAlert(err.response?.data?.message || err.message);
      }
    });
  };

  const filteredErrands = useMemo(() => {
    const rawFiltered = pendingErrands.filter(errand => {
      if (errand.status === 'CANCELLED' || errand.status === 'COMPLETED') return false; // Thêm lọc đơn huỷ/hoàn thành
      
      // Không hiển thị đơn của bản thân
      if (errand.requesterId === user?.id || errand.requester?.id === user?.id) return false;
      
      // Ẩn đơn quá 1 tiếng chờ người nhận
      const maxAgeMs = 60 * 60 * 1000;
      if (Date.now() - new Date(errand.createdAt).getTime() > maxAgeMs) return false;

      // Search
      if (searchQuery && !errand.title.toLowerCase().includes(searchQuery.toLowerCase())) {
         return false;
      }
      
      const dist = errand.distance || 0.5; // fallback
      if (filterDistance) {
         if (filterDistance === '<1' && dist >= 1) return false;
         if (filterDistance === '1-3' && (dist < 1 || dist > 3)) return false;
         if (filterDistance === '>3' && dist <= 3) return false;
      }
      // Price
      if (filterPrice) {
         const totalReward = errand.fee + (errand.tipAmount || 0);
         if (filterPrice === '<10' && totalReward >= 10) return false;
         if (filterPrice === '10-20' && (totalReward < 10 || totalReward > 20)) return false;
         if (filterPrice === '>20' && totalReward <= 20) return false;
      }
      return true;
    });

    const sortPriority = {
      'PENDING': 1,
      'ACCEPTED': 2,
      'DELIVERING': 3
    };

    return rawFiltered.sort((a, b) => {
      const pA = sortPriority[a.status] || 99;
      const pB = sortPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [pendingErrands, searchQuery, filterDistance, filterPrice]);

  return (
    <div className={`${panicMode ? 'errand-panic' : ''}`}>
      <CustomModal config={modalConfig} onClose={() => setModalConfig(null)} />

      {/* ============================================ */}
      {/* MAIN TABS NAVIGATION                         */}
      {/* ============================================ */}
      <div className="errand-main-tabs">
        <button type="button" 
          className="errand-main-tab-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <Icons.ShoppingBag className="w-4 h-4 inline mr-1" /> Nhờ mua
        </button>
        <button type="button" 
          className={`errand-main-tab-btn ${activeTab === 'can_help' ? 'active' : ''}`}
          onClick={() => setActiveTab('can_help')}
        >
          <Icons.Bike className="w-4 h-4 inline mr-1" /> Nhận đơn
        </button>
        <button type="button" 
          className={`errand-main-tab-btn ${activeTab === 'job_board' ? 'active' : ''}`}
          onClick={() => setActiveTab('job_board')}
        >
          <Icons.FileText className="w-4 h-4 inline mr-1" /> Quản lý
        </button>
      </div>

      {/* ============================================ */}
      {/* MODAL TẠO ĐƠN NHỜ MUA                        */}
      {/* ============================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-xl p-6 border shadow-2xl transition-all max-h-[90vh] overflow-y-auto ${panicMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 m-0">
                <Icons.Edit className="w-4 h-4 text-zinc-500" /> Tạo đơn nhờ mua
              </h3>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className={`w-7 h-7 rounded-md font-bold flex items-center justify-center border transition-colors ${panicMode ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-205 text-zinc-500'}`}
              >
                ✕
              </button>
            </div>
            
            {/* Note: NO FORM TAG WRAPPER to avoid collision with App.jsx nested forms. */}
            <div className="errand-form-wrapper" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e) }}>
              {/* Category Quick Select */}
              <div className="errand-category-grid mb-4">
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    className={`errand-category-btn flex flex-col items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === cat.id 
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100' 
                        : (panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100')
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span className="cat-icon text-lg">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="errand-input-group">
                {/* Tên món đồ */}
                <div>
                  <label className="errand-label text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">Yêu cầu chi tiết</label>
                  <div className="errand-input-wrap relative">
                    <span className="errand-icon absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Icons.ShoppingBag className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      className={`errand-input w-full pl-9 pr-4 py-2 border rounded-lg text-xs outline-none transition-colors ${panicMode ? 'bg-zinc-850 border-zinc-800 text-zinc-200 focus:border-zinc-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-950'}`}
                      placeholder="VD: 2 ly Trà sữa Ổi Hồng size L, ít đường..."
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                </div>

                {/* Mua tại đâu */}
                <div>
                  <label className="errand-label text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">Mua tại đâu?</label>
                  <LocationAutocomplete 
                    icon={<Icons.Store className="w-4 h-4 text-zinc-400" />} 
                    placeholder="VD: Canteen Khu B, Tiệm Photo cổng trường..."
                    value={formData.locationBuy} 
                    onChange={(val) => setFormData({ ...formData, locationBuy: val })} 
                  />
                </div>

                {/* Giao đến đâu */}
                <div>
                  <label className="errand-label text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">Giao đến đâu?</label>
                  <LocationAutocomplete 
                    icon={<Icons.Building className="w-4 h-4 text-zinc-400" />} 
                    placeholder="VD: Phòng 302, Tòa A..."
                    value={formData.locationDrop} 
                    onChange={(val) => setFormData({ ...formData, locationDrop: val })} 
                  />
                </div>
                
                {formData.locationBuy && formData.locationDrop && 
                  CAMPUS_LOCATIONS.some(l => l.name === formData.locationBuy) && 
                  CAMPUS_LOCATIONS.some(l => l.name === formData.locationDrop) && (
                  <div className={`text-xs font-semibold p-3 rounded-lg border flex items-center gap-1.5 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-50 border-zinc-150 text-zinc-750'}`}>
                    <Icons.MapPin className="w-3.5 h-3.5 text-zinc-450" /> Khoảng cách tự động tính: {getDistanceFromLatLonInKm(
                      CAMPUS_LOCATIONS.find(l=>l.name===formData.locationBuy).lat,
                      CAMPUS_LOCATIONS.find(l=>l.name===formData.locationBuy).lng,
                      CAMPUS_LOCATIONS.find(l=>l.name===formData.locationDrop).lat,
                      CAMPUS_LOCATIONS.find(l=>l.name===formData.locationDrop).lng
                    ).toFixed(2)} km
                  </div>
                )}

                {/* Payment Block */}
                <div className={`p-4 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/50 border-zinc-200'}`}>
                  <div className="text-xs font-bold flex items-center gap-2 mb-3 text-zinc-900 dark:text-zinc-100">
                    <Icons.CreditCard className="w-4 h-4 text-zinc-500" /> Chi phí & Tiền công
                  </div>
                  
                  <div className="mb-3.5">
                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">
                      Tiền công thật (VNĐ) <span className="text-[10px] text-zinc-500 font-normal normal-case">(Trả ngoài bằng Momo/Tiền mặt)</span>
                    </label>
                    <input
                      type="number"
                      className={`w-full px-3 py-2 border rounded-lg text-xs font-bold outline-none transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-205 focus:border-zinc-500' : 'bg-white border-zinc-200 text-zinc-950 focus:border-zinc-950'}`}
                      placeholder="VD: 15000"
                      min="0"
                      value={formData.vndReward}
                      onChange={(e) => setFormData({ ...formData, vndReward: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">Phí nền tảng (UC)</label>
                      <input
                        type="number"
                        className={`w-full px-3 py-2 border rounded-lg text-xs outline-none transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-205 focus:border-zinc-500' : 'bg-white border-zinc-200 text-zinc-950 focus:border-zinc-950'}`}
                        placeholder="1"
                        min="1"
                        value={formData.fee}
                        onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1.5 block">Tip UC thêm</label>
                      <input
                        type="number"
                        className={`w-full px-3 py-2 border rounded-lg text-xs outline-none transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-205 focus:border-zinc-500' : 'bg-white border-zinc-200 text-zinc-950 focus:border-zinc-950'}`}
                        placeholder="0"
                        min="0"
                        value={formData.tipAmount}
                        onChange={(e) => setFormData({ ...formData, tipAmount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={`text-[10px] font-semibold text-center p-3 rounded-lg border flex items-center gap-1.5 justify-center ${panicMode ? 'bg-zinc-800/50 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-150 text-zinc-500'}`}>
                   <Icons.AlertTriangle className="w-3.5 h-3.5 text-zinc-400" /> Đơn sẽ tự động huỷ nếu sau 1 tiếng không có người nhận.
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)} 
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                  >
                    Hủy
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSubmit} 
                    className="flex-1 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Icons.Send className="w-3.5 h-3.5" /> Tạo đơn
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL CHI TIẾT ĐƠN                           */}
      {/* ============================================ */}
      {selectedErrand && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setSelectedErrand(null)}>
          <div 
            className={`w-full max-w-sm rounded-xl p-6 border shadow-2xl transition-all animate-scale-up ${panicMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 m-0">Chi tiết đơn hàng</h3>
              <button 
                type="button" 
                onClick={() => setSelectedErrand(null)} 
                className={`w-7 h-7 rounded-md font-bold flex items-center justify-center border transition-colors ${panicMode ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-205 text-zinc-500'}`}
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="font-bold text-sm leading-snug">{selectedErrand.title}</div>
              <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5 font-medium">
                <Icons.Clock className="w-3.5 h-3.5 text-zinc-500" />
                {new Date(selectedErrand.createdAt).toLocaleString('vi-VN', {
                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                })}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2.5">
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-850' : 'bg-zinc-50/50 border-zinc-150'}`}>
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 shrink-0"><Icons.MapPin className="w-3.5 h-3.5" /></div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Nơi mua</span>
                  <span className="text-xs font-semibold leading-tight">{selectedErrand.locationBuy}</span>
                </div>
              </div>
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-850' : 'bg-zinc-50/50 border-zinc-150'}`}>
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 shrink-0"><Icons.Building className="w-3.5 h-3.5" /></div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Giao đến</span>
                  <span className="text-xs font-semibold leading-tight">{selectedErrand.locationDrop}</span>
                </div>
              </div>
            </div>

            {selectedErrand.vndReward > 0 && (
              <div className={`p-4 rounded-lg mb-3 flex items-center gap-3 border ${panicMode ? 'bg-zinc-850 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}>
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-200 dark:bg-zinc-750 text-zinc-700 dark:text-zinc-200 rounded-full shrink-0"><Icons.DollarSign className="w-5 h-5" /></div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Tiền công nhận ngoài (VNĐ)</div>
                  <div className="font-bold text-base leading-none mt-0.5">{new Intl.NumberFormat('vi-VN').format(selectedErrand.vndReward)} đ</div>
                </div>
              </div>
            )}

            <div className={`p-3.5 rounded-lg mb-4 flex justify-between items-center border ${panicMode ? 'bg-zinc-850 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}>
               <div>
                 <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Phí hệ thống</span>
                 <span className="font-bold text-sm">{fmtUC(selectedErrand.fee)} UC</span>
               </div>
               {selectedErrand.tipAmount > 0 && (
                 <div className="text-right">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Tip UC thêm</span>
                   <span className="font-bold text-sm">+{selectedErrand.tipAmount} UC</span>
                 </div>
               )}
            </div>

            <div 
              className={`flex items-center gap-3 mb-5 p-3 rounded-lg cursor-pointer border transition ${panicMode ? 'bg-zinc-850 hover:bg-zinc-800 border-transparent' : 'bg-zinc-50/50 hover:bg-zinc-100 border-zinc-150'}`} 
              onClick={() => { setSelectedErrand(null); onOpenProfile?.(selectedErrand.requester); }}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-750 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200 shrink-0">
                {selectedErrand.requester?.fullName?.charAt(0) || selectedErrand.requester?.username?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <div className="font-bold text-xs truncate">{selectedErrand.requester?.fullName || selectedErrand.requester?.username}</div>
                <div className="text-[10px] text-zinc-450 font-semibold uppercase tracking-wider">Người yêu cầu</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                type="button" 
                className={`flex-1 py-2.5 rounded-lg font-semibold text-xs border transition-colors flex justify-center items-center gap-1.5 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                onClick={() => { setSelectedErrand(null); handleChatErrand(selectedErrand); }}
              >
                <Icons.MessageCircle className="w-3.5 h-3.5" /> Nhắn tin
              </button>
              <button 
                type="button" 
                className="flex-1 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 transition-colors" 
                onClick={() => { setSelectedErrand(null); handleAcceptErrand(selectedErrand); }}
              >
                <Icons.CheckCircle className="w-3.5 h-3.5" /> Nhận đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 2: TÔI CÓ THỂ MUA HỘ (Nhận đơn)          */}
      {/* ============================================ */}
      {activeTab === 'can_help' && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 m-0 text-zinc-900 dark:text-white">
              <Icons.Search className="w-4 h-4 text-zinc-400" /> Đơn gần bạn
            </h3>
            <button 
              onClick={fetchPendingErrands} 
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${panicMode ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-950'}`}
            >
              <Icons.RefreshCw className="w-3.5 h-3.5" /> Làm mới
            </button>
          </div>
          
          {/* Filters Bar */}
          <div className="errand-filter-bar mb-5">
             <input 
               type="text" 
               className={`errand-filter-input text-xs px-3 py-2 border rounded-lg outline-none transition-colors ${panicMode ? 'bg-zinc-850 border-zinc-800 text-zinc-200 focus:border-zinc-700' : 'bg-white border-zinc-205 text-zinc-900 focus:border-zinc-950'}`} 
               placeholder="🔍 Tìm theo món, địa điểm..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
             <select 
               className={`errand-filter-select text-xs px-3 py-2 border rounded-lg outline-none transition-colors ${panicMode ? 'bg-zinc-850 border-zinc-800 text-zinc-200 focus:border-zinc-700' : 'bg-white border-zinc-205 text-zinc-900 focus:border-zinc-950'}`}
               value={filterDistance}
               onChange={(e) => setFilterDistance(e.target.value)}
             >
               <option value="">Khoảng cách</option>
               <option value="<1">Dưới 1km</option>
               <option value="1-3">Từ 1 - 3km</option>
               <option value=">3">Trên 3km</option>
             </select>
             <select 
               className={`errand-filter-select text-xs px-3 py-2 border rounded-lg outline-none transition-colors ${panicMode ? 'bg-zinc-850 border-zinc-800 text-zinc-200 focus:border-zinc-700' : 'bg-white border-zinc-205 text-zinc-900 focus:border-zinc-950'}`}
               value={filterPrice}
               onChange={(e) => setFilterPrice(e.target.value)}
             >
               <option value="">Mức phí</option>
               <option value="<10">Dưới 10 UC</option>
               <option value="10-20">10 - 20 UC</option>
               <option value=">20">Trên 20 UC</option>
             </select>
          </div>

          <div className="errand-card-list">
            {loading ? (
               <div className="text-center py-8 text-xs font-semibold text-zinc-400">Đang tải danh sách đơn...</div>
            ) : filteredErrands.length === 0 ? (
               <div className="text-center py-8 text-xs font-semibold text-zinc-400">Không có đơn mua hộ nào!</div>
            ) : (() => {
               const errandsToShow = viewAllPending ? filteredErrands : filteredErrands.slice(0, 5);
               return (
                 <>
                   {errandsToShow.map((errand) => (
                     <ErrandCard
                       key={errand.id}
                       errand={errand}
                       onAccept={handleAcceptErrand}
                       onChat={handleChatErrand}
                       onOpenProfile={onOpenProfile}
                       onCardClick={setSelectedErrand}
                     />
                   ))}
                   {filteredErrands.length > 5 && (
                     <button 
                       onClick={() => setViewAllPending(!viewAllPending)}
                       className={`w-full py-3 rounded-lg text-xs font-bold transition-all ${
                         panicMode 
                           ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200' 
                           : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
                       }`}
                     >
                       {viewAllPending ? 'Thu gọn ⌃' : `Xem tất cả ${filteredErrands.length} đơn chờ nhận ⌄`}
                     </button>
                   )}
                 </>
               );
            })()}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 3: BẢNG CÔNG VIỆC                        */}
      {/* ============================================ */}
      {activeTab === 'job_board' && (
        <div className="mb-6 animate-fade-in">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 m-0 text-zinc-900 dark:text-white">
               <Icons.FileText className="w-4 h-4 text-zinc-400" /> Bảng công việc
             </h3>
             <button 
               onClick={fetchMyErrands} 
               className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${panicMode ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-950'}`}
             >
               <Icons.RefreshCw className="w-3.5 h-3.5" /> Làm mới
             </button>
           </div>
           
           <div className={`flex border-b mb-4 ${panicMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
             <button 
               type="button"
               className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
                 jobTab === 'doing' 
                   ? (panicMode ? 'text-white border-b-2 border-white' : 'text-zinc-950 border-b-2 border-zinc-950') 
                   : 'text-zinc-400 hover:text-zinc-650'
               }`}
               onClick={() => setJobTab('doing')}
             >
               Đang chạy ({myRunning.filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length})
             </button>
             <button 
               type="button"
               className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
                 jobTab === 'requested' 
                   ? (panicMode ? 'text-white border-b-2 border-white' : 'text-zinc-950 border-b-2 border-zinc-950') 
                   : 'text-zinc-400 hover:text-zinc-650'
               }`}
               onClick={() => setJobTab('requested')}
             >
               Đơn đã nhờ ({myRequested.filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length})
             </button>
           </div>
          
           {/* VIỆC MÌNH CHẠY (DOING) */}
           {jobTab === 'doing' && (() => {
             // Ẩn đơn HUỶ / HOÀN THÀNH. Ưu tiên PENDING -> ACCEPTED -> DELIVERING.
             const sortPriority = { 'PENDING': 1, 'ACCEPTED': 2, 'DELIVERING': 3 };
             const activeRunning = myRunning.filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').sort((a,b) => {
               const pA = sortPriority[a.status] || 99;
               const pB = sortPriority[b.status] || 99;
               return pA !== pB ? pA - pB : new Date(b.createdAt) - new Date(a.createdAt);
             });
             const displayedRunning = viewAllDoing ? activeRunning : activeRunning.slice(0, 5);

             return (
               <div className="errand-smart-batch mt-4">
                 {activeRunning.length > 1 && (
                   <div className="text-xs font-bold flex items-center gap-2 mb-3 text-zinc-900 dark:text-zinc-100">
                     <Icons.Sparkles className="w-3.5 h-3.5 text-zinc-400 animate-pulse" /> Lộ trình AI gợi ý: Hãy gộp đơn vào một lần đi để tiện lợi nhất!
                   </div>
                 )}
                 <div className="errand-smart-batch-items">
                   {activeRunning.length === 0 ? (
                     <div className="text-center py-8 text-xs font-semibold text-zinc-400">Bạn chưa nhận chạy đơn nào.</div>
                   ) : (
                     <>
                       {displayedRunning.map((item, i) => (
                         <div key={item.id} className={`errand-smart-batch-item flex flex-col p-4 border rounded-xl gap-3 ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                           <div className="flex items-center justify-between gap-4">
                             <div className="flex gap-3 items-center min-w-0">
                               <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${panicMode ? 'bg-zinc-850 text-white' : 'bg-zinc-100 text-zinc-900'}`}>{i + 1}</span>
                               <div className="batch-info min-w-0">
                                 <div className="batch-title text-xs font-bold truncate text-zinc-900 dark:text-white">{item.title}</div>
                                 <div className="batch-route flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5 truncate"><Icons.MapPin className="w-3 h-3" /> {item.locationBuy} → {item.locationDrop}</div>
                               </div>
                             </div>
                             <span className="batch-coin flex items-center gap-1 shrink-0 font-bold text-xs text-zinc-900 dark:text-white">{fmtUC(item.fee + item.tipAmount)} UC</span>
                           </div>
                           
                           <div className={`pt-3 border-t border-dashed flex justify-between items-center gap-4 ${panicMode ? 'border-zinc-800' : 'border-zinc-150'}`}>
                             <div className="flex flex-col gap-0.5 text-[11px] font-bold">
                               <span className={`${
                                 item.status === 'DELIVERING' ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500'
                               }`}>
                                 {item.status === 'ACCEPTED' ? 'Đã nhận' : item.status === 'DELIVERING' ? 'Đang giao' : item.status}
                               </span>
                               {(item.excuseRequested || item.excused) && (
                                 <span className="text-[10px] text-zinc-400 font-medium font-italic">
                                   {item.excuseRequested && !item.excused && '(Đang xin trễ)'}
                                   {item.excused && '(Đã duyệt trễ)'}
                                 </span>
                               )}
                             </div>
                             <div className="flex gap-1.5">
                               <button 
                                 type="button" 
                                 onClick={() => handleChatErrand(item, `Chào bạn, mình đang mua đồ "${item.title}" cho bạn đây!`)} 
                                 className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                               >
                                 Chat
                               </button>
                               
                               {item.status === 'ACCEPTED' && (
                                 <>
                                   <button 
                                     type="button" 
                                     onClick={() => handleDeliverErrand(item)} 
                                     className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-[10px] font-bold transition-colors"
                                   >
                                     Giao
                                   </button>
                                   
                                   {!item.excuseRequested && !item.excused && (
                                     <button 
                                       type="button" 
                                       onClick={() => handleExcuseErrand(item)} 
                                       className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-250 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-650 hover:bg-zinc-100'}`}
                                     >
                                       Trễ
                                     </button>
                                   )}
                                   
                                   <button 
                                     type="button" 
                                     onClick={() => handleCancelErrand(item)} 
                                     className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800'}`}
                                   >
                                     Hủy
                                   </button>
                                 </>
                               )}
                             </div>
                           </div>
                         </div>
                       ))}
                       {activeRunning.length > 5 && (
                         <button 
                           onClick={() => setViewAllDoing(!viewAllDoing)}
                           className={`w-full py-3 rounded-lg text-xs font-bold transition-all ${
                             panicMode 
                               ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200' 
                               : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
                           }`}
                         >
                           {viewAllDoing ? 'Thu gọn ⌃' : `Xem tất cả ${activeRunning.length} việc ⌄`}
                         </button>
                       )}
                     </>
                   )}
                 </div>
               </div>
             );
           })()}

           {/* VIỆC MÌNH NHỜ (REQUESTED) */}
           {jobTab === 'requested' && (() => {
             // Ẩn đơn HUỶ / HOÀN THÀNH. Ưu tiên PENDING -> ACCEPTED -> DELIVERING.
             const sortPriority = { 'PENDING': 1, 'ACCEPTED': 2, 'DELIVERING': 3 };
             const activeRequested = myRequested.filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').sort((a,b) => {
               const pA = sortPriority[a.status] || 99;
               const pB = sortPriority[b.status] || 99;
               return pA !== pB ? pA - pB : new Date(b.createdAt) - new Date(a.createdAt);
             });
             const displayedRequested = viewAllRequested ? activeRequested : activeRequested.slice(0, 5);

             return (
              <div className="mt-4">
                <div className="errand-smart-batch-items">
                  {activeRequested.length === 0 ? (
                    <div className="text-center py-8 text-xs font-semibold text-zinc-400">Bạn chưa tạo đơn nhờ mua nào đang chờ.</div>
                  ) : (
                    <>
                      {displayedRequested.map((item, i) => (
                        <div key={item.id} className={`errand-smart-batch-item flex flex-col p-4 border rounded-xl gap-3 ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex gap-3 items-center min-w-0">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${panicMode ? 'bg-zinc-850 text-white' : 'bg-zinc-100 text-zinc-900'}`}>📝</span>
                              <div className="batch-info min-w-0">
                                <div className="batch-title text-xs font-bold truncate text-zinc-900 dark:text-white">{item.title}</div>
                                <div className="batch-route text-[11px] text-zinc-400 mt-0.5 truncate">📍 {item.locationBuy} → {item.locationDrop}</div>
                              </div>
                            </div>
                            <span className="batch-coin shrink-0 font-bold text-xs text-zinc-500 dark:text-zinc-300">Khóa: {fmtUC(item.lockedAmount)} UC</span>
                          </div>
                          
                          <div className={`pt-3 border-t border-dashed flex flex-col gap-3 ${panicMode ? 'border-zinc-800' : 'border-zinc-150'}`}>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                                Trạng thái: {item.status === 'ACCEPTED' ? 'Đã nhận' : item.status === 'DELIVERING' ? 'Đang giao' : item.status}
                                {item.runner && (
                                  <span className="cursor-pointer ml-1 text-zinc-400 font-medium" onClick={() => onOpenProfile?.(item.runner)}>
                                    (Shipper: {item.runner.fullName || item.runner.username})
                                  </span>
                                )}
                              </span>
                              <div className="flex gap-1.5">
                                {item.status === 'PENDING' && (
                                    <>
                                      <button 
                                        type="button" 
                                        onClick={() => handleEditErrand(item)} 
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                                      >
                                        Sửa
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => handleCancelErrand(item)} 
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800'}`}
                                      >
                                        Hủy
                                      </button>
                                    </>
                                )}
                                {['ACCEPTED', 'DELIVERING'].includes(item.status) && (
                                    <>
                                      <button 
                                        type="button" 
                                        onClick={() => onChat?.(item.runner, `Chào bạn, mình muốn hỏi về đơn "${item.title}"`)} 
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                                      >
                                        Chat
                                      </button>
                                      
                                      {item.status === 'ACCEPTED' && (
                                        <button 
                                          type="button" 
                                          onClick={() => handleCancelErrand(item)} 
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-550 border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800'}`}
                                        >
                                          Hủy
                                        </button>
                                      )}
        
                                      <button 
                                        type="button" 
                                        onClick={() => handleCompleteErrand(item)} 
                                        className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-[10px] font-bold transition-colors"
                                      >
                                        Đã nhận
                                      </button>
                                    </>
                                )}
                              </div>
                            </div>
    
                            {item.status === 'ACCEPTED' && item.excuseRequested && !item.excused && (
                              <div className={`p-3 rounded-lg border flex flex-col gap-2 ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-normal m-0">⚠️ Shipper xin thông cảm vì trễ giờ (tránh bị phạt tự động).</p>
                                <div className="flex gap-1.5">
                                  <button 
                                    type="button" 
                                    onClick={() => handleResolveExcuse(item, 'ACCEPT')} 
                                    className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-md text-[10px] font-bold transition-colors"
                                  >
                                    Bỏ qua
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleResolveExcuse(item, 'CANCEL')} 
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                                  >
                                    Thu hồi
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {activeRequested.length > 5 && (
                        <button 
                          onClick={() => setViewAllRequested(!viewAllRequested)}
                          className={`w-full py-3 rounded-lg text-xs font-bold transition-all ${
                            panicMode 
                              ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200' 
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
                          }`}
                        >
                          {viewAllRequested ? 'Thu gọn ⌃' : `Xem tất cả ${activeRequested.length} đơn nhờ ⌄`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
             );
           })()}
        </div>
      )}
    </div>
  );
};

export default ErrandMarketScreen;
