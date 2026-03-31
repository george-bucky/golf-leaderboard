"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDetailContent = showDetailContent;
exports.openDetailOverlay = openDetailOverlay;
exports.closeDetailOverlay = closeDetailOverlay;
function showDetailContent(widgets, content) {
    const payload = typeof content === 'object' ? content : { header: '', body: `${content}` };
    widgets.detailHeaderBox.setContent(payload.header || '');
    widgets.detailContentBox.setContent(payload.body || '');
    widgets.detailContentBox.setScroll(0);
}
function openDetailOverlay(widgets, state) {
    if (state.detailViewOpen)
        return;
    state.detailViewOpen = true;
    widgets.topInfoBar.hide();
    widgets.table.hide();
    widgets.scorecardBox.hide();
    widgets.detailBox.show();
    widgets.detailContentBox.focus();
}
function closeDetailOverlay(widgets, state) {
    if (!state.detailViewOpen)
        return;
    state.detailViewOpen = false;
    widgets.detailBox.hide();
    widgets.topInfoBar.show();
    widgets.table.show();
    widgets.table.focus();
}
