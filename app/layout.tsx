import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hameem Textiles - Biometric Attendance & Workforce Management',
  description: 'Hameem Textiles biometric face attendance, daily shift tracking, and employee timesheet portal.',
  openGraph: {
    title: 'Hameem Textiles - Biometric Attendance & Workforce Management',
    description: 'Hameem Textiles biometric face attendance, daily shift tracking, and employee timesheet portal.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hameem Textiles - Biometric Attendance & Workforce Management',
    description: 'Hameem Textiles biometric face attendance, daily shift tracking, and employee timesheet portal.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 min-h-screen antialiased selection:bg-teal-600 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
