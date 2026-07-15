import { fmtUC } from '../utils';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icons } from '../App';
import './DocumentMarket.css';

// ==========================================
// Helpers
// ==========================================
const getTypeStyle = (type) => {
  switch (type?.toLowerCase()) {
    case 'pdf': return 'pdf';
    case 'word': return 'word';
    case 'slide': return 'slide';
    default: return 'summary';
  }
};

const getTypeLabel = (type) => {
  switch (type?.toLowerCase()) {
    case 'pdf': return 'PDF';
    case 'word': return 'DOC';
    case 'slide': return 'PPT';
    default: return 'TXT';
  }
};

const renderStars = (rating) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '⭐';
  if (half) stars += '⭐';
  return stars;
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

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

// --- Document Card (Thẻ tài liệu đang bán) ---
const DocumentCard = ({ doc, onBuy, onPreview, currentUser, onEdit, onDelete, onMessage, onConfirmSale, onViewDetail, isMyOrder }) => (
  <div className="doc-card" style={{ cursor: 'pointer' }}
    onClick={() => {
      onViewDetail?.(doc);
    }}
  >
    <div className="doc-card-header">
      <div className="doc-card-type-icon" style={{ background: '#fff', color: '#1e293b', padding: 0, border: '1.5px solid #cbd5e1' }}>
        <Icons.FileText className="w-5 h-5" />
      </div>
      <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div className="doc-card-title">{doc.title}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{formatTimeAgo(doc.createdAt)}</div>
      </div>
      {doc.isCombo && (
        <span className="doc-card-tag-combo">📦 Combo</span>
      )}
    </div>

    <div className="doc-card-body">
      <div className="doc-card-meta">
        <div className="doc-card-meta-item flex items-center gap-1">
          <span className="meta-icon" style={{ display: 'flex' }}><Icons.User className="w-3.5 h-3.5 text-slate-400" /></span> {doc.lecturer || 'N/A'}
        </div>
        <div className="doc-card-meta-item flex items-center gap-1">
          <span className="meta-icon" style={{ display: 'flex' }}><Icons.BookOpen className="w-3.5 h-3.5 text-slate-400" /></span> {doc.subject || 'N/A'}
        </div>
        <div className="doc-card-meta-item flex items-center gap-1 font-bold text-rose-500">
          <Icons.UC className="w-3.5 h-3.5 text-rose-500" /> {fmtUC(doc.price)} UC
        </div>
      </div>
      <div className="doc-card-rating">

      </div>
    </div>

    <div className="doc-card-footer" onClick={e => e.stopPropagation()}>
      <div className="doc-card-seller" style={{ cursor: 'pointer' }} onClick={() => onOpenProfile?.(doc.author)}>
        {doc.author?.avatarUrl ? (
          <img src={doc.author.avatarUrl} alt="Avatar" className="doc-card-seller-avatar" style={{ border: 'none' }} />
        ) : (
          <div className="doc-card-seller-avatar">{(doc.author?.fullName || doc.author?.username || '?').charAt(0).toUpperCase()}</div>
        )}
        <span className="doc-card-seller-name">{doc.author?.fullName || doc.author?.username || 'Ẩn danh'}</span>
      </div>
      <div className="doc-card-actions">
        {isMyOrder ? (
          <span style={{ fontSize: 12, fontWeight: 'bold', color: doc.status === 'SOLD' ? 'green' : 'orange' }}>
            {doc.status === 'SOLD' ? 'Đã hoàn thành' : 'Chờ giao hàng'}
          </span>
        ) : doc.authorId === currentUser?.id ? (
          <>
            <button className="doc-card-preview-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEdit?.(doc); }} title="Sửa giá">
              <Icons.Edit className="w-4 h-4" />
            </button>
            <button className="doc-card-preview-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onConfirmSale?.(doc); }} title="Xác nhận người mua">
              <Icons.CheckCircle className="w-4 h-4 text-green-600" />
            </button>
            <button className="doc-card-preview-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onDelete?.(doc); }} title="Xóa tài liệu">
              <Icons.Trash className="w-4 h-4 text-red-600" />
            </button>
          </>
        ) : (
          <>
            {doc.fileUrl && (
              <button className="doc-card-preview-btn flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onPreview?.(doc); }} title="Xem bản Preview">
                <Icons.Eye className="w-4 h-4" />
              </button>
            )}
            <button className="doc-card-buy-btn flex items-center justify-center" style={{ padding: '8px 16px', gap: '6px' }} onClick={(e) => { e.stopPropagation(); onMessage?.(doc.author, doc); }}>
              <Icons.MessageCircle className="w-4 h-4" /> Chat
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

// --- Bounty Card (Thẻ treo thưởng) ---
const BountyCard = ({ bounty, onSubmit, currentUser, onViewDetail }) => (
  <div className="doc-card" style={{ cursor: 'pointer' }} onClick={() => onViewDetail?.(bounty)}>
    <div className="doc-card-header">
      <div className="doc-card-type-icon" style={{ background: '#fff', color: '#1e293b', padding: 0, border: '1.5px solid #cbd5e1' }}>
        <Icons.FileText className="w-5 h-5" />
      </div>
      <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div className="doc-card-title">{bounty.title}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{formatTimeAgo(bounty.createdAt)}</div>
      </div>
    </div>

    <div className="doc-card-body">
      <div className="doc-card-meta">
        <div className="doc-card-meta-item flex items-center gap-1">
          <span className="meta-icon" style={{ display: 'flex' }}><Icons.BookOpen className="w-3.5 h-3.5 text-slate-400" /></span>
          {bounty.subject || 'Không rõ môn'}{bounty.lecturer && ` - ${bounty.lecturer}`}
        </div>
        <div className="doc-card-meta-item flex items-center gap-1 font-bold text-rose-500">
          <Icons.UC className="w-3.5 h-3.5 text-rose-500" /> {fmtUC(bounty.price)} UC
        </div>
      </div>
    </div>

    <div className="doc-card-footer" onClick={e => e.stopPropagation()}>
      <div className="doc-card-seller">
        {bounty.author?.avatarUrl ? (
          <img src={bounty.author.avatarUrl} alt="Avatar" className="doc-card-seller-avatar" style={{ border: 'none' }} />
        ) : (
          <div className="doc-card-seller-avatar">{(bounty.author?.fullName || bounty.author?.username || '?').charAt(0).toUpperCase()}</div>
        )}
        <span className="doc-card-seller-name">{bounty.author?.fullName || bounty.author?.username || 'Ẩn danh'}</span>
      </div>
      <div className="doc-card-actions">
        {bounty.authorId !== currentUser?.id ? (
          <button className="doc-card-buy-btn flex items-center justify-center" style={{ padding: '8px 16px', gap: '6px' }} onClick={() => onSubmit?.(bounty)}>
            <Icons.MessageCircle className="w-4 h-4" /> Chat
          </button>
        ) : (
          <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>Bài của bạn</span>
        )}
      </div>
    </div>
  </div>
);


// ==========================================
// MAIN COMPONENT
// ==========================================
const DocumentMarketScreen = ({ user, panicMode, onBuy, onChat, showAlert, showConfirm, showPrompt }) => {
  const [previewDoc, setPreviewDoc] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null); // modal xem chi tiết

  // --- State: Toggle đăng bán / treo thưởng ---
  const [postMode, setPostMode] = useState(null); // 'sell' | 'bounty' | null

  // --- State: Feed Tab ---
  const [feedTab, setFeedTab] = useState('docs'); // 'docs' | 'bounties'

  // --- State: Search trong kho khám phá ---
  const [exploreSearch, setExploreSearch] = useState('');

  // --- State: Pagination/View All ---
  const [viewAllDocs, setViewAllDocs] = useState(false);
  const [viewAllBounties, setViewAllBounties] = useState(false);

  // --- State: Form Đăng bán ---
  const [sellForm, setSellForm] = useState({
    title: '',
    category: '',
    fileLink: '',
    teacher: '',
    subject: '',
    price: '',
    isCombo: false,
  });

  // --- State: Form Treo thưởng ---
  const [bountyForm, setBountyForm] = useState({
    title: '',
    subject: '',
    teacher: '',
    reward: '',
  });

  // --- State: Data ---
  const [documents, setDocuments] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchMarketData = async () => {
    try {
      const resDocs = await axios.get('/api/documents?type=SELL');
      if (resDocs.data.success !== false) setDocuments(resDocs.data.data);

      const resBounties = await axios.get('/api/documents?type=BOUNTY');
      if (resBounties.data.success !== false) setBounties(resBounties.data.data);

      const resOrders = await axios.get(`/api/documents/my-orders/${user.id}`);
      if (resOrders.data.success !== false) setMyOrders(resOrders.data.data);

    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file); // API expects 'image' field for now
    setIsUploading(true);
    try {
      const res = await axios.post('/api/upload', formData);
      setSellForm({ ...sellForm, fileLink: res.data.url });
    } catch (err) {
      showAlert('Lỗi upload file! Vui lòng thử lại.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // --- Handlers ---
  const handlePurchase = (doc) => {
    showConfirm(`Bạn chắc chắn muốn mua tài liệu "${doc.title}" với giá ${fmtUC(doc.price)} UC?`, async () => {
      try {
        const res = await axios.post(`/api/documents/buy/${doc.id}`, { buyerId: user.id });
        setTimeout(() => {
          showPrompt("Đã mua thành công! Bạn đánh giá người bán mấy sao (1-5)?", "5", async (score) => {
            if (score) {
              try { await axios.post('/api/users/rate', { raterId: user.id, ratedUserId: doc.authorId, score }); } catch (e) { }
              showAlert("Cảm ơn bạn đã đánh giá uy tín người bán!");
            }
            fetchMarketData();
          });
        }, 300);
      } catch (err) {
        showAlert(err.response?.data?.message || err.message || "Lỗi giao dịch!");
      }
    });
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (sellForm.price < 0) { showAlert('Giá bán không hợp lệ!', 'error'); return; }
    try {
      await axios.post('/api/documents', {
        title: sellForm.title,
        type: 'SELL',
        category: sellForm.category,
        fileUrl: sellForm.fileLink,
        lecturer: sellForm.teacher,
        subject: sellForm.subject,
        price: parseInt(sellForm.price),
        isCombo: sellForm.isCombo,
        authorId: user.id
      });
      setSellForm({ title: '', category: '', fileLink: '', teacher: '', subject: '', price: '', isCombo: false });
      setPostMode(null); // Đóng popup
      setFeedTab('docs');
      showAlert('Đăng tài liệu thành công!', 'success');
      fetchMarketData();
    } catch (e) {
      showAlert(e.response?.data?.message || 'Lỗi khi đăng bán tài liệu', 'error');
    }
  };

  const handleBountySubmit = async (e) => {
    e.preventDefault();
    if (bountyForm.reward <= 0) { showAlert('Thưởng phải lớn hơn 0!', 'warning'); return; }
    try {
      const res = await axios.post('/api/documents', {
        title: bountyForm.title,
        type: 'BOUNTY',
        subject: bountyForm.subject,
        lecturer: bountyForm.teacher,
        price: parseInt(bountyForm.reward),
        authorId: user.id
      });
      showAlert('Đăng yêu cầu tìm kiếm thành công!', 'success');
      setBountyForm({ title: '', subject: '', teacher: '', reward: '' });
      setPostMode(null); // Đóng popup
      fetchMarketData();
    } catch (e) {
      showAlert(e.response?.data?.message || 'Lỗi khi treo thưởng', 'error');
    }
  };

  const handleBuyDoc = async (doc) => {
    const confirmed = await showConfirm(`Bạn có chắc muốn mua tài liệu "${doc.title}" với giá ${fmtUC(doc.price)} UC không?`);
    if (confirmed) {
      try {
        const res = await axios.post(`/api/documents/buy/${doc.id}`, { buyerId: user.id });
        let urlMsg = res.data.data?.fileUrl ? `\n\nLink tải tài liệu:\n${res.data.data.fileUrl}` : '\n\nTài liệu này chưa cập nhật link, hãy liên hệ người bán.';
        showAlert(res.data.message + urlMsg, 'success');
        fetchMarketData();
      } catch (err) {
        showAlert(err.response?.data?.message || 'Có lỗi xảy ra!', 'error');
      }
    }
  };

  const handleEditDoc = async (doc) => {
    const newPrice = await showPrompt('Nhập giá bán mới (UC):', String(doc.price));
    if (newPrice !== null && !isNaN(newPrice)) {
      try {
        const res = await axios.put(`/api/documents/${doc.id}`, {
          ...doc,
          price: parseInt(newPrice)
        });
        showAlert(res.data.message, 'success');
        fetchMarketData();
      } catch (err) {
        showAlert(err.response?.data?.message || 'Lỗi khi sửa tài liệu!', 'error');
      }
    }
  };

  const handleDeleteDoc = async (doc) => {
    const confirmed = await showConfirm(`Bạn có chắc muốn xóa tài liệu "${doc.title}" không? Hành động này không thể hoàn tác.`);
    if (!confirmed) return;
    try {
      const res = await axios.delete(`/api/documents/${doc.id}`, {
        data: { authorId: user.id }
      });
      showAlert(res.data?.message || 'Đã xóa tài liệu!', 'success');
      fetchMarketData();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi khi xóa tài liệu!', 'error');
    }
  };

  const handleConfirmSale = async (doc) => {
    const buyerUsername = await showPrompt('Nhập Tên tài khoản (username) của người mua mà bạn muốn xác nhận bán:');
    if (!buyerUsername) return;
    try {
      const userRes = await axios.get(`/api/users/search?q=${buyerUsername}`);
      const matchedUser = userRes.data.find(u => u.username === buyerUsername);
      if (!matchedUser) { showAlert('Không tìm thấy người dùng này!', 'error'); return; }

      const res = await axios.post(`/api/documents/confirm-sale/${doc.id}`, {
        sellerId: user.id,
        buyerId: matchedUser.id
      });
      showAlert(res.data.message, 'success');
      fetchMarketData();
      setFeedTab('orders');
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi khi xác nhận bán!', 'error');
    }
  };

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
  };

  const handleBountyAnswer = (bounty) => {
    if (onChat) {
      onChat(bounty.author, bounty, `Chào bạn, mình thấy bạn đang treo thưởng tìm "${bounty.title}". Mình có tài liệu này, trao đổi nhé?`, 'DOCUMENT');
    } else {
      showAlert(`Vui lòng nhắn tin trực tiếp cho ${bounty.author?.fullName || bounty.author?.username} để gửi tài liệu.`, 'info');
    }
  };

  return (
    <div className={`${panicMode ? 'doc-market-panic' : ''}`}>
      {/* ============================================ */}
      {/* PANEL 1: ĐĂNG BÁN HOẶC TREO THƯỞNG        */}
      {/* ============================================ */}
      <div style={{ marginBottom: 20 }}>
        <h3 className="doc-market-section-title flex items-center" style={{ gap: '8px' }}>
          <Icons.Edit className="w-6 h-6 text-indigo-600" /> Đăng bán hoặc tìm tài liệu
        </h3>

        {/* --- Segmented Control --- */}
        <div className="doc-market-toggle" style={{ marginBottom: 16 }}>
          <button
            className={`doc-market-toggle-btn ${postMode === 'bounty' ? 'active' : 'inactive'}`}
            onClick={() => setPostMode(postMode === 'bounty' ? null : 'bounty')}
          >
            <Icons.Target className="w-5 h-5 mr-2 inline" /> Tìm tài liệu
          </button>
          <button
            className={`doc-market-toggle-btn ${postMode === 'sell' ? 'active' : 'inactive'} flex items-center justify-center`}
            onClick={() => setPostMode(postMode === 'sell' ? null : 'sell')}
          >
            <Icons.FileText className="w-5 h-5 mr-2 inline" /> Đăng tài liệu
          </button>
        </div>

        {/* --- Moadl Form: Đăng bán tài liệu --- */}
        {postMode === 'sell' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPostMode(null)}>
            <div className={`w-[90%] max-w-[480px] rounded-xl overflow-hidden border ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-lg'}`} onClick={e => e.stopPropagation()}>
              <div className={`px-5 py-4 border-b flex justify-between items-center ${panicMode ? 'border-zinc-800' : 'border-zinc-100 bg-zinc-50/50'}`}>
                <h4 className="font-semibold text-sm text-zinc-900">Đăng tài liệu bán / chia sẻ</h4>
                <button onClick={() => setPostMode(null)} className="text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleSellSubmit} style={{ padding: '16px 20px' }}>
                <div className="doc-market-form-fields">
                  {/* Tên tài liệu */}
                  <div>
                    <label className="doc-market-label">Tên tài liệu</label>
                    <div className="doc-market-input-icon-wrap">
                      <span className="doc-market-input-icon flex items-center justify-center"><Icons.FileText className="w-4 h-4" /></span>
                      <input type="text" className="doc-market-input" placeholder="VD: Đề thi Toán Cao cấp A2 - K50" value={sellForm.title} onChange={(e) => setSellForm({ ...sellForm, title: e.target.value })} required />
                    </div>
                  </div>

                  {/* Loại tài liệu */}
                  <div>
                    <label className="doc-market-label">Loại tài liệu</label>
                    <select className="doc-market-select" value={sellForm.category} onChange={(e) => setSellForm({ ...sellForm, category: e.target.value })} required>
                      <option value="">-- Chọn loại tài liệu --</option>
                      <option value="Đề thi">📋 Đề thi</option>
                      <option value="Slide bài giảng">📊 Slide bài giảng</option>
                      <option value="Tóm tắt">📝 Tóm tắt</option>
                      <option value="Tài liệu tham khảo">📚 Tài liệu tham khảo</option>
                    </select>
                  </div>

                  {/* File tài liệu (Upload) */}
                  <div>
                    <label className="doc-market-label">Tải file lên</label>
                    <div className="doc-market-input-icon-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="doc-market-input-icon flex items-center justify-center"><Icons.Paperclip className="w-4 h-4" /></span>
                      <input type="file" className="doc-market-input" onChange={handleFileChange} style={{ paddingLeft: 36 }} />
                    </div>
                    {isUploading && <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>Đang tải file lên...</div>}
                    {sellForm.fileLink && !isUploading && (<div style={{ fontSize: 11, color: '#18181b', marginTop: 4 }}>✅ Đã đính kèm file thành công</div>)}
                  </div>

                  {/* Giảng viên + Môn học */}
                  <div className="doc-market-form-row">
                    <div>
                      <label className="doc-market-label">Giảng viên</label>
                      <div className="doc-market-input-icon-wrap">
                        <span className="doc-market-input-icon flex items-center justify-center"><Icons.User className="w-4 h-4" /></span>
                        <input type="text" className="doc-market-input" placeholder="Nguyễn Văn A" value={sellForm.teacher} onChange={(e) => setSellForm({ ...sellForm, teacher: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="doc-market-label">Môn học</label>
                      <div className="doc-market-input-icon-wrap">
                        <span className="doc-market-input-icon flex items-center justify-center"><Icons.BookOpen className="w-4 h-4" /></span>
                        <input type="text" className="doc-market-input" placeholder="Toán Cao cấp A2" value={sellForm.subject} onChange={(e) => setSellForm({ ...sellForm, subject: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Giá (UC) */}
                  <div>
                    <label className="doc-market-label">Giá bán (UC)</label>
                    <div className="doc-market-input-icon-wrap">
                      <span className="doc-market-input-icon flex items-center justify-center"><Icons.UC className="w-4 h-4" /></span>
                      <input type="number" className="doc-market-input" placeholder="30" min="1" value={sellForm.price} onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })} required />
                    </div>
                  </div>

                  <div style={{ height: 6 }}></div>

                  {/* Buttons */}
                  <button type="submit" className="doc-market-btn-primary sell flex items-center justify-center w-full">
                    <Icons.Send className="w-4 h-4" /> Đăng tài liệu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- Modal Form: Treo thưởng --- */}
        {postMode === 'bounty' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPostMode(null)}>
            <div className={`w-[90%] max-w-[480px] rounded-xl overflow-hidden border ${panicMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-lg'}`} onClick={e => e.stopPropagation()}>
              <div className={`px-5 py-4 border-b flex justify-between items-center ${panicMode ? 'border-zinc-800' : 'border-zinc-100 bg-zinc-50/50'}`}>
                <h4 className="font-semibold text-sm text-zinc-900">Tìm kiếm tài liệu</h4>
                <button onClick={() => setPostMode(null)} className="text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleBountySubmit} style={{ padding: '16px 20px' }}>
                <div className="doc-market-form-fields">
                  {/* Tên tài liệu cần tìm */}
                  <div>
                    <label className="doc-market-label">Tên tài liệu cần tìm</label>
                    <div className="doc-market-input-icon-wrap">
                      <span className="doc-market-input-icon flex items-center justify-center"><Icons.Search className="w-4 h-4" /></span>
                      <input type="text" className="doc-market-input" placeholder="VD: Đề thi Toán Rời rạc - K51" value={bountyForm.title} onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })} required />
                    </div>
                  </div>

                  {/* Môn học / Giảng viên */}
                  <div className="doc-market-form-row">
                    <div>
                      <label className="doc-market-label">Môn học</label>
                      <div className="doc-market-input-icon-wrap">
                        <span className="doc-market-input-icon flex items-center justify-center"><Icons.School className="w-4 h-4" /></span>
                        <input type="text" className="doc-market-input" placeholder="VD: Tài chính Quốc tế" value={bountyForm.subject} onChange={(e) => setBountyForm({ ...bountyForm, subject: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="doc-market-label">Tên Giảng viên</label>
                      <div className="doc-market-input-icon-wrap">
                        <span className="doc-market-input-icon"><Icons.User className="w-4 h-4" /></span>
                        <input type="text" className="doc-market-input" placeholder="VD: Thầy Nguyễn Văn B" value={bountyForm.teacher} onChange={(e) => setBountyForm({ ...bountyForm, teacher: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Mức thưởng */}
                  <div>
                    <label className="doc-market-label">Mức thưởng (UC)</label>
                    <div className="doc-market-input-icon-wrap">
                      <span className="doc-market-input-icon flex items-center justify-center"><Icons.Award className="w-4 h-4" /></span>
                      <input type="number" className="doc-market-input" placeholder="50" min="1" value={bountyForm.reward} onChange={(e) => setBountyForm({ ...bountyForm, reward: e.target.value })} required />
                    </div>
                  </div>

                  <div style={{ height: 6 }}></div>

                  {/* Button */}
                  <button type="submit" className="doc-market-btn-primary bounty flex items-center justify-center w-full">
                    <Icons.Search className="w-4 h-4" /> Treo thưởng tìm kiếm
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* PANEL 2: KHÁM PHÁ TÀI LIỆU & ĐỀ THI       */}
      {/* ============================================ */}
      <div>
        <h3 className="doc-market-section-title flex items-center" style={{ gap: '8px' }}>
          <Icons.Search className="w-6 h-6 text-indigo-600" /> Khám phá Tài liệu & Đề thi
        </h3>

        {/* --- LỌC VÀ SẮP XẾP SẢN PHẨM --- */}
        {(() => {
          const sortPriorityMap = {
            'PENDING': 1,
            'ACTIVE': 2,
            'IN_PROGRESS': 3,
            'PENDING_DELIVERY': 4,
            'COMPLETED': 5,
            'SOLD': 5,
            'CANCELLED': 6,
            'CLOSED': 6
          };

          const sortData = (items) => {
            return [...items].sort((a, b) => {
              const pA = sortPriorityMap[a.status] || 99;
              const pB = sortPriorityMap[b.status] || 99;
              if (pA !== pB) return pA - pB;
              return new Date(b.createdAt) - new Date(a.createdAt);
            });
          };

          let filteredDocs = sortData(documents).filter(doc => doc.status !== 'CANCELLED' && doc.status !== 'CLOSED');
          if (exploreSearch) {
            filteredDocs = filteredDocs.filter(doc =>
              doc.title?.toLowerCase().includes(exploreSearch.toLowerCase()) ||
              doc.subject?.toLowerCase().includes(exploreSearch.toLowerCase()) ||
              doc.lecturer?.toLowerCase().includes(exploreSearch.toLowerCase())
            );
          }

          let filteredBounties = sortData(bounties).filter(b => b.status !== 'CANCELLED' && b.status !== 'CLOSED');
          if (exploreSearch) {
            filteredBounties = filteredBounties.filter(b =>
              b.title?.toLowerCase().includes(exploreSearch.toLowerCase()) ||
              b.subject?.toLowerCase().includes(exploreSearch.toLowerCase()) ||
              b.lecturer?.toLowerCase().includes(exploreSearch.toLowerCase())
            );
          }

          const displayDocs = viewAllDocs ? filteredDocs : filteredDocs.slice(0, 5);
          const displayBounties = viewAllBounties ? filteredBounties : filteredBounties.slice(0, 5);

          return (
            <>
              {/* --- Thanh tìm kiếm trong kho khám phá --- */}
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Icons.Search className="w-4 h-4 text-slate-400" /></span>
                <input
                  type="text"
                  className="doc-market-input"
                  placeholder="Tìm tên tài liệu, môn học, giảng viên..."
                  value={exploreSearch}
                  onChange={e => setExploreSearch(e.target.value)}
                  style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* --- Feed Tab Bar --- */}
              <div className="doc-market-feed-tabs">
                <button
                  className={`doc-market-feed-tab ${feedTab === 'docs' ? 'active' : ''}`}
                  onClick={() => setFeedTab('docs')}
                >
                  <Icons.FileText className="w-4 h-4 inline mr-1" /> Tài liệu đang bán/ Chia sẻ
                  <span className="tab-count">{filteredDocs.length}</span>
                </button>
                <button
                  className={`doc-market-feed-tab ${feedTab === 'bounties' ? 'active' : ''}`}
                  onClick={() => setFeedTab('bounties')}
                >
                  <Icons.Target className="w-4 h-4 inline mr-1" /> Tài liệu đang cần tìm kiếm
                  <span className="tab-count">{filteredBounties.length}</span>
                </button>
              </div>

              {/* --- Feed: Tài liệu đang bán --- */}
              {feedTab === 'docs' && (
                <div className="doc-market-grid">
                  {filteredDocs.length === 0 ? (
                    <div className="doc-market-empty" style={{ gridColumn: '1 / -1' }}>
                      <div className="doc-market-empty-icon">📭</div>
                      <div className="doc-market-empty-text">{exploreSearch ? 'Không tìm thấy tài liệu phù hợp.' : 'Chưa có tài liệu nào được đăng bán.'}</div>
                    </div>
                  ) : (
                    <>
                      {displayDocs.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          currentUser={user}
                          onBuy={handlePurchase}
                          onPreview={handlePreview}
                          onEdit={handleEditDoc}
                          onDelete={handleDeleteDoc}
                          onConfirmSale={handleConfirmSale}
                          onViewDetail={setSelectedDoc}
                          onMessage={(author, docRef) => onChat ? onChat(author, docRef, `Chào bạn, mình muốn mua tài liệu "${doc.title}" giá ${fmtUC(doc.price)} UC.`, 'DOCUMENT') : showAlert('Tính năng chat đang được cập nhật.', 'info')}
                        />
                      ))}
                      {filteredDocs.length > 5 && (
                        <button
                          onClick={() => setViewAllDocs(!viewAllDocs)}
                          style={{ gridColumn: '1 / -1', padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#334155', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                        >
                          {viewAllDocs ? 'Thu gọn ⌃' : `Xem tất cả ${filteredDocs.length} tài liệu ⌄`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* --- Feed: Treo thưởng (Bounty) --- */}
              {feedTab === 'bounties' && (
                <div className="doc-market-grid">
                  {filteredBounties.length === 0 ? (
                    <div className="doc-market-empty" style={{ gridColumn: '1 / -1' }}>
                      <div className="doc-market-empty-icon">🎯</div>
                      <div className="doc-market-empty-text">{exploreSearch ? 'Không tìm thấy yêu cầu phù hợp.' : 'Chưa có ai treo thưởng tìm tài liệu.'}</div>
                    </div>
                  ) : (
                    <>
                      {displayBounties.map((bounty) => (
                        <BountyCard
                          key={bounty.id}
                          bounty={bounty}
                          currentUser={user}
                          onSubmit={handleBountyAnswer}
                          onViewDetail={setSelectedDoc}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

            </>
          );
        })()}
      </div>

      {/* ============================================ */}
      {/* MODAL XEM CHI TIẾT TÀI LIỆU                */}
      {/* ============================================ */}
      {selectedDoc && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
          onClick={() => setSelectedDoc(null)}
        >
          <div 
            className={`w-full max-w-md rounded-xl overflow-hidden border shadow-lg transition-all ${panicMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-5 py-4 border-b flex justify-between items-center ${panicMode ? 'border-zinc-800' : 'border-zinc-100 bg-zinc-50/50'}`}>
              <div>
                <div className="text-sm font-semibold text-zinc-900 leading-tight">{selectedDoc.title}</div>
                <div className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
                  {selectedDoc.category} • {formatTimeAgo(selectedDoc.createdAt)}
                </div>
              </div>
              <button 
                onClick={() => setSelectedDoc(null)} 
                className={`w-7 h-7 rounded-md font-bold flex items-center justify-center border transition-colors ${panicMode ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-205 text-zinc-500'}`}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'}`}>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">Giảng viên</div>
                  <div className="text-xs font-medium text-zinc-800">👨‍🏫 {selectedDoc.lecturer || 'Chưa ghi'}</div>
                </div>
                <div className={`p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'}`}>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">Môn học</div>
                  <div className="text-xs font-medium text-zinc-800">📚 {selectedDoc.subject || 'Chưa ghi'}</div>
                </div>
                <div className={`p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'}`}>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                    {selectedDoc.type === 'BOUNTY' ? 'Mức thưởng' : 'Giá bán'}
                  </div>
                  <div className="text-sm font-bold text-zinc-950 flex items-center gap-1">
                    <Icons.UC className="w-3.5 h-3.5 text-zinc-500" /> {fmtUC(selectedDoc.price)} UC
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${panicMode ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'}`}>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">Phân loại</div>
                  <div className="text-xs font-medium text-zinc-800">
                    📄 {selectedDoc.type === 'BOUNTY' ? 'Treo thưởng' : (selectedDoc.isCombo ? '📦 Combo' : selectedDoc.category)}
                  </div>
                </div>
              </div>

              {/* Tác giả */}
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border mb-4 cursor-pointer transition-colors ${panicMode ? 'bg-zinc-850 border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-50/50 border-zinc-100 hover:bg-zinc-100/50'}`}
                onClick={() => onOpenProfile?.(selectedDoc.author)}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                  {selectedDoc.author?.avatarUrl ? (
                    <img src={selectedDoc.author.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                  ) : (
                    (selectedDoc.author?.fullName || selectedDoc.author?.username || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-800">{selectedDoc.author?.fullName || selectedDoc.author?.username}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {selectedDoc.type === 'BOUNTY' ? 'Người tìm tài liệu' : 'Người đăng tài liệu'}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 mt-4">
                {selectedDoc.authorId !== user.id && (
                  <button
                    onClick={() => {
                      const msg = selectedDoc.type === 'BOUNTY' 
                        ? `Chào bạn, mình thấy bạn đang treo thưởng tìm "${selectedDoc.title}". Mình có tài liệu này, trao đổi nhé?`
                        : `Chào bạn, mình muốn mua tài liệu "${selectedDoc.title}".`;
                      onChat && onChat(selectedDoc.author, null, msg, 'DOCUMENT');
                      setSelectedDoc(null); 
                    }}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                  >
                    <Icons.MessageCircle className="w-3.5 h-3.5" /> Chat
                  </button>
                )}
                {selectedDoc.fileUrl && (
                  <button
                    onClick={() => { setPreviewDoc(selectedDoc); setSelectedDoc(null); }}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${panicMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
                  >
                    <Icons.Eye className="w-3.5 h-3.5" /> Xem trước
                  </button>
                )}
                {selectedDoc.authorId !== user.id && selectedDoc.type !== 'BOUNTY' && (
                  <button
                    onClick={() => { handlePurchase(selectedDoc); setSelectedDoc(null); }}
                    className="flex-1 py-2.5 bg-zinc-950 text-white rounded-lg font-semibold text-xs transition-colors hover:bg-zinc-850"
                  >
                    🛒 Mua với {fmtUC(selectedDoc.price)} UC
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Preview Modal --- */}
      {previewDoc && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-6" 
          onClick={() => setPreviewDoc(null)}
        >
          <div 
            className={`w-full max-w-4xl h-[85vh] rounded-xl overflow-hidden border shadow-2xl flex flex-col ${panicMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-5 py-4 border-b flex justify-between items-center ${panicMode ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-zinc-50/50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400"><Icons.FileText className="w-5 h-5" /></span>
                <span className="text-sm font-semibold text-zinc-900">Bản xem trước: {previewDoc.title}</span>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)} 
                className={`w-7 h-7 rounded-md font-bold flex items-center justify-center border transition-colors ${panicMode ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-205 text-zinc-500'}`}
              >
                ✕
              </button>
            </div>
            
            {/* Content iframe */}
            <div className={`flex-1 overflow-hidden relative ${panicMode ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
              {previewDoc.fileUrl ? (
                previewDoc.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <img src={previewDoc.fileUrl} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <iframe src={`/api/documents/preview/${previewDoc.id}#toolbar=0`} width="100%" height="100%" className="border-none" title="Preview PDF" />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 font-medium">
                  📭 Tài liệu này không có file đính kèm để xem trước.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentMarketScreen;
