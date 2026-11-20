import { DirectView } from "@/components/chat/direct-view";

export default async function DirectPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <DirectView key={userId} nexconnId={userId} />;
}
