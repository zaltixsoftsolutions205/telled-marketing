export interface ExtractedPOData {
  poNumber?: string;
  amount?: number;
  vendorName?: string;
  vendorEmail?: string;
  product?: string;
  receivedDate?: Date;
  customerName?: string;
}

export function extractPOFromText(text: string): ExtractedPOData {
  const result: ExtractedPOData = {};
  
  // PO Number patterns
  const poPatterns = [
    /PO(?:[-\s]?#?)(?:[-\s]?)([A-Z0-9-]{4,20})/i,
    /Purchase\s+Order\s+(?:Number|#)?\s*[:\s-]*([A-Z0-9-]{4,20})/i,
    /Order\s+(?:Number|#)?\s*[:\s-]*([A-Z0-9-]{4,20})/i,
  ];
  
  for (const pattern of poPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.poNumber = match[1].trim();
      break;
    }
  }
  
  // Amount patterns
  const amountPatterns = [
    /(?:Total|Amount|Order\s+Total)\s*[:\s$₹]*([\d,]+(?:\.\d{2})?)/i,
    /Grand\s+Total\s*[:\s$₹]*([\d,]+(?:\.\d{2})?)/i,
    /₹\s*([\d,]+(?:\.\d{2})?)/,
  ];
  
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount)) {
        result.amount = amount;
        break;
      }
    }
  }
  
  // Vendor name patterns
  const vendorPatterns = [
    /(?:Vendor|Supplier|Seller|From|Company)\s*[:\s-]*([A-Za-z0-9\s&.,]+?)(?:\n|,|$)/i,
    /From:\s*([A-Za-z0-9\s&.,]+?)(?:\n|<)/i,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.vendorName = match[1].trim();
      break;
    }
  }
  
  // Vendor email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.vendorEmail = emailMatch[0];
  }
  
  // Product patterns
  const productPatterns = [
    /(?:Product|Item|Description)\s*[:\s-]*([A-Za-z0-9\s&.,-]+?)(?:\n|,|$)/i,
    /Item\s+Details?\s*[:\s-]*([A-Za-z0-9\s&.,-]+?)(?:\n|$)/i,
  ];
  
  for (const pattern of productPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.product = match[1].trim();
      break;
    }
  }
  
  // Date patterns
  const datePatterns = [
    /(?:Date|Order Date|PO Date)\s*[:\s-]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        result.receivedDate = date;
        break;
      }
    }
  }
  
  return result;
}

export function isPurchaseOrderEmail(subject: string, body: string): boolean {
  const keywords = [
    'purchase order',
    'po number',
    'order confirmation',
    'sales order',
    'purchase order received',
    'new purchase order',
  ];
  
  const combined = (subject + ' ' + body).toLowerCase();
  return keywords.some(keyword => combined.includes(keyword.toLowerCase()));
}