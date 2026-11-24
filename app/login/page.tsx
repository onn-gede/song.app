import { WelcomePage } from "@/components/WelcomePage";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const query = await searchParams;
  return <WelcomePage sessionExpired={query.session === "expired"} />;
}
