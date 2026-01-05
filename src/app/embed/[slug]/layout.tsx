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
    <html lang="en">
      <body className="bg-black text-white m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
