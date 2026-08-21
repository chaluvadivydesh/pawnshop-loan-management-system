import { Customer, Loan, DashboardStats } from '../types';
import { cacheCustomers, syncCachedCustomers, deleteCachedCustomer, getCachedCustomers, cacheLoans, getCachedLoans } from './db';
import { queryClient } from './queryClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getIdempotencyHeaders(): Record<string, string> {
  const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': key
  };
}

export function clearMemoryCache(id?: string): void {
  console.time('MEMORY_CACHE_UPDATE');
  if (id) {
    customerMemoryCache.delete(id);
  } else {
    customerMemoryCache.clear();
  }
  console.timeEnd('MEMORY_CACHE_UPDATE');
}

export function invalidateLoanQueries(customerId?: string) {
  console.time('CUSTOMER_CACHE_UPDATE');
  clearMemoryCache(customerId);
  queryClient.invalidateQueries({ queryKey: ['customer-details'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['due-loans'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['financial-report'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['todays-analysis'], refetchType: 'active' });
  console.timeEnd('CUSTOMER_CACHE_UPDATE');
}

export function invalidateCustomerQueries(customerId?: string) {
  console.time('CUSTOMER_CACHE_UPDATE');
  clearMemoryCache(customerId);
  queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['customer-details'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['due-loans'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['financial-report'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['todays-analysis'], refetchType: 'active' });
  console.timeEnd('CUSTOMER_CACHE_UPDATE');
}

export function invalidateAllQueries() {
  console.time('CUSTOMER_CACHE_UPDATE');
  clearMemoryCache();
  queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['customer-details'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['due-loans'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['financial-report'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['todays-analysis'], refetchType: 'active' });
  console.timeEnd('CUSTOMER_CACHE_UPDATE');
}


export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${API_BASE}/reports/dashboard`);
    const json = await res.json();
    if (json.success) {
      return json.data;
    }
    throw new Error(json.error || 'Failed to fetch dashboard stats');
  } catch (err) {
    console.warn('Network request failed, retrieving cached data if available', err);
    // Offline fallback calculations from cached records
    const customers = await getCachedCustomers();
    const loans = await getCachedLoans();

    let totalGoldWeight = 0;
    let totalSilverWeight = 0;
    let totalPrincipal = 0;
    let totalOutstanding = 0;
    let activeLoans = 0;
    let releasedLoans = 0;

    loans.forEach((loan) => {
      if (loan.releaseStatus === 'ACTIVE') {
        activeLoans++;
        totalPrincipal += loan.principal;
        if (loan.metalType === 'GOLD') totalGoldWeight += loan.weight;
        if (loan.metalType === 'SILVER') totalSilverWeight += loan.weight;
        totalOutstanding += loan.outstandingBalance || 0;
      } else {
        releasedLoans++;
      }
    });

    return {
      totalCustomers: customers.length,
      totalActiveLoans: activeLoans,
      totalReleasedLoans: releasedLoans,
      totalGoldWeight: Number(totalGoldWeight.toFixed(2)),
      totalSilverWeight: Number(totalSilverWeight.toFixed(2)),
      totalPrincipal: Math.floor(totalPrincipal),
      totalOutstanding: Math.floor(totalOutstanding),
      todayCollections: 0,
      todayReleasedLoans: 0,
      todayGivenCount: 0,
      todayGivenAmount: 0,
      todayInterest: 0
    };
  }
}

export async function fetchCustomers(query: string = ''): Promise<Customer[]> {
  try {
    const res = await fetch(`${API_BASE}/customers?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.success) {
      if (!query) {
        syncCachedCustomers(json.data).catch((err) => console.warn('Background syncCachedCustomers failed:', err));
      } else {
        cacheCustomers(json.data).catch((err) => console.warn('Background cacheCustomers failed:', err));
      }
      return json.data;
    }
    throw new Error(json.error || 'Failed to fetch customers');
  } catch (err) {
    console.warn('Fetching customers from IndexedDB offline storage');
    const cached = await getCachedCustomers();
    if (!query) return cached;
    const q = query.toLowerCase();
    return cached.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.village.toLowerCase().includes(q)
    );
  }
}

const customerMemoryCache = new Map<string, Customer & { loans: Loan[] }>();
const inFlightPrefetchMap = new Map<string, Promise<Customer & { loans: Loan[] }>>();

export function getMemoryCachedCustomer(id: string): (Customer & { loans: Loan[] }) | null {
  return customerMemoryCache.get(id) || null;
}

export function setMemoryCachedCustomer(id: string, data: Customer & { loans: Loan[] }): void {
  customerMemoryCache.set(id, data);
}

export function prefetchCustomerDetails(id: string): void {
  if (!id) return;
  if (customerMemoryCache.has(id)) return;
  if (inFlightPrefetchMap.has(id)) return;

  fetchCustomerDetails(id).catch((err) => {
    console.debug('Silent prefetch skipped/failed:', err);
  });
}

export async function fetchCustomerDetails(id: string, forceRefresh: boolean = false): Promise<Customer & { loans: Loan[] }> {
  console.time('CUSTOMER_REFRESH');
  if (forceRefresh) {
    clearMemoryCache(id);
  } else {
    const cached = customerMemoryCache.get(id);
    if (cached) {
      console.timeEnd('CUSTOMER_REFRESH');
      return cached;
    }
  }

  if (inFlightPrefetchMap.has(id)) {
    console.timeEnd('CUSTOMER_REFRESH');
    return inFlightPrefetchMap.get(id)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`);
      const json = await res.json();
      if (json.success) {
        if (json.data.loans) {
          cacheLoans(json.data.loans).catch((err) => console.warn('Background cacheLoans failed:', err));
        }
        customerMemoryCache.set(id, json.data);
        console.timeEnd('CUSTOMER_REFRESH');
        return json.data;
      }
      clearMemoryCache(id);
      deleteCachedCustomer(id).catch(() => {});
      console.timeEnd('CUSTOMER_REFRESH');
      throw new Error(json.error || 'Customer not found in database');
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        clearMemoryCache(id);
        deleteCachedCustomer(id).catch(() => {});
        console.timeEnd('CUSTOMER_REFRESH');
        throw err;
      }
      console.warn('Fetching customer details from IndexedDB offline storage');
      const cachedCusts = await getCachedCustomers();
      const cust = cachedCusts.find((c) => c.id === id);
      const loans = await getCachedLoans(id);

      if (!cust) {
        console.timeEnd('CUSTOMER_REFRESH');
        throw new Error('Customer not found in local cache');
      }

      const result = {
        ...cust,
        loans
      };
      customerMemoryCache.set(id, result);
      console.timeEnd('CUSTOMER_REFRESH');
      return result;
    }
  })();

  inFlightPrefetchMap.set(id, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightPrefetchMap.delete(id);
  }
}

export async function createCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateCustomerQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to create customer');
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateCustomerQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to update customer');
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete customer');
  invalidateCustomerQueries();
}

export async function createLoan(data: any): Promise<Loan> {
  console.time('CREATE_LOAN_TOTAL');
  console.time('CREATE_LOAN_API');
  try {
    const res = await fetch(`${API_BASE}/loans`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('CREATE_LOAN_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries(data?.customerId);
      console.timeEnd('CREATE_LOAN_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to add loan item');
  } catch (err) {
    try { console.timeEnd('CREATE_LOAN_API'); } catch {}
    try { console.timeEnd('CREATE_LOAN_TOTAL'); } catch {}
    throw err;
  }
}

export async function updateLoan(id: string, data: any): Promise<Loan> {
  const res = await fetch(`${API_BASE}/loans/${id}`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateLoanQueries(data?.customerId);
    return json.data;
  }
  throw new Error(json.error || 'Failed to update loan');
}

export async function releaseLoan(id: string, data: { amountPaid: number; releaseDate?: string; remarks?: string }): Promise<Loan> {
  console.time('RELEASE_TOTAL');
  console.time('RELEASE_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${id}/release`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('RELEASE_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries();
      console.timeEnd('RELEASE_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to release loan item');
  } catch (err) {
    try { console.timeEnd('RELEASE_API'); } catch {}
    try { console.timeEnd('RELEASE_TOTAL'); } catch {}
    throw err;
  }
}

export async function deleteLoan(id: string): Promise<void> {
  console.time('DELETE_TOTAL');
  console.time('DELETE_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${id}`, {
      method: 'DELETE'
    });
    console.timeEnd('DELETE_API');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete loan item');
    invalidateLoanQueries();
    console.timeEnd('DELETE_TOTAL');
  } catch (err) {
    try { console.timeEnd('DELETE_API'); } catch {}
    try { console.timeEnd('DELETE_TOTAL'); } catch {}
    throw err;
  }
}

