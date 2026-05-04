/**
 * errandService.js — Service cho Module Mua hộ
 * 
 * Logic phức tạp: Lock Coin khi tạo đơn → Release khi hoàn thành → Refund khi hủy
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CoinService = require('./coinService');

const ErrandService = {
  /**
   * Tạo đơn nhờ mua hộ
   * - Tính tổng = fee + tipAmount
   * - Lock Coin từ requester
   * - Tạo Errand record
   */
  async createErrand({ title, category, locationBuy, locationDrop, distance, fee, tipAmount, requesterId }) {
    const totalLock = (fee || 0) + (tipAmount || 0);

    if (totalLock <= 0) throw new Error('Phí trả công phải lớn hơn 0');

    const user = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!user) throw new Error('Người dùng không tồn tại');


    // Tạo Errand trước để có ID
    const errand = await prisma.errand.create({
      data: {
        title,
        category: category || 'FOOD',
        locationBuy,
        locationDrop,
        distance,
        fee: fee || 0,
        tipAmount: tipAmount || 0,
        lockedAmount: totalLock,
        status: 'PENDING',
        requesterId
      }
    });


    return errand;
  },

  /**
   * Runner nhận đơn
   * - Kiểm tra đơn còn PENDING không
   * - Gán runnerId
   */
  async acceptErrand(errandId, runnerId) {
    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) throw new Error('Đơn không tồn tại');
    if (errand.status !== 'PENDING') throw new Error('Đơn này đã được nhận hoặc đã hoàn thành');
    if (errand.requesterId === runnerId) throw new Error('Không thể tự nhận đơn của mình');

    const updatedErrand = await prisma.errand.update({
      where: { id: errandId },
      data: {
        status: 'ACCEPTED',
        runnerId,
        acceptedAt: new Date()
      },
      include: {
        requester: { select: { id: true, fullName: true, username: true } },
        runner: { select: { id: true, fullName: true, username: true } }
      }
    });

    return updatedErrand;
  },

  /**
   * Xác nhận hoàn thành đơn (Chỉ requester mới được xác nhận)
   * - Release Coin đã khóa → Runner
   */
  async completeErrand(errandId, requesterId) {
    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) throw new Error('Đơn không tồn tại');
    if (errand.status !== 'ACCEPTED' && errand.status !== 'DELIVERING') throw new Error('Đơn chưa được nhận hoặc đã hoàn thành');
    if (errand.requesterId !== requesterId) throw new Error('Chỉ người tạo đơn mới được xác nhận hoàn thành');
    if (!errand.runnerId) throw new Error('Đơn chưa có người nhận');


    // Cập nhật trạng thái
    const updatedErrand = await prisma.errand.update({
      where: { id: errandId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      },
      include: {
        requester: { select: { id: true, fullName: true, username: true } },
        runner: { select: { id: true, fullName: true, username: true } }
      }
    });

    return updatedErrand;
  },

  /**
   * Hủy đơn
   * - PENDING: Requester tự hủy → Refund 100%
   * - ACCEPTED: Cả hai bên có thể hủy → Refund cho requester
   */
  async cancelErrand(errandId, userId) {
    const errand = await prisma.errand.findUnique({ where: { id: errandId } });
    if (!errand) throw new Error('Đơn không tồn tại');
    if (errand.status === 'COMPLETED') throw new Error('Đơn đã hoàn thành, không thể hủy');
    if (errand.status === 'DELIVERING') throw new Error('Người nhận đang trên đường giao hàng, không thể hủy!');
    if (errand.status === 'CANCELLED') throw new Error('Đơn đã bị hủy rồi');

    // Chỉ requester hoặc runner mới được hủy
    if (errand.requesterId !== userId && errand.runnerId !== userId) {
      throw new Error('Bạn không có quyền hủy đơn này');
    }

    // Refund Coin cho requester
    let updateData = { status: 'CANCELLED' };

    // If the runner cancels, revert the errand to PENDING and clear runnerId
    if (errand.runnerId === userId && errand.status === 'ACCEPTED') {
      updateData = {
        status: 'PENDING',
        runnerId: null,
        acceptedAt: null,
        excuseRequested: false,
        excused: false
      };
    } else {

    }

    const updatedErrand = await prisma.errand.update({
      where: { id: errandId },
      data: updateData
    });

    return updatedErrand;
  }
};

module.exports = ErrandService;
