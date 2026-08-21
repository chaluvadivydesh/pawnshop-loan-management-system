import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { CardGridSkeleton } from './components/Skeleton';

const CustomerDetails = lazy(() => import('./pages/CustomerDetails').then(m => ({ default: m.CustomerDetails })));
const MultiLoanCalculation = lazy(() => import('./pages/MultiLoanCalculation').then(m => ({ default: m.MultiLoanCalculation })));
const DueDates = lazy(() => import('./pages/DueDates').then(m => ({ default: m.DueDates })));
const FinancialReportsPage = lazy(() => import('./pages/FinancialReportsPage').then(m => ({ default: m.FinancialReportsPage })));
const VillageReportPage = lazy(() => import('./pages/VillageReportPage').then(m => ({ default: m.VillageReportPage })));
const TodaysAnalysisPage = lazy(() => import('./pages/TodaysAnalysisPage').then(m => ({ default: m.TodaysAnalysisPage })));
const LoanAmountAnalysisPage = lazy(() => import('./pages/LoanAmountAnalysisPage').then(m => ({ default: m.LoanAmountAnalysisPage })));

const PageLoader: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <CardGridSkeleton count={3} />
  </div>
);

export const App: React.FC = () => {
  useEffect(() => {
    const handleWheel = () => {
      const activeEl = document.activeElement as HTMLInputElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'number') {
        activeEl.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 pb-16">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers/:id" element={<CustomerDetails />} />
              <Route path="/calculate" element={<MultiLoanCalculation />} />
              <Route path="/due-dates" element={<DueDates />} />
              <Route path="/village-report" element={<VillageReportPage />} />
              <Route path="/financial-reports" element={<FinancialReportsPage />} />
              <Route path="/todays-analysis" element={<TodaysAnalysisPage />} />
              <Route path="/loan-amount-analysis" element={<LoanAmountAnalysisPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
