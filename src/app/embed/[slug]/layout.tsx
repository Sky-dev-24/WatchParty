import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Embedded Stream",
  robots: "noindex", // Prevent embed pages from being indexed
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full bg-black text-white m-0 p-0 overflow-hidden leading-none">
        {children}
      </body>
    </html>
  );
}