export async function batchUpdateCalculations(loans: any[]): Promise<Loan[]> {
  const res = await fetch(`${API_BASE}/loans/batch-calculate`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify({ loans })
  });
  const json = await res.json();
  if (json.success) {
    invalidateLoanQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to save batch calculations');
}

export async function addExtraMoney(loanId: string, data: { amount: number; date?: string; remarks?: string }): Promise<any> {
  console.time('EXTRA_MONEY_TOTAL');
  console.time('EXTRA_MONEY_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${loanId}/extra-money`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('EXTRA_MONEY_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries();
      console.timeEnd('EXTRA_MONEY_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to add extra money entry');
  } catch (err) {
    try { console.timeEnd('EXTRA_MONEY_API'); } catch {}
    try { console.timeEnd('EXTRA_MONEY_TOTAL'); } catch {}
    throw err;
  }
}

export async function addInterestPayment(loanId: string, data: { amountPaid: number; paymentDate?: string; remarks?: string }): Promise<any> {
  console.time('INTEREST_PAYMENT_TOTAL');
  console.time('INTEREST_PAYMENT_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${loanId}/interest-payment`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('INTEREST_PAYMENT_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries();
      console.timeEnd('INTEREST_PAYMENT_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to record interest payment');
  } catch (err) {
    try { console.timeEnd('INTEREST_PAYMENT_API'); } catch {}
    try { console.timeEnd('INTEREST_PAYMENT_TOTAL'); } catch {}
    throw err;
  }
}

