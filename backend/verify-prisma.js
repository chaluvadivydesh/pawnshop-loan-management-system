const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log('Using URL:', url);
const prisma = new PrismaClient({
  datasources: {
    db: { url },
  },
});

(async () => {
  await prisma.$connect();
  const result = await prisma.$queryRawUnsafe('SELECT 1 as ok');
  console.log(JSON.stringify(result));
  await prisma.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
