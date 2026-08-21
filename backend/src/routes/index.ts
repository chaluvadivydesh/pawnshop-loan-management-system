import { Router } from 'express';
import { checkIdempotency } from '../middleware/idempotency';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from '../controllers/customerController';
import {
  addLoan,
  updateLoan,
  releaseLoan,
  deleteLoan,
  batchUpdateCalculations,
  addExtraMoney,
  updateExtraMoney,
  deleteExtraMoney,
  addInterestPayment,
  renewLoan,
  addPartialPayment,
  deletePayment,
  deleteRenewal
} from '../controllers/loanController';
import { addPayment, getPaymentHistory } from '../controllers/paymentController';
import { getDashboardStats, getDueLoans, getFinancialReport, getTodaysAnalysis, getPortfolioLoans } from '../controllers/reportController';
import { calculateCompoundInterest } from '../services/calculatorService';

const router = Router();
router.use(checkIdempotency);


// Customer Endpoints
router.get('/customers', getAllCustomers);
router.get('/customers/:id', getCustomerById);
router.post('/customers', createCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);

// Loan Endpoints
router.post('/loans', addLoan);
router.put('/loans/batch-calculate', batchUpdateCalculations);
router.put('/loans/:id', updateLoan);
router.post('/loans/:id/release', releaseLoan);
router.post('/loans/:id/extra-money', addExtraMoney);
router.put('/loans/extra-money/:id', updateExtraMoney);
router.delete('/loans/extra-money/:id', deleteExtraMoney);
router.post('/loans/:id/interest-payment', addInterestPayment);
router.post('/loans/:id/renew', renewLoan);
router.post('/loans/:id/partial-payment', addPartialPayment);
router.delete('/loans/payments/:id', deletePayment);
router.delete('/loans/renewals/:id', deleteRenewal);
router.delete('/loans/:id', deleteLoan);

// Calculation Engine Utility Endpoint
router.post('/loans/calculate', (req, res) => {
  try {
    const result = calculateCompoundInterest(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Payments
router.post('/loans/:loanId/payments', addPayment);
router.get('/loans/:loanId/payments', getPaymentHistory);

// Reports & Dashboard & Due Dates & Portfolio Analysis
router.get('/reports/dashboard', getDashboardStats);
router.get('/reports/due-loans', getDueLoans);
router.get('/reports/financial', getFinancialReport);
router.get('/reports/todays-analysis', getTodaysAnalysis);
router.get('/reports/portfolio-loans', getPortfolioLoans);

export default router;
