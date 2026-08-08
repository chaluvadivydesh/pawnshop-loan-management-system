import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, DollarSign, Save, ArrowRight } from 'lucide-react';
import { Loan } from '../types';
import { calculateCompoundInterest } from '../lib/calculator';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amountPaid: number; releaseDate: string; remarks: string }) => Promise<void>;
  loan: Loan | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loan
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [amountPaidInput, setAmountPaidInput] = useState<number | string>('');
  const [releaseDate, setReleaseDate] = useState<string>(todayStr);
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (loan) {
      setAmountPaidInput(loan.amountPaid && loan.amountPaid > 0 ? loan.amountPaid : '');
      setReleaseDate(loan.releaseDate || todayStr);
      setRemarks(loan.remarks || '');
    }
  }, [loan, todayStr]);

  if (!isOpen || !loan) return null;

  const calcDate = releaseDate || todayStr;
  const interestPayments = (loan.payments || [])
    .filter((p) => p.paymentType === 'INTEREST_ONLY')
    .map((p) => ({
      amount: p.amountPaid,
      paymentDate: p.paymentDate,
      remarks: p.remarks || undefined
    }));

  const calc = calculateCompoundInterest({
    principal: loan.principal,
    interestRate: loan.interestRate,
    compoundFrequency: loan.compoundFrequency,
    loanDate: loan.loanDate,
    calculationDate: calcDate,
    amountPaid: amountPaidInput === '' ? 0 : Number(amountPaidInput) || 0,
    extraMoneyEntries: loan.extraMoney || [],
    interestPaymentEntries: interestPayments,
    renewalEntries: loan.renewals || []
  });

  const finalAmount = calc.finalAmount;
  const paidVal = amountPaidInput === '' ? 0 : Number(amountPaidInput) || 0;
  const isReleased = paidVal >= finalAmount;
  const newOutstanding = isReleased ? 0 : Math.max(0, finalAmount - paidVal);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        amountPaid: paidVal,
        releaseDate,
        remarks
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Release Item & Enter Payment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pledge Item: <strong className="text-slate-800 dark:text-slate-200">{loan.itemName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body - Scrollable */}
        <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Item summary card */}
            <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 tracking-wider">
                    {loan.metalType} ({loan.weight}g)
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{loan.itemName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pledged Date: <span className="font-semibold text-slate-800 dark:text-slate-200">{loan.loanDate}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block uppercase font-medium">Principal</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ₹ {calc.principal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Calculation Breakdown */}
            <div className="grid grid-cols-3 gap-2 bg-amber-500/10 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-500/20 text-center">
              <div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block uppercase">Interest Earned</span>
                <span className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                  ₹ {calc.interestEarned.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold block uppercase">Total Payable</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  ₹ {finalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold block uppercase">New Outstanding</span>
                <span className={`text-base font-black ${isReleased ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  ₹ {newOutstanding.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-3.5 rounded-xl flex items-center space-x-3 border font-bold text-xs ${
              isReleased
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
            }`}>
              {isReleased ? <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> : <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />}
              <div>
                <span className="block font-black uppercase text-sm">
                  Status: {isReleased ? 'RELEASED' : 'ACTIVE'}
                </span>
                <span className="text-[11px] font-normal opacity-90 block">
                  {isReleased
                    ? 'Full payment entered! Clicking Enter / Submit will mark item as RELEASED in light green.'
                    : 'Partial payment entered. Loan remains ACTIVE with remaining balance.'}
                </span>
              </div>
            </div>

            {/* Amount Paid Input with Quick Button */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Amount Paid by Customer (₹) *
                </label>
                <button
                  type="button"
                  onClick={() => setAmountPaidInput(finalAmount)}
                  className="text-xs text-amber-600 dark:text-amber-400 font-black hover:underline"
                >
                  Set Full Payment (₹ {finalAmount.toLocaleString('en-IN')})
                </button>
              </div>

              <div className="flex space-x-2">
                <input
                  type="number"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xl font-black focus:ring-2 focus:ring-amber-500"
                  placeholder="Enter amount paid..."
                  autoFocus
                />
              </div>
            </div>

            {/* Release Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Payment / Release Date *
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Remarks (Optional)
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Paid in full via Cash / Google Pay"
              />
            </div>
          </div>

          {/* Fixed Sticky Footer with ENTER / SUBMIT BUTTON */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-extrabold text-sm shadow-lg flex items-center space-x-2 transition-all transform active:scale-95 text-slate-950 ${
                isReleased
                  ? 'bg-emerald-400 hover:bg-emerald-500 shadow-emerald-500/25'
                  : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Submitting...'
                  : isReleased
                  ? 'ENTER & CONFIRM RELEASE'
                  : 'ENTER PAYMENT RECORD'}
              </span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
