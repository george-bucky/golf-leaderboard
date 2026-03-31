"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearEventSelectorCards = clearEventSelectorCards;
exports.moveEventSelectorSelection = moveEventSelectorSelection;
exports.renderEventSelector = renderEventSelector;
exports.selectorStatusLabel = selectorStatusLabel;
const blessed_1 = __importDefault(require("blessed"));
const text_1 = require("../utils/text");
function clearEventSelectorCards(state) {
    state.eventSelectorCards.forEach((card) => {
        if (card && typeof card.detach === 'function') {
            card.detach();
        }
    });
    state.eventSelectorCards = [];
    state.eventSelectorCardLayoutKey = '';
}
function moveEventSelectorSelection(widgets, state, nextIndex) {
    if (!state.eventSelectorOpen || !state.eventSelectorOptions.length || state.detailViewOpen || state.isLoadingEventSelector) {
        return;
    }
    const clampedIndex = Math.max(0, Math.min(state.eventSelectorOptions.length - 1, nextIndex));
    if (clampedIndex === state.selectedEventSelectorIndex) {
        return;
    }
    const previousIndex = state.selectedEventSelectorIndex;
    state.selectedEventSelectorIndex = clampedIndex;
    updateEventSelectorCard(widgets, state, previousIndex);
    updateEventSelectorCard(widgets, state, state.selectedEventSelectorIndex);
    syncEventSelectorScroll(widgets, state);
    widgets.screen.render();
}
function renderEventSelector(widgets, state) {
    if (!widgets.eventSelectorBox || !state.eventSelectorOpen) {
        return;
    }
    if (state.isLoadingEventSelector && !state.eventSelectorOptions.length) {
        clearEventSelectorCards(state);
        widgets.eventSelectorBox.setContent('Loading live events...');
        widgets.eventSelectorBox.setScroll(0);
        return;
    }
    if (!state.eventSelectorOptions.length) {
        clearEventSelectorCards(state);
        widgets.eventSelectorBox.setContent('No golf events available right now.\nPress ` to try again.');
        widgets.eventSelectorBox.setScroll(0);
        return;
    }
    widgets.eventSelectorBox.setContent('');
    const layout = getEventSelectorLayout(widgets);
    const layoutKey = [layout.columns, layout.cardWidth, layout.cardHeight, state.eventSelectorOptions.length].join(':');
    state.eventSelectorGridColumns = layout.columns;
    if (layoutKey !== state.eventSelectorCardLayoutKey) {
        clearEventSelectorCards(state);
        state.eventSelectorCardLayoutKey = layoutKey;
    }
    state.eventSelectorOptions.forEach((_option, index) => {
        if (!state.eventSelectorCards[index]) {
            const card = blessed_1.default.box({
                parent: widgets.eventSelectorBox,
                tags: true,
                border: { type: 'line' },
                style: { fg: 'white', border: { fg: 'gray' } },
                padding: { top: 0, left: 1, right: 1, bottom: 0 },
                content: ''
            });
            card.on('click', () => {
                const previousIndex = state.selectedEventSelectorIndex;
                state.selectedEventSelectorIndex = index;
                updateEventSelectorCard(widgets, state, previousIndex);
                updateEventSelectorCard(widgets, state, state.selectedEventSelectorIndex);
                syncEventSelectorScroll(widgets, state);
                widgets.screen.render();
            });
            state.eventSelectorCards[index] = card;
        }
        updateEventSelectorCard(widgets, state, index, layout);
    });
    syncEventSelectorScroll(widgets, state);
}
function selectorStatusLabel(status) {
    const text = `${status || ''}`.toLowerCase();
    if (text === 'in' || text === 'live')
        return 'LIVE';
    if (text === 'pre')
        return 'UP NEXT';
    if (text === 'post')
        return 'FINAL';
    return (text || '--').toUpperCase();
}
function updateEventSelectorCard(widgets, state, index, layout) {
    const option = state.eventSelectorOptions[index];
    const card = state.eventSelectorCards[index];
    if (!option || !card)
        return;
    const activeLayout = layout || getEventSelectorLayout(widgets);
    const row = Math.floor(index / activeLayout.columns);
    const col = index % activeLayout.columns;
    const selected = index === state.selectedEventSelectorIndex;
    const roundText = option.currentRound ? `Round ${option.currentRound}` : 'Round --';
    const lineMax = Math.max(20, activeLayout.cardWidth - 4);
    const lineOne = (0, text_1.truncateText)(`${selectorStatusLabel(option.status)} | ${option.tourName} | ${option.name} | ${roundText}`, lineMax);
    const lineTwo = (0, text_1.truncateText)(`Leader: ${option.leaderText} | Course: ${option.courseName || '--'}`, lineMax);
    card.top = row * (activeLayout.cardHeight + activeLayout.cardGapY);
    card.left = col * (activeLayout.cardWidth + activeLayout.cardGapX);
    card.width = activeLayout.cardWidth;
    card.height = activeLayout.cardHeight;
    card.border.fg = selected ? 'green' : 'gray';
    card.style.border.fg = selected ? 'green' : 'gray';
    card.setContent(selected ? `{bold}${lineOne}{/bold}\n${lineTwo}` : `${lineOne}\n${lineTwo}`);
}
function getEventSelectorLayout(widgets) {
    const boxWidth = widgets.eventSelectorBox.width && Number(widgets.eventSelectorBox.width) > 0 ? Number(widgets.eventSelectorBox.width) : 100;
    const contentWidth = Math.max(40, boxWidth - 4);
    const cardMinWidth = 54;
    const cardGapX = 1;
    const cardGapY = 1;
    const cardHeight = 5;
    const columns = Math.max(1, Math.floor((contentWidth + cardGapX) / (cardMinWidth + cardGapX)));
    const cardWidth = Math.max(40, Math.floor((contentWidth - ((columns - 1) * cardGapX)) / columns));
    return { columns, cardWidth, cardHeight, cardGapX, cardGapY };
}
function syncEventSelectorScroll(widgets, state) {
    if (!widgets.eventSelectorBox || !state.eventSelectorOptions.length)
        return;
    const boxHeight = widgets.eventSelectorBox.height && Number(widgets.eventSelectorBox.height) > 0 ? Number(widgets.eventSelectorBox.height) : 24;
    const layout = getEventSelectorLayout(widgets);
    const selectedRow = Math.floor(state.selectedEventSelectorIndex / layout.columns);
    const selectedTop = selectedRow * (layout.cardHeight + layout.cardGapY);
    const selectedBottom = selectedTop + layout.cardHeight;
    const viewHeight = Math.max(6, boxHeight - 2);
    const currentScroll = widgets.eventSelectorBox.getScroll ? widgets.eventSelectorBox.getScroll() : 0;
    if (selectedTop < currentScroll) {
        widgets.eventSelectorBox.setScroll(selectedTop);
    }
    else if (selectedBottom > currentScroll + viewHeight) {
        widgets.eventSelectorBox.setScroll(selectedBottom - viewHeight);
    }
}
