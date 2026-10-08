export type ReceiptInspection = {
  schema: string;
  recognized: boolean;
  label: 'UNVERIFIED_IMPORT' | 'REVIEW_REQUIRED';
  issues: string[];
  fields: Record<string, string | boolean>;
  verifiedCryptographically: false;
  executionPermitted: false;
  sharesContent: false;
};
export function inspectReceipt(input: string): ReceiptInspection;
