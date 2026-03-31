import https from 'node:https';

export function fetchJson<T = any>(sourceUrl: string): Promise<T> {
  return fetchText(sourceUrl).then((body) => JSON.parse(body) as T);
}

export function fetchText(sourceUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(sourceUrl, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
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
