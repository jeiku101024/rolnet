import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ROLNET Fleet Management",
    short_name: "ROLNET",
    description: "Tricycle fleet ledger for units, drivers, remittances, expenses, maintenance, and documents.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fffcf3",
    theme_color: "#1b2a41",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/rolnet-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
