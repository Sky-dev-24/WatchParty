import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminAuthRequired } from "@/lib/auth";
import { isRedisConfigured } from "@/lib/redis";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isRedisConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Unavailable</h1>
          <p className="text-gray-400">Redis is required for admin access.</p>
        </div>
      </div>
    );
  }

  if (isAdminAuthRequired() && !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
