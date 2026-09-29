import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
  themeColor: "#0f0d16",
  width: "device-width",
  initialScale: 1,
  // Content can extend under the iPhone notch/home bar when installed full-screen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-canvas">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
