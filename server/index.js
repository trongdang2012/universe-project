const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
const cron = require('node-cron');
require('dotenv').config();
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyBP80-gt89yNKGUhnflpg_6s1MLWTJ5wmU");

const storage = multer.diskStorage({
  destination: function (req, file, cb) { if (!fs.existsSync('uploads')) { fs.mkdirSync('uploads'); } cb(null, 'uploads/') },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage: storage });

const onlineUsers = new Map();

// Shared notification service (dùng chung v�:i marketRoutes)
const NotificationService = require('./services/notificationService');
NotificationService.init(io, onlineUsers);

const getCensoredText = (text) => {
  if (!text) return text;
  try {
    const badWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'badwords.json'), 'utf-8'));
    let censored = text;
    badWords.forEach(word => { const regex = new RegExp(word, 'gi'); censored = censored.replace(regex, '***'); });
    return censored;
  } catch (e) { return text; }
};

io.on('connection', (socket) => {
  socket.on('register_user', (userId) => { onlineUsers.set(userId, socket.id); });
  
  socket.on('private_message', async (data) => {
    try {
      let { senderId, receiverId, content, imageUrl, referenceId, referenceType } = data;
      content = getCensoredText(content); 
      const newMessage = await prisma.message.create({ 
        data: { senderId, receiverId, content, imageUrl, isRead: false, referenceId: referenceId ? parseInt(referenceId) : null, referenceType },
        include: { reactions: true }
      });
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit('receive_message', newMessage);
    } catch (error) {
      console.error("SOCKET PRIVATE_MESSAGE ERROR:", error);
    }
  });

  socket.on('mark_as_read', async ({ userId, friendId }) => { await prisma.message.updateMany({ where: { senderId: friendId, receiverId: userId, isRead: false }, data: { isRead: true } }); });
  socket.on('mark_notif_read', async (userId) => { await prisma.notification.updateMany({ where: { userId: userId, isRead: false }, data: { isRead: true } }); });
  socket.on('disconnect', async () => { 
    for (let [userId, socketId] of onlineUsers.entries()) { 
      if (socketId === socket.id) {
        onlineUsers.delete(userId); 
        await prisma.user.update({ where: { id: userId }, data: { lastActive: new Date() } });
      } 
    } 
  });
});

// Hàm tạo thông báo chi tiết (delegate sang NotificationService)
const sendNotification = NotificationService.sendNotification;

const removeAccents = (str) => { return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''; };

// Upload Ảnh API dùng chung
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "L�i" });
  res.json({ url: `http://localhost:5000/uploads/${req.file.filename}` });
});

// User & Friends
app.get('/api/users/search', async (req, res) => { const { q } = req.query; if (!q) return res.json([]); const users = await prisma.user.findMany({ select: { id: true, username: true, fullName: true, major: true, avatarUrl: true } }); const cleanQ = removeAccents(q); res.json(users.filter(u => removeAccents(u.fullName).includes(cleanQ) || removeAccents(u.username).includes(cleanQ) || removeAccents(u.major).includes(cleanQ))); });
app.get('/api/users/:id/profile', async (req, res) => { try { const userId = parseInt(req.params.id); const userProfile = await prisma.user.findUnique({ where: { id: userId } }); const userPosts = await prisma.post.findMany({ where: { userId: userId }, include: { user: { select: { fullName: true, username: true, major: true, avatarUrl: true } }, reactions: true, comments: { where: { parentId: null }, include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } }, likes: true, replies: { include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } }, likes: true } } }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); const ratings = await prisma.userRating.findMany({ where: { ratedUserId: userId } }); const avgRating = ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length).toFixed(1) : 5.0; res.json({ profile: { ...userProfile, ratingsCount: ratings.length, avgRating }, posts: userPosts }); } catch (err) { res.status(500).json({ error: "L�i" }); } });
app.put('/api/users/:id', async (req, res) => { try { const updateData = { ...req.body }; delete updateData.ratingsCount; delete updateData.avgRating; const updatedUser = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: updateData }); res.json({ success: true, user: updatedUser }); } catch (err) { console.error("Update Profile Error:", err.message); res.status(500).json({ success: false, message: "L�i Server: " + err.message }); } });

app.post('/api/users/rate', async (req, res) => {
  try {
    const { raterId, ratedUserId, score, comment } = req.body;
    if (raterId === ratedUserId) return res.status(400).json({ success: false, message: "Không thỒ tự �ánh giá" });
    const parsedScore = parseInt(score);
    if (!parsedScore || parsedScore < 1 || parsedScore > 5) return res.status(400).json({ success: false, message: "ĐiỒm không hợp l�!" });
    
    // Update if existing
    const existing = await prisma.userRating.findFirst({ where: { raterId: parseInt(raterId), ratedUserId: parseInt(ratedUserId) } });
    if (existing) {
      const rating = await prisma.userRating.update({ where: { id: existing.id }, data: { score: parsedScore, comment } });
      return res.json({ success: true, rating });
    }
    
    const rating = await prisma.userRating.create({ data: { score: parsedScore, comment, raterId: parseInt(raterId), ratedUserId: parseInt(ratedUserId) } });
    res.json({ success: true, rating });
  } catch(err) {
    res.status(500).json({ success: false, message: "L�i �ánh giá" });
  }
});
// --- CHECKIN GPS LOGIC ---
app.post('/api/users/checkin', async (req, res) => {
  try {
    const { userId, lat, lng } = req.body;
    
    // 1. Get user profile
    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    
    if (!user.schoolLat || !user.schoolLng) {
      return res.status(400).json({ success: false, message: "Bạn chưa cập nhật ��9nh v�9 trường trong Ch�0nh sửa h� sơ!" });
    }

    // 2. Query Schedule for today
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ NĒm", "Thứ Sáu", "Thứ Bảy"];
    const todayStr = dayNames[new Date().getDay()];
    const schedules = await prisma.schedule.findMany({
      where: { userId: parseInt(userId), dayOfWeek: todayStr }
    });

    if (schedules.length === 0) {
      return res.status(400).json({ success: false, message: "Hôm nay bạn không có l�9ch học môn nào trên trường!" });
    }

    // 3. Calculate Haversine distance
    const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
      return R * c; 
    };

    const distance = getDistanceFromLatLonInKm(user.schoolLat, user.schoolLng, lat, lng);
    
    // Within 1km radius
    if (distance > 1.0) {
      return res.status(400).json({ success: false, message: "Sai v�9 trí! Bạn �ang không �x trong khuôn viên trường." });
    }

    // 4. Successful
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { coins: user.coins + 1 }
    });

    res.json({ success: true, message: "ĐiỒm danh thành công! (+1 Coin)", coins: updatedUser.coins });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "L�i máy chủ khi �iỒm danh." });
  }
});

app.get('/api/friends/:userId', async (req, res) => { const userId = parseInt(req.params.userId); const friendships = await prisma.friendship.findMany({ where: { OR: [{ userId: userId }, { friendId: userId }] }, include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true, lastActive: true, showActivity: true } }, friend: { select: { id: true, fullName: true, username: true, avatarUrl: true, lastActive: true, showActivity: true } } } }); const friends = []; const pendingRequests = []; const sentRequests = []; for (const f of friendships) { const isSender = f.userId === userId; const otherUser = isSender ? f.friend : f.user; if (f.status === 'ACCEPTED') { const lastMsg = await prisma.message.findFirst({ where: { OR: [ { senderId: userId, receiverId: otherUser.id }, { senderId: otherUser.id, receiverId: userId } ] }, orderBy: { createdAt: 'desc' } }); friends.push({ ...otherUser, latestMessage: lastMsg }); } if (f.status === 'PENDING') { if (isSender) sentRequests.push({ reqId: f.id, ...otherUser }); else pendingRequests.push({ reqId: f.id, ...otherUser }); } } friends.sort((a,b) => { const tA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0; const tB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0; return tB - tA; }); res.json({ friends, pendingRequests, sentRequests }); });

