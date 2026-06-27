import { DashboardOverview } from "@/components/manage/dashboard-overview";

export default function ManagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-400">
          Overview of DeckyVault statistics and moderation queue
        </p>
      </div>
      <DashboardOverview />
    </div>
  );
}
