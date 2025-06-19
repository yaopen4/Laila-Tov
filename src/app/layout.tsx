
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggleButton } from "@/components/ui/theme-toggle-button";


const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'לילה טוב - מעקב שינה לתינוקות',
  description: 'אפליקציה למעקב שינה לתינוקות עבור יועצות שינה והורים',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeToggleButton />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
