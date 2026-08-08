import { openDB, DBSchema } from 'idb';
import { Customer, Loan, DashboardStats } from '../types';

interface LoanDB extends DBSchema {
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-name': string; 'by-mobile': string };
  };
  loans: {
    key: string;
    value: Loan;
    indexes: { 'by-customer': string; 'by-status': string };
  };
  stats: {
    key: string;
    value: DashboardStats;
  };
}

const DB_NAME = 'loan-management-db-pg';
const DB_VERSION = 1;

export async function initOfflineDB() {
  return openDB<LoanDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('by-name', 'name');
        custStore.createIndex('by-mobile', 'mobile');
      }

      if (!db.objectStoreNames.contains('loans')) {
        const loanStore = db.createObjectStore('loans', { keyPath: 'id' });
        loanStore.createIndex('by-customer', 'customerId');
        loanStore.createIndex('by-status', 'releaseStatus');
      }

      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'id' });
      }
    }
  });
}

export async function cacheCustomers(customers: Customer[]) {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('customers', 'readwrite');
    await Promise.all(customers.map((c) => tx.store.put(c)));
    await tx.done;
  } catch (err) {
    console.warn('IndexedDB cache customer failed:', err);
  }
}

export async function getCachedCustomers(): Promise<Customer[]> {
  try {
    const db = await initOfflineDB();
    return db.getAll('customers');
  } catch (err) {
    console.warn('IndexedDB read customer failed:', err);
    return [];
  }
}

export async function cacheLoans(loans: Loan[]) {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('loans', 'readwrite');
    await Promise.all(loans.map((l) => tx.store.put(l)));
    await tx.done;
  } catch (err) {
    console.warn('IndexedDB cache loan failed:', err);
  }
}

export async function getCachedLoans(customerId?: string): Promise<Loan[]> {
  try {
    const db = await initOfflineDB();
    if (customerId) {
      return db.getAllFromIndex('loans', 'by-customer', customerId);
    }
    return db.getAll('loans');
  } catch (err) {
    console.warn('IndexedDB read loans failed:', err);
    return [];
  }
}
