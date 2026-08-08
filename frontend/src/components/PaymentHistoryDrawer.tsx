import React from 'react';
import { X, History, ArrowDownCircle } from 'lucide-react';
import { Loan, Payment } from '../types';

interface PaymentHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
}

export const PaymentHistoryDrawer: React.FC<PaymentHistoryDrawerProps> = ({
  isOpen,
  onClose,
  loan
}) => {
  if (!isOpen || !loan) return null;

  const payments: Payment[] = loan.payments || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Payment History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader summary */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block">
            {loan.metalType} • {loan.weight}g
          </span>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">{loan.itemName}</h3>
          <div className="mt-2 flex justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Total Paid: <strong className="text-emerald-600 dark:text-emerald-400">₹ {loan.amountPaid.toLocaleString('en-IN')}</strong></span>
            <span>Outstanding: <strong className="text-slate-900 dark:text-white">₹ {(loan.outstandingBalance || 0).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No previous payment transactions recorded.</p>
            </div>
          ) : (
            payments.map((p, idx) => (
              <div
                key={p.id || idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>₹ {p.amountPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{p.paymentDate}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between pt-1">
                  <span>Balance after payment:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    ₹ {p.balanceAfterPayment.toLocaleString('en-IN')}
                  </span>
                </div>
                {p.remarks && (
                  <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    {p.remarks}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
