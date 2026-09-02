import type { QuestToolsController, RackItem } from '../types.ts';

const TAG: Partial<Record<RackItem['status'], string>> = { new: 'New', executing: 'Running' };

function describe(r: RackItem): string {
  if (r.status === 'locked') return r.reason ?? 'Locked.';
  if (r.status === 'removing') return 'No longer needed.';
  if (r.status === 'executing') return `Running ${r.name}…`;
  return r.description;
}

/** Renders DESIGN.md §5a markup into `container` and keeps it in sync. Returns an unmount function. */
export function mountRack(container: HTMLElement, controller: QuestToolsController, opts: { title?: string; emptyText?: string } = {}) {
  container.classList.add('qt', 'qt-rack');
  container.setAttribute('aria-label', 'Agent tools');
  container.innerHTML = `
    <h2 class="qt-rack-title"></h2>
    <p class="qt-rack-runtime"></p>
    <ul class="qt-rack-list" aria-live="polite"></ul>
    <p class="qt-rack-empty" hidden></p>`;
  container.querySelector('.qt-rack-title')!.textContent = opts.title ?? 'Tools available now';
  container.querySelector('.qt-rack-runtime')!.textContent = controller.runtime();
  const list = container.querySelector<HTMLUListElement>('.qt-rack-list')!;
  const empty = container.querySelector<HTMLParagraphElement>('.qt-rack-empty')!;
  empty.textContent = opts.emptyText ?? 'No tools right now.';

  const rows = new Map<string, HTMLLIElement>();

  function render() {
    const items = controller.getRack();
    const seen = new Set<string>();
    for (const r of items) {
      seen.add(r.name);
      let li = rows.get(r.name);
      if (!li) {
        li = document.createElement('li');
        li.className = 'qt-tool';
        li.tabIndex = 0;
        li.innerHTML = '<span class="qt-tool-dot" aria-hidden="true"></span><span class="qt-tool-name"></span><span class="qt-tool-tag" hidden></span><span class="qt-tool-desc"></span>';
        li.querySelector('.qt-tool-name')!.textContent = r.name;
        rows.set(r.name, li);
      }
      li.dataset.state = r.status;
      li.setAttribute('aria-label', `${r.name}: ${r.status}${r.reason ? `. ${r.reason}` : ''}`);
      const tag = li.querySelector<HTMLElement>('.qt-tool-tag')!;
      tag.hidden = !TAG[r.status];
      tag.textContent = TAG[r.status] ?? '';
      li.querySelector('.qt-tool-desc')!.textContent = describe(r);
      list.appendChild(li); // appendChild moves existing nodes, so order follows `items`
    }
    for (const [name, li] of rows) if (!seen.has(name)) { li.remove(); rows.delete(name); }
    empty.hidden = items.length > 0;
  }

  render();
  const unsubscribe = controller.subscribe(render);
  return () => { unsubscribe(); container.replaceChildren(); };
}
