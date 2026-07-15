import { fmtUC } from '../utils';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Icons } from '../App';
import './RideMarket.css';

// ==========================================
// LOCATION AUTOCOMPLETE (Nominatim / OpenStreetMap)
// ==========================================
const LocationAutocomplete = ({ placeholder, value, onSelect, className }) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Ẩn danh sách khi click ra ngoài
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowList(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync value từ bên ngoài (ví dụ: swap route)
  useEffect(() => { setQuery(value || ''); }, [value]);

  const search = useCallback(async (q) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: q + ', Quy Nhơn, Việt Nam',
          format: 'json',
          addressdetails: 1,
          limit: 6,
          'accept-language': 'vi'
        },
        headers: { 'User-Agent': 'UniVerse-App/1.0' }
      });
      setSuggestions(res.data || []);
      setShowList(true);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    // Thông báo lên trên để clear lat/lng cũ
    onSelect({ label: val, lat: null, lng: null });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handlePick = (item) => {
    const label = item.display_name.split(',').slice(0, 3).join(',').trim();
    setQuery(label);
    setSuggestions([]);
    setShowList(false);
    onSelect({ label, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setShowList(true)}
        autoComplete="off"
      />
      {loading && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8' }}>⏳</span>}
      {showList && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
          maxHeight: 220, overflowY: 'auto'
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => handlePick(s)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                color: '#334155', lineHeight: 1.4
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{ fontWeight: 600 }}>📍</span> {s.display_name.split(',').slice(0, 4).join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const RideMarketScreen = ({ user, panicMode, onChat, showAlert, showConfirm, showPrompt }) => {
  const [rideTab, setRideTab] = useState('need'); // 'need', 'offer', 'manage'
  const [showCreateModal, setShowCreateModal] = useState(false); // Modal tạo yêu cầu tìm xế

  // Data states
  const [requests, setRequests] = useState([]);
  const [myOrdersHistory, setMyOrdersHistory] = useState({ offers: [], requests: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null); // Chi tiết yêu cầu

  // View All states
  const [viewAllAvailable, setViewAllAvailable] = useState(false);
  const [viewAllMyPending, setViewAllMyPending] = useState(false);
  const [viewAllPassengerHistory, setViewAllPassengerHistory] = useState(false);
  const [viewAllDriverHistory, setViewAllDriverHistory] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    departureLat: null,
    departureLng: null,
    destinationLat: null,
    destinationLng: null,
    timeStart: '',
    timeEnd: '',
    date: '',
    phone: '',
    fee: '',
    seats: 1
  });

  // Filters for "Offer a ride"
  const [filterDestination, setFilterDestination] = useState('');

  // --- API CALLS ---
  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/carpool/requests');
      if (res.data?.data) setRequests(res.data.data);
    } catch (err) { console.error(err); }
  };

  const fetchMyOrders = async () => {
    try {
      const res = await axios.get(`/api/market/my-orders/${user.id}`);
      if (res.data?.data) setMyOrdersHistory(res.data.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchRequests();
    if (rideTab === 'manage') fetchMyOrders();
    const timer = setInterval(() => { fetchRequests(); }, 15000);
    return () => clearInterval(timer);
  }, [rideTab]);

  // --- ACTIONS: CUSTOMER (NEED RIDE) ---
  const handleSwapRoute = () => {
    setFormData(prev => ({
      ...prev,
      departure: prev.destination,
      destination: prev.departure,
      departureLat: prev.destinationLat,
      departureLng: prev.destinationLng,
      destinationLat: prev.departureLat,
      destinationLng: prev.departureLng,
    }));
  };

  const handlePostRequest = async (e) => {
    e?.preventDefault();
    if (!formData.departure || !formData.destination) {
      showAlert('Vui lòng nhập điểm đón và điểm đến!', 'warning');
      return;
    }
    if (!formData.fee) {
      showAlert('Vui lòng nhập giá mong muốn!', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/api/carpool/requests', {
        departure: formData.departure,
        destination: formData.destination,
        departureLat: formData.departureLat,
        departureLng: formData.departureLng,
        destinationLat: formData.destinationLat,
        destinationLng: formData.destinationLng,
        departureTime: `${formData.timeStart || '??:??'} - ${formData.timeEnd || '??:??'}`,
        departureDate: formData.date,
        fee: formData.fee,
        phone: formData.phone,
        seats: formData.seats,
        passengerId: user.id
      });
      showAlert(res.data?.message || 'Đăng yêu cầu thành công!', 'success');
      setFormData({ departure: '', destination: '', departureLat: null, departureLng: null, destinationLat: null, destinationLng: null, timeStart: '', timeEnd: '', date: '', phone: '', fee: '', seats: 1 });
      setShowCreateModal(false);
      fetchRequests();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi khi đăng yêu cầu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    const confirmed = await showConfirm('Bạn có chắc chắn muốn chọn tài xế này? Hành trình sẽ được thiết lập.');
    if (!confirmed) return;
    try {
      const res = await axios.put(`/api/carpool/offers/${offerId}/accept`, { passengerId: user.id });
      showAlert(res.data?.message || 'Đã chốt xế!', 'success');
      fetchRequests();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi xử lý', 'error');
    }
  };

  // --- ACTIONS: DRIVER (OFFER RIDE) ---
  const handleSendOffer = async (requestId, originalFee, isAccepting) => {
    let proposedPrice = originalFee;
    if (!isAccepting) {
      const priceStr = await showPrompt(`Khách đang muốn giá: ${fmtUC(originalFee)} UC. Bạn muốn đề xuất mức giá bao nhiêu?`);
      if (!priceStr) return;
      proposedPrice = parseInt(priceStr);
      if (isNaN(proposedPrice) || proposedPrice <= 0) {
        showAlert('Mức giá không hợp lệ!', 'error');
        return;
      }
    } else {
      const confirm = await showConfirm(`Bạn đồng ý chở với giá ${fmtUC(originalFee)} UC chứ?`);
      if (!confirm) return;
    }
    try {
      const res = await axios.post('/api/carpool/offers', {
        requestId, driverId: user.id, proposedPrice
      });
      showAlert(res.data?.message || 'Đã gửi đề nghị đến khách!', 'success');
      fetchRequests();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi gửi đề nghị', 'error');
    }
  };

  const handleCompleteRide = async (requestId) => {
    const confirmed = await showConfirm('Bạn xác nhận chuyến xe này đã hoàn thành?');
    if (!confirmed) return;
    try {
      const res = await axios.put(`/api/carpool/requests/${requestId}/complete`, { userId: user.id });
      showAlert(res.data?.message || 'Chúc mừng! Chuyến đi kết thúc thành công.', 'success');
      fetchMyOrders();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi hệ thống', 'error');
    }
  };

  const handleCancelRide = async (requestId) => {
    const confirmed = await showConfirm('Bạn có chắc chắn muốn huỷ chuyến xe này không?');
    if (!confirmed) return;
    try {
      const res = await axios.put(`/api/carpool/requests/${requestId}/cancel`, { userId: user.id });
      showAlert(res.data?.message || 'Đã huỷ chuyến xe.', 'success');
      setSelectedRequest(null);
      fetchRequests();
      fetchMyOrders();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi hệ thống', 'error');
    }
  };

  const handleChatUser = (targetUser, text) => {
    if (onChat && targetUser) onChat(targetUser, text);
  };

  // --- FILTERS ---
  const sortPriorityMap = { 'PENDING': 1, 'IN_PROGRESS': 2, 'ACCEPTED': 3, 'ACTIVE': 4, 'DELIVERING': 5, 'COMPLETED': 6, 'CANCELLED': 7 };

  const activeMyPending = requests
    .filter(r => r.passengerId === user.id && r.status !== 'CANCELLED' && r.status !== 'COMPLETED')
    .sort((a, b) => (sortPriorityMap[a.status] || 99) - (sortPriorityMap[b.status] || 99) || new Date(b.createdAt) - new Date(a.createdAt));
  const myPendingRequests = viewAllMyPending ? activeMyPending : activeMyPending.slice(0, 5);

  const activeAvailable = requests
    .filter(r => {
      if (r.passengerId === user.id) return false;
      if (r.status === 'CANCELLED' || r.status === 'COMPLETED') return false;
      if (filterDestination && !r.destination.toLowerCase().includes(filterDestination.toLowerCase()) && !r.departure.toLowerCase().includes(filterDestination.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (sortPriorityMap[a.status] || 99) - (sortPriorityMap[b.status] || 99) || new Date(b.createdAt) - new Date(a.createdAt));
  const availableRequests = viewAllAvailable ? activeAvailable : activeAvailable.slice(0, 5);

  const activeHistoryDriver = myOrdersHistory.offers
    .filter(o => o.category === 'RIDE')
    .sort((a, b) => (sortPriorityMap[a.status] || 99) - (sortPriorityMap[b.status] || 99) || new Date(b.createdAt) - new Date(a.createdAt));
  const historyRidesAsDriver = viewAllDriverHistory ? activeHistoryDriver : activeHistoryDriver.slice(0, 5);

  const activeHistoryPassenger = myOrdersHistory.requests
    .filter(r => r.category === 'RIDE')
    .sort((a, b) => (sortPriorityMap[a.status] || 99) - (sortPriorityMap[b.status] || 99) || new Date(b.createdAt) - new Date(a.createdAt));
  const historyRidesAsPassenger = viewAllPassengerHistory ? activeHistoryPassenger : activeHistoryPassenger.slice(0, 5);

  return (
    <div className={`${panicMode ? 'ride-panic' : ''}`}>

      {/* ============================================ */}
      {/* TOP ACTION TABS                              */}
      {/* ============================================ */}
      <div className={`flex border-b mb-4 ${panicMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <button
          type="button"
          className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 ${panicMode ? 'text-white border-white' : 'text-zinc-950 border-zinc-950'}`}
          onClick={() => setShowCreateModal(true)}
        >
          <Icons.MapPin className="w-3.5 h-3.5 inline mr-1" /> Tìm Xế
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
            rideTab === 'offer'
              ? (panicMode ? 'text-white border-b-2 border-white' : 'text-zinc-950 border-b-2 border-zinc-950')
              : 'text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent'
          }`}
          onClick={() => setRideTab('offer')}
        >
          <Icons.Bike className="w-3.5 h-3.5 inline mr-1" /> Nhận Chở
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
            rideTab === 'manage'
              ? (panicMode ? 'text-white border-b-2 border-white' : 'text-zinc-950 border-b-2 border-zinc-950')
              : 'text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent'
          }`}
          onClick={() => setRideTab('manage')}
        >
          <Icons.FileText className="w-3.5 h-3.5 inline mr-1" /> Quản Lý
        </button>
      </div>

      {/* ============================================ */}
      {/* MODAL TẠO YÊU CẦU TÌM XẾ                    */}
      {/* ============================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-md p-5 border max-h-[90vh] overflow-y-auto ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 m-0 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>
                <Icons.Bike className="w-4 h-4 text-zinc-400" /> Đặt xe ngay
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className={`w-7 h-7 rounded-full flex items-center justify-center border transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Route */}
              <div className={`ride-route-box relative p-4 rounded-xl border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="ride-route-dots">
                  <div className="dot from"></div>
                  <div className="line"></div>
                  <div className="dot to"></div>
                </div>
                <div className="ride-route-inputs space-y-3">
                  <LocationAutocomplete
                    placeholder="Điểm đón (nhập từ khóa...)"
                    value={formData.departure}
                    className={`w-full border p-3 pl-8 rounded-lg outline-none text-xs font-medium transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                    onSelect={({ label, lat, lng }) => setFormData(prev => ({ ...prev, departure: label, departureLat: lat, departureLng: lng }))}
                  />
                  <LocationAutocomplete
                    placeholder="Điểm đến (nhập từ khóa...)"
                    value={formData.destination}
                    className={`w-full border p-3 pl-8 rounded-lg outline-none text-xs font-medium transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                    onSelect={({ label, lat, lng }) => setFormData(prev => ({ ...prev, destination: label, destinationLat: lat, destinationLng: lng }))}
                  />
                </div>
                <button
                  type="button"
                  className={`absolute right-5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                  onClick={handleSwapRoute}
                >⇅</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${panicMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Ngày khởi hành</label>
                  <input
                    type="date"
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${panicMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Số điện thoại</label>
                  <input
                    type="tel"
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                    placeholder="0912..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${panicMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Khung giờ mong muốn</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className={`flex-1 p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                      value={formData.timeStart}
                      onChange={(e) => setFormData({ ...formData, timeStart: e.target.value })}
                    />
                    <span className="text-zinc-400 font-bold text-xs">-</span>
                    <input
                      type="time"
                      className={`flex-1 p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                      value={formData.timeEnd}
                      onChange={(e) => setFormData({ ...formData, timeEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${panicMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Ghi chú thêm</label>
                <input
                  type="text"
                  className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                  placeholder="VD: mang đồ nhẹ, chỉ đi xe máy..."
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              <div className={`p-3 rounded-xl border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${panicMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <Icons.CreditCard className="w-3.5 h-3.5" /> Giá mong muốn
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${panicMode ? 'text-zinc-500' : 'text-zinc-400'}`}>UC</label>
                  <input
                    type="number"
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-none transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-white focus:border-white' : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-900'}`}
                    placeholder="50"
                    min="1"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'}`}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePostRequest}
                  disabled={isLoading}
                  className={`flex-1 py-2.5 flex items-center justify-center rounded-xl font-bold text-xs transition disabled:opacity-50 ${panicMode ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-950 text-white hover:bg-zinc-900'}`}
                >
                  <Icons.Send className="w-3.5 h-3.5 mr-1.5" />
                  {isLoading ? 'Đang đăng...' : 'Tìm xế ngay!'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL CHI TIẾT YÊU CẦU (Tài xế xem)          */}
      {/* ============================================ */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelectedRequest(null)}>
          <div className={`rounded-2xl w-full max-w-sm p-5 border ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-sm font-bold uppercase tracking-wider ${panicMode ? 'text-white' : 'text-zinc-900'}`}>Chi tiết yêu cầu</h3>
              <button type="button" onClick={() => setSelectedRequest(null)} className={`w-7 h-7 rounded-full flex items-center justify-center border transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-3">
              <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                <div className={`w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${panicMode ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Icons.MapPin className="w-3 h-3" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Điểm đón</span>
                  <span className={`text-xs font-semibold ${panicMode ? 'text-zinc-200' : 'text-zinc-700'}`}>{selectedRequest.departure}</span>
                </div>
              </div>
              <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                <div className={`w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${panicMode ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Icons.Target className="w-3 h-3" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Điểm đến</span>
                  <span className={`text-xs font-semibold ${panicMode ? 'text-zinc-200' : 'text-zinc-700'}`}>{selectedRequest.destination}</span>
                </div>
              </div>
              {selectedRequest.departureDate && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Icons.Calendar className="w-4 h-4 text-gray-400" />
                  Ngày: <span className="font-semibold" style={{ color: (() => { 
                    const d = new Date(selectedRequest.departureDate); 
                    if (isNaN(d.getTime())) return '#2563eb';
                    const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0); 
                    return d < today ? '#ef4444' : d.getTime() === today.getTime() ? '#f97316' : '#2563eb'; 
                  })() }}>
                    {(() => { 
                      const d = new Date(selectedRequest.departureDate); 
                      if (isNaN(d.getTime())) return selectedRequest.departureDate;
                      const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0); 
                      if (d.getTime() === today.getTime()) return 'Hôm nay - ' + d.toLocaleDateString('vi-VN'); 
                      if (d < today) return 'Đã qua ngày - ' + d.toLocaleDateString('vi-VN'); 
                      return d.toLocaleDateString('vi-VN'); 
                    })()}
                  </span>
                </div>
              )}
              {selectedRequest.departureTime && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.Clock className="w-4 h-4 text-gray-400" />
                  Giờ: <span className="font-semibold">{selectedRequest.departureTime}</span>
                </div>
              )}
              {selectedRequest.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.Phone className="w-4 h-4 text-gray-400" />
                  SĐT: <span className="font-semibold">{selectedRequest.phone}</span>
                </div>
              )}
            </div>

            <div className={`p-3 rounded-xl mb-4 flex items-center justify-between border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-0.5">Giá khách muốn</span>
                <span className={`font-bold text-base ${panicMode ? 'text-white' : 'text-zinc-900'}`}>{fmtUC(selectedRequest.fee)} UC</span>
              </div>
            </div>

            <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
              {(() => {
                const passengerData = selectedRequest.passenger || (selectedRequest.passengerId === user.id ? user : null);
                return (
                  <>
                    {passengerData?.avatarUrl ? (
                      <img src={passengerData.avatarUrl} alt="" className={`w-8 h-8 rounded-full object-cover shrink-0 border ${panicMode ? 'border-zinc-700' : 'border-zinc-200'}`} />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${panicMode ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                        {passengerData?.fullName?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <div className={`font-bold text-xs ${panicMode ? 'text-white' : 'text-zinc-800'}`}>{passengerData?.fullName || passengerData?.username || 'Khách hàng'}</div>
                      <div className="text-[10px] text-zinc-400 font-medium">Hành khách</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {selectedRequest.passengerId !== user.id ? (() => {
              const alreadyOffered = selectedRequest.offers?.some(o => o.driverId === user.id);
              const isAccepted = selectedRequest.status === 'IN_PROGRESS' || selectedRequest.status === 'ACCEPTED';
              return (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-xl font-bold text-xs border transition flex justify-center items-center gap-1.5 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                    onClick={() => { setSelectedRequest(null); handleChatUser(selectedRequest.passenger, 'Chào bạn, mình đón được nha!'); }}
                  >
                    <Icons.MessageCircle className="w-3.5 h-3.5" /> Nhắn tin
                  </button>
                  {alreadyOffered ? (
                    <button
                      type="button"
                      disabled
                      className={`flex-1 py-2 rounded-xl font-bold text-xs border flex justify-center items-center gap-1.5 cursor-default opacity-50 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}
                    >
                      <Icons.Clock className="w-3.5 h-3.5" /> Đã gửi
                    </button>
                  ) : isAccepted ? (
                    <button
                      type="button"
                      disabled
                      className={`flex-1 py-2 rounded-xl font-bold text-xs border flex justify-center items-center gap-1.5 cursor-default opacity-50 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}
                    >
                      <Icons.CheckCircle className="w-3.5 h-3.5" /> Đã có xế
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-xl font-bold text-xs transition flex justify-center items-center gap-1.5 ${panicMode ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-950 text-white hover:bg-zinc-900'}`}
                      onClick={() => { setSelectedRequest(null); handleSendOffer(selectedRequest.id, selectedRequest.fee, true); }}
                    >
                      <Icons.CheckCircle className="w-3.5 h-3.5" /> Nhận chở
                    </button>
                  )}
                </div>
              );
            })() : (
              <div className="flex gap-2">
                {selectedRequest.status === 'PENDING' && (
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-xl font-bold text-xs border transition flex justify-center items-center gap-1.5 ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'}`}
                    onClick={() => handleCancelRide(selectedRequest.id)}
                  >
                    <Icons.Trash className="w-3.5 h-3.5" /> Huỷ
                  </button>
                )}
                <button
                  type="button"
                  className={`flex-1 py-2 rounded-xl font-bold text-xs border transition ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200'}`}
                  onClick={() => setSelectedRequest(null)}
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB NỘI DUNG                                 */}
      {/* ============================================ */}

      {/* My Pending Requests (Khách đang chờ xế) - hiện ở "need" tab */}
      {rideTab === 'need' && (
        <div className="px-0">
          {myPendingRequests.length > 0 && (
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>
              <Icons.Target className="w-3.5 h-3.5 text-zinc-400" /> Yêu cầu đang chờ xế
            </h3>
          )}
          <div className="space-y-3">
            {myPendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-3 flex items-center justify-center text-zinc-300"><Icons.Bike className="w-12 h-12" /></div>
                <div className={`font-bold text-xs mb-1 ${panicMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Bạn chưa có yêu cầu nào</div>
                <div className="text-[11px] text-zinc-400">Nhấn <span className={`font-bold ${panicMode ? 'text-white' : 'text-zinc-900'}`}>Tìm Xế</span> để đặt xe</div>
              </div>
            ) : (
              myPendingRequests.map(req => (
                <div key={req.id} className={`rounded-xl p-4 border relative overflow-hidden cursor-pointer transition ${panicMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'}`} onClick={() => setSelectedRequest(req)}>
                  <div className={`absolute top-0 right-0 text-[9px] font-bold px-2.5 py-1 rounded-bl-lg uppercase tracking-wider ${panicMode ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'}`}>Chờ xế</div>
                  <div className={`font-bold text-xs mb-2 pr-14 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>{req.departure} <span className="text-zinc-400 font-normal">→</span> {req.destination}</div>
                  <div className={`text-[11px] flex items-center gap-4 mb-3 font-medium ${panicMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <span className="flex items-center gap-1"><Icons.Clock className="w-3.5 h-3.5" /> {req.departureTime || 'Sớm nhất'}</span>
                    <span className={`flex items-center gap-1 font-bold ${panicMode ? 'text-white' : 'text-zinc-900'}`}><Icons.UC className="w-3.5 h-3.5" /> {fmtUC(req.fee)} UC</span>
                  </div>
                  <div className={`-mx-4 -mb-4 px-4 py-3 border-t ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase mb-2">Tài xế nhận cuốc ({req.offers?.length || 0})</p>
                    {(!req.offers || req.offers.length === 0) ? (
                      <p className="text-[11px] text-zinc-400 italic text-center py-2">Chưa có ai nhận...</p>
                    ) : (
                      <div className="space-y-2">
                                        {req.offers.map(offer => (
                          <div key={offer.id} className={`border p-2.5 rounded-lg flex items-center justify-between ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex items-center gap-2">
                              {offer.driver?.avatarUrl ? (
                                <img src={offer.driver.avatarUrl} alt="" className={`w-8 h-8 rounded-full object-cover border ${panicMode ? 'border-zinc-700' : 'border-zinc-200'}`} />
                              ) : (
                                <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs ${panicMode ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-700'}`}>{offer.driver?.fullName?.[0] || '?'}</div>
                              )}
                              <div>
                                <div className={`font-bold text-xs flex items-center gap-1 ${panicMode ? 'text-white' : 'text-zinc-800'}`}>{offer.driver?.fullName} <span className="text-[9px] text-zinc-400 flex items-center gap-0.5"><Icons.Star className="w-2.5 h-2.5" /> 5.0</span></div>
                                <div className="text-[11px] text-zinc-400">Giá: <span className={`font-bold ${panicMode ? 'text-white' : 'text-zinc-900'}`}>{fmtUC(offer.proposedPrice)} UC</span></div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <button onClick={(e) => { e.stopPropagation(); handleAcceptOffer(offer.id); }} className={`font-bold px-3 py-1 rounded-lg text-[10px] transition ${panicMode ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-950 text-white hover:bg-zinc-900'}`}>CHỌN</button>
                              <button onClick={(e) => { e.stopPropagation(); handleChatUser(offer.driver, `Chào ${offer.driver?.fullName}, mình báo giá chuyến đi xíu nhé.`); }} className="text-zinc-400 hover:text-zinc-600 font-medium text-[10px] underline">Chat</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {activeMyPending.length > 5 && (
              <button onClick={() => setViewAllMyPending(!viewAllMyPending)} className={`w-full py-3 rounded-lg text-xs font-bold transition ${panicMode ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'}`}>
                {viewAllMyPending ? 'Thu gọn ⌃' : `Xem tất cả ${activeMyPending.length} yêu cầu ⌄`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TÀI XẾ TÌM KHÁCH */}
      {rideTab === 'offer' && (
        <div className="px-0">
          <div className="errand-filter-bar mb-4">
            <input
              type="text"
              placeholder="🔍 Lọc điểm đi/đến..."
              className="errand-filter-input"
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
            />
          </div>

          <div className="errand-card-list">
            {availableRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-3 flex items-center justify-center text-zinc-300"><Icons.Package className="w-12 h-12" /></div>
                <div className={`font-bold text-xs ${panicMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Chưa có ai cần chở!</div>
              </div>
            ) : (
              <>
                {availableRequests.map(req => (
                  <div
                    key={req.id}
                    className="errand-card"
                    onClick={() => setSelectedRequest(req)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="errand-card-header">
                      <div className="errand-card-tags">
                        <span className="errand-card-type-tag food flex items-center gap-1">
                          <Icons.Bike className="w-3.5 h-3.5 inline" /> ĐI XE
                        </span>
                      </div>
                      <div className="errand-card-reward">
                        <div className="errand-card-reward-value">{fmtUC(req.fee)} UC</div>
                      </div>
                    </div>

                    <div className="errand-card-route">
                      <div className="errand-route-point">
                        <div className="errand-route-dot from"></div>
                        <span className="errand-route-text">{req.departure}</span>
                      </div>
                      <span className="errand-route-arrow">➔</span>
                      <div className="errand-route-point">
                        <div className="errand-route-dot to"></div>
                        <span className="errand-route-text">{req.destination}</span>
                      </div>
                    </div>

                    <div className="errand-card-body">
                      <div className="errand-card-title flex items-center gap-1.5">
                        <Icons.Clock className="w-4 h-4 text-gray-400" />
                        {req.departureTime || 'Càng sớm càng tốt'}
                      </div>
                      {req.departureDate && (
                        <div className="flex items-center gap-1.5 text-[13px] font-semibold mt-1" style={{ color: (() => { const d = new Date(req.departureDate); const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0); return d < today ? '#ef4444' : d.getTime() === today.getTime() ? '#f97316' : '#2563eb'; })() }}>
                          <Icons.Calendar className="w-4 h-4" />
                          {(() => { const d = new Date(req.departureDate); const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0); if (d.getTime() === today.getTime()) return '📅 Hôm nay - ' + d.toLocaleDateString('vi-VN'); if (d < today) return '⚠️ Đã qua ngày - ' + d.toLocaleDateString('vi-VN'); return '📅 ' + d.toLocaleDateString('vi-VN'); })()}
                        </div>
                      )}
                      <div className="errand-card-requester">
                        {req.passenger?.avatarUrl ? (
                          <img src={req.passenger.avatarUrl} alt="" className="errand-card-avatar object-cover" />
                        ) : (
                          <div className="errand-card-avatar">{req.passenger?.fullName?.[0] || '?'}</div>
                        )}
                        <span className="errand-card-requester-name">{req.passenger?.fullName || req.passenger?.username}</span>
                      </div>
                    </div>

                    <div className="errand-card-footer">
                      <span className="errand-card-time flex items-center gap-1">
                        <Icons.Clock className="w-3.5 h-3.5" /> {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="errand-chat-btn flex items-center justify-center"
                          onClick={(e) => { e.stopPropagation(); handleChatUser(req.passenger, 'Chào bạn, mình đón được nha!'); }}
                        >
                          <Icons.MessageCircle className="w-3.5 h-3.5 mr-1" /> Nhắn tin
                        </button>
                        <button
                          type="button"
                          className="errand-accept-btn flex items-center justify-center"
                          onClick={(e) => { e.stopPropagation(); handleSendOffer(req.id, req.fee, true); }}
                        >
                          <Icons.CheckCircle className="w-3.5 h-3.5 mr-1" /> Nhận chở
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {activeAvailable.length > 5 && (
                  <button
                    onClick={() => setViewAllAvailable(!viewAllAvailable)}
                    className={`w-full py-3 rounded-lg text-xs font-bold transition mt-2 ${panicMode ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'}`}
                  >
                    {viewAllAvailable ? 'Thu gọn ⌃' : `Xem tất cả ${activeAvailable.length} tín hiệu ⌄`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUẢN LÝ */}
      {rideTab === 'manage' && (
        <div className="px-0">
          <div className="space-y-6">
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>
                <Icons.MapPin className="w-3.5 h-3.5 text-zinc-400" /> Chuyến đi (Khách)
              </h3>
              {historyRidesAsPassenger.length === 0 ? (
                <p className="text-[11px] text-zinc-400 italic">Chưa có dữ liệu</p>
              ) : (
                historyRidesAsPassenger.map(h => (
                  <div key={`history-req-${h.id}`} onClick={() => { if (h.rawData) setSelectedRequest(h.rawData); }} className={`p-3 rounded-xl mb-2 flex justify-between items-center border-l-2 cursor-pointer transition ${panicMode ? 'bg-zinc-900 hover:bg-zinc-850' : 'bg-white hover:bg-zinc-50'} ${h.status === 'IN_PROGRESS' ? (panicMode ? 'border-zinc-400' : 'border-zinc-900') : h.status === 'COMPLETED' ? 'border-zinc-300' : (panicMode ? 'border-zinc-700' : 'border-zinc-200')}`}>
                    <div>
                      <div className={`font-bold text-xs line-clamp-1 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>{h.title}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">#{h.id} • Xế: {h.targetUser?.fullName || '---'}</div>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded flex items-center w-max gap-1 select-none ${h.status === 'IN_PROGRESS' ? (panicMode ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-white') : (panicMode ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500')}`}>
                        {h.status === 'IN_PROGRESS' ? <><Icons.Clock className="w-2.5 h-2.5" /> ĐANG CHẠY</> : h.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>
                <Icons.Bike className="w-3.5 h-3.5 text-zinc-400" /> Chuyến chở (Xế)
              </h3>
              {historyRidesAsDriver.length === 0 ? (
                <p className="text-[11px] text-zinc-400 italic">Chưa có dữ liệu</p>
              ) : (
                historyRidesAsDriver.map(h => (
                  <div key={`history-off-${h.id}`} onClick={() => { if (h.rawData) setSelectedRequest(h.rawData); }} className={`p-3 rounded-xl mb-2 border-l-2 cursor-pointer transition ${panicMode ? 'bg-zinc-900 hover:bg-zinc-850' : 'bg-white hover:bg-zinc-50'} ${h.status === 'IN_PROGRESS' ? (panicMode ? 'border-zinc-400' : 'border-zinc-900') : h.status === 'COMPLETED' ? 'border-zinc-300' : (panicMode ? 'border-zinc-700' : 'border-zinc-200')}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className={`font-bold text-xs line-clamp-1 ${panicMode ? 'text-white' : 'text-zinc-900'}`}>{h.title}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">#{h.id} • Khách: {h.targetUser?.fullName || '---'}</div>
                      </div>
                      {h.status === 'IN_PROGRESS' && (
                        <button onClick={() => handleCompleteRide(h.id)} className={`font-bold text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap transition ${panicMode ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-950 text-white hover:bg-zinc-900'}`}>
                          Hoàn thành
                        </button>
                      )}
                    </div>
                    <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded flex items-center w-max gap-1 select-none ${h.status === 'IN_PROGRESS' ? (panicMode ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-white') : (panicMode ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500')}`}>
                      {h.status === 'IN_PROGRESS' ? <><Icons.Clock className="w-2.5 h-2.5" /> ĐANG VẬN CHUYỂN</> : h.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RideMarketScreen;
