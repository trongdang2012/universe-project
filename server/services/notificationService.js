/**
 * notificationService.js
 * Shared utility để gửi thông báo real-time + lưu DB
 * Được khởi tạo 1 lần với io + onlineUsers từ index.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let _io = null;
let _onlineUsers = null;

function init(io, onlineUsers) {
  _io = io;
  _onlineUsers = onlineUsers;
}

async function sendNotification(userId, type, content, sourceUserId = null, postId = null) {
  const notif = await prisma.notification.create({
    data: { userId, type, content, sourceUserId, postId, isRead: false },
    include: { sourceUser: { select: { fullName: true, username: true, avatarUrl: true } } }
  });
  if (_io && _onlineUsers) {
    const socketId = _onlineUsers.get(userId);
    if (socketId) _io.to(socketId).emit('new_notification', notif);
  }
  return notif;
}

module.exports = { init, sendNotification };
