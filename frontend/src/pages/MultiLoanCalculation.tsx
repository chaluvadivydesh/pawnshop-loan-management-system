import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  Save,
  Printer,
  Calendar,
  DollarSign,
  Coins,
  RefreshCw,
  TrendingUp,
  Gem,
  RotateCcw,
  Download,
  FileText
} from 'lucide-react';
import { Customer, Loan, ExtraMoneyItem, Payment, LoanRenewalItem } from '../types';
import { fetchCustomerDetails, batchUpdateCalculations } from '../lib/api';
import { calculateCompoundInterest, getFinancialDays } from '../lib/calculator';
import { formatDisplayDate, isValidCalendarDate } from '../lib/dateUtils';
import { PDFReport } from '../components/PDFReport';
import { generatePDFReport } from '../lib/pdf';

interface EditableLoanState {
  id: string;
  parentLoanId?: string | null;
  parentLoan?: any;
  itemName: string;
  metalType: 'GOLD' | 'SILVER';
  weight: number;
  principal: number | string;
  interestRate: number | string;
  compoundFrequency: string;
  loanDate: string;
  calculationDate: string;
  amountPaid: number;
  releaseStatus: string;
  remarks: string;
  extraMoney?: ExtraMoneyItem[];
  payments?: Payment[];
  renewals?: LoanRenewalItem[];
}

