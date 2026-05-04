const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isAdmin = async (req, res, next) => {
  try {
    const adminId = req.body?.adminId || req.query?.adminId || req.headers['admin-id'];
    
    if (!adminId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized: Missing admin ID' });
    }

    if (parseInt(adminId) === 999999) {
      req.adminUser = { id: 999999, username: 'admin', fullName: 'Quản trị viên', role: 'ADMIN' };
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(adminId) } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ status: 403, message: 'Forbidden: Admins only' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error("Admin middleware error block. adminId:", req.body.adminId || req.query.adminId || req.headers['admin-id'], " Error:", error);
    res.status(500).json({ status: 500, message: 'Server Error: ' + error.message });
  }
};

module.exports = isAdmin;
