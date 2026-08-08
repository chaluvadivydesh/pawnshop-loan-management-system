import { Customer, Loan, DashboardStats } from '../types';
import { cacheCustomers, getCachedCustomers, cacheLoans, getCachedLoans } from './db';
import { queryClient } from './queryClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getIdempotencyHeaders(): Record<string, string> {
  const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': key
  };
}

export function invalidateAllQueries() {
  queryClient.invalidateQueries({ queryKey: ['customers'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['due-loans'] });
  queryClient.invalidateQueries({ queryKey: ['financial-report'] });
  queryClient.invalidateQueries({ queryKey: ['todays-analysis'] });
  queryClient.invalidateQueries({ queryKey: ['customer-details'] });
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
      await cacheCustomers(json.data);
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

export function getMemoryCachedCustomer(id: string): (Customer & { loans: Loan[] }) | null {
  return customerMemoryCache.get(id) || null;
}

export function setMemoryCachedCustomer(id: string, data: Customer & { loans: Loan[] }): void {
  customerMemoryCache.set(id, data);
}

export async function fetchCustomerDetails(id: string): Promise<Customer & { loans: Loan[] }> {
  try {
    const res = await fetch(`${API_BASE}/customers/${id}`);
    const json = await res.json();
    if (json.success) {
      if (json.data.loans) {
        await cacheLoans(json.data.loans);
      }
      customerMemoryCache.set(id, json.data);
      return json.data;
    }
    throw new Error(json.error || 'Failed to fetch customer details');
  } catch (err) {
    console.warn('Fetching customer details from IndexedDB offline storage');
    const cachedCusts = await getCachedCustomers();
    const cust = cachedCusts.find((c) => c.id === id);
    const loans = await getCachedLoans(id);

    if (!cust) {
      throw new Error('Customer not found in local cache');
    }

    const result = {
      ...cust,
      loans
    };
    customerMemoryCache.set(id, result);
    return result;
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
    invalidateAllQueries();
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
    invalidateAllQueries();
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
  invalidateAllQueries();
}

export async function createLoan(data: any): Promise<Loan> {
  const res = await fetch(`${API_BASE}/loans`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to add loan item');
}

export async function updateLoan(id: string, data: any): Promise<Loan> {
  const res = await fetch(`${API_BASE}/loans/${id}`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to update loan');
}

export async function releaseLoan(id: string, data: { amountPaid: number; releaseDate?: string; remarks?: string }): Promise<Loan> {
  const res = await fetch(`${API_BASE}/loans/${id}/release`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to release loan item');
}

export async function deleteLoan(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete loan item');
  invalidateAllQueries();
}

export async function batchUpdateCalculations(loans: any[]): Promise<Loan[]> {
  const res = await fetch(`${API_BASE}/loans/batch-calculate`, {
    method: 'PUT',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify({ loans })
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to save batch calculations');
}

export async function addExtraMoney(loanId: string, data: { amount: number; date?: string; remarks?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/loans/${loanId}/extra-money`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to add extra money entry');
}

export async function addInterestPayment(loanId: string, data: { amountPaid: number; paymentDate?: string; remarks?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/loans/${loanId}/interest-payment`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to record interest payment');
}

export async function renewLoan(loanId: string, data: { renewalDate?: string; newLoanPeriod: number; remarks?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/loans/${loanId}/renew`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to renew loan');
}

export async function addPartialPayment(loanId: string, data: { paymentDate?: string; paymentType: 'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY'; amount: number; remarks?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/loans/${loanId}/partial-payment`, {
    method: 'POST',
    headers: getIdempotencyHeaders(),
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) {
    invalidateAllQueries();
    return json.data;
  }
  throw new Error(json.error || 'Failed to process partial payment');
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
    invalidateAllQueries();
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
  invalidateAllQueries();
}

export async function deletePayment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/payments/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete payment entry');
  invalidateAllQueries();
}

export async function deleteRenewal(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/loans/renewals/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete renewal entry');
  invalidateAllQueries();
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
