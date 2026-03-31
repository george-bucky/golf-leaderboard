"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchJson = fetchJson;
exports.fetchText = fetchText;
const node_https_1 = __importDefault(require("node:https"));
function fetchJson(sourceUrl) {
    return fetchText(sourceUrl).then((body) => JSON.parse(body));
}
function fetchText(sourceUrl) {
    return new Promise((resolve, reject) => {
        node_https_1.default.get(sourceUrl, (response) => {
            if (response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location) {
                response.resume();
                resolve(fetchText(response.headers.location));
                return;
            }
            if (response.statusCode && response.statusCode >= 400) {
                response.resume();
                reject(new Error(`Request failed with status ${response.statusCode}`));
                return;
            }
            let data = '';
            response.on('data', (chunk) => {
                data += chunk.toString('utf8');
            });
            response.on('end', () => resolve(data));
            response.on('error', reject);
        }).on('error', reject);
    });
}
