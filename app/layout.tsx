import "./globals.css";
import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "StoryChain",
  description: "Collaborative AI-gated story chains on GenLayer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 antialiased">
        <WalletProvider>
          <div className="min-h-screen">{children}</div>
        </WalletProvider>
      </body>
    </html>
  );
}
