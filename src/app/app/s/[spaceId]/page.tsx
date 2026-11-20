import { SpaceView } from "@/components/spaces/space-view";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  return <SpaceView key={spaceId} spaceId={spaceId} />;
}
