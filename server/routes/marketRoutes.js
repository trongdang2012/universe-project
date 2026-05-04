/**
 * marketRoutes.js — API Endpoints cho Chợ Sinh Viên
 * 
 * 4 Module: Documents, Errands, Items, Rides
 * Response chuẩn: { status, message, data }
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CoinService = require('../services/coinService');
const ErrandService = require('../services/errandService');
const RideMatchService = require('../services/RideMatchService');
const NotificationService = require('../services/notificationService');

const { PDFDocument } = require('pdf-lib');
const axios = require('axios');

// Helper: Response chuẩn
const apiResponse = (res, status, message, data = null) => {
  return res.status(status).json({ status, message, data });
};

// ============================================
// MODULE 1: TÀI LIỆU (DOCUMENTS)
// ============================================

/**
 * GET /api/documents — Lấy danh sách tài liệu
 * Query: ?type=SELL|BOUNTY&category=...&subject=...
 */
router.get('/api/documents', async (req, res) => {
  try {
    const { type, category, subject } = req.query;
    const where = { status: 'ACTIVE' };
    if (type) where.type = type;
    if (category) where.category = category;
    if (subject) where.subject = { contains: subject };

    const documents = await prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        buyer: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    apiResponse(res, 200, 'Lấy danh sách tài liệu thành công', documents);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * GET /api/documents/my-orders/:userId — Lấy danh sách tài liệu (mua/bán)
 */
router.get('/api/documents/my-orders/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { authorId: userId, status: { in: ['PENDING_DELIVERY', 'SOLD'] } },
          { buyerId: userId, status: { in: ['PENDING_DELIVERY', 'SOLD'] } }
        ]
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        buyer: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    apiResponse(res, 200, 'Lấy danh sách đơn hàng tài liệu thành công', documents);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * POST /api/documents — Đăng bán/Treo thưởng tài liệu
 */
router.post('/api/documents', async (req, res) => {
  try {
    const { title, type, fileUrl, price, subject, lecturer, category, isCombo, description, authorId } = req.body;

    if (!title || !authorId) return apiResponse(res, 400, 'Thiếu thông tin bắt buộc');

    const document = await prisma.document.create({
      data: {
        title,
        type: type || 'SELL',
        fileUrl,
        price: parseInt(price) || 0,
        subject,
        lecturer,
        category,
        isCombo: isCombo || false,
        description,
        authorId
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      }
    });

    apiResponse(res, 201, 'Đăng tài liệu thành công!', document);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

/**
 * POST /api/documents/buy/:id — Mua tài liệu
 * Body: { buyerId }
 */
router.post('/api/documents/buy/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { buyerId } = req.body;

    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return apiResponse(res, 404, 'Tài liệu không tồn tại');
    if (doc.status !== 'ACTIVE') return apiResponse(res, 400, 'Tài liệu đã được mua hoặc đóng');
    if (doc.authorId === buyerId) return apiResponse(res, 400, 'Không thể mua tài liệu của chính mình');

    // Cập nhật trạng thái
    await prisma.document.update({
      where: { id: docId },
      data: { status: 'SOLD', buyerId }
    });

    apiResponse(res, 200, `Thỏa thuận mua tài liệu thành công! Các bên vui lòng tự thanh toán với nhau.`, {
      fileUrl: doc.fileUrl,
      newBalance: 0
    });
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * POST /api/documents/confirm-sale/:id — Xác nhận bán/mua (2 chiều)
 * Body: { userId, role: 'seller' | 'buyer', partnerId }
 */
router.post('/api/documents/confirm-sale/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { userId, role, partnerId } = req.body;

    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return apiResponse(res, 404, 'Tài liệu không tồn tại');
    if (doc.status === 'SOLD') return apiResponse(res, 400, 'Giao dịch đã hoàn thành');

    let updateData = {};

    if (role === 'seller') {
      if (doc.authorId !== userId) return apiResponse(res, 403, 'Bạn không phải người bán tài liệu này');
      updateData.sellerConfirmed = true;
      if (partnerId) updateData.buyerId = partnerId; // ghi nhận người mua = người đang chat cùng
    } else if (role === 'buyer') {
      updateData.buyerConfirmed = true;
      if (partnerId) updateData.buyerId = userId; // ghi nhận người mua là chính mình
    }

    // Kiểm tra sau khi update: nếu cả 2 đã xác nhận → SOLD
    const currentDoc = { ...doc, ...updateData };
    if (currentDoc.sellerConfirmed && currentDoc.buyerConfirmed) {
      updateData.status = 'SOLD';
    }

    await prisma.document.update({ where: { id: docId }, data: updateData });

    const isDone = updateData.status === 'SOLD';
    apiResponse(res, 200, isDone
      ? 'Giao dịch hoàn thành! Tài liệu đã được ẩn khỏi danh sách.'
      : role === 'seller'
        ? 'Bạn đã xác nhận bán. Chờ người mua xác nhận để hoàn thành giao dịch.'
        : 'Bạn đã xác nhận mua. Chờ người bán xác nhận để hoàn thành giao dịch.',
      { isDone }
    );
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});


/**
 * PUT /api/documents/:id — Sửa thông tin tài liệu
 */
router.put('/api/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { title, fileUrl, price, subject, lecturer, category, isCombo, description, authorId } = req.body;

    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return apiResponse(res, 404, 'Tài liệu không tồn tại');
    if (doc.authorId !== authorId) return apiResponse(res, 403, 'Bạn không có quyền sửa tài liệu này');

    const updatedDoc = await prisma.document.update({
      where: { id: docId },
      data: {
        title, fileUrl, price: parseInt(price) || 0, subject, lecturer, category, isCombo, description
      }
    });

    apiResponse(res, 200, 'Cập nhật tài liệu thành công!', updatedDoc);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

/**
 * DELETE /api/documents/:id — Xóa tài liệu (chỉ chủ bài, khi còn ACTIVE)
 * Body: { authorId }
 */
router.delete('/api/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { authorId } = req.body;

    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return apiResponse(res, 404, 'Tài liệu không tồn tại');
    if (doc.authorId !== parseInt(authorId)) return apiResponse(res, 403, 'Bạn không có quyền xóa tài liệu này');
    if (doc.status !== 'ACTIVE') return apiResponse(res, 400, 'Không thể xóa tài liệu đã được bán hoặc đang xử lý');

    await prisma.document.delete({ where: { id: docId } });

    apiResponse(res, 200, 'Đã xóa tài liệu thành công!');
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});


/**
 * GET /api/documents/preview/:id — Trả về 1-2 trang đầu để Preview PDF
 */
router.get('/api/documents/preview/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document || !document.fileUrl) return res.status(404).send('Không tìm thấy file');

    let fetchUrl = document.fileUrl;
    if (fetchUrl.startsWith('/')) fetchUrl = `http://localhost:5000${fetchUrl}`;
    else if (!fetchUrl.startsWith('http')) fetchUrl = `http://localhost:5000/${fetchUrl}`;

    try {
      const response = await axios.get(fetchUrl, { responseType: 'arraybuffer' });
      // Chỉ áp dụng cắt trang cho file PDF
      if (document.fileUrl.toLowerCase().endsWith('.pdf')) {
        const pdfDoc = await PDFDocument.load(response.data, { ignoreEncryption: true });
        const numPages = pdfDoc.getPageCount();
        
        const newPdf = await PDFDocument.create();
        const pagesToCopy = numPages > 1 ? [0, 1] : [0];
        const copiedPages = await newPdf.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="preview_${docId}.pdf"`);
        return res.send(Buffer.from(pdfBytes));
      } else {
        // Đã là file tĩnh ko phải PDF
        res.setHeader('Content-Type', response.headers['content-type']);
        return res.send(response.data);
      }
    } catch (err) {
      if (fetchUrl.match(/\.(jpeg|jpg|png|gif)$/i)) {
        return res.redirect(fetchUrl); 
      }
      return res.status(500).send('Lỗi khi tải hoặc cắt tài liệu để preview: ' + err.message);
    }
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// ============================================
// MODULE 2: MUA HỘ (ERRANDS) — Logic phức tạp nhất
// ============================================

/**
 * GET /api/errands/pending — Lấy danh sách đơn đang chờ
 * Query: ?category=FOOD|PRINT|PICKUP
 */
router.get('/api/errands/pending', async (req, res) => {
  try {
    const { category } = req.query;
    const where = { status: 'PENDING' };
    if (category) where.category = category;

    const dbErrands = await prisma.errand.findMany({
      where,
      include: {
        requester: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const validErrands = [];
    const now = Date.now();
    for (const errand of dbErrands) {
      if (now - new Date(errand.createdAt).getTime() > 60 * 60 * 1000) {
         try {
           await ErrandService.cancelErrand(errand.id, errand.requesterId);
         } catch(e) {
           console.error('Auto cancel errand error:', e.message);
         }
      } else {
         validErrands.push(errand);
      }
    }

    apiResponse(res, 200, 'Lấy danh sách đơn mua hộ thành công', validErrands);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * GET /api/errands/my/:userId — Lấy đơn của user (nhờ + nhận)
 */
router.get('/api/errands/my/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const requested = await prisma.errand.findMany({
      where: { requesterId: userId },
      include: {
        runner: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const running = await prisma.errand.findMany({
      where: { runnerId: userId },
      include: {
        requester: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    apiResponse(res, 200, 'OK', { requested, running });
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * POST /api/errands — Tạo đơn nhờ mua hộ (Lock Coin)
 */
router.post('/api/errands', async (req, res) => {
  try {
    const { title, category, locationBuy, locationDrop, distance, fee, tipAmount, requesterId } = req.body;

    if (!title || !locationBuy || !locationDrop || !requesterId) {
      return apiResponse(res, 400, 'Thiếu thông tin bắt buộc');
    }

    const errand = await ErrandService.createErrand({
      title,
      category,
      locationBuy,
      locationDrop,
      distance: distance ? parseFloat(distance) : null,
      fee: parseInt(fee) || 0,
      tipAmount: parseInt(tipAmount) || 0,
      requesterId
    });

    apiResponse(res, 201, `Tạo đơn mua hộ thành công!`, errand);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/accept/:id — Runner nhận đơn
 * Body: { runnerId }
 */
router.put('/api/errands/accept/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { runnerId } = req.body;

    const errand = await ErrandService.acceptErrand(errandId, runnerId);
    apiResponse(res, 200, 'Nhận đơn thành công!', errand);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/excuse/:id — Người nhận xin thông cảm trễ
 */
router.put('/api/errands/excuse/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { runnerId } = req.body;
    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) return apiResponse(res, 404, 'Đơn không tồn tại');
    if (errand.runnerId !== runnerId) return apiResponse(res, 403, 'Bạn không phải người nhận đơn này');
    if (errand.status !== 'ACCEPTED') return apiResponse(res, 400, 'Không thể xin thông cảm ở trạng thái này');

    const updated = await prisma.errand.update({
      where: { id: errandId },
      data: { excuseRequested: true }
    });
    apiResponse(res, 200, 'Đã gửi yêu cầu xin thông cảm!', updated);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/excuse-resolve/:id — Người nhờ mua duyệt xin thông cảm
 * Body: { requesterId, action: 'ACCEPT' | 'CANCEL' }
 */
router.put('/api/errands/excuse-resolve/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { requesterId, action } = req.body;
    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) return apiResponse(res, 404, 'Đơn không tồn tại');
    if (errand.requesterId !== requesterId) return apiResponse(res, 403, 'Bạn không phải chủ đơn');
    
    if (action === 'ACCEPT') {
       const updated = await prisma.errand.update({
         where: { id: errandId },
         data: { excused: true }
       });
       return apiResponse(res, 200, 'Đã thông cảm cho shipper!', updated);
    } else if (action === 'CANCEL') {
       const updated = await prisma.errand.update({
         where: { id: errandId },
         data: { status: 'CANCELLED' }
       });
       return apiResponse(res, 200, 'Đã hủy đơn vui vẻ!', updated);
    } else {
       return apiResponse(res, 400, 'Action không hợp lệ');
    }
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/deliver/:id — Người nhận báo đang giao hàng
 */
router.put('/api/errands/deliver/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { runnerId } = req.body;

    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) return apiResponse(res, 404, 'Đơn không tồn tại');
    if (errand.runnerId !== runnerId) return apiResponse(res, 403, 'Bạn không phải người nhận đơn này');
    if (errand.status !== 'ACCEPTED') return apiResponse(res, 400, 'Chỉ có thể chuyển sang Đang giao khi đơn ở trạng thái Đã nhận');

    const updatedErrand = await prisma.errand.update({
      where: { id: errandId },
      data: { status: 'DELIVERING' }
    });

    apiResponse(res, 200, 'Đã cập nhật trạng thái: Đang giao hàng!', updatedErrand);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/complete/:id — Xác nhận hoàn thành
 * Body: { requesterId }
 */
router.put('/api/errands/complete/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { requesterId } = req.body;

    const errand = await ErrandService.completeErrand(errandId, requesterId);
    apiResponse(res, 200, `Đơn hoàn thành! Các bên vui lòng tự thanh toán thực tế với nhau.`, errand);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/cancel/:id — Hủy đơn
 * Body: { userId }
 */
router.put('/api/errands/cancel/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { userId } = req.body;

    const errand = await ErrandService.cancelErrand(errandId, userId);
    apiResponse(res, 200, 'Đơn đã bị hủy thành công.', errand);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/errands/:id — Sửa thông tin đơn nhờ mua (với điều kiện PENDING)
 * Cập nhật route này để người dùng sửa các trường text cơ bản (tiêu đề, nơi mua, nơi giao)
 * Không cho phép sửa coin/tip để tránh lỗi lệch số dư
 */
router.put('/api/errands/:id', async (req, res) => {
  try {
    const errandId = parseInt(req.params.id);
    const { title, locationBuy, locationDrop, userId } = req.body;

    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) return apiResponse(res, 404, 'Đơn không tồn tại');
    if (errand.requesterId !== userId) return apiResponse(res, 403, 'Không có quyền sửa đơn này');
    if (errand.status !== 'PENDING') return apiResponse(res, 400, 'Chỉ có thể sửa đơn khi chưa có người nhận!');

    const updated = await prisma.errand.update({
      where: { id: errandId },
      data: {
        title: title || errand.title,
        locationBuy: locationBuy || errand.locationBuy,
        locationDrop: locationDrop || errand.locationDrop
      }
    });

    apiResponse(res, 200, 'Cập nhật đơn thành công!', updated);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

// ============================================
// MODULE 3: ĐỒ CŨ (SECONDHAND ITEMS)
// ============================================

/**
 * GET /api/items — Lấy danh sách đồ cũ
 * Query: ?category=books|electronics|clothes|room&tradeType=SELL|BARTER
 */
router.get('/api/items', async (req, res) => {
  try {
    const { category, tradeType } = req.query;
    const where = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (tradeType) where.tradeType = tradeType;

    const items = await prisma.secondhandItem.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        tradeProposals: {
          include: {
            proposer: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    apiResponse(res, 200, 'Lấy danh sách sản phẩm thành công', items);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * POST /api/items — Đăng bán/đổi sản phẩm
 */
router.post('/api/items', async (req, res) => {
  try {
    const { name, condition, images, tradeType, price, exchangeWanted, category, description, ownerId } = req.body;

    if (!name || !ownerId) return apiResponse(res, 400, 'Thiếu thông tin bắt buộc');

    const item = await prisma.secondhandItem.create({
      data: {
        name,
        condition: condition || 'USED',
        images: images ? JSON.stringify(images) : null,
        tradeType: tradeType || 'SELL',
        price: parseInt(price) || 0,
        exchangeWanted,
        category,
        description,
        ownerId
      },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      }
    });

    apiResponse(res, 201, 'Đăng sản phẩm thành công!', item);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

/**
 * POST /api/items/buy/:id — Đề nghị Mua đồ cũ bằng Coin
 * Body: { buyerId }
 */
router.post('/api/items/buy/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { buyerId } = req.body;

    const item = await prisma.secondhandItem.findUnique({ where: { id: itemId } });
    if (!item) return apiResponse(res, 404, 'Sản phẩm không tồn tại');
    if (item.status !== 'ACTIVE') return apiResponse(res, 400, 'Sản phẩm đã bán hoặc đóng');
    if (item.tradeType !== 'SELL') return apiResponse(res, 400, 'Sản phẩm này chỉ trao đổi, không bán');
    if (item.ownerId === buyerId) return apiResponse(res, 400, 'Không thể mua đồ của chính mình');

    const proposal = await prisma.tradeProposal.create({
      data: {
        itemId,
        proposerId: buyerId,
        proposalText: `Tôi muốn mua sản phẩm này với giá ${item.price} Coin!`,
        status: 'PENDING'
      },
      include: {
        proposer: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        item: true
      }
    });

    apiResponse(res, 201, 'Đã gửi lời đề nghị mua! Xin chờ người bán xác nhận.', proposal);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/items/accept-trade/:proposalId — Chấp nhận đề nghị Mua / Trao đổi
 * Body: { sellerId }
 */
router.put('/api/items/accept-trade/:proposalId', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    const { sellerId } = req.body;

    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: proposalId },
      include: { item: true }
    });
    if (!proposal) return apiResponse(res, 404, 'Không tìm thấy đề nghị mua/đổi này');
    if (proposal.status !== 'PENDING') return apiResponse(res, 400, 'Yêu cầu này không còn hiệu lực');
    
    const item = proposal.item;
    if (item.ownerId !== sellerId) return apiResponse(res, 403, 'Bạn không phải là chủ sản phẩm này');
    if (item.status !== 'ACTIVE') return apiResponse(res, 400, 'Sản phẩm đã được bán hoặc giao dịch trước đó');

    // Giao dịch không trừ Coin trực tiếp, để user tự trả thực tế

    // Cập nhật Product -> SOLD
    await prisma.secondhandItem.update({
      where: { id: item.id },
      data: { status: 'SOLD' }
    });

    // Cập nhật Proposal -> ACCEPTED
    const updatedProposal = await prisma.tradeProposal.update({
      where: { id: proposalId },
      data: { status: 'ACCEPTED' },
      include: { proposer: { select: { id: true, fullName: true, username: true } }, item: true }
    });

    // Cập nhật các Proposal khác -> REJECTED
    await prisma.tradeProposal.updateMany({
      where: { itemId: item.id, id: { not: proposalId } },
      data: { status: 'REJECTED' }
    });

    apiResponse(res, 200, 'Chấp nhận giao dịch thành công!', updatedProposal);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/items/:id — Cập nhật sản phẩm cá nhân
 */
router.put('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { name, condition, images, tradeType, price, exchangeWanted, category, description, ownerId } = req.body;

    const item = await prisma.secondhandItem.findUnique({ where: { id: itemId } });
    if (!item) return apiResponse(res, 404, 'Sản phẩm không tồn tại');
    if (item.ownerId !== parseInt(ownerId)) return apiResponse(res, 403, 'Bạn không có quyền sửa sản phẩm này');

    const updatedItem = await prisma.secondhandItem.update({
      where: { id: itemId },
      data: {
        name: name || item.name,
        condition: condition || item.condition,
        images: images ? JSON.stringify(images) : item.images,
        tradeType: tradeType || item.tradeType,
        price: parseInt(price) >= 0 ? parseInt(price) : item.price,
        exchangeWanted: exchangeWanted !== undefined ? exchangeWanted : item.exchangeWanted,
        category: category || item.category,
        description: description !== undefined ? description : item.description,
      }
    });

    apiResponse(res, 200, 'Cập nhật sản phẩm thành công!', updatedItem);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi cập nhật: ' + err.message);
  }
});

/**
 * DELETE /api/items/:id — Xóa sản phẩm cá nhân
 */
router.delete('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { ownerId } = req.body;

    const item = await prisma.secondhandItem.findUnique({ where: { id: itemId } });
    if (!item) return apiResponse(res, 404, 'Sản phẩm không tồn tại');
    if (item.ownerId !== parseInt(ownerId)) return apiResponse(res, 403, 'Bạn không có quyền xoá sản phẩm này');

    // Soft delete bằng cách đổi status HOẶC Delete cứng vì Prisma thiết lập Cascade trên TradeProposal
    await prisma.secondhandItem.delete({ where: { id: itemId } });

    apiResponse(res, 200, 'Xoá sản phẩm thành công!');
  } catch (err) {
    apiResponse(res, 500, 'Lỗi xoá sản phẩm: ' + err.message);
  }
});

/**
 * POST /api/items/seed — Khởi tạo 10 sản phẩm mẫu (dữ liệu rác)
 */
router.post('/api/items/seed', async (req, res) => {
  try {
    const sampleItems = [
      { name: 'Giáo trình Giải Tích 1', category: 'books', condition: 'LIKE_NEW', tradeType: 'SELL', price: 30, description: 'Sách mới, không sờn gáy.', images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Balo thể thao chống nước', category: 'general', condition: 'NEW', tradeType: 'BARTER', exchangeWanted: 'Balo đi học laptop', description: 'Mình có balo thể thao không dùng, muốn đổi balo đi học.', images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Tai nghe Bluetooth SoundPEATS', category: 'electronics', condition: 'USED', tradeType: 'SELL', price: 120, description: 'Pin dùng 5 tiếng, vỏ hơi xước nhưng nghe rất hay.', images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Áo Hoodie Univ size L', category: 'clothes', condition: 'NEW', tradeType: 'SELL', price: 50, description: 'Mua về mặc không vừa, cần nhượng lại cho bạn nào thích.', images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Đèn bàn rạng đông chống cận', category: 'furniture', condition: 'LIKE_NEW', tradeType: 'BARTER', exchangeWanted: 'Đổi lấy sách chuyên ngành CNTT', description: 'Mình thừa 1 đèn kẹp bàn, muốn đổi sách.', images: ['https://images.unsplash.com/photo-1579758784400-dcb74c43adfb?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Chuột Logitech G203', category: 'electronics', condition: 'USED', tradeType: 'SELL', price: 80, description: 'Con lăn hơi rít một chút xíu, dùng tốt.', images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Tủ vải để quần áo', category: 'furniture', condition: 'USED', tradeType: 'SELL', price: 20, description: 'Pass tủ vải khung sắt chắc chắn, bạn qua trọ lấy nha.', images: ['https://images.unsplash.com/photo-1595428774223-ef5262412089?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Set bút lông đi nét Micron', category: 'general', condition: 'NEW', tradeType: 'BARTER', exchangeWanted: 'Đổi sổ vẽ A4', description: 'Bộ 6 cây nét các cỡ', images: ['https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Tiểu thuyết Đắc Nhân Tâm', category: 'books', condition: 'LIKE_NEW', tradeType: 'SELL', price: 40, description: 'Bản mềm xịn ạ', images: ['https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400'] },
      { name: 'Áo khoác gió mùa đông', category: 'clothes', condition: 'USED', tradeType: 'BARTER', exchangeWanted: 'Quần Jeans size 30', description: 'Còn khá mới ạ.', images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400'] },
    ];

    // Tạo random owner, lấy đại user đầu tiên trong DB
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) return apiResponse(res, 404, 'Bạn phải có ít nhất 1 User trong DB để seed data.');

    let count = 0;
    for (const item of sampleItems) {
      await prisma.secondhandItem.create({
        data: {
          name: item.name,
          category: item.category,
          condition: item.condition,
          tradeType: item.tradeType,
          price: item.price || 0,
          exchangeWanted: item.exchangeWanted,
          description: item.description,
          images: JSON.stringify(item.images),
          ownerId: firstUser.id
        }
      });
      count++;
    }

    apiResponse(res, 201, `Đã seed thành công ${count} sản phẩm cũ!`);
  } catch (err) {
    apiResponse(res, 500, err.message);
  }
});

/**
 * POST /api/items/propose-trade/:id — Đề nghị trao đổi đồ (Barter)
 * Body: { proposerId, proposalText }
 */
router.post('/api/items/propose-trade/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { proposerId, proposalText } = req.body;

    const item = await prisma.secondhandItem.findUnique({ where: { id: itemId } });
    if (!item) return apiResponse(res, 404, 'Sản phẩm không tồn tại');
    if (item.status !== 'ACTIVE') return apiResponse(res, 400, 'Sản phẩm đã đóng');
    if (item.ownerId === proposerId) return apiResponse(res, 400, 'Không thể đề nghị đổi đồ của chính mình');

    const proposal = await prisma.tradeProposal.create({
      data: {
        itemId,
        proposerId,
        proposalText: proposalText || 'Mình muốn trao đổi!',
        status: 'PENDING'
      },
      include: {
        proposer: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        item: true
      }
    });

    apiResponse(res, 201, 'Gửi đề nghị trao đổi thành công!', proposal);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

// ============================================
// MODULE 4: ĐI XE CHUNG (CARPOOL)
// ============================================

/**
 * GET /api/carpool/requests — Lấy danh sách các yêu cầu tìm xế đang PENDING
 */
router.get('/api/carpool/requests', async (req, res) => {
  try {
    const { departure, destination, onlyFemale } = req.query;
    const where = { status: 'PENDING' };

    if (departure) where.departure = { contains: departure };
    if (destination) where.destination = { contains: destination };
    if (onlyFemale === 'true') where.onlyFemale = true;

    const requests = await prisma.carpoolRequest.findMany({
      where,
      include: {
        passenger: { select: { id: true, fullName: true, username: true, avatarUrl: true, gender: true } },
        offers: {
          include: {
            driver: { select: { id: true, fullName: true, username: true, avatarUrl: true, gender: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const validRequests = [];
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const req of requests) {
      let expired = false;

      if (req.departureDate) {
        // req.departureDate is "YYYY-MM-DD"
        const [y, m, d] = req.departureDate.split('-');
        const depDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

        if (depDate < todayMidnight) {
          expired = true;
        } else if (depDate.getTime() === todayMidnight.getTime() && req.departureTime) {
          const parts = req.departureTime.split(' - ');
          if (parts.length >= 1) {
            const [hours, minutes] = parts[0].split(':');
            const expDate = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(), parseInt(hours), parseInt(minutes), 0);
            if (!isNaN(expDate) && Date.now() > expDate.getTime() + 30 * 60 * 1000) {
              expired = true;
            }
          }
        }
      } else if (req.departureTime) {
        const parts = req.departureTime.split(' - ');
        if (parts.length >= 1) {
          const [hours, minutes] = parts[0].split(':');
          const expDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
          if (!isNaN(expDate) && Date.now() > expDate.getTime() + 30 * 60 * 1000) {
            expired = true;
          }
        }
      }

      if (expired) {
        await prisma.carpoolRequest.update({ where: { id: req.id }, data: { status: 'CANCELLED' } });
        try {
          await prisma.notification.create({
            data: {
              userId: req.passengerId,
              type: 'ĐI XE CHUNG',
              content: `Yêu cầu đi xe từ "${req.departure}" → "${req.destination}"${req.departureDate ? ' ngày ' + req.departureDate.split('-').reverse().join('/') : ''} đã hết hạn và được chuyển vào lịch sử.`
            }
          });
        } catch (_) {}
        continue;
      }

      validRequests.push(req);
    }

    apiResponse(res, 200, 'Lấy danh sách chuyến đi thành công', validRequests);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi server: ' + err.message);
  }
});

/**
 * POST /api/carpool/requests — Khách đăng yêu cầu chuyến đi
 */
router.post('/api/carpool/requests', async (req, res) => {
  try {
    const {
      departure, destination, departureTime, departureDate,
      fee, phone, seats, onlyFemale, distance, passengerId,
      departureLat, departureLng, destinationLat, destinationLng
    } = req.body;

    if (!departure || !destination || !passengerId) return apiResponse(res, 400, 'Thiếu thông tin bắt buộc');

    const newRequest = await prisma.carpoolRequest.create({
      data: {
        departure,
        destination,
        departureTime: departureTime || '',
        departureDate: departureDate || null,
        fee: parseInt(fee) || 0,
        phone: phone || '',
        seats: parseInt(seats) || 1,
        onlyFemale: onlyFemale || false,
        distance,
        passengerId,
        departureLat: departureLat ? parseFloat(departureLat) : null,
        departureLng: departureLng ? parseFloat(departureLng) : null,
        destinationLat: destinationLat ? parseFloat(destinationLat) : null,
        destinationLng: destinationLng ? parseFloat(destinationLng) : null
      },
      include: {
        passenger: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      }
    });

    apiResponse(res, 201, 'Đăng yêu cầu thành công!', newRequest);

    // --- SMART RIDE MATCHING (chạy sau khi đã trả response) ---
    setImmediate(async () => {
      try {
        const matchedDrivers = await RideMatchService.findMatchingDrivers(newRequest);
        const passengerName = newRequest.passenger?.fullName || 'Hành khách';
        const routeText = `${departure} → ${destination}`;
        const timeText = departureTime ? ` lúc ${departureTime}` : '';

        for (const match of matchedDrivers) {
          const historyNote = match.reasons.includes('Đã từng chở hành khách này')
            ? `Hành khách bạn hay chở `
            : `Chüc bạn hặp lộ! Hành khách mới `;
          const notifContent = `🚗 Gợi ý chuyến phù hợp! ${historyNote}“${passengerName}” vừa đăng chuyến ${routeText}${timeText}. Điểm khớp: ${match.reasons.join(', ')}.`;

          await NotificationService.sendNotification(
            match.driverId,
            'RIDE_MATCH_SUGGESTION',
            notifContent,
            passengerId
          );
        }
        if (matchedDrivers.length > 0) {
          console.log(`[RideMatch] Đã thông báo ${matchedDrivers.length} tài xế phù hợp cho request #${newRequest.id}`);
        }
      } catch (matchErr) {
        console.error('[RideMatch] Lỗi khi ghép chọn:', matchErr.message);
      }
    });

  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

/**
 * POST /api/carpool/offers — Tài xế gửi Offer (Đề xuất giá)
 */
router.post('/api/carpool/offers', async (req, res) => {
  try {
    const { requestId, driverId, proposedPrice } = req.body;
    
    // Check request
    const carpoolRequest = await prisma.carpoolRequest.findUnique({ where: { id: requestId } });
    if (!carpoolRequest) return apiResponse(res, 404, 'Chuyến đi không tồn tại');
    if (carpoolRequest.status !== 'PENDING') return apiResponse(res, 400, 'Chuyến đi đã đóng hoặc đang di chuyển');
    if (carpoolRequest.passengerId === driverId) return apiResponse(res, 400, 'Bạn không thể nhận chuyến của chính mình');

    const offer = await prisma.carpoolOffer.create({
      data: {
        requestId,
        driverId,
        proposedPrice: parseInt(proposedPrice) || 0
      },
      include: {
        driver: { select: { id: true, fullName: true, username: true, avatarUrl: true } }
      }
    });

    apiResponse(res, 201, 'Đã gửi đề nghị thành công!', offer);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/carpool/offers/:id/accept — Khách đồng ý Offer
 */
router.put('/api/carpool/offers/:id/accept', async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const { passengerId } = req.body;

    const offer = await prisma.carpoolOffer.findUnique({ where: { id: offerId }, include: { request: true } });
    if (!offer) return apiResponse(res, 404, 'Không tìm thấy Đề xuất');
    if (offer.request.passengerId !== passengerId) return apiResponse(res, 403, 'Bạn không phải người đăng chuyến này');
    if (offer.request.status !== 'PENDING') return apiResponse(res, 400, 'Chuyến này đã chốt hoặc kết thúc');

    // Update Offer -> ACCEPTED
    await prisma.carpoolOffer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } });
    await prisma.carpoolOffer.updateMany({ where: { requestId: offer.requestId, id: { not: offerId } }, data: { status: 'REJECTED' } });

    // Update Request -> IN_PROGRESS
    const updatedReq = await prisma.carpoolRequest.update({
      where: { id: offer.requestId },
      data: { status: 'IN_PROGRESS', driverId: offer.driverId }
    });

    apiResponse(res, 200, 'Đặt chuyến thành công, chúc mựng chuyến an toàn!', updatedReq);
  } catch(err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/carpool/requests/:id/complete — Tài xế hoàn thành chuyến đi
 */
router.put('/api/carpool/requests/:id/complete', async (req, res) => {
  try {
    const reqId = parseInt(req.params.id);
    const { userId } = req.body; 

    const carpoolReq = await prisma.carpoolRequest.findUnique({ where: { id: reqId } });
    if (!carpoolReq) return apiResponse(res, 404, 'Không tìm thấy chuyến đi');
    if (carpoolReq.status !== 'IN_PROGRESS') return apiResponse(res, 400, 'Chuyến đi chưa được bắt đầu hoặc đã kết thúc');
    if (carpoolReq.driverId !== userId) return apiResponse(res, 403, 'Chỉ tài xế mới có thể xác nhận chuyến đi hoàn tất!');

    await prisma.carpoolRequest.update({
      where: { id: reqId },
      data: { status: 'COMPLETED' }
    });
    
    apiResponse(res, 200, 'Chuyến đi đã kết thúc thành công.');
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

/**
 * PUT /api/carpool/requests/:id/cancel — Khách hoặc hệ thống hủy chuyến
 */
router.put('/api/carpool/requests/:id/cancel', async (req, res) => {
  try {
    const reqId = parseInt(req.params.id);
    const { userId } = req.body;

    const ride = await prisma.carpoolRequest.findUnique({ where: { id: reqId } });
    if (!ride) return apiResponse(res, 404, 'Không tìm thấy chuyến xe');
    if (ride.passengerId !== userId) return apiResponse(res, 403, 'Bạn không có quyền huỷ chuyến xe này');
    if (ride.status !== 'PENDING') return apiResponse(res, 400, 'Chỉ có thể huỷ chuyến xe đang chờ xế');

    const updatedReq = await prisma.carpoolRequest.update({
      where: { id: reqId },
      data: { status: 'CANCELLED' }
    });

    apiResponse(res, 200, 'Đã huỷ chuyến xe thành công', updatedReq);
  } catch (err) {
    apiResponse(res, 400, err.message);
  }
});

// ============================================
// API LỊCH SỬ GIAO DỊCH COIN
// ============================================

/**
 * GET /api/coin/history/:userId — Lịch sử giao dịch Coin
 */
router.get('/api/coin/history/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const transactions = await prisma.coinTransaction.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      include: {
        sender: { select: { id: true, fullName: true, username: true } },
        receiver: { select: { id: true, fullName: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    apiResponse(res, 200, 'OK', transactions);
  } catch (err) {
    apiResponse(res, 500, 'Lỗi: ' + err.message);
  }
});

// ============================================
// API QUẢN LÝ CHỢ CÁ NHÂN TÔNG HỢP
// ============================================

/**
 * GET /api/market/my-orders/:userId — Lọc tất cả đơn hàng cá nhân
 */
router.get('/api/market/my-orders/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // 1. Documents
    const docsAsAuthor = await prisma.document.findMany({ where: { authorId: userId }, include: { buyer: true } });
    const docsAsBuyer = await prisma.document.findMany({ where: { buyerId: userId }, include: { author: true } });

    // 2. Errands
    const errandsRequested = await prisma.errand.findMany({ where: { requesterId: userId }, include: { runner: true } });
    const errandsRun = await prisma.errand.findMany({ where: { runnerId: userId }, include: { requester: true } });

    // 3. Items (Secondhand)
    const itemsAsOwner = await prisma.secondhandItem.findMany({ where: { ownerId: userId } });
    const coinTxItem = await prisma.coinTransaction.findMany({
      where: { senderId: userId, type: 'PURCHASE', referenceType: 'ITEM' }
    });
    const itemIdsBought = coinTxItem.map(t => t.referenceId).filter(Boolean);
    const itemsAsBuyer = await prisma.secondhandItem.findMany({
      where: { id: { in: itemIdsBought } },
      include: { owner: true }
    });

    // 4. Carpool (RideShare)
    const ridesAsDriver = await prisma.carpoolRequest.findMany({ where: { driverId: userId }, include: { passenger: true } });
    const ridesAsPassenger = await prisma.carpoolRequest.findMany({ where: { passengerId: userId }, include: { offers: { include: { driver: true } } } });

    let offers = [];
    let requests = [];

    const mapDoc = (d, isOffer) => ({ id: d.id, category: 'DOCUMENT', title: d.title, status: d.status, targetUser: isOffer ? d.buyer : d.author, createdAt: d.createdAt });
    const mapErrand = (e, isOffer) => ({ id: e.id, category: 'ERRAND', title: e.title, status: e.status, targetUser: isOffer ? e.requester : e.runner, createdAt: e.createdAt });
    const mapItem = (i, isOffer) => ({ id: i.id, category: 'ITEM', title: i.name, status: i.status, targetUser: isOffer ? null : i.owner, createdAt: i.createdAt }); 
    const mapRide = (r, isOffer) => ({ id: r.id, category: 'RIDE', title: `Chuyến: ${r.departure} - ${r.destination}`, status: r.status, targetUser: isOffer ? r.passenger : null, createdAt: r.createdAt });

    docsAsAuthor.forEach(d => offers.push(mapDoc(d, true)));
    errandsRun.forEach(e => offers.push(mapErrand(e, true)));
    itemsAsOwner.forEach(i => offers.push(mapItem(i, true)));
    ridesAsDriver.forEach(r => offers.push({ ...mapRide(r, true), rawData: r }));

    docsAsBuyer.forEach(d => requests.push(mapDoc(d, false)));
    errandsRequested.forEach(e => requests.push(mapErrand(e, false)));
    itemsAsBuyer.forEach(i => requests.push(mapItem(i, false)));
    ridesAsPassenger.forEach(rp => requests.push({ ...mapRide(rp, false), rawData: rp }));

    offers.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    requests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    apiResponse(res, 200, 'Lấy lịch sử thị trường thành công', { offers, requests });
  } catch (err) {
    apiResponse(res, 500, 'Lỗi ' + err.message);
  }
});

// ============================================
// MARKET ROUTES BACKGROUND CRON (20 mins late)
// ============================================
setInterval(async () => {
  try {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
    const overdue = await prisma.errand.findMany({
      where: {
        status: 'ACCEPTED',
        acceptedAt: { lt: twentyMinsAgo },
        excuseRequested: false,
        excused: false
      }
    });

    for (const e of overdue) {
      if (e.runnerId) {
        // Phạt 5 P
        await prisma.user.update({
          where: { id: e.runnerId },
          data: { coins: { decrement: 5 } }
        });
      }
      // Trả tiền cho requester
      await prisma.user.update({
        where: { id: e.requesterId },
        data: { coins: { increment: e.lockedAmount } }
      });
      // Hủy đơn
      await prisma.errand.update({
        where: { id: e.id },
        data: { status: 'CANCELLED' }
      });
    }
  } catch (err) {
    console.error("Cron Error", err);
  }
}, 60000); // 1 minute

module.exports = router;