export const MultiLoanCalculation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const customerId = searchParams.get('customerId') || searchParams.get('customer');
  const loanIdsParam = searchParams.get('loanIds') || searchParams.get('loans');
  const todayStr = new Date().toISOString().split('T')[0];

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loanItems, setLoanItems] = useState<EditableLoanState[]>([]);
  const [numCalculations, setNumCalculations] = useState<number>(1);
  const [globalCalcDate, setGlobalCalcDate] = useState<string>(todayStr);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPDFMode, setIsPDFMode] = useState<boolean>(false);
  const [touchedCalculations, setTouchedCalculations] = useState<{ [key: number]: boolean }>({});

  const breakdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const createDefaultCalculation = (index: number): EditableLoanState => {
    return {
      id: `calc-${Date.now()}-${index}`,
      itemName: `Calculation ${index + 1}`,
      metalType: 'GOLD',
      weight: '' as any,
      principal: '',
      interestRate: 2,
      compoundFrequency: 'YEARLY',
      loanDate: '',
      calculationDate: todayStr,
      amountPaid: 0,
      releaseStatus: 'ACTIVE',
      remarks: ''
    };
  };

  const createBlankCalculation = (index: number): EditableLoanState => {
    return {
      id: `calc-${Date.now()}-${index}`,
      itemName: `Calculation ${index + 1}`,
      metalType: 'GOLD',
      weight: '' as any,
      principal: '',
      interestRate: 2,
      compoundFrequency: 'YEARLY',
      loanDate: '',
      calculationDate: todayStr,
      amountPaid: 0,
      releaseStatus: 'ACTIVE',
      remarks: ''
    };
  };

  useEffect(() => {
    const loadSelectedLoans = async () => {
      if (!customerId) {
        setLoanItems([createDefaultCalculation(0)]);
        setNumCalculations(1);
        setLoading(false);
        return;
      }

      try {
        const custData = await fetchCustomerDetails(customerId);
        setCustomer(custData);

        const targetIds = loanIdsParam ? loanIdsParam.split(',') : [];
        const loansToUse = (custData.loans || []).filter((l) =>
          targetIds.length > 0 ? targetIds.includes(l.id) : true
        );

        if (loansToUse.length > 0) {
          const editable: EditableLoanState[] = loansToUse.map((l) => {
            // Determine effective start date for current cycle (latest interest payment or renewal date)
            const interestPayments = (l.payments || [])
              .filter((p) => p.paymentType === 'INTEREST_ONLY' && p.paymentDate)
              .map((p) => p.paymentDate)
              .sort();
            const latestInterestPaymentDate = interestPayments.length > 0 ? interestPayments[interestPayments.length - 1] : null;

            const renewals = (l.renewals || [])
              .filter((r) => r.renewalDate)
              .map((r) => r.renewalDate)
              .sort();
            const latestRenewalDate = renewals.length > 0 ? renewals[renewals.length - 1] : null;

            return {
              id: l.id,
              parentLoanId: l.parentLoanId,
              parentLoan: l.parentLoan,
              itemName: l.itemName,
              metalType: l.metalType,
              weight: l.weight,
              principal: l.principal,
              interestRate: l.interestRate || 2,
              compoundFrequency: l.compoundFrequency || 'YEARLY',
              loanDate: l.loanDate,
              calculationDate: todayStr,
              amountPaid: l.amountPaid || 0,
              releaseStatus: l.releaseStatus,
              remarks: l.remarks || '',
              extraMoney: l.extraMoney || [],
              payments: l.payments || [],
              renewals: l.renewals || []
            };
          });
          setLoanItems(editable);
          setNumCalculations(editable.length);
        } else {
          setLoanItems([createBlankCalculation(0)]);
          setNumCalculations(1);
        }
      } catch (err) {
        console.error(err);
        setLoanItems([createDefaultCalculation(0)]);
        setNumCalculations(1);
      } finally {
        setLoading(false);
      }
    };

    loadSelectedLoans();
  }, [customerId, loanIdsParam, todayStr]);

  const handleNumCalculationsChange = (count: number) => {
    setNumCalculations(count);
    if (count > loanItems.length) {
      const added: EditableLoanState[] = [];
      for (let i = loanItems.length; i < count; i++) {
        // Additional calculation cards (index > 0) MUST be completely blank
        added.push(createBlankCalculation(i));
      }
      setLoanItems([...loanItems, ...added]);
    } else if (count < loanItems.length) {
      setLoanItems(loanItems.slice(0, count));
    }
  };

  const updateItemField = (index: number, field: keyof EditableLoanState, value: any) => {
    const updated = [...loanItems];
    updated[index] = { ...updated[index], [field]: value };
    setLoanItems(updated);
  };

  const resetItem = (index: number) => {
    const updated = [...loanItems];
    if (index === 0) {
      updated[index] = createDefaultCalculation(0);
    } else {
      updated[index] = createBlankCalculation(index);
    }
    setLoanItems(updated);
  };

  const handleCalculateClick = (index: number) => {
    setTouchedCalculations((prev) => ({ ...prev, [index]: true }));

    const item = loanItems[index];
    const calcDate = item?.calculationDate || globalCalcDate;
    const isLoanDateValid = Boolean(item?.loanDate && isValidCalendarDate(item.loanDate));
    const isCalcDateValid = Boolean(calcDate && isValidCalendarDate(calcDate));

    if (!isLoanDateValid || !isCalcDateValid) {
      return;
    }

    const updated = [...loanItems];
    setLoanItems(updated);

    // Smooth scroll to breakdown section of this calculation card
    setTimeout(() => {
      breakdownRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Compute live calculation results and Grand Summary
  const calculations = loanItems.map((item) => {
    const p = Number(item.principal) || 0;
    const r = Number(item.interestRate) || 0;
    const calcDate = item.calculationDate || globalCalcDate;

    const isLoanDateValid = Boolean(item.loanDate && isValidCalendarDate(item.loanDate));
    const isCalcDateValid = Boolean(calcDate && isValidCalendarDate(calcDate));

    if (!isLoanDateValid || !isCalcDateValid || p === 0) {
      return {
        principal: p,
        interestRate: r,
        compoundFrequency: item.compoundFrequency,
        totalDays: 0,
        years: 0,
        months: 0,
        days: 0,
        interestEarned: 0,
        finalAmount: p,
        amountPaid: Number(item.amountPaid) || 0,
        outstandingBalance: p,
        remainingDays: 0,
        remainingInterest: 0,
        breakdownSteps: [],
        effectiveOutstanding: item.releaseStatus === 'RELEASED' ? 0 : p
      };
    }

    const interestPayments = (item.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const isReleased = item.releaseStatus === 'RELEASED';
    const effectivePaid = item.releaseStatus === 'ACTIVE' ? 0 : (Number(item.amountPaid) || 0);

    const calc = calculateCompoundInterest({
      principal: p,
      interestRate: r,
      compoundFrequency: item.compoundFrequency,
      loanDate: item.loanDate,
      calculationDate: calcDate,
      amountPaid: effectivePaid,
      extraMoneyEntries: item.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: item.renewals || []
    });

    return {
      ...calc,
      effectiveOutstanding: (isReleased || item.releaseStatus === 'RENEWED' || item.releaseStatus === 'PARTIALLY_PAID') ? 0 : calc.outstandingBalance
    };
  });

  const grandPrincipal = calculations.reduce((sum, c) => sum + c.principal, 0);
  const grandInterest = calculations.reduce((sum, c) => sum + c.interestEarned, 0);
  const grandFinal = calculations.reduce((sum, c) => sum + c.finalAmount, 0);

  const handleSaveToDB = async () => {
    if (!customerId) return;
    try {
      setIsSaving(true);
      await batchUpdateCalculations(loanItems);
      alert('Calculations saved successfully! Loan records updated in database.');
      navigate(`/customers/${customerId}`);
    } catch (err) {
      console.error(err);
      alert('Error updating calculation records in database.');
    } finally {
      setIsSaving(false);
    }
  };

  const validateAllDatesForPDF = () => {
    let hasInvalid = false;
    const allTouched: { [key: number]: boolean } = {};

    if (!globalCalcDate || !isValidCalendarDate(globalCalcDate)) {
      hasInvalid = true;
    }

    loanItems.forEach((item, i) => {
      allTouched[i] = true;
      const calcDate = item.calculationDate || globalCalcDate;
      const isLoanDateValid = Boolean(item.loanDate && isValidCalendarDate(item.loanDate));
      const isCalcDateValid = Boolean(calcDate && isValidCalendarDate(calcDate));
      if (!isLoanDateValid || !isCalcDateValid) {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setTouchedCalculations(allTouched);
      alert('Cannot generate PDF report. One or more calculations contain an invalid date. Please enter a valid date.');
      return false;
    }
    return true;
  };

  const handlePrintPDF = () => {
    if (!validateAllDatesForPDF()) return;
    setIsPDFMode(true);
    setTimeout(() => {
      window.print();
      setIsPDFMode(false);
    }, 300);
  };

  const handleExportPDF = () => {
    if (!validateAllDatesForPDF()) return;
    setIsPDFMode(true);
    setTimeout(async () => {
      const fileName = customer
        ? `Loan_Calculation_Report_${customer.name.replace(/\s+/g, '_')}.pdf`
        : `Interest_Pro_Calculation_Report.pdf`;
      await generatePDFReport('pdf-report-container', fileName);
      setIsPDFMode(false);
    }, 300);
  };



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Navigation Back Button - Returns directly to customer profile */}
      <button
        onClick={() => {
          if (customerId) {
            navigate(`/customers/${customerId}`);
          } else {
            navigate(-1);
          }
        }}
        className="flex items-center space-x-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customer Profile {customer ? `(${customer.name})` : ''}</span>
      </button>

      {/* Top Header Banner Card */}
      <div className="bg-[hsl(245,80%,65%)] dark:bg-indigo-700 text-white rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl text-white shadow-inner">
            ₹
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Interest Pro</h1>
            <p className="text-indigo-100 text-xs sm:text-sm font-medium">Custom Lending Calculator</p>
          </div>
        </div>

        {customerId && (
          <button
            onClick={handleSaveToDB}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-sm shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save to DB'}</span>
          </button>
        )}
      </div>

      {/* Top Controls Box - Number of Calculations */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Number of Calculations
          </span>
          <select
            value={numCalculations}
            onChange={(e) => handleNumCalculationsChange(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Target Calc Date:</span>
            <input
              type="date"
              value={globalCalcDate}
              onChange={(e) => {
                setGlobalCalcDate(e.target.value);
                setLoanItems(loanItems.map((item) => ({ ...item, calculationDate: e.target.value })));
              }}
              className={`px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs ${
                Boolean(globalCalcDate && !isValidCalendarDate(globalCalcDate))
                  ? 'border-red-500 text-red-900 dark:text-red-100 ring-2 ring-red-500/20'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            />
          </div>
          {Boolean(globalCalcDate && !isValidCalendarDate(globalCalcDate)) && (
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
              Invalid date. Please enter a valid date.
            </span>
          )}
        </div>
      </div>

      {/* Render Individual Calculation Sections */}
      <div className="space-y-10">
        {loanItems.map((item, idx) => {
          const calc = calculations[idx];
          const calcDate = item.calculationDate || globalCalcDate;
          const isLoanDateInvalid = Boolean(item.loanDate && !isValidCalendarDate(item.loanDate)) || (Boolean(touchedCalculations[idx]) && !item.loanDate);
          const isCalcDateInvalid = Boolean(calcDate && !isValidCalendarDate(calcDate)) || (Boolean(touchedCalculations[idx]) && !calcDate);

          return (
            <div
              key={item.id || idx}
              className="space-y-6 bg-slate-50/50 dark:bg-slate-950/40 p-2 sm:p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800/60"
            >
              {loanItems.length > 1 && (
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                    CALCULATION #{idx + 1}: {item.itemName}
                  </span>
                </div>
              )}

              {/* Main 2-Column Grid (Date Period vs Loan Details) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Card: Date Period */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span>Date Period</span>
                  </h3>

                  <div className="space-y-4">
                    {/* MONEY GIVEN DATE */}
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                        MONEY GIVEN DATE
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={item.loanDate}
                          onChange={(e) => updateItemField(idx, 'loanDate', e.target.value)}
                          onBlur={() => setTouchedCalculations((prev) => ({ ...prev, [idx]: true }))}
                          className={`w-full px-4 py-3 rounded-xl border bg-indigo-50/30 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 ${
                            isLoanDateInvalid
                              ? 'border-red-500 text-red-900 dark:text-red-100 ring-2 ring-red-500/20 focus:ring-red-500'
                              : 'border-indigo-100 dark:border-slate-700 focus:ring-indigo-500'
                          }`}
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
                      </div>
                      {isLoanDateInvalid ? (
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1">
                          Invalid date. Please enter a valid date.
                        </p>
                      ) : item.loanDate && isValidCalendarDate(item.loanDate) ? (
                        <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
                          Display Format: {formatDisplayDate(item.loanDate)}
                        </span>
                      ) : null}
                    </div>

                    {/* CALCULATION DATE with AUTO TODAY badge */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                          CALCULATION DATE
                        </label>
                        <button
                          type="button"
                          onClick={() => updateItemField(idx, 'calculationDate', todayStr)}
                          className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider shadow-sm hover:bg-indigo-700 cursor-pointer"
                        >
                          AUTO TODAY
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="date"
                          value={calcDate}
                          onChange={(e) => updateItemField(idx, 'calculationDate', e.target.value)}
                          onBlur={() => setTouchedCalculations((prev) => ({ ...prev, [idx]: true }))}
                          className={`w-full px-4 py-3 rounded-xl border bg-indigo-50/30 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 ${
                            isCalcDateInvalid
                              ? 'border-red-500 text-red-900 dark:text-red-100 ring-2 ring-red-500/20 focus:ring-red-500'
                              : 'border-indigo-100 dark:border-slate-700 focus:ring-indigo-500'
                          }`}
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
                      </div>
                      {isCalcDateInvalid ? (
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1">
                          Invalid date. Please enter a valid date.
                        </p>
                      ) : calcDate && isValidCalendarDate(calcDate) ? (
                        <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
                          Display Format: {formatDisplayDate(calcDate)}
                        </span>
                      ) : null}
                    </div>

                    {/* Duration Display Box */}
                    <div className="bg-indigo-50/70 dark:bg-slate-800/80 p-6 rounded-2xl border border-indigo-100 dark:border-slate-700 text-center space-y-1">
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{calc.years} Year</div>
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{calc.months} Months</div>
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{calc.days} Days</div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2">
                        Total: {calc.totalDays} Days
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Loan Details */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      <span>Loan Details</span>
                    </h3>

                    <div className="space-y-4">
                      {/* PRINCIPAL AMOUNT */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                          PRINCIPAL AMOUNT (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-3 text-slate-500 font-bold text-sm">₹</span>
                          <input
                            type="number"
                            value={item.principal}
                            onChange={(e) => updateItemField(idx, 'principal', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Enter principal amount..."
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-indigo-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* INTEREST RATE */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                          INTEREST RATE
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.interestRate === '' ? '' : item.interestRate}
                          onChange={(e) => updateItemField(idx, 'interestRate', e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 2"
                          className="w-full px-4 py-3 rounded-xl border border-indigo-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* COMPOUND FREQUENCY */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                          COMPOUND FREQUENCY
                        </label>
                        <select
                          value={item.compoundFrequency}
                          onChange={(e) => updateItemField(idx, 'compoundFrequency', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-indigo-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="YEARLY">Every 1 Year</option>
                          <option value="SIX_MONTHS">Every 6 Months</option>
                          <option value="THREE_MONTHS">Every 3 Months</option>
                          <option value="MONTHLY">Every 1 Month</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Calculate & Reset) */}
                  <div className="flex items-center space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => handleCalculateClick(idx)}
                      className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-lg shadow-indigo-600/25 transition-all text-center cursor-pointer active:scale-95"
                    >
                      Calculate
                    </button>

                    <button
                      type="button"
                      onClick={() => resetItem(idx)}
                      className="px-5 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculation Breakdown Section - Auto Scrolled To */}
              <div
                ref={(el) => (breakdownRefs.current[idx] = el)}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm scroll-mt-6"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-xl">🧾</span>
                  <span>Calculation Breakdown</span>
                </h3>

                <div className="space-y-3">
                  {(() => {
                    const hasExtraMoney = Boolean(item.extraMoney && item.extraMoney.length > 0) || (calc.componentBreakdowns && calc.componentBreakdowns.length > 1);
                    const breakdownItems: Array<{ label: string; amount: number; type: string }> = [];

                    // Bug 3: Breakdown after Interest Payment
                    const interestPayments = (item.payments || [])
                      .filter((p) => p.paymentType === 'INTEREST_ONLY' && p.paymentDate);

                    if (interestPayments.length > 0) {
                      const sorted = [...interestPayments].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
                      const latestPayment = sorted[sorted.length - 1];
                      const baseStart = item.loanDate;

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

                      breakdownItems.push({ label: 'Principal', amount: calc.principal, type: 'principal' });
                      breakdownItems.push({
                        label: `Interest Paid up to ${formatDisplayDate(latestPayment.paymentDate)} (${paidDurationLabel})`,
                        amount: totalInterestPaid,
                        type: 'paidInterest'
                      });
                      breakdownItems.push({
                        label: `Current Interest (${currentDurationLabel})`,
                        amount: calc.interestEarned,
                        type: 'interest'
                      });
                      breakdownItems.push({ label: 'Final Total', amount: calc.principal + calc.interestEarned, type: 'runningTotal' });
                    } else if (hasExtraMoney && calc.componentBreakdowns && calc.componentBreakdowns.length > 0) {
                      let runningTotal = 0;
                      calc.componentBreakdowns.forEach((comp: any, idx: number) => {
                        if (idx === 0) {
                          breakdownItems.push({
                            label: comp.title || 'Original Loan',
                            amount: comp.principal,
                            type: 'principal'
                          });
                          breakdownItems.push({
                            label: 'Interest on Original Loan',
                            amount: comp.totalInterest,
                            type: 'interest'
                          });
                          runningTotal = comp.principal + comp.totalInterest;
                          breakdownItems.push({
                            label: 'Original Loan Subtotal',
                            amount: runningTotal,
                            type: 'subtotal'
                          });
                        } else {
                          const formattedDate = comp.date ? formatDisplayDate(comp.date) : '';
                          const dateLabel = formattedDate ? ` on ${formattedDate}` : '';

                          breakdownItems.push({
                            label: `Extra Money: ₹${comp.principal.toLocaleString('en-IN')}${dateLabel}`,
                            amount: comp.principal,
                            type: 'extraMoney'
                          });
                          breakdownItems.push({
                            label: 'Interest on Extra Money',
                            amount: comp.totalInterest,
                            type: 'extraInterest'
                          });
                          runningTotal += (comp.principal + comp.totalInterest);
                          breakdownItems.push({
                            label: (calc.componentBreakdowns && idx === calc.componentBreakdowns.length - 1) ? 'Final Total' : 'Running Total',
                            amount: runningTotal,
                            type: 'runningTotal'
                          });
                        }
                      });
                    } else {
                      const cycleDays = 360;
                      const totalCycles = Math.floor(calc.totalDays / cycleDays);

                      if (totalCycles >= 1) {
                        breakdownItems.push({ label: 'Principal Amount', amount: calc.principal, type: 'principal' });

                        let currentP = calc.principal;
                        const rate = Number(item.interestRate) || 2;

                        for (let c = 1; c <= totalCycles; c++) {
                          const cycleInterest = Math.floor((currentP * rate * cycleDays) / 3000);
                          currentP += cycleInterest;

                          breakdownItems.push({
                            label: `Interest for Year ${c}`,
                            amount: cycleInterest,
                            type: 'interest'
                          });
                          breakdownItems.push({
                            label: `Subtotal after Year ${c}`,
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

                          breakdownItems.push({
                            label: `Interest for remaining ${remLabel.trim()} (${remDays} Days)`,
                            amount: remInterest,
                            type: 'interest'
                          });
                        }

                        breakdownItems.push({ label: 'Final Total', amount: currentP, type: 'runningTotal' });
                      } else {
                        breakdownItems.push({ label: 'Principal Amount', amount: calc.principal, type: 'principal' });
                        if (calc.interestEarned > 0) {
                          breakdownItems.push({ label: 'Interest Earned', amount: calc.interestEarned, type: 'interest' });
                        }
                        breakdownItems.push({ label: 'Total Amount', amount: calc.finalAmount, type: 'runningTotal' });
                      }
                    }

                    return (
                      <div className="space-y-2.5">
                        {breakdownItems.map((bItem, bIdx) => {
                          const isTotal = bItem.type === 'subtotal' || bItem.type === 'runningTotal';
                          if (isTotal) {
                            return (
                              <div
                                key={bIdx}
                                className="w-full px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm flex justify-between items-center shadow-lg shadow-indigo-600/20"
                              >
                                <span className="text-white font-black text-sm">{bItem.label}</span>
                                <span className="text-white font-black text-base font-mono">₹{bItem.amount.toLocaleString('en-IN')}</span>
                              </div>
                            );
                          }

                          const isExtra = bItem.type === 'extraMoney' || bItem.type === 'extraInterest';
                          return (
                            <div
                              key={bIdx}
                              className={`w-full px-5 py-3 rounded-2xl font-extrabold text-sm border flex justify-between items-center transition-all ${
                                isExtra
                                  ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/40'
                                  : 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-indigo-100 dark:border-indigo-900/40'
                              }`}
                            >
                              <span>{bItem.label}</span>
                              <span className="font-mono text-base font-black">₹{bItem.amount.toLocaleString('en-IN')}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Summary Cards Grid (Interest Earned vs Final Amount) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Interest Earned Card (Bright Orange matching Image 1) */}
                <div className="bg-amber-500 rounded-3xl p-6 text-white text-center shadow-lg shadow-amber-500/25 space-y-2 flex flex-col items-center justify-center">
                  <div className="p-3 rounded-2xl bg-white/20 text-white mb-1 shadow-inner">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider opacity-90">INTEREST EARNED</span>
                  <span className="text-4xl font-black tracking-tight">₹{calc.interestEarned.toLocaleString('en-IN')}</span>
                </div>

                {/* Final Amount Card (Bright Emerald Green matching Image 1) */}
                <div className="bg-emerald-500 rounded-3xl p-6 text-white text-center shadow-lg shadow-emerald-500/25 space-y-2 flex flex-col items-center justify-center">
                  <div className="p-3 rounded-2xl bg-white/20 text-white mb-1 shadow-inner">
                    <Gem className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider opacity-90">FINAL AMOUNT</span>
                  <span className="text-4xl font-black tracking-tight">₹{calc.finalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Download All as PDF Button matching Image 1 */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full py-4 px-6 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-sm border border-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Download All as PDF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* GRAND SUMMARY AT THE BOTTOM OF CALCULATION PAGE */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
              <Coins className="w-6 h-6 text-amber-400" />
              <span>Grand Summary</span>
            </h2>
            <p className="text-xs text-slate-400">Total calculation metrics across {loanItems.length} calculation item(s)</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
            360-Day Financial Calendar Standard
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-extrabold block mb-1">Total Principal</span>
            <span className="text-2xl font-black text-white">₹ {grandPrincipal.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30">
            <span className="text-xs text-amber-400 uppercase font-extrabold block mb-1">Total Interest</span>
            <span className="text-3xl font-black text-amber-400">₹ {grandInterest.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/30">
            <span className="text-xs text-emerald-400 uppercase font-extrabold block mb-1">Total Amount to be Paid</span>
            <span className="text-3xl font-black text-emerald-300">₹ {grandFinal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* PRINT PDF & EXPORT PDF OPTIONS AT THE BOTTOM OF THE PAGE */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 pb-4">
        <button
          onClick={handlePrintPDF}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-base shadow-xl flex items-center justify-center space-x-3 transition-all transform active:scale-95 cursor-pointer border border-slate-700"
        >
          <Printer className="w-5 h-5 text-amber-400" />
          <span>Print PDF</span>
        </button>

        <button
          onClick={handleExportPDF}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center space-x-3 transition-all transform active:scale-95 cursor-pointer"
        >
          <Download className="w-5 h-5 text-amber-400" />
          <span>Export PDF</span>
        </button>
      </div>

      {/* Hidden printable PDF Container */}
      <div className={isPDFMode ? 'block' : 'hidden print:block'}>
        <PDFReport
          customer={customer || {
            id: 'guest',
            name: 'Valued Customer',
            relationshipType: 'S/O',
            relationshipName: '-',
            village: 'Local',
            mobile: '-'
          }}
          loans={loanItems as any}
          calculationDate={globalCalcDate}
        />
      </div>
    </div>
  );
};

export default MultiLoanCalculation;
