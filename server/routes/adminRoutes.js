const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const isAdmin = require('../middleware/admin');

// ============================================
// ADMIN PROTECTED ROUTES
// Middleware isAdmin được áp dụng cho tất cả API bắt đầu bằng /api/admin
// ============================================

// 1. Lấy Dashboard Stats
router.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalPosts = await prisma.post.count();
    const totalMarketItems = await prisma.secondhandItem.count();
    const totalErrands = await prisma.errand.count();
    const totalReports = await prisma.report.count({ where: { status: 'PENDING' } });

    res.json({
      status: 200,
      data: {
        totalUsers,
        totalPosts,
        totalMarketItems,
        totalErrands,
        totalReports
      }
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// Kiểm toán Sổ cái (Ledger Audit)
const LedgerService = require('../services/LedgerService');
router.get('/api/admin/ledger/verify', isAdmin, async (req, res) => {
  try {
    const result = await LedgerService.verifyChain();
    res.json({ status: 200, data: result });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// 2. Lấy danh sách Users
router.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // giới hạn 200 user
    });
    res.json({ status: 200, data: users });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// 3. Khóa/Mở khóa User (Hoặc xóa user) - Hiện tại dùng cách Xóa User (Cascade sẽ xóa mọi thứ)
router.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.adminUser.id) {
       return res.status(400).json({ status: 400, message: "Không thể tự xóa bản thân" });
    }
    await prisma.user.delete({ where: { id: userId } });
    res.json({ status: 200, message: "Đã xóa người dùng thành công" });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// Nâng/Hạ Quyền User
router.put('/api/admin/users/:id/role', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { role }
    });
    res.json({ status: 200, message: `Cập nhật quyền thành ${role}` });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// 4. Quản lý Reports
router.get('/api/admin/reports', isAdmin, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, fullName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 200, data: reports });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// Đánh dấu Report là Đã giải quyết / Từ chối
router.put('/api/admin/reports/:id/resolve', isAdmin, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { status } = req.body; // RESOLVED, REJECTED
    const report = await prisma.report.update({
      where: { id: reportId },
      data: { status }
    });
    res.json({ status: 200, data: report, message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// Xóa đối tượng vi phạm (POST, MARKET_ITEM)
router.delete('/api/admin/content/:type/:id', isAdmin, async (req, res) => {
  try {
    const targetType = req.params.type;
    const targetId = parseInt(req.params.id);

    if (targetType === 'POST' || targetType === 'CONFESSION') {
       await prisma.post.delete({ where: { id: targetId } });
    } else if (targetType === 'MARKET_ITEM') {
       await prisma.secondhandItem.delete({ where: { id: targetId } });
    } else {
       return res.status(400).json({ status: 400, message: "Loại nội dung không hỗ trợ" });
    }
    
    res.json({ status: 200, message: "Đã xóa nội dung vi phạm" });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// ============================================
// PUBLIC ROUTES CHO SINH VIÊN
// ============================================

// Sinh viên báo cáo vi phạm
router.post('/api/reports', async (req, res) => {
  try {
    const { reporterId, targetType, targetId, reason } = req.body;
    if (!reporterId || !targetType || !targetId || !reason) {
      return res.status(400).json({ status: 400, message: "Thiếu thông tin báo cáo" });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason
      }
    });

    res.json({ status: 201, message: "Đã gửi báo cáo thành công", data: report });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

module.exports = router;
