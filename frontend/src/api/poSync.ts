import axios from './axios';

export interface ExtractedPO {
  poNumber?: string;
  amount?: number;
  vendorName?: string;
  vendorEmail?: string;
  vendorDomain?: string;
  product?: string;
  receivedDate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  gstNumber?: string;
  contactPerson?: string;
  rawText: string;
  confidence: number;
  isScanned: boolean;
  sourceFile?: string;
  parseMethod: string;
}

export interface DetectedPO {
  emailUid: string;
  emailSubject: string;
  emailFrom: string;
  emailFromEmail: string;
  emailFromDomain: string;
  emailDate: string;
  filename: string;
  extracted: ExtractedPO;
  suggestedLeadId?: string;
  suggestedLeadName?: string;
  alreadyImported: boolean;
}

export const poSyncApi = {
  scan: async (daysBack = 60): Promise<{ detected: DetectedPO[]; emailsScanned: number }> => {
    const res = await axios.post('/po-sync/scan', { daysBack });
    return res.data.data;
  },

  testConnection: async (): Promise<{ connected: boolean; emailsFound: number }> => {
    const res = await axios.get('/po-sync/test-connection');
    return res.data.data;
  },

  importPO: async (payload: {
    leadId: string;
    poNumber?: string;
    amount: number;
    vendorName?: string;
    vendorEmail?: string;
    product?: string;
    receivedDate?: string;
    paymentTerms?: string;
    notes?: string;
  }) => {
    const res = await axios.post('/po-sync/import', payload);
    return res.data.data;
  },
};
