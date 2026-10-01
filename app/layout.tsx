import type { Metadata, Viewport } from "next";
import { Albert_Sans, Nunito } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

// Body: Albert Sans — geometric like the brand's Avenir, without the generic Inter look.
const albert = Albert_Sans({
  variable: "--font-albert",
  subsets: ["latin"],
});

// Headings: Nunito at heavy weights — rounded, echoes the Memoire wordmark.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
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
  themeColor: "#2a2a2a",
  width: "device-width",
  initialScale: 1,
  // Content can extend under the iPhone notch/home bar when installed full-screen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${albert.variable} ${nunito.variable}`}>
      <body className="bg-canvas">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
