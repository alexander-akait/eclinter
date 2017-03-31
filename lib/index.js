'use strict';

const createEclinter = require('./createEclinter');
const formatters = require('./formatters');
const standalone = require('./standalone');

const api = {};

api.lint = standalone;
api.formatters = formatters;
api.createLinter = createEclinter;

module.exports = api;
