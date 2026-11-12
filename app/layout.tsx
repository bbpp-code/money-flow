import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoneyFlow Japan",
  description: "ระบบจัดการการเงินส่วนตัวสำหรับชีวิตในญี่ปุ่น",
  applicationName: "MoneyFlow Japan",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MoneyFlow" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3efe6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
