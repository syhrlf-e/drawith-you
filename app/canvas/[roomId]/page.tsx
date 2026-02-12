import CanvasPageClient from "./CanvasPageClient";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function CanvasPage({ params }: PageProps) {
  const { roomId } = await params;
  return <CanvasPageClient roomId={roomId} />;
}
