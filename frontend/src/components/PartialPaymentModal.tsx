import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Info, Layers, CheckCircle2 } from 'lucide-react';
import { Loan } from '../types';
import { calculateCompoundInterest } from '../lib/calculator';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSubmit: (data: {
    paymentDate: string;
    paymentType: 'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY';
    amount: number;
    remarks?: string;
  }) => Promise<void>;
}

export const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({
  isOpen,
  onClose,
  loan,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentType, setPaymentType] = useState<'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY'>('PRINCIPAL_PLUS_INTEREST');
  const [amount, setAmount] = useState<number | string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(todayStr);
      setPaymentType('PRINCIPAL_PLUS_INTEREST');
      setAmount('');
      setRemarks('');
      setLoading(false);
    }
  }, [isOpen, todayStr]);

  if (!isOpen || !loan) return null;

  // Compute live current interest up to paymentDate
  const interestPayments = (loan.payments || [])
    .filter((p) => p.paymentType === 'INTEREST_ONLY')
    .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

  const calc = calculateCompoundInterest({
    principal: loan.principal,
    interestRate: loan.interestRate,
    compoundFrequency: loan.compoundFrequency,
    loanDate: loan.loanDate,
    calculationDate: paymentDate || todayStr,
    amountPaid: loan.amountPaid,
    extraMoneyEntries: loan.extraMoney || [],
    interestPaymentEntries: interestPayments,
    renewalEntries: loan.renewals || []
  });

  const previousPrincipal = calc.principal;
  const outstandingInterest = calc.interestEarned;
  const numericAmount = Number(amount) || 0;

  let interestPaid = 0;
  let principalPaid = 0;
  let newPrincipal = previousPrincipal;

  if (paymentType === 'PRINCIPAL_PLUS_INTEREST') {
    interestPaid = Math.min(numericAmount, outstandingInterest);
    const remainingPayment = Math.max(0, numericAmount - interestPaid);
    principalPaid = Math.min(previousPrincipal, remainingPayment);
    newPrincipal = Math.max(0, previousPrincipal - principalPaid);
  } else {
    // PRINCIPAL_ONLY
    interestPaid = 0;
    principalPaid = Math.min(previousPrincipal, numericAmount);
    const remainingP = Math.max(0, previousPrincipal - principalPaid);
    newPrincipal = remainingP + outstandingInterest;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numericAmount || numericAmount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        paymentDate,
        paymentType,
        amount: numericAmount,
        remarks
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to process partial payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center font-black">
              ₹
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Partial Payment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Item: <strong className="text-slate-800 dark:text-slate-200">{loan.itemName}</strong> (Principal: ₹{loan.principal.toLocaleString('en-IN')})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Partial Payment Date */}
          <div>
            <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              PARTIAL PAYMENT DATE
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-pink-500 outline-none"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
              This date becomes the new financial start date for future interest calculations.
            </span>
          </div>

          {/* Payment Type Options */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              PAYMENT TYPE
            </label>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                  paymentType === 'PRINCIPAL_PLUS_INTEREST'
                    ? 'border-pink-500 bg-pink-500/10 text-pink-900 dark:text-pink-100 ring-2 ring-pink-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="PRINCIPAL_PLUS_INTEREST"
                  checked={paymentType === 'PRINCIPAL_PLUS_INTEREST'}
                  onChange={() => setPaymentType('PRINCIPAL_PLUS_INTEREST')}
                  className="mt-0.5 text-pink-600 focus:ring-pink-500"
                />
                <div>
                  <span className="font-extrabold text-sm block">1. Principal + Interest</span>
                  <span className="text-xs opacity-80 font-medium block mt-0.5">
                    Payment first clears all outstanding interest (₹{outstandingInterest.toLocaleString('en-IN')}), and any remaining amount reduces principal.
                  </span>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                  paymentType === 'PRINCIPAL_ONLY'
                    ? 'border-pink-500 bg-pink-500/10 text-pink-900 dark:text-pink-100 ring-2 ring-pink-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="PRINCIPAL_ONLY"
                  checked={paymentType === 'PRINCIPAL_ONLY'}
                  onChange={() => setPaymentType('PRINCIPAL_ONLY')}
                  className="mt-0.5 text-pink-600 focus:ring-pink-500"
                />
                <div>
                  <span className="font-extrabold text-sm block">2. Principal Only</span>
                  <span className="text-xs opacity-80 font-medium block mt-0.5">
                    Reduces principal directly. Unpaid interest (₹{outstandingInterest.toLocaleString('en-IN')}) is merged/capitalized into new principal.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              {paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'TOTAL PAYMENT AMOUNT (₹)' : 'PRINCIPAL REDUCTION AMOUNT (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-slate-500 font-bold text-sm">₹</span>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'Enter total payment amount...' : 'Enter principal reduction amount...'}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
          </div>

          {/* Live Automatic Breakdown Card */}
          <div className="bg-slate-100 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="font-black text-slate-900 dark:text-white flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400">Automatic Allocation Summary</span>
              <span className="text-[10px] font-mono text-pink-600 dark:text-pink-400 font-bold">Live Breakdown</span>
            </div>

            <div className="flex justify-between font-medium">
              <span className="text-slate-600 dark:text-slate-400">Current Principal:</span>
              <span className="font-extrabold text-slate-900 dark:text-white">₹ {previousPrincipal.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between font-medium">
              <span className="text-slate-600 dark:text-slate-400">Accumulated Interest:</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">₹ {outstandingInterest.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between font-medium pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-600 dark:text-slate-400">Interest Paid (Cleared):</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹ {interestPaid.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between font-medium">
              <span className="text-slate-600 dark:text-slate-400">Principal Paid (Reduced):</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹ {principalPaid.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center font-black text-sm pt-2 border-t border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
              <span>New Active Principal:</span>
              <span className="text-base text-pink-600 dark:text-pink-400">₹ {newPrincipal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Remarks Field */}
          <div>
            <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              REMARKS (OPTIONAL)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add optional notes for this partial payment..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-xs shadow-lg shadow-pink-600/25 flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Processing...' : 'Submit Partial Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
