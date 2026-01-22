/**
 * Admin Dashboard - WatchParty
 *
 * Redirects to the create room page
 */

import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/(protected)/create-room");
}
