import { Request, Response } from 'express';
import { prisma } from '../db';
import { calculateCompoundInterest } from '../services/calculatorService';

export async function calculatePeriodFinancialStats(startDate: string, endDate: string) {
  const [
    loansGiven,
    extraMoneyEntries,
    rawLoansReleased,
    renewals,
    interestPayments,
    partialPayments
  ] = await Promise.all([
    prisma.loan.findMany({
      where: { loanDate: { gte: startDate, lte: endDate } },
      include: { customer: true },
      orderBy: { loanDate: 'asc' }
    }),
    prisma.extraMoney.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { loan: { include: { customer: true } } },
      orderBy: { date: 'asc' }
    }),
    prisma.loan.findMany({
      where: { releaseStatus: 'RELEASED', releaseDate: { gte: startDate, lte: endDate } },
      include: { customer: true, extraMoney: true },
      orderBy: { releaseDate: 'asc' }
    }),
    prisma.loanRenewal.findMany({
      where: { renewalDate: { gte: startDate, lte: endDate } },
      include: { loan: { include: { customer: true } } },
      orderBy: { renewalDate: 'asc' }
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: startDate, lte: endDate }, paymentType: 'INTEREST_ONLY' },
      include: { loan: { include: { customer: true } } },
      orderBy: { paymentDate: 'asc' }
    }),
    prisma.partialPayment.findMany({
      where: { paymentDate: { gte: startDate, lte: endDate } },
      include: { loan: { include: { customer: true } } },
      orderBy: { paymentDate: 'asc' }
    })
  ]);

  // Filter base new loans vs renewal loans vs partial payment items
  const baseLoansGiven = loansGiven.filter((l) => {
    const rem = (l.remarks || '').toLowerCase();
    return !rem.includes('renewed loan') && !rem.includes('partially paid item') && !l.parentLoanId;
  });
  const loansGivenCount = baseLoansGiven.length;
  const loansGivenPrincipal = baseLoansGiven.reduce((s, l) => s + l.principal, 0);

  const extraMoneyGiven = extraMoneyEntries.reduce((s, em) => s + em.amount, 0);
  const totalMoneyGiven = loansGivenPrincipal + extraMoneyGiven;

  // Exclude intermediate ancestor loans (loans where a child loan also exists in DB)
  const releasedLoanIds = new Set(rawLoansReleased.map((l) => l.id));
  const childLoansOfReleased = releasedLoanIds.size > 0
    ? await prisma.loan.findMany({
        where: {
          parentLoanId: { in: Array.from(releasedLoanIds) }
        },
        select: { parentLoanId: true }
      })
    : [];
  const parentIdsToExclude = new Set(childLoansOfReleased.map((c) => c.parentLoanId).filter(Boolean));

  const loansReleased = rawLoansReleased.filter((l) => !parentIdsToExclude.has(l.id));
  const loansReleasedCount = loansReleased.length;

  const releasedPrincipalReturned = loansReleased.reduce((s, l) => s + l.principal, 0);
  const releaseInterestCollected = loansReleased.reduce((s, l) => {
    const amountPaid = l.amountPaid || l.finalAmount || l.principal;
    const extraP = (l.extraMoney || []).reduce((emS, em) => emS + em.amount, 0);
    return s + Math.max(0, amountPaid - l.principal - extraP);
  }, 0);
  const releaseMoneyReceived = loansReleased.reduce((s, l) => s + (l.amountPaid || l.finalAmount || l.principal), 0);

  const renewalsCount = renewals.length;
  const renewalInterestCollected = renewals.reduce((s, r) => {
    const loanDate = r.loan?.loanDate;
    if (loanDate && r.renewalDate) {
      const [sy, sm, sd] = loanDate.split('-').map(Number);
      const [ey, em, ed] = r.renewalDate.split('-').map(Number);
      const daysBetween = (ey - sy) * 360 + (em - sm) * 30 + (ed - sd);
      if (daysBetween <= 1) return s;
    }
    return s + r.accumulatedInterest;
  }, 0);

  const interestOnlyCollected = interestPayments.reduce((s, p) => s + p.amountPaid, 0);

  const partialPaymentsCount = partialPayments.length;
  const partialPaymentMoneyReceived = partialPayments.reduce((s, p) => s + p.totalAmountPaid, 0);
  const partialPaymentInterestCollected = partialPayments.reduce((s, p) => s + p.interestPaid, 0);
  const partialPaymentPrincipalReturned = partialPayments.reduce((s, p) => s + p.principalPaid, 0);

  // Summaries according to Actual Business Cash Flow Rules (Renewals capitalize interest and do not represent cash received)
  const totalInterestCollected = Math.floor(releaseInterestCollected + interestOnlyCollected + partialPaymentInterestCollected);
  const totalMoneyReceived = Math.floor(releaseMoneyReceived + interestOnlyCollected + partialPaymentMoneyReceived);
  const totalPrincipalReturned = Math.floor(releasedPrincipalReturned + partialPaymentPrincipalReturned);

  return {
    startDate,
    endDate,
    loansGivenCount,
    loansReleasedCount,
    renewalsCount,
    partialPaymentsCount,
    totalMoneyGiven: Math.floor(totalMoneyGiven),
    totalMoneyReceived,
    totalPrincipalReturned: Math.floor(releasedPrincipalReturned),
    totalInterestCollected,
    interestFromReleases: Math.floor(releaseInterestCollected),
    interestFromRenewals: 0,
    interestFromInterestOnly: Math.floor(interestOnlyCollected),
    interestFromPartialPayments: Math.floor(partialPaymentInterestCollected),
    releaseMoneyReceived: Math.floor(releaseMoneyReceived),
    partialPaymentMoneyReceived: Math.floor(partialPaymentMoneyReceived),
    baseLoansGiven,
    loansReleased,
    renewals,
    interestPayments,
    extraMoneyEntries,
    partialPayments
  };
}

