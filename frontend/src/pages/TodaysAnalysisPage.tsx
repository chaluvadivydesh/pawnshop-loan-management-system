import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Scale,
  DollarSign,
  TrendingUp,
  History,
  CheckCircle2,
  PlusCircle,
  Clock,
  ArrowLeft,
  LayoutDashboard
} from 'lucide-react';
import { fetchTodaysAnalysis } from '../lib/api';
import { formatDisplayDate } from '../lib/dateUtils';
import { CardGridSkeleton, TableSkeleton } from '../components/Skeleton';

export const TodaysAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];

  const getWeekStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  };

  const getMonthStartDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'given' | 'released' | 'renewals' | 'partial'>('given');

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['todays-analysis', startDate, endDate],
    queryFn: () => fetchTodaysAnalysis(startDate, endDate),
    staleTime: 1000 * 30
  });

  const loadAnalysis = () => {
    refetch();
  };

  useEffect(() => {
    let s = todayStr;
    let e = todayStr;

    if (activeFilter === 'today') {
      s = todayStr;
      e = todayStr;
    } else if (activeFilter === 'week') {
      s = getWeekStartDate();
      e = todayStr;
    } else if (activeFilter === 'month') {
      s = getMonthStartDate();
      e = todayStr;
    } else if (activeFilter === 'custom') {
      s = startDate;
      e = endDate;
    }

    setStartDate(s);
    setEndDate(e);
  }, [activeFilter]);

  const handleApplyCustomDate = () => {
    if (activeFilter === 'custom') {
      loadAnalysis();
    }
  };

  const summary = data?.summary || {
    loansGivenCount: 0,
    loansReleasedCount: 0,
    renewalsCount: 0,
    totalMoneyGiven: 0,
    totalMoneyReceived: 0,
    totalPrincipalReturned: 0,
    totalInterestCollected: 0,
    interestFromReleases: 0,
    interestFromRenewals: 0,
    interestFromInterestOnly: 0
  };

  const loansGiven = data?.loansGiven || [];
  const loansReleased = data?.loansReleased || [];
  const renewedLoans = data?.renewedLoans || [];
  const interestPayments = data?.interestPayments || [];
  const extraMoneyEntries = data?.extraMoneyEntries || [];
  const partialPayments = data?.partialPayments || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Refresh Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-3 group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Return to Dashboard</span>
          </button>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            <span>Today's Business Analysis</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Complete real-time report of loans given, releases, renewals, and interest collections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
          <button
            onClick={() => loadAnalysis()}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Analysis</span>
          </button>
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveFilter('today')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveFilter('week')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'week'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setActiveFilter('month')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'month'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setActiveFilter('custom')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            Period: <span className="text-slate-900 dark:text-white">{formatDisplayDate(startDate)}</span> to{' '}
            <span className="text-slate-900 dark:text-white">{formatDisplayDate(endDate)}</span>
          </div>
        </div>

        {/* Custom Date Selector */}
        {activeFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
            </div>
            <button
              onClick={handleApplyCustomDate}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards Row */}
      {loading && !data ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Loans Given */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span className="text-xs font-black uppercase tracking-wider">Loans Given</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summary.loansGivenCount} <span className="text-xs text-slate-500 font-normal">Loans</span>
            </div>
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Money Out: ₹ {summary.totalMoneyGiven.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 2: Loans Released */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span className="text-xs font-black uppercase tracking-wider">Loans Released</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summary.loansReleasedCount} <span className="text-xs text-slate-500 font-normal">Released</span>
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Principal Returned: ₹ {summary.totalPrincipalReturned.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 3: Total Money Received */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span className="text-xs font-black uppercase tracking-wider">Total Received</span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              ₹ {summary.totalMoneyReceived.toLocaleString('en-IN')}
            </div>
            <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
              Principal + Interest Collections
            </div>
          </div>

          {/* Card 4: Total Interest Collected */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span className="text-xs font-black uppercase tracking-wider">Interest Earned</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              ₹ {summary.totalInterestCollected.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Releases: ₹{summary.interestFromReleases.toLocaleString('en-IN')} • Interest Only: ₹{(summary.interestFromInterestOnly || 0).toLocaleString('en-IN')} • Partial: ₹{(summary.interestFromPartialPayments || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2 px-2">
          <button
            onClick={() => setActiveTab('given')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'given'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Loans Given ({loansGiven.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('released')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'released'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Loans Released ({loansReleased.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('renewals')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'renewals'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Renewals & Payments ({renewedLoans.length + interestPayments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('partial')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'partial'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Partial Payments ({partialPayments.length})</span>
          </button>
        </div>

        {/* Tab 1: Loans Given */}
        {activeTab === 'given' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Loan Date</th>
                    <th className="py-3 px-3">Item Name</th>
                    <th className="py-3 px-3 text-right">Weight</th>
                    <th className="py-3 px-3 text-right">Principal Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                  {loansGiven.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                        No loans given during this period.
                      </td>
                    </tr>
                  ) : (
                    loansGiven.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => navigate(`/customers/${item.customerId}`)}
                            className="hover:text-amber-600 dark:hover:text-amber-400 hover:underline text-left cursor-pointer"
                          >
                            {item.customerName}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {formatDisplayDate(item.loanDate)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {item.itemName}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Number(item.weight || 0).toFixed(3)} g
                        </td>
                        <td className="py-3 px-3 text-right font-black text-blue-600 dark:text-blue-400 text-sm">
                          ₹ {item.principal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Box */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row justify-between items-center font-bold text-xs text-blue-950 dark:text-blue-200">
              <div>Total Loans Given: <span className="font-black text-sm">{summary.loansGivenCount}</span></div>
              <div>Total Money Given: <span className="font-black text-base text-blue-600 dark:text-blue-400">₹ {summary.totalMoneyGiven.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        )}

        {/* Tab 2: Loans Released */}
        {activeTab === 'released' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Original Date</th>
                    <th className="py-3 px-3">Release Date</th>
                    <th className="py-3 px-3">Item Name</th>
                    <th className="py-3 px-3 text-right">Weight</th>
                    <th className="py-3 px-3 text-right">Principal</th>
                    <th className="py-3 px-3 text-right">Interest Collected</th>
                    <th className="py-3 px-3 text-right">Total Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                  {loansReleased.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                        No loans released during this period.
                      </td>
                    </tr>
                  ) : (
                    loansReleased.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => navigate(`/customers/${item.customerId}`)}
                            className="hover:text-amber-600 dark:hover:text-amber-400 hover:underline text-left cursor-pointer"
                          >
                            {item.customerName}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                          {formatDisplayDate(item.loanDate)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatDisplayDate(item.releaseDate)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {item.itemName}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Number(item.weight || 0).toFixed(3)} g
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          ₹ {item.principal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                          ₹ {item.interestCollected.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹ {item.totalAmountReceived.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Box */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 grid grid-cols-2 md:grid-cols-4 gap-4 font-bold text-xs text-emerald-950 dark:text-emerald-200">
              <div>Total Loans Released: <span className="font-black text-sm">{summary.loansReleasedCount}</span></div>
              <div>Principal Returned: <span className="font-black text-sm">₹ {summary.totalPrincipalReturned.toLocaleString('en-IN')}</span></div>
              <div>Interest Collected: <span className="font-black text-sm text-amber-600">₹ {summary.interestFromReleases.toLocaleString('en-IN')}</span></div>
              <div>Total Received: <span className="font-black text-base text-emerald-600 dark:text-emerald-400">₹ {summary.totalMoneyReceived.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        )}

        {/* Tab 3: Renewals & Interest Payments & Partial Payments */}
        {activeTab === 'renewals' && (
          <div className="p-4 space-y-6">
            {/* Section 1: Renewed Loans */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
                <span>RENEWED LOANS ({renewedLoans.length})</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Original Date</th>
                      <th className="py-2.5 px-3">Renewal Date</th>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3 text-right">Previous Principal</th>
                      <th className="py-2.5 px-3 text-right">Interest Collected</th>
                      <th className="py-2.5 px-3 text-right">New Principal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                    {renewedLoans.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold">
                          No renewals executed during this period.
                        </td>
                      </tr>
                    ) : (
                      renewedLoans.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {r.customerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {formatDisplayDate(r.originalLoanDate)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatDisplayDate(r.renewalDate)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {r.itemName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                            ₹ {r.previousPrincipal.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                            ₹ {r.accumulatedInterest.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">
                            ₹ {r.newPrincipal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Interest-Only Payments */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>INTEREST-ONLY PAYMENTS ({interestPayments.length})</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                    {interestPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                          No interest-only payments received during this period.
                        </td>
                      </tr>
                    ) : (
                      interestPayments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {p.customerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {formatDisplayDate(p.paymentDate)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {p.itemName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 text-sm">
                            ₹ {p.amountPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic">
                            {p.remarks || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Partial Payments */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-pink-500" />
                <span>PARTIAL PAYMENTS ({partialPayments.length})</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Cash Paid</th>
                      <th className="py-2.5 px-3 text-right">Interest Cleared</th>
                      <th className="py-2.5 px-3 text-right">Principal Reduced</th>
                      <th className="py-2.5 px-3 text-right">New Principal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                    {partialPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold">
                          No partial payments executed during this period.
                        </td>
                      </tr>
                    ) : (
                      partialPayments.map((pp: any) => (
                        <tr key={pp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {pp.customerId ? (
                              <button
                                onClick={() => navigate(`/customers/${pp.customerId}`)}
                                className="hover:text-pink-600 dark:hover:text-pink-400 hover:underline text-left cursor-pointer"
                              >
                                {pp.customerName}
                              </button>
                            ) : (
                              pp.customerName
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-pink-600 dark:text-pink-400">
                            {formatDisplayDate(pp.paymentDate)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold">
                              {pp.paymentType === 'PRINCIPAL_PLUS_INTEREST' ? 'P + I' : 'P Only'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                            ₹ {pp.totalAmountPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            ₹ {pp.interestPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            ₹ {pp.principalPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-pink-600 dark:text-pink-400 text-sm">
                            ₹ {pp.newPrincipal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Partial Payments Dedicated Tab */}
        {activeTab === 'partial' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Payment Date</th>
                    <th className="py-3 px-3">Item Name</th>
                    <th className="py-3 px-3">Payment Type</th>
                    <th className="py-3 px-3 text-right">Cash Paid</th>
                    <th className="py-3 px-3 text-right">Interest Cleared</th>
                    <th className="py-3 px-3 text-right">Principal Reduced</th>
                    <th className="py-3 px-3 text-right">New Active Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                  {partialPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                        No partial payments executed during this period.
                      </td>
                    </tr>
                  ) : (
                    partialPayments.map((pp: any) => (
                      <tr key={pp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {pp.customerId ? (
                            <button
                              onClick={() => navigate(`/customers/${pp.customerId}`)}
                              className="hover:text-pink-600 dark:hover:text-pink-400 hover:underline text-left cursor-pointer"
                            >
                              {pp.customerName}
                            </button>
                          ) : (
                            pp.customerName
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-pink-600 dark:text-pink-400">
                          {formatDisplayDate(pp.paymentDate)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {pp.itemName}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-1 rounded bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold uppercase tracking-wider border border-pink-200 dark:border-pink-800">
                            {pp.paymentType === 'PRINCIPAL_PLUS_INTEREST' ? '1. Principal + Interest' : '2. Principal Only'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white text-sm">
                          ₹ {pp.totalAmountPaid.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹ {pp.interestPaid.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹ {pp.principalPaid.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-pink-600 dark:text-pink-400 text-sm">
                          ₹ {pp.newPrincipal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Box */}
            <div className="p-4 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/50 flex flex-col sm:flex-row justify-between items-center font-bold text-xs text-pink-950 dark:text-pink-200 gap-2">
              <div>Total Partial Payments: <span className="font-black text-sm">{partialPayments.length}</span></div>
              <div>Total Cash Received: <span className="font-black text-base text-pink-600 dark:text-pink-400">₹ {partialPayments.reduce((s: number, p: any) => s + (p.totalAmountPaid || 0), 0).toLocaleString('en-IN')}</span></div>
              <div>Interest Cleared: <span className="font-black text-base text-emerald-600 dark:text-emerald-400">₹ {partialPayments.reduce((s: number, p: any) => s + (p.interestPaid || 0), 0).toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