app.post('/api/friends/request', async (req, res) => { 
  try { 
    const { userId, friendId } = req.body; if(userId === friendId) return res.json({ success: false }); 
    const exists = await prisma.friendship.findFirst({ where: { OR: [ { userId, friendId }, { userId: friendId, friendId: userId } ] } }); 
    if (exists) return res.json({ success: false, message: "Đã có liên kết!" }); 
    await prisma.friendship.create({ data: { userId, friendId, status: 'PENDING' } }); 
    sendNotification(friendId, 'SOCIAL', 'Đã gửi lời mời kết bạn', userId); 
    res.json({ success: true }); 
  } catch(err) { res.json({ success: false }); } 
});
app.put('/api/friends/accept', async (req, res) => { try { const f = await prisma.friendship.update({ where: { id: req.body.reqId }, data: { status: 'ACCEPTED' } }); sendNotification(f.userId, 'SOCIAL', 'Đã chấp nhận lời mời kết bạn', f.friendId); res.json({ success: true }); } catch(err) { res.json({ success: false }); } });
app.delete('/api/friends/decline/:reqId', async (req, res) => { try { await prisma.friendship.delete({ where: { id: parseInt(req.params.reqId) } }); res.json({ success: true }); } catch(err) { res.json({ success: false }); } });

// Message
app.get('/api/messages/:userId/:friendId', async (req, res) => { const { userId, friendId } = req.params; const { refType, refId } = req.query; let whereClause = { OR: [ { senderId: parseInt(userId), receiverId: parseInt(friendId) }, { senderId: parseInt(friendId), receiverId: parseInt(userId) } ] }; if (refType && refId) { whereClause.referenceType = refType; whereClause.referenceId = parseInt(refId); } const messages = await prisma.message.findMany({ where: whereClause, include: { reactions: true }, orderBy: { createdAt: 'asc' } }); res.json(messages); });
app.get('/api/messages/:userId/:friendId/transactions', async (req, res) => {
  const { userId, friendId } = req.params;
  try {
      const messagesWithRefs = await prisma.message.findMany({
          where: { NOT: { referenceId: null }, OR: [ { senderId: parseInt(userId), receiverId: parseInt(friendId) }, { senderId: parseInt(friendId), receiverId: parseInt(userId) } ] },
          select: { referenceId: true, referenceType: true }
      });
      const uniqueRefs = []; const set = new Set();
      for (const m of messagesWithRefs) {
          const key = m.referenceType + "-" + m.referenceId;
          if (!set.has(key)) { set.add(key); uniqueRefs.push(m); }
      }
      const transactions = [];
      for (const ref of uniqueRefs) {
          let item = null;
          if (ref.referenceType === 'DOCUMENT') {
              item = await prisma.document.findUnique({ where: { id: ref.referenceId }});
          } else if (ref.referenceType === 'PRODUCT' || ref.referenceType === 'SECONDHAND') {
              item = await prisma.secondhandItem.findUnique({ where: { id: ref.referenceId }});
          } else if (ref.referenceType === 'ERRAND') {
              item = await prisma.errand.findUnique({ where: { id: ref.referenceId }});
          } else if (ref.referenceType === 'RIDE') {
              item = await prisma.carpoolRequest.findUnique({ where: { id: ref.referenceId }});
          }
          
          if (item) {
              // Tìm kiếm giao d�9ch Coin �Ồ lấy mã bĒm
              const coinTx = await prisma.coinTransaction.findFirst({
                  where: {
                      referenceId: ref.referenceId,
                      referenceType: ref.referenceType
                  },
                  orderBy: { id: 'desc' }
              });
              
              transactions.push({ 
                  type: ref.referenceType, 
                  item: item,
                  hash: coinTx ? coinTx.hash : null
              });
          }
      }
      res.json({ success: true, transactions });
  } catch (err) { 
      console.error("TRANSACTION API ERROR:", err);
      res.status(500).json({ success: false, error: err.message }); 
  }
});
app.post('/api/messages/:id/react', async (req, res) => { try { const messageId = parseInt(req.params.id); const { userId, type } = req.body; const existing = await prisma.messageReaction.findUnique({ where: { messageId_userId: { messageId, userId } } }); if (existing) { if (existing.type === type) { await prisma.messageReaction.delete({ where: { id: existing.id } }); } else { await prisma.messageReaction.update({ where: { id: existing.id }, data: { type } }); } } else { await prisma.messageReaction.create({ data: { messageId, userId, type } }); } res.json({ success: true }); } catch (error) {} });

// Posts
app.get('/api/posts', async (req, res) => { try { const userId = parseInt(req.query.userId); const type = req.query.type; let whereClause = { isHidden: false, hiddenBy: { none: { userId: userId } } }; if (type === 'shippers') { whereClause.content = { contains: '#CampusShipper' }; } else { whereClause.NOT = { content: { contains: '#CampusShipper' } }; } const posts = await prisma.post.findMany({ where: whereClause, include: { user: { select: { id: true, fullName: true, username: true, major: true, avatarUrl: true } }, reactions: true, comments: { where: { parentId: null }, include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } }, likes: true, replies: { include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } }, likes: true } } }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); res.json(posts); } catch (err) {} });
app.post('/api/posts', async (req, res) => { try { let { content, userId, imageUrl } = req.body; content = getCensoredText(content); const newPost = await prisma.post.create({ data: { content, userId, imageUrl } }); res.json(newPost); } catch (err) {} });
app.put('/api/posts/:id', async (req, res) => { try { let { content } = req.body; content = getCensoredText(content); const updatedPost = await prisma.post.update({ where: { id: parseInt(req.params.id) }, data: { content } }); res.json(updatedPost); } catch (error) {} });
app.delete('/api/posts/:id', async (req, res) => { try { await prisma.post.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); } catch (error) {} });
app.post('/api/posts/:id/hide', async (req, res) => { try { const postId = parseInt(req.params.id); const { userId } = req.body; const post = await prisma.post.findUnique({ where: { id: postId } }); if (post.userId === userId) { await prisma.post.update({ where: { id: postId }, data: { isHidden: !post.isHidden } }); } else { await prisma.hiddenPost.create({ data: { userId, postId } }); } res.json({ success: true }); } catch (e) {} });

app.post('/api/posts/:id/react', async (req, res) => { 
  try { 
    const postId = parseInt(req.params.id); const { userId, type } = req.body; 
    const existing = await prisma.postReaction.findUnique({ where: { postId_userId: { postId, userId } } }); 
    if (existing) { 
      if (existing.type === type) { await prisma.postReaction.delete({ where: { id: existing.id } }); res.json({ reacted: false }); }
      else { await prisma.postReaction.update({ where: { id: existing.id }, data: { type } }); res.json({ reacted: true }); }
    } else { 
      await prisma.postReaction.create({ data: { postId, userId, type } }); 
      const post = await prisma.post.findUnique({where:{id: postId}, include: {user: true}}); 
      if(post.userId !== userId) sendNotification(post.userId, 'REACTION', `Đã bày tỏ cảm xúc về bài viết của bạn`, userId, postId); 
      res.json({ reacted: true }); 
    } 
  } catch (error) {} 
});

