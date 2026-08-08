import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, PlusCircle, Save, Coins } from 'lucide-react';
import { Loan } from '../types';
import { isValidCalendarDate } from '../lib/dateUtils';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: Loan | null;
  customerId: string;
}

export const LoanModal: React.FC<LoanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  customerId
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      loanDate: todayStr,
      releaseDate: '',
      itemName: '',
      itemDescription: '',
      metalType: 'GOLD',
      weight: '' as any,
      principal: '' as any,
      interestRate: 2.0,
      compoundFrequency: 'YEARLY',
      loanPeriod: 12,
      amountPaid: 0,
      releaseStatus: 'ACTIVE',
      remarks: ''
    }
  });

  const selectedMetal = watch('metalType');

  useEffect(() => {
    if (initialData) {
      setValue('itemName', initialData.itemName);
      setValue('itemDescription', initialData.itemDescription || '');
      setValue('metalType', initialData.metalType);
      setValue('weight', initialData.weight);
      setValue('loanDate', initialData.loanDate);
      setValue('releaseDate', initialData.releaseDate || '');
      setValue('principal', initialData.principal);
      setValue('interestRate', initialData.interestRate);
      setValue('compoundFrequency', initialData.compoundFrequency || 'YEARLY');
      setValue('loanPeriod', initialData.loanPeriod);
      setValue('amountPaid', initialData.amountPaid || 0);
      setValue('releaseStatus', initialData.releaseStatus || 'ACTIVE');
      setValue('remarks', initialData.remarks || '');
    } else {
      reset({
        loanDate: todayStr,
        releaseDate: '',
        itemName: '',
        itemDescription: '',
        metalType: 'GOLD',
        weight: '' as any,
        principal: '' as any,
        interestRate: 2.0,
        compoundFrequency: 'YEARLY',
        loanPeriod: 12,
        amountPaid: 0,
        releaseStatus: 'ACTIVE',
        remarks: ''
      });
    }
  }, [initialData, isOpen, reset, setValue, todayStr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData ? 'Edit Pledged Loan Item & Release Status' : 'Add New Pledged Loan Item'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Metal Type Selector (Gold / Silver) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Metal Category *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center justify-center space-x-2 p-3 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm ${
                    selectedMetal === 'GOLD'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    value="GOLD"
                    {...register('metalType')}
                    className="hidden"
                  />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                  <span>GOLD</span>
                </label>

                <label
                  className={`flex items-center justify-center space-x-2 p-3 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm ${
                    selectedMetal === 'SILVER'
                      ? 'border-slate-400 bg-slate-200/50 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    value="SILVER"
                    {...register('metalType')}
                    className="hidden"
                  />
                  <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
                  <span>SILVER</span>
                </label>
              </div>
            </div>

            {/* Item Name & Weight */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  {...register('itemName', { required: 'Item name is required' })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 22K Bangle / Chain / Ring"
                />
                {errors.itemName && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">{String(errors.itemName.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Weight (Grams) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  {...register('weight', { required: true, min: 0.001 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Item Description & Identification
              </label>
              <input
                type="text"
                {...register('itemDescription')}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. 2 pair, stone embedded, hallmark seal"
              />
            </div>

            {/* Principal & Interest Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Principal Amount (₹) *
                </label>
                <input
                  type="number"
                  {...register('principal', { required: true, min: 1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-extrabold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Monthly Interest Rate (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('interestRate', { required: true, min: 0.1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-extrabold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Compound Frequency & Period */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Compound Frequency *
                </label>
                <select
                  {...register('compoundFrequency', { required: true })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MONTHLY">Monthly (30 Days)</option>
                  <option value="THREE_MONTHS">Every 3 Months (90 Days)</option>
                  <option value="SIX_MONTHS">Every 6 Months (180 Days)</option>
                  <option value="YEARLY">Yearly (360 Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Agreed Loan Period (Months)
                </label>
                <input
                  type="number"
                  {...register('loanPeriod', { required: true, min: 1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Loan Date *
                </label>
                <input
                  type="date"
                  {...register('loanDate', {
                    required: 'Loan date is required',
                    validate: (val) => isValidCalendarDate(val) || 'Invalid date. Please enter a valid date.'
                  })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 font-semibold ${
                    errors.loanDate
                      ? 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500'
                  }`}
                />
                {errors.loanDate && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{String(errors.loanDate.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Release Date (Optional)
                </label>
                <input
                  type="date"
                  {...register('releaseDate', {
                    validate: (val) => !val || isValidCalendarDate(val) || 'Invalid date. Please enter a valid date.'
                  })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 ${
                    errors.releaseDate
                      ? 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500'
                  }`}
                />
                {errors.releaseDate && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{String(errors.releaseDate.message)}</p>
                )}
              </div>
            </div>

            {/* Payment & Release Section (if editing existing loan) */}
            {initialData && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Release Status & Payment Info
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Amount Paid (₹)
                    </label>
                    <input
                      type="number"
                      {...register('amountPaid')}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Release Status
                    </label>
                    <select
                      {...register('releaseStatus')}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="RELEASED">Released</option>
                      <option value="RENEWED">Renewed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Remarks
              </label>
              <input
                type="text"
                {...register('remarks')}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Special rate applied"
              />
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : initialData ? 'Update Loan Record' : 'Save Loan Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
