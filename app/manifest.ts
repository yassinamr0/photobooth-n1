import type { MetadataRoute } from "next";

/*
 * Makes Booth Log installable to a phone home screen (staff use it on their phones during
 * shifts). Icons are the Memoire logo recreated from legacy/icon.jpg (see public/icons/).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Booth Log",
    short_name: "Booth Log",
    description: "Photobooth shift, sales and inventory tracker",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash screen: the logo's crimson, so the launch screen matches the icon.
    background_color: "#9a1031",
    theme_color: "#100f0d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
