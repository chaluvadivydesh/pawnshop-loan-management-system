import { CalculationInput, CalculationResult, ComponentBreakdown, ExtraMoneyItem, InterestPaymentItem, LoanRenewalItem } from '../types';
import { isValidCalendarDate, parseDateComponents } from './dateUtils';

export function getFinancialDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr || !isValidCalendarDate(startDateStr) || !isValidCalendarDate(endDateStr)) return 0;
  const startComp = parseDateComponents(startDateStr);
  const endComp = parseDateComponents(endDateStr);

  if (!startComp || !endComp) return 0;

  const { year: sy, month: sm, day: sd } = startComp;
  const { year: ey, month: em, day: ed } = endComp;

  const totalFinancialDays = (ey - sy) * 360 + (em - sm) * 30 + (ed - sd);
  return Math.max(0, totalFinancialDays);
}

export function getCycleDays(frequency: string): number {
  switch ((frequency || 'YEARLY').toUpperCase()) {
    case 'MONTHLY':
      return 30;
    case 'THREE_MONTHS':
      return 90;
    case 'SIX_MONTHS':
      return 180;
    case 'YEARLY':
      return 360;
    default:
      return 360;
  }
}

/**
 * Mathematically Rigorous Timeline-Based Finance Engine:
 * 1. Evaluates latest Renewal (resets base principal & base start date).
 * 2. Evaluates latest Interest Payment (resets interest start date for active prior principal).
 * 3. Evaluates Extra Money entries independently (interest calculated strictly from issue date).
 * 4. Floor rounding applied at every compounding cycle & remaining day calculation step.
 * 5. Generates step-by-step itemized componentBreakdowns for Extra Money & Multi-Year durations.
 */