export async function renewLoan(loanId: string, data: { renewalDate?: string; newLoanPeriod: number; remarks?: string }): Promise<any> {
  console.time('RENEW_TOTAL');
  console.time('RENEW_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${loanId}/renew`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('RENEW_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries();
      console.timeEnd('RENEW_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to renew loan');
  } catch (err) {
    try { console.timeEnd('RENEW_API'); } catch {}
    try { console.timeEnd('RENEW_TOTAL'); } catch {}
    throw err;
  }
}

export async function addPartialPayment(loanId: string, data: { paymentDate?: string; paymentType: 'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY'; amount: number; remarks?: string }): Promise<any> {
  console.time('PARTIAL_PAYMENT_TOTAL');
  console.time('PARTIAL_PAYMENT_API');
  try {
    const res = await fetch(`${API_BASE}/loans/${loanId}/partial-payment`, {
      method: 'POST',
      headers: getIdempotencyHeaders(),
      body: JSON.stringify(data)
    });
    console.timeEnd('PARTIAL_PAYMENT_API');
    const json = await res.json();
    if (json.success) {
      invalidateLoanQueries();
      console.timeEnd('PARTIAL_PAYMENT_TOTAL');
      return json.data;
    }
    throw new Error(json.error || 'Failed to process partial payment');
  } catch (err) {
    try { console.timeEnd('PARTIAL_PAYMENT_API'); } catch {}
    try { console.timeEnd('PARTIAL_PAYMENT_TOTAL'); } catch {}
    throw err;
  }
}

export async function fetchDueLoans(): Promise<{ overdueLoans: Loan[]; dueTodayLoans: Loan[]; overdueCount: number; dueTodayCount: number }> {
  const res = await fetch(`${API_BASE}/reports/due-loans`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error || 'Failed to fetch due loans');
}

export async function updateExtraMoney(id: string, data: { amount: number; date?: string; remarks?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/loans/extra-money/${id}`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateLoanQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to update extra money entry');
}

export async function deleteExtraMoney(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/extra-money/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete extra money entry');
  invalidateLoanQueries();
}

export async function deletePayment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/payments/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete payment entry');
  invalidateLoanQueries();
}

export async function deleteRenewal(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/renewals/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete renewal entry');
  invalidateLoanQueries();
}


export async function fetchFinancialReport(startDate?: string, endDate?: string): Promise<{
  startDate: string;
  endDate: string;
  dailyRows: Array<{
    date: string;
    loansGivenCount: number;
    loansReleasedCount: number;
    moneyGiven: number;
    moneyReceived: number;
    interestEarned: number;
  }>;
  totals: {
    totalLoansGiven: number;
    totalLoansReleased: number;
    totalMoneyGiven: number;
    totalMoneyReceived: number;
    totalInterestEarned: number;
  };
}> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE}/reports/financial?${params.toString()}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error || 'Failed to fetch financial report');
}

export async function fetchTodaysAnalysis(startDate?: string, endDate?: string): Promise<any> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE}/reports/todays-analysis?${params.toString()}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error || 'Failed to fetch Today\'s Analysis');
}
