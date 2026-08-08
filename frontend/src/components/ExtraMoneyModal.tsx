import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Calendar, DollarSign, FileText } from 'lucide-react';
import { Loan, ExtraMoneyItem } from '../types';

interface ExtraMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  initialData?: ExtraMoneyItem | null;
  onSubmit: (data: { id?: string; amount: number; date: string; remarks?: string }) => Promise<void>;
}

export const ExtraMoneyModal: React.FC<ExtraMoneyModalProps> = ({
  isOpen,
  onClose,
  loan,
  initialData,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);
  const [amount, setAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date || todayStr);
        setAmount(String(initialData.amount || ''));
        setRemarks(initialData.remarks || '');
      } else {
        setDate(todayStr);
        setAmount('');
        setRemarks('');
      }
      setIsSubmitting(false);
    }
  }, [isOpen, initialData, todayStr]);

  if (!isOpen || !loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      alert('Please enter a valid additional amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        id: initialData?.id,
        amount: numAmt,
        date: date || todayStr,
        remarks: remarks.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save extra money record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-slate-950/10 text-slate-950 font-bold">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {initialData ? 'Edit Extra Money' : 'Extra Money Borrowing'}
              </h2>
              <p className="text-xs font-semibold opacity-85">
                {initialData ? 'Update extra money record' : `Add additional loan against ${loan.itemName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-950/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-950" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current Loan Context Summary */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-400 font-extrabold block">PLEDGED ITEM</span>
              <span className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">{loan.itemName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-extrabold block">ORIGINAL PRINCIPAL</span>
              <span className="font-black text-amber-900 dark:text-amber-200 text-sm">₹ {loan.principal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Date Input */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>EXTRA MONEY DATE</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Additional Amount Input */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span>ADDITIONAL AMOUNT (₹)</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              required
              min={1}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>REMARKS / REASON (OPTIONAL)</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Additional loan taken for emergency"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-amber-500"
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
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Entry...' : (initialData ? 'Update Extra Money' : 'Save Extra Money')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
