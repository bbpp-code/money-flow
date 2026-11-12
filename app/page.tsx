import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Dashboard from "@/components/dashboard";
import { authOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/repositories";

export default async function Home() {
  if (!isDemoMode()) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email.toLowerCase() !== process.env.OWNER_EMAIL?.toLowerCase()) redirect("/api/auth/signin");
  }
  return <Dashboard />;
}