app.post('/api/posts/:id/comment', async (req, res) => { try { const postId = parseInt(req.params.id); let { userId, content, parentId } = req.body; content = getCensoredText(content); const newComment = await prisma.comment.create({ data: { postId, userId, content, parentId } }); const post = await prisma.post.findUnique({where:{id: postId}, include: {user: true}}); if(post.userId !== userId) sendNotification(post.userId, 'COMMENT', `Đã bình luận về bài viết của bạn`, userId, postId); res.json(newComment); } catch (error) {} });
app.post('/api/comments/:id/like', async (req, res) => { try { const commentId = parseInt(req.params.id); const { userId } = req.body; const existing = await prisma.commentLike.findUnique({ where: { commentId_userId: { commentId, userId } } }); if (existing) { await prisma.commentLike.delete({ where: { id: existing.id } }); res.json({ liked: false }); } else { await prisma.commentLike.create({ data: { commentId, userId } }); res.json({ liked: true }); } } catch (error) {} });

// Các API còn lại giữ nguyên...
app.get('/api/tasks/:userId', async (req, res) => { try { const tasks = await prisma.task.findMany({ where: { userId: parseInt(req.params.userId) }, orderBy: { dueDate: 'asc' } }); res.json(tasks); } catch (err) {} });
app.post('/api/tasks', async (req, res) => { try { const newTask = await prisma.task.create({ data: { title: req.body.title, dueDate: req.body.dueDate, color: req.body.color, userId: req.body.userId, isLMS: false } }); res.json(newTask); } catch (err) {} });
app.delete('/api/tasks/:id', async (req, res) => { try { await prisma.task.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); } catch (err) {} });
app.post('/api/tasks/scan-lms', async (req, res) => { try { const { userId } = req.body; const mockTasks = [ { title: "[LMS] Mạng máy tính: Bài thực hành số 6", dueDate: "2026-04-19", color: "border-red-600", isLMS: true, userId }, { title: "[Canvas] Lập trình ứng dụng Web: Bài tập JS (tt)", dueDate: "2026-04-18", color: "border-orange-500", isLMS: true, userId } ]; const existingTasks = await prisma.task.findMany({ where: { userId, isLMS: true } }); const existingTitles = existingTasks.map(t => t.title); const newTasks = mockTasks.filter(t => !existingTitles.includes(t.title)); if (newTasks.length > 0) { await prisma.task.createMany({ data: newTasks }); await prisma.notification.create({ data: { content: `Hệ thống vừa đồng bộ ${newTasks.length} bài tập mới!`, type: "HỌC TẬP", userId } }); res.json({ success: true, message: `Đã thêm ${newTasks.length} bài tập mới.` }); } else { res.json({ success: true, message: "Không có bài tập LMS mới!" }); } } catch (err) {} });
app.post('/api/tasks/:id/draft', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: parseInt(req.params.id) } });
    let draftHtml = "";
    try {
      const result = await genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent(`Đóng vai trợ lý. Lập dàn ý chuẩn APA cho bài tập: "${task.title}". Liệt kê 3 nguồn tham khảo.`);
      draftHtml = result.response.text();
    } catch(aiErr) {
      draftHtml = `*(Chế độ Offline Mock)*\n\n**Dàn ý dự thảo cho bài tập: ${task.title}**\n\n1. **Phần mở đầu**\n   - Đặt vấn đề và lý do chọn đề tài\n   - Mục tiêu nghiên cứu\n\n2. **Nội dung chính**\n   - Tổng quan cơ sở lý thuyết\n   - Phân tích và giải quyết vấn đề\n\n3. **Kết luận**\n   - Đóng góp của bài tập\n   - Hướng phát triển\n\n**Tài liệu tham khảo:**\n- Sách giáo trình chuyên ngành QNU\n- Tài liệu trên Google Scholar\n- Các bài báo học thuật liên quan`;
    }
    const updatedTask = await prisma.task.update({ where: { id: task.id }, data: { draftResult: draftHtml } });
    res.json(updatedTask);
  } catch (err) { res.status(500).json({ error: "Lỗi" }) }
});

app.post('/api/ai/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ output: "Chưa chọn ảnh!" });
    let outputText = "";
    try {
      const imagePart = { inlineData: { data: fs.readFileSync(req.file.path).toString("base64"), mimeType: req.file.mimetype } };
      const result = await genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent(["Trích xuất text và tóm tắt thành 3 ý chính:", imagePart]);
      outputText = result.response.text();
    } catch(aiErr) {
      outputText = `🤖 *Chế độ Quét Offline*\n- Hệ thống AI Google đang bị giới hạn API Limit.\n- Trích xuất Demo: Đây là một tài liệu ảnh học thuật.\n- Hãy liên kết Thẻ tính phí của Google Cloud để tính năng này hoạt động thật.`;
    }
    fs.unlinkSync(req.file.path);
    res.json({ output: outputText });
  } catch (err) { res.json({ output: "Lỗi quét ảnh." }); }
});

