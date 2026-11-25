import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useJoinWorkspace } from '../api/hooks';
import { errorMessage } from '../lib/api';
import { Button, Field, Input, Modal } from './ui';

/** Uppercases, drops anything that isn't a letter/digit and inserts the dash: "k7qmx2pd" → "K7QM-X2PD". */
export function formatJoinCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function JoinWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const join = useJoinWorkspace();
  const navigate = useNavigate();
  const complete = code.replace('-', '').length === 8;

  const submit = () => {
    if (!complete) return;
    setError(null);
    join.mutate(code, {
      onSuccess: (ws) => {
        toast.success(`Welcome to ${ws.name}`);
        onClose();
        navigate(`/w/${ws.id}`);
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Join a workspace"
      description="Enter the 8-character code a workspace admin shared with you."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<KeyRound />} disabled={!complete} loading={join.isPending} onClick={submit}>
            Join workspace
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Join code" error={error}>
          <Input
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(formatJoinCode(e.target.value));
              setError(null);
            }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            className="h-12 text-center font-mono text-xl tracking-[0.25em] uppercase"
          />
        </Field>
      </form>
    </Modal>
  );
}
