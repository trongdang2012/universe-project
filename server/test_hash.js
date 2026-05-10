const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('--- 1. BCRYPT HASH (MẬT KHẨU) ---');
  const users = await prisma.user.findMany({
    take: 3,
    select: { username: true, password: true }
  });
  console.table(users);
  
  // Test thử tính năng tự động sinh chuỗi khác nhau cho cùng 1 password
  const pass = '123456';
  const hash1 = await bcrypt.hash(pass, 10);
  const hash2 = await bcrypt.hash(pass, 10);
  console.log('\nThử băm cùng mật khẩu "123456" hai lần:');
  console.log('Lần 1:', hash1);
  console.log('Lần 2:', hash2);

  console.log('\n--- 2. SHA-256 HASH (SỔ CÁI UNICOIN) ---');
  const txs = await prisma.coinTransaction.findMany({
    take: 3,
    orderBy: { createdAt: 'asc' },
    select: { id: true, amount: true, type: true, hash: true, previousHash: true }
  });
  console.table(txs);
}

main().finally(() => prisma.$disconnect());