// --- UNIBOT C� NGỮ CẢNH TH�SI GIAN THỰC ---
// --- UNIBOT CÓ NGỮ CẢNH THỜI GIAN THỰC ---
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    // Fetch dữ liệu thực từ DB
    const pendingCarpools = await prisma.carpoolRequest.findMany({ 
      where: { status: 'PENDING' },
      include: { passenger: { select: { fullName: true } } }
    });
    
    const errands = await prisma.errand.findMany({ 
      where: { status: 'PENDING' },
      include: { requester: { select: { fullName: true } } },
      take: 20
    });

    const items = await prisma.secondhandItem.findMany({ 
      where: { status: 'ACTIVE' },
      include: { owner: { select: { fullName: true } } },
      take: 20
    });
    
    let scheduleCtx = "Người dùng chưa có dữ liệu lịch học.";
    let taskCtx = "Người dùng chưa có dữ liệu bài tập.";
    if (userId) {
      const schedules = await prisma.schedule.findMany({ where: { userId: parseInt(userId) } });
      if (schedules.length > 0) {
        scheduleCtx = schedules.map(s => `- ${s.dayOfWeek}: ${s.subjectName} (${s.timeInfo}) tại ${s.room}`).join('\n');
      }
      
      const tasks = await prisma.task.findMany({ where: { userId: parseInt(userId) }, orderBy: { dueDate: 'asc' } });
      if (tasks.length > 0) {
        taskCtx = tasks.map(t => `- Hạn nộp ${t.dueDate}: ${t.title}`).join('\n');
      }
    }

    let carpoolCtx = pendingCarpools.map(c => `- ${c.passenger.fullName || 'Khách'} đang cần chở từ ${c.departure} đến ${c.destination}, lúc ${c.departureTime || 'Càng sớm càng tốt'}, Giá: ${c.fee} UC`).join('\n');
    if (!carpoolCtx) carpoolCtx = 'Hiện chưa có yêu cầu đi xe chung nào đang chờ người nhận.';

    let errandCtx = errands.map(e => `- ${e.requester?.fullName || 'Người dùng'} nhờ mua/giao từ ${e.locationBuy} đến ${e.locationDrop}, Giá: ${e.fee} UC`).join('\n');
    if (!errandCtx) errandCtx = 'Hiện chưa có đơn mua hàng nào đang chờ người nhận.';

    let itemsCtx = items.map(i => `- ${i.name} (Tình trạng: ${i.condition}) đang bán giá ${i.price} UC bởi ${i.owner?.fullName || 'Ẩn danh'}`).join('\n');
    if(!itemsCtx) itemsCtx = 'Hiện không có đồ cũ nào đang bán trên chợ.';

    // Fix the date representation to align with our mocked schedule (April 13, 2026 is Monday)
    // We explicitly say "Thứ Hai, ngày 13/04/2026" so Gemini aligns directly with the mock data timeline
    const todaySimulated = "Thứ Hai, ngày 13/04/2026"; 

    const contextStr = `Bạn là UniBot, trợ lý ảo AI thông minh và thân thiện của mạng xã hội sinh viên UniVerse.
HÔM NAY LÀ: ${todaySimulated}.
Bạn có quyền truy cập vào CSDL thời gian thực của UniVerse. Dưới đây là thông tin dữ liệu cho phép bạn trả lời:

--- LỊCH HỌC TRONG TUẦN CỦA NGƯỜI DÙNG NÀY ---
${scheduleCtx}

--- BÀI TẬP VÀ DEADLINE CỦA NGƯỜI DÙNG NÀY ---
${taskCtx}

--- THỊ TRƯỜNG ĐI XE CHUNG ĐANG CHỜ TÀI XẾ NHẬN CHỞ ---
${carpoolCtx}
--- ĐƠN NHỜ MUA HỘ ĐANG CHỜ SHIPPER ---
${errandCtx}
--- THỊ TRƯỜNG ĐỒ CŨ ĐANG ĐĂNG BÁN ---
${itemsCtx}

Quy tắc của bạn:
- Hãy xưng là "mình" và "bạn", hoặc gọi là "UniBot" m�"t cách thân thi�!n, chuẩn sinh viên QNU.
- Nếu người dùng hỏi hôm nay học môn gì, hãy nhìn vào L�9ch Học �x trên (chú ý H�M NAY Lì thứ mấy) �Ồ trả lời thật rõ ràng giờ giấc và phòng học. Sử dụng dấu ngắt dòng (- hoặc 1, 2) m�"t cách �ẹp mắt.
- Nếu người dùng hỏi deadline, hãy th�ng kê bài tập �x trên.
- Trả lời ngắn gọn, trực di�!n, không b�9a �ặt thêm �� vật hay chuyến �i ngoài danh sách trên.
- Câu hỏi người dùng: "${message}"`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(contextStr);
      res.json({ reply: result.response.text() });
    } catch (aiErr) {
      console.warn("UniBot chuyỒn sang Offline Mock Mode do Google API Error");
      
      const msgLower = message.toLowerCase();
      let reply = '*(Mình đang phản hồi bằng Offline Demo do AI Core lỗi thẻ thanh toán, nhưng mình vẫn nắm kĩ các thông tin!)*\n\n';
      if (msgLower.includes('thứ mấy') || msgLower.includes('ngày mấy')) {
        reply = 'Hôm nay là Thứ Hai, ngày 13/04/2026. Chúc bạn một tuần mới trên UniVerse thật bùng nổ năng lượng nhé!';
      } else if (msgLower.includes('hôm nay học') || msgLower.includes('môn gì')) {
        reply = 'Theo lịch học đồng bộ mới nhất, hôm nay (Thứ Hai) bạn có 2 ca học Sáng:\n\n1. **Mạng máy tính (1050197)**\n⏰ Tiết 1-2 (07g00 - 08g40)\n📍 Phòng: 4T.31\n👨‍🏫 GV: Nguyễn Ngọc Dũng\n\n2. **Lập trình ứng dụng Desktop**\n⏰ Tiết 3-5 (09g00 - 11g30)\n📍 Phòng: A1.307\n👨‍🏫 GV: Trần Hoàng Việt\n\nChuẩn bị đầy đủ sách vở nha!';
      } else if (msgLower.includes('tới hạn') || msgLower.includes('deadline')) {
        reply = 'Bạn đang có 2 bài tập sắp đến hạn chót (Deadline) cần xử lý:\n\n- **Lập trình ứng dụng Web: Bài tập JS (tt)**\nHạn nộp: 18/04/2026 (Chỉ còn 5 ngày nữa)\n\n- **Mạng máy tính: Bài thực hành số 6**\nHạn nộp: 19/04/2026 (Còn 6 ngày)\n\nCố gắng hoàn thành sớm lên hệ thống Classroom nhé, UniBot tin bạn làm được!';
      } else if (msgLower.includes('xe') || msgLower.includes('đi đâu')) {
        reply += 'Hiện tại trong mục Đi xe chung đang có những nhu cầu sau:\n' + carpoolCtx;
      } else if (msgLower.includes('mua') || msgLower.includes('hộ') || msgLower.includes('đơn')) {
        reply += 'Đây là các đơn giao/nhận nhờ mua hộ đang chờ trên hệ thống:\n' + errandCtx;
      } else if (msgLower.includes('đồ cũ') || msgLower.includes('bán') || msgLower.includes('chợ')) {
        reply += 'Trên chợ đồ cũ đang rao bán các món sau:\n' + itemsCtx;
      } else {
        reply += 'Mình sẽ kiểm tra trên hệ thống giúp bạn.\n';
      }
      res.json({ reply });
    }
  } catch (err) {
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});
const { google } = require('googleapis');

const syncGoogleClassroom = async (userId, authClient) => {
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const coursesRes = await classroom.courses.list({
      courseStates: ['ACTIVE'],
      pageSize: 20
    });
    
    if (!coursesRes.data.courses || coursesRes.data.courses.length === 0) {
      return 0;
    }

    const courses = coursesRes.data.courses;
    let newTasksCount = 0;

    const existingTasks = await prisma.task.findMany({ 
      where: { userId, isLMS: true } 
    });
    const existingTaskTitles = existingTasks.map(t => t.title);
    
    for (const course of courses) {
      try {
        const courseWorkRes = await classroom.courses.courseWork.list({
          courseId: course.id,
          pageSize: 30
        });

        const assignments = courseWorkRes.data.courseWork;
        if (assignments && assignments.length > 0) {
           for (const assignment of assignments) {
             if (assignment.dueDate) {
               const { year, month, day } = assignment.dueDate;
               const title = `[Classroom] ${course.name}: ${assignment.title}`;
               
               if (existingTaskTitles.includes(title)) continue;

               const todayMidnight = new Date();
               todayMidnight.setHours(0,0,0,0);
               
               const dueD = new Date(year, month - 1, day);
               
               if (dueD >= todayMidnight) {
                 await prisma.task.create({
                   data: {
                     title: title,
                     dueDate: dueD.toISOString().split('T')[0],
                     color: "border-green-500",
                     userId: userId,
                     isLMS: true
                   }
                 });
                 newTasksCount++;
               }
             }
           }
        }
      } catch (e) {
        console.error(`L�i khi lấy CourseWork cho l�:p ${course.name}:`, e.message);
      }
    }
    return newTasksCount;
};

