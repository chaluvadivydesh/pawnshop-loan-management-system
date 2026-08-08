const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Connecting to database to apply indexes...');
    await prisma.$connect();
    console.log('Connected! Creating indexes...');

    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS "idx_loan_customer" ON "Loan"("customerId")',
      'CREATE INDEX IF NOT EXISTS "idx_loan_parent" ON "Loan"("parentLoanId")',
      'CREATE INDEX IF NOT EXISTS "idx_loan_status" ON "Loan"("releaseStatus")',
      'CREATE INDEX IF NOT EXISTS "idx_payment_loan" ON "Payment"("loanId")',
      'CREATE INDEX IF NOT EXISTS "idx_extramoney_loan" ON "ExtraMoney"("loanId")',
      'CREATE INDEX IF NOT EXISTS "idx_loanrenewal_loan" ON "LoanRenewal"("loanId")',
      'CREATE INDEX IF NOT EXISTS "idx_partialpayment_loan" ON "PartialPayment"("loanId")'
    ];

    for (const q of indexQueries) {
      console.time(q);
      await prisma.$executeRawUnsafe(q);
      console.timeEnd(q);
    }

    console.log('All indexes created successfully!');
  } catch (err) {
    console.error('Failed to create indexes:', err);
  } finally {
    await prisma.$disconnect();
  }
})();
