import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, type DocumentData } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { withAmountFrom } from "./recurring";
import { withCostsFrom, type CostStep } from "./costs";
import { withFeeFrom, type FeeStep } from "./fees";
import { isCategory, type AmountStep, type Expense, type ExpenseCategory, type RecurringExpense } from "./types";

/*
 * Admin-only P&L data. Security rules restrict both collections to approved admins.
 * Subscriptions go through listen() so logout detaches them before signOut().
 */

const db = () => firebase().db;
const expensesCol = () => collection(db(), "expenses");
const recurringCol = () => collection(db(), "recurringExpenses");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseExpense(id: string, d: DocumentData): Expense {
  return {
    id,
    eventId: typeof d.eventId === "string" ? d.eventId : null,
    date: str(d.date),
    amount: num(d.amount),
    category: isCategory(d.category) ? d.category : "other",
    note: str(d.note),
    createdBy: str(d.createdBy),
    ...(d.spread === "event" ? { spread: "event" as const } : {}),
  };
}

export function parseRecurring(id: string, d: DocumentData): RecurringExpense {
  const amounts: AmountStep[] = Array.isArray(d.amounts)
    ? d.amounts.filter((a: DocumentData) => typeof a?.from === "string").map((a: DocumentData) => ({ from: a.from, amount: num(a.amount) }))
    : [];
  return {
    id,
    eventId: typeof d.eventId === "string" ? d.eventId : null,
    category: isCategory(d.category) ? d.category : "other",
    note: str(d.note),
    startMonth: str(d.startMonth),
    endMonth: typeof d.endMonth === "string" ? d.endMonth : null,
    amounts: amounts.sort((a, b) => a.from.localeCompare(b.from)),
    createdBy: str(d.createdBy),
  };
}

export function watchExpenses(onChange: (e: Expense[]) => void, onError: (e: Error) => void) {
  return listen(expensesCol(), (s) => onChange(s.docs.map((d) => parseExpense(d.id, d.data()))), onError);
}

export function watchRecurring(onChange: (r: RecurringExpense[]) => void, onError: (e: Error) => void) {
  return listen(recurringCol(), (s) => onChange(s.docs.map((d) => parseRecurring(d.id, d.data()))), onError);
}

export type ExpenseInput = { eventId: string | null; date: string; amount: number; category: ExpenseCategory; note: string; spread?: "event" };

function check(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount above 0");
}

export function addExpense(e: ExpenseInput, by: string) {
  check(e.amount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("Pick a date");
  if (e.spread === "event" && !e.eventId) throw new Error("A whole-event expense needs an event");
  return addDoc(expensesCol(), { ...e, note: e.note.trim(), createdBy: by, createdAt: serverTimestamp() });
}

export function updateExpense(id: string, e: ExpenseInput) {
  check(e.amount);
  return updateDoc(doc(expensesCol(), id), { ...e, note: e.note.trim() });
}

export function deleteExpense(id: string) {
  return deleteDoc(doc(expensesCol(), id));
}

export type RecurringInput = { eventId: string | null; category: ExpenseCategory; note: string; startMonth: string; amount: number };

export function addRecurring(r: RecurringInput, by: string) {
  check(r.amount);
  if (!/^\d{4}-\d{2}$/.test(r.startMonth)) throw new Error("Pick a start month");
  return addDoc(recurringCol(), {
    eventId: r.eventId, category: r.category, note: r.note.trim(), startMonth: r.startMonth, endMonth: null,
    amounts: [{ from: r.startMonth, amount: r.amount }], createdBy: by, createdAt: serverTimestamp(),
  });
}

/** New monthly amount from `month` onward — earlier months keep what they were. */
export function changeRecurringAmount(r: RecurringExpense, month: string, amount: number) {
  check(amount);
  return updateDoc(doc(recurringCol(), r.id), { amounts: withAmountFrom(r.amounts, month, amount) });
}

/** Last month it counts (null = resume / ongoing). */
export function setRecurringEnd(id: string, endMonth: string | null) {
  return updateDoc(doc(recurringCol(), id), { endMonth });
}

export function updateRecurringDetails(id: string, patch: { eventId: string | null; category: ExpenseCategory; note: string }) {
  return updateDoc(doc(recurringCol(), id), { ...patch, note: patch.note.trim() });
}

export function deleteRecurring(id: string) {
  return deleteDoc(doc(recurringCol(), id));
}

/* ───────────── Card fees + product costs (settings/fees, settings/costs — admin only) ───────────── */

const feesDoc = () => doc(db(), "settings", "fees");
const costsDoc = () => doc(db(), "settings", "costs");
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseFeeSteps(d: DocumentData | undefined): FeeStep[] {
  const raw = d?.steps;
  return Array.isArray(raw)
    ? raw.filter((x) => typeof x?.from === "string").map((x) => ({
        from: x.from, mode: x.mode === "percentPlusFixed" ? "percentPlusFixed" : "percent", percent: num(x.percent), fixed: num(x.fixed),
      } as FeeStep))
    : [];
}

export function parseCostSteps(d: DocumentData | undefined): CostStep[] {
  const raw = d?.steps;
  return Array.isArray(raw)
    ? raw.filter((x) => typeof x?.from === "string").map((x) => ({
        from: x.from, paperBox: numOrNull(x.paperBox), cartridgesPerBox: numOrNull(x.cartridgesPerBox), acrylic: numOrNull(x.acrylic), magnetic: numOrNull(x.magnetic),
      }))
    : [];
}

export function watchFees(onChange: (steps: FeeStep[]) => void, onError: (e: Error) => void) {
  return listen(feesDoc(), (s) => onChange(parseFeeSteps(s.data())), onError);
}

export function watchCosts(onChange: (steps: CostStep[]) => void, onError: (e: Error) => void) {
  return listen(costsDoc(), (s) => onChange(parseCostSteps(s.data())), onError);
}

/** Save a new card fee that applies from `step.from` until changed again. */
export function saveFee(steps: FeeStep[], step: FeeStep) {
  if (!(step.percent >= 0 && step.percent < 100)) throw new Error("Percentage must be between 0 and 100");
  if (step.mode === "percentPlusFixed" && !(step.fixed >= 0)) throw new Error("Fixed amount must be 0 or more");
  const clean: FeeStep = { ...step, fixed: step.mode === "percentPlusFixed" ? step.fixed : 0 };
  return setDoc(feesDoc(), { steps: withFeeFrom(steps, clean) });
}

export function saveCosts(steps: CostStep[], step: CostStep) {
  for (const v of [step.paperBox, step.cartridgesPerBox, step.acrylic, step.magnetic])
    if (v != null && !(v >= 0)) throw new Error("Costs must be 0 or more");
  return setDoc(costsDoc(), { steps: withCostsFrom(steps, step) });
}
