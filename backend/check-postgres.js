const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  await prisma.$connect();
  const tables = ['Customer', 'Loan', 'Payment', 'PartialPayment', 'LoanRenewal', 'ExtraMoney'];
  const result = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY ($1) ORDER BY tablename",
    tables
  );
  console.log(JSON.stringify(result));

  const customerCount = await prisma.customer.count();
  console.log(`customer_count=${customerCount}`);

  await prisma.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
