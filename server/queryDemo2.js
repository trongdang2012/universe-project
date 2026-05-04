const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schedule = await prisma.schedule.findMany({
    where: { date: { contains: '14/4' } }
  });
  console.log('SCHEDULE (14/4):');
  schedule.forEach(s => console.log(`- ${s.subjectName} | ${s.timeInfo} | Phòng ${s.room}`));

  const items = await prisma.secondhandItem.findMany({
    where: { status: 'ACTIVE' },
    include: { owner: { select: { fullName: true } } }
  });
  console.log('\nITEMS:');
  items.forEach(i => console.log(`- ${i.name} (${i.price} UC) by ${i.owner?.fullName}`));
}
main().finally(() => prisma.$disconnect());
