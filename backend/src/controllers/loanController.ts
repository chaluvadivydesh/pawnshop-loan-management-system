import { Request, Response } from 'express';
import { prisma } from '../db';
import { calculateCompoundInterest, getFinancialDays } from '../services/calculatorService';
import { invalidateDashboardCache } from './reportController';

export async function addLoan(req: Request, res: Response) {
  try {
    const {
      customerId,
      itemName,
      itemDescription,
      metalType,
      weight,
      loanDate,
      releaseDate,
      principal,
      interestRate,
      compoundFrequency,
      loanPeriod,
      remarks
    } = req.body;

    if (!customerId || !itemName || !metalType || !weight || !loanDate || !principal || !interestRate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required loan fields (customerId, itemName, metalType, weight, loanDate, principal, interestRate)'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const calc = calculateCompoundInterest({
      principal: Number(principal),
      interestRate: Number(interestRate),
      compoundFrequency: compoundFrequency || 'MONTHLY',
      loanDate,
      calculationDate: todayStr,
      amountPaid: 0
    });

    const loan = await prisma.loan.create({
      data: {
        customerId,
        itemName,
        itemDescription: itemDescription || null,
        metalType: metalType.toUpperCase(),
        weight: Number(weight),
        loanDate,
        releaseDate: releaseDate || null,
        principal: Number(principal),
        interestRate: Number(interestRate),
        compoundFrequency: compoundFrequency || 'MONTHLY',
        loanPeriod: Number(loanPeriod) || 12,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        amountPaid: 0,
        outstandingBalance: calc.outstandingBalance,
        releaseStatus: 'ACTIVE',
        calculationDate: todayStr,
        remarks: remarks || null
      }
    });

    // Touch customer updatedAt
    await prisma.customer.update({
      where: { id: customerId },
      data: { updatedAt: new Date() }
    });

    invalidateDashboardCache();
    res.status(201).json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function syncLoanChainStatuses(
  loanId: string,
  targetStatus: string,
  releaseDate: string | null,
  parentLoanIdParam?: string | null
) {
  try {
    const parentIdToUse = parentLoanIdParam !== undefined
      ? parentLoanIdParam
      : (await prisma.loan.findUnique({ where: { id: loanId }, select: { parentLoanId: true } }))?.parentLoanId;

    // Fast-path: If loan has no parent and no child loans, no chain sync is needed
    if (!parentIdToUse) {
      const childCount = await prisma.loan.count({ where: { parentLoanId: loanId } });
      if (childCount === 0) return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Synchronize all ancestor (parent) loans in the chain
    let currParentId = parentIdToUse;

    while (currParentId) {
      const parent = await prisma.loan.findUnique({
        where: { id: currParentId },
        include: { extraMoney: true, payments: true, renewals: true, partialPayments: true }
      });
      if (!parent) break;

      if (targetStatus === 'RELEASED') {
        const pReleaseDate = releaseDate || todayStr;
        const rem = (parent.remarks || '').toLowerCase();
        const pPartial = (parent as any).partialPayments;
        const isParentRenewed = (parent.renewals && parent.renewals.length > 0) || rem.includes('renew');
        const isParentPartial = (pPartial && pPartial.length > 0) || rem.includes('partial');

        const latestRenewalDate = isParentRenewed && parent.renewals && parent.renewals.length > 0
          ? parent.renewals[parent.renewals.length - 1].renewalDate
          : null;

        const calcDate = isParentRenewed
          ? (latestRenewalDate || parent.calculationDate || pReleaseDate)
          : (parent.calculationDate || pReleaseDate);

        const interestPayments = (parent.payments || [])
          .filter((p) => p.paymentType === 'INTEREST_ONLY')
          .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

        const calc = calculateCompoundInterest({
          principal: parent.principal,
          interestRate: parent.interestRate,
          compoundFrequency: parent.compoundFrequency,
          loanDate: parent.loanDate,
          calculationDate: calcDate,
          amountPaid: 0,
          extraMoneyEntries: parent.extraMoney || [],
          interestPaymentEntries: interestPayments,
          renewalEntries: []
        });

        let parentPaid = 0;
        if (isParentPartial) {
          if (pPartial && pPartial.length > 0) {
            parentPaid = pPartial[pPartial.length - 1].totalAmountPaid;
          } else if (parent.amountPaid > 0) {
            parentPaid = parent.amountPaid;
          }
        }

        await prisma.loan.update({
          where: { id: parent.id },
          data: {
            releaseStatus: 'RELEASED',
            releaseDate: pReleaseDate,
            calculationDate: calcDate,
            amountPaid: parentPaid,
            calculatedInterest: calc.interestEarned,
            finalAmount: calc.finalAmount,
            outstandingBalance: 0
          }
        });
      } else if (targetStatus === 'ACTIVE') {
        const rem = (parent.remarks || '').toLowerCase();
        const hasRenewal = (parent.renewals && parent.renewals.length > 0) || rem.includes('renew');
        const restoredStatus = hasRenewal ? 'RENEWED' : 'PARTIALLY_PAID';
        const interestPayments = (parent.payments || [])
          .filter((p) => p.paymentType === 'INTEREST_ONLY')
          .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));
        const calc = calculateCompoundInterest({
          principal: parent.principal,
          interestRate: parent.interestRate,
          compoundFrequency: parent.compoundFrequency,
          loanDate: parent.loanDate,
          calculationDate: todayStr,
          amountPaid: 0,
          extraMoneyEntries: parent.extraMoney || [],
          interestPaymentEntries: interestPayments,
          renewalEntries: parent.renewals || []
        });

        await prisma.loan.update({
          where: { id: parent.id },
          data: {
            releaseStatus: restoredStatus,
            releaseDate: null,
            calculationDate: todayStr,
            calculatedInterest: calc.interestEarned,
            finalAmount: calc.finalAmount,
            outstandingBalance: 0
          }
        });
      }

      currParentId = parent.parentLoanId;
    }

    // 2. Synchronize all descendant (child) loans in the chain
    const syncChildren = async (parentId: string) => {
      const childLoans = await prisma.loan.findMany({
        where: { parentLoanId: parentId },
        include: { extraMoney: true, payments: true, renewals: true }
      });

      for (const child of childLoans) {
        if (targetStatus === 'RELEASED' && child.releaseStatus !== 'RELEASED') {
          const cReleaseDate = releaseDate || todayStr;
          const interestPayments = (child.payments || [])
            .filter((p) => p.paymentType === 'INTEREST_ONLY')
            .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));
          const calc = calculateCompoundInterest({
            principal: child.principal,
            interestRate: child.interestRate,
            compoundFrequency: child.compoundFrequency,
            loanDate: child.loanDate,
            calculationDate: cReleaseDate,
            amountPaid: 0,
            extraMoneyEntries: child.extraMoney || [],
            interestPaymentEntries: interestPayments,
            renewalEntries: child.renewals || []
          });

          await prisma.loan.update({
            where: { id: child.id },
            data: {
              releaseStatus: 'RELEASED',
              releaseDate: cReleaseDate,
              calculationDate: cReleaseDate,
              amountPaid: calc.finalAmount,
              calculatedInterest: calc.interestEarned,
              finalAmount: calc.finalAmount,
              outstandingBalance: 0
            }
          });

          await syncChildren(child.id);
        } else if (targetStatus === 'ACTIVE' && child.releaseStatus === 'RELEASED') {
          const interestPayments = (child.payments || [])
            .filter((p) => p.paymentType === 'INTEREST_ONLY')
            .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));
          const calc = calculateCompoundInterest({
            principal: child.principal,
            interestRate: child.interestRate,
            compoundFrequency: child.compoundFrequency,
            loanDate: child.loanDate,
            calculationDate: todayStr,
            amountPaid: 0,
            extraMoneyEntries: child.extraMoney || [],
            interestPaymentEntries: interestPayments,
            renewalEntries: child.renewals || []
          });

          await prisma.loan.update({
            where: { id: child.id },
            data: {
              releaseStatus: 'ACTIVE',
              releaseDate: null,
              amountPaid: 0,
              calculationDate: todayStr,
              calculatedInterest: calc.interestEarned,
              finalAmount: calc.finalAmount,
              outstandingBalance: calc.outstandingBalance
            }
          });

          await prisma.payment.deleteMany({
            where: {
              loanId: child.id,
              paymentType: { not: 'INTEREST_ONLY' }
            }
          });

          await syncChildren(child.id);
        }
      }
    };

    await syncChildren(loanId);
  } catch (err) {
    console.error('Error in syncLoanChainStatuses:', err);
  }
}

async function getAllLinkedLoanIds(loanId: string): Promise<string[]> {
  const currentLoan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!currentLoan) return [loanId];

  // Fast-path for standalone loans
  if (!currentLoan.parentLoanId) {
    const childCount = await prisma.loan.count({ where: { parentLoanId: loanId } });
    if (childCount === 0) return [loanId];
  }

  let rootId = loanId;
  let currParentId = currentLoan.parentLoanId;

  const visitedUp = new Set<string>([loanId]);
  while (currParentId && !visitedUp.has(currParentId)) {
    visitedUp.add(currParentId);
    rootId = currParentId;
    const parentLoan = await prisma.loan.findUnique({
      where: { id: currParentId },
      select: { id: true, parentLoanId: true }
    });
    if (!parentLoan) break;
    currParentId = parentLoan.parentLoanId;
  }

  const chainIds = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const pId = queue.shift()!;
    const children = await prisma.loan.findMany({
      where: { parentLoanId: pId },
      select: { id: true }
    });
    for (const child of children) {
      if (!chainIds.has(child.id)) {
        chainIds.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return Array.from(chainIds);
}

export async function updateLoan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      itemName,
      itemDescription,
      metalType,
      weight,
      loanDate,
      releaseDate,
      principal,
      interestRate,
      compoundFrequency,
      loanPeriod,
      remarks,
      amountPaid,
      releaseStatus,
      calculationDate
    } = req.body;

    const existingLoan = await prisma.loan.findUnique({
      where: { id },
      include: { extraMoney: true, payments: true, renewals: true }
    });
    if (!existingLoan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Requested status passed from form / API call
    let targetStatus = releaseStatus !== undefined ? releaseStatus : existingLoan.releaseStatus;
    let targetReleaseDate = releaseDate !== undefined ? releaseDate : existingLoan.releaseDate;
    let targetAmountPaid = amountPaid !== undefined ? Number(amountPaid) : existingLoan.amountPaid;

    // Handle explicit status change logic
    if (targetStatus === 'ACTIVE') {
      targetReleaseDate = null;
      targetAmountPaid = 0;
    } else if (targetStatus === 'RELEASED') {
      targetReleaseDate = releaseDate || existingLoan.releaseDate || todayStr;
    } else if (targetStatus === 'RENEWED') {
      targetStatus = 'RENEWED';
    } else if (targetStatus === 'PARTIALLY_PAID') {
      targetStatus = 'PARTIALLY_PAID';
    }

    const calcDate = targetStatus === 'ACTIVE' ? todayStr : (calculationDate || existingLoan.calculationDate || targetReleaseDate || todayStr);

    const p = principal !== undefined ? Number(principal) : existingLoan.principal;
    const r = interestRate !== undefined ? Number(interestRate) : existingLoan.interestRate;
    const freq = compoundFrequency || existingLoan.compoundFrequency;
    const lDate = loanDate || existingLoan.loanDate;

    const interestPayments = (existingLoan.payments || [])
      .filter((pay) => pay.paymentType === 'INTEREST_ONLY')
      .map((pay) => ({ amount: pay.amountPaid, paymentDate: pay.paymentDate, remarks: pay.remarks }));

    const calc = calculateCompoundInterest({
      principal: p,
      interestRate: r,
      compoundFrequency: freq,
      loanDate: lDate,
      calculationDate: calcDate,
      amountPaid: targetAmountPaid,
      extraMoneyEntries: existingLoan.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: existingLoan.renewals || []
    });

    if (targetStatus === 'RELEASED' && targetAmountPaid === 0) {
      targetAmountPaid = calc.finalAmount;
    }

    let finalOutstanding = calc.outstandingBalance;
    if (targetStatus === 'RELEASED' || targetStatus === 'RENEWED' || targetStatus === 'PARTIALLY_PAID') {
      finalOutstanding = 0;
    } else if (targetStatus === 'ACTIVE') {
      finalOutstanding = calc.outstandingBalance;
    }

    const updatedLoan = await prisma.loan.update({
      where: { id },
      data: {
        itemName,
        itemDescription,
        metalType: metalType ? metalType.toUpperCase() : undefined,
        weight: weight !== undefined ? Number(weight) : undefined,
        loanDate: lDate,
        releaseDate: targetReleaseDate,
        principal: p,
        interestRate: r,
        compoundFrequency: freq,
        loanPeriod: loanPeriod !== undefined ? Number(loanPeriod) : undefined,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        amountPaid: targetAmountPaid,
        outstandingBalance: finalOutstanding,
        releaseStatus: targetStatus,
        calculationDate: calcDate,
        remarks
      }
    });

    if (targetStatus === 'ACTIVE') {
      await prisma.payment.deleteMany({
        where: {
          loanId: id,
          paymentType: { not: 'INTEREST_ONLY' }
        }
      });
    }

    if (targetStatus === 'RELEASED' || targetStatus === 'ACTIVE') {
      await syncLoanChainStatuses(id, targetStatus, targetReleaseDate);
    }

    // Synchronize linked parent and child loan records
    const linkedLoanIds = await getAllLinkedLoanIds(id);
    const otherLinkedIds = linkedLoanIds.filter((lId) => lId !== id);

    if (otherLinkedIds.length > 0) {
      const isItemNameEdited = itemName !== undefined;
      const isItemWeightEdited = weight !== undefined;
      const isMetalTypeEdited = metalType !== undefined;
      const isFreqEdited = compoundFrequency !== undefined;
      const isPrincipalEdited = principal !== undefined;

      for (const otherId of otherLinkedIds) {
        const otherLoan = await prisma.loan.findUnique({
          where: { id: otherId },
          include: { extraMoney: true, payments: true, renewals: true }
        });
        if (!otherLoan) continue;

        const isOtherParent = otherLoan.releaseStatus === 'PARTIALLY_PAID' || otherLoan.releaseStatus === 'RENEWED';

        const newName = isItemNameEdited ? itemName : otherLoan.itemName;
        const newWeight = isItemWeightEdited ? Number(weight) : otherLoan.weight;
        const newMetal = isMetalTypeEdited ? metalType.toUpperCase() : otherLoan.metalType;
        const newFreq = isFreqEdited ? compoundFrequency : otherLoan.compoundFrequency;
        const newP = (isPrincipalEdited && !isOtherParent) ? Number(principal) : otherLoan.principal;

        const otherInterestPayments = (otherLoan.payments || [])
          .filter((pay) => pay.paymentType === 'INTEREST_ONLY')
          .map((pay) => ({ amount: pay.amountPaid, paymentDate: pay.paymentDate, remarks: pay.remarks }));

        const otherCalcDate = otherLoan.releaseStatus === 'ACTIVE'
          ? todayStr
          : (otherLoan.calculationDate || otherLoan.releaseDate || todayStr);

        const otherCalc = calculateCompoundInterest({
          principal: newP,
          interestRate: otherLoan.interestRate,
          compoundFrequency: newFreq,
          loanDate: otherLoan.loanDate,
          calculationDate: otherCalcDate,
          amountPaid: otherLoan.amountPaid,
          extraMoneyEntries: otherLoan.extraMoney || [],
          interestPaymentEntries: otherInterestPayments,
          renewalEntries: otherLoan.renewals || []
        });

        let otherOutstanding = otherCalc.outstandingBalance;
        if (otherLoan.releaseStatus === 'RELEASED' || otherLoan.releaseStatus === 'RENEWED' || otherLoan.releaseStatus === 'PARTIALLY_PAID') {
          otherOutstanding = 0;
        }

        await prisma.loan.update({
          where: { id: otherId },
          data: {
            itemName: newName,
            weight: newWeight,
            metalType: newMetal,
            compoundFrequency: newFreq,
            principal: newP,
            calculatedInterest: otherCalc.interestEarned,
            finalAmount: otherCalc.finalAmount,
            outstandingBalance: otherOutstanding
          }
        });
      }
    }

    await prisma.customer.update({
      where: { id: updatedLoan.customerId },
      data: { updatedAt: new Date() }
    });

    invalidateDashboardCache();
    res.json({ success: true, data: updatedLoan });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function releaseLoan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amountPaid, releaseDate, remarks } = req.body;

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const rDate = releaseDate || todayStr;
    const newAmountPaid = Number(amountPaid) || 0;

    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: rDate,
      amountPaid: newAmountPaid
    });

    const isFullyPaid = newAmountPaid >= calc.finalAmount;
    const releaseStatus = isFullyPaid ? 'RELEASED' : 'ACTIVE';
    const outstandingBalance = isFullyPaid ? 0 : Math.max(0, calc.finalAmount - newAmountPaid);

    const [, updated] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          loanId: id,
          paymentDate: rDate,
          amountPaid: isFullyPaid ? newAmountPaid : Math.max(0, newAmountPaid - loan.amountPaid),
          balanceAfterPayment: outstandingBalance,
          remarks: remarks || `Release payment of Rs. ${newAmountPaid}`
        }
      }),
      prisma.loan.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          releaseDate: rDate,
          calculatedInterest: calc.interestEarned,
          finalAmount: calc.finalAmount,
          outstandingBalance,
          releaseStatus,
          calculationDate: rDate,
          remarks: remarks || loan.remarks
        }
      }),
      prisma.customer.update({
        where: { id: loan.customerId },
        data: { updatedAt: new Date() }
      })
    ]);

    if (releaseStatus === 'RELEASED') {
      await syncLoanChainStatuses(id, 'RELEASED', rDate, loan.parentLoanId);
    }

    invalidateDashboardCache();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAllDescendantLoanIds(parentId: string): Promise<string[]> {
  const queue = [parentId];
  const descendantIds: string[] = [];

  while (queue.length > 0) {
    const pId = queue.shift()!;
    const children = await prisma.loan.findMany({
      where: { parentLoanId: pId },
      select: { id: true }
    });
    for (const child of children) {
      descendantIds.push(child.id);
      queue.push(child.id);
    }
  }
  return descendantIds;
}

export async function deleteLoan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        extraMoney: true,
        payments: true,
        renewals: true,
        partialPayments: true
      }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // CASE 1 & CASE 2: Restoring Parent Loan if this is a Child record (Partially Paid or Renewed)
    if (loan.parentLoanId) {
      const parentLoan = await prisma.loan.findUnique({
        where: { id: loan.parentLoanId },
        include: { extraMoney: true, payments: true, renewals: true, partialPayments: true }
      });

      if (parentLoan) {
        // Remove Partial Payment & Renewal records on Parent loan
        await prisma.partialPayment.deleteMany({
          where: {
            OR: [
              { loanId: parentLoan.id },
              { newLoanId: loan.id }
            ]
          }
        });

        await prisma.loanRenewal.deleteMany({
          where: { loanId: parentLoan.id }
        });

        // Remove settlement/partial payment log entries from Parent loan
        await prisma.payment.deleteMany({
          where: {
            loanId: parentLoan.id,
            paymentType: { in: ['PARTIAL_PAYMENT', 'REGULAR'] },
            OR: [
              { paymentType: 'PARTIAL_PAYMENT' },
              { remarks: { contains: 'Renewal' } },
              { remarks: { contains: 'Settled on Renewal' } }
            ]
          }
        });

        // Calculate restored interest & balance for Parent loan from original loan date to today
        const parentInterestPayments = (parentLoan.payments || [])
          .filter((p) => p.paymentType === 'INTEREST_ONLY')
          .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

        const calc = calculateCompoundInterest({
          principal: parentLoan.principal,
          interestRate: parentLoan.interestRate,
          compoundFrequency: parentLoan.compoundFrequency,
          loanDate: parentLoan.loanDate,
          calculationDate: todayStr,
          amountPaid: 0,
          extraMoneyEntries: parentLoan.extraMoney || [],
          interestPaymentEntries: parentInterestPayments,
          renewalEntries: []
        });

        // Restore Parent loan to ACTIVE state
        await prisma.loan.update({
          where: { id: parentLoan.id },
          data: {
            releaseStatus: 'ACTIVE',
            releaseDate: null,
            amountPaid: 0,
            calculationDate: todayStr,
            calculatedInterest: calc.interestEarned,
            finalAmount: calc.finalAmount,
            outstandingBalance: calc.outstandingBalance
          }
        });
      }
    }

    // CASE 3: Delete target loan and all of its descendant child loans recursively
    const descendantIds = await getAllDescendantLoanIds(id);
    const allIdsToDelete = [id, ...descendantIds];

    // Clean up all transaction history belonging to those records
    await prisma.payment.deleteMany({ where: { loanId: { in: allIdsToDelete } } });
    await prisma.extraMoney.deleteMany({ where: { loanId: { in: allIdsToDelete } } });
    await prisma.loanRenewal.deleteMany({ where: { loanId: { in: allIdsToDelete } } });
    await prisma.partialPayment.deleteMany({
      where: {
        OR: [
          { loanId: { in: allIdsToDelete } },
          { newLoanId: { in: allIdsToDelete } }
        ]
      }
    });

    // Delete loan records
    await prisma.loan.deleteMany({ where: { id: { in: allIdsToDelete } } });

    await prisma.customer.update({
      where: { id: loan.customerId },
      data: { updatedAt: new Date() }
    });

    invalidateDashboardCache();
    res.json({ success: true, message: 'Loan record and linked records deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function batchUpdateCalculations(req: Request, res: Response) {
  try {
    const { loans } = req.body; // Array of updated loan calculation objects

    if (!Array.isArray(loans) || loans.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of loan calculations required' });
    }

    const updatedLoans = [];

    for (const item of loans) {
      const {
        id,
        principal,
        interestRate,
        compoundFrequency,
        loanDate,
        calculationDate,
        amountPaid,
        remarks
      } = item;

      if (!id) continue;

      const existing = await prisma.loan.findUnique({ where: { id } });
      if (!existing) continue;

      const todayStr = new Date().toISOString().split('T')[0];
      const calcDate = calculationDate || todayStr;
      const p = principal !== undefined ? Number(principal) : existing.principal;
      const r = interestRate !== undefined ? Number(interestRate) : existing.interestRate;
      const freq = compoundFrequency || existing.compoundFrequency;
      const lDate = loanDate || existing.loanDate;
      const paid = amountPaid !== undefined ? Number(amountPaid) : existing.amountPaid;

      const calc = calculateCompoundInterest({
        principal: p,
        interestRate: r,
        compoundFrequency: freq,
        loanDate: lDate,
        calculationDate: calcDate,
        amountPaid: paid
      });

      const isFullyPaid = paid >= calc.finalAmount;
      const releaseStatus = isFullyPaid ? 'RELEASED' : existing.releaseStatus;
      const outstandingBalance = releaseStatus === 'RELEASED' ? 0 : calc.outstandingBalance;

      const updated = await prisma.loan.update({
        where: { id },
        data: {
          principal: p,
          interestRate: r,
          compoundFrequency: freq,
          loanDate: lDate,
          calculationDate: calcDate,
          calculatedInterest: calc.interestEarned,
          finalAmount: calc.finalAmount,
          amountPaid: paid,
          outstandingBalance,
          releaseStatus,
          remarks: remarks !== undefined ? remarks : existing.remarks
        }
      });

      updatedLoans.push(updated);
    }

    res.json({ success: true, count: updatedLoans.length, data: updatedLoans });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function addExtraMoney(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, date, remarks } = req.body;

    const extraAmt = Number(amount);
    if (!extraAmt || extraAmt <= 0) {
      return res.status(400).json({ success: false, error: 'Valid extra amount is required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { extraMoney: true, payments: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const emDate = date || todayStr;

    const extraEntry = await prisma.extraMoney.create({
      data: {
        loanId: id,
        amount: extraAmt,
        date: emDate,
        remarks: remarks || `Extra money borrowing of Rs. ${extraAmt}`
      }
    });

    await prisma.customer.update({
      where: { id: loan.customerId },
      data: { updatedAt: new Date() }
    });

    invalidateDashboardCache();
    res.status(201).json({ success: true, data: extraEntry });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function addInterestPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amountPaid, paymentDate, remarks } = req.body;

    const paid = Number(amountPaid);
    if (!paid || paid <= 0) {
      return res.status(400).json({ success: false, error: 'Valid interest payment amount is required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { extraMoney: true, payments: true, renewals: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pDate = paymentDate || todayStr;

    const existingInterestPayments = (loan.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const allInterestPayments = [
      ...existingInterestPayments,
      { amount: paid, paymentDate: pDate, remarks: remarks || `Interest payment of Rs. ${paid}` }
    ];

    const postPaymentCalc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: todayStr,
      amountPaid: loan.amountPaid,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: allInterestPayments,
      renewalEntries: loan.renewals || []
    });

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          loanId: id,
          paymentDate: pDate,
          amountPaid: paid,
          balanceAfterPayment: postPaymentCalc.outstandingBalance,
          paymentType: 'INTEREST_ONLY',
          remarks: remarks || `Interest payment of Rs. ${paid}`
        }
      }),
      prisma.loan.update({
        where: { id },
        data: {
          calculatedInterest: postPaymentCalc.interestEarned,
          finalAmount: postPaymentCalc.finalAmount,
          outstandingBalance: postPaymentCalc.outstandingBalance,
          calculationDate: todayStr
        }
      }),
      prisma.customer.update({
        where: { id: loan.customerId },
        data: { updatedAt: new Date() }
      })
    ]);

    invalidateDashboardCache();
    res.status(201).json({ success: true, data: payment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function renewLoan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { renewalDate, newLoanPeriod, remarks } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { extraMoney: true, payments: true, renewals: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const rDate = renewalDate || todayStr;
    const periodMonths = Number(newLoanPeriod) || loan.loanPeriod || 12;

    const interestPayments = (loan.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: rDate,
      amountPaid: loan.amountPaid,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: interestPayments
    });

    const previousPrincipal = calc.principal;
    const daysBetween = getFinancialDays(loan.loanDate, rDate);
    const accumulatedInterest = daysBetween <= 1 ? 0 : calc.interestEarned;
    const newPrincipal = previousPrincipal + accumulatedInterest;

    const newLoanCalc = calculateCompoundInterest({
      principal: newPrincipal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: rDate,
      calculationDate: todayStr,
      amountPaid: 0
    });

    const [renewalEntry, updatedOriginalLoan, , newLoanRecord] = await prisma.$transaction([
      prisma.loanRenewal.create({
        data: {
          loanId: id,
          renewalDate: rDate,
          previousPrincipal,
          accumulatedInterest,
          newPrincipal,
          newLoanPeriod: periodMonths,
          remarks: remarks || `Renewed loan for ${periodMonths} months`
        }
      }),
      prisma.loan.update({
        where: { id },
        data: {
          releaseStatus: 'RENEWED',
          amountPaid: newPrincipal,
          calculatedInterest: calc.interestEarned,
          finalAmount: calc.finalAmount,
          outstandingBalance: 0,
          releaseDate: rDate,
          calculationDate: rDate
        }
      }),
      prisma.payment.create({
        data: {
          loanId: id,
          paymentDate: rDate,
          amountPaid: newPrincipal,
          balanceAfterPayment: 0,
          paymentType: 'REGULAR',
          remarks: remarks || `Settled on Renewal (Amount Paid: ₹${newPrincipal.toLocaleString('en-IN')})`
        }
      }),
      prisma.loan.create({
        data: {
          customerId: loan.customerId,
          parentLoanId: loan.id,
          itemName: loan.itemName,
          itemDescription: loan.itemDescription,
          metalType: loan.metalType,
          weight: loan.weight,
          principal: newPrincipal,
          interestRate: loan.interestRate,
          compoundFrequency: loan.compoundFrequency,
          loanPeriod: periodMonths,
          loanDate: rDate,
          calculatedInterest: newLoanCalc.interestEarned,
          finalAmount: newLoanCalc.finalAmount,
          amountPaid: 0,
          outstandingBalance: newLoanCalc.outstandingBalance,
          releaseStatus: 'ACTIVE',
          calculationDate: todayStr,
          remarks: remarks || `Renewed loan from previous loan date ${loan.loanDate} (Previous Principal: ₹${loan.principal.toLocaleString('en-IN')})`
        }
      }),
      prisma.customer.update({
        where: { id: loan.customerId },
        data: { updatedAt: new Date() }
      })
    ]);

    invalidateDashboardCache();
    res.status(200).json({
      success: true,
      data: {
        renewal: renewalEntry,
        originalLoan: updatedOriginalLoan,
        newLoan: newLoanRecord
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateExtraMoney(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, date, remarks } = req.body;

    const extra = await prisma.extraMoney.update({
      where: { id },
      data: {
        amount: Number(amount),
        date,
        remarks
      }
    });

    invalidateDashboardCache();
    res.json({ success: true, data: extra });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteExtraMoney(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.extraMoney.delete({ where: { id } });
    invalidateDashboardCache();
    res.json({ success: true, message: 'Extra money entry deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deletePayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.payment.delete({ where: { id } });
    invalidateDashboardCache();
    res.json({ success: true, message: 'Payment entry deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteRenewal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.loanRenewal.delete({ where: { id } });
    invalidateDashboardCache();
    res.json({ success: true, message: 'Renewal record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function addPartialPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paymentDate, paymentType, amount, remarks } = req.body;

    const totalPaid = Number(amount);
    if (!totalPaid || totalPaid <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    if (!paymentType || !['PRINCIPAL_PLUS_INTEREST', 'PRINCIPAL_ONLY'].includes(paymentType)) {
      return res.status(400).json({ success: false, error: 'Invalid payment type. Must be PRINCIPAL_PLUS_INTEREST or PRINCIPAL_ONLY' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { extraMoney: true, payments: true, renewals: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pDate = paymentDate || todayStr;

    const interestPayments = (loan.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: pDate,
      amountPaid: loan.amountPaid,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: loan.renewals || []
    });

    const previousPrincipal = calc.principal;
    const outstandingInterest = calc.interestEarned;

    let interestPaid = 0;
    let principalPaid = 0;
    let newPrincipal = 0;

    if (paymentType === 'PRINCIPAL_PLUS_INTEREST') {
      // 1. Clear all outstanding interest first
      interestPaid = Math.min(totalPaid, outstandingInterest);
      const remainingPayment = Math.max(0, totalPaid - interestPaid);
      // 2. Remaining amount automatically reduces principal
      principalPaid = Math.min(previousPrincipal, remainingPayment);
      newPrincipal = Math.max(0, previousPrincipal - principalPaid);
    } else {
      // PRINCIPAL_ONLY: Customer pays against principal. Unpaid interest is capitalized into new principal.
      interestPaid = 0;
      principalPaid = Math.min(previousPrincipal, totalPaid);
      const remainingPrincipalAfterCash = Math.max(0, previousPrincipal - principalPaid);
      newPrincipal = remainingPrincipalAfterCash + outstandingInterest;
    }

    const newLoanCalc = calculateCompoundInterest({
      principal: newPrincipal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: pDate,
      calculationDate: todayStr,
      amountPaid: 0
    });

    // Create NEW active partial loan record
    const newLoanRecord = await prisma.loan.create({
      data: {
        customerId: loan.customerId,
        parentLoanId: loan.id,
        itemName: loan.itemName,
        itemDescription: loan.itemDescription,
        metalType: loan.metalType,
        weight: loan.weight,
        principal: newPrincipal,
        interestRate: loan.interestRate,
        compoundFrequency: loan.compoundFrequency,
        loanPeriod: loan.loanPeriod || 12,
        loanDate: pDate,
        calculatedInterest: newLoanCalc.interestEarned,
        finalAmount: newLoanCalc.finalAmount,
        amountPaid: 0,
        outstandingBalance: newLoanCalc.outstandingBalance,
        releaseStatus: 'ACTIVE',
        calculationDate: todayStr,
        remarks: remarks || `Partially Paid Item (Previous Loan Date: ${loan.loanDate}, Previous Principal: ₹${loan.principal.toLocaleString('en-IN')}, Cash Paid: ₹${totalPaid.toLocaleString('en-IN')}, Mode: ${paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'P+I' : 'P'})`
      }
    });

    const [updatedOriginalLoan, partialPaymentEntry] = await prisma.$transaction([
      prisma.loan.update({
        where: { id },
        data: {
          releaseStatus: 'PARTIALLY_PAID',
          calculationDate: pDate
        }
      }),
      prisma.partialPayment.create({
        data: {
          loanId: id,
          newLoanId: newLoanRecord.id,
          paymentDate: pDate,
          paymentType,
          totalAmountPaid: totalPaid,
          interestPaid,
          principalPaid,
          previousPrincipal,
          outstandingInterest,
          newPrincipal,
          remarks: remarks || `Partial Payment (${paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'Principal + Interest' : 'Principal Only'})`
        }
      }),
      prisma.payment.create({
        data: {
          loanId: id,
          paymentDate: pDate,
          amountPaid: totalPaid,
          balanceAfterPayment: newPrincipal,
          paymentType: 'PARTIAL_PAYMENT',
          remarks: remarks || `Partial Payment (${paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'P+I' : 'P Only'}): Cash Paid ₹${totalPaid.toLocaleString('en-IN')}, New Principal ₹${newPrincipal.toLocaleString('en-IN')}`
        }
      }),
      prisma.customer.update({
        where: { id: loan.customerId },
        data: { updatedAt: new Date() }
      })
    ]);

    invalidateDashboardCache();
    res.status(200).json({
      success: true,
      data: {
        partialPayment: partialPaymentEntry,
        originalLoan: updatedOriginalLoan,
        newLoan: newLoanRecord
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
