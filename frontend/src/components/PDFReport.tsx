import React from 'react';
import { Customer, Loan } from '../types';
import { calculateCompoundInterest, getFinancialDays, getCycleDays } from '../lib/calculator';
import { formatDisplayDate } from '../lib/dateUtils';

interface PDFReportProps {
  customer: Customer;
  loans: Loan[];
  shopName?: string;
  calculationDate?: string;
}

export const PDFReport: React.FC<PDFReportProps> = ({
  customer,
  loans,
  shopName = 'Interest Pro',
  calculationDate = new Date().toISOString().split('T')[0]
}) => {
  let grandPrincipal = 0;
  let grandInterest = 0;
  let grandFinal = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return formatDisplayDate(dateStr);
  };

  const now = new Date();
  const timeFormatted = now
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
    .toLowerCase();

  const parseLoanOriginDetails = (l: Loan) => {
    const remarks = l.remarks || '';
    const remLower = remarks.toLowerCase();

    const isPartialPayment =
      remLower.includes('partially paid item') ||
      remLower.includes('partial payment') ||
      (l.parentLoanId ? !remLower.includes('renew') : false);

    const isRenewal =
      remLower.includes('renewed item') ||
      remLower.includes('renewed loan') ||
      remLower.includes('renew');

    const allCustLoans = customer?.loans || [];
    const parentLoan = l.parentLoan ||
      (l.parentLoanId ? loans.find((p) => p.id === l.parentLoanId) || allCustLoans.find((p) => p.id === l.parentLoanId) : null);

    let prevDate: string | null = parentLoan?.loanDate || null;

    if (!prevDate && isRenewal) {
      // Trace parent loan in customer loans by renewal entry matching
      const linkedParentByRenewal = allCustLoans.find((p) =>
        (p.renewals || []).some((r: any) => r.renewalDate === l.loanDate || r.newPrincipal === l.principal)
      );
      if (linkedParentByRenewal) {
        prevDate = linkedParentByRenewal.loanDate;
      }
    }

    if (!prevDate && isRenewal) {
      // Fallback: Trace potential parent loan by customerId and creation order
      const potentialParent = allCustLoans.find((p) =>
        p.id !== l.id &&
        p.itemName === l.itemName &&
        (p.createdAt && (l as any).createdAt ? p.createdAt < (l as any).createdAt : true)
      );
      if (potentialParent) {
        prevDate = potentialParent.loanDate;
      }
    }

    if (!prevDate) {
      const matchDate = remarks.match(/previous loan date:?\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i) ||
                        remarks.match(/loan date:?\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i) ||
                        remarks.match(/from\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i);
      if (matchDate) prevDate = matchDate[1];
    }

    let prevAmount: number | null = parentLoan?.principal || null;
    if (prevAmount === null || prevAmount === undefined) {
      const matchAmt = remarks.match(/Previous Principal:\s*₹?\s*([0-9,]+)/i) ||
                       remarks.match(/principal:\s*₹?\s*([0-9,]+)/i);
      if (matchAmt) prevAmount = Number(matchAmt[1].replace(/,/g, ''));
    }

    let paymentMode = 'P+I';
    let paymentTypeLabel = 'Regular Partial Payment';

    // 1. Trace parentLoan partialPayments array
    const ppEntries = parentLoan?.partialPayments || l.partialPayments || [];
    if (ppEntries.length > 0) {
      const latestPP = ppEntries[ppEntries.length - 1];
      if (latestPP.paymentType === 'PRINCIPAL_ONLY') {
        paymentMode = 'P';
        paymentTypeLabel = 'Principal Reduction (Interest Capitalized)';
      } else {
        paymentMode = 'P+I';
        paymentTypeLabel = 'Regular Partial Payment';
      }
    } else {
      // 2. Trace parentLoan payment logs
      const parentPLogs = (parentLoan?.payments || l.payments || []).filter((p: any) =>
        p.paymentType === 'PARTIAL_PAYMENT' || (p.remarks || '').toLowerCase().includes('partial')
      );
      if (parentPLogs.length > 0) {
        const latestPLog = parentPLogs[parentPLogs.length - 1];
        const pRem = (latestPLog.remarks || '').toLowerCase();
        if (pRem.includes('p only') || pRem.includes('principal only')) {
          paymentMode = 'P';
          paymentTypeLabel = 'Principal Reduction (Interest Capitalized)';
        } else if (pRem.includes('p+i') || pRem.includes('principal + interest')) {
          paymentMode = 'P+I';
          paymentTypeLabel = 'Regular Partial Payment';
        }
      }
    }

    // 3. Inspect remarks / remLower override: ALWAYS check P+I FIRST so "mode: p" does not falsely match inside "mode: p+i"
    if (remLower.includes('p+i') || remLower.includes('principal + interest') || remLower.includes('mode: p+i') || remLower.includes('principal_plus_interest')) {
      paymentMode = 'P+I';
      paymentTypeLabel = 'Regular Partial Payment (P+I)';
    } else if (remLower.includes('p only') || remLower.includes('principal only') || remLower.includes('mode: p ') || remLower.endsWith('mode: p') || remLower.includes('principal_only')) {
      paymentMode = 'P';
      paymentTypeLabel = 'Principal Reduction (P Only)';
    }

    let partialAmountPaid: number | null = null;

    if (parentLoan?.partialPayments && parentLoan.partialPayments.length > 0) {
      partialAmountPaid = parentLoan.partialPayments[parentLoan.partialPayments.length - 1].totalAmountPaid;
    }

    if (!partialAmountPaid && parentLoan?.payments && parentLoan.payments.length > 0) {
      const pLogs = parentLoan.payments.filter((p: any) =>
        p.paymentType === 'PARTIAL_PAYMENT' || (p.remarks || '').toLowerCase().includes('partial')
      );
      if (pLogs.length > 0) {
        partialAmountPaid = pLogs[pLogs.length - 1].amountPaid;
      }
    }

    if (!partialAmountPaid && l.payments && l.payments.length > 0) {
      const pLogs = l.payments.filter((p: any) =>
        p.paymentType === 'PARTIAL_PAYMENT' || (p.remarks || '').toLowerCase().includes('partial')
      );
      if (pLogs.length > 0) {
        partialAmountPaid = pLogs[pLogs.length - 1].amountPaid;
      }
    }

    if (!partialAmountPaid) {
      const matchPaid = remarks.match(/Cash Paid:?\s*₹?\s*([0-9,]+)/i) ||
                        remarks.match(/Paid:?\s*₹?\s*([0-9,]+)/i) ||
                        remarks.match(/Amount Paid:?\s*₹?\s*([0-9,]+)/i);
      if (matchPaid) {
        partialAmountPaid = Number(matchPaid[1].replace(/,/g, ''));
      }
    }

    if (!partialAmountPaid && customer?.loans) {
      const parentInCust = customer.loans.find((p) => p.id === l.parentLoanId);
      if (parentInCust?.partialPayments && parentInCust.partialPayments.length > 0) {
        partialAmountPaid = parentInCust.partialPayments[parentInCust.partialPayments.length - 1].totalAmountPaid;
      }
    }

    if ((prevAmount === null || prevAmount === undefined) && l.principal && partialAmountPaid && paymentMode === 'P') {
      prevAmount = l.principal + partialAmountPaid;
    }

    let principalDeducted: number | null = null;
    let interestDeducted: number | null = null;

    if (ppEntries.length > 0) {
      const latestPP = ppEntries[ppEntries.length - 1];
      principalDeducted = latestPP.principalPaid;
      interestDeducted = latestPP.interestPaid;
      if (partialAmountPaid === null || partialAmountPaid === undefined) {
        partialAmountPaid = latestPP.totalAmountPaid;
      }
    } else if (prevAmount && l.principal) {
      if (paymentMode === 'P') {
        principalDeducted = partialAmountPaid !== null ? partialAmountPaid : Math.max(0, prevAmount - l.principal);
        interestDeducted = 0;
      } else {
        const pDed = Math.max(0, prevAmount - l.principal);
        principalDeducted = pDed;
        interestDeducted = partialAmountPaid !== null ? Math.max(0, partialAmountPaid - pDed) : 0;
      }
    }

    return {
      isDerived: isPartialPayment || isRenewal,
      isPartialPayment,
      isRenewal,
      originalLoanDate: prevDate,
      originalLoanAmount: prevAmount,
      partialPaymentDate: l.loanDate,
      paymentTypeLabel,
      paymentMode,
      amountPaid: partialAmountPaid,
      principalDeducted,
      interestDeducted,
      newPrincipal: l.principal,
      renewalDate: l.loanDate,
      renewalAmount: l.principal
    };
  };

  const getBreakdownItems = (loan: Loan, calc: any) => {
    const items: Array<{ label: string; amount: number; type: string }> = [];

    // Bug 3: Breakdown after Interest Payment
    const interestPayments = (loan.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY' && p.paymentDate);

    if (interestPayments.length > 0) {
      const sorted = [...interestPayments].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
      const latestPayment = sorted[sorted.length - 1];

      const baseStart = (loan.renewals && loan.renewals.length > 0)
        ? loan.renewals[loan.renewals.length - 1].renewalDate
        : loan.loanDate;

      const paidDays = getFinancialDays(baseStart, latestPayment.paymentDate);
      const paidY = Math.floor(paidDays / 360);
      const paidRemY = paidDays % 360;
      const paidM = Math.floor(paidRemY / 30);
      const paidD = paidRemY % 30;

      let paidDurationLabel = `${paidDays} Days`;
      if (paidY > 0 || paidM > 0) {
        const parts = [];
        if (paidY > 0) parts.push(`${paidY} Year${paidY > 1 ? 's' : ''}`);
        if (paidM > 0) parts.push(`${paidM} Month${paidM > 1 ? 's' : ''}`);
        if (paidD > 0) parts.push(`${paidD} Day${paidD > 1 ? 's' : ''}`);
        paidDurationLabel = parts.join(' ');
      }

      const totalInterestPaid = sorted.reduce((sum, p) => sum + p.amountPaid, 0);

      const calcDate = loan.releaseStatus === 'ACTIVE'
        ? calculationDate || todayStr
        : loan.calculationDate || loan.releaseDate || calculationDate;

      const currentDays = getFinancialDays(latestPayment.paymentDate, calcDate);
      const currentY = Math.floor(currentDays / 360);
      const currentRemY = currentDays % 360;
      const currentM = Math.floor(currentRemY / 30);
      const currentD = currentRemY % 30;

      let currentDurationLabel = `${currentDays} Days`;
      if (currentY > 0 || currentM > 0) {
        const parts = [];
        if (currentY > 0) parts.push(`${currentY} Year${currentY > 1 ? 's' : ''}`);
        if (currentM > 0) parts.push(`${currentM} Month${currentM > 1 ? 's' : ''}`);
        if (currentD > 0) parts.push(`${currentD} Day${currentD > 1 ? 's' : ''}`);
        currentDurationLabel = parts.join(' ');
      }

      items.push({ label: 'Principal', amount: calc.principal, type: 'principal' });
      items.push({
        label: `Interest Paid up to ${formatDate(latestPayment.paymentDate)} (${paidDurationLabel})`,
        amount: totalInterestPaid,
        type: 'paidInterest'
      });
      items.push({
        label: `Current Interest (${currentDurationLabel})`,
        amount: calc.interestEarned,
        type: 'interest'
      });
      items.push({ label: 'Final Total', amount: calc.principal + calc.interestEarned, type: 'runningTotal' });
      return items;
    }

    // Bug 1: Stage-by-stage compound interest breakdown for Multi-Year / Multi-Cycle loans
    const cycleDays = getCycleDays(loan.compoundFrequency || 'YEARLY');
    const totalCycles = Math.floor(calc.totalDays / cycleDays);

    if (totalCycles >= 1) {
      items.push({ label: 'Principal Amount', amount: calc.principal, type: 'principal' });

      let currentP = calc.principal;
      const rate = Number(loan.interestRate) || 2;

      for (let c = 1; c <= totalCycles; c++) {
        const cycleInterest = Math.floor((currentP * rate * cycleDays) / 3000);
        currentP += cycleInterest;

        items.push({
          label: `Interest for Year ${c}`,
          amount: cycleInterest,
          type: 'interest'
        });
        items.push({
          label: `Updated Principal after Year ${c}`,
          amount: currentP,
          type: 'subtotal'
        });
      }

      const remDays = calc.totalDays % cycleDays;
      if (remDays > 0) {
        const remM = Math.floor(remDays / 30);
        const remD = remDays % 30;
        const remLabel = remM > 0 ? `${remM} Months ${remD > 0 ? `${remD} Days` : ''}` : `${remD} Days`;

        const remInterest = Math.floor((currentP * rate * remDays) / 3000);
        currentP += remInterest;

        items.push({
          label: `Interest for remaining ${remLabel.trim()} (${remDays} Days)`,
          amount: remInterest,
          type: 'interest'
        });
      }

      items.push({ label: 'Final Total', amount: currentP, type: 'runningTotal' });
      return items;
    }

    // Default 1-cycle / single period loan breakdown
    items.push({ label: 'Principal Amount', amount: calc.principal, type: 'principal' });
    if (calc.interestEarned > 0) {
      items.push({ label: 'Interest Earned', amount: calc.interestEarned, type: 'interest' });
    }
    items.push({ label: 'Final Total', amount: calc.finalAmount, type: 'runningTotal' });
    return items;
  };

  const calculations = loans.map((loan) => {
    const interestPayments = (loan.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({
        amount: p.amountPaid,
        paymentDate: p.paymentDate,
        remarks: p.remarks || undefined
      }));

    const calcDate =
      loan.releaseStatus === 'ACTIVE'
        ? calculationDate || todayStr
        : loan.calculationDate || loan.releaseDate || calculationDate;

    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: calcDate,
      amountPaid: loan.releaseStatus === 'ACTIVE' ? 0 : loan.amountPaid,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: loan.renewals || []
    });

    grandPrincipal += calc.principal;
    grandInterest += calc.interestEarned;
    grandFinal += calc.finalAmount;

    return {
      loan,
      calcDate,
      calc,
      origin: parseLoanOriginDetails(loan),
      breakdownItems: getBreakdownItems(loan, calc)
    };
  });

  return (
    <div id="pdf-report-container" className="bg-white text-slate-900 font-sans p-8 max-w-[210mm] mx-auto print:max-w-none print:p-4 print:m-0 space-y-8">
      {/* Top Header matching Image 2 */}
      <div className="pdf-header pb-4 border-b border-slate-200 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
            <span className="text-2xl font-black">₹</span>
            <span>Interest Calculation Report</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Generated on {formatDate(calculationDate)}, {timeFormatted} | {shopName} | {loans.length} Calculation{loans.length > 1 ? 's' : ''}
          </p>
        </div>
        {customer && customer.name && customer.name !== 'Valued Customer' && (
          <div className="text-right text-xs text-slate-700 font-medium">
            <div><strong className="font-bold text-slate-900">Customer:</strong> {customer.name}</div>
            <div>{customer.relationshipType} {customer.relationshipName}</div>
            <div>Village: {customer.village || '-'} | Mobile: {customer.mobile || '-'}</div>
          </div>
        )}
      </div>

      {/* List of Calculations matching Image 2 */}
      <div className="space-y-8">
        {calculations.map(({ loan, calcDate, calc, origin, breakdownItems }, idx) => {
          return (
            <div
              key={loan.id || idx}
              className="calculation-card bg-white text-xs space-y-6"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* 2-Column Main Layout matching Image 2 */}
              <div className="grid grid-cols-12 gap-8 text-xs">
                {/* Left Column (5 Cols): Loan Item Details & Parameters */}
                <div className="col-span-5 space-y-4">
                  <div className="font-extrabold text-indigo-700 uppercase tracking-wider text-xs">
                    CALCULATION #{idx + 1}
                  </div>

                  {loan.itemName && (
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        ITEM DETAILS
                      </span>
                      <span className="text-xs font-black text-slate-900 block mt-0.5">
                        {loan.itemName} {loan.metalType ? `(${loan.metalType})` : ''} {Number(loan.weight) > 0 ? `[${loan.weight}g]` : ''}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        MONEY GIVEN DATE
                      </span>
                      <span className="text-sm font-black text-slate-900 block mt-0.5">
                        {formatDate(loan.loanDate)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        CALCULATION DATE
                      </span>
                      <span className="text-sm font-black text-slate-900 block mt-0.5">
                        {formatDate(calcDate)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        DURATION
                      </span>
                      <span className="text-sm font-black text-indigo-700 block mt-0.5">
                        {calc.days} Days {calc.months} Months {calc.years} Year
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        PRINCIPAL
                      </span>
                      <span className="text-sm font-black text-slate-900 block mt-0.5">
                        ₹{calc.principal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        INTEREST RATE
                      </span>
                      <span className="text-sm font-black text-slate-900 block mt-0.5">
                        ₹{loan.interestRate}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        TOTAL INTEREST
                      </span>
                      <span className="text-base font-black text-emerald-600 block mt-0.5">
                        ₹{calc.interestEarned.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        FINAL AMOUNT
                      </span>
                      <span className="text-base font-black text-emerald-600 block mt-0.5">
                        ₹{calc.finalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Special Case: Renewed Loan Origin Block */}
                  {origin.isRenewal && (
                    <div className="border-t border-purple-200 pt-3 space-y-1 text-xs">
                      <span className="font-extrabold text-purple-900 text-[10px] uppercase block">RENEWAL DETAILS</span>
                      <div className="text-slate-600">Original Loan Date: <strong className="text-slate-900">{formatDate(origin.originalLoanDate)}</strong></div>
                      <div className="text-slate-600">Original Loan Amount: <strong className="text-slate-900">{origin.originalLoanAmount ? `₹${origin.originalLoanAmount.toLocaleString('en-IN')}` : '-'}</strong></div>
                      <div className="text-slate-600">Renewal Date: <strong className="text-slate-900">{formatDate(origin.renewalDate)}</strong></div>
                    </div>
                  )}

                  {/* Special Case: Partially Paid Loan Origin Block */}
                  {origin.isPartialPayment && (
                    <div className="border-t border-pink-200 pt-3 space-y-1.5 text-xs">
                      <span className="font-extrabold text-pink-900 text-[10px] uppercase block tracking-wider">PARTIAL PAYMENT DETAILS</span>
                      <div className="text-slate-600">Original Date: <strong className="text-slate-900">{formatDate(origin.originalLoanDate)}</strong></div>
                      <div className="text-slate-600">Original Amount: <strong className="text-slate-900">{origin.originalLoanAmount ? `₹${origin.originalLoanAmount.toLocaleString('en-IN')}` : '-'}</strong></div>
                      <div className="text-slate-600">Payment Date: <strong className="text-pink-700">{formatDate(origin.partialPaymentDate)}</strong></div>
                      <div className="text-slate-600">Payment Method: <strong className="text-indigo-700 font-extrabold">{origin.paymentMode} ({origin.paymentMode === 'P' ? 'Principal Only' : 'Principal + Interest'})</strong></div>
                      {origin.paymentMode === 'P' ? (
                        <div className="text-slate-600">Principal Deducted: <strong className="text-emerald-700 font-extrabold">{origin.principalDeducted !== null && origin.principalDeducted !== undefined ? `₹${origin.principalDeducted.toLocaleString('en-IN')}` : (origin.amountPaid ? `₹${origin.amountPaid.toLocaleString('en-IN')}` : '-')}</strong></div>
                      ) : (
                        <>
                          {origin.amountPaid !== null && origin.amountPaid !== undefined && (
                            <div className="text-slate-600">Total Cash Paid: <strong className="text-slate-900 font-bold">₹{origin.amountPaid.toLocaleString('en-IN')}</strong></div>
                          )}
                          <div className="text-slate-600">Interest Paid: <strong className="text-amber-700 font-bold">{origin.interestDeducted !== null && origin.interestDeducted !== undefined ? `₹${origin.interestDeducted.toLocaleString('en-IN')}` : '-'}</strong></div>
                          <div className="text-slate-600">Principal Deducted: <strong className="text-emerald-700 font-extrabold">{origin.principalDeducted !== null && origin.principalDeducted !== undefined ? `₹${origin.principalDeducted.toLocaleString('en-IN')}` : '-'}</strong></div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column (7 Cols): Calculation Breakdown matching Image 2 */}
                <div className="col-span-7 space-y-3 pl-4 border-l border-slate-100 overflow-visible">
                  <div className="font-extrabold text-slate-900 uppercase tracking-wider text-xs pb-1 leading-normal">
                    CALCULATION BREAKDOWN
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-slate-800 overflow-visible">
                    {breakdownItems.map((bItem: any, vIdx: number) => {
                      const isTotal = bItem.type === 'subtotal' || bItem.type === 'runningTotal';
                      return (
                        <div
                          key={vIdx}
                          className={`flex justify-between items-center py-2.5 px-3 rounded-xl border-b leading-normal overflow-visible ${
                            isTotal
                              ? 'bg-slate-100 text-slate-900 font-black border-slate-300'
                              : bItem.type === 'extraMoney'
                              ? 'bg-amber-50 text-amber-900 font-bold border-amber-200'
                              : 'border-slate-100 text-slate-800'
                          }`}
                        >
                          <span className="pr-2 leading-normal font-bold text-slate-800">{bItem.label}</span>
                          <span className="font-mono font-black whitespace-nowrap leading-normal text-slate-900">₹{bItem.amount.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t-2 border-slate-900 pt-3 mt-3 flex justify-between items-center font-black text-base text-slate-900 overflow-visible">
                    <span className="leading-normal">Total: ₹{calc.finalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grand Summary Box */}
      {loans.length > 1 && (
        <div className="grand-summary-box border-t-2 border-slate-900 pt-4 text-xs text-slate-900 space-y-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div className="font-bold text-sm uppercase tracking-wider">
            Statement Summary ({loans.length} Calculations)
          </div>
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <span className="text-slate-500 font-medium block">Total Principal:</span>
              <span className="font-bold text-sm">₹{grandPrincipal.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Total Interest:</span>
              <span className="font-bold text-sm">₹{grandInterest.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Total Amount to be Paid:</span>
              <span className="font-bold text-base text-emerald-700">₹{grandFinal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer matching Image 2 */}
      <div className="pdf-footer pt-6 border-t border-slate-200 text-center text-xs text-slate-400 font-medium">
        <span>{shopName} — Custom Lending Calculator</span>
      </div>
    </div>
  );
};
