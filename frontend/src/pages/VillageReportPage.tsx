import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Search,
  ArrowUpDown,
  Users,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  RefreshCw,
  Coins,
  ChevronRight
} from 'lucide-react';
import { Customer } from '../types';
import { fetchCustomers } from '../lib/api';
import { CardGridSkeleton } from '../components/Skeleton';
import { useDebounce } from '../hooks/useDebounce';

interface VillageGroup {
  villageName: string;
  totalCustomers: number;
  activeLoansCount: number;
  releasedLoansCount: number;
  totalPrincipal: number;
  totalOutstanding: number;
  customers: Customer[];
}

export const VillageReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [expandedVillage, setExpandedVillage] = useState<string | null>(null);

  const loadData = async () => {
    if (customers.length === 0) {
      setLoading(true);
    }
    try {
      const data = await fetchCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers for Village Report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group customers by village
  const villageGroups = useMemo(() => {
    const map: { [village: string]: VillageGroup } = {};

    customers.forEach((cust) => {
      const village = (cust.village || 'Unassigned / General').trim();
      if (!map[village]) {
        map[village] = {
          villageName: village,
          totalCustomers: 0,
          activeLoansCount: 0,
          releasedLoansCount: 0,
          totalPrincipal: 0,
          totalOutstanding: 0,
          customers: []
        };
      }

      map[village].totalCustomers += 1;
      map[village].customers.push(cust);

      // Aggregate loans
      const parentIdSet = new Set((cust.loans || []).map((l) => l.parentLoanId).filter(Boolean));
      (cust.loans || []).forEach((loan) => {
        if (loan.releaseStatus === 'ACTIVE' && !parentIdSet.has(loan.id)) {
          map[village].activeLoansCount += 1;
          map[village].totalPrincipal += (loan.principal || 0);
          map[village].totalOutstanding += (loan.outstandingBalance || 0);
        } else if (loan.releaseStatus === 'RELEASED' && !parentIdSet.has(loan.id)) {
          map[village].releasedLoansCount += 1;
        }
      });
    });

    let list = Object.values(map);

    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter((v) => v.villageName.toLowerCase().includes(q));
    }

    // Sort alphabetically
    list.sort((a, b) => {
      const cmp = a.villageName.localeCompare(b.villageName);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [customers, debouncedSearch, sortAsc]);

  const totalVillages = villageGroups.length;
  const grandCustomers = customers.length;
  const grandOutstanding = villageGroups.reduce((sum, v) => sum + v.totalOutstanding, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <MapPin className="w-8 h-8 text-amber-500" />
            <span>Village Business Report</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Customer Distribution & Portfolio Analysis Grouped by Village / Town
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4 text-amber-500" />
            <span>Sort Alphabetically ({sortAsc ? 'A-Z' : 'Z-A'})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Header */}
      {loading && customers.length === 0 ? (
        <CardGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Villages</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {totalVillages}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Customers</div>
            <div className="text-3xl font-black text-amber-500 mt-1">
              {grandCustomers}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Outstanding</div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹ {grandOutstanding.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar / Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Village / Town Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Main Village List */}
      <div className="space-y-4">
        {villageGroups.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <MapPin className="w-12 h-12 mx-auto text-slate-300 opacity-60 mb-2" />
            <p className="font-semibold text-base text-slate-700 dark:text-slate-300">No matching villages found.</p>
          </div>
        ) : (
          villageGroups.map((group) => {
            const isExpanded = expandedVillage === group.villageName;
            return (
              <div
                key={group.villageName}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden transition-all"
              >
                {/* Village Summary Header */}
                <div
                  onClick={() => setExpandedVillage(isExpanded ? null : group.villageName)}
                  className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{group.villageName}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold border border-slate-200 dark:border-slate-700">
                          {group.totalCustomers} Customers
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                        Active Loans: <span className="font-bold text-amber-600 dark:text-amber-400">{group.activeLoansCount}</span> • Released: <span className="font-bold text-emerald-600">{group.releasedLoansCount}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Outstanding</div>
                      <div className="font-black text-base text-slate-900 dark:text-white">
                        ₹ {group.totalOutstanding.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <button className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Customer Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-5 divide-y divide-slate-200 dark:divide-slate-800 space-y-2">
                    <div className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                      Customer Profiles in {group.villageName} ({group.customers.length})
                    </div>
                    {group.customers.map((cust) => {
                      const activeCount = (cust.loans || []).filter((l) => l.releaseStatus === 'ACTIVE').length;
                      return (
                        <div
                          key={cust.id}
                          onClick={() => navigate(`/customers/${cust.id}`)}
                          className="pt-3 pb-3 flex items-center justify-between hover:bg-white dark:hover:bg-slate-900 px-4 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-amber-500 transition-colors">
                                {cust.name}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-3">
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {cust.mobile}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-xs">
                            <div className="text-right">
                              <span className="font-bold text-amber-600 dark:text-amber-400">{activeCount}</span> Active Loans
                            </div>
                            <div className="text-right font-black text-slate-900 dark:text-white">
                              ₹ {(cust.totalOutstanding || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="text-amber-500 font-extrabold text-xs flex items-center gap-1">
                              <span>View Profile</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
