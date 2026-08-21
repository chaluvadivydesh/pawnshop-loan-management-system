import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  PlusCircle,
  Calendar,
  Phone,
  MapPin,
  Coins,
  Edit2,
  Trash2,
  DollarSign,
  History,
  Calculator,
  Printer,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle2,
  RefreshCw,
  MoreVertical,
  Tag
} from 'lucide-react';
import { Customer, Loan, ExtraMoneyItem, Payment, LoanRenewalItem, PartialPaymentItem } from '../types';
import {
  fetchCustomerDetails,
  getMemoryCachedCustomer,
  setMemoryCachedCustomer,
  createLoan,
  updateLoan,
  releaseLoan,
  deleteLoan,
  deleteCustomer,
  addExtraMoney,
  updateExtraMoney,
  deleteExtraMoney,
  addInterestPayment,
  renewLoan,
  addPartialPayment,
  deletePayment,
  deleteRenewal
} from '../lib/api';
import { CustomerModal } from '../components/CustomerModal';
import { LoanModal } from '../components/LoanModal';
import { PaymentModal } from '../components/PaymentModal';
import { ExtraMoneyModal } from '../components/ExtraMoneyModal';
import { InterestPaymentModal } from '../components/InterestPaymentModal';
import { RenewLoanModal } from '../components/RenewLoanModal';
import { PartialPaymentModal } from '../components/PartialPaymentModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { CustomerDetailsSkeleton } from '../components/Skeleton';
import { formatDisplayDate } from '../lib/dateUtils';
import { calculateCompoundInterest } from '../lib/calculator';
import { printCustomerRecord } from '../lib/pdf';

const processCustomerData = (data: (Customer & { loans: Loan[] }) | null) => {
  if (!data) return null;
  const today = new Date().toISOString().split('T')[0];
  const cloned = JSON.parse(JSON.stringify(data));
  if (cloned.loans) {
    cloned.loans.sort((a: Loan, b: Loan) => (a.loanDate || '').localeCompare(b.loanDate || ''));
    cloned.loans = cloned.loans.map((loan: Loan) => {
      const calcDate = loan.releaseStatus === 'ACTIVE' ? today : (loan.calculationDate || loan.releaseDate || today);
      const interestPayments = (loan.payments || []).filter((p: Payment) => p.paymentType === 'INTEREST_ONLY');
      const effectivePaid = loan.releaseStatus === 'ACTIVE' ? 0 : (loan.amountPaid || 0);
      const calc = calculateCompoundInterest({
        principal: loan.principal,
        interestRate: loan.interestRate,
        compoundFrequency: loan.compoundFrequency,
        loanDate: loan.loanDate,
        calculationDate: calcDate,
        amountPaid: effectivePaid,
        extraMoneyEntries: loan.extraMoney || [],
        interestPaymentEntries: interestPayments
      });

      return {
        ...loan,
        calculatedInterest: calc.interestEarned,
        finalAmount: calc.finalAmount,
        outstandingBalance: (loan.releaseStatus === 'RELEASED' || loan.releaseStatus === 'RENEWED' || loan.releaseStatus === 'PARTIALLY_PAID') ? 0 : calc.outstandingBalance
      };
    });
  }
  return cloned;
};

