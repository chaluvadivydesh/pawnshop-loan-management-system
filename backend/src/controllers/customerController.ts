import { Request, Response } from 'express';
import { prisma } from '../db';
import { calculateCompoundInterest } from '../services/calculatorService';
import { invalidateDashboardCache } from './reportController';

export async function autoRepairParentLoanLinks() {
  try {
    const unlinkedLoans = await prisma.loan.findMany({
      where: {
        parentLoanId: null,
        OR: [
          { remarks: { contains: 'renew', mode: 'insensitive' } },
          { remarks: { contains: 'partial', mode: 'insensitive' } }
        ]
      }
    });

    if (unlinkedLoans.length === 0) return;

    for (const child of unlinkedLoans) {
      // Try to find matching renewal
      const matchingRenewal = await prisma.loanRenewal.findFirst({
        where: {
          newPrincipal: child.principal,
          renewalDate: child.loanDate,
          loan: { customerId: child.customerId }
        }
      });

      if (matchingRenewal) {
        await prisma.loan.update({
          where: { id: child.id },
          data: { parentLoanId: matchingRenewal.loanId }
        });
        continue;
      }

      // Try to find matching partial payment
      const matchingPartial = await prisma.partialPayment.findFirst({
        where: {
          newPrincipal: child.principal,
          paymentDate: child.loanDate,
          loan: { customerId: child.customerId }
        }
      });

      if (matchingPartial) {
        await prisma.loan.update({
          where: { id: child.id },
          data: { parentLoanId: matchingPartial.loanId }
        });
      }
    }
  } catch (err) {
    console.error('Error auto-repairing parent loan links:', err);
  }
}

let cachedCustomersFormatted: { data: any[]; timestamp: number; dateStr: string } | null = null;
const CUSTOMER_CACHE_TTL_MS = 30 * 1000;

export function invalidateCustomerCache() {
  cachedCustomersFormatted = null;
}

export async function warmupCustomerCache() {
  try {
    const fakeReq = { query: {} } as any;
    const fakeRes = { json: () => {} } as any;
    await getAllCustomers(fakeReq, fakeRes);
  } catch (e) {
    console.error('Error warming customer cache:', e);
  }
}

