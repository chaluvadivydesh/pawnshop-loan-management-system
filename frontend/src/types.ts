export interface Payment {
  id: string;
  loanId: string;
  paymentDate: string;
  amountPaid: number;
  balanceAfterPayment: number;
  paymentType?: 'REGULAR' | 'INTEREST_ONLY' | 'EXTRA_MONEY' | string;
  remarks?: string | null;
  createdAt?: string;
}

export interface ExtraMoneyItem {
  id?: string;
  loanId?: string;
  amount: number;
  date: string;
  remarks?: string | null;
  createdAt?: string;
}

export interface InterestPaymentItem {
  id?: string;
  loanId?: string;
  amount?: number;
  amountPaid?: number;
  paymentDate: string;
  remarks?: string | null;
  createdAt?: string;
}

export interface LoanRenewalItem {
  id?: string;
  loanId?: string;
  renewalDate: string;
  previousPrincipal: number;
  accumulatedInterest: number;
  newPrincipal: number;
  newLoanPeriod: number;
  remarks?: string | null;
  createdAt?: string;
}

export interface PartialPaymentItem {
  id?: string;
  loanId?: string;
  newLoanId?: string;
  paymentDate: string;
  paymentType: 'PRINCIPAL_PLUS_INTEREST' | 'PRINCIPAL_ONLY';
  totalAmountPaid: number;
  interestPaid: number;
  principalPaid: number;
  previousPrincipal: number;
  outstandingInterest: number;
  newPrincipal: number;
  remarks?: string | null;
  createdAt?: string;
}

export interface Loan {
  id: string;
  customerId: string;
  customer?: Customer;
  parentLoanId?: string | null;
  parentLoan?: Loan | null;
  itemName: string;
  itemDescription?: string | null;
  metalType: 'GOLD' | 'SILVER';
  weight: number; // in grams
  loanDate: string; // YYYY-MM-DD
  releaseDate?: string | null; // YYYY-MM-DD
  principal: number;
  interestRate: number; // e.g. 2.5
  compoundFrequency: 'MONTHLY' | 'THREE_MONTHS' | 'SIX_MONTHS' | 'YEARLY';
  loanPeriod: number; // in months
  calculatedInterest?: number;
  finalAmount?: number;
  amountPaid: number;
  outstandingBalance?: number;
  releaseStatus: 'ACTIVE' | 'RELEASED' | 'RENEWED' | 'PARTIALLY_PAID' | string;
  calculationDate?: string | null;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
  payments?: Payment[];
  extraMoney?: ExtraMoneyItem[];
  renewals?: LoanRenewalItem[];
  partialPayments?: PartialPaymentItem[];
  // Calculated UI fields
  calculatedDays?: number;
  years?: number;
  months?: number;
  days?: number;
  dueDate?: string;
  daysOverdue?: number;
}

export interface Customer {
  id: string;
  name: string;
  relationshipType: 'S/O' | 'D/O' | 'W/O' | string;
  relationshipName: string;
  village: string;
  mobile: string;
  address?: string | null;
  remarks?: string | null;
  activeLoansCount?: number;
  releasedLoansCount?: number;
  totalOutstanding?: number;
  lastUpdatedDate?: string;
  createdAt?: string;
  updatedAt?: string;
  loans?: Loan[];
}

export interface DashboardStats {
  totalCustomers: number;
  totalActiveLoans: number;
  totalReleasedLoans: number;
  totalGoldWeight: number;
  totalSilverWeight: number;
  totalPrincipal: number;
  totalOutstanding: number;
  todayCollections: number;
  todayReleasedLoans: number;
  todayGivenCount: number;
  todayGivenAmount: number;
  todayInterest: number;
}

export interface CalculationInput {
  principal: number;
  interestRate: number;
  compoundFrequency: string;
  loanDate: string;
  calculationDate: string;
  amountPaid?: number;
  extraMoneyEntries?: ExtraMoneyItem[];
  interestPaymentEntries?: InterestPaymentItem[];
  renewalEntries?: LoanRenewalItem[];
}

export interface ComponentBreakdown {
  title: string;
  principal: number;
  date: string;
  totalDays: number;
  hasCompleteYears: boolean;
  yearsCount: number;
  yearInterest: number;
  intermediateTotal: number;
  hasRemainingDuration: boolean;
  remainingMonths: number;
  remainingDays: number;
  remainingInterest: number;
  totalInterest: number;
  totalAmount: number;
}

export interface CalculationBreakdownStep {
  type: 'principal' | 'interest' | 'subtotal' | 'final';
  amount: number;
  label?: string;
}

export interface CalculationResult {
  principal: number;
  interestRate: number;
  compoundFrequency: string;
  totalDays: number;
  years: number;
  months: number;
  days: number;
  interestEarned: number;
  finalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  remainingDays: number;
  remainingInterest: number;
  totalExtraMoney?: number;
  breakdownSteps: CalculationBreakdownStep[];
  componentBreakdowns?: ComponentBreakdown[];
}
