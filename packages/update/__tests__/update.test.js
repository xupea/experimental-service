'use strict';

const update = require('..');
const assert = require('assert').strict;

assert.strictEqual(update(), 'Hello from update');
console.info('update tests passed');
