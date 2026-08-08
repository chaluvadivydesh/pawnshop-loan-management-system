import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { prisma } from './db';
import { autoRepairParentLoanLinks, warmupCustomerCache } from './controllers/customerController';
import { warmupDashboardCache } from './controllers/reportController';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(compression());
app.use(express.json());

// Performance measurement middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      res.setHeader('X-Response-Time', `${duration}ms`);
      console.log(`[API Timing] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


async function fixHistoricalLoanChainStatuses() {
  try {
    const parentLoans = await prisma.loan.findMany({
      where: {
        releaseStatus: 'RELEASED'
      },
      select: { id: true, remarks: true }
    });

    const parentIds = parentLoans.map((l) => l.id);
    const childLoans = await prisma.loan.findMany({
      where: {
        parentLoanId: { in: parentIds }
      },
      select: { parentLoanId: true }
    });

    const parentIdsWithChildren = new Set(childLoans.map((c) => c.parentLoanId).filter(Boolean));

    for (const pLoan of parentLoans) {
      if (parentIdsWithChildren.has(pLoan.id)) {
        const rem = (pLoan.remarks || '').toLowerCase();
        const correctStatus = rem.includes('renew') ? 'RENEWED' : 'PARTIALLY_PAID';
        await prisma.loan.update({
          where: { id: pLoan.id },
          data: { releaseStatus: correctStatus }
        });
      }
    }

    // Restore original principal on parent loans if modified
    const partiallyPaidParents = await prisma.loan.findMany({
      where: { releaseStatus: 'PARTIALLY_PAID' },
      include: { partialPayments: { orderBy: { createdAt: 'asc' } } }
    });

    for (const pLoan of partiallyPaidParents) {
      if (pLoan.partialPayments && pLoan.partialPayments.length > 0) {
        const originalP = pLoan.partialPayments[0].previousPrincipal;
        if (originalP && pLoan.principal !== originalP) {
          await prisma.loan.update({
            where: { id: pLoan.id },
            data: { principal: originalP }
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fixing historical loan chain statuses:', err);
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  try {
    await prisma.$connect();
    console.log('Database pool connected.');
    // Run background maintenance tasks and cache warmup asynchronously without blocking server readiness
    (async () => {
      await autoRepairParentLoanLinks();
      await fixHistoricalLoanChainStatuses();
      await warmupCustomerCache();
      await warmupDashboardCache();
    })().catch((err) => console.error('Error running background startup tasks:', err));
  } catch (err) {
    console.error('Error connecting database:', err);
  }
  console.log(`Backend server running on http://localhost:${PORT}`);
});
