import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, UserPlus, Save } from 'lucide-react';
import { Customer } from '../types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: Customer | null;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData
}) => {
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = useForm();

  useEffect(() => {
    if (initialData) {
      setValue('name', initialData.name);
      setValue('relationshipType', initialData.relationshipType);
      setValue('relationshipName', initialData.relationshipName);
      setValue('village', initialData.village);
      setValue('mobile', initialData.mobile);
      setValue('address', initialData.address || '');
      setValue('remarks', initialData.remarks || '');
    } else {
      reset({
        name: '',
        relationshipType: 'S/O',
        relationshipName: '',
        village: '',
        mobile: '',
        address: '',
        remarks: ''
      });
    }
  }, [initialData, isOpen, reset, setValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData ? 'Edit Customer Details' : 'Add New Customer'}
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Customer Full Name *
            </label>
            <input
              type="text"
              {...register('name', { required: 'Customer name is required' })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="e.g. Ramesh Kumar"
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{String(errors.name.message)}</p>}
          </div>

          {/* Relation type & Name */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Relation *
              </label>
              <select
                {...register('relationshipType', { required: true })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 font-semibold"
              >
                <option value="S/O">S/O (Son of)</option>
                <option value="D/O">D/O (Daughter of)</option>
                <option value="W/O">W/O (Wife of)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Father / Husband Name *
              </label>
              <input
                type="text"
                {...register('relationshipName', { required: 'Father/Husband name is required' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Subramanian Pillai"
              />
              {errors.relationshipName && (
                <p className="text-xs text-rose-500 mt-1 font-medium">{String(errors.relationshipName.message)}</p>
              )}
            </div>
          </div>

          {/* Village & Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Village / Town *
              </label>
              <input
                type="text"
                {...register('village', { required: 'Village is required' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Anna Nagar"
              />
              {errors.village && <p className="text-xs text-rose-500 mt-1 font-medium">{String(errors.village.message)}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                {...register('mobile', { required: 'Mobile number is required' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. 9840123456"
              />
              {errors.mobile && <p className="text-xs text-rose-500 mt-1 font-medium">{String(errors.mobile.message)}</p>}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Full Address (Optional)
            </label>
            <textarea
              {...register('address')}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
              placeholder="Door No, Street Name, Landmark..."
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              {...register('remarks')}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Regular customer, VIP"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-200 dark:border-slate-800">
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
              <span>{isSubmitting ? 'Saving...' : initialData ? 'Update Customer' : 'Save Customer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
