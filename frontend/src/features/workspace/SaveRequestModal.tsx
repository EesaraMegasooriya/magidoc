import { useEffect, useState } from 'react';
import { useCollection, useCollections, useCreateRequest } from '../../api/hooks';
import { Button, Field, Input, Modal, Select } from '../../components/ui';
import { buildTree, type TreeNode } from '../../lib/tree';
import type { ApiRequest, RequestDraft } from '../../types';
import { useWs } from './context';

function folderOptions(nodes: TreeNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) =>
    n.type === 'folder' ? [{ id: n.folder.id, label: `${'  '.repeat(depth)}${n.folder.name}` }, ...folderOptions(n.children, depth + 1)] : [],
  );
}

export function SaveRequestModal({ draft, onClose, onSaved }: { draft: RequestDraft; onClose: () => void; onSaved: (r: ApiRequest) => void }) {
  const { wsId } = useWs();
  const { data: collections } = useCollections(wsId);
  const [name, setName] = useState(draft.name === 'Untitled request' ? '' : draft.name);
  const [collectionId, setCollectionId] = useState('');
  const [folderId, setFolderId] = useState('');
  const { data: detail } = useCollection(collectionId || undefined);
  const create = useCreateRequest(wsId);

  useEffect(() => {
    if (!collectionId && collections?.length) setCollectionId(collections[0].id);
  }, [collections, collectionId]);

  const folders = detail ? folderOptions(buildTree(detail.folders, [])) : [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Save request"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !collectionId}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { collectionId, folderId: folderId || null, draft: { ...draft, name: name.trim() } },
                { onSuccess: onSaved },
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      {collections && collections.length === 0 ? (
        <p className="text-sm text-muted">Create a collection first, then save requests into it.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Request name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Get user profile" maxLength={200} />
          </Field>
          <Field label="Collection">
            <Select value={collectionId} onChange={(e) => { setCollectionId(e.target.value); setFolderId(''); }}>
              {collections?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Folder">
            <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">— Collection root —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.label.replace(/^ +/, (s) => '  '.repeat(s.length / 2))}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
