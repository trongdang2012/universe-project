import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const AiTutorScreen = ({ onBack, user, isFloating = false }) => {
  const [messages, setMessages] = useState([
    { id: 1, isBot: true, text: "Chào bạn! Mình là UniBot. Hôm nay bạn cần giúp gì ở UniVerse?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ============================================================
  // KỊCH BẢN DEMO – thay thế AI thật để quay demo sản phẩm
  // ============================================================
  const DEMO_SCRIPT = [
    // Lịch học cụ thể thứ 3 ngày 14/4
    { keys: ['thứ 3', '14/4', 'thời khóa biểu', 'lịch học', 'hôm nay học gì'], reply: `Chào bạn! Theo dữ liệu từ hệ thống, hôm nay là thứ 3 ngày 14/4/2026, bạn có lịch học:\n\n📚 Phân tích và thiết kế HTTT\n📍 Phòng A5.03\n\n📚 Mạng máy tính\n📍 Phòng A1.306\n\n📚 Kiến trúc máy tính\n📍 Phòng A1.402\n\nBạn nhớ đặt báo thức để đi học đúng giờ nha! ⏰` },

    // Các món đồ cũ CỤ THỂ đang bán lấy từ DB
    { keys: ['ai đang bán', 'ai bán đồ cũ', 'xem thử ai đang bán', 'trên sàn đồ cũ có gì'], reply: `Dạ, hiện tại trên **sàn Đồ cũ** đang có mấy món này được đăng bán nè:\n\n1. **Tủ lạnh, bàn ghế, chiếu** giá *1,000,000 UC* (Người bán: Đặng Văn Trọng)\n2. **Honda Civic** giá *700,000,000 UC* (Người bán: Tào Thị Hồng Điệp)\n3. **Ly trà sữa** giá *25,000 UC* (Người bán: Đào Tuấn Tú)\n4. **Tủ lạnh bán kem** được tặng miễn phí *0 UC* (Người bán: Tô Đát Kỷ)\n\nBạn định chốt Ly trà sữa hay tậu hẳn Honda Civic luôn ạ? 😂` },

    // Chào hỏi
    { keys: ['xin chào', 'chào', 'hello', 'hi', 'hey'], reply: `Chào bạn! 👋 Mình là **UniBot** – trợ lý thông minh của UniVerse!\n\nMình có thể giúp bạn:\n📚 Tìm tài liệu học tập\n🛵 Đặt đơn mua hộ\n📦 Mua bán đồ cũ\n🚗 Ghép chuyến đi xe chung\n🎯 Quản lý lịch học & bài tập\n\nBạn cần hỗ trợ gì hôm nay?` },

    // Tài liệu
    { keys: ['tài liệu', 'giáo trình', 'slide', 'bài giảng', 'note', 'sách'], reply: `📚 **Sàn tài liệu UniVerse** hiện có **hàng trăm** tài liệu từ sinh viên QNU!\n\nBạn có thể:\n• Tìm theo môn học (Toán Logic, CNTT, Kinh tế...)\n• Lọc theo giảng viên hoặc khoa\n• Mua bằng UC – thanh toán nội bộ an toàn\n\n💡 Tip: Bấm tab **Mua bán > Tài liệu** để xem ngay nhé!` },

    // Mua hộ / errand
    { keys: ['mua hộ', 'mua giúp', 'order', 'đặt đồ', 'đặt hàng', 'ship', 'giao'], reply: `🛵 **Tính năng Mua hộ** cực tiện lợi!\n\nBạn cần mua gì:\n🍜 **Đồ ăn/Nước uống** – giao tận nơi trong campus\n🖨️ **In ấn tài liệu** – các bạn giúp in và giao\n📦 **Lấy đồ hộ** – từ ký túc xá hay cửa hàng\n\n✅ Chỉ cần đăng đơn → người nhận đơn → nhận hàng!\nPhí thỏa thuận linh hoạt với người chạy.` },

    // Đồ cũ
    { keys: ['đồ cũ', 'second hand', 'bán đồ', 'mua đồ', 'thanh lý', 'máy tính', 'laptop', 'sách cũ'], reply: `📦 **Sàn đồ cũ UniVerse** – nơi mua bán trong cộng đồng sinh viên!\n\nĐang có:\n💻 Laptop, điện thoại, phụ kiện\n📚 Sách giáo trình các ngành\n🎒 Đồ dùng học tập, ký túc xá\n\n🔥 Giá sinh viên – uy tín – giao dịch qua chat!\nTất cả thanh toán bằng UC nội bộ, an toàn 100%.` },

    // Đi xe chung
    { keys: ['xe chung', 'đi chung', 'carpool', 'ghép xe', 'về quê', 'phương tiện'], reply: `🚗 **Ghép xe chung** – tiết kiệm & an toàn!\n\nTiện ích nổi bật:\n• Đăng chuyến hoặc tìm chuyến theo lộ trình\n• Lọc theo thời gian, điểm đi, điểm đến\n• Xem vị trí GPS thời gian thực\n• Chat trực tiếp để thỏa thuận giá\n\n📍 Đặc biệt có tính năng **xem khoảng cách** giữa bạn và người đăng chuyến!` },

    // Lịch học / bài tập
    { keys: ['lịch học', 'thời khóa biểu', 'bài tập', 'deadline', 'môn học', 'tiết', 'calendar'], reply: `🗓️ **Smart Schedule** của UniVerse giúp bạn:\n\n• Đồng bộ lịch từ **Google Classroom** tự động\n• Xem thời khóa biểu theo tuần/ngày\n• Nhắc nhở deadline bài tập\n• Lên kế hoạch học thông minh theo AI\n\n💡 Vào tab **Học tập > Xem lịch** để trải nghiệm ngay!` },

    // UC / điểm thưởng
    { keys: ['uc', 'điểm', 'xu', 'coin', 'tiền tệ', 'thanh toán', 'nạp'], reply: `💰 **UC (UniCoin)** – đơn vị tiền tệ nội bộ của UniVerse!\n\nDùng để:\n• Mua tài liệu, đồ cũ từ sinh viên khác\n• Trả phí dịch vụ mua hộ, đi xe chung\n• Nhận thưởng khi đóng góp cộng đồng\n\n🔒 An toàn, minh bạch – mọi giao dịch đều được ghi lại.\nKiểm tra số dư UC ở góc trên bên phải màn hình!` },

    // Chat / chốt giá
    { keys: ['chat', 'nhắn tin', 'liên hệ', 'chốt giá', 'thương lượng', 'đàm phán'], reply: `💬 **Hệ thống Chat UniVerse** tích hợp sẵn trong sàn giao dịch!\n\nTính năng đặc biệt:\n• Chat 1-1 về sản phẩm cụ thể\n• **Chốt giá** trực tiếp trong chat – thương lượng linh hoạt\n• Bên kia chấp nhận → giao dịch hoàn tất tự động\n• Lưu lại lịch sử giao dịch\n\n✅ Khi cả 2 đồng ý → đơn tự ẩn khỏi sàn, ghi log hoàn tất!` },

    // AI / tính năng AI
    { keys: ['ai', 'trí tuệ nhân tạo', 'chatgpt', 'gemini', 'gợi ý', 'thông minh'], reply: `🤖 **AI trong UniVerse** hỗ trợ sinh viên toàn diện:\n\n• **UniBot** (mình đây!) – giải đáp mọi thắc mắc\n• **Smart Schedule** – lên lịch học tối ưu bằng AI\n• **AI Giải bài** – chụp bài toán → AI giải ngay\n• **AI Tutor** – giải thích khái niệm khó\n\n🚀 Tất cả được tích hợp liền mạch vào trải nghiệm học tập!` },

    // Đăng ký / tài khoản
    { keys: ['đăng ký', 'tài khoản', 'login', 'đăng nhập', 'profile', 'hồ sơ'], reply: `👤 **Tài khoản UniVerse** đơn giản và tiện lợi!\n\n• Đăng ký bằng email trường hoặc Google\n• Hồ sơ cá nhân: ảnh đại diện, thông tin sinh viên\n• Xem lịch sử giao dịch, UC, đánh giá\n• Kết nối với sinh viên cùng trường\n\n🏫 Hệ thống xác thực sinh viên QNU – an toàn và đáng tin cậy!` },

    // Demo / giới thiệu
    { keys: ['universe', 'app', 'ứng dụng', 'platform', 'giới thiệu', 'demo', 'tính năng'], reply: `🌟 **UniVerse** – Nền tảng sinh viên thế hệ mới!\n\n5 tính năng cốt lõi:\n1. 📚 **Sàn tài liệu** – mua bán giáo trình, slide\n2. 🛵 **Mua hộ** – đặt đồ nhanh trong campus\n3. 📦 **Đồ cũ** – thanh lý & mua sắm tiết kiệm\n4. 🚗 **Xe chung** – ghép chuyến thông minh\n5. 🤖 **AI học tập** – lịch, bài tập, giải bài\n\nTất cả trong 1 app – dành riêng cho sinh viên QNU! 🎓` },

    // Fallback mặc định
    { keys: [], reply: `Mình hiểu bạn đang hỏi về: "{{query}}"!\n\nUniVerse chỉ có thể hỗ trợ trả lời bạn trong các lĩnh vực:\n📚 Tài liệu học tập | 🛵 Mua hộ | 📦 Đồ cũ | 🚗 Xe chung | 🤖 AI học tập\n\nBạn thử hỏi cụ thể hơn hoặc chọn một tính năng bạn muốn khám phá nhé! 😊` },
  ];

  const getDemoReply = (query) => {
    const q = query.toLowerCase().normalize('NFC');
    for (const item of DEMO_SCRIPT) {
      if (item.keys.length === 0) return item.reply.replace('{{query}}', query);
      if (item.keys.some(k => q.includes(k))) return item.reply;
    }
    return DEMO_SCRIPT[DEMO_SCRIPT.length - 1].reply.replace('{{query}}', query);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    const msgId = Date.now();
    setMessages(prev => [...prev, { id: msgId, isBot: false, text: userMsg }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await axios.post('/api/ai/chat', {
        message: userMsg,
        userId: user?.id
      });
      setMessages(prev => [...prev, { id: Date.now(), isBot: true, text: res.data.reply }]);
    } catch (err) {
      console.warn("UniBot chuyển sang Offline Mock Mode");
      const reply = getDemoReply(userMsg);
      setMessages(prev => [...prev, { id: Date.now(), isBot: true, text: reply }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Chế độ floating (embedded trong nút nổi) - không có header và back button riêng
  if (isFloating) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div className={`whitespace-pre-wrap max-w-[85%] p-3 rounded-2xl text-[14px] shadow-sm ${msg.isBot ? 'bg-gray-100 text-gray-800 rounded-tl-sm' : 'bg-[#9C27B0] text-white rounded-tr-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 px-5 rounded-2xl bg-gray-100 text-gray-500 rounded-tl-sm shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={bottomRef}></div>
        </div>

        <form onSubmit={handleSend} className="p-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Hỏi UniBot điều gì đó..."
            className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-[14px] text-gray-800 outline-none focus:border-purple-400 transition"
          />
          <button type="submit" disabled={!inputValue.trim()} className="bg-[#9C27B0] text-white w-9 h-9 rounded-full flex items-center justify-center font-bold hover:bg-purple-800 transition disabled:bg-gray-300">
            <span className="text-lg">➤</span>
          </button>
        </form>
      </div>
    );
  }

  // Chế độ full-screen (giữ nguyên giao diện cũ)
  return (
    <div className="min-h-[100dvh] bg-[#9C27B0] -mx-4 -my-4 md:-mx-6 md:-mt-6 p-4 md:p-6 pb-20 md:pb-20 text-white font-sans sm:rounded-t-3xl flex flex-col">
      <button onClick={onBack} className="flex items-center gap-2 text-white font-bold mb-6 hover:scale-105 transition bg-black/10 px-4 py-2 rounded-full w-fit backdrop-blur-sm flex-shrink-0">
        <span className="text-xl">❮</span> Quay lại
      </button>

      <div className="flex-1 bg-white/10 sm:rounded-3xl shadow-xl border border-white/20 overflow-hidden flex flex-col min-h-[500px] backdrop-blur-md">
        <div className="bg-white/20 p-4 text-white flex items-center justify-between shadow-sm z-10 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shadow-inner">
              🤖
            </div>
            <div>
              <h3 className="font-black text-xl drop-shadow-sm">UniBot Thế Hệ Mới</h3>
              <p className="text-[13px] text-purple-100 font-medium">Sẵn sàng giải đáp mọi thứ ở UniVerse</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div className={`whitespace-pre-wrap max-w-[80%] p-4 rounded-3xl text-[15px] shadow-md ${msg.isBot ? 'bg-white text-gray-800 rounded-tl-sm' : 'bg-[#7B1FA2] text-white rounded-tr-sm border border-white/10'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 px-5 rounded-3xl bg-white text-gray-500 rounded-tl-sm shadow-md flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={bottomRef}></div>
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white/20 border-t border-white/10 flex items-center gap-2 backdrop-blur-md">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Hỏi UniBot điều gì đó..."
            className="flex-1 bg-white rounded-full px-5 py-3 text-[15px] text-gray-800 outline-none focus:ring-4 focus:ring-purple-300 transition shadow-inner"
          />
          <button type="submit" disabled={!inputValue.trim()} className="bg-[#7B1FA2] text-white w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-purple-900 shadow-xl transition disabled:bg-white/40 disabled:text-white/50">
            <span className="text-xl">➤</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiTutorScreen;
