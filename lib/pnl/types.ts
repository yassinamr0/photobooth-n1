/*
 * P&L expense data (admin-only; see firestore.rules /expenses and /recurringExpenses).
 *   - One-off expense: counted on its own date.
 *   - Recurring (monthly) expense: e.g. rent or a salary. Its monthly amount is SPREAD evenly
 *     over the days of each month (owner's choice), so any range gets its fair share.
 *     Amount changes apply from the month they're made; earlier months keep the old amount.
 * eventId null = "General" — a cost not tied to one booth; only counted under Global.
 */

export const EXPENSE_CATEGORIES = ["rent", "staff", "stock", "transport", "maintenance", "marketing", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: "Rent",
  staff: "Staff pay",
  stock: "Stock purchases",
  transport: "Transport",
  maintenance: "Maintenance",
  marketing: "Marketing",
  other: "Other",
};

export type Expense = {
  id: string;
  eventId: string | null; // null = General
  date: string; // YYYY-MM-DD (local)
  amount: number; // EGP
  category: ExpenseCategory;
  note: string;
  createdBy: string;
};

/** A monthly amount in force from `from` (YYYY-MM) until the next change. */
export type AmountStep = { from: string; amount: number };

export type RecurringExpense = {
  id: string;
  eventId: string | null;
  category: ExpenseCategory;
  note: string;
  startMonth: string; // YYYY-MM (first month it counts)
  endMonth: string | null; // YYYY-MM (last month it counts), null = ongoing
  amounts: AmountStep[]; // sorted by `from`
  createdBy: string;
};

export const isCategory = (v: unknown): v is ExpenseCategory => (EXPENSE_CATEGORIES as readonly string[]).includes(v as string);
