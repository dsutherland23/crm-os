import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BrandingConfig } from '@/context/ModuleContext';

interface ReceiptData {
  id: string;
  type?: 'SALE' | 'PAYMENT';
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  date: string;
  paymentMethod?: string;
  receipt_id?: string;
  reference_number?: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  previous_balance?: number;
  new_balance?: number;
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

  // 1. Branding & Visual Style
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900 (More Professional)
  const accentColor: [number, number, number] = [59, 130, 246]; // Orivo Blue
  
  // Sidebar Accent
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 4, pageHeight, 'F');

  // Header Background (Modern Subtle)
  doc.setFillColor(248, 250, 252);
  doc.rect(4, 0, pageWidth - 4, 40, 'F');
  
  // Add Company Logo (Better Positioning)
  if (branding.logo) {
    const base64Logo = await imageUrlToBase64(branding.logo);
    if (base64Logo) {
      doc.addImage(base64Logo, 'PNG', margin, 8, 24, 24);
    }
  }

  // Company Name & Info (Anchored)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const companyNameX = branding.logo ? margin + 28 : margin;
  doc.text(branding.name.toUpperCase(), companyNameX, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text((branding as any).tagline || 'OFFICIAL ENTERPRISE PARTNER', companyNameX, 26);
  
  // Document Type & Orivo Seal (Right Aligned)
  doc.setFontSize(36);
  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.text(data.type === 'PAYMENT' ? 'RECEIPT' : 'INVOICE', pageWidth - 10, 28, { align: 'right' });

  // 2. Transaction Details Grid (Balanced Horizontal Alignment)
  const gridY = 55;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT INFO', margin, gridY);
  doc.text('CUSTOMER INFO', pageWidth / 2, gridY);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, gridY + 2, pageWidth - margin, gridY + 2);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  const detailsY = gridY + 8;
  doc.text(`Ref: ${data.receipt_id || data.id.substring(0, 8)}`, margin, detailsY);
  doc.text(`Date: ${data.date}`, margin, detailsY + 5);
  doc.text(`Method: ${data.paymentMethod || 'CASH'}`, margin, detailsY + 10);

  // Customer Details (Precisely Aligned)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(data.customerName, pageWidth / 2, detailsY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (data.customerPhone) doc.text(data.customerPhone, pageWidth / 2, detailsY + 5);
  if (data.customerEmail) doc.text(data.customerEmail, pageWidth / 2, detailsY + 10);

  // 3. Items Table (Professional Ledger Style)
  autoTable(doc, {
    startY: gridY + 25,
    margin: { left: margin },
    head: [['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: data.items.map((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      return [
        item.name,
        qty,
        `$${price.toFixed(2)}`,
        `$${(qty * price).toFixed(2)}`
      ];
    }),
    theme: 'plain',
    headStyles: { 
      fillColor: [248, 250, 252], 
      textColor: primaryColor, 
      fontStyle: 'bold', 
      fontSize: 9,
      lineWidth: { bottom: 0.5 },
      lineColor: [203, 213, 225]
    },
    styles: { fontSize: 9, cellPadding: 5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
    },
    didDrawPage: (data) => {
      // Add thin line at the bottom of the table
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, (data as any).cursor.y, pageWidth - margin, (data as any).cursor.y);
    }
  });

  // 4. Financial Summary & Balance (Anchored Right Box)
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const summaryX = pageWidth - margin - 50;

  // Background for Totals (Subtle)
  doc.setFillColor(248, 250, 252);
  doc.rect(summaryX - 5, finalY - 8, 55, 18, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL AMOUNT:', summaryX, finalY + 2);
  doc.setFontSize(12);
  doc.text(`$${(Number(data.total) || 0).toFixed(2)}`, pageWidth - margin, finalY + 2, { align: 'right' });

  // Balance History Box (Modern Card Style)
  if (data.type === 'PAYMENT' && data.previous_balance !== undefined) {
    const balanceY = finalY + 25;
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, balanceY - 5, 85, 32, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('ACCOUNT SETTLEMENT SUMMARY', margin + 5, balanceY + 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Previous Balance:`, margin + 5, balanceY + 10);
    doc.text(`Payment Applied:`, margin + 5, balanceY + 16);
    
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`$${(Number(data.previous_balance) || 0).toFixed(2)}`, margin + 80, balanceY + 10, { align: 'right' });
    doc.text(`-$${(Number(data.total) || 0).toFixed(2)}`, margin + 80, balanceY + 16, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    if ((Number(data.new_balance) || 0) > 0) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(21, 128, 61);
    }
    doc.text(`NEW BALANCE DUE:`, margin + 5, balanceY + 22);
    doc.text(`$${(Number(data.new_balance) || 0).toFixed(2)}`, margin + 80, balanceY + 22, { align: 'right' });
  }

  // 5. Orivo Branding & Footer (Perfect Alignment)
  const footerY = pageHeight - 15;
  
  // Powered by Orivo (Sleek Horizontal)
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
  doc.text('EXCHANGE POLICY: All sales are final. Exchanges only within 7 days for unopened/undamaged items.', margin, footerY + 5);
  
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('CERTIFIED ENTERPRISE MANAGEMENT SYSTEM V2026', margin, footerY + 9);

  // Security QR Code (Sized to Balance)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://orivocrm.pro/verify/' + data.id)}`;
  doc.addImage(qrUrl, 'PNG', pageWidth - margin - 15, footerY - 12, 15, 15);

  if (mode === 'blob') {
    return doc.output('datauristring');
  }

  doc.save(`${data.type === 'PAYMENT' ? 'Receipt' : 'Invoice'}_${data.receipt_id || data.id.substring(0, 8)}.pdf`);
};


