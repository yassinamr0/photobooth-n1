import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarClock,
  Camera,
  Clock,
  Frame,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { PanelFrame } from "@/components/layout/PanelFrame";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { ChartDefsHost } from "@/components/charts/ChartDefs";
import { Button } from "@/components/ui/Button";
import { ActionButton } from "@/components/ui/ActionButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { StatValue } from "@/components/ui/StatValue";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { chartSeries } from "@/lib/design/chart";
import {
  DemoBarChart,
  DemoDonut,
  DemoProgressRing,
  DemoSparkline,
  demoDonutLegend,
} from "./demo-charts";

export const metadata: Metadata = { title: "Style guide · Booth Log" };

const swatchGroups: { title: string; items: { name: string; hex: string; className: string }[] }[] = [
  {
    title: "Surfaces",
    items: [
      { name: "canvas", hex: "#0F0D16", className: "bg-canvas" },
      { name: "surface", hex: "#17141F", className: "bg-surface" },
      { name: "surface-2", hex: "#1F1B2A", className: "bg-surface-2" },
      { name: "line", hex: "#2A2538", className: "bg-line" },
      { name: "line-strong", hex: "#3A3350", className: "bg-line-strong" },
    ],
  },
  {
    title: "Text",
    items: [
      { name: "ink", hex: "#F4F1FA", className: "bg-ink" },
      { name: "ink-muted", hex: "#A39DB8", className: "bg-ink-muted" },
      { name: "ink-faint", hex: "#6E6886", className: "bg-ink-faint" },
    ],
  },
  {
    title: "Accents",
    items: [
      { name: "violet", hex: "#7C3AED", className: "bg-violet" },
      { name: "magenta", hex: "#D946EF", className: "bg-magenta" },
      { name: "pink", hex: "#FF4D8D", className: "bg-pink" },
      { name: "accent gradient", hex: "violet → pink", className: "bg-accent-gradient" },
      { name: "gold (money)", hex: "#FFC93C", className: "bg-gold" },
    ],
  },
  {
    title: "Status",
    items: [
      { name: "success / cash", hex: "#4ADE80", className: "bg-success" },
      { name: "warning", hex: "#FFB547", className: "bg-warning" },
      { name: "danger", hex: "#FF5C6C", className: "bg-danger" },
      { name: "info / visa", hex: "#5B9CFF", className: "bg-info" },
    ],
  },
  {
    title: "Frame gradient",
    items: [
      { name: "blush", hex: "#F9D5E5", className: "bg-frame-blush" },
      { name: "lavender", hex: "#DCCFF7", className: "bg-frame-lavender" },
      { name: "soft blue", hex: "#C9DDFB", className: "bg-frame-blue" },
      { name: "frame gradient", hex: "blush → blue", className: "bg-frame-gradient" },
    ],
  },
];

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        {note && <p className="text-sm text-ink-faint">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-medium tracking-wide text-ink-faint uppercase">{children}</p>;
}

