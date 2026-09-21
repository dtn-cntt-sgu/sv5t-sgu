import type { Metadata } from "next";
import logo from "@/assets/logo/LOGO_SV5T.png";
import { SiteFooter } from "@/components/site-footer";
import { SiteConsoleMessage } from "@/components/site-console-message";
import "./globals.css";
import "./portal-readability.css";

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
      <body>
        <SiteConsoleMessage />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