import { invalidateCustomerCache, warmupCustomerCache } from './customerController';

let cachedDashboardState: { data: any; timestamp: number; dateStr: string } | null = null;
let cachedDueLoansState: { data: any; timestamp: number; dateStr: string } | null = null;
let cachedFinancialReportMap = new Map<string, { data: any; timestamp: number }>();
let cachedTodaysAnalysisMap = new Map<string, { data: any; timestamp: number }>();

const DASHBOARD_TTL_MS = 60 * 1000;

export function invalidateDashboardCache() {
  cachedDashboardState = null;
  cachedDueLoansState = null;
  cachedFinancialReportMap.clear();
  cachedTodaysAnalysisMap.clear();
  invalidateCustomerCache();

  // Asynchronously re-warm caches in background so subsequent reads hit pre-warmed fresh data
  setTimeout(() => {
    warmupDashboardCache().catch((err) => console.error('Background cache re-warm error:', err));
    warmupCustomerCache().catch((err) => console.error('Background customer cache re-warm error:', err));
  }, 50);
}

export async function warmupDashboardCache() {
  try {
    const fakeReq = { query: {} } as any;
    const fakeRes = { status: () => fakeRes, json: () => {} } as any;
    await getDashboardStats(fakeReq, fakeRes);
    await getDueLoans(fakeReq, fakeRes);
  } catch (e) {
    console.error('Error warming dashboard cache:', e);
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    if (
      cachedDashboardState &&
      cachedDashboardState.dateStr === todayStr &&
      Date.now() - cachedDashboardState.timestamp < DASHBOARD_TTL_MS
    ) {
      return res.json({ success: true, data: cachedDashboardState.data });
    }

    const [totalCustomers, loansRaw, todayStats] = await Promise.all([
      prisma.customer.count(),
      prisma.$queryRaw`
        SELECT 
          l.id, l."parentLoanId", l."releaseStatus", l."metalType", l.weight, l.principal, l."interestRate", l."compoundFrequency", l."loanDate",
          COALESCE(
            (SELECT json_agg(json_build_object('amount', em.amount)) FROM "ExtraMoney" em WHERE em."loanId" = l.id), '[]'
          ) as "extraMoney",
          COALESCE(
            (SELECT json_agg(json_build_object('amountPaid', p."amountPaid", 'paymentDate', p."paymentDate", 'paymentType', p."paymentType", 'remarks', p.remarks)) FROM "Payment" p WHERE p."loanId" = l.id AND p."paymentType" = 'INTEREST_ONLY'), '[]'
          ) as "payments",
          COALESCE(
            (SELECT json_agg(json_build_object('renewalDate', r."renewalDate", 'accumulatedInterest', r."accumulatedInterest")) FROM "LoanRenewal" r WHERE r."loanId" = l.id), '[]'
          ) as "renewals"
        FROM "Loan" l
      `,
      calculatePeriodFinancialStats(todayStr, todayStr)
    ]);

    const loans: any[] = (loansRaw as any[]) || [];
    const parentIdSet = new Set(loans.map((l: any) => l.parentLoanId).filter(Boolean));

    let activeLoansCount = 0;
    let releasedLoansCount = 0;
    let totalGoldWeight = 0;
    let totalSilverWeight = 0;
    let totalPrincipal = 0;
    let totalOutstanding = 0;

    loans.forEach((loan: any) => {
      if (loan.releaseStatus === 'ACTIVE') {
        activeLoansCount++;
        const totalExtraP = (loan.extraMoney || []).reduce((sum: number, em: any) => sum + em.amount, 0);
        totalPrincipal += (loan.principal + totalExtraP);

        if (loan.metalType.toUpperCase() === 'GOLD') {
          totalGoldWeight += loan.weight;
        } else if (loan.metalType.toUpperCase() === 'SILVER') {
          totalSilverWeight += loan.weight;
        }

        const calcDate = todayStr;
        const interestPayments = (loan.payments || [])
          .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
          .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));
        const calc = calculateCompoundInterest({
          principal: loan.principal,
          interestRate: loan.interestRate,
          compoundFrequency: loan.compoundFrequency,
          loanDate: loan.loanDate,
          calculationDate: calcDate,
          amountPaid: 0,
          extraMoneyEntries: loan.extraMoney || [],
          interestPaymentEntries: interestPayments,
          renewalEntries: loan.renewals || []
        });
        totalOutstanding += calc.outstandingBalance;
      } else if (loan.releaseStatus === 'RELEASED' && !parentIdSet.has(loan.id)) {
        releasedLoansCount++;
      }
    });

    const dashboardData = {
      totalCustomers,
      totalActiveLoans: activeLoansCount,
      totalReleasedLoans: releasedLoansCount,
      totalGoldWeight: Number(totalGoldWeight.toFixed(3)),
      totalSilverWeight: Number(totalSilverWeight.toFixed(3)),
      totalPrincipal: Math.floor(totalPrincipal),
      totalOutstanding: Math.floor(totalOutstanding),
      // Unified Today Metrics (Matching Today's Analysis)
      todayCollections: todayStats.totalMoneyReceived,
      todayReleasedLoans: todayStats.loansReleasedCount,
      todayGivenCount: todayStats.loansGivenCount,
      todayGivenAmount: todayStats.totalMoneyGiven,
      todayInterest: todayStats.totalInterestCollected
    };

    cachedDashboardState = {
      data: dashboardData,
      timestamp: Date.now(),
      dateStr: todayStr
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getDueLoans(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    if (
      cachedDueLoansState &&
      cachedDueLoansState.dateStr === todayStr &&
      Date.now() - cachedDueLoansState.timestamp < DASHBOARD_TTL_MS
    ) {
      return res.json({ success: true, data: cachedDueLoansState.data });
    }

    const activeLoans: any[] = await prisma.$queryRaw`
      SELECT 
        l.id, l."customerId", l."parentLoanId", l."itemName", l."itemDescription", l."metalType", l.weight, l."loanDate", l."releaseDate", l.principal, l."interestRate", l."compoundFrequency", l."loanPeriod", l."calculatedInterest", l."finalAmount", l."amountPaid", l."outstandingBalance", l."releaseStatus", l."calculationDate", l.remarks, l."createdAt", l."updatedAt",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'relationshipType', c."relationshipType",
          'relationshipName', c."relationshipName",
          'village', c.village,
          'mobile', c.mobile,
          'address', c.address,
          'remarks', c.remarks
        ) as customer,
        COALESCE(
          (SELECT json_agg(json_build_object('amount', em.amount, 'date', em.date, 'remarks', em.remarks)) FROM "ExtraMoney" em WHERE em."loanId" = l.id), '[]'
        ) as "extraMoney",
        COALESCE(
          (SELECT json_agg(json_build_object('amountPaid', p."amountPaid", 'paymentDate', p."paymentDate", 'paymentType', p."paymentType", 'remarks', p.remarks)) FROM "Payment" p WHERE p."loanId" = l.id AND p."paymentType" = 'INTEREST_ONLY'), '[]'
        ) as "payments",
        COALESCE(
          (SELECT json_agg(json_build_object('renewalDate', r."renewalDate", 'accumulatedInterest', r."accumulatedInterest")) FROM "LoanRenewal" r WHERE r."loanId" = l.id), '[]'
        ) as "renewals"
      FROM "Loan" l
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE l."releaseStatus" = 'ACTIVE'
    `;

    const overdueLoans: any[] = [];
    const dueTodayLoans: any[] = [];

    activeLoans.forEach((loan: any) => {
      // Calculate Due Date = loanDate + loanPeriod months
      const [y, m, d] = loan.loanDate.split('-').map(Number);
      const totalMonths = m + (loan.loanPeriod || 12);
      const newY = y + Math.floor((totalMonths - 1) / 12);
      const newM = ((totalMonths - 1) % 12) + 1;
      const strM = String(newM).padStart(2, '0');
      const strD = String(d).padStart(2, '0');
      const dueDateStr = `${newY}-${strM}-${strD}`;

      const interestPayments = (loan.payments || [])
        .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
        .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

      const calc = calculateCompoundInterest({
        principal: loan.principal,
        interestRate: loan.interestRate,
        compoundFrequency: loan.compoundFrequency,
        loanDate: loan.loanDate,
        calculationDate: todayStr,
        amountPaid: loan.amountPaid,
        extraMoneyEntries: loan.extraMoney || [],
        interestPaymentEntries: interestPayments,
        renewalEntries: loan.renewals || []
      });

      // Days Overdue using 30-day month / 360-day year
      const [sy, sm, sd] = dueDateStr.split('-').map(Number);
      const [ey, em, ed] = todayStr.split('-').map(Number);
      const totalOverdueDays = (ey - sy) * 360 + (em - sm) * 30 + (ed - sd);

      const loanObject = {
        ...loan,
        dueDate: dueDateStr,
        daysOverdue: Math.max(0, totalOverdueDays),
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        outstandingBalance: calc.outstandingBalance
      };

      if (todayStr === dueDateStr) {
        dueTodayLoans.push(loanObject);
      } else if (todayStr > dueDateStr) {
        overdueLoans.push(loanObject);
      }
    });

    // Sort overdue loans descending (highest days overdue first)
    overdueLoans.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const dueData = {
      overdueLoans,
      dueTodayLoans,
      overdueCount: overdueLoans.length,
      dueTodayCount: dueTodayLoans.length
    };

    cachedDueLoansState = {
      data: dueData,
      timestamp: Date.now(),
      dateStr: todayStr
    };

    res.json({
      success: true,
      data: dueData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getFinancialReport(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    
    // Default startDate: 1st of current month
    const defaultStartDate = `${currentYear}-${currentMonth}-01`;
    const defaultEndDate = todayStr;

    const startDate = (req.query.startDate as string) || defaultStartDate;
    const endDate = (req.query.endDate as string) || defaultEndDate;
    const cacheKey = `${startDate}_${endDate}`;

    const cached = cachedFinancialReportMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DASHBOARD_TTL_MS) {
      return res.json({ success: true, data: cached.data });
    }

    // Use unified period financial stats logic (same logic as Today's Analysis & Dashboard)
    const periodStats = await calculatePeriodFinancialStats(startDate, endDate);

    // Initialize daily map for all dates in [startDate, endDate]
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const startUtc = Date.UTC(sY, sM - 1, sD);
    const endUtc = Date.UTC(eY, eM - 1, eD);

    const dateMap: {
      [dateStr: string]: {
        date: string;
        loansGivenCount: number;
        loansReleasedCount: number;
        renewalsCount: number;
        interestPaymentsCount: number;
        moneyGiven: number;
        moneyReceived: number;
        interestEarned: number;
      };
    } = {};

    for (let t = startUtc; t <= endUtc; t += 86400000) {
      const d = new Date(t);
      const dateStr = d.toISOString().substring(0, 10);
      dateMap[dateStr] = {
        date: dateStr,
        loansGivenCount: 0,
        loansReleasedCount: 0,
        renewalsCount: 0,
        interestPaymentsCount: 0,
        moneyGiven: 0,
        moneyReceived: 0,
        interestEarned: 0
      };
    }

    // 1. Loans Given (base new loans)
    periodStats.baseLoansGiven.forEach((l) => {
      const dateStr = l.loanDate;
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          date: dateStr,
          loansGivenCount: 0,
          loansReleasedCount: 0,
          renewalsCount: 0,
          interestPaymentsCount: 0,
          moneyGiven: 0,
          moneyReceived: 0,
          interestEarned: 0
        };
      }
      dateMap[dateStr].loansGivenCount += 1;
      dateMap[dateStr].moneyGiven += Math.floor(l.principal);
    });

    // 2. Extra Money Entries
    periodStats.extraMoneyEntries.forEach((em) => {
      const dateStr = em.date;
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          date: dateStr,
          loansGivenCount: 0,
          loansReleasedCount: 0,
          renewalsCount: 0,
          interestPaymentsCount: 0,
          moneyGiven: 0,
          moneyReceived: 0,
          interestEarned: 0
        };
      }
      dateMap[dateStr].moneyGiven += Math.floor(em.amount);
    });

    // 3. Loans Released
    periodStats.loansReleased.forEach((l) => {
      const dateStr = l.releaseDate || l.calculationDate || '';
      if (dateStr) {
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = {
            date: dateStr,
            loansGivenCount: 0,
            loansReleasedCount: 0,
            renewalsCount: 0,
            interestPaymentsCount: 0,
            moneyGiven: 0,
            moneyReceived: 0,
            interestEarned: 0
          };
        }
        const amountPaid = l.amountPaid || l.finalAmount || l.principal;
        const extraP = (l.extraMoney || []).reduce((emS: number, em: any) => emS + em.amount, 0);
        const interestCollected = Math.max(0, amountPaid - l.principal - extraP);

        dateMap[dateStr].loansReleasedCount += 1;
        dateMap[dateStr].moneyReceived += Math.floor(amountPaid);
        dateMap[dateStr].interestEarned += Math.floor(interestCollected);
      }
    });

    // 4. Renewed Loans
    periodStats.renewals.forEach((r) => {
      const dateStr = r.renewalDate;
      if (dateStr) {
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = {
            date: dateStr,
            loansGivenCount: 0,
            loansReleasedCount: 0,
            renewalsCount: 0,
            interestPaymentsCount: 0,
            moneyGiven: 0,
            moneyReceived: 0,
            interestEarned: 0
          };
        }
        dateMap[dateStr].renewalsCount += 1;
        // Renewals capitalize accumulated interest into principal (no cash received from customer)
      }
    });

    // 5. Interest-Only Payments
    periodStats.interestPayments.forEach((p) => {
      const dateStr = p.paymentDate;
      if (dateStr) {
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = {
            date: dateStr,
            loansGivenCount: 0,
            loansReleasedCount: 0,
            renewalsCount: 0,
            interestPaymentsCount: 0,
            moneyGiven: 0,
            moneyReceived: 0,
            interestEarned: 0
          };
        }
        dateMap[dateStr].interestPaymentsCount += 1;
        dateMap[dateStr].moneyReceived += Math.floor(p.amountPaid);
        dateMap[dateStr].interestEarned += Math.floor(p.amountPaid);
      }
    });

    // 6. Partial Payments
    periodStats.partialPayments.forEach((pp) => {
      const dateStr = pp.paymentDate;
      if (dateStr) {
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = {
            date: dateStr,
            loansGivenCount: 0,
            loansReleasedCount: 0,
            renewalsCount: 0,
            interestPaymentsCount: 0,
            moneyGiven: 0,
            moneyReceived: 0,
            interestEarned: 0
          };
        }
        dateMap[dateStr].moneyReceived += Math.floor(pp.totalAmountPaid);
        dateMap[dateStr].interestEarned += Math.floor(pp.interestPaid);
      }
    });

    const dailyRows = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    // Derive Grand Totals strictly by aggregating the validated dailyRows
    const totals = {
      totalLoansGiven: dailyRows.reduce((sum, r) => sum + r.loansGivenCount, 0),
      totalLoansReleased: dailyRows.reduce((sum, r) => sum + r.loansReleasedCount, 0),
      totalRenewals: dailyRows.reduce((sum, r) => sum + (r.renewalsCount || 0), 0),
      totalInterestPayments: dailyRows.reduce((sum, r) => sum + (r.interestPaymentsCount || 0), 0),
      totalMoneyGiven: dailyRows.reduce((sum, r) => sum + r.moneyGiven, 0),
      totalMoneyReceived: dailyRows.reduce((sum, r) => sum + r.moneyReceived, 0),
      totalInterestEarned: dailyRows.reduce((sum, r) => sum + r.interestEarned, 0),
      totalPrincipalReturned: periodStats.totalPrincipalReturned
    };

    const reportData = {
      startDate,
      endDate,
      dailyRows,
      totals
    };

    cachedFinancialReportMap.set(cacheKey, {
      data: reportData,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: reportData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getTodaysAnalysis(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = (req.query.startDate as string) || todayStr;
    const endDate = (req.query.endDate as string) || todayStr;
    const cacheKey = `${startDate}_${endDate}`;

    const cached = cachedTodaysAnalysisMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DASHBOARD_TTL_MS) {
      return res.json({ success: true, data: cached.data });
    }

    const periodStats = await calculatePeriodFinancialStats(startDate, endDate);

    // Format Loans Given List
    const formattedLoansGiven = periodStats.baseLoansGiven.map((l) => ({
      id: l.id,
      customerId: l.customerId,
      customerName: l.customer?.name || 'Unknown',
      village: l.customer?.village || '',
      loanDate: l.loanDate,
      itemName: l.itemName,
      weight: l.weight,
      metalType: l.metalType,
      principal: l.principal,
      remarks: l.remarks
    }));

    // Format Loans Released List
    const formattedLoansReleased = periodStats.loansReleased.map((l) => {
      const amountPaid = l.amountPaid || l.finalAmount || l.principal;
      const extraP = (l.extraMoney || []).reduce((emS: number, em: any) => emS + em.amount, 0);
      const interestCollected = Math.max(0, amountPaid - l.principal - extraP);
      return {
        id: l.id,
        customerId: l.customerId,
        customerName: l.customer?.name || 'Unknown',
        village: l.customer?.village || '',
        loanDate: l.loanDate,
        releaseDate: l.releaseDate || l.calculationDate || '',
        itemName: l.itemName,
        weight: l.weight,
        metalType: l.metalType,
        principal: l.principal,
        interestCollected: interestCollected,
        totalAmountReceived: amountPaid,
        remarks: l.remarks
      };
    });

    // Format Renewed Loans List
    const formattedRenewals = periodStats.renewals.map((r) => ({
      id: r.id,
      loanId: r.loanId,
      customerName: r.loan?.customer?.name || 'Unknown',
      originalLoanDate: r.loan?.loanDate || '',
      renewalDate: r.renewalDate,
      itemName: r.loan?.itemName || '',
      previousPrincipal: r.previousPrincipal,
      accumulatedInterest: r.accumulatedInterest,
      newPrincipal: r.newPrincipal,
      remarks: r.remarks
    }));

    // Format Interest Payments List
    const formattedInterestPayments = periodStats.interestPayments.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      customerName: p.loan?.customer?.name || 'Unknown',
      paymentDate: p.paymentDate,
      itemName: p.loan?.itemName || '',
      amountPaid: p.amountPaid,
      remarks: p.remarks
    }));

    // Format Extra Money List
    const formattedExtraMoney = periodStats.extraMoneyEntries.map((em) => ({
      id: em.id,
      loanId: em.loanId,
      customerName: em.loan?.customer?.name || 'Unknown',
      date: em.date,
      itemName: em.loan?.itemName || '',
      amount: em.amount,
      remarks: em.remarks
    }));

    // Format Partial Payments List
    const formattedPartialPayments = periodStats.partialPayments.map((pp) => ({
      id: pp.id,
      loanId: pp.loanId,
      customerId: pp.loan?.customerId || '',
      customerName: pp.loan?.customer?.name || 'Unknown',
      paymentDate: pp.paymentDate,
      itemName: pp.loan?.itemName || '',
      paymentType: pp.paymentType,
      totalAmountPaid: pp.totalAmountPaid,
      interestPaid: pp.interestPaid,
      principalPaid: pp.principalPaid,
      previousPrincipal: pp.previousPrincipal,
      outstandingInterest: pp.outstandingInterest,
      newPrincipal: pp.newPrincipal,
      remarks: pp.remarks
    }));

    const responseData = {
      startDate,
      endDate,
      summary: {
        loansGivenCount: periodStats.loansGivenCount,
        loansReleasedCount: periodStats.loansReleasedCount,
        renewalsCount: periodStats.renewalsCount,
        partialPaymentsCount: periodStats.partialPaymentsCount,
        totalMoneyGiven: periodStats.totalMoneyGiven,
        totalMoneyReceived: periodStats.totalMoneyReceived,
        totalPrincipalReturned: periodStats.totalPrincipalReturned,
        totalInterestCollected: periodStats.totalInterestCollected,
        interestFromReleases: periodStats.interestFromReleases,
        interestFromRenewals: periodStats.interestFromRenewals,
        interestFromInterestOnly: periodStats.interestFromInterestOnly,
        interestFromPartialPayments: periodStats.interestFromPartialPayments
      },
      loansGiven: formattedLoansGiven,
      loansReleased: formattedLoansReleased,
      renewedLoans: formattedRenewals,
      interestPayments: formattedInterestPayments,
      extraMoneyEntries: formattedExtraMoney,
      partialPayments: formattedPartialPayments
    };

    cachedTodaysAnalysisMap.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPortfolioLoans(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeLoansRaw: any[] = await prisma.$queryRaw`
      SELECT 
        l.id, l."customerId", l."parentLoanId", l."itemName", l."itemDescription", l."metalType", l.weight, l."loanDate", l."releaseDate", l.principal, l."interestRate", l."compoundFrequency", l."loanPeriod", l."calculatedInterest", l."finalAmount", l."amountPaid", l."outstandingBalance", l."releaseStatus", l."calculationDate", l.remarks, l."createdAt", l."updatedAt",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'relationshipType', c."relationshipType",
          'relationshipName', c."relationshipName",
          'village', c.village,
          'mobile', c.mobile,
          'address', c.address,
          'remarks', c.remarks
        ) as customer,
        COALESCE(
          (SELECT json_agg(json_build_object('amount', em.amount, 'date', em.date, 'remarks', em.remarks)) FROM "ExtraMoney" em WHERE em."loanId" = l.id), '[]'
        ) as "extraMoney",
        COALESCE(
          (SELECT json_agg(json_build_object('amountPaid', p."amountPaid", 'paymentDate', p."paymentDate", 'paymentType', p."paymentType", 'remarks', p.remarks)) FROM "Payment" p WHERE p."loanId" = l.id AND p."paymentType" = 'INTEREST_ONLY'), '[]'
        ) as "payments",
        COALESCE(
          (SELECT json_agg(json_build_object('renewalDate', r."renewalDate", 'accumulatedInterest', r."accumulatedInterest")) FROM "LoanRenewal" r WHERE r."loanId" = l.id), '[]'
        ) as "renewals"
      FROM "Loan" l
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE l."releaseStatus" = 'ACTIVE'
    `;

    const portfolioLoans = activeLoansRaw.map((loan: any) => {
      const interestPayments = (loan.payments || [])
        .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
        .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

      const calc = calculateCompoundInterest({
        principal: loan.principal,
        interestRate: loan.interestRate,
        compoundFrequency: loan.compoundFrequency,
        loanDate: loan.loanDate,
        calculationDate: todayStr,
        amountPaid: loan.amountPaid || 0,
        extraMoneyEntries: loan.extraMoney || [],
        interestPaymentEntries: interestPayments,
        renewalEntries: loan.renewals || []
      });

      return {
        ...loan,
        principal: calc.principal,
        weight: Number(loan.weight) || 0,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        outstandingBalance: calc.outstandingBalance
      };
    });

    return res.json({ success: true, data: portfolioLoans });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
