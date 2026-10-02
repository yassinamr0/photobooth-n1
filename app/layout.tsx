import type { Metadata, Viewport } from "next";
import { Figtree, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { THEME_BOOT_SCRIPT } from "@/lib/design/themes";

// UI workhorse: clean grotesque, comfortable word spacing at small sizes.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

// Headings & big numerals: soft, rounded geometric sans with real tabular figures.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Booth Log",
  description: "Photobooth shift, sales and inventory tracker",
  applicationName: "Booth Log",
  // iPhone "Add to Home Screen": opens full-screen like an app (icon: app/apple-icon.png).
  appleWebApp: {
    capable: true,
    title: "Booth Log",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e111a",
  width: "device-width",
  initialScale: 1,
  // Content can extend under the iPhone notch/home bar when installed full-screen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme before React hydrates.
    <html lang="en" className={`${figtree.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-canvas">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
