export interface ConsumerTransaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  currency: string;
  merchantName: string | null;
  merchantCategoryCode: string | null;
  type: string;
  source: string;
  channel: string;
  category: string | null;
  description: string | null;
  transactionDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