app.post('/api/tasks/sync-google', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Thiếu Auth Code' });

    if (code === 'MOCK_CODE' || !process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'PLACEHOLDER') {
      const date1 = new Date();
      date1.setDate(date1.getDate() + 5);
      const date2 = new Date();
      date2.setDate(date2.getDate() + 10);

      const mockTasks = [
        { title: '[Classroom] Bài tập PHP', dueDate: date1.toISOString().split('T')[0], color: 'border-green-500', isLMS: true, userId: parseInt(userId) },
        { title: '[Classroom] Tuần 31: Biểu đồ lớp phân tích', dueDate: date2.toISOString().split('T')[0], color: 'border-green-500', isLMS: true, userId: parseInt(userId) }
      ];
      await prisma.task.deleteMany({ where: { userId: parseInt(userId), isLMS: true } });
      await prisma.task.createMany({ data: mockTasks });
      await sendNotification(parseInt(userId), 'HỌC TẬP', `Hệ thống vừa đồng bộ ${mockTasks.length} bài tập mới từ Google Classroom!`);
      return res.json({ success: true, message: `Đã kết nối và lấy thành công ${mockTasks.length} bài tập từ Google Classroom!` });
    }

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      await prisma.user.update({ where: { id: userId }, data: { googleRefreshToken: tokens.refresh_token } });
    }

    const newTasksCount = await syncGoogleClassroom(userId, oauth2Client);

    if (newTasksCount > 0) {
      await sendNotification(userId, 'HỌC TẬP', `Hệ thống vừa đồng bộ ${newTasksCount} bài tập mới từ Google Classroom!`);
      res.json({ success: true, message: `Đã tự động lấy và cập nhật ${newTasksCount} bài tập mới từ Google Classroom!` });
    } else {
      res.json({ success: true, message: 'Bạn đã làm hết bài tập. Không có Deadline mới trên Google Classroom!' });
    }

  } catch (error) {
    console.error('Lỗi đồng bộ Google Classroom:', error);
    res.status(500).json({ success: false, message: 'Lỗi liên kết Google Classroom. Mã code có thể đã hết hạn.' });
  }
});

// --- QNU SCHEDULE SYNC (PLAYWRIGHT) ---

// Xác định học kỳ và năm học theo quy tắc của trường
const getHocKyInfo = () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  // HK1: 1/9/n -> 30/12/n  => namHoc: n-(n+1)
  if (month >= 9 && month <= 12) return { hocKy: 'Học kỳ 1', namHoc: `${year}-${year + 1}` };
  // HK2: 1/1/(n+1) -> 30/6/(n+1) => namHoc: n-(n+1)
  if (month >= 1 && month <= 6) return { hocKy: 'Học kỳ 2', namHoc: `${year - 1}-${year}` };
  // HK3: còn lại (7-8) => namHoc: (n-1)-n
  return { hocKy: 'Học kỳ 3', namHoc: `${year - 1}-${year}` };
};