export async function getAllCustomers(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || '').trim().toLowerCase();
    const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : null;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : null;
    const todayStr = new Date().toISOString().split('T')[0];

    let formatted: any[];

    if (
      cachedCustomersFormatted &&
      cachedCustomersFormatted.dateStr === todayStr &&
      Date.now() - cachedCustomersFormatted.timestamp < CUSTOMER_CACHE_TTL_MS
    ) {
      formatted = cachedCustomersFormatted.data;
    } else {
      const customers: any[] = await prisma.$queryRaw`
      SELECT 
        c.id, c.name, c."relationshipType", c."relationshipName", c.village, c.mobile, c.address, c.remarks, c."updatedAt", c."createdAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', l.id,
              'principal', l.principal,
              'interestRate', l."interestRate",
              'compoundFrequency', l."compoundFrequency",
              'loanDate', l."loanDate",
              'releaseStatus', l."releaseStatus",
              'amountPaid', l."amountPaid",
              'parentLoanId', l."parentLoanId",
              'extraMoney', (
                SELECT COALESCE(json_agg(json_build_object('amount', em.amount, 'date', em.date, 'remarks', em.remarks)), '[]')
                FROM "ExtraMoney" em WHERE em."loanId" = l.id
              ),
              'payments', (
                SELECT COALESCE(json_agg(json_build_object('amountPaid', p."amountPaid", 'paymentDate', p."paymentDate", 'paymentType', p."paymentType", 'remarks', p.remarks)), '[]')
                FROM "Payment" p WHERE p."loanId" = l.id AND p."paymentType" = 'INTEREST_ONLY'
              ),
              'renewals', (
                SELECT COALESCE(json_agg(json_build_object('renewalDate', r."renewalDate", 'accumulatedInterest', r."accumulatedInterest")), '[]')
                FROM "LoanRenewal" r WHERE r."loanId" = l.id
              )
            )
          ) FILTER (WHERE l.id IS NOT NULL), '[]'
        ) as loans
      FROM "Customer" c
      LEFT JOIN "Loan" l ON l."customerId" = c.id
      GROUP BY c.id
      ORDER BY c."updatedAt" DESC
    `;

      formatted = customers.map((cust: any) => {
        const custLoans: any[] = cust.loans || [];
        const parentIdSet = new Set(custLoans.map((l: any) => l.parentLoanId).filter(Boolean));
        const activeLoans = custLoans.filter((l: any) => l.releaseStatus === 'ACTIVE');
        const releasedLoans = custLoans.filter((l: any) => l.releaseStatus === 'RELEASED' && !parentIdSet.has(l.id));

        let totalOutstanding = 0;
        custLoans.forEach((loan: any) => {
          if (loan.releaseStatus === 'ACTIVE') {
            const calcDate = todayStr;
            const interestPayments = (loan.payments || [])
              .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
              .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));
            const effectivePaid = loan.releaseStatus === 'ACTIVE' ? 0 : loan.amountPaid;
            const calc = calculateCompoundInterest({
              principal: loan.principal,
              interestRate: loan.interestRate,
              compoundFrequency: loan.compoundFrequency,
              loanDate: loan.loanDate,
              calculationDate: calcDate,
              amountPaid: effectivePaid,
              extraMoneyEntries: loan.extraMoney || [],
              interestPaymentEntries: interestPayments,
              renewalEntries: (loan as any).renewals || []
            });
            totalOutstanding += calc.outstandingBalance;
          }
        });

        return {
          id: cust.id,
          name: cust.name,
          relationshipType: cust.relationshipType,
          relationshipName: cust.relationshipName,
          village: cust.village,
          mobile: cust.mobile,
          address: cust.address,
          remarks: cust.remarks,
          activeLoansCount: activeLoans.length,
          releasedLoansCount: releasedLoans.length,
          totalOutstanding,
          lastUpdatedDate: new Date(cust.updatedAt).toISOString().split('T')[0],
          createdAt: cust.createdAt
        };
      });

      cachedCustomersFormatted = {
        data: formatted,
        timestamp: Date.now(),
        dateStr: todayStr
      };
    }

    const filtered = q
      ? formatted.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.mobile.toLowerCase().includes(q) ||
            c.village.toLowerCase().includes(q)
        )
      : formatted;

    if (pageParam && limitParam && pageParam > 0 && limitParam > 0) {
      const startIndex = (pageParam - 1) * limitParam;
      const paginated = filtered.slice(startIndex, startIndex + limitParam);
      return res.json({
        success: true,
        data: paginated,
        total: filtered.length,
        page: pageParam,
        limit: limitParam,
        totalPages: Math.ceil(filtered.length / limitParam)
      });
    }

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCustomerById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        loans: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' }
            },
            extraMoney: {
              orderBy: { createdAt: 'asc' }
            },
            renewals: {
              orderBy: { createdAt: 'asc' }
            },
            partialPayments: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const parentIdSet = new Set(customer.loans.map((l) => l.parentLoanId).filter(Boolean));
    const activeLoans = customer.loans.filter((l) => l.releaseStatus === 'ACTIVE');
    const releasedLoans = customer.loans.filter((l) => l.releaseStatus === 'RELEASED' && !parentIdSet.has(l.id));

    let totalOutstanding = 0;

    const loansWithCalc = customer.loans.map((loan) => {
      const isRenewedParent = loan.releaseStatus === 'RENEWED';
      const latestRenewalDate = (loan.renewals && loan.renewals.length > 0)
        ? loan.renewals[loan.renewals.length - 1].renewalDate
        : null;

      const calcDate = loan.releaseStatus === 'ACTIVE'
        ? todayStr
        : isRenewedParent
        ? (latestRenewalDate || loan.calculationDate || todayStr)
        : (loan.calculationDate || loan.releaseDate || todayStr);

      const interestPayments = (loan.payments || [])
        .filter((p) => p.paymentType === 'INTEREST_ONLY')
        .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

      const effectivePaid = loan.releaseStatus === 'ACTIVE' ? 0 : loan.amountPaid;

      const calc = calculateCompoundInterest({
        principal: loan.principal,
        interestRate: loan.interestRate,
        compoundFrequency: loan.compoundFrequency,
        loanDate: loan.loanDate,
        calculationDate: calcDate,
        amountPaid: effectivePaid,
        extraMoneyEntries: loan.extraMoney || [],
        interestPaymentEntries: interestPayments,
        renewalEntries: isRenewedParent ? [] : ((loan as any).renewals || [])
      });

      if (loan.releaseStatus === 'ACTIVE') {
        totalOutstanding += calc.outstandingBalance;
      }

      const pa = (loan as any).partialPayments;
      const calcAmountPaid = loan.releaseStatus === 'PARTIALLY_PAID'
        ? (pa && pa.length > 0 ? pa[pa.length - 1].totalAmountPaid : (loan.amountPaid > 0 ? loan.amountPaid : 0))
        : (loan.releaseStatus === 'RELEASED' ? loan.amountPaid : 0);

      return {
        ...loan,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        amountPaid: calcAmountPaid,
        outstandingBalance: (loan.releaseStatus === 'RELEASED' || loan.releaseStatus === 'RENEWED' || loan.releaseStatus === 'PARTIALLY_PAID') ? 0 : calc.outstandingBalance,
        calculatedDays: calc.totalDays,
        years: calc.years,
        months: calc.months,
        days: calc.days
      };
    });

    res.json({
      success: true,
      data: {
        ...customer,
        activeLoansCount: activeLoans.length,
        releasedLoansCount: releasedLoans.length,
        totalOutstanding,
        loans: loansWithCalc
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const { name, relationshipType, relationshipName, village, mobile, address, remarks } = req.body;

    if (!name || !relationshipType || !relationshipName || !village || !mobile) {
      return res.status(400).json({
        success: false,
        error: 'Name, Relationship Type, Father/Husband Name, Village, and Mobile are required'
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        relationshipType,
        relationshipName,
        village,
        mobile,
        address: address || null,
        remarks: remarks || null
      }
    });

    invalidateDashboardCache();
    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, relationshipType, relationshipName, village, mobile, address, remarks } = req.body;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        relationshipType,
        relationshipName,
        village,
        mobile,
        address,
        remarks
      }
    });

    invalidateDashboardCache();
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.customer.delete({
      where: { id }
    });

    invalidateDashboardCache();
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
