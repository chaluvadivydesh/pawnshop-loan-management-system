import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, Search, ArrowUpDown, Users, ChevronDown, ChevronUp, User, Phone, Coins, ShieldAlert } from 'lucide-react';
import { Customer } from '../types';

interface VillageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
}

interface VillageGroup {
  villageName: string;
  totalCustomers: number;
  activeLoansCount: number;
  releasedLoansCount: number;
  totalPrincipal: number;
  totalOutstanding: number;
  customers: Customer[];
}

export const VillageReportModal: React.FC<VillageReportModalProps> = ({
  isOpen,
  onClose,
  customers
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [expandedVillage, setExpandedVillage] = useState<string | null>(null);

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((v) => v.villageName.toLowerCase().includes(q));
    }

    // Sort alphabetically
    list.sort((a, b) => {
      const cmp = a.villageName.localeCompare(b.villageName);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [customers, searchQuery, sortAsc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Village Business Report
              </h2>
              <p className="text-xs font-semibold text-slate-400">
                Customer & Loan Metrics Grouped by Village / Town
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Sort Button */}
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
            <span>Sort Alphabetically ({sortAsc ? 'A-Z' : 'Z-A'})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {villageGroups.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <MapPin className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
              <p className="font-semibold text-sm">No villages matching search query.</p>
            </div>
          ) : (
            villageGroups.map((group) => {
              const isExpanded = expandedVillage === group.villageName;
              return (
                <div
                  key={group.villageName}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden transition-all shadow-sm"
                >
                  {/* Village Summary Header Row */}
                  <div
                    onClick={() => setExpandedVillage(isExpanded ? null : group.villageName)}
                    className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{group.villageName}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                            {group.totalCustomers} Customers
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Active Loans: <span className="font-bold text-amber-600 dark:text-amber-400">{group.activeLoansCount}</span> • Released: <span className="font-bold text-emerald-600">{group.releasedLoansCount}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Outstanding</div>
                        <div className="font-black text-sm text-slate-900 dark:text-white">
                          ₹ {group.totalOutstanding.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Customer List */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-950/40 p-4 divide-y divide-slate-200 dark:divide-slate-800">
                      <div className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                        Customers in {group.villageName} ({group.customers.length})
                      </div>
                      {group.customers.map((cust) => {
                        const activeCount = (cust.loans || []).filter((l) => l.releaseStatus === 'ACTIVE').length;
                        return (
                          <div
                            key={cust.id}
                            onClick={() => {
                              onClose();
                              navigate(`/customers/${cust.id}`);
                            }}
                            className="py-3 flex items-center justify-between hover:bg-white dark:hover:bg-slate-900 px-3 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-amber-500 transition-colors">
                                  {cust.name}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {cust.mobile}</span>
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
                              <span className="text-amber-500 font-extrabold text-xs">View Profile →</span>
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

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
