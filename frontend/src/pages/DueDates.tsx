import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Search,
  RefreshCw,
  User,
  Calculator,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Filter,
  Phone,
  MapPin,
  Coins
} from 'lucide-react';
import { Loan } from '../types';
import { fetchDueLoans, releaseLoan, addInterestPayment, renewLoan, prefetchCustomerDetails } from '../lib/api';
import { formatDisplayDate } from '../lib/dateUtils';
import { PaymentModal } from '../components/PaymentModal';
import { InterestPaymentModal } from '../components/InterestPaymentModal';
import { RenewLoanModal } from '../components/RenewLoanModal';
import { TableSkeleton } from '../components/Skeleton';
import { useDebounce } from '../hooks/useDebounce';

export const DueDates: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overdue' | 'today'>('overdue');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [metalFilter, setMetalFilter] = useState<'ALL' | 'GOLD' | 'SILVER'>('ALL');

  // Modals
  const [releasingLoan, setReleasingLoan] = useState<Loan | null>(null);
  const [interestLoan, setInterestLoan] = useState<Loan | null>(null);
  const [renewingLoan, setRenewingLoan] = useState<Loan | null>(null);

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['due-loans'],
    queryFn: fetchDueLoans,
    staleTime: 1000 * 30
  });

  const overdueLoans = data?.overdueLoans || [];
  const dueTodayLoans = data?.dueTodayLoans || [];

  const loadData = () => {
    refetch();
  };

  const handleReleaseSubmit = async (data: { amountPaid: number; releaseDate?: string; remarks?: string }) => {
    if (!releasingLoan) return;
    const targetId = releasingLoan.id;
    setReleasingLoan(null);
    try {
      await releaseLoan(targetId, data);
    } catch (err: any) {
      alert(err.message || 'Failed to release loan');
    } finally {
      loadData();
    }
  };

  const handleInterestSubmit = async (data: { amountPaid: number; paymentDate: string; remarks?: string }) => {
    if (!interestLoan) return;
    const targetId = interestLoan.id;
    setInterestLoan(null);
    try {
      await addInterestPayment(targetId, data);
    } catch (err: any) {
      alert(err.message || 'Failed to add interest payment');
    } finally {
      loadData();
    }
  };

  const handleRenewSubmit = async (data: { renewalDate: string; newLoanPeriod: number; remarks?: string }) => {
    if (!renewingLoan) return;
    const targetId = renewingLoan.id;
    setRenewingLoan(null);
    try {
      await renewLoan(targetId, data);
    } catch (err: any) {
      alert(err.message || 'Failed to renew loan');
    } finally {
      loadData();
    }
  };

  const rawList = activeTab === 'overdue' ? overdueLoans : dueTodayLoans;

  const filteredLoans = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return rawList.filter((loan) => {
      const custName = loan.customer?.name?.toLowerCase() || '';
      const village = loan.customer?.village?.toLowerCase() || '';
      const mobile = loan.customer?.mobile?.toLowerCase() || '';
      const itemName = loan.itemName?.toLowerCase() || '';

      const matchesQuery = !q || custName.includes(q) || village.includes(q) || mobile.includes(q) || itemName.includes(q);
      const matchesMetal = metalFilter === 'ALL' || loan.metalType.toUpperCase() === metalFilter;

      return matchesQuery && matchesMetal;
    });
  }, [rawList, debouncedSearch, metalFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-8 h-8 text-amber-500" />
            <span>Due Date Management</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track overdue loans, loans due today, and take quick finance actions
          </p>
        </div>

        <button
          onClick={() => loadData()}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>All Overdue Loans</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
            {overdueLoans.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('today')}
          className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'today'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Due Today</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-950/20 text-slate-950 dark:text-white">
            {dueTodayLoans.length}
          </span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Instant Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Customer, Item, Mobile, Village..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Metal Filter Buttons */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1">Metal:</span>
            {(['ALL', 'GOLD', 'SILVER'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetalFilter(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  metalFilter === m
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Due Loans Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Customer Details</th>
                <th className="py-3 px-3">Pledged Item</th>
                <th className="py-3 px-3 text-center">Metal / Weight</th>
                <th className="py-3 px-3">Loan Date</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-center">Overdue Status</th>
                <th className="py-3 px-3 text-right">Principal (₹)</th>
                <th className="py-3 px-3 text-right">Interest (₹)</th>
                <th className="py-3 px-3 text-right">Final Amt (₹)</th>
                <th className="py-3 px-3 text-center">Quick Actions</th>
              </tr>
            </thead>
            {loading && filteredLoans.length === 0 ? (
              <TableSkeleton rows={5} cols={10} />
            ) : (
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No matching loans found in this section.
                    </td>
                  </tr>
                ) : (
                filteredLoans.map((loan) => {
                  const cust = loan.customer;

                  return (
                    <tr
                      key={loan.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Customer Details */}
                      <td className="py-3.5 px-3">
                        {cust ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                              <span>{cust.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({cust.relationshipType} {cust.relationshipName})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2 pt-0.5">
                              <span>📍 {cust.village}</span>
                              <span>📞 {cust.mobile}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Unlinked Customer</span>
                        )}
                      </td>

                      {/* Item Details */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{loan.itemName}</div>
                        {loan.itemDescription && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {loan.itemDescription}
                          </div>
                        )}
                      </td>

                      {/* Metal / Weight */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            loan.metalType === 'GOLD'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {loan.metalType} • {Number(loan.weight || 0).toFixed(3)}g
                        </span>
                      </td>

                      {/* Loan Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200">
                        <div>{formatDisplayDate(loan.loanDate)}</div>
                        {((loan.remarks || '').toLowerCase().includes('partially paid item') || loan.parentLoanId) ? (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5 font-sans tracking-wide">
                            Partially Paid Item
                          </span>
                        ) : ((loan.remarks || '').toLowerCase().includes('renew') && !(loan.remarks || '').toLowerCase().includes('original loan')) ? (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5 font-sans tracking-wide">
                            Renewed Item
                          </span>
                        ) : null}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatDisplayDate(loan.dueDate)}
                      </td>

                      {/* Overdue Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {activeTab === 'today' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] border border-amber-500/30">
                            DUE TODAY
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] border border-rose-500/30">
                            {loan.daysOverdue || 0} DAYS OVERDUE
                          </span>
                        )}
                      </td>

                      {/* Principal */}
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹ {loan.principal.toLocaleString('en-IN')}
                      </td>

                      {/* Interest */}
                      <td className="py-3.5 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        ₹ {(loan.calculatedInterest || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Final Amt */}
                      <td className="py-3.5 px-3 text-right font-black text-slate-900 dark:text-white text-sm">
                        ₹ {(loan.finalAmount || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Open Customer */}
                          {cust && (
                            <button
                              onMouseEnter={() => prefetchCustomerDetails(cust.id)}
                              onClick={() => navigate(`/customers/${cust.id}`)}
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                              title="Open Customer Profile"
                            >
                              <User className="w-3 h-3" />
                              <span>Customer</span>
                            </button>
                          )}

                          {/* Calculate */}
                          <button
                            onClick={() => navigate(`/calculate?customerId=${loan.customerId}&loanIds=${loan.id}`)}
                            className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                            title="Calculate Interest Breakdown"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Calculate</span>
                          </button>

                          {/* Renew Loan */}
                          <button
                            onClick={() => setRenewingLoan(loan)}
                            className="px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                            title="Renew Loan Cycle"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Renew</span>
                          </button>

                          {/* Interest Payment */}
                          <button
                            onClick={() => setInterestLoan(loan)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                            title="Pay Interest Only"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Interest</span>
                          </button>

                          {/* Release Loan */}
                          <button
                            onClick={() => setReleasingLoan(loan)}
                            className="px-2 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-700 hover:bg-slate-800 font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
                            title="Release Loan Item"
                          >
                            <DollarSign className="w-3 h-3 text-amber-400" />
                            <span>Release</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          )}
          </table>
        </div>
      </div>

      {/* Action Modals */}
      <PaymentModal
        isOpen={!!releasingLoan}
        onClose={() => setReleasingLoan(null)}
        loan={releasingLoan}
        onSubmit={handleReleaseSubmit}
      />

      <InterestPaymentModal
        isOpen={!!interestLoan}
        onClose={() => setInterestLoan(null)}
        loan={interestLoan}
        onSubmit={handleInterestSubmit}
      />

      <RenewLoanModal
        isOpen={!!renewingLoan}
        onClose={() => setRenewingLoan(null)}
        loan={renewingLoan}
        onSubmit={handleRenewSubmit}
      />
    </div>
  );
};
