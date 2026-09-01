import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const appFont = Nunito({
  variable: "--font-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quadricount",
  description: "Split expenses with friends and groups",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${appFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
