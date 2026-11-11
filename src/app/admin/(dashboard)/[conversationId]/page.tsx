import { ConversationWorkspace } from "@/components/admin/ConversationWorkspace";

export default async function AdminConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return <ConversationWorkspace key={conversationId} conversationId={conversationId} />;
}
