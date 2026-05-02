import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BrandingConfig } from '@/context/ModuleContext';

interface ReceiptData {
  id: string;
  type?: 'SALE' | 'PAYMENT' | 'RETURN';
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  date: string;
  cashierName?: string | null;
  paymentMethod?: string;
  refundMethod?: string | null;
  receipt_id?: string;
  reference_number?: string;
  originalTransactionId?: string | null;
  // Financial fields
  items: Array<{
    name: string;
    qty: number;
    price: number;
    discount?: { type: string; value: number };
  }>;
  subtotal: number;
  discountAmount?: number;
  discountName?: string | null;
  taxRate?: number;
  tax: number;
  total: number;
  // Balance fields
  balanceDeducted?: number;
  netRefundPaid?: number;
  previous_balance?: number;
  new_balance?: number;
  exchangePolicy?: string;
  // Split payment details
  split_cash_amount?: number;
  split_card_amount?: number;
  split_credit_amount?: number;
}

/**
 * Converts a URL to a Base64 string for PDF embedding
 */
const imageUrlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return "";
  }
};

/**
 * Enterprise PDF Receipt Generator
 * Creates a high-fidelity, immutable PDF document for transactions and settlements.
 */
export const generateProfessionalReceipt = async (
  branding: BrandingConfig,
  enterpriseId: string | null,
  data: ReceiptData,
  mode: 'save' | 'blob' = 'save'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  const isReturn = data.type === 'RETURN';
  const isPayment = data.type === 'PAYMENT';
  const hasDeduction = (data.balanceDeducted || 0) > 0;

  // 1. Branding & Visual Style
  const primaryColor: [number, number, number] = isReturn ? [153, 27, 27] : [15, 23, 42]; // Red-800 for returns, Slate-900 for others
  const accentColor: [number, number, number] = isReturn ? [220, 38, 38] : [59, 130, 246]; // Red-600 or Orivo Blue
  
  // Sidebar Accent
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 4, pageHeight, 'F');

  // Header Background (Modern Subtle)
  doc.setFillColor(isReturn ? 254 : 248, isReturn ? 242 : 250, isReturn ? 242 : 252); // Soft red background for returns
  doc.rect(4, 0, pageWidth - 4, 40, 'F');
  
  // Add Company Logo
  if (branding.logo) {
    const base64Logo = await imageUrlToBase64(branding.logo);
    if (base64Logo) {
      doc.addImage(base64Logo, 'PNG', margin, 8, 24, 24);
    }
  }

  // Company Name & Info
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const companyNameX = branding.logo ? margin + 28 : margin;
  doc.text(branding.name.toUpperCase(), companyNameX, 18);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text((branding as any).tagline || 'OFFICIAL ENTERPRISE PARTNER', companyNameX, 24);
  
  // Document Type Header
  doc.setFontSize(32);
  doc.setTextColor(isReturn ? 254 : 241, isReturn ? 226 : 245, isReturn ? 226 : 249);
  doc.setFont('helvetica', 'bold');
  const headerText = isReturn ? 'RETURN' : isPayment ? 'RECEIPT' : 'SALE';
  doc.text(headerText, pageWidth - 10, 28, { align: 'right' });

  // 2. Transaction Details Grid
  const gridY = 55;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT PROTOCOL', margin, gridY);
  doc.text('RECIPIENT DETAILS', pageWidth / 2, gridY);
  
  doc.setDrawColor(isReturn ? 252 : 226, isReturn ? 165 : 232, isReturn ? 165 : 240);
  doc.line(margin, gridY + 2, pageWidth - margin, gridY + 2);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  const detailsY = gridY + 8;
  doc.text(`Doc ID: #${(data.receipt_id || data.id).substring(0, 12).toUpperCase()}`, margin, detailsY);
  doc.text(`Date: ${data.date}`, margin, detailsY + 5);
  doc.text(`Method: ${(isReturn ? data.refundMethod || data.paymentMethod : data.paymentMethod || 'CASH').toUpperCase()}`, margin, detailsY + 10);
  if (data.cashierName) doc.text(`Cashier: ${data.cashierName.toUpperCase()}`, margin, detailsY + 15);
  if (isReturn && data.originalTransactionId) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`ORIGINAL REF: #${data.originalTransactionId.substring(0, 12).toUpperCase()}`, margin, detailsY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
  }

  // Customer Details
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(data.customerName, pageWidth / 2, detailsY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (data.customerPhone) doc.text(data.customerPhone, pageWidth / 2, detailsY + 5);
  if (data.customerEmail) doc.text(data.customerEmail, pageWidth / 2, detailsY + 10);
  if (data.customerAddress) doc.text(data.customerAddress, pageWidth / 2, detailsY + 15);

  // 3. Items Table
  autoTable(doc, {
    startY: gridY + 35,
    margin: { left: margin },
    head: [['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: data.items.map((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      return [
        item.name,
        qty,
        `$${price.toFixed(2)}`,
        `${isReturn ? '-' : ''}$${(qty * price).toFixed(2)}`
      ];
    }),
    theme: 'plain',
    headStyles: { 
      fillColor: isReturn ? [254, 242, 242] : [248, 250, 252], 
      textColor: primaryColor, 
      fontStyle: 'bold', 
      fontSize: 9,
      lineWidth: { bottom: 0.5 },
      lineColor: isReturn ? [252, 165, 165] : [203, 213, 225]
    },
    styles: { fontSize: 9, cellPadding: 5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
    },
    didDrawPage: (dt) => {
      doc.setDrawColor(isReturn ? 252 : 203, isReturn ? 165 : 213, isReturn ? 165 : 225);
      doc.line(margin, (dt as any).cursor.y, pageWidth - margin, (dt as any).cursor.y);
    }
  });

  // 4. Financial Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryX = pageWidth - margin - 50;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  
  // Financial Rows
  const rows = [
    { label: 'SUBTOTAL:', value: `$${(Number(data.subtotal) || Number(data.total) || 0).toFixed(2)}` },
    data.discountAmount ? { label: `DISCOUNT (${data.discountName || 'Applied'}):`, value: `-$${data.discountAmount.toFixed(2)}`, color: [21, 128, 61] } : null,
    data.taxRate ? { label: `TAX (${data.taxRate}%):`, value: `$${(data.tax || 0).toFixed(2)}` } : null
  ].filter(Boolean) as any[];

  rows.forEach((row, idx) => {
    const y = finalY + (idx * 5);
    doc.setTextColor(row.color ? row.color[0] : 100, row.color ? row.color[1] : 116, row.color ? row.color[2] : 139);
    doc.text(row.label, summaryX, y);
    doc.text(row.value, pageWidth - margin, y, { align: 'right' });
  });

  // Split Payment Breakdown if applicable
  let splitY = finalY + (rows.length * 5);
  if (data.paymentMethod === 'SPLIT') {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('PAYMENT BREAKDOWN:', summaryX, splitY + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let currentSplitY = splitY + 8;
    
    if ((data.split_credit_amount || 0) > 0) {
      doc.text('Store Credit:', summaryX, currentSplitY);
      doc.text(`$${data.split_credit_amount?.toFixed(2)}`, pageWidth - margin, currentSplitY, { align: 'right' });
      currentSplitY += 4;
    }
    if ((data.split_cash_amount || 0) > 0) {
      doc.text('Cash:', summaryX, currentSplitY);
      doc.text(`$${data.split_cash_amount?.toFixed(2)}`, pageWidth - margin, currentSplitY, { align: 'right' });
      currentSplitY += 4;
    }
    if ((data.split_card_amount || 0) > 0) {
      doc.text('Card:', summaryX, currentSplitY);
      doc.text(`$${data.split_card_amount?.toFixed(2)}`, pageWidth - margin, currentSplitY, { align: 'right' });
      currentSplitY += 4;
    }
    splitY = currentSplitY - 4;
  }

  const totalY = Math.max(finalY + (rows.length * 5) + 4, splitY + 8);
  doc.setFillColor(isReturn ? 254 : 248, isReturn ? 242 : 250, isReturn ? 242 : 252);
  doc.rect(summaryX - 5, totalY - 4, 55, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(isReturn ? 'GROSS REFUND:' : 'TOTAL AMOUNT:', summaryX, totalY + 1.5);
  doc.setFontSize(11);
  doc.text(`${isReturn ? '-' : ''}$${(Number(data.total) || 0).toFixed(2)}`, pageWidth - margin, totalY + 1.5, { align: 'right' });

  // 5. Account Settlement Summary (Specific for Payments or Returns with deductions)
  if ((isPayment || (isReturn && hasDeduction)) && data.new_balance !== undefined) {
    const settlementY = totalY + 15;
    const boxHeight = (isReturn && hasDeduction) ? 38 : 32;
    
    doc.setDrawColor(isReturn ? 252 : 241, isReturn ? 165 : 245, isReturn ? 165 : 249);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, settlementY - 5, 90, boxHeight, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(isReturn ? 'REFUND ACCOUNT SETTLEMENT' : 'ACCOUNT SETTLEMENT SUMMARY', margin + 5, settlementY + 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    
    if (isReturn && hasDeduction) {
      doc.text(`Gross Refund Amount:`, margin + 5, settlementY + 10);
      doc.text(`Account Balance Deducted:`, margin + 5, settlementY + 16);
      doc.text(`Net Payout to Customer:`, margin + 5, settlementY + 22);
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`-$${(Number(data.total) || 0).toFixed(2)}`, margin + 85, settlementY + 10, { align: 'right' });
      doc.text(`+$${(Number(data.balanceDeducted) || 0).toFixed(2)}`, margin + 85, settlementY + 16, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`-$${(Number(data.netRefundPaid) || 0).toFixed(2)}`, margin + 85, settlementY + 22, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`NEW ACCOUNT BALANCE:`, margin + 5, settlementY + 30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`$${(Number(data.new_balance) || 0).toFixed(2)}`, margin + 85, settlementY + 30, { align: 'right' });
    } else {
      doc.text(`Previous Balance:`, margin + 5, settlementY + 10);
      doc.text(`Payment Applied:`, margin + 5, settlementY + 16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`$${(Number(data.previous_balance) || 0).toFixed(2)}`, margin + 85, settlementY + 10, { align: 'right' });
      doc.text(`-$${(Number(data.total) || 0).toFixed(2)}`, margin + 85, settlementY + 16, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`NEW BALANCE DUE:`, margin + 5, settlementY + 24);
      doc.text(`$${(Number(data.new_balance) || 0).toFixed(2)}`, margin + 85, settlementY + 24, { align: 'right' });
    }
  }

  // 6. Footer & Legal
  const footerY = pageHeight - 15;
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('POWERED BY', margin, footerY);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFontSize(10);
  doc.text('OrivoCRM.pro', margin + 20, footerY);
  
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(data.exchangePolicy || 'EXCHANGE POLICY: All sales are final. Exchanges only within 7 days for unopened items.', margin, footerY + 5);
  
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('CERTIFIED AUDIT-COMPLIANT ENTERPRISE MANAGEMENT SYSTEM V2.6', margin, footerY + 9);

  // Security QR Code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/verify/' + data.id)}`;
  doc.addImage(qrUrl, 'PNG', pageWidth - margin - 15, footerY - 12, 15, 15);

  if (mode === 'blob') return doc.output('datauristring');
  doc.save(`${isReturn ? 'Return' : isPayment ? 'Receipt' : 'Invoice'}_${(data.receipt_id || data.id).substring(0, 12).toUpperCase()}.pdf`);
};


