"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeName = normalizeName;
exports.truncateText = truncateText;
exports.padCell = padCell;
exports.padEndText = padEndText;
exports.padStartText = padStartText;
function normalizeName(name = '') {
    return name
        .toUpperCase()
        .replace(/\(A\)/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function truncateText(text, maxChars) {
    if (text.length <= maxChars) {
        return text;
    }
    if (maxChars <= 3) {
        return text.slice(0, maxChars);
    }
    return `${text.slice(0, maxChars - 3)}...`;
}
function padCell(value, width, align) {
    const text = `${value == null ? '--' : value}`;
    if (text.length >= width) {
        return text.slice(0, width);
    }
    const pad = ' '.repeat(width - text.length);
    return align === 'left' ? `${text}${pad}` : `${pad}${text}`;
}
function padEndText(value, width) {
    const text = `${value == null ? '' : value}`;
    if (text.length >= width) {
        return text.slice(0, width);
    }
    return `${text}${' '.repeat(width - text.length)}`;
}
function padStartText(value, width) {
    const text = `${value == null ? '' : value}`;
    if (text.length >= width) {
        return text.slice(0, width);
    }
    return `${' '.repeat(width - text.length)}${text}`;
}
