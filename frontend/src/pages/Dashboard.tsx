import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Scale,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Coins,
  BarChart3,
  X,
  Gem,
  ArrowUpRight,
  HandCoins
} from 'lucide-react';
import { Customer, DashboardStats } from '../types';
import { fetchCustomers, fetchDashboardStats, createCustomer, prefetchCustomerDetails } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { CardGridSkeleton, TableSkeleton } from '../components/Skeleton';
import { CustomerModal } from '../components/CustomerModal';
import { PasswordModal } from '../components/PasswordModal';
import { VillageReportModal } from '../components/VillageReportModal';
import { formatDisplayDate } from '../lib/dateUtils';
import { MapPin } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isVillageModalOpen, setIsVillageModalOpen] = useState<boolean>(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  const { data: stats = null, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 30
  });

  const { data: customers = [], isLoading: customersLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', searchQuery],
    queryFn: () => fetchCustomers(searchQuery),
    staleTime: 1000 * 30
  });

  const loading = (statsLoading && !stats) || (customersLoading && customers.length === 0);

  const loadData = () => {
    refetchStats();
    refetchCustomers();
  };

  const handleCreateCustomer = async (data: any) => {
    try {
      await createCustomer(data);
      setIsCustomerModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to create customer:', err);
      alert('Error creating customer. Please try again.');
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Finance Management Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Gold & Silver Loan Management • Live Database Synchronization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Finance Dashboard Modal Button */}
          <button
            onClick={() => {
              if (isAuthorized) {
                setIsFinanceModalOpen(true);
              } else {
                setIsPasswordModalOpen(true);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-400 font-extrabold text-sm shadow-md border border-slate-800 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Finance Dashboard</span>
          </button>

          {/* Today's Analysis Button */}
          <button
            onClick={() => navigate('/todays-analysis')}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Today's Analysis</span>
          </button>

          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/25 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Main KPI Section - Exactly 3 Summary Cards */}
      {loading && !stats ? (
        <CardGridSkeleton count={3} />
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Customers */}
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            variant="amber"
          />

          {/* Card 2: Today Given */}
          <StatCard
            title="Today Given"
            value={`${stats.todayGivenCount || 0} Loans`}
            subtitle="Loans Issued Today"
            icon={HandCoins}
            variant="gold"
          />

          {/* Card 3: Today Released */}
          <StatCard
            title="Today Released"
            value={`${stats.todayReleasedLoans || 0} Items`}
            subtitle="Items Returned / Handed Back Today"
            icon={CheckCircle2}
            variant="emerald"
          />
        </div>
      ) : null}

      {/* Search Bar & Customer Directory Table Header */}
      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Customer Directory & Loan Records
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any customer row to view detailed loan items & compound calculations
            </p>
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Mobile, Village..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Customer Table (Desktop View) */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Father / Husband</th>
                <th className="py-3 px-4">Village</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4 text-center">Active Loans</th>
                <th className="py-3 px-4 text-center">Released</th>
                <th className="py-3 px-4 text-right">Total Outstanding</th>
                <th className="py-3 px-4 text-right">Last Updated</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            {loading && customers.length === 0 ? (
              <TableSkeleton rows={5} cols={9} />
            ) : (
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No matching customers found in database.
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                  <tr
                    key={cust.id}
                    onMouseEnter={() => prefetchCustomerDetails(cust.id)}
                    onClick={() => navigate(`/customers/${cust.id}`)}
                    className="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {cust.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <span className="text-xs font-semibold text-slate-400 mr-1">{cust.relationshipType}</span>
                      {cust.relationshipName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {cust.village}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-mono text-xs">
                      {cust.mobile}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {cust.activeLoansCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {cust.releasedLoansCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white text-base">
                      ₹ {(cust.totalOutstanding || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                      {formatDisplayDate(cust.lastUpdatedDate)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-amber-500 inline-block transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          )}
          </table>
        </div>

        {/* Customer Cards (Mobile View) */}
        <div className="md:hidden space-y-3">
          {customers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No matching customers found.
            </div>
          ) : (
            customers.map((cust) => (
              <div
                key={cust.id}
                onClick={() => navigate(`/customers/${cust.id}`)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 active:bg-amber-500/10 cursor-pointer shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{cust.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {cust.relationshipType} {cust.relationshipName} • {cust.village}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-x-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                      {cust.activeLoansCount || 0} Active
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                      {cust.releasedLoansCount || 0} Released
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    ₹ {(cust.totalOutstanding || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Customer Modal (Add Customer) */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSubmit={handleCreateCustomer}
      />

      {/* FINANCE DASHBOARD MODAL */}
      {isFinanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>Finance Dashboard</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Live Overview
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Detailed summary of active pledges, cash inflows, outflows & today's interest
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFinanceModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body Grid - 7 Key Financial Metrics */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* 1. Total Active Loans */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Active Loans</span>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalActiveLoans}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {stats.totalReleasedLoans} Loans Released & Returned
                    </p>
                  </div>

                  {/* 2. Total Principal */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Principal</span>
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Coins className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                      ₹ {(stats.totalPrincipal || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Outstanding: ₹ {(stats.totalOutstanding || 0).toLocaleString('en-IN')}
                    </p>
                  </div>

                  {/* 3. Total Gold */}
                  <div className="bg-amber-500/10 dark:bg-amber-950/40 p-5 rounded-2xl border border-amber-500/30 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Total Gold Pledged</span>
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Award className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-amber-900 dark:text-amber-200">
                      {stats.totalGoldWeight} <span className="text-lg font-bold">grams</span>
                    </div>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">
                      Currently Active Gold Ornaments
                    </p>
                  </div>

                  {/* 4. Total Silver */}
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-5 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Silver Pledged</span>
                      <div className="p-2 rounded-xl bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        <Scale className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                      {stats.totalSilverWeight} <span className="text-lg font-bold">grams</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Currently Active Silver Items
                    </p>
                  </div>

                  {/* 5. How Much Amount Given Today */}
                  <div className="bg-orange-50 dark:bg-orange-950/40 p-5 rounded-2xl border border-orange-200 dark:border-orange-900/50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Amount Given Today</span>
                      <div className="p-2 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400">
                        <HandCoins className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-orange-900 dark:text-orange-200">
                      ₹ {(stats.todayGivenAmount || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs text-orange-700/80 dark:text-orange-400/80 font-medium">
                      {stats.todayGivenCount || 0} New Loans Issued Today
                    </p>
                  </div>

                  {/* 6. How Much Amount Received Today */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Amount Received Today</span>
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-emerald-900 dark:text-emerald-200">
                      ₹ {(stats.todayCollections || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                      Total Payments & Release Receipts Today
                    </p>
                  </div>

                  {/* 7. Today's Interest */}
                  <div className="bg-amber-500 p-5 rounded-2xl text-white space-y-2 sm:col-span-2 lg:col-span-1 shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold uppercase tracking-wider opacity-90">Today's Interest</span>
                      <div className="p-2 rounded-xl bg-white/20 text-white">
                        <Gem className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-3xl font-black tracking-tight">
                      ₹ {(stats.todayInterest || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs opacity-90 font-medium">
                      Net Interest Earned Across Today's Payments
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setIsFinanceModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md cursor-pointer transition-colors"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Protection Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => {
          setIsAuthorized(true);
          setIsFinanceModalOpen(true);
        }}
      />
    </div>
  );
};
