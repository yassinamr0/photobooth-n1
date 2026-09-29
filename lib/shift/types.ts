import type { Timestamp } from "firebase/firestore";
import type { CustomItem, FrameType } from "./pricing";

export type Shift = {
  id: string;
  uid: string;
  staffName: string;
  /** One-time snapshot of the staff member's assignedEventId at shift creation. Never re-derived. */
  eventId: string | null;
  startTime: string; // ISO
  endTime: string | null; // ISO
  startPaperCount: number | null;
  /** Number of PACKS (settings/paper.sheetsPerPack sheets each) swapped in. Never boxes. */
  paperChanges: number;
  endPaperCount: number | null;
  paperVerified?: boolean;
  createdAt?: Timestamp | null;
};

type EntryBase = {
  id: string;
  uid: string;
  staffName: string;
  shiftId: string;
  time: string; // ISO
  desc: string;
  total: number;
  cash: number;
  visa: number;
};

export type SaleEntry = EntryBase & {
  type: "sale";
  sheets: number;
  frames: Record<FrameType, number>;
  custom: CustomItem[];
};

export type WasteEntry = EntryBase & { type: "waste"; hadr: number };

export type Entry = SaleEntry | WasteEntry;