export const CustomerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(() => {
    if (!id) return null;
    const cached = getMemoryCachedCustomer(id);
    return cached ? processCustomerData(cached) : null;
  });
  const [loading, setLoading] = useState<boolean>(() => !id || !getMemoryCachedCustomer(id));

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState<boolean>(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Confirm Delete Modal State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    onConfirm: () => Promise<void>;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    onConfirm: async () => {}
  });

  const [releasingLoan, setReleasingLoan] = useState<Loan | null>(null);
  const [extraMoneyLoan, setExtraMoneyLoan] = useState<Loan | null>(null);
  const [editingExtraMoney, setEditingExtraMoney] = useState<ExtraMoneyItem | null>(null);
  const [interestPaymentLoan, setInterestPaymentLoan] = useState<Loan | null>(null);
  const [renewingLoan, setRenewingLoan] = useState<Loan | null>(null);
  const [partialPaymentLoan, setPartialPaymentLoan] = useState<Loan | null>(null);

  // Active Three-Dots context menu ID
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Expanded History Rows
  const [expandedLoanIds, setExpandedLoanIds] = useState<string[]>([]);

  // Selection for calculation
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);

  // Profile Action Overflow Menu State
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async (showLoading: boolean = false, forceRefresh: boolean = false) => {
    if (!id) return;
    if (showLoading && !customer) setLoading(true);
    try {
      const data = await fetchCustomerDetails(id, forceRefresh);
      const processed = processCustomerData(data);
      if (processed) {
        setMemoryCachedCustomer(id, processed);
      }

      setCustomer((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(processed)) {
          return prev;
        }
        return processed;
      });
    } catch (err) {
      console.error('Error loading customer profile:', err);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const cached = getMemoryCachedCustomer(id);
    if (cached) {
      setCustomer(cached);
      setLoading(false);
      loadData(false);
    } else {
      loadData(true);
    }
  }, [id]);

  const toggleSelectLoan = (loanId: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(loanId) ? prev.filter((i) => i !== loanId) : [...prev, loanId]
    );
  };

  const toggleSelectAll = () => {
    if (!customer || !customer.loans) return;
    if (selectedLoanIds.length === customer.loans.length) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(customer.loans.map((l: Loan) => l.id));
    }
  };

  const toggleExpandHistory = (loanId: string) => {
    setExpandedLoanIds((prev) =>
      prev.includes(loanId) ? prev.filter((i) => i !== loanId) : [...prev, loanId]
    );
  };

  const handleDeleteLoanItem = (loanId: string, itemName?: string) => {
    const childLoans = (customer?.loans || []).filter((l) => l.parentLoanId === loanId);
    const hasLinkedChildren = childLoans.length > 0;

    const message = hasLinkedChildren
      ? 'This loan has linked Renewed/Partially Paid records. Deleting this loan will permanently delete the entire linked loan chain. This action cannot be undone.'
      : itemName
        ? `Are you sure you want to delete loan "${itemName}"? This action cannot be undone.`
        : 'Are you sure you want to delete this record? This action cannot be undone.';

    setDeleteConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message,
      onConfirm: async () => {
        try {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
          await deleteLoan(loanId);
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
          console.time('DELETE_STATE_UPDATE');
          await loadData(false, true);
          console.timeEnd('DELETE_STATE_UPDATE');
        } catch (err: any) {
          alert(err.message || 'Failed to delete loan');
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
        }
      }
    });
  };

  const handleReleaseSubmit = async (data: { amountPaid: number; releaseDate?: string; remarks?: string }) => {
    if (!releasingLoan) return;
    const targetId = releasingLoan.id;
    setReleasingLoan(null);
    try {
      await releaseLoan(targetId, data);
      console.time('RELEASE_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('RELEASE_STATE_UPDATE');
    } catch (err: any) {
      alert(err.message || 'Failed to release loan');
    }
  };

  const handleExtraMoneySubmit = async (data: { amount: number; date: string; remarks?: string }) => {
    const extraId = editingExtraMoney?.id;
    const loanId = extraMoneyLoan?.id;
    setExtraMoneyLoan(null);
    setEditingExtraMoney(null);
    try {
      if (extraId) {
        await updateExtraMoney(extraId, data);
      } else if (loanId) {
        await addExtraMoney(loanId, data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save Extra Money');
    } finally {
      console.time('EXTRA_MONEY_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('EXTRA_MONEY_STATE_UPDATE');
    }
  };

  const handleDeleteExtraMoneyItem = (extraMoneyId: string) => {
    setDeleteConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      onConfirm: async () => {
        try {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
          await deleteExtraMoney(extraMoneyId);
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
          console.time('EXTRA_MONEY_STATE_UPDATE');
          await loadData(false, true);
          console.timeEnd('EXTRA_MONEY_STATE_UPDATE');
        } catch (err: any) {
          alert(err.message || 'Failed to delete Extra Money entry');
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
        }
      }
    });
  };

  const handleDeletePaymentItem = (paymentId: string) => {
    setDeleteConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      onConfirm: async () => {
        try {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
          await deletePayment(paymentId);
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
          await loadData(false, true);
        } catch (err: any) {
          alert(err.message || 'Failed to delete payment');
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
        }
      }
    });
  };

  const handleDeleteRenewalItem = (renewalId: string) => {
    setDeleteConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      onConfirm: async () => {
        try {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
          await deleteRenewal(renewalId);
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
          await loadData(false, true);
        } catch (err: any) {
          alert(err.message || 'Failed to delete renewal');
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
        }
      }
    });
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;
    setDeleteConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete customer "${customer.name}" and all associated loan records? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
          await deleteCustomer(customer.id);
          navigate('/');
        } catch (err: any) {
          alert(err.message || 'Failed to delete customer');
        } finally {
          setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} });
        }
      }
    });
  };

  const handleInterestPaymentSubmit = async (data: { amountPaid: number; paymentDate: string; remarks?: string }) => {
    if (!interestPaymentLoan) return;
    const targetId = interestPaymentLoan.id;
    setInterestPaymentLoan(null);
    try {
      await addInterestPayment(targetId, data);
    } catch (err: any) {
      alert(err.message || 'Failed to add interest payment');
    } finally {
      console.time('INTEREST_PAYMENT_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('INTEREST_PAYMENT_STATE_UPDATE');
    }
  };

  const handleRenewSubmit = async (data: { renewalDate: string; newLoanPeriod: number; remarks?: string }) => {
    if (!renewingLoan) return;
    const targetId = renewingLoan.id;
    setRenewingLoan(null);
    try {
      await renewLoan(targetId, data);
      console.time('RENEW_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('RENEW_STATE_UPDATE');
    } catch (err: any) {
      alert(err.message || 'Failed to renew loan');
    }
  };

  const handlePartialPaymentSubmit = async (data: { paymentDate: string; paymentType: 'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY'; amount: number; remarks?: string }) => {
    if (!partialPaymentLoan) return;
    const targetId = partialPaymentLoan.id;
    setPartialPaymentLoan(null);
    try {
      await addPartialPayment(targetId, data);
    } catch (err: any) {
      alert(err.message || 'Failed to add partial payment');
    } finally {
      console.time('PARTIAL_PAYMENT_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('PARTIAL_PAYMENT_STATE_UPDATE');
    }
  };

  const handleLoanModalSubmit = async (formData: any) => {
    if (!customer) return;
    const loanToEdit = editingLoan;
    setIsLoanModalOpen(false);
    setEditingLoan(null);
    try {
      if (loanToEdit) {
        await updateLoan(loanToEdit.id, formData);
      } else {
        await createLoan({ ...formData, customerId: customer.id });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save loan');
    } finally {
      console.time('CREATE_LOAN_STATE_UPDATE');
      await loadData(false, true);
      console.timeEnd('CREATE_LOAN_STATE_UPDATE');
    }
  };

  const handleNavigateToMultiCalculation = () => {
    if (!id || selectedLoanIds.length === 0) return;
    navigate(`/calculate?customerId=${id}&loanIds=${selectedLoanIds.join(',')}`);
  };

  if (loading && !customer) {
    return <CustomerDetailsSkeleton />;
  }

  if (!customer) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customer Record Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const loansList = customer.loans || [];
  const activeLoansList = loansList.filter((l: Loan) => l.releaseStatus === 'ACTIVE');

  const grandTotalPrincipal = activeLoansList.reduce((sum: number, l: Loan) => {
    const extraP = (l.extraMoney || []).reduce((s: number, em: ExtraMoneyItem) => s + (em.amount || 0), 0);
    return sum + l.principal + extraP;
  }, 0);

  const grandTotalInterest = activeLoansList.reduce((sum: number, l: Loan) => {
    const interestPayments = (l.payments || [])
      .filter((p) => p.paymentType === 'INTEREST_ONLY')
      .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const calc = calculateCompoundInterest({
      principal: l.principal,
      interestRate: l.interestRate,
      compoundFrequency: l.compoundFrequency,
      loanDate: l.loanDate,
      calculationDate: todayStr,
      amountPaid: 0,
      extraMoneyEntries: l.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: l.renewals || []
    });

    return sum + calc.interestEarned;
  }, 0);

  const grandTotalAmountToBePaid = grandTotalPrincipal + grandTotalInterest;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
    >
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => customer && printCustomerRecord(customer)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900 font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all cursor-pointer shadow-md"
            title="Print Customer Record Statement"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Customer Record</span>
          </button>
          <button
            onClick={() => {
              setEditingLoan(null);
              setIsLoanModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Loan Item</span>
          </button>

          {/* Three-Dot Overflow Action Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              title="Customer Profile Options"
              aria-label="Customer Profile Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 py-2 space-y-1 animate-fadeIn">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsCustomerModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center space-x-2.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-500" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    handleDeleteCustomer();
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Delete Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Information Header */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{customer.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {customer.relationshipType} {customer.relationshipName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>{customer.village}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-mono">{customer.mobile}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Created: {formatDisplayDate(customer.createdAt)}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl flex items-center space-x-6 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Loans</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">{customer.activeLoansCount || 0}</span>
            </div>
            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Released Loans</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{customer.releasedLoansCount || 0}</span>
            </div>
          </div>
        </div>

        {customer.remarks && (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Remarks: {customer.remarks}
          </p>
        )}
      </div>

      {/* Pledged Loan Items Table */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              <span>Pledged Loan Items ({loansList.length})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sorted by Loan Date (ascending). Use actions to add Extra Money, pay Interest Only, or Release item.
            </p>
          </div>

          {selectedLoanIds.length > 0 && (
            <button
              onClick={handleNavigateToMultiCalculation}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center space-x-2 transition-all transform active:scale-95 animate-pulse cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculate Selected ({selectedLoanIds.length} Loans)</span>
            </button>
          )}
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-2 text-center w-8">
                  <input
                    type="checkbox"
                    checked={selectedLoanIds.length === loansList.length && loansList.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                  />
                </th>
                <th className="py-3 px-2 text-center">History</th>
                <th className="py-3 px-3">Loan Date</th>
                <th className="py-3 px-3">Release Date</th>
                <th className="py-3 px-3">Pledged Item</th>
                <th className="py-3 px-3 text-center">Metal</th>
                <th className="py-3 px-3 text-right">Weight (g)</th>
                <th className="py-3 px-3 text-right">Principal (₹)</th>
                <th className="py-3 px-3 text-center">Rate / Freq</th>
                <th className="py-3 px-3 text-right">Interest (₹)</th>
                <th className="py-3 px-3 text-right">Final Amt (₹)</th>
                <th className="py-3 px-3 text-right">Paid (₹)</th>
                <th className="py-3 px-3 text-right">Outstanding (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {loansList.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    No pledged loan records yet. Click "Add Loan Item" to record the first loan.
                  </td>
                </tr>
              ) : (
                loansList.map((loan: Loan) => {
                  // Find latest child in linked loan chain for parent-child display synchronization
                  const findLatestChild = (parentId: string): Loan | null => {
                    const directChild = loansList.find((c: Loan) => c.parentLoanId === parentId);
                    if (!directChild) return null;
                    const deeperChild = findLatestChild(directChild.id);
                    return deeperChild || directChild;
                  };

                  const latestChild = findLatestChild(loan.id);

                  // Synchronize parent loan display status with child record
                  const isReleased = loan.releaseStatus === 'RELEASED' || (latestChild ? latestChild.releaseStatus === 'RELEASED' : false);
                  const isPartiallyPaid = !isReleased && loan.releaseStatus === 'PARTIALLY_PAID';
                  const isRenewed = !isReleased && (loan.releaseStatus === 'RENEWED' || (latestChild ? latestChild.releaseStatus === 'ACTIVE' : false));
                  const isSelected = selectedLoanIds.includes(loan.id);
                  const isExpanded = expandedLoanIds.includes(loan.id);

                  // Compute 100% Live Timeline Interest Calculation for this loan
                  const interestPayments = (loan.payments || [])
                    .filter((p) => p.paymentType === 'INTEREST_ONLY')
                    .map((p) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

                  const hasChildren = loansList.some((c: Loan) => c.parentLoanId === loan.id);
                  const isParentLoan = hasChildren || loan.releaseStatus === 'RENEWED' || (loan.renewals && loan.renewals.length > 0);
                  const isRenewedParent = isParentLoan;
                  const latestRenewalDate = (loan.renewals && loan.renewals.length > 0)
                    ? loan.renewals[loan.renewals.length - 1].renewalDate
                    : null;

                  const rowCalcDate = loan.releaseStatus === 'ACTIVE'
                    ? todayStr
                    : isRenewedParent
                    ? (latestRenewalDate || loan.calculationDate || todayStr)
                    : (loan.calculationDate || loan.releaseDate || todayStr);

                  const effectivePaidRow = loan.releaseStatus === 'ACTIVE' ? 0 : (loan.amountPaid || 0);
                  const liveCalc = calculateCompoundInterest({
                    principal: loan.principal,
                    interestRate: loan.interestRate,
                    compoundFrequency: loan.compoundFrequency,
                    loanDate: loan.loanDate,
                    calculationDate: rowCalcDate,
                    amountPaid: effectivePaidRow,
                    extraMoneyEntries: loan.extraMoney || [],
                    interestPaymentEntries: interestPayments,
                    renewalEntries: isRenewedParent ? [] : (loan.renewals || [])
                  });

                  // Compute display paid amount (handling RELEASED, PARTIALLY_PAID, and ACTIVE loans)
                  let displayPaidAmount = 0;
                  if (loan.releaseStatus === 'RELEASED') {
                    if (isParentLoan) {
                      if (loan.partialPayments && loan.partialPayments.length > 0) {
                        displayPaidAmount = loan.partialPayments[loan.partialPayments.length - 1].totalAmountPaid;
                      } else if (loan.amountPaid > 0) {
                        displayPaidAmount = loan.amountPaid;
                      } else {
                        const childPartial = loansList.find((c: Loan) => c.parentLoanId === loan.id);
                        if (childPartial && (childPartial.remarks || '').toLowerCase().includes('partial')) {
                          const matchPaid = (childPartial.remarks || '').match(/Cash Paid:?\s*₹?\s*([0-9,]+)/i);
                          displayPaidAmount = matchPaid ? Number(matchPaid[1].replace(/,/g, '')) : 0;
                        } else {
                          displayPaidAmount = 0; // Renewed parent loan paid amount is 0
                        }
                      }
                    } else {
                      displayPaidAmount = loan.amountPaid > 0 ? loan.amountPaid : liveCalc.finalAmount;
                    }
                  } else if (loan.releaseStatus === 'PARTIALLY_PAID' || isPartiallyPaid) {
                    if (loan.partialPayments && loan.partialPayments.length > 0) {
                      displayPaidAmount = loan.partialPayments[loan.partialPayments.length - 1].totalAmountPaid;
                    } else if (loan.amountPaid > 0) {
                      displayPaidAmount = loan.amountPaid;
                    } else {
                      const childPartial = loansList.find((c: Loan) => c.parentLoanId === loan.id);
                      if (childPartial) {
                        const matchPaid = (childPartial.remarks || '').match(/Cash Paid:?\s*₹?\s*([0-9,]+)/i);
                        if (matchPaid) {
                          displayPaidAmount = Number(matchPaid[1].replace(/,/g, ''));
                        } else {
                          displayPaidAmount = Math.max(0, Number(loan.principal) - Number(childPartial.principal));
                        }
                      }
                    }
                  }

                  // Calculate total extra money borrowed
                  const totalExtra = liveCalc.totalExtraMoney || 0;

                  // Build timeline events for expanded view
                  const timelineEvents: Array<{
                    id: string;
                    type: string;
                    date: string;
                    amountStr: string;
                    remarks?: string;
                    bgClass: string;
                    isPartialPaymentEvent?: boolean;
                    paymentMode?: string;
                    principalDeducted?: number;
                    interestDeducted?: number;
                    totalPaid?: number;
                    onEdit?: () => void;
                    onDelete?: () => void;
                  }> = [];

                  timelineEvents.push({
                    id: loan.id,
                    type: 'Original Loan',
                    date: loan.loanDate,
                    amountStr: `₹ ${loan.principal.toLocaleString('en-IN')}`,
                    remarks: loan.remarks || undefined,
                    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 text-indigo-900 dark:text-indigo-200',
                    onEdit: () => {
                      setEditingLoan(loan);
                      setIsLoanModalOpen(true);
                    },
                    onDelete: () => handleDeleteLoanItem(loan.id)
                  });

                  (loan.extraMoney || []).forEach((em: ExtraMoneyItem) => {
                    timelineEvents.push({
                      id: em.id || `em-${Date.now()}`,
                      type: 'Extra Money',
                      date: em.date,
                      amountStr: `+ ₹ ${em.amount.toLocaleString('en-IN')}`,
                      remarks: em.remarks || undefined,
                      bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-200',
                      onEdit: () => {
                        setExtraMoneyLoan(loan);
                        setEditingExtraMoney(em);
                      },
                      onDelete: () => em.id && handleDeleteExtraMoneyItem(em.id)
                    });
                  });

                  (loan.payments || []).forEach((p: Payment) => {
                    const isInterestOnly = p.paymentType === 'INTEREST_ONLY';
                    const remLower = (p.remarks || '').toLowerCase();
                    const isReleasePayment = remLower.includes('release payment') || remLower.includes('settled on renewal') || remLower.includes('release');

                    // If loan is currently ACTIVE (or not released), hide non-interest payment records from timeline
                    if (!isReleased && !isInterestOnly) {
                      return;
                    }

                    let eventType = 'Payment';
                    if (isInterestOnly) {
                      eventType = 'Interest Payment';
                    } else if (isReleasePayment || (isReleased && p.amountPaid >= liveCalc.finalAmount)) {
                      eventType = 'Release';
                    }

                    const displayAmount = (eventType === 'Release' && (loan.amountPaid || 0) > 0)
                      ? loan.amountPaid
                      : p.amountPaid;

                    timelineEvents.push({
                      id: p.id,
                      type: eventType,
                      date: p.paymentDate,
                      amountStr: `₹ ${displayAmount.toLocaleString('en-IN')}`,
                      remarks: p.remarks || (isInterestOnly ? 'Interest Settled' : undefined),
                      bgClass: eventType === 'Release'
                        ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 text-teal-900 dark:text-teal-200'
                        : isInterestOnly
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200'
                        : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 text-blue-900 dark:text-blue-200',
                      onEdit: () => (eventType === 'Release' ? setReleasingLoan(loan) : setInterestPaymentLoan(loan)),
                      onDelete: () => handleDeletePaymentItem(p.id)
                    });
                  });

                  (loan.renewals || []).forEach((ren: LoanRenewalItem) => {
                    timelineEvents.push({
                      id: ren.id || `ren-${Date.now()}`,
                      type: 'Loan Renewed',
                      date: ren.renewalDate,
                      amountStr: `New Principal: ₹ ${ren.newPrincipal.toLocaleString('en-IN')}`,
                      remarks: `Interest Compounded: ₹${ren.accumulatedInterest.toLocaleString('en-IN')} (${ren.newLoanPeriod} Months)`,
                      bgClass: 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 text-pink-900 dark:text-pink-200',
                      onEdit: () => setRenewingLoan(loan),
                      onDelete: () => ren.id && handleDeleteRenewalItem(ren.id)
                    });
                  });

                  const ppEntries = (loan.partialPayments || []);
                  if (ppEntries.length > 0) {
                    ppEntries.forEach((pp: PartialPaymentItem) => {
                      const isPI = pp.paymentType === 'PRINCIPAL_PLUS_INTEREST';
                      const modeLabel = isPI ? 'P+I' : 'P';
                      timelineEvents.push({
                        id: pp.id || `pp-${Date.now()}`,
                        type: 'Partial Payment',
                        date: pp.paymentDate,
                        amountStr: `₹ ${pp.totalAmountPaid.toLocaleString('en-IN')}`,
                        isPartialPaymentEvent: true,
                        paymentMode: modeLabel,
                        principalDeducted: pp.principalPaid,
                        interestDeducted: pp.interestPaid,
                        totalPaid: pp.totalAmountPaid,
                        remarks: pp.remarks || `Partial Payment (${modeLabel})`,
                        bgClass: 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 text-pink-900 dark:text-pink-200',
                        onDelete: () => pp.id && handleDeletePaymentItem(pp.id)
                      });
                    });
                  } else if (isPartiallyPaid || (loan.remarks || '').toLowerCase().includes('partial')) {
                    // Fallback for parent loan records created prior to PartialPayment model or with child links
                    const childPartial = loansList.find((c: Loan) => c.parentLoanId === loan.id);
                    if (childPartial) {
                      const childRem = (childPartial.remarks || '').toLowerCase();
                      const isPI = !childRem.includes('p only') && !childRem.includes('principal only');
                      const modeLabel = isPI ? 'P+I' : 'P';

                      const matchPaid = (childPartial.remarks || '').match(/Cash Paid:?\s*₹?\s*([0-9,]+)/i);
                      const cashPaid = matchPaid ? Number(matchPaid[1].replace(/,/g, '')) : (Number(loan.principal) - Number(childPartial.principal));
                      const principalDeducted = Math.max(0, Number(loan.principal) - Number(childPartial.principal));
                      const interestDeducted = isPI ? Math.max(0, cashPaid - principalDeducted) : 0;

                      timelineEvents.push({
                        id: `pp-fallback-${loan.id}`,
                        type: 'Partial Payment',
                        date: childPartial.loanDate,
                        amountStr: `₹ ${cashPaid.toLocaleString('en-IN')}`,
                        isPartialPaymentEvent: true,
                        paymentMode: modeLabel,
                        principalDeducted,
                        interestDeducted,
                        totalPaid: cashPaid,
                        remarks: `Partial Payment (${modeLabel})`,
                        bgClass: 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 text-pink-900 dark:text-pink-200'
                      });
                    }
                  }

                  timelineEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

                  return (
                    <React.Fragment key={loan.id}>
                      <tr
                        className={`transition-colors relative ${
                          isPartiallyPaid || isRenewed
                            ? 'bg-pink-500/10 dark:bg-pink-950/30 text-slate-700 dark:text-slate-300 border-l-4 border-pink-500 hover:bg-pink-500/15'
                            : isReleased
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/30 text-slate-900 dark:text-slate-100 hover:bg-emerald-500/20'
                            : isSelected
                            ? 'bg-amber-500/10 dark:bg-amber-500/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Select Checkbox */}
                        <td className="py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectLoan(loan.id)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                          />
                        </td>

                        {/* View History Button (Left side next to Checkbox) */}
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleExpandHistory(loan.id)}
                            className="px-2 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 font-bold text-[10px] flex items-center justify-center space-x-1 cursor-pointer"
                            title="Toggle Loan Transaction History"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>History</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>

                        {/* Loan Date */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-slate-100">
                          <div>{formatDisplayDate(loan.loanDate)}</div>
                          {(() => {
                            const remLower = (loan.remarks || '').toLowerCase();
                            const isChildRecord = Boolean(loan.parentLoanId);
                            const parentLoan = loan.parentLoanId ? loansList.find((p: Loan) => p.id === loan.parentLoanId) : null;

                            const isRenewedChild = isChildRecord && (
                              remLower.includes('renew') ||
                              (parentLoan && parentLoan.renewals && parentLoan.renewals.length > 0 && !remLower.includes('partial'))
                            );

                            const isPartialChild = isChildRecord && (
                              remLower.includes('partial') ||
                              (parentLoan && parentLoan.partialPayments && parentLoan.partialPayments.length > 0 && !remLower.includes('renew'))
                            );

                            if (isRenewedChild) {
                              return (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5 font-sans tracking-wide">
                                  Renewed Item
                                </span>
                              );
                            } else if (isPartialChild) {
                              return (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5 font-sans tracking-wide">
                                  Partially Paid Item
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </td>

                        {/* Release Date */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-500">
                          {formatDisplayDate(isReleased ? (loan.releaseDate || (latestChild ? latestChild.releaseDate : null)) : null)}
                        </td>

                        {/* Item Name & Description */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{loan.itemName}</span>
                            {isRenewed && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase">
                                Cycle Ended
                              </span>
                            )}
                            {totalExtra > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-black" title={`+₹${totalExtra} Extra Money Borrowed`}>
                                +₹{totalExtra.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          {loan.itemDescription && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                              {loan.itemDescription}
                            </div>
                          )}
                        </td>

                        {/* Metal Badge */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              loan.metalType === 'GOLD'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {loan.metalType}
                          </span>
                        </td>

                        {/* Weight */}
                        <td className="py-3 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {Number(loan.weight || 0).toFixed(3)} g
                        </td>

                        {/* Principal */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          ₹ {loan.principal.toLocaleString('en-IN')}
                        </td>

                        {/* Rate / Freq */}
                        <td className="py-3 px-3 text-center whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="font-bold text-amber-600 dark:text-amber-400">{loan.interestRate}%</span> / {loan.compoundFrequency.slice(0, 3)}
                        </td>

                        {/* Live Calculated Interest */}
                        <td className="py-3 px-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                          ₹ {liveCalc.interestEarned.toLocaleString('en-IN')}
                        </td>

                        {/* Live Final Amount */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          ₹ {liveCalc.finalAmount.toLocaleString('en-IN')}
                        </td>

                        {/* Amount Paid */}
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹ {displayPaidAmount.toLocaleString('en-IN')}
                        </td>

                        {/* Live Outstanding Balance */}
                        <td className="py-3 px-3 text-right font-black text-sm">
                          <span className={isReleased || isRenewed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
                            ₹ {(isReleased || isRenewed ? 0 : liveCalc.outstandingBalance).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isReleased ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700">
                              RELEASED
                            </span>
                          ) : isPartiallyPaid ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-800 border border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700">
                              PARTIALLY PAID
                            </span>
                          ) : isRenewed ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-800 border border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700">
                              RENEWED
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700">
                              ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Restored Action Buttons on Far Right */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Edit Loan */}
                            <button
                              onClick={() => {
                                setEditingLoan(loan);
                                setIsLoanModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                              title="Edit Loan Record"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            {/* Release / Payment */}
                            {!isReleased && !isRenewed && (
                              <button
                                onClick={() => setReleasingLoan(loan)}
                                className="px-2 py-1 rounded-lg bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                                title="Release Item / Enter Payment"
                              >
                                <DollarSign className="w-3 h-3 text-amber-400" />
                                <span>Release</span>
                              </button>
                            )}

                            {/* Extra Money */}
                            {!isReleased && !isRenewed && (
                              <button
                                onClick={() => {
                                  setExtraMoneyLoan(loan);
                                  setEditingExtraMoney(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                                title="Add Extra Money Borrowing"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Extra Money</span>
                              </button>
                            )}

                            {/* Interest Only Payment */}
                            {!isReleased && !isRenewed && (
                              <button
                                onClick={() => setInterestPaymentLoan(loan)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                                title="Pay Interest Only"
                              >
                                <DollarSign className="w-3 h-3 text-emerald-500" />
                                <span>Interest</span>
                              </button>
                            )}

                             {/* Partial Payment */}
                            {!isReleased && !isRenewed && (
                              <button
                                onClick={() => setPartialPaymentLoan(loan)}
                                className="px-2 py-1 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 border border-pink-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                                title="Process Partial Payment"
                              >
                                <Coins className="w-3 h-3 text-pink-500" />
                                <span>Partial Pay</span>
                              </button>
                            )}

                            {/* Renew Loan */}
                            {!isReleased && !isRenewed && (
                              <button
                                onClick={() => setRenewingLoan(loan)}
                                className="px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                                title="Renew Loan Cycle"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Renew</span>
                              </button>
                            )}

                             {/* Delete Loan */}
                            <button
                              onClick={() => handleDeleteLoanItem(loan.id, loan.itemName)}
                              className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                              title="Delete Loan Record"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Loan History Timeline Section */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-950/80">
                          <td colSpan={15} className="p-4 border-t border-b border-slate-200 dark:border-slate-800">
                            <div className="space-y-3 max-w-5xl">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-2">
                                  <History className="w-4 h-4 text-amber-500" />
                                  <span>Loan Transaction History ({timelineEvents.length} Events)</span>
                                </h4>
                                <span className="text-[10px] text-slate-400">Chronological Event Stream</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {timelineEvents.map((evt, idx) => (
                                  <div key={idx} className={`p-3 rounded-2xl border text-xs space-y-1 ${evt.bgClass} relative`}>
                                    <div className="flex justify-between items-center text-[10px] font-extrabold opacity-80 uppercase tracking-wider">
                                      <div className="flex items-center gap-1.5">
                                        {/* Three-Dots Menu */}
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenMenuId(openMenuId === evt.id ? null : evt.id);
                                            }}
                                            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                            title="Event Actions"
                                          >
                                            <MoreVertical className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
                                          </button>

                                          {openMenuId === evt.id && (
                                            <div className="absolute left-0 top-6 z-30 w-32 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1 font-semibold text-xs space-y-0.5 text-slate-900 dark:text-slate-100">
                                              {evt.onEdit && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(null);
                                                    evt.onEdit!();
                                                  }}
                                                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                                  <span>Edit</span>
                                                </button>
                                              )}

                                              {evt.onDelete && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(null);
                                                    evt.onDelete!();
                                                  }}
                                                  className="w-full px-3 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 cursor-pointer font-bold"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                                  <span>Delete</span>
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        <span>{evt.type}</span>
                                      </div>
                                      <span className="font-mono">{formatDisplayDate(evt.date)}</span>
                                    </div>
                                    <div className="text-base font-black tracking-tight">{evt.amountStr}</div>
                                    {evt.isPartialPaymentEvent ? (
                                      <div className="text-[11px] font-medium opacity-90 space-y-0.5 mt-1 leading-snug">
                                        <div className="flex items-center gap-1">
                                          <span className="font-bold text-pink-700 dark:text-pink-300">Type:</span>
                                          <span className="font-black px-1.5 py-0.5 rounded bg-pink-200/60 dark:bg-pink-900/60 text-pink-900 dark:text-pink-100 text-[10px]">
                                            {evt.paymentMode}
                                          </span>
                                        </div>
                                        {evt.paymentMode === 'P+I' ? (
                                          <>
                                            <div>Principal Deducted: <strong className="font-extrabold text-slate-900 dark:text-slate-100">₹ {(evt.principalDeducted || 0).toLocaleString('en-IN')}</strong></div>
                                            <div>Interest Cleared: <strong className="font-extrabold text-emerald-700 dark:text-emerald-300">₹ {(evt.interestDeducted || 0).toLocaleString('en-IN')}</strong></div>
                                          </>
                                        ) : (
                                          <div>Principal Reduction: <strong className="font-extrabold text-slate-900 dark:text-slate-100">₹ {(evt.totalPaid || 0).toLocaleString('en-IN')}</strong></div>
                                        )}
                                      </div>
                                    ) : (
                                      evt.remarks && (
                                        <div className="text-[11px] font-medium italic opacity-85 truncate">
                                          {evt.remarks}
                                        </div>
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRAND BILL SUMMARY AT THE BOTTOM OF CUSTOMER PAGE */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
              <Coins className="w-6 h-6 text-amber-400" />
              <span>Grand Bill Summary</span>
            </h2>
            <p className="text-xs text-slate-400">Aggregate metrics across all pledged loans for {customer.name}</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
            360-Day Financial Calendar Standard
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-extrabold block mb-1">Total Principal (Active Loans)</span>
            <span className="text-2xl font-black text-white">₹ {grandTotalPrincipal.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30">
            <span className="text-xs text-amber-400 uppercase font-extrabold block mb-1">Current Interest (Active Loans)</span>
            <span className="text-3xl font-black text-amber-400">₹ {grandTotalInterest.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/30">
            <span className="text-xs text-emerald-400 uppercase font-extrabold block mb-1">Total Amount to be Paid</span>
            <span className="text-3xl font-black text-emerald-300">₹ {grandTotalAmountToBePaid.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        initialData={customer}
        onSubmit={async (data) => {
          loadData();
          setIsCustomerModalOpen(false);
        }}
      />

      <LoanModal
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setEditingLoan(null);
        }}
        customerId={customer.id}
        initialData={editingLoan}
        onSubmit={handleLoanModalSubmit}
      />

      <PaymentModal
        isOpen={!!releasingLoan}
        onClose={() => setReleasingLoan(null)}
        loan={releasingLoan}
        onSubmit={handleReleaseSubmit}
      />

      <ExtraMoneyModal
        isOpen={!!extraMoneyLoan}
        onClose={() => {
          setExtraMoneyLoan(null);
          setEditingExtraMoney(null);
        }}
        loan={extraMoneyLoan}
        initialData={editingExtraMoney}
        onSubmit={handleExtraMoneySubmit}
      />

      <InterestPaymentModal
        isOpen={!!interestPaymentLoan}
        onClose={() => setInterestPaymentLoan(null)}
        loan={interestPaymentLoan}
        onSubmit={handleInterestPaymentSubmit}
      />

      <RenewLoanModal
        isOpen={!!renewingLoan}
        onClose={() => setRenewingLoan(null)}
        loan={renewingLoan}
        onSubmit={handleRenewSubmit}
      />

      <PartialPaymentModal
        isOpen={!!partialPaymentLoan}
        onClose={() => setPartialPaymentLoan(null)}
        loan={partialPaymentLoan}
        onSubmit={handlePartialPaymentSubmit}
      />

      <ConfirmModal
        isOpen={deleteConfirmState.isOpen}
        title={deleteConfirmState.title}
        message={deleteConfirmState.message}
        isDeleting={deleteConfirmState.isDeleting}
        onConfirm={deleteConfirmState.onConfirm}
        onCancel={() => setDeleteConfirmState({ isOpen: false, onConfirm: async () => {} })}
      />
    </motion.div>
  );
};