export function calculateCompoundInterest(input: CalculationInput): CalculationResult {
  const {
    principal,
    interestRate,
    compoundFrequency = 'YEARLY',
    loanDate,
    calculationDate,
    amountPaid = 0,
    extraMoneyEntries = [],
    interestPaymentEntries = [],
    renewalEntries = []
  } = input;

  const initialP = Math.floor(principal) || 0;

  // Return uncalculated/zero interest result if either date is invalid
  if (!loanDate || !calculationDate || !isValidCalendarDate(loanDate) || !isValidCalendarDate(calculationDate)) {
    return {
      principal: initialP,
      interestRate,
      compoundFrequency,
      totalDays: 0,
      years: 0,
      months: 0,
      days: 0,
      interestEarned: 0,
      finalAmount: initialP,
      amountPaid: Math.floor(amountPaid),
      outstandingBalance: Math.max(0, initialP - Math.floor(amountPaid)),
      remainingDays: 0,
      remainingInterest: 0,
      totalExtraMoney: 0,
      breakdownSteps: [],
      componentBreakdowns: []
    };
  }
  const cycleDays = getCycleDays(compoundFrequency);

  // 1. Evaluate Renewals: Find latest renewal (if any)
  const sortedRenewals = [...(renewalEntries || [])].sort((a, b) =>
    (a.renewalDate || '').localeCompare(b.renewalDate || '')
  );
  const latestRenewal = sortedRenewals.length > 0 ? sortedRenewals[sortedRenewals.length - 1] : null;

  let basePrincipal = initialP;
  let baseStartDate = loanDate;
  let baseLabel = 'Original Loan';

  if (latestRenewal && latestRenewal.newPrincipal > 0 && latestRenewal.renewalDate) {
    basePrincipal = Math.floor(latestRenewal.newPrincipal);
    baseStartDate = latestRenewal.renewalDate;
    baseLabel = `Renewed Loan (${latestRenewal.renewalDate})`;
  }

  // 2. Evaluate Interest Payments made on or after baseStartDate
  const activeInterestPayments = (interestPaymentEntries || []).filter(
    (ip) => ip.paymentDate && ip.paymentDate >= baseStartDate
  );
  const sortedPaidDates = activeInterestPayments
    .map((ip) => ip.paymentDate)
    .sort();
  const latestInterestPaymentDate = sortedPaidDates.length > 0 ? sortedPaidDates[sortedPaidDates.length - 1] : null;

  let effectiveBaseStartDate = baseStartDate;
  if (latestInterestPaymentDate && latestInterestPaymentDate >= baseStartDate) {
    effectiveBaseStartDate = latestInterestPaymentDate;
  }

  // 3. Build Principal Components
  const principalComponents: Array<{
    amount: number;
    issueDate: string;
    label: string;
  }> = [];

  if (basePrincipal > 0 && effectiveBaseStartDate) {
    principalComponents.push({
      amount: basePrincipal,
      issueDate: effectiveBaseStartDate,
      label: baseLabel
    });
  }

  // Only consider Extra Money entries issued on or after baseStartDate sorted strictly by date order
  let totalExtraP = 0;
  const activeExtraMoney = (extraMoneyEntries || [])
    .filter((em) => em.amount > 0 && em.date && em.date >= baseStartDate)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  activeExtraMoney.forEach((em, idx) => {
    const emAmt = Math.floor(em.amount || 0);
    let emStartDate = em.date;
    if (latestInterestPaymentDate && latestInterestPaymentDate > em.date) {
      emStartDate = latestInterestPaymentDate;
    }

    totalExtraP += emAmt;
    principalComponents.push({
      amount: emAmt,
      issueDate: emStartDate,
      label: `Extra Money ${idx + 1}`
    });
  });

  const totalEffectivePrincipal = basePrincipal + totalExtraP;
  let totalInterestEarned = 0;

  const breakdownSteps: Array<{ type: 'principal' | 'interest' | 'subtotal' | 'final'; amount: number; label?: string }> = [];
  const componentBreakdowns: ComponentBreakdown[] = [];

  if (totalEffectivePrincipal > 0) {
    breakdownSteps.push({
      type: 'principal',
      amount: totalEffectivePrincipal,
      label: totalExtraP > 0
        ? `Base Principal (₹${basePrincipal.toLocaleString('en-IN')} Base + ₹${totalExtraP.toLocaleString('en-IN')} Extra)`
        : baseLabel
    });
  }

  // 4. Calculate interest independently per principal component
  principalComponents.forEach((comp) => {
    const compDays = getFinancialDays(comp.issueDate, calculationDate);
    let currentCompP = comp.amount;
    let compYearInterest = 0;

    const totalCycles = Math.floor(compDays / cycleDays);
    for (let c = 1; c <= totalCycles; c++) {
      const cycleInterest = Math.floor((currentCompP * interestRate * cycleDays) / 3000);
      compYearInterest += cycleInterest;
      currentCompP += cycleInterest;
    }

    const intermediateTotal = currentCompP;
    const remainingDaysTotal = compDays % cycleDays;
    const remainingMonths = Math.floor(remainingDaysTotal / 30);
    const remainingDays = remainingDaysTotal % 30;

    let compRemainingInterest = 0;
    if (remainingDaysTotal > 0) {
      compRemainingInterest = Math.floor((intermediateTotal * interestRate * remainingDaysTotal) / 3000);
    }

    const compTotalInterest = compYearInterest + compRemainingInterest;
    const compTotalAmount = comp.amount + compTotalInterest;

    totalInterestEarned += compTotalInterest;

    componentBreakdowns.push({
      title: comp.label,
      principal: comp.amount,
      date: comp.issueDate,
      totalDays: compDays,
      hasCompleteYears: totalCycles > 0,
      yearsCount: totalCycles,
      yearInterest: compYearInterest,
      intermediateTotal,
      hasRemainingDuration: remainingDaysTotal > 0,
      remainingMonths,
      remainingDays,
      remainingInterest: compRemainingInterest,
      totalInterest: compTotalInterest,
      totalAmount: compTotalAmount
    });

    if (compTotalInterest > 0) {
      const remMonths = Math.floor(compDays / 30);
      const remDaysOnly = compDays % 30;
      let timeLabel = `${compDays} Days`;
      if (remMonths > 0 && remDaysOnly > 0) {
        timeLabel = `${remMonths}m ${remDaysOnly}d (${compDays} Days)`;
      } else if (remMonths > 0) {
        timeLabel = `${remMonths} Months (${compDays} Days)`;
      }

      breakdownSteps.push({
        type: 'interest',
        amount: compTotalInterest,
        label: `Interest on ${comp.label} [${timeLabel}]`
      });

      breakdownSteps.push({
        type: 'subtotal',
        amount: compTotalAmount,
        label: `Subtotal for ${comp.label}`
      });
    }
  });

  const finalAmount = totalEffectivePrincipal + totalInterestEarned;
  const outstandingBalance = Math.max(0, finalAmount - Math.floor(amountPaid));

  const totalDays = getFinancialDays(baseStartDate, calculationDate);
  const years = Math.floor(totalDays / 360);
  const remAfterYears = totalDays % 360;
  const months = Math.floor(remAfterYears / 30);
  const days = remAfterYears % 30;

  return {
    principal: totalEffectivePrincipal,
    interestRate,
    compoundFrequency,
    totalDays,
    years,
    months,
    days,
    interestEarned: totalInterestEarned,
    finalAmount,
    amountPaid: Math.floor(amountPaid),
    outstandingBalance,
    remainingDays: totalDays % cycleDays,
    remainingInterest: 0,
    totalExtraMoney: totalExtraP,
    breakdownSteps,
    componentBreakdowns
  };
}
