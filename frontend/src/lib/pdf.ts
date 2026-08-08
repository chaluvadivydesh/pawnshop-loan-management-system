import { calculateCompoundInterest } from './calculator';
import { formatDisplayDate } from './dateUtils';

export async function generatePDFReport(containerId: string, filename: string = 'Loan_Report.pdf') {
  const element = document.getElementById(containerId);
  if (!element) {
    console.error('PDF element not found:', containerId);
    return;
  }

  const opt = {
    margin: [6, 6, 6, 6],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: {
      mode: ['css', 'legacy'],
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: ['.calculation-card', '.grand-summary-box', '.customer-info-box', '.summary-container', '.info-box', '.summary-box', '.section-title', 'tr', '.section-block', '.sub-table-wrapper']
    }
  };

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('Error generating PDF:', err);
    // Fallback to window print
    window.print();
  }
}

export function formatPDFDate(dateStr?: string | null): string {
  return formatDisplayDate(dateStr);
}

export function printCustomerRecord(customer: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the customer record.');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const loans = customer.loans || [];
  const activeLoans = loans.filter((l: any) => l.releaseStatus === 'ACTIVE');

  // Calculate Grand Summary for Active Loans ONLY
  const grandTotalPrincipal = activeLoans.reduce((sum: number, l: any) => {
    const extraP = (l.extraMoney || []).reduce((s: number, em: any) => s + (em.amount || 0), 0);
    return sum + l.principal + extraP;
  }, 0);

  const grandTotalInterest = activeLoans.reduce((sum: number, l: any) => {
    const interestPayments = (l.payments || [])
      .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
      .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

    const calc = calculateCompoundInterest({
      principal: l.principal,
      interestRate: l.interestRate,
      compoundFrequency: l.compoundFrequency,
      loanDate: l.loanDate,
      calculationDate: todayStr,
      amountPaid: 0,
      extraMoneyEntries: l.extraMoney || [],
      interestPaymentEntries: interestPayments,
      renewalEntries: l.renewals || []
    });

    return sum + calc.interestEarned;
  }, 0);

  const grandTotalAmountToBePaid = grandTotalPrincipal + grandTotalInterest;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Customer Record - ${customer.name}</title>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; margin: 8px 10px; color: #0f172a; font-size: 13px; line-height: 1.45; }
          .header { text-align: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; page-break-after: avoid; break-after: avoid; }
          .header h1 { margin: 0; font-size: 24px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
          
          .info-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; page-break-inside: avoid; break-inside: avoid; }
          .info-item { font-size: 12px; }
          .info-label { font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; }
          .info-value { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          
          .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-top: 24px; margin-bottom: 12px; letter-spacing: 0.5px; page-break-after: avoid; break-after: avoid; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th { background: #f1f5f9; color: #0f172a; font-weight: 800; text-align: left; padding: 8px 10px; border: 1.5px solid #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; line-height: 1.25; vertical-align: bottom; }
          td { padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap !important; }
          tr:nth-child(even) { background: #f8fafc; }
          
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .font-mono, .date-cell { font-family: monospace; font-weight: 700; white-space: nowrap !important; word-break: keep-all !important; }
          
          .badge-active { color: #1d4ed8; font-weight: 800; background: #eff6ff; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 10.5px; white-space: nowrap; }
          .badge-released { color: #15803d; font-weight: 800; background: #f0fdf4; padding: 3px 8px; border-radius: 4px; border: 1px solid #bbf7d0; font-size: 10.5px; white-space: nowrap; }
          .badge-renewed { color: #b45309; font-weight: 800; background: #fffbeb; padding: 3px 8px; border-radius: 4px; border: 1px solid #fde68a; font-size: 10.5px; white-space: nowrap; }
          
          .sub-table-wrapper { page-break-inside: avoid; break-inside: avoid; margin-bottom: 14px; }
          .sub-table { margin-top: 6px; margin-bottom: 6px; background: #fff; page-break-inside: avoid; break-inside: avoid; font-size: 11.5px; }
          .sub-table th { background: #e2e8f0; font-size: 10px; padding: 6px 8px; line-height: 1.2; vertical-align: bottom; }
          .sub-table td { font-size: 11.5px; padding: 6px 8px; white-space: nowrap !important; }

          .summary-container { margin-top: 24px; background: #0f172a; border-radius: 12px; padding: 18px; color: #fff; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; page-break-inside: avoid !important; break-inside: avoid !important; }
          .summary-box { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; page-break-inside: avoid !important; break-inside: avoid !important; }
          .summary-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 6px; }
          .summary-value { font-size: 22px; font-weight: 900; color: #ffffff; white-space: nowrap; }

          @media print {
            body { margin: 0; }
            button { display: none; }
            .summary-container { page-break-inside: avoid !important; break-inside: avoid !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            td, .font-mono, .date-cell { white-space: nowrap !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>LOAN MANAGEMENT SYSTEM</h1>
          <p>Customer Statement & Transaction Record • Generated on ${formatPDFDate(todayStr)}</p>
        </div>

        <div class="info-box">
          <div class="info-item">
            <div class="info-label">Customer Name</div>
            <div class="info-value">${customer.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Relationship (${customer.relationshipType || 'S/O'})</div>
            <div class="info-value">${customer.relationshipName || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Village / Location</div>
            <div class="info-value">${customer.village || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Mobile Number</div>
            <div class="info-value">${customer.mobile || 'N/A'}</div>
          </div>
        </div>

        <div class="section-title">Pledged Loan Items Summary</div>
        <table>
          <thead>
            <tr>
              <th class="text-left">Loan<br/>Date</th>
              <th class="text-left">Released<br/>Date</th>
              <th class="text-left">Item<br/>Name</th>
              <th class="text-center">Metal</th>
              <th class="text-right">Weight</th>
              <th class="text-right">Principal<br/>Amount</th>
              <th class="text-right">Interest<br/>Amount</th>
              <th class="text-right">Amount<br/>Paid</th>
              <th class="text-right">Total<br/>Amount</th>
              <th class="text-center">Loan<br/>Status</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map((l: any) => {
              const interestPayments = (l.payments || [])
                .filter((p: any) => p.paymentType === 'INTEREST_ONLY')
                .map((p: any) => ({ amount: p.amountPaid, paymentDate: p.paymentDate, remarks: p.remarks }));

              const liveCalc = calculateCompoundInterest({
                principal: l.principal,
                interestRate: l.interestRate,
                compoundFrequency: l.compoundFrequency,
                loanDate: l.loanDate,
                calculationDate: l.releaseStatus === 'ACTIVE' ? todayStr : (l.calculationDate || l.releaseDate || todayStr),
                amountPaid: 0,
                extraMoneyEntries: l.extraMoney || [],
                interestPaymentEntries: interestPayments,
                renewalEntries: l.renewals || []
              });

              const isReleased = l.releaseStatus === 'RELEASED';
              const isRenewed = l.releaseStatus === 'RENEWED';
              const totalP = liveCalc.principal;
              const interestEarned = liveCalc.interestEarned;
              const amountPaidVal = isReleased ? (l.amountPaid || 0) : 0;
              const totalAmountVal = isReleased ? (l.amountPaid || totalP) : liveCalc.outstandingBalance;

              let parentInfoHtml = '';
              const remLower = (l.remarks || '').toLowerCase();
              const isPartial = remLower.includes('partial') || (l.parentLoanId && !isRenewed);
              if (isRenewed || isPartial) {
                const parent = loans.find((p: any) => p.id === l.parentLoanId);
                const origDate = parent ? parent.loanDate : l.loanDate;
                const origAmt = parent ? parent.principal : l.principal;
                if (isRenewed) {
                  parentInfoHtml = `<br/><span style="font-size:10px; color:#7c3aed; font-weight:700;">Orig Date: ${formatPDFDate(origDate)}<br/>Orig Amt: ₹${origAmt.toLocaleString('en-IN')}</span>`;
                } else if (isPartial) {
                  const isPPlusI = remLower.includes('p+i') || remLower.includes('principal + interest') || remLower.includes('mode: p+i');
                  const mode = isPPlusI ? 'P+I' : ((remLower.includes('p only') || remLower.includes('mode: p ')) ? 'P' : 'P+I');
                  parentInfoHtml = `<br/><span style="font-size:10px; color:#be185d; font-weight:700;">Orig Date: ${formatPDFDate(origDate)}<br/>Orig Amt: ₹${origAmt.toLocaleString('en-IN')}<br/>Mode: ${mode}</span>`;
                }
              }

              return `
                <tr>
                  <td class="font-mono date-cell">${formatPDFDate(l.loanDate)} ${parentInfoHtml}</td>
                  <td class="font-mono date-cell">${isReleased ? formatPDFDate(l.releaseDate) : '-'}</td>
                  <td style="white-space: normal !important;"><strong>${l.itemName}</strong> ${l.itemDescription ? `<br/><span style="font-size:10px; color:#64748b;">${l.itemDescription}</span>` : ''}</td>
                  <td class="text-center">${l.metalType}</td>
                  <td class="text-right font-mono">${Number(l.weight || 0).toFixed(3)} g</td>
                  <td class="text-right font-mono">₹ ${totalP.toLocaleString('en-IN')}</td>
                  <td class="text-right font-mono" style="color: #b45309;">₹ ${interestEarned.toLocaleString('en-IN')}</td>
                  <td class="text-right font-mono" style="color: #15803d;">₹ ${amountPaidVal.toLocaleString('en-IN')}</td>
                  <td class="text-right font-mono" style="font-weight: 800;">₹ ${totalAmountVal.toLocaleString('en-IN')}</td>
                  <td class="text-center">
                    <span class="${isReleased ? 'badge-released' : isRenewed ? 'badge-renewed' : 'badge-active'}">
                      ${l.releaseStatus}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        ${loans.some((l: any) => (l.extraMoney && l.extraMoney.length > 0) || (l.payments && l.payments.length > 0) || (l.renewals && l.renewals.length > 0)) ? `
          <div class="section-title">Loan Event Stream & History</div>
          ${loans.map((l: any) => {
            const hasEvents = (l.extraMoney && l.extraMoney.length > 0) || (l.payments && l.payments.length > 0) || (l.renewals && l.renewals.length > 0);
            if (!hasEvents) return '';
            return `
              <div class="sub-table-wrapper">
                <div style="font-weight: 800; font-size: 11.5px; margin-bottom: 4px; color: #1e293b;">
                  Item: ${l.itemName} (${formatPDFDate(l.loanDate)}) - Status: ${l.releaseStatus}
                </div>
                <table class="sub-table">
                  <thead>
                    <tr>
                      <th class="text-left">Event<br/>Date</th>
                      <th class="text-left">Event<br/>Type</th>
                      <th class="text-right">Amount<br/>(₹)</th>
                      <th class="text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(l.extraMoney || []).map((em: any) => `
                      <tr>
                        <td class="font-mono date-cell">${formatPDFDate(em.date)}</td>
                        <td>Extra Money Borrowed</td>
                        <td class="text-right font-mono">₹ ${em.amount.toLocaleString('en-IN')}</td>
                        <td style="white-space: normal !important;">${em.remarks || '-'}</td>
                      </tr>
                    `).join('')}
                    ${(l.payments || []).map((p: any) => `
                      <tr>
                        <td class="font-mono date-cell">${formatPDFDate(p.paymentDate)}</td>
                        <td>${p.paymentType}</td>
                        <td class="text-right font-mono">₹ ${p.amountPaid.toLocaleString('en-IN')}</td>
                        <td style="white-space: normal !important;">${p.remarks || '-'}</td>
                      </tr>
                    `).join('')}
                    ${(l.renewals || []).map((r: any) => `
                      <tr>
                        <td class="font-mono date-cell">${formatPDFDate(r.renewalDate)}</td>
                        <td>Loan Renewal</td>
                        <td class="text-right font-mono">New Principal: ₹ ${r.newPrincipal.toLocaleString('en-IN')}</td>
                        <td style="white-space: normal !important;">${r.remarks || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        ` : ''}

        <!-- GRAND SUMMARY AT BOTTOM OF PDF (ACTIVE LOANS ONLY) -->
        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-label">Total Principal (Active Loans)</div>
            <div class="summary-value">₹ ${grandTotalPrincipal.toLocaleString('en-IN')}</div>
          </div>

          <div class="summary-box" style="background: #fffbeb; border-color: #fde68a;">
            <div class="summary-label" style="color: #b45309;">Current Interest (Active Loans)</div>
            <div class="summary-value" style="color: #d97706;">₹ ${grandTotalInterest.toLocaleString('en-IN')}</div>
          </div>

          <div class="summary-box" style="background: #f0fdf4; border-color: #bbf7d0;">
            <div class="summary-label" style="color: #166534;">Total Amount to be Paid</div>
            <div class="summary-value" style="color: #15803d;">₹ ${grandTotalAmountToBePaid.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
