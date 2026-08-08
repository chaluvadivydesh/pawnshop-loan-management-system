import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Filter,
  Printer,
  Download,
  ShieldCheck,
  Lock,
  RefreshCw,
  TrendingUp,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard
} from 'lucide-react';
import { fetchFinancialReport } from '../lib/api';
import { formatDisplayDate } from '../lib/dateUtils';
import { PasswordModal } from '../components/PasswordModal';
import { generatePDFReport } from '../lib/pdf';
import { TableSkeleton } from '../components/Skeleton';

export const FinancialReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(true);
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const defaultStartDate = `${currentYear}-${currentMonth}-01`;
  const defaultEndDate = today.toISOString().split('T')[0];
  const todayStr = defaultEndDate;

  const getWeekStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  };

  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  
  const [reportData, setReportData] = useState<{
    dailyRows: Array<{
      date: string;
      loansGivenCount: number;
      loansReleasedCount: number;
      renewalsCount?: number;
      interestPaymentsCount?: number;
      moneyGiven: number;
      moneyReceived: number;
      interestEarned: number;
    }>;
    totals: {
      totalLoansGiven: number;
      totalLoansReleased: number;
      totalRenewals?: number;
      totalInterestPayments?: number;
      totalMoneyGiven: number;
      totalMoneyReceived: number;
      totalInterestEarned: number;
    };
  } | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  const loadReport = async (sDate: string, eDate: string) => {
    if (!reportData) {
      setLoading(true);
    }
    try {
      const data = await fetchFinancialReport(sDate, eDate);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching financial report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadReport(startDate, endDate);
    }
  }, [isAuthorized, startDate, endDate]);

  // Handle Preset Filters
  const handleFilterToday = () => {
    setActiveFilter('today');
    setStartDate(todayStr);
    setEndDate(todayStr);
  };

  const handleFilterWeek = () => {
    setActiveFilter('week');
    setStartDate(getWeekStartDate());
    setEndDate(todayStr);
  };

  const handleFilterMonth = () => {
    setActiveFilter('month');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  const handleFilterYear = () => {
    setActiveFilter('year');
    setStartDate(`${currentYear}-01-01`);
    setEndDate(defaultEndDate);
  };

  const handleFilterCustom = () => {
    setActiveFilter('custom');
  };

  // Print Report Handler (Triggers Browser Print Dialog for formatted layout)
  const handlePrint = () => {
    window.print();
  };

  // Export PDF Handler (Triggers Direct File Download)
  const handleExportPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      await generatePDFReport(
        'financial-report-print-container',
        `Financial_Report_${startDate}_to_${endDate}.pdf`
      );
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Error generating PDF download. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 text-amber-400 border border-slate-800 flex items-center justify-center mx-auto shadow-2xl">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Financial Reports Module (Password Protected)
          </h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            This module contains confidential business analysis. Please authenticate with your password to view financial reports.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 cursor-pointer inline-flex items-center space-x-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Enter Security Password</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer inline-flex items-center space-x-2"
          >
            <LayoutDashboard className="w-4 h-4 text-amber-500" />
            <span>Return to Dashboard</span>
          </button>
        </div>

        <PasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => {
            setIsAuthorized(true);
            setIsPasswordModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:m-0">
      {/* Header & Controls */}
      <div className="space-y-4 print:hidden">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Return to Dashboard</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-amber-500" />
              <span>Financial Performance Reports</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Day-by-Day Financial Breakdown & Business Period Analysis
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </button>

            <button
              onClick={() => loadReport(startDate, endDate)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Report"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>Print Report</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs shadow-md border border-slate-800 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleFilterToday}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeFilter === 'today'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={handleFilterWeek}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeFilter === 'week'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            This Week
          </button>
          <button
            onClick={handleFilterMonth}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeFilter === 'month'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Current Month
          </button>
          <button
            onClick={handleFilterYear}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeFilter === 'year'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Current Year
          </button>
          <button
            onClick={handleFilterCustom}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeFilter === 'custom'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Custom Date Range
          </button>
        </div>

        {/* Date Pickers */}
        <div className="flex items-center space-x-3 text-xs font-bold">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActiveFilter('custom');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActiveFilter('custom');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Printable Report Section */}
      <div id="financial-report-print-container" className="space-y-6">
        {/* Printable Title & Period Header */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-400" />
              <span>Financial Performance Report</span>
            </h2>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Period: <span className="text-amber-400 font-bold">{formatDisplayDate(startDate)}</span> to <span className="text-amber-400 font-bold">{formatDisplayDate(endDate)}</span>
            </p>
          </div>
        </div>

        {/* Main Report Table Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden print:shadow-none print:border-none">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/60">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Daily Transaction Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing financial activity from <span className="font-bold text-amber-500">{formatDisplayDate(startDate)}</span> to <span className="font-bold text-amber-500">{formatDisplayDate(endDate)}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 text-left">Date</th>
                  <th className="py-3.5 px-4 text-center">Loans Given</th>
                  <th className="py-3.5 px-4 text-center">Loans Released</th>
                  <th className="py-3.5 px-4 text-center">Renewals</th>
                  <th className="py-3.5 px-4 text-center">Interest Payments</th>
                  <th className="py-3.5 px-4 text-right">Money Given (₹)</th>
                  <th className="py-3.5 px-4 text-right">Money Received (₹)</th>
                  <th className="py-3.5 px-4 text-right">Interest Earned (₹)</th>
                </tr>
              </thead>
            {loading && !reportData ? (
              <TableSkeleton rows={5} cols={8} />
            ) : (
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {reportData && reportData.dailyRows.length > 0 ? (
                  reportData.dailyRows.map((row) => (
                    <tr
                      key={row.date}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 date-cell" style={{ whiteSpace: 'nowrap' }}>
                        {formatDisplayDate(row.date)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {row.loansGivenCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black">
                            {row.loansGivenCount}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {row.loansReleasedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                            {row.loansReleasedCount}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {(row.renewalsCount || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black">
                            {row.renewalsCount}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {(row.interestPaymentsCount || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black">
                            {row.interestPaymentsCount}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono" style={{ whiteSpace: 'nowrap' }}>
                        ₹ {row.moneyGiven.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono" style={{ whiteSpace: 'nowrap' }}>
                        ₹ {row.moneyReceived.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-600 dark:text-amber-400 font-mono" style={{ whiteSpace: 'nowrap' }}>
                        ₹ {row.interestEarned.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No financial transaction activity found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            )}
              {/* Bold Totals Footer Row - Displayed ONCE at the end of the table */}
              {reportData && (
                <tfoot style={{ display: 'table-row-group' }}>
                  <tr className="bg-slate-900 text-white font-black text-xs uppercase tracking-wider border-t-2 border-amber-500">
                    <td className="py-4 px-4 font-black text-amber-400">GRAND TOTALS</td>
                    <td className="py-4 px-4 text-center text-amber-400 font-black text-sm">
                      {reportData.totals.totalLoansGiven}
                    </td>
                    <td className="py-4 px-4 text-center text-emerald-400 font-black text-sm">
                      {reportData.totals.totalLoansReleased}
                    </td>
                    <td className="py-4 px-4 text-center text-indigo-400 font-black text-sm">
                      {reportData.totals.totalRenewals || 0}
                    </td>
                    <td className="py-4 px-4 text-center text-amber-400 font-black text-sm">
                      {reportData.totals.totalInterestPayments || 0}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-sm text-white font-mono" style={{ whiteSpace: 'nowrap' }}>
                      ₹ {reportData.totals.totalMoneyGiven.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-sm text-emerald-400 font-mono" style={{ whiteSpace: 'nowrap' }}>
                      ₹ {reportData.totals.totalMoneyReceived.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-base text-amber-400 font-mono" style={{ whiteSpace: 'nowrap' }}>
                      ₹ {reportData.totals.totalInterestEarned.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Grand Summary KPI Cards inside Print & PDF Container - Displayed ONCE at very end */}
        {reportData && (
          <div className="pt-4 page-break-inside-avoid break-inside-avoid" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div className="text-xs font-black uppercase text-amber-500 tracking-wider mb-2">Grand Performance Summary</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Loans Given</div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {reportData.totals.totalLoansGiven}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Loans Released</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {reportData.totals.totalLoansReleased}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Renewed Loans</div>
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {reportData.totals.totalRenewals || 0}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Interest Payments</div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {reportData.totals.totalInterestPayments || 0}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Money Given</div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono" style={{ whiteSpace: 'nowrap' }}>
                  ₹ {reportData.totals.totalMoneyGiven.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Money Received</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono" style={{ whiteSpace: 'nowrap' }}>
                  ₹ {reportData.totals.totalMoneyReceived.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 shadow-sm col-span-1 sm:col-span-2 lg:col-span-2">
                <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">Total Interest Earned</div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono" style={{ whiteSpace: 'nowrap' }}>
                  ₹ {reportData.totals.totalInterestEarned.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
