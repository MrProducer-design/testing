import { BackgroundPaths } from "@/components/ui/background-paths";
import { NewsDashboard } from "@/components/news-dashboard";

export default function Home() {
  return (
    <>
      <BackgroundPaths title="AI News Dashboard" />
      <NewsDashboard />
    </>
  );
}
