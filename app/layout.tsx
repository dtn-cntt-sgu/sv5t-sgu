import type { Metadata } from "next";
import { Lora } from "next/font/google";
import logo from "@/assets/logo/LOGO_SV5T.png";
import { SiteFooter } from "@/components/site-footer";
import { SiteConsoleMessage } from "@/components/site-console-message";
import "./globals.css";
import "./portal-readability.css";
import "./admin-ui.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
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
