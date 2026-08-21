import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  Sliders,
  AlertCircle,
  FileText,
  Coins
} from 'lucide-react';
import { fetchPortfolioLoans } from '../lib/api';
import { CardGridSkeleton } from '../components/Skeleton';

interface PredefinedRange {
  label: string;
  min: number;
  max: number;
  isExact?: boolean;
}

const PREDEFINED_GOLD_RANGES: PredefinedRange[] = [
  { label: '₹0 – ₹3,000', min: 0, max: 3000 },
  { label: '₹3,001 – ₹5,000', min: 3001, max: 5000 },
  { label: '₹5,001 – ₹7,000', min: 5001, max: 7000 },
  { label: '₹7,001 – ₹9,999', min: 7001, max: 9999 },
  { label: '₹10,000', min: 10000, max: 10000, isExact: true },
  { label: '₹10,001 – ₹14,999', min: 10001, max: 14999 },
  { label: '₹15,000', min: 15000, max: 15000, isExact: true },
  { label: '₹15,001 – ₹20,000', min: 15001, max: 20000 },
  { label: '₹20,001 – ₹30,000', min: 20001, max: 30000 },
  { label: '₹30,001 – ₹50,000', min: 30001, max: 50000 },
  { label: '₹50,000+', min: 50001, max: Infinity }
];

const PREDEFINED_SILVER_RANGES: PredefinedRange[] = [
  { label: '₹0 – ₹5,000', min: 0, max: 5000 },
  { label: '₹5,000+', min: 5001, max: Infinity }
];

export function getGoldRangeIndex(principal: number): number {
  if (principal <= 3000) return 0;
  if (principal <= 5000) return 1;
  if (principal <= 7000) return 2;
  if (principal <= 9999) return 3;
  if (principal === 10000) return 4;
  if (principal <= 14999) return 5;
  if (principal === 15000) return 6;
  if (principal <= 20000) return 7;
  if (principal <= 30000) return 8;
  if (principal <= 50000) return 9;
  return 10;
}

export function getSilverRangeIndex(principal: number): number {
  if (principal <= 5000) return 0;
  return 1;
}

