import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { SidebarProvider } from "@/context/SidebarContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Bank Core | Next-Gen Core Banking Platform",
  description:
    "High-concurrency Core Banking Engine with Double-Entry Ledger, Idempotency Protection, and Transactional Outbox Event Streaming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-[#f7f5ee] dark:bg-vault-obsidian text-slate-900 dark:text-slate-100 selection:bg-bullion-500/20 dark:selection:bg-bullion-500/30 selection:text-bullion-700 dark:selection:text-bullion-300 flex font-sans antialiased transition-colors duration-300 bg-guilloche-pattern">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <Sidebar />
                  <div className="flex flex-1 flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                      {children}
                    </main>
                  </div>
                </div>
              </SidebarProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
