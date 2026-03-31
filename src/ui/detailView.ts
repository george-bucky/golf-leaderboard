import { AppState, DetailContent, Widgets } from '../types';

export function showDetailContent(widgets: Widgets, content: DetailContent | string): void {
  const payload = typeof content === 'object' ? content : { header: '', body: `${content}` };
  widgets.detailHeaderBox.setContent(payload.header || '');
  widgets.detailContentBox.setContent(payload.body || '');
  widgets.detailContentBox.setScroll(0);
}

export function openDetailOverlay(widgets: Widgets, state: AppState): void {
  if (state.detailViewOpen) return;
  state.detailViewOpen = true;
  widgets.topInfoBar.hide();
  widgets.table.hide();
  widgets.scorecardBox.hide();
  widgets.detailBox.show();
  widgets.detailContentBox.focus();
}

export function closeDetailOverlay(widgets: Widgets, state: AppState): void {
  if (!state.detailViewOpen) return;
  state.detailViewOpen = false;
  widgets.detailBox.hide();
  widgets.topInfoBar.show();
  widgets.table.show();
  widgets.table.focus();
}
