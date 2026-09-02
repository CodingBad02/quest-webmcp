import type { ConfirmContent, ConfirmFn, ConfirmOutcome } from '../types.ts';

const COPY = {
  review: { title: 'Send this to a reviewer?', body: 'A person checks this before it changes anything public. You can edit it again if it\'s sent back.', confirm: 'Send for review' },
  public: { title: 'Publish this change?', body: 'This writes to the public record now, under your account. A new edit can correct it later; nothing here can be quietly undone.', confirm: 'Publish' },
};

function dl(className: string, rows: [string, string][]): HTMLDListElement {
  const el = document.createElement('dl');
  el.className = className;
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    el.append(dt, dd);
  }
  return el;
}

/**
 * Default confirmation UI: a native `<dialog class="qt qt-confirm">` per request, DESIGN.md §5a/§6 markup and copy.
 * Every value is a text node. Focus returns to where it was.
 * ponytail: light DOM; move behind a shadow root only if a host stylesheet breaks the dialog.
 */
export function createDialogConfirm(root: () => HTMLElement = () => document.body): ConfirmFn {
  return (content: ConfirmContent, { signal, timeoutMs }) => new Promise<ConfirmOutcome>((resolve) => {
    const mode = content.mode ?? 'review';
    const copy = COPY[mode];
    const returnFocus = document.activeElement as HTMLElement | null;

    const dialog = document.createElement('dialog');
    dialog.className = 'qt qt-confirm';
    dialog.setAttribute('aria-labelledby', 'qt-confirm-title');
    const h = document.createElement('h2'); h.className = 'qt-confirm-title'; h.id = 'qt-confirm-title'; h.textContent = copy.title;
    const body = document.createElement('p'); body.className = 'qt-confirm-body'; body.textContent = copy.body;
    const note = document.createElement('p'); note.className = 'qt-confirm-note';
    note.textContent = `This closes on its own if you wait ${Math.round(timeoutMs / 1000)} seconds. Nothing is sent until you choose.`;
    const actions = document.createElement('div'); actions.className = 'qt-confirm-actions';
    const keep = document.createElement('button'); keep.className = 'qt-btn'; keep.type = 'button'; keep.value = 'cancel'; keep.textContent = 'Keep editing';
    const go = document.createElement('button'); go.className = 'qt-btn qt-btn-primary'; go.type = 'button'; go.value = 'confirm'; go.textContent = copy.confirm;
    actions.append(keep, go);
    dialog.append(
      h,
      dl('qt-confirm-summary', content.summary),
      dl('qt-confirm-meta', [['Destination', content.destination], ['Visibility', content.visibility], ['License', content.license]]),
      body, note, actions,
    );

    let done = false;
    const finish = (outcome: ConfirmOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      if (dialog.open) dialog.close();
      dialog.remove();
      returnFocus?.focus();
      resolve(outcome);
    };
    const onAbort = () => finish('cancelled');
    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    keep.addEventListener('click', () => finish('declined'));
    go.addEventListener('click', () => finish('confirmed'));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish('declined'); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) finish('declined'); });
    signal.addEventListener('abort', onAbort);
    if (signal.aborted) return finish('cancelled');

    root().appendChild(dialog);
    dialog.showModal();
    keep.focus();
  });
}
