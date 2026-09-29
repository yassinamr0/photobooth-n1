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
  /** Ink CARTRIDGES swapped in during this shift (one tap = one cartridge). Legacy shifts → 0. */
  inkChanges: number;
  endPaperCount: number | null;
  /** Pack size snapshotted when the shift started (older/legacy shifts don't have it). */
  sheetsPerPack?: number | null;
  paperVerified?: boolean;
  /** Set once when this shift's paper/ink/frames were deducted from ITS OWN event's stock. */
  stockDeduction?: {
    eventId: string;
    sheets: number;
    cartridges: number;
    acrylic: number;
    magnetic: number;
  } | null;
  /**
   * Tagged with an event by an admin AFTER the fact (e.g. legacy "no event" shifts). Counts
   * toward that event's revenue/stats but never touches its stock and never shows as
   * "not yet deducted".
   */
  stockExempt?: boolean;
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
