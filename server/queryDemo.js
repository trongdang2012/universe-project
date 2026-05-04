const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Lấy tasks ngày 14/4/2026
  const start = new Date('2026-04-14T00:00:00+07:00');
  const end   = new Date('2026-04-14T23:59:59+07:00');

  try {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { dueDate: { gte: start, lte: end } },
          { startTime: { gte: start, lte: end } }
        ]
      },
      include: { user: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
      take: 20
    });
    console.log('=== THỜI KHÓA BIỂU / TASKS 14/4 ===');
    tasks.forEach(t => {
      const time = t.startTime ? new Date(t.startTime).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : 'N/A';
      console.log(`[${time}] ${t.title} (${t.user?.name || 'unknown'}) - ${t.type || t.status}`);
    });
    if (tasks.length === 0) console.log('(Không có task nào ngày 14/4)');
  } catch(e) { console.log('Task error:', e.message); }

  // 2. Lấy đồ cũ đang bán
  try {
    const products = await prisma.secondHandItem.findMany({
      where: { status: 'ACTIVE' },
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15
    });
    console.log('\n=== ĐỒ CŨ ĐANG BÁN ===');
    products.forEach(p => {
      console.log(`- ${p.name} | ${p.price?.toLocaleString('vi-VN')} UC | ${p.condition} | ${p.category} | Người bán: ${p.owner?.name}`);
    });
    if (products.length === 0) console.log('(Không có sản phẩm nào)');
  } catch(e) { console.log('Product error:', e.message); }
}

main().catch(console.error).finally(() => prisma.$disconnect());
