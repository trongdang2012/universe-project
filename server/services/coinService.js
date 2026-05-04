/**
 * coinService.js — Service xử lý Uni-Coin an toàn
 * 
 * Pattern: Lock → Release / Refund
 * Tích hợp Crypto Ledger để đóng gói giao dịch an toàn.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const LedgerService = require('./LedgerService');

const CoinService = {
  /**
   * Chuyển Coin trực tiếp từ sender sang receiver
   * Dùng cho: Mua tài liệu, mua đồ cũ, đặt chỗ xe
   */
  async transferCoin(senderId, receiverId, amount, type = 'TRANSFER', referenceId = null, referenceType = null) {
    if (amount <= 0) throw new Error('Số Coin phải lớn hơn 0');
    if (senderId === receiverId) throw new Error('Không thể tự chuyển Coin cho mình');

    const result = await prisma.$transaction(async (tx) => {
      const sender = await tx.user.findUnique({ where: { id: senderId } });
      if (!sender) throw new Error('Người gửi không tồn tại');
      if (sender.coins < amount) throw new Error(`Không đủ Coin! (Hiện có: ${sender.coins}, cần: ${amount})`);

      // Trừ Coin người gửi
      await tx.user.update({
        where: { id: senderId },
        data: { coins: { decrement: amount } }
      });

      // Cộng Coin người nhận
      await tx.user.update({
        where: { id: receiverId },
        data: { coins: { increment: amount } }
      });

      // Ghi log mã hoá
      const transaction = await LedgerService.createTransaction({
        senderId,
        receiverId,
        amount,
        type,
        referenceId,
        referenceType,
        note: `Chuyển ${amount} Coin (${type})`
      }, tx);

      return { transaction, newBalance: sender.coins - amount };
    });

    return { success: true, transaction: result.transaction, newBalance: result.newBalance };
  },

  /**
   * Khóa/Tạm giữ Coin (trừ từ balance nhưng chưa chuyển cho ai)
   * Dùng cho: Tạo đơn Mua hộ — giữ lại fee + tip
   */
  async lockCoin(userId, amount, referenceId = null, referenceType = null) {
    if (amount <= 0) throw new Error('Số Coin phải lớn hơn 0');

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('Người dùng không tồn tại');
      if (user.coins < amount) throw new Error(`Không đủ Coin để khóa! (Hiện có: ${user.coins}, cần: ${amount})`);

      // Trừ Coin từ balance
      await tx.user.update({
        where: { id: userId },
        data: { coins: { decrement: amount } }
      });

      // Ghi log mã hoá
      const transaction = await LedgerService.createTransaction({
        senderId: userId,
        receiverId: null,
        amount,
        type: 'LOCK',
        referenceId,
        referenceType,
        note: `Tạm khóa ${amount} Coin cho đơn #${referenceId}`
      }, tx);

      return { transaction, newBalance: user.coins - amount };
    });

    return { success: true, transaction: result.transaction, newBalance: result.newBalance };
  },

  /**
   * Giải phóng Coin đã khóa → chuyển sang receiver
   * Dùng cho: Xác nhận hoàn thành đơn Mua hộ
   */
  async releaseCoin(senderId, receiverId, amount, referenceId = null, referenceType = null) {
    if (amount <= 0) return { success: true };

    const result = await prisma.$transaction(async (tx) => {
      // Cộng Coin cho receiver (Coin đã bị trừ lúc lock rồi)
      await tx.user.update({
        where: { id: receiverId },
        data: { coins: { increment: amount } }
      });

      // Ghi log mã hoá
      const transaction = await LedgerService.createTransaction({
        senderId,
        receiverId,
        amount,
        type: 'RELEASE',
        referenceId,
        referenceType,
        note: `Giải phóng ${amount} Coin cho đơn #${referenceId}`
      }, tx);

      return { transaction };
    });

    return { success: true, transaction: result.transaction };
  },

  /**
   * Hoàn trả Coin đã khóa (trả lại cho user)
   * Dùng cho: Hủy đơn Mua hộ
   */
  async refundCoin(userId, amount, referenceId = null, referenceType = null) {
    if (amount <= 0) return { success: true };

    const result = await prisma.$transaction(async (tx) => {
      // Trả lại Coin cho user
      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: amount } }
      });

      // Ghi log mã hoá
      const transaction = await LedgerService.createTransaction({
        senderId: null,
        receiverId: userId,
        amount,
        type: 'REFUND',
        referenceId,
        referenceType,
        note: `Hoàn trả ${amount} Coin cho đơn #${referenceId}`
      }, tx);

      return { transaction };
    });

    return { success: true, transaction: result.transaction };
  }
};

module.exports = CoinService;
