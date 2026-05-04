const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class LedgerService {
  /**
   * Tính toán mã băm SHA-256 cho một giao dịch
   * @param {Object} txData 
   * @returns {string} Hex hash
   */
  static calculateHash(txData) {
    const {
      senderId,
      receiverId,
      amount,
      type,
      referenceId,
      referenceType,
      previousHash,
      nonce
    } = txData;

    // Chuẩn hoá dữ liệu thành chuỗi (Stringify)
    const payload = `${senderId || ''}-${receiverId || ''}-${amount}-${type}-${referenceId || ''}-${referenceType || ''}-${previousHash || 'GENESIS'}-${nonce}`;
    
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Tạo giao dịch mã hoá mới (Đảm bảo tính toán previousHash đúng)
   * Sử dụng Global Ledger: Giao dịch nối tiếp giao dịch cuối cùng trong hệ thống
   * @param {Object} data Dữ liệu giao dịch
   * @param {Object} tx (Optional) Prisma transaction context
   * @returns {Promise<Object>} Giao dịch đã được lưu
   */
  static async createTransaction(data, tx = prisma) {
    try {
      const lastTx = await tx.coinTransaction.findFirst({
        orderBy: { id: 'desc' }
      });

      const previousHash = lastTx ? lastTx.hash : 'GENESIS';
      let nonce = 0;
      
      const txDataToHash = {
        senderId: data.senderId,
        receiverId: data.receiverId,
        amount: data.amount,
        type: data.type,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        previousHash: previousHash
      };

      const hash = this.calculateHash({ ...txDataToHash, nonce });

      const newTx = await tx.coinTransaction.create({
        data: {
          senderId: data.senderId,
          receiverId: data.receiverId,
          amount: data.amount,
          type: data.type,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          note: data.note || null,
          previousHash: previousHash,
          hash: hash,
          nonce: nonce
        }
      });

      return newTx;
    } catch (error) {
      console.error('Lỗi khi tạo Ledger Transaction:', error);
      throw error;
    }
  }

  /**
   * Kiểm toán sổ cái toàn cục (Audit Global Ledger)
   */
  static async verifyChain() {
    const allTransactions = await prisma.coinTransaction.findMany({
      orderBy: { id: 'asc' }
    });

    if (allTransactions.length === 0) return { isValid: true, message: 'Chuỗi trống' };

    for (let i = 0; i < allTransactions.length; i++) {
      const currentTx = allTransactions[i];
      
      // 1. Kiểm tra previousHash
      if (i === 0) {
        if (currentTx.previousHash && currentTx.previousHash !== 'GENESIS') {
          return { isValid: false, message: `Giao dịch gốc (ID: ${currentTx.id}) bị sai previousHash.` };
        }
      } else {
        const previousTx = allTransactions[i - 1];
        if (currentTx.previousHash !== previousTx.hash) {
          return { isValid: false, message: `Chuỗi đứt gãy tại ID: ${currentTx.id}. previousHash không khớp.` };
        }
      }

      // 2. Kiểm tra lại mã băm
      const txDataToHash = {
        senderId: currentTx.senderId,
        receiverId: currentTx.receiverId,
        amount: currentTx.amount,
        type: currentTx.type,
        referenceId: currentTx.referenceId,
        referenceType: currentTx.referenceType,
        previousHash: currentTx.previousHash,
        nonce: currentTx.nonce
      };
      
      const recalculatedHash = this.calculateHash(txDataToHash);
      if (recalculatedHash !== currentTx.hash) {
        return { isValid: false, message: `Dữ liệu bị sửa lén tại ID: ${currentTx.id}. Mã băm không khớp.` };
      }
    }

    return { isValid: true, message: 'Sổ cái hoàn toàn hợp lệ và nguyên vẹn.' };
  }
}

module.exports = LedgerService;
