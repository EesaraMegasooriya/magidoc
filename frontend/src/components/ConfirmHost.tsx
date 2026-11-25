import { useEffect, useState } from 'react';
import { useConfirm, usePrompt } from '../store/confirm';
import { Button, Field, Input, Modal } from './ui';

export function ConfirmHost() {
  const { current, close } = useConfirm();
  return (
    <>
      <Modal
        open={!!current}
        onClose={() => close(false)}
        title={current?.title ?? ''}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={current?.danger ? 'danger-solid' : 'primary'} onClick={() => close(true)} autoFocus>
              {current?.confirmText ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {current?.message && <p className="text-sm text-muted">{current.message}</p>}
      </Modal>
      <PromptHost />
    </>
  );
}

function PromptHost() {
  const { current, close } = usePrompt();
  const [value, setValue] = useState('');
  useEffect(() => setValue(current?.initial ?? ''), [current]);
  const submit = () => close(value.trim() ? value.trim() : null);
  return (
    <Modal
      open={!!current}
      onClose={() => close(null)}
      title={current?.title ?? ''}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!value.trim()} onClick={submit}>
            {current?.confirmText ?? 'Save'}
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
        <Field label={current?.label ?? 'Name'}>
          <Input autoFocus value={value} placeholder={current?.placeholder} maxLength={200} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} />
        </Field>
      </form>
    </Modal>
  );
}
