import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@mjpmarine.es' },
    update: { password: hash },
    create: { email: 'admin@mjpmarine.es', password: hash },
  });
  console.log('Admin password reset successfully.');
  console.log('Email: admin@mjpmarine.es');
  console.log('Password: admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });