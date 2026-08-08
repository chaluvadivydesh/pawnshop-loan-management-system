import { Request, Response } from 'express';
import { prisma } from '../db';
import { calculateCompoundInterest } from '../services/calculatorService';
import { invalidateDashboardCache } from './reportController';

export async function addPayment(req: Request, res: Response) {
  try {
    const { loanId } = req.params;
    const { amount, paymentDate, remarks } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pDate = paymentDate || todayStr;
    const paymentAmt = Number(amount);
    const newTotalPaid = loan.amountPaid + paymentAmt;

    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: pDate,
      amountPaid: newTotalPaid
    });

    const isFullyPaid = newTotalPaid >= calc.finalAmount;
    const releaseStatus = isFullyPaid ? 'RELEASED' : 'ACTIVE';
    const outstandingBalance = isFullyPaid ? 0 : Math.max(0, calc.finalAmount - newTotalPaid);

    const payment = await prisma.payment.create({
      data: {
        loanId,
        paymentDate: pDate,
        amountPaid: paymentAmt,
        balanceAfterPayment: outstandingBalance,
        remarks: remarks || `Payment of Rs. ${paymentAmt}`
      }
    });

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        amountPaid: newTotalPaid,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        outstandingBalance,
        releaseStatus,
        calculationDate: pDate,
        releaseDate: isFullyPaid ? pDate : loan.releaseDate
      }
    });

    invalidateDashboardCache();
    res.status(201).json({ success: true, data: { payment, loan: updatedLoan } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const { loanId } = req.params;
    const payments = await prisma.payment.findMany({
      where: { loanId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
