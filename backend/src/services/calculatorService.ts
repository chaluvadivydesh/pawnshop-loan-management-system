export interface ExtraMoneyItem {
  amount: number;
  date: string;
  remarks?: string | null;
}

export interface InterestPaymentItem {
  amount?: number;
  amountPaid?: number;
  paymentDate: string;
  remarks?: string | null;
}

export interface LoanRenewalItem {
  id?: string;
  renewalDate: string;
  previousPrincipal: number;
  accumulatedInterest: number;
  previousFinalAmount?: number;
  newPrincipal: number;
  newLoanPeriod: number;
  remarks?: string | null;
}

export interface CalculationInput {
  principal: number;
  interestRate: number;
  compoundFrequency: string; // "MONTHLY", "THREE_MONTHS", "SIX_MONTHS", "YEARLY"
  loanDate: string; // YYYY-MM-DD
  calculationDate: string; // YYYY-MM-DD
  amountPaid?: number;
  extraMoneyEntries?: ExtraMoneyItem[];
  interestPaymentEntries?: InterestPaymentItem[];
  renewalEntries?: LoanRenewalItem[];
}

export interface CalculationResult {
  principal: number;
  interestRate: number;
  compoundFrequency: string;
  totalDays: number;
  years: number;
  months: number;
  days: number;
  interestEarned: number;
  finalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  breakdownCycles: {
    cycleNumber: number;
    startPrincipal: number;
    cycleInterest: number;
    endPrincipal: number;
  }[];
  remainingDays: number;
  remainingInterest: number;
  totalExtraMoney?: number;
  breakdownSteps?: { type: string; amount: number; label?: string }[];
}

export function getFinancialDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  if (!sy || !sm || !sd || !ey || !em || !ed) return 0;

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
  const cycleDays = getCycleDays(compoundFrequency);

  // 1. Evaluate Renewals: Find latest renewal (if any)
  const sortedRenewals = [...(renewalEntries || [])].sort((a, b) =>
    (a.renewalDate || '').localeCompare(b.renewalDate || '')
  );
  const latestRenewal = sortedRenewals.length > 0 ? sortedRenewals[sortedRenewals.length - 1] : null;

  let basePrincipal = initialP;
  let baseStartDate = loanDate;
  let baseLabel = 'Original Principal';

  if (latestRenewal && latestRenewal.newPrincipal > 0 && latestRenewal.renewalDate) {
    basePrincipal = Math.floor(latestRenewal.newPrincipal);
    baseStartDate = latestRenewal.renewalDate;
    baseLabel = `Renewed Principal (${latestRenewal.renewalDate})`;
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

  // Only consider Extra Money entries issued on or after baseStartDate
  let totalExtraP = 0;
  const activeExtraMoney = (extraMoneyEntries || []).filter(
    (em) => em.amount > 0 && em.date && em.date >= baseStartDate
  );

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
      label: `Extra Money #${idx + 1} (${em.date})`
    });
  });

  const totalEffectivePrincipal = basePrincipal + totalExtraP;
  let totalInterestEarned = 0;
  const breakdownSteps: Array<{ type: 'principal' | 'interest' | 'subtotal' | 'final'; amount: number; label?: string }> = [];

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
    if (compDays <= 0) return;

    const totalCycles = Math.floor(compDays / cycleDays);
    let currentCompP = comp.amount;
    let compInterestEarned = 0;

    for (let c = 1; c <= totalCycles; c++) {
      const cycleInterest = Math.floor((currentCompP * interestRate * cycleDays) / 3000);
      compInterestEarned += cycleInterest;
      currentCompP += cycleInterest;
    }

    const remainingDays = compDays % cycleDays;
    let remainingInterest = 0;
    if (remainingDays > 0) {
      remainingInterest = Math.floor((currentCompP * interestRate * remainingDays) / 3000);
      compInterestEarned += remainingInterest;
    }

    totalInterestEarned += compInterestEarned;

    if (compInterestEarned > 0) {
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
        amount: compInterestEarned,
        label: `Interest on ${comp.label} [${timeLabel}]`
      });

      breakdownSteps.push({
        type: 'subtotal',
        amount: comp.amount + compInterestEarned,
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
    breakdownCycles: [],
    remainingDays: totalDays % cycleDays,
    remainingInterest: 0,
    totalExtraMoney: totalExtraP,
    breakdownSteps
  };
}
