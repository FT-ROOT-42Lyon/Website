import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "~/lib/auth-context";
import { CategoriesProvider } from "~/lib/categories-context";
import { BracketsProvider } from "~/lib/brackets-context";
import { EventsProvider } from "~/lib/events-context";
import { Nav } from "~/components/Nav";

export const metadata: Metadata = {
  title: "ft_root — Plateforme",
  description: "Plateforme événementielle du club ft_root — 42Lyon",
  icons: {
    icon: [{ url: "/logo.webp", type: "image/webp" }],
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
  openGraph: {
    title: "ft_root — Plateforme",
    description: "Plateforme événementielle du club ft_root — 42Lyon",
    images: ["/logo.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#e0001b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <CategoriesProvider>
            <BracketsProvider>
              <EventsProvider>
                <Nav />
                {children}
              </EventsProvider>
            </BracketsProvider>
          </CategoriesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
