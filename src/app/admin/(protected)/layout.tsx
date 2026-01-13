import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminAuthRequired } from "@/lib/auth";
import { isRedisAvailable } from "@/lib/redis";

// Force dynamic rendering - don't cache this layout
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Unavailable</h1>
          <p className="text-gray-400">Redis is required for admin access.</p>
          <p className="text-gray-500 text-sm mt-2">
            Check that REDIS_URL is set and Redis is running.
          </p>
        </div>
      </div>
    );
  }

  if (isAdminAuthRequired() && !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
