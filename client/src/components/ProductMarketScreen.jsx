import { fmtUC } from '../utils';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Icons } from '../App';
import './ProductMarket.css';

// ==========================================
// CONSTANTS
// ==========================================
const CATEGORY_OPTIONS = [
  { value: 'books', label: 'Sách vở' },
  { value: 'electronics', label: 'Điện tử' },
  { value: 'clothes', label: 'Quần áo' },
  { value: 'furniture', label: 'Đồ đạc' },
  { value: 'general', label: 'Chung' },
];

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Mới 100%' },
  { value: 'LIKE_NEW', label: 'Like New 99%' },
  { value: 'USED', label: 'Đã sử dụng' },
];
const ITEMS_PER_PAGE = 5;
// ==========================================
// MAIN COMPONENT
// ==========================================
const ProductMarketScreen = ({ user, panicMode, onChat, onOpenProfile, showAlert, showConfirm, showPrompt, onReport }) => {
  const SEASONAL_BANNERS = [
    { id: 1, cls: 's1', icon: <Icons.BookOpen className="w-5 h-5 inline mr-1" />, title: 'Dọn tủ giáo trình cuối kỳ', sub: 'Pass sách lấy UC, tặng kiến thức cho khóa sau!' },
    { id: 2, cls: 's2', icon: <Icons.Zap className="w-5 h-5 inline mr-1" />, title: 'Thanh lý đồ điện tử chuyển trọ', sub: 'Quạt, bàn, đèn học... giá sinh viên cực hời!' },
    { id: 3, cls: 's3', icon: <Icons.ShoppingBag className="w-5 h-5 inline mr-1" />, title: 'Đổi đồ mùa hè - Refresh tủ quần áo', sub: 'Trao đổi trực tiếp, không cần UC!' },
  ];

  const CONDITION_LABELS = {
    'NEW': <><Icons.Sparkles className="w-3.5 h-3.5 inline mr-1" /> Mới 100%</>,
    'LIKE_NEW': <><Icons.Award className="w-3.5 h-3.5 inline mr-1" /> Like New 99%</>,
    'USED': <><Icons.Package className="w-3.5 h-3.5 inline mr-1" /> Đã sử dụng</>,
  };

  const CATEGORY_LABELS = {
    'books': <><Icons.BookOpen className="w-3.5 h-3.5 inline mr-1" /> Sách vở</>,
    'electronics': <><Icons.Zap className="w-3.5 h-3.5 inline mr-1" /> Điện tử</>,
    'clothes': <><Icons.ShoppingBag className="w-3.5 h-3.5 inline mr-1" /> Quần áo</>,
    'furniture': <><Icons.Home className="w-3.5 h-3.5 inline mr-1" /> Đồ đạc</>,
    'general': <><Icons.Package className="w-3.5 h-3.5 inline mr-1" /> Chung</>,
  };

  const [currentSlide, setCurrentSlide] = useState(0);
  const autoSlideRef = useRef(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [sellMode, setSellMode] = useState('sell');
  const [formImages, setFormImages] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    condition: '',
    description: '',
    price: '',
    barterFor: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [marketTab, setMarketTab] = useState('ALL'); // 'ALL' or 'MINE'

  // Products states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterTradeType, setFilterTradeType] = useState('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Detail popup
  const [detailProduct, setDetailProduct] = useState(null);

  // File input ref
  const fileInputRef = useRef(null);

  // Auto-slide carousel
  useEffect(() => {
    autoSlideRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SEASONAL_BANNERS.length);
    }, 4000);
    return () => clearInterval(autoSlideRef.current);
  }, []);

  // Fetch products from API
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/items');
      if (res.data?.data) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải sản phẩm:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search products
  const sortPriorityMap = {
    'PENDING': 1,
    'ACTIVE': 2,
    'IN_PROGRESS': 3,
    'DELIVERING': 4,
    'COMPLETED': 5,
    'SOLD': 5,
    'CANCELLED': 6,
    'CLOSED': 6
  };

  const sortedProducts = [...products]
    .filter(p => p.status !== 'CANCELLED' && p.status !== 'CLOSED')
    .sort((a, b) => {
      const pA = sortPriorityMap[a.status] || 99;
      const pB = sortPriorityMap[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const filteredProducts = sortedProducts
    .filter(p => marketTab === 'MINE' ? p.ownerId === user.id : (p.status === 'ACTIVE' && p.ownerId !== user.id))
    .filter(p => {
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      if (filterCondition !== 'all' && p.condition !== filterCondition) return false;
      if (filterTradeType !== 'all' && p.tradeType !== filterTradeType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        const ownerMatch = p.owner?.fullName?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !ownerMatch) return false;
      }
      return true;
    });

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const isShowingAll = visibleCount >= filteredProducts.length;

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (formImages.length + files.length > 5) {
      showAlert('Tối đa 5 ảnh!', 'warning');
      return;
    }
    const newImages = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setFormImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setFormImages(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  // Upload images
  const uploadImages = async () => {
    const urls = [];
    for (const img of formImages) {
      const fd = new FormData();
      fd.append('image', img.file);
      try {
        const res = await axios.post('/api/upload', fd);
        if (res.data?.url) urls.push(res.data.url);
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    return urls;
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { showAlert('Vui lòng nhập tên sản phẩm!', 'warning'); return; }
    if (!formData.category) { showAlert('Vui lòng chọn danh mục!', 'warning'); return; }
    if (!formData.condition) { showAlert('Vui lòng chọn tình trạng!', 'warning'); return; }
    if (sellMode === 'sell' && !formData.price) { showAlert('Vui lòng nhập giá bán!', 'warning'); return; }
    if (sellMode === 'barter' && !formData.barterFor.trim()) { showAlert('Vui lòng nhập món muốn đổi!', 'warning'); return; }

    setIsSubmitting(true);
    try {
      let imageUrls = [];
      if (formImages.length > 0) {
        imageUrls = await uploadImages();
      }

      // Giữ ảnh cũ nếu đang edit mà không up thêm ảnh mới (đơn giản hoá: ta có thể ghi đè)
      if (editingProduct && formImages.length === 0) {
        imageUrls = parseImages(editingProduct.images);
      }

      const payload = {
        name: formData.title.trim(),
        condition: formData.condition,
        images: imageUrls,
        tradeType: sellMode === 'sell' ? 'SELL' : 'BARTER',
        price: sellMode === 'sell' ? parseInt(formData.price) : 0,
        exchangeWanted: sellMode === 'barter' ? formData.barterFor.trim() : null,
        category: formData.category,
        description: formData.description.trim() || null,
        ownerId: user.id,
      };

      if (editingProduct) {
        // Cập nhật
        const res = await axios.put(`/api/items/${editingProduct.id}`, payload);
        if (res.data?.data) {
          showAlert(`🎉 Đã cập nhật "${formData.title}" thành công!`, 'success');
        }
      } else {
        // Đăng mới
        const res = await axios.post('/api/items', payload);
        if (res.data?.data) {
          showAlert(`🎉 Đã đăng ${sellMode === 'sell' ? 'bán' : 'trao đổi'} "${formData.title}" thành công!`, 'success');
        }
      }

      setFormData({ title: '', category: '', condition: '', description: '', price: '', barterFor: '' });
      setFormImages([]);
      setEditingProduct(null);
      setShowForm(false);
      fetchProducts();
    } catch (err) {
      showAlert('Có lỗi xảy ra: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buy product — chuyển sang chat người bán
  const handleBuy = (product) => {
    if (product.ownerId === user.id) {
      showAlert('Bạn không thể mua sản phẩm của chính mình!', 'warning');
      return;
    }
    setDetailProduct(null);
    handleChatSeller(product);
  };

  // Propose trade
  const handleProposeTrade = (product) => {
    if (product.ownerId === user.id) {
      showAlert('Bạn không thể đề nghị trao đổi với chính mình!', 'warning');
      return;
    }
    setDetailProduct(null);
    handleChatSeller(product);
  };

  // Chat with seller
  const handleChatSeller = (product) => {
    if (product.owner && onChat) {
      const msg = product.tradeType === 'SELL'
        ? `Chào bạn, mình muốn hỏi mua "${product.name}" giá ${fmtUC(product.price)} UC. Hàng còn không ạ?`
        : `Chào bạn, mình muốn trao đổi "${product.name}". Bạn đang cần: ${product.exchangeWanted}. Mình có thể trao đổi!`;
      onChat(product.owner, product, msg, 'SECONDHAND');
    }
  };

  const handleEditProduct = (product) => {
    setDetailProduct(null);
    setFormData({
      title: product.name,
      category: product.category,
      condition: product.condition,
      description: product.description || '',
      price: product.price || '',
      barterFor: product.exchangeWanted || '',
    });
    setSellMode(product.tradeType === 'SELL' ? 'sell' : 'barter');
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDeleteProduct = async (product) => {
    const confirmed = await showConfirm(`Bạn có chắc muốn xóa "${product.name}" không? Thao tác này không thể hoàn tác.`);
    if (!confirmed) return;
    try {
      const res = await axios.delete(`/api/items/${product.id}`, { data: { ownerId: user.id } });
      showAlert(res.data?.message || 'Đã xóa sản phẩm thành công!', 'success');
      setDetailProduct(null);
      fetchProducts();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Lỗi khi xóa sản phẩm!', 'error');
    }
  };

  const handleAcceptProposal = async (proposalId) => {
    const confirmed = await showConfirm('Bạn có chắc chắn muốn chấp nhận đề nghị này? (Nếu là mua bằng xu, người gửi phải đủ tiền, nếu là trao đổi, đồ sẽ được đánh dấu đã trao đổi).');
    if (!confirmed) return;
    try {
      const res = await axios.put(`/api/items/accept-trade/${proposalId}`, { sellerId: user.id });
      showAlert(res.data?.message || 'Chấp nhận thành công!', 'success');
      setDetailProduct(null);
      fetchProducts();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Chấp nhận thất bại!', 'error');
    }
  };

  // Parse images JSON — also handles plain URLs
  const parseImages = (imagesStr) => {
    if (!imagesStr) return [];
    if (Array.isArray(imagesStr)) return imagesStr.filter(Boolean);
    if (typeof imagesStr === 'string') {
      const trimmed = imagesStr.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch { return []; }
      }
      // single URL string
      if (trimmed.startsWith('http')) return [trimmed];
    }
    return [];
  };

  return (
    <div className={`prod-screen ${panicMode ? 'prod-panic' : ''}`}>

      {/* ============================================ */}
      {/* CAROUSEL: Banners                            */}
      {/* ============================================ */}
      <div className="prod-carousel">
        <div
          className="prod-carousel-track"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {SEASONAL_BANNERS.map((b) => (
            <div key={b.id} className={`prod-carousel-slide ${b.cls}`}>
              <div className="prod-carousel-title">{b.icon} {b.title}</div>
              <div className="prod-carousel-sub">{b.sub}</div>
            </div>
          ))}
        </div>
        <div className="prod-carousel-dots">
          {SEASONAL_BANNERS.map((_, i) => (
            <button
              key={i}
              className={`prod-carousel-dot ${i === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(i)}
            />
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* NÚT ĐĂNG BÁN / PASS ĐỒ                    */}
      {/* ============================================ */}
      <button
        className="prod-post-btn"
        onClick={() => setShowForm(true)}
      >
        <span className="prod-post-btn-icon flex items-center justify-center"><Icons.Camera className="w-6 h-6" /></span>
        <span className="prod-post-btn-text">Đăng bài / Pass đồ</span>
        <span className="prod-post-btn-arrow">→</span>
      </button>

      {/* ============================================ */}
      {/* MODAL POPUP ĐĂNG BÀI / CHỈNH SỬA SẢN PHẨM */}
      {/* ============================================ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditingProduct(null); setFormImages([]); setFormData({ title: '', category: '', condition: '', description: '', price: '', barterFor: '' }); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-scale-up overflow-hidden" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="prod-form-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <h3 className="prod-section-title flex items-center gap-2 m-0"><Icons.Camera className="w-6 h-6 text-indigo-600" /> {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Đăng bài / Pass đồ'}</h3>
              <button className="prod-form-close" onClick={() => { setShowForm(false); setEditingProduct(null); setFormData({ title: '', category: '', condition: '', description: '', price: '', barterFor: '' }); setFormImages([]); }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 20px' }}>
              <form onSubmit={handleSubmit}>
                {/* Upload Zone */}
                <div
                  className="prod-upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginBottom: 16 }}
                >
                  {formImages.length === 0 ? (
                    <>
                      <div className="prod-upload-icon flex items-center justify-center mb-2"><Icons.Camera className="w-8 h-8 text-slate-400" /></div>
                      <div className="prod-upload-text">Thêm ảnh / Video</div>
                      <div className="prod-upload-hint">Tối đa 5 ảnh, kích thước dưới 5MB</div>
                    </>
                  ) : (
                    <div className="prod-upload-previews">
                      {formImages.map((img, idx) => (
                        <div key={idx} className="prod-upload-thumb-wrap">
                          <img src={img.preview} alt="" className="prod-upload-thumb" />
                          <button
                            type="button"
                            className="prod-thumb-remove"
                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                          >✕</button>
                        </div>
                      ))}
                      {formImages.length < 5 && (
                        <div className="prod-upload-add-more">
                          <span>+</span>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                </div>

                <div className="prod-form-fields">
                  {/* Danh mục sản phẩm */}
                  <div>
                    <label className="prod-label">Danh mục sản phẩm</label>
                    <select
                      className="prod-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tên sản phẩm */}
                  <div>
                    <label className="prod-label">Tên sản phẩm</label>
                    <input
                      type="text"
                      className="prod-input lg"
                      placeholder="VD: Giáo trình Kinh tế Vi mô..."
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  {/* Tình trạng */}
                  <div>
                    <label className="prod-label">Tình trạng sản phẩm</label>
                    <select
                      className="prod-select"
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn tình trạng --</option>
                      {CONDITION_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mô tả */}
                  <div>
                    <label className="prod-label">Mô tả chi tiết</label>
                    <textarea
                      className="prod-textarea"
                      placeholder="Tình trạng cụ thể, lý do bán, phụ kiện đi kèm..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                    />
                  </div>

                  {/* Sell/Barter Toggle */}
                  <div>
                    <label className="prod-label">Hình thức</label>
                    <div className="prod-mode-toggle">
                      <button
                        type="button"
                        className={`prod-mode-btn ${sellMode === 'sell' ? 'sell-active' : 'inactive'}`}
                        onClick={() => setSellMode('sell')}
                      >
                        <Icons.UC className="w-5 h-5 inline mr-1" /> Bán lấy UC
                      </button>
                      <button
                        type="button"
                        className={`prod-mode-btn ${sellMode === 'barter' ? 'barter-active' : 'inactive'}`}
                        onClick={() => setSellMode('barter')}
                      >
                        <Icons.RefreshCw className="w-5 h-5 inline mr-1" /> Muốn đổi đồ
                      </button>
                    </div>
                  </div>

                  {/* Conditional Field: Price or Barter */}
                  {sellMode === 'sell' ? (
                    <div className="prod-cond-field">
                      <label className="prod-label">Giá bán (UC)</label>
                      <input
                        type="number"
                        className="prod-input"
                        placeholder="50"
                        min="1"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  ) : (
                    <div className="prod-cond-field">
                      <label className="prod-label flex items-center gap-1.5" style={{ color: '#D97706' }}><Icons.RefreshCw className="w-4 h-4" /> Muốn đổi lấy món gì?</label>
                      <input
                        type="text"
                        className="prod-input prod-barter-input"
                        placeholder="VD: Đổi giáo trình Vĩ mô lấy Vi mô..."
                        value={formData.barterFor}
                        onChange={(e) => setFormData({ ...formData, barterFor: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <button type="submit" className="prod-submit-btn flex items-center justify-center gap-2" disabled={isSubmitting}>
                    {isSubmitting ? 'Đang lưu...' : (
                      editingProduct ? <><Icons.CheckCircle className="w-5 h-5" /> Lưu thay đổi</> :
                        (sellMode === 'sell' ? <><Icons.Send className="w-5 h-5" /> Đăng Bán</> : <><Icons.Send className="w-5 h-5" /> Đăng Đổi</>)
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* PHẦN ĐỒ ĐANG BÁN & TRAO ĐỔI                */}
      {/* ============================================ */}
      <div className="prod-listing-section">

        <div className="flex bg-gray-100 p-1 rounded-xl mb-4 w-full md:w-[400px]">
          <button className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold text-[14px] transition rounded-lg ${marketTab === 'ALL' ? 'bg-white shadow text-rose-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setMarketTab('ALL')}><Icons.Globe className="w-4 h-4" /> Chợ chung</button>
          <button className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold text-[14px] transition rounded-lg ${marketTab === 'MINE' ? 'bg-white shadow text-rose-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setMarketTab('MINE')}><Icons.Package className="w-4 h-4" /> Kho cá nhân</button>
        </div>

        <h3 className="prod-section-title flex items-center gap-2">
          {marketTab === 'MINE' ? <><Icons.Package className="w-6 h-6 text-indigo-600" /> Kho cá nhân</> : <><Icons.ShoppingBag className="w-6 h-6 text-indigo-600" /> Hàng đang bán</>}
          <span className="prod-count-badge">{filteredProducts.length} sản phẩm</span>
        </h3>

        {/* Search + Filter bar */}
        <div className="prod-search-bar">
          <div className="prod-search-input-wrap">
            <span className="prod-search-icon flex items-center justify-center"><Icons.Search className="w-5 h-5 text-slate-400" /></span>
            <input
              type="text"
              className="prod-search-input"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
            />
            {searchQuery && (
              <button className="prod-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
          <button
            className={`prod-filter-toggle flex items-center gap-1.5 justify-center ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icons.Filter className="w-4 h-4" /> Lọc
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="prod-filters-panel">
            <div className="prod-filter-group">
              <label className="prod-filter-label">Danh mục</label>
              <select
                className="prod-filter-select"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
              >
                <option value="all">Tất cả</option>
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="prod-filter-group">
              <label className="prod-filter-label">Tình trạng</label>
              <select
                className="prod-filter-select"
                value={filterCondition}
                onChange={(e) => { setFilterCondition(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
              >
                <option value="all">Tất cả</option>
                {CONDITION_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="prod-filter-group">
              <label className="prod-filter-label">Hình thức</label>
              <select
                className="prod-filter-select"
                value={filterTradeType}
                onChange={(e) => { setFilterTradeType(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
              >
                <option value="all">Tất cả</option>
                <option value="SELL">Bán</option>
                <option value="BARTER">Trao đổi</option>
              </select>
            </div>
            <button
              className="prod-filter-reset"
              onClick={() => {
                setFilterCategory('all');
                setFilterCondition('all');
                setFilterTradeType('all');
                setSearchQuery('');
                setVisibleCount(ITEMS_PER_PAGE);
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* Products list */}
        {loading ? (
          <div className="prod-loading">
            <div className="prod-loading-spinner"></div>
            <span>Đang tải sản phẩm...</span>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="prod-empty">
            <div className="prod-empty-icon flex items-center justify-center"><Icons.Package className="w-12 h-12 text-slate-300" /></div>
            <div className="prod-empty-text">Chưa có sản phẩm nào.</div>
            <div className="prod-empty-sub">Hãy là người đầu tiên đăng bán!</div>
          </div>
        ) : (
          <div className="prod-list">
            {visibleProducts.map((product) => {
              const images = parseImages(product.images);
              const firstImage = images.length > 0 ? images[0] : null;
              return (
                <div key={product.id} className="prod-list-item" onClick={() => setDetailProduct(product)}>
                  {/* Condition badge */}
                  <div className="prod-item-condition-badge">
                    {CONDITION_LABELS[product.condition] || product.condition}
                  </div>

                  <div className="prod-item-content">
                    {/* Image */}
                    <div className="prod-item-img">
                      {firstImage ? (
                        <img src={firstImage} alt={product.name} />
                      ) : (
                        <div className="prod-item-img-placeholder flex items-center justify-center text-slate-300">
                          <Icons.ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="prod-item-info">
                      <div className="prod-item-name">{product.name}</div>
                      <div className="prod-item-desc">
                        {product.description
                          ? (product.description.length > 60 ? product.description.slice(0, 60) + '...' : product.description)
                          : (CATEGORY_LABELS[product.category] || 'Sản phẩm')
                        }
                      </div>

                      {/* Price / Trade */}
                      {product.tradeType === 'SELL' ? (
                        <div className="prod-item-price flex items-center gap-1"><Icons.UC className="w-4 h-4 text-emerald-600" /> {fmtUC(product.price)} UC</div>
                      ) : (
                        <div className="prod-item-barter flex items-center gap-1"><Icons.RefreshCw className="w-4 h-4 text-orange-500" /> Đổi: {product.exchangeWanted || 'Liên hệ'}</div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="prod-item-action">
                      {product.ownerId === user.id ? (
                        <div className="flex gap-2 w-full mt-2">
                          <button className="flex-1 py-1 px-2 flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 text-[13px]" onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}><Icons.Edit className="w-3.5 h-3.5" /> Tùy chỉnh</button>
                          {product.tradeProposals?.length > 0 && (
                            <span className="absolute top-2 right-2 bg-red-500 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px] shadow font-bold z-10">{product.tradeProposals.length}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          className={`prod-item-buy-btn ${product.tradeType === 'SELL' ? 'buy' : 'trade'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (product.tradeType === 'SELL') handleBuy(product);
                            else handleProposeTrade(product);
                          }}
                        >
                          <span className="flex items-center justify-center gap-1.5">{product.tradeType === 'SELL' ? <><Icons.ShoppingBag className="w-4 h-4" /> Chọn Mua</> : <><Icons.RefreshCw className="w-4 h-4" /> Đổi Đồ</>}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer: owner + chat */}
                  <div className="prod-item-footer">
                    <div className="prod-item-owner" onClick={(e) => { e.stopPropagation(); onOpenProfile?.(product.owner?.id); }}>
                      <div className="prod-item-owner-avatar">
                        {product.owner?.avatarUrl
                          ? <img src={product.owner.avatarUrl} alt="" />
                          : <span>{product.owner?.fullName?.[0] || product.owner?.username?.[0] || '?'}</span>
                        }
                      </div>
                      <span className="prod-item-owner-name">{product.owner?.fullName || product.owner?.username || 'Ẩn danh'}</span>
                    </div>
                    <button
                      className="prod-item-chat-btn"
                      onClick={(e) => { e.stopPropagation(); handleChatSeller(product); }}
                    >
                      <span className="flex items-center justify-center gap-1.5"><Icons.MessageCircle className="w-4 h-4" /> Chat người bán</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {filteredProducts.length > ITEMS_PER_PAGE && (
          <button
            className="prod-load-more"
            style={{ padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#334155', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', width: '100%' }}
            onClick={() => setVisibleCount(isShowingAll ? ITEMS_PER_PAGE : filteredProducts.length)}
          >
            {isShowingAll ? 'Thu gọn ⌃' : `Xem tất cả ${filteredProducts.length} sản phẩm ⌄`}
          </button>
        )}
      </div>

      {/* ============================================ */}
      {/* POPUP CHI TIẾT SẢN PHẨM                     */}
      {/* ============================================ */}
      {detailProduct && (
        <div className="prod-detail-overlay" onClick={() => setDetailProduct(null)}>
          <div className="prod-detail-popup" onClick={(e) => e.stopPropagation()}>
            <button className="prod-detail-close" onClick={() => setDetailProduct(null)}>✕</button>

            {/* Images carousel */}
            <div className="prod-detail-images">
              {(() => {
                const images = parseImages(detailProduct.images);
                if (images.length > 0) {
                  return (
                    <div className="prod-detail-img-scroll">
                      {images.map((url, idx) => (
                        <img key={idx} src={url} alt={`${detailProduct.name} ${idx + 1}`} className="prod-detail-img" />
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="prod-detail-no-img flex flex-col items-center justify-center text-slate-300">
                    <Icons.ImageIcon className="w-12 h-12 mb-2" />
                    <p>Chưa có ảnh</p>
                  </div>
                );
              })()}
            </div>

            {/* Info */}
            <div className="prod-detail-info">
              <div className="prod-detail-badges">
                <span className="prod-detail-badge condition">{CONDITION_LABELS[detailProduct.condition] || detailProduct.condition}</span>
                <span className="prod-detail-badge category">{CATEGORY_LABELS[detailProduct.category] || detailProduct.category}</span>
                {detailProduct.tradeType === 'BARTER' && <span className="prod-detail-badge barter">🔄 Đổi đồ</span>}
              </div>

              <h2 className="prod-detail-title">{detailProduct.name}</h2>

              {detailProduct.tradeType === 'SELL' ? (
                <div className="prod-detail-price flex items-center gap-1.5"><Icons.UC className="w-5 h-5 text-emerald-600" /> {fmtUC(detailProduct.price)} UC</div>
              ) : (
                <div className="prod-detail-trade flex items-center gap-1.5"><Icons.RefreshCw className="w-5 h-5 text-orange-500" /> Muốn đổi lấy: <strong>{detailProduct.exchangeWanted || 'Liên hệ'}</strong></div>
              )}

              {detailProduct.description && (
                <div className="prod-detail-desc">
                  <h4 className="flex items-center gap-1.5"><Icons.FileText className="w-5 h-5 text-slate-500" /> Mô tả chi tiết</h4>
                  <p>{detailProduct.description}</p>
                </div>
              )}

              {/* Owner info */}
              <div className="prod-detail-owner">
                <div className="prod-detail-owner-left" onClick={() => { setDetailProduct(null); onOpenProfile?.(detailProduct.owner?.id); }}>
                  <div className="prod-detail-owner-avatar">
                    {detailProduct.owner?.avatarUrl
                      ? <img src={detailProduct.owner.avatarUrl} alt="" />
                      : <span>{detailProduct.owner?.fullName?.[0] || '?'}</span>
                    }
                  </div>
                  <div>
                    <div className="prod-detail-owner-name">{detailProduct.owner?.fullName || detailProduct.owner?.username}</div>
                    <div className="prod-detail-owner-label">Người bán</div>
                  </div>
                </div>
                <button
                  className="prod-detail-chat-btn flex items-center justify-center gap-1.5"
                  onClick={() => { setDetailProduct(null); handleChatSeller(detailProduct); }}
                >
                  <Icons.MessageCircle className="w-4 h-4" /> Chat với người bán
                </button>
              </div>

              {/* Trade proposals */}
              {detailProduct.tradeProposals?.length > 0 && (
                <div className="prod-detail-proposals">
                  <h4 className="flex items-center gap-1.5"><Icons.FileText className="w-5 h-5 text-slate-500" /> Lời Đề Nghị Giao Dịch ({detailProduct.tradeProposals.length})</h4>
                  {detailProduct.tradeProposals.map(tp => (
                    <div key={tp.id} className="prod-proposal-item">
                      <div className="prod-proposal-avatar">
                        {tp.proposer?.fullName?.[0] || '?'}
                      </div>
                      <div className="prod-proposal-body w-full">
                        <div className="flex justify-between w-full items-start">
                          <div>
                            <strong>{tp.proposer?.fullName || tp.proposer?.username}</strong>
                            <p className="mt-1 bg-yellow-50 text-yellow-800 p-2 rounded text-[13px] italic">"{tp.proposalText}"</p>
                            <span className={`prod-proposal-status mt-2 flex items-center gap-1 w-max ${tp.status.toLowerCase()}`}>{tp.status === 'PENDING' ? <><Icons.Clock className="w-3.5 h-3.5" /> Chờ duyệt</> : tp.status === 'ACCEPTED' ? <><Icons.CheckCircle className="w-3.5 h-3.5" /> Được chấp nhận</> : <><Icons.X className="w-3.5 h-3.5" /> Từ chối</>}</span>
                          </div>
                          {detailProduct.ownerId === user.id && tp.status === 'PENDING' && (
                            <button onClick={() => handleAcceptProposal(tp.id)} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded text-[13px] ml-2 flex-shrink-0 transition flex items-center justify-center gap-1.5"><Icons.CheckCircle className="w-3.5 h-3.5" /> Duyệt</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="prod-detail-actions">
                {detailProduct.ownerId === user.id ? (
                  <div className="flex gap-2 w-full mt-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 rounded-xl transition" onClick={() => handleEditProduct(detailProduct)}><Icons.Edit className="w-5 h-5" /> Chỉnh sửa thông tin</button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-3 rounded-xl transition" onClick={() => handleDeleteProduct(detailProduct)}><Icons.Trash className="w-5 h-5" /> Xóa tin đăng</button>
                  </div>
                ) : (
                  <div className="flex gap-2 w-full mt-2">
                    <button className={`flex-[3] prod-detail-action-btn ${detailProduct.tradeType === 'SELL' ? 'buy' : 'trade'} flex items-center justify-center gap-2`} onClick={() => detailProduct.tradeType === 'SELL' ? handleBuy(detailProduct) : handleProposeTrade(detailProduct)}>
                      <Icons.MessageCircle className="w-5 h-5" /> {detailProduct.tradeType === 'SELL' ? 'Chat hỏi mua' : 'Chat đề nghị trao đổi'}
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition" onClick={() => onReport && onReport('MARKET_ITEM', detailProduct.id)}>
                      <Icons.AlertTriangle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMarketScreen;
