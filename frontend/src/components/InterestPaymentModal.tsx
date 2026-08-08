import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, Calendar, DollarSign, FileText } from 'lucide-react';
import { Loan } from '../types';
import { calculateCompoundInterest } from '../lib/calculator';

interface InterestPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSubmit: (data: { amountPaid: number; paymentDate: string; remarks?: string }) => Promise<void>;
}

export const InterestPaymentModal: React.FC<InterestPaymentModalProps> = ({
  isOpen,
  onClose,
  loan,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);
  const [amount, setAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const calcInterestForDate = useMemo(() => {
    if (!loan || !date) return 0;
    const calc = calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: date,
      amountPaid: loan.amountPaid || 0,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: (loan.payments || [])
        .filter((p) => p.paymentType === 'INTEREST_ONLY')
        .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks })),
      renewalEntries: loan.renewals || []
    });
    return calc.interestEarned || 0;
  }, [loan, date]);

  useEffect(() => {
    if (isOpen && loan) {
      setDate(todayStr);
      setRemarks('');
      setIsSubmitting(false);
    }
  }, [isOpen, loan, todayStr]);

  useEffect(() => {
    if (isOpen && loan) {
      setAmount(calcInterestForDate > 0 ? String(calcInterestForDate) : '0');
    }
  }, [calcInterestForDate, isOpen, loan]);

  if (!isOpen || !loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      alert('Please enter a valid interest payment amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        amountPaid: numAmt,
        paymentDate: date || todayStr,
        remarks: remarks.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to record interest payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/20 text-white font-bold">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Pay Interest Only</h2>
              <p className="text-xs font-semibold opacity-90">
                Settle interest due for {loan.itemName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Context Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-400 font-extrabold block">PRINCIPAL (UNCHANGED)</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">₹ {loan.principal.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-extrabold block">ACCUMULATED INTEREST (UP TO {date})</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">₹ {calcInterestForDate.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 font-medium">
            ℹ️ Once saved, interest calculation will restart/reset from this payment date using the existing principal. Previous interest is marked settled.
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>INTEREST PAYMENT DATE</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>INTEREST AMOUNT PAID (₹)</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 900"
              required
              min={1}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>REMARKS (OPTIONAL)</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Interest paid up to today"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Interest Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
