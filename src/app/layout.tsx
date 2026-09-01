import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

const appFont = Nunito({
  variable: "--font-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quadricount",
  description: "Split expenses with friends and groups",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${appFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <I18nProvider locale={locale}>
          <Header />
          <div className="flex flex-1 flex-col">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
