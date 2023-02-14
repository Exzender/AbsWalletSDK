"use strict";
const core = require('./core');

const sdk = function (options) {
    // this = ...c;
    const { apiKey, url, ignoreSsl } = options;

    core.init(apiKey, url, ignoreSsl);

    return core;
}

module.exports = sdk;