import { FileX2 } from 'lucide-react';
import { useCollection, useSaveRequest } from '../../api/hooks';
import { Button, EmptyState, FullPageSpinner } from '../../components/ui';
import { newDraft, toDraft } from '../../lib/request';
import { useWorkspaceStore, type Tab } from '../../store/workspace';
import type { ApiRequest, RequestDraft } from '../../types';
import { useState } from 'react';
import { RequestEditor } from './RequestEditor';
import { SaveRequestModal } from './SaveRequestModal';
import { useWs } from './context';

export function SavedRequestTab({ tab }: { tab: Tab }) {
  const { wsId } = useWs();
  const { data: detail, isLoading } = useCollection(tab.collectionId);
  const save = useSaveRequest(wsId);
  const clearDraft = useWorkspaceStore((s) => s.clearDraft);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);

  if (isLoading) return <FullPageSpinner />;
  const request = detail?.requests.find((r) => r.id === tab.id);
  if (!detail || !request) {
    return (
      <EmptyState
        icon={<FileX2 className="size-6" />}
        title="This request no longer exists"
        description="It may have been deleted by someone in your workspace."
        action={<Button onClick={() => closeTab(wsId, tab.key)}>Close tab</Button>}
      />
    );
  }

  const onSave = (draft: RequestDraft) =>
    save.mutate(
      { id: request.id, draft },
      {
        onSuccess: (saved) => {
          clearDraft(request.id);
          renameTab(wsId, tab.key, saved.name);
        },
      },
    );

  return <RequestEditor key={request.id} draftId={request.id} base={toDraft(request)} request={request} detail={detail} onSave={onSave} saving={save.isPending} />;
}

export function ScratchTab({ tab }: { tab: Tab }) {
  const { wsId } = useWs();
  const draft = useWorkspaceStore((s) => s.drafts[tab.id]);
  const responses = useWorkspaceStore((s) => s.responses[tab.id]);
  const { closeTab, openTab, setResponse } = useWorkspaceStore();
  const [saving, setSaving] = useState<RequestDraft | null>(null);

  const onSaved = (r: ApiRequest) => {
    setSaving(null);
    if (responses) setResponse(r.id, responses);
    closeTab(wsId, tab.key);
    openTab(wsId, { kind: 'request', id: r.id, collectionId: r.collectionId, title: r.name });
  };

  return (
    <>
      <RequestEditor key={tab.id} draftId={tab.id} base={draft ?? newDraft()} onSave={(d) => setSaving(d)} />
      {saving && <SaveRequestModal draft={saving} onClose={() => setSaving(null)} onSaved={onSaved} />}
    </>
  );
}