export const LoanAmountAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMetal, setSelectedMetal] = useState<'GOLD' | 'SILVER'>('GOLD');
  const [activeMode, setActiveMode] = useState<'default' | 'custom'>('default');

  // Custom range inputs & state
  const [minInput, setMinInput] = useState<string>('');
  const [maxInput, setMaxInput] = useState<string>('');
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ min: number; max: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: activeLoans = [], isLoading, refetch } = useQuery({
    queryKey: ['loan-amount-analysis-portfolio'],
    queryFn: () => fetchPortfolioLoans(),
    staleTime: 1000 * 30
  });

  // Filter loans strictly by selected metal
  const metalLoans = useMemo(() => {
    return activeLoans.filter(
      (loan: any) => (loan.metalType || '').toUpperCase() === selectedMetal
    );
  }, [activeLoans, selectedMetal]);

  // Aggregate predefined ranges for selected metal
  const rangeAggregates = useMemo(() => {
    const ranges = selectedMetal === 'GOLD' ? PREDEFINED_GOLD_RANGES : PREDEFINED_SILVER_RANGES;
    const buckets = ranges.map((r) => ({
      label: r.label,
      count: 0,
      totalWeight: 0,
      totalPrincipal: 0,
      totalOutstanding: 0
    }));

    metalLoans.forEach((loan: any) => {
      const principal = Number(loan.principal) || 0;
      const weight = Number(loan.weight) || 0;
      const outstanding = Number(loan.outstandingBalance) || 0;

      const idx = selectedMetal === 'GOLD' ? getGoldRangeIndex(principal) : getSilverRangeIndex(principal);
      if (buckets[idx]) {
        buckets[idx].count += 1;
        buckets[idx].totalWeight += weight;
        buckets[idx].totalPrincipal += principal;
        buckets[idx].totalOutstanding += outstanding;
      }
    });

    return buckets;
  }, [metalLoans, selectedMetal]);

  // Predefined Grand Totals
  const defaultGrandTotals = useMemo(() => {
    return rangeAggregates.reduce(
      (acc, curr) => ({
        count: acc.count + curr.count,
        totalWeight: acc.totalWeight + curr.totalWeight,
        totalPrincipal: acc.totalPrincipal + curr.totalPrincipal,
        totalOutstanding: acc.totalOutstanding + curr.totalOutstanding
      }),
      { count: 0, totalWeight: 0, totalPrincipal: 0, totalOutstanding: 0 }
    );
  }, [rangeAggregates]);

  // Custom range aggregate for selected metal
  const customAggregate = useMemo(() => {
    if (!appliedCustomRange) return null;

    const { min, max } = appliedCustomRange;
    let count = 0;
    let totalWeight = 0;
    let totalPrincipal = 0;
    let totalOutstanding = 0;

    metalLoans.forEach((loan: any) => {
      const principal = Number(loan.principal) || 0;
      if (principal >= min && principal <= max) {
        const weight = Number(loan.weight) || 0;
        const outstanding = Number(loan.outstandingBalance) || 0;

        count += 1;
        totalWeight += weight;
        totalPrincipal += principal;
        totalOutstanding += outstanding;
      }
    });

    return {
      min,
      max,
      count,
      totalWeight,
      totalPrincipal,
      totalOutstanding
    };
  }, [metalLoans, appliedCustomRange]);

  const handleMetalChange = (metal: 'GOLD' | 'SILVER') => {
    setSelectedMetal(metal);
    // Reset custom range error when switching metal
    setValidationError(null);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMin = minInput.trim();
    const trimmedMax = maxInput.trim();

    if (!trimmedMin || !trimmedMax) {
      setValidationError('Please enter both minimum and maximum loan amounts.');
      return;
    }

    const minNum = Number(trimmedMin);
    const maxNum = Number(trimmedMax);

    if (isNaN(minNum) || isNaN(maxNum)) {
      setValidationError('Please enter valid numeric values for minimum and maximum amounts.');
      return;
    }

    if (minNum < 0 || maxNum < 0) {
      setValidationError('Loan amounts cannot be negative.');
      return;
    }

    if (minNum > maxNum) {
      setValidationError('Minimum amount cannot be greater than maximum amount.');
      return;
    }

    setAppliedCustomRange({ min: minNum, max: maxNum });
  };

  const handleResetCustom = () => {
    setMinInput('');
    setMaxInput('');
    setAppliedCustomRange(null);
    setValidationError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Dashboard</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => navigate('/financial-reports')}
              className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Financial Reports</span>
            </button>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            <span>Loan Amount Range Analysis</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Separated Gold & Silver portfolio range analysis based strictly on Loan Principal
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/financial-reports')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Financial Reports</span>
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Analysis</span>
          </button>
        </div>
      </div>

      {/* TOP METAL SELECTOR TABS (GOLD vs SILVER) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
          Select Metal Type for Range Analysis
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <button
            onClick={() => handleMetalChange('GOLD')}
            className={`py-3.5 px-6 rounded-xl font-black text-sm transition-all flex items-center justify-center space-x-2.5 cursor-pointer shadow-sm ${
              selectedMetal === 'GOLD'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-amber-500/20 shadow-lg scale-[1.02]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Coins className="w-5 h-5 text-amber-950 dark:text-amber-400" />
            <span>GOLD LOANS</span>
          </button>

          <button
            onClick={() => handleMetalChange('SILVER')}
            className={`py-3.5 px-6 rounded-xl font-black text-sm transition-all flex items-center justify-center space-x-2.5 cursor-pointer shadow-sm ${
              selectedMetal === 'SILVER'
                ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-slate-900/30 shadow-lg scale-[1.02]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Coins className="w-5 h-5 text-slate-300" />
            <span>SILVER LOANS</span>
          </button>
        </div>
      </div>

      {/* Mode Navigation Bar (Default vs Custom) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveMode('default')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'default'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Default Predefined Ranges
          </button>
          <button
            onClick={() => setActiveMode('custom')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeMode === 'custom'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Custom Range Filter</span>
          </button>
        </div>

        <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          Total {selectedMetal} Loans: <span className="text-amber-500 font-black">{metalLoans.length}</span>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="space-y-6">
          {/* DEFAULT PREDEFINED RANGES VIEW */}
          {activeMode === 'default' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${selectedMetal === 'GOLD' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {selectedMetal} Loan Principal Ranges Summary
                  </h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedMetal === 'GOLD' ? '11 Predefined Gold Buckets' : '2 Predefined Silver Buckets (₹0–₹5,000 | ₹5,000+)'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="py-3.5 px-4">Loan Amount Range</th>
                      <th className="py-3.5 px-4 text-right">Loans</th>
                      <th className="py-3.5 px-4 text-right">Total Weight (g)</th>
                      <th className="py-3.5 px-4 text-right">Total Principal (₹)</th>
                      <th className="py-3.5 px-4 text-right">Total Outstanding (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                    {rangeAggregates.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          row.count > 0
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            : 'opacity-60 bg-slate-50/40 dark:bg-slate-950/20'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                          {row.label}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {row.count}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {row.totalWeight.toFixed(3)} g
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-blue-600 dark:text-blue-400">
                          ₹ {row.totalPrincipal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-amber-600 dark:text-amber-400">
                          ₹ {row.totalOutstanding.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <td className="py-4 px-4 font-black uppercase text-slate-900 dark:text-white">
                        Grand {selectedMetal} Summary
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {defaultGrandTotals.count}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {defaultGrandTotals.totalWeight.toFixed(3)} g
                      </td>
                      <td className="py-4 px-4 text-right font-black text-blue-600 dark:text-blue-400 text-sm">
                        ₹ {defaultGrandTotals.totalPrincipal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-right font-black text-amber-600 dark:text-amber-400 text-sm">
                        ₹ {defaultGrandTotals.totalOutstanding.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* CUSTOM RANGE FILTER VIEW */}
          {activeMode === 'custom' && (
            <div className="space-y-6">
              {validationError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <form
                onSubmit={handleApplyCustomRange}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
              >
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <span>Filter {selectedMetal} Loans by Custom Principal Range</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Minimum Principal Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={minInput}
                      onChange={(e) => setMinInput(e.target.value)}
                      placeholder="e.g. 8000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Maximum Principal Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={maxInput}
                      onChange={(e) => setMaxInput(e.target.value)}
                      placeholder="e.g. 18000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  {appliedCustomRange && (
                    <button
                      type="button"
                      onClick={handleResetCustom}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Filter</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Apply Custom {selectedMetal} Range
                  </button>
                </div>
              </form>

              {customAggregate ? (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Results for Custom {selectedMetal} Principal Range:{' '}
                    <span className="text-amber-500 font-mono font-black text-sm">
                      ₹ {customAggregate.min.toLocaleString('en-IN')} – ₹ {customAggregate.max.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                      <div className="text-slate-500 text-[11px] font-black uppercase">Number of {selectedMetal} Loans</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                        {customAggregate.count}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                      <div className="text-slate-500 text-[11px] font-black uppercase">Total Weight</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                        {customAggregate.totalWeight.toFixed(3)} g
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                      <div className="text-slate-500 text-[11px] font-black uppercase">Total Principal</div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        ₹ {customAggregate.totalPrincipal.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                      <div className="text-slate-500 text-[11px] font-black uppercase">Total Outstanding</div>
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                        ₹ {customAggregate.totalOutstanding.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                          <th className="py-3.5 px-4">Custom {selectedMetal} Range</th>
                          <th className="py-3.5 px-4 text-right">Loans</th>
                          <th className="py-3.5 px-4 text-right">Total Weight (g)</th>
                          <th className="py-3.5 px-4 text-right">Total Principal (₹)</th>
                          <th className="py-3.5 px-4 text-right">Total Outstanding (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                        <tr>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                            ₹ {customAggregate.min.toLocaleString('en-IN')} – ₹ {customAggregate.max.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {customAggregate.count}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {customAggregate.totalWeight.toFixed(3)} g
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-blue-600 dark:text-blue-400">
                            ₹ {customAggregate.totalPrincipal.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-amber-600 dark:text-amber-400">
                            ₹ {customAggregate.totalOutstanding.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 font-semibold text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  Enter a minimum and maximum principal amount above and click <span className="text-amber-500 font-bold">Apply Custom {selectedMetal} Range</span> to calculate metrics.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
