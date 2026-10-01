import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Figtree } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

// UI workhorse: clean grotesque, comfortable word spacing at small sizes.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

// Film-edge lettering: condensed caps for frame labels and big tabular numerals.
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
  themeColor: "#100f0d",
  width: "device-width",
  initialScale: 1,
  // Content can extend under the iPhone notch/home bar when installed full-screen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${barlow.variable}`}>
      <body className="bg-canvas">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
