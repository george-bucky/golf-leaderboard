"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTeeTime = parseTeeTime;
function parseTeeTime(teeValue) {
    if (!teeValue) {
        return null;
    }
    const teeDate = new Date(teeValue);
    if (Number.isNaN(teeDate.getTime())) {
        return null;
    }
    return teeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