export default function StyleGuidePage() {
  return (
    <PanelFrame
      variant="dashboard"
      sidebar={
        <SidebarRail
          logo={
            <span className="grid size-11 place-items-center rounded-[12px] bg-gold text-[#1a1406]">
              <Camera className="size-5" />
            </span>
          }
          items={[
            { label: "Overview", icon: <LayoutGrid />, active: true },
            { label: "Staff", icon: <Users /> },
            { label: "Shifts", icon: <CalendarClock /> },
            { label: "Events", icon: <MapPin /> },
            { label: "Inventory", icon: <Boxes /> },
            { label: "Statistics", icon: <BarChart3 /> },
          ]}
          footer={
            <span className="grid size-11 place-items-center rounded-full text-ink-faint">
              <Settings className="size-5" />
            </span>
          }
        />
      }
    >
      <ChartDefsHost />
      <div className="flex flex-col gap-12">
        {/* 1. Header */}
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-muted">Booth Log · Phase 1 style guide</p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
              Good evening, <span className="text-accent-gradient">Yassin</span>
            </h1>
            <p className="mt-2 max-w-xl text-ink-muted">
              Design tokens and base components. Sample data throughout — nothing here is wired to
              Firebase.
            </p>
          </div>
          <AvatarGroup names={["Yassin Amr", "Nour Hassan", "Omar Said", "Laila Fathy", "Karim Adel", "Mona Z"]} />
        </header>

        {/* 2. Colors */}
        <Section id="colors" title="Color tokens" note="Tailwind classes: bg-<name>, text-<name>, border-<name>">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {swatchGroups.map((g) => (
              <Card key={g.title} padding="sm">
                <Label>{g.title}</Label>
                <ul className="flex flex-col gap-2">
                  {g.items.map((s) => (
                    <li key={s.name} className="flex items-center gap-3">
                      <span className={`h-9 w-14 shrink-0 rounded-[10px] border border-white/10 ${s.className}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                        <span className="block font-mono text-xs text-ink-faint">{s.hex}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Section>

        {/* 3. Typography */}
        <Section id="type" title="Typography" note="Display: Sora · Body: Inter">
          <Card padding="lg" className="flex flex-col gap-5">
            <div>
              <Label>Display XL · 48 / 800</Label>
              <p className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Tonight&apos;s shift</p>
            </div>
            <div>
              <Label>Display L · 30 / 700</Label>
              <p className="font-display text-3xl font-bold tracking-tight">Paper reconciliation</p>
            </div>
            <div>
              <Label>Display M · 20 / 700</Label>
              <p className="font-display text-xl font-bold">City Stars Mall booth</p>
            </div>
            <div>
              <Label>Body · 16 / 400</Label>
              <p className="max-w-2xl text-ink-muted">
                Staff log sheets sold, frames and waste during their shift. Admins review totals,
                paper usage and inventory per event.
              </p>
            </div>
            <div>
              <Label>Caption · 12</Label>
              <p className="text-xs text-ink-faint">Last synced 2 minutes ago</p>
            </div>
            <div className="flex flex-wrap gap-10">
              <StatValue label="Money figure (gold)" value={12400} money size="xl" />
              <StatValue label="Plain figure (tabular)" value="1,284" size="xl" />
            </div>
          </Card>
        </Section>

        {/* 4. Buttons */}
        <Section id="buttons" title="Buttons" note="All pill-shaped · sm / md / lg">
          <Card padding="lg" className="flex flex-col gap-6">
            {(["primary", "secondary", "danger", "ghost"] as const).map((v) => (
              <div key={v}>
                <Label>{v}</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant={v} size="sm">Small</Button>
                  <Button variant={v}>Medium</Button>
                  <Button variant={v} size="lg">Large</Button>
                  <Button
                    variant={v}
                    leftIcon={v === "danger" ? <Trash2 className="size-4" /> : <Plus className="size-4" />}
                  >
                    {v === "danger" ? "Delete" : "With icon"}
                  </Button>
                  <Button variant={v} disabled>Disabled</Button>
                  <Button variant={v} loading>Saving</Button>
                </div>
              </div>
            ))}
            <div>
              <Label>pill (filters / segmented)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="pill" size="sm" selected>This week</Button>
                <Button variant="pill" size="sm">This month</Button>
                <Button variant="pill" size="sm">All time</Button>
                <span className="mx-2 h-5 w-px bg-line" />
                <Button variant="pill" selected>All events</Button>
                <Button variant="pill">City Stars</Button>
                <Button variant="pill" rightIcon={<ArrowRight className="size-4" />}>More</Button>
              </div>
            </div>
          </Card>
        </Section>

        {/* 5. Tags */}
        <Section id="tags" title="Tags & badges">
          <Card padding="lg" className="flex flex-col gap-6">
            <div>
              <Label>Tones</Label>
              <div className="flex flex-wrap gap-2">
                {(["neutral", "accent", "gold", "success", "warning", "danger", "info"] as const).map((t) => (
                  <Tag key={t} tone={t}>{t}</Tag>
                ))}
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  <Tag tone="accent">Admin</Tag>
                  <Tag tone="neutral">Staff</Tag>
                  <Tag tone="warning" dot>Pending approval</Tag>
                </div>
              </div>
              <div>
                <Label>Event status</Label>
                <div className="flex flex-wrap gap-2">
                  <Tag tone="success" dot>Active</Tag>
                  <Tag tone="neutral" dot>Closed</Tag>
                </div>
              </div>
              <div>
                <Label>Warnings</Label>
                <div className="flex flex-wrap gap-2">
                  <Tag tone="danger" icon={<AlertTriangle />}>Paper mismatch</Tag>
                  <Tag tone="warning" icon={<Package />}>Low stock</Tag>
                </div>
              </div>
              <div>
                <Label>Payment</Label>
                <div className="flex flex-wrap gap-2">
                  <Tag tone="success">Cash</Tag>
                  <Tag tone="info">Visa</Tag>
                  <Tag tone="gold">Total</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* 6. Cards */}
        <Section id="cards" title="Cards" note="16px radius · thin border · soft shadow">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <StatValue label="Revenue · this week" value={23400} money hint="+12% vs last week" />
            </Card>
            <Card>
              <StatValue label="Sheets sold" value="58.5" hint="across 3 events" />
            </Card>
            <Card>
              <StatValue label="Cash" value={15200} money size="md" />
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-chart-track">
                <div className="h-full w-[65%] rounded-full bg-accent-gradient" />
              </div>
            </Card>
            <Card>
              <StatValue label="Visa" value={8200} money size="md" />
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-chart-track">
                <div className="bg-hatch h-full w-[35%] rounded-full" />
              </div>
            </Card>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Card with header action"
                subtitle="Title, optional subtitle, action slot"
                action={<Button variant="secondary" size="sm">View all</Button>}
              />
              <CardBody>
                Body copy sits in muted ink. Cards use the <code className="text-ink">surface</code>{" "}
                token over the <code className="text-ink">canvas</code> panel background.
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Active shift" action={<Tag tone="success" dot>Live</Tag>} />
              <div className="flex items-center gap-3">
                <Avatar name="Nour Hassan" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">Nour Hassan</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Clock className="size-3.5" /> Started 6:00 PM · City Stars
                  </p>
                </div>
                <StatValue value={3200} money size="md" />
              </div>
            </Card>
          </div>
        </Section>

        {/* 7. Charts */}
        <Section id="charts" title="Chart tokens" note="Gradient fills mixed with diagonal hatch · static SVG demos">
          <Card padding="sm" className="mb-5">
            <Label>Categorical series (in order)</Label>
            <div className="flex flex-wrap gap-4">
              {chartSeries.map((c, i) => (
                <span key={c} className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="size-4 rounded-[5px]" style={{ backgroundColor: c }} />
                  {i + 1} · <span className="font-mono text-xs">{c}</span>
                </span>
              ))}
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="bg-hatch size-4 rounded-[5px]" /> hatch
              </span>
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="size-4 rounded-[5px] bg-chart-track" /> track
              </span>
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Weekly sales"
                subtitle="Cash (gradient) + visa (hatched), stacked"
                action={<StatValue value={37800} money size="md" />}
              />
              <DemoBarChart />
            </Card>
            <div className="flex flex-col gap-5">
              <Card className="flex items-center gap-4">
                <DemoProgressRing />
                <div>
                  <p className="font-display font-semibold text-ink">Paper stock</p>
                  <p className="text-sm text-ink-muted">Progress ring</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <DemoDonut />
                <ul className="flex flex-col gap-1.5">
                  {demoDonutLegend.map((l) => (
                    <li key={l.label} className="flex items-center gap-2 text-sm text-ink-muted">
                      <span className={`size-3 rounded-[4px] ${l.swatch}`} />
                      {l.label}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <Card className="lg:col-span-3">
              <CardHeader title="Trend line" subtitle="Sparkline with gradient stroke and soft area fill" />
              <div className="max-w-md">
                <DemoSparkline />
              </div>
            </Card>
          </div>
        </Section>

        {/* 8. Avatars */}
        <Section id="avatars" title="Avatars" note="Rounded-square · overlapping groups">
          <Card padding="lg" className="flex flex-wrap items-center gap-8">
            <div className="flex items-end gap-3">
              <Avatar name="Yassin Amr" size="sm" />
              <Avatar name="Yassin Amr" size="md" />
              <Avatar name="Yassin Amr" size="lg" />
            </div>
            <AvatarGroup names={["Nour Hassan", "Omar Said", "Laila Fathy"]} />
            <AvatarGroup names={["Nour Hassan", "Omar Said", "Laila Fathy", "Karim Adel", "Mona Z", "Hana K"]} size="lg" />
          </Card>
        </Section>

        {/* 9. Mobile staff preview */}
        <Section
          id="mobile"
          title="Staff mobile style"
          note="Visual treatment only — Phase 3's locked shift layout is not decided here"
        >
          <div className="flex flex-wrap items-start gap-8">
            <div className="w-full max-w-[390px] rounded-[36px] bg-frame-gradient p-3 shadow-panel">
              <div className="rounded-[26px] bg-canvas px-5 py-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink-muted">City Stars Mall</p>
                    <p className="font-display text-2xl font-extrabold tracking-tight">Hi, Nour</p>
                  </div>
                  <Tag tone="success" dot>On shift</Tag>
                </div>
                <Card padding="sm" className="mb-6">
                  <StatValue label="Shift total" value={3200} money size="lg" />
                </Card>
                <div className="flex flex-col gap-3">
                  <ActionButton icon={<Plus />} sublabel="400 EGP per sheet">Add sale</ActionButton>
                  <ActionButton tone="neutral" icon={<Package />} sublabel="One pack swapped in">
                    + Paper change
                  </ActionButton>
                  <ActionButton tone="gold" icon={<Frame />}>Frame sale</ActionButton>
                  <ActionButton tone="danger" icon={<LogOut />}>End shift</ActionButton>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="pill" size="lg" selected className="flex-1">Cash</Button>
                  <Button variant="pill" size="lg" className="flex-1">Visa</Button>
                </div>
              </div>
            </div>
            <Card padding="lg" className="max-w-sm">
              <CardHeader title="Mobile interaction rules" />
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
                <li>Action buttons are full-width, ≥ 64px tall, one-handed.</li>
                <li>Same palette and type as the dashboard; less chrome, more spacing.</li>
                <li>Gold marks money; the gradient marks the primary action.</li>
                <li>No sidebar — PanelFrame&apos;s <code className="text-ink">mobile</code> variant.</li>
              </ul>
            </Card>
          </div>
        </Section>
      </div>
    </PanelFrame>
  );
}
