import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Calendar, Clock, DollarSign, FileText, ArrowRight } from 'lucide-react';
import { Loan } from '../types';
import { calculateCompoundInterest } from '../lib/calculator';

interface RenewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSubmit: (data: { renewalDate: string; newLoanPeriod: number; remarks?: string }) => Promise<void>;
}

export const RenewLoanModal: React.FC<RenewLoanModalProps> = ({
  isOpen,
  onClose,
  loan,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [renewalDate, setRenewalDate] = useState<string>(todayStr);
  const [newLoanPeriod, setNewLoanPeriod] = useState<number>(12);
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const calcForRenewalDate = useMemo(() => {
    if (!loan || !renewalDate) return { interestEarned: 0, finalAmount: loan?.principal || 0 };
    return calculateCompoundInterest({
      principal: loan.principal,
      interestRate: loan.interestRate,
      compoundFrequency: loan.compoundFrequency,
      loanDate: loan.loanDate,
      calculationDate: renewalDate,
      amountPaid: loan.amountPaid || 0,
      extraMoneyEntries: loan.extraMoney || [],
      interestPaymentEntries: (loan.payments || [])
        .filter((p) => p.paymentType === 'INTEREST_ONLY')
        .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks })),
      renewalEntries: loan.renewals || []
    });
  }, [loan, renewalDate]);

  useEffect(() => {
    if (isOpen && loan) {
      setRenewalDate(todayStr);
      setNewLoanPeriod(loan.loanPeriod || 12);
      setRemarks('');
      setIsSubmitting(false);
    }
  }, [isOpen, loan, todayStr]);

  if (!isOpen || !loan) return null;

  const currentP = loan.principal || 0;
  const currentInterest = calcForRenewalDate.interestEarned || 0;
  const newPrincipal = currentP + currentInterest;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoanPeriod || newLoanPeriod <= 0) {
      alert('Please select or enter a valid loan period.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        renewalDate: renewalDate || todayStr,
        newLoanPeriod: Number(newLoanPeriod),
        remarks: remarks.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to renew loan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-white/20 text-white font-bold">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Renew Loan Cycle</h2>
              <p className="text-xs font-semibold opacity-90">
                Extend loan period for {loan.itemName}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer & Item Context */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-extrabold uppercase">ITEM NAME</span>
              <span className="font-extrabold text-indigo-900 dark:text-indigo-200 text-sm">{loan.itemName}</span>
            </div>
            {loan.customer && (
              <div className="flex justify-between items-center border-t border-indigo-100 dark:border-indigo-900/40 pt-2">
                <span className="text-slate-400 font-extrabold uppercase">CUSTOMER</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{loan.customer.name} ({loan.customer.village})</span>
              </div>
            )}
          </div>

          {/* Renewal Financial Computation Card */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-lg">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-extrabold">PREVIOUS PRINCIPAL</span>
              <span className="font-bold">₹ {currentP.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-amber-400 font-extrabold">+ ACCUMULATED INTEREST</span>
              <span className="font-bold text-amber-400">₹ {currentInterest.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1">
                <span>NEW REVISED PRINCIPAL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              <span className="text-xl font-black text-emerald-300">
                ₹ {newPrincipal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Renewal Date Input */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>RENEWAL DATE</span>
            </label>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* New Loan Period Selection */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>NEW LOAN PERIOD</span>
            </label>
            <select
              value={newLoanPeriod}
              onChange={(e) => setNewLoanPeriod(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months (1 Year)</option>
              <option value={24}>24 Months (2 Years)</option>
              <option value={36}>36 Months (3 Years)</option>
            </select>
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
              placeholder="e.g. Loan renewed for another 1 year"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-indigo-500"
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
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Renewing...' : 'Confirm Loan Renewal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
