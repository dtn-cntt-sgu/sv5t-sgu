import type { Metadata } from "next";
import localFont from "next/font/local";
import logo from "@/assets/logo/LOGO_SV5T.png";
import { SiteFooter } from "@/components/site-footer";
import { SiteConsoleMessage } from "@/components/site-console-message";
import "./globals.css";
import "./portal-readability.css";
import "./admin-ui.css";

// Keep Vietnamese letters and combining marks in the same font file. Static
// faces also avoid differences in variable-font rendering on older devices.
const lora = localFont({
  variable: "--font-lora",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Times New Roman", "serif"],
  src: [
    {
      path: "../assets/fonts/lora/Lora-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/lora/Lora-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/lora/Lora-Italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Sinh viên 5 Tốt | SGU",
    template: "%s | SV5T SGU",
  },
  description: "Cổng đăng ký, xét duyệt và quản lý danh hiệu Sinh viên 5 Tốt.",
  icons: {
    icon: logo.src,
    shortcut: logo.src,
    apple: logo.src,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={lora.variable}>
        <SiteConsoleMessage />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
