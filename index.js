'use strict';

let app;

try {
  app = require('./dist/index.js');
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    throw new Error('Built app files are missing. Run `npm run build` before launching the app.');
  }
  throw error;
}

if (require.main === module) {
  app.main();
}

module.exports = app;