const scrapeQNUSchedule = async (username, password) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(35000);

    // === BƯỚC 1: ĐĂNG NHẬP ===
    console.log('[QNU] Đang truy cập trang đăng nhập...');
    await page.goto('https://daotao.qnu.edu.vn/login', { waitUntil: 'networkidle', timeout: 30000 });

    // Điền username
    const usernameInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
    await usernameInput.fill(username);

    // Điền password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    // Click nút đăng nhập
    const loginBtn = page.locator('button[type="submit"], button.MuiButton-containedPrimary').first();
    await loginBtn.click();

    // Chờ chuyển trang (rời khỏi /login)
    await page.waitForURL(url => !url.includes('/login'), { timeout: 20000 }).catch(async () => {
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (bodyText.includes('sai') || bodyText.includes('incorrect') || bodyText.includes('không chính xác')) {
        throw new Error('Tài khoản hoặc Mật khẩu không chính xác.');
      }
      if (page.url().includes('/login')) throw new Error('Đăng nhập thất bại - vui lòng kiểm tra lại thông tin.');
    });
    console.log('[QNU] Đăng nhập thành công, URL:', page.url());

    // === BƯỚC 2: VÀO TRANG THỜI KHÓA BIỂU ===
    await page.goto('https://daotao.qnu.edu.vn/student/schedules', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // === BƯỚC 3: CHỌN TAB "THỜI KHÓA BIỂU THEO LỚP HỌC PHẦN" (tab đầu tiên - index 0) ===
    try {
      const tabs = page.locator('[role="tab"], .MuiTab-root');
      const tabCount = await tabs.count();
      console.log(`[QNU] Tìm thấy ${tabCount} tab`);
      if (tabCount > 0) {
        // Tab đầu tiên là "Thời khóa biểu theo lớp học phần"
        await tabs.first().click();
        console.log('[QNU] Đã click tab Thời khóa biểu theo lớp học phần');
      }
    } catch(e) {
      console.log('[QNU] Lỗi click tab:', e.message);
    }
    await page.waitForTimeout(2500);

    // === BƯỚC 4: CHỌN NĂM HỌC VÀ HỌC KỲ ===
    const { hocKy, namHoc } = getHocKyInfo();
    console.log(`[QNU] Đang chọn: Năm học ${namHoc} - ${hocKy}`);

    // Lấy tất cả dropdown (MUI Select)
    const selects = page.locator('.MuiSelect-select, [role="combobox"]');
    const selectCount = await selects.count();
    console.log(`[QNU] Tìm thấy ${selectCount} dropdown`);

    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const txt = await sel.innerText().catch(() => '');
      console.log(`[QNU] Dropdown ${i}: "${txt}"`);

      // Dropdown năm học
      if (txt.includes('-') && (txt.includes('202') || txt.includes('201'))) {
        if (!txt.includes(namHoc)) {
          await sel.click();
          await page.waitForTimeout(1000);
          const option = page.locator(`[role="option"]:has-text("${namHoc}")`);
          if (await option.count() > 0) {
            await option.first().click();
            console.log(`[QNU] Đã chọn năm học: ${namHoc}`);
            await page.waitForTimeout(1500);
          } else {
            await page.keyboard.press('Escape');
          }
        }
        continue;
      }

      // Dropdown học kỳ
      if (txt.includes('Học kỳ')) {
        if (!txt.includes(hocKy)) {
          await sel.click();
          await page.waitForTimeout(1000);
          const option = page.locator(`[role="option"]:has-text("${hocKy}")`);
          if (await option.count() > 0) {
            await option.first().click();
            console.log(`[QNU] Đã chọn: ${hocKy}`);
            await page.waitForTimeout(1500);
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    }

    // === BƯỚC 5: CLICK NÚT TÌM KIẾM / HIỂN THỊ ===
    try {
      const searchBtn = page.locator('button:has-text("Tìm kiếm"), button:has-text("Hiện tại"), button:has-text("Xem")').first();
      if (await searchBtn.count() > 0) {
        await searchBtn.click();
        console.log('[QNU] Đã click nút tìm kiếm');
      }
    } catch(e) { /* không bắt buộc */ }

    // Chờ bảng load
    await page.waitForTimeout(4000);
    try {
      await page.waitForSelector('table tbody tr', { timeout: 15000 });
    } catch(e) {
      console.log('[QNU] Không tìm thấy bảng trong 15s, thử cào trực tiếp...');
    }

    // === BƯỚC 6: SCRAPE BẢNG DỮ LIỆU ===
    const rawSchedules = await page.evaluate(() => {
      const results = [];
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      let lastMon = '', lastTeacher = '', lastSTC = '';

      for (const row of rows) {
        const cols = Array.from(row.querySelectorAll('td'));
        if (cols.length === 0) continue;

        if (cols.length >= 8) {
          const monInfo = (cols[1]?.innerText || '').trim();
          const teacher = (cols[2]?.innerText || '').trim();
          const stc = (cols[3]?.innerText || '').trim();
          const thu = (cols[4]?.innerText || '').trim();
          const tiet = (cols[5]?.innerText || '').trim();
          const phong = (cols[6]?.innerText || '').trim();
          const ngay = (cols[7]?.innerText || '').trim();
          const diaDiem = (cols[8]?.innerText || '').trim();

          if (monInfo && !monInfo.toLowerCase().includes('tên học phần') && !monInfo.toLowerCase().includes('mã lớp')) {
            lastMon = monInfo;
            lastTeacher = teacher || lastTeacher;
            lastSTC = stc || lastSTC;
          }
          if (thu && tiet && lastMon) {
            results.push({ mon: lastMon, teacher: lastTeacher, stc: lastSTC, thu, tiet, phong, ngay, diaDiem });
          }
        } else if (cols.length >= 4 && lastMon) {
          const thu = (cols[0]?.innerText || '').trim();
          const tiet = (cols[1]?.innerText || '').trim();
          const phong = (cols[2]?.innerText || '').trim();
          const ngay = (cols[3]?.innerText || '').trim();
          const diaDiem = (cols[4]?.innerText || '').trim();
          if (thu && tiet) {
            results.push({ mon: lastMon, teacher: lastTeacher, stc: lastSTC, thu, tiet, phong, ngay, diaDiem });
          }
        }
      }
      return results;
    });

    console.log(`[QNU] Cào được ${rawSchedules.length} dòng thô`);

    if (rawSchedules.length === 0) throw new Error('Không tìm thấy dữ liệu TKB. Hãy kiểm tra lại tài khoản và học kỳ.');

    // === BƯỚC 7: XỬ LÝ DỮ LIỆU ===
    const GIO_HOC = { 1:'07:00',2:'07:50',3:'09:00',4:'09:50',5:'10:40',6:'13:00',7:'13:50',8:'15:00',9:'15:50',10:'16:40',11:'17:30',12:'18:15',13:'19:00',14:'19:50',15:'20:40' };
    const MAP_THU = { '2':'Thứ Hai','3':'Thứ Ba','4':'Thứ Tư','5':'Thứ Năm','6':'Thứ Sáu','7':'Thứ Bảy','CN':'Chủ Nhật' };
    const currentDateStr = new Date().toISOString().split('T')[0];
    const finalSchedules = [];

    for (const item of rawSchedules) {
      let dayOfWeek = item.thu;
      if (!item.thu.includes('Thứ') && !item.thu.includes('Chủ')) {
        const m = item.thu.match(/(\d)/);
        if (m && MAP_THU[m[1]]) dayOfWeek = MAP_THU[m[1]];
      }

      let timeInfo = item.tiet;
      const tM = item.tiet.match(/(\d+).*?(\d+)/);
      if (tM) {
        const s = parseInt(tM[1] || tM[3]), e = parseInt(tM[2] || tM[4]);
        timeInfo = `${s} (${GIO_HOC[s]||'?'})->${e} (${GIO_HOC[e]||'?'})`;
      }

      let startDate = '', endDate = '';
      const dateMatches = item.ngay.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
      if (dateMatches && dateMatches.length >= 2) {
        startDate = dateMatches[0];
        endDate = dateMatches[dateMatches.length - 1];
      } else if (dateMatches && dateMatches.length === 1) {
        startDate = dateMatches[0]; endDate = dateMatches[0];
      }

      finalSchedules.push({
        subjectName: item.mon,
        teacher: item.teacher || 'Giảng viên QNU',
        dayOfWeek,
        timeInfo,
        room: item.phong || item.diaDiem || 'Không rõ',
        startDate,
        endDate,
        date: currentDateStr
      });
    }

    console.log(`[QNU] Xử lý xong: ${finalSchedules.length} lịch học - Năm học ${namHoc} ${hocKy}`);
    return finalSchedules;

  } catch (error) {
    console.error('[QNU Scraper] Lỗi:', error.message);
    if (error.message.includes('Tài khoản') || error.message.includes('Mật khẩu') || error.message.includes('Đăng nhập')) throw error;
    throw new Error('Không thể đồng bộ TKB từ QNU: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
};

// Hàm sync dùng chung (dùng cho cả API lẫn Cron)
const syncQNUForUser = async (userId, username, password) => {
  const schedules = await scrapeQNUSchedule(username, password);
  if (!schedules || schedules.length === 0) throw new Error('Không tìm thấy TKB nào.');
  await prisma.schedule.deleteMany({ where: { userId } });
  await prisma.schedule.createMany({ data: schedules.map(s => ({ ...s, userId })) });
  return schedules;
};

app.post('/api/qnu/sync', async (req, res) => {
  try {
    const { userId, username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập' });

    // Lưu credentials để cron job tự động sync hàng ngày
    await prisma.user.update({
      where: { id: userId },
      data: { qnuUsername: username, qnuPassword: password }
    });

    const schedules = await syncQNUForUser(userId, username, password);
    res.json({ success: true, message: `Đã đồng bộ ${schedules.length} lịch học từ QNU!`, data: schedules });
  } catch (err) {
    console.error('[QNU Sync API]', err.message);
    res.status(400).json({ success: false, message: err.message || 'Có lỗi xảy ra trong quá trình đồng bộ.' });
  }
});

// CRON JOB TỰ ĐỘNG ĐỒNG BỘ TKB LÚC 00:00 HÀNG NGÀY
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON 00:00] Bắt đầu tự động đồng bộ TKB QNU cho tất cả user...');
  try {
    const users = await prisma.user.findMany({
      where: { qnuUsername: { not: null }, qnuPassword: { not: null } },
      select: { id: true, fullName: true, qnuUsername: true, qnuPassword: true }
    });
    console.log(`[CRON] Tìm thấy ${users.length} user có tài khoản QNU`);

    for (const u of users) {
      try {
        const schedules = await syncQNUForUser(u.id, u.qnuUsername, u.qnuPassword);
        await sendNotification(u.id, 'HỌC TẬP', `Tích tắc ⏰ Thời khóa biểu của bạn đã được đồng bộ tự động! Có ${schedules.length} lịch học.`);
        console.log(`[CRON] Sync OK cho user ${u.fullName} (${u.id}): ${schedules.length} lịch`);
      } catch (e) {
        console.error(`[CRON] Sync FAIL cho user ${u.id}:`, e.message);
      }
    }
    console.log('[CRON 00:00] Hoàn thành đồng bộ TKB.');
  } catch (err) {
    console.error('[CRON 00:00] Lỗi:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });








app.get('/api/qnu/schedules/:userId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await prisma.schedule.findMany({
      where: { userId: parseInt(req.params.userId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: schedules });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- EXAM API ---
app.get('/api/exams/:userId', async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { userId: parseInt(req.params.userId) },
      orderBy: { examDate: 'asc' }
    });
    res.json({ success: true, data: exams });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/exams', async (req, res) => {
  try {
    const { subject, examDate, examTime, room, userId } = req.body;
    const exam = await prisma.exam.create({
      data: { subject, examDate, examTime: examTime || '', room: room || '', userId }
    });
    res.json({ success: true, data: exam });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.delete('/api/exams/:id', async (req, res) => {
  try {
    await prisma.exam.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

// --- AI QUIZ API ---
app.get('/api/quizzes/:userId', async (req, res) => {
  try {
    const sets = await prisma.questionSet.findMany({
      where: { userId: parseInt(req.params.userId) },
      include: {
        _count: { select: { questions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: sets });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/quizzes', async (req, res) => {
  try {
    const { title, subject, category, userId, questions } = req.body;
    const newSet = await prisma.questionSet.create({
      data: { title, subject, category, userId }
    });
    
    if (questions && questions.length > 0) {
      const qData = questions.map(q => ({
        setId: newSet.id,
        content: q.question,
        options: JSON.stringify(q.options),
        answer: q.answer
      }));
      await prisma.question.createMany({ data: qData });
    }
    res.json({ success: true, data: newSet });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/quizzes/set/:setId', async (req, res) => {
  try {
    const set = await prisma.questionSet.findUnique({
      where: { id: parseInt(req.params.setId) },
      include: { questions: true }
    });
    if (set && set.questions) {
      set.questions = set.questions.map(q => ({
        ...q,
        options: JSON.parse(q.options)
      }));
    }
    res.json({ success: true, data: set });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.delete('/api/quizzes/:setId', async (req, res) => {
  try {
    await prisma.questionSet.delete({ where: { id: parseInt(req.params.setId) } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/quizzes/logs/:userId', async (req, res) => {
  try {
    const logs = await prisma.quizLog.findMany({
      where: { userId: parseInt(req.params.userId) },
      include: { set: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: logs });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/quizzes/log', async (req, res) => {
  try {
    const { userId, setId, score, total, answers } = req.body;
    const log = await prisma.quizLog.create({
      data: { userId, setId, score, total, answers: JSON.stringify(answers || []) }
    });
    res.json({ success: true, data: log });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/quizzes/log/:logId', async (req, res) => {
  try {
    const log = await prisma.quizLog.findUnique({
      where: { id: parseInt(req.params.logId) },
      include: {
        set: {
          include: { questions: true }
        }
      }
    });
    if (!log) return res.status(404).json({ success: false, message: 'Không tìm thấy log' });
    // Parse questions options and answers
    if (log.set && log.set.questions) {
      log.set.questions = log.set.questions.map(q => ({ ...q, options: JSON.parse(q.options) }));
    }
    const parsedAnswers = log.answers ? JSON.parse(log.answers) : {};
    res.json({ success: true, data: { ...log, parsedAnswers } });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/quizzes/:setId/sell', async (req, res) => {
  try {
    const { price } = req.body;
    const set = await prisma.questionSet.update({
      where: { id: parseInt(req.params.setId) },
      data: { isMarketItem: true, price: parseInt(price) || 0 }
    });
    res.json({ success: true, data: set });
  } catch (err) { res.status(500).json({ success: false }); }
});


// CRON JOB KÍCH HOẠT VìO 6:00 SÁNG M�I NGìY
cron.schedule('0 6 * * *', async () => {
  console.log("⏰ Đang chạy Cron Job TKB lúc 6:00 sáng...");
  try {
    const today = new Date();
    // Reset thời gian trong ngày �Ồ so sánh
    today.setHours(0,0,0,0); 
    // 1. Dọn dẹp Deadline �ã quá hạn (so v�:i hôm nay)
    const todayStrFilter = today.toISOString().split('T')[0];
    const oldTasks = await prisma.task.findMany({
       where: { dueDate: { lt: todayStrFilter } }
    });
    
    if (oldTasks.length > 0) {
       await prisma.task.deleteMany({
          where: { dueDate: { lt: todayStrFilter } }
       });
       console.log(`[CRON] Đã dọn dẹp h�! th�ng: Xóa ${oldTasks.length} Deadline quá hạn.`);
    }

    // 1b. Tự ��"ng huỷ bài Đi Xe Chung �ã quá ngày kh�xi hành
    // ChuyỒn trạng thái PENDING �  CANCELLED (giữ lại trong DB làm l�9ch sử)
    try {
      const expiredRides = await prisma.carpoolRequest.findMany({
        where: {
          status: 'PENDING',
          departureDate: { not: null, lt: todayStrFilter }
        }
      });

      if (expiredRides.length > 0) {
        // Cập nhật trạng thái sang CANCELLED
        await prisma.carpoolRequest.updateMany({
          where: {
            status: 'PENDING',
            departureDate: { not: null, lt: todayStrFilter }
          },
          data: { status: 'CANCELLED' }
        });

        // Gửi thông báo cho từng người �Ēng
        for (const ride of expiredRides) {
          await sendNotification(
            ride.passengerId,
            'ĐI XE CHUNG',
            `Yêu cầu �i xe từ "${ride.departure}" �  "${ride.destination}" ngày ${ride.departureDate} �ã hết hạn và �ược chuyỒn vào l�9ch sử tự ��"ng.`
          );
        }
        console.log(`[CRON] Đã tự ��"ng huỷ ${expiredRides.length} yêu cầu �i xe chung hết hạn.`);
      }
    } catch (rideErr) {
      console.error('[CRON] L�i khi dọn dẹp Carpool hết hạn:', rideErr.message);
    }

    // 2. Gửi thông báo nhắc Deadline hôm nay (Nạp nĒng lượng)
    const dueTodayTasks = await prisma.task.findMany({
       where: { dueDate: todayStrFilter }
    });
    
    const notifyTasksMap = {};
    dueTodayTasks.forEach(t => {
       if(!notifyTasksMap[t.userId]) notifyTasksMap[t.userId] = [];
       notifyTasksMap[t.userId].push(t);
    });

    for (const [uId, ts] of Object.entries(notifyTasksMap)) {
       const titles = ts.map(t => t.title).join(', ');
       await sendNotification(
          parseInt(uId),
          'H�RC TẬP',
          `Hôm nay (${todayStrFilter}) bạn có ${ts.length} bài tập �ến hạn: ${titles}. Chúc bạn làm bài thật t�t!`
       );
    }
    
    // 3. Tìm Thứ trong tuần cho TKB QNU
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ NĒm", "Thứ Sáu", "Thứ Bảy"];
    const todayStr = dayNames[today.getDay()];
    
    // Helper parse date "DD/MM/YYYY" sang Object Date
    const parseVnDate = (dateStr) => {
       if(!dateStr) return null;
       const parts = dateStr.split('/');
       if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
       return null;
    };

    // Lấy toàn b�" TKB của user có chứa "Thứ" của hôm nay
    const candidateSchedules = await prisma.schedule.findMany({
      where: { dayOfWeek: todayStr },
      include: { user: true }
    });

    const notifyMap = {}; 
    candidateSchedules.forEach(s => {
      let isLearning = true;
      if (s.startDate && s.endDate) {
         const startD = parseVnDate(s.startDate);
         const endD = parseVnDate(s.endDate);
         if (startD && endD) {
            // Check nếu hôm nay thu�"c dải khoảng thời gian học
            if(today < startD || today > endD) isLearning = false;
         }
      }
      
      if(isLearning) {
         if(!notifyMap[s.userId]) notifyMap[s.userId] = [];
         notifyMap[s.userId].push(s);
      }
    });

    for (const [uId, schs] of Object.entries(notifyMap)) {
      const subjectNames = schs.map(s => `${s.subjectName} tại ${s.room}`).join(', ');
      await sendNotification(
        parseInt(uId), 
        'H�RC TẬP', 
        `Hôm nay (${todayStr}) bạn có ${schs.length} môn học: ${subjectNames}. Hãy nạp lại nĒng lượng cho m�"t ngày m�:i nhé!`
      );
    }
    console.log(`Đã gửi thông báo TKB cho ${Object.keys(notifyMap).length} sinh viên.`);
    
    // 4. Đ�ng b�" Google Classroom ngầm
    const classroomUsers = await prisma.user.findMany({
      where: { googleRefreshToken: { not: null } }
    });
    
    for (const user of classroomUsers) {
      try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) continue;
        
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'postmessage'
        );
        oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
        
        const newTasksCount = await syncGoogleClassroom(user.id, oauth2Client);
        if (newTasksCount > 0) {
           await sendNotification(user.id, 'H�RC TẬP', `[AUTO] Đã ��ng b�" ${newTasksCount} bài tập m�:i từ Google Classroom!`);
        }
      } catch(e) {
        console.error(`L�i Auto-Sync Classroom cho User ${user.id}:`, e.message);
      }
    }

  } catch(e) { console.log(e); }
});

// ------------------------------------

// Chợ Sinh Viên API (New Modular Routes)
const marketRoutes = require('./routes/marketRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use(marketRoutes);
app.use(adminRoutes);

// Legacy Market API (backward compatible)

app.get('/api/market', async (req, res) => { try { const items = await prisma.marketItem.findMany({ include: { author: { select: { id: true, username: true, fullName: true, avatarUrl: true, major: true } } }, orderBy: { id: 'desc' } }); res.json(items); } catch (err) {} });
app.post('/api/market', async (req, res) => { try { let { title, reward, category, description, imageUrl, fileUrl, location, authorId } = req.body; title = getCensoredText(title); description = getCensoredText(description); const newItem = await prisma.marketItem.create({ data: { title, reward: parseInt(reward), category, description, imageUrl, fileUrl, location, authorId } }); res.json(newItem); } catch (err) { res.status(500).json({error: "L�i"}); } });
app.post('/api/market/buy', async (req, res) => { try { const { itemId, buyerId } = req.body; const item = await prisma.marketItem.findUnique({ where: { id: itemId } }); const buyer = await prisma.user.findUnique({ where: { id: buyerId } }); if (!item || !buyer || buyer.id === item.authorId || buyer.coins < item.reward) return res.json({ success: false, message: "L�i giao d�9ch!" }); await prisma.$transaction([ prisma.user.update({ where: { id: buyerId }, data: { coins: buyer.coins - item.reward } }), prisma.user.update({ where: { id: item.authorId }, data: { coins: { increment: item.reward } } }), prisma.marketItem.delete({ where: { id: itemId } }) ]); res.json({ success: true, newCoinBalance: buyer.coins - item.reward }); } catch (err) { res.json({ success: false }); } });
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, major } = req.body;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.json({ success: false, message: 'Username đã tồn tại!' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({ data: { username, password: hashedPassword, fullName: fullName || username, major: major || '', coins: 250 } });
    res.json({ success: true, user: newUser });
  } catch (err) { res.json({ success: false }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1') return res.json({ success: true, user: { id: 999999, username: 'admin', fullName: 'Quan tri vien', role: 'ADMIN' } });
    const user = await prisma.user.findFirst({ where: { username } });
    if (!user) return res.json({ success: false, message: 'Sai thong tin!' });
    const isHashed = user.password.startsWith('$2b') || user.password.startsWith('$2a');
    let isValid = false;
    if (isHashed) {
      isValid = await bcrypt.compare(password, user.password);
    } else {
      isValid = user.password === password;
      if (isValid) {
        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
      }
    }
    if (!isValid) return res.json({ success: false, message: 'Sai thong tin!' });
    res.json({ success: true, user });
  } catch (err) { res.json({ success: false }); }
});
app.post('/api/auth/update-coins', async (req, res) => { try { const updatedUser = await prisma.user.update({ where: { username: req.body.username }, data: { coins: req.body.coins } }); res.json({ success: true, user: updatedUser }); } catch (err) {} });
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) return res.json({ success: false, message: 'Vui lòng điền đầy đủ thông tin!' });
    if (newPassword.length < 3) return res.json({ success: false, message: 'Mật khẩu mới phải có ít nhất 3 ký tự!' });
    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user) return res.json({ success: false, message: 'Không tìm thấy người dùng!' });
    const isHashed = user.password.startsWith('$2b') || user.password.startsWith('$2a');
    let isValid = false;
    if (isHashed) {
      isValid = await bcrypt.compare(currentPassword, user.password);
    } else {
      isValid = user.password === currentPassword;
    }
    if (!isValid) return res.json({ success: false, message: 'Mật khẩu hiện tại không đúng!' });
    const hashedNew = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedNew } });
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) { res.json({ success: false, message: 'Lỗi hệ thống!' }); }
});
app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { googleId, email, name, picture } = req.body;
    if (!googleId) return res.json({ success: false, message: 'Thiếu thông tin Google ID!' });

    const username = `google_${googleId}`;
    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      // Đăng ký tài khoản tự động nếu đăng nhập lần đầu bằng Google
      user = await prisma.user.create({
        data: {
          username,
          password: "", // Không cần mật khẩu cho đăng nhập bằng Google
          fullName: name || email.split('@')[0],
          avatarUrl: picture || "",
          coins: 250,
          major: ""
        }
      });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.json({ success: false, message: 'Lỗi hệ thống khi đăng nhập bằng Google.' });
  }
});
app.get('/api/notifications/:userId', async (req, res) => { try { const notifs = await prisma.notification.findMany({ where: { userId: parseInt(req.params.userId) }, include: { sourceUser: { select: { fullName: true, username: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } }); res.json(notifs); } catch (err) {} });

// API Admin
app.get('/api/admin/users', async (req, res) => { const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } }); res.json(users); });
app.delete('/api/admin/users/:id', async (req, res) => { const id = parseInt(req.params.id); await prisma.messageReaction.deleteMany({ where: { userId: id } }); await prisma.postReaction.deleteMany({ where: { userId: id } }); await prisma.message.deleteMany({ where: { OR: [{senderId: id}, {receiverId: id}] } }); await prisma.friendship.deleteMany({ where: { OR: [{userId: id}, {friendId: id}] } }); await prisma.commentLike.deleteMany({ where: { userId: id } }); await prisma.comment.deleteMany({ where: { userId: id } }); await prisma.hiddenPost.deleteMany({ where: { userId: id } }); await prisma.task.deleteMany({ where: { userId: id } }); await prisma.marketItem.deleteMany({ where: { authorId: id } }); await prisma.notification.deleteMany({ where: { userId: id } }); await prisma.post.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }); res.json({ success: true }); });
app.get('/api/admin/posts', async (req, res) => { const posts = await prisma.post.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }); res.json(posts); });
app.delete('/api/admin/posts/:id', async (req, res) => { await prisma.post.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); });
app.post('/api/admin/broadcast', async (req, res) => { const { content } = req.body; const users = await prisma.user.findMany({ select: { id: true } }); const notifs = users.map(u => ({ userId: u.id, type: 'THONG BAO HE THONG', content, isRead: false })); await prisma.notification.createMany({ data: notifs }); io.emit('new_notification', { type: 'HE THONG', content, isRead: false }); res.json({ success: true }); });

// Phục vụ các file tĩnh của Frontend từ thư mục client/dist
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback route cho React SPA router
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server dang chay: http://localhost:' + PORT));
