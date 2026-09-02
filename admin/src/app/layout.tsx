import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/logout/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Musicaleando admin",
  description: "Panel de administración de Musicaleando",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {user && (
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
            <Link href="/" className="font-semibold">
              Musicaleando admin
            </Link>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{user.email}</span>
              <form action={logout}>
                <button type="submit" className="underline">
                  Salir
                </button>
              </form>
            </div>
          </header>
        )}
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
