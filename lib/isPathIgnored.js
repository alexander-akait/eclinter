'use strict';

const ignore = require('ignore');
const micromatch = require('micromatch');
const path = require('path');
const pify = require('pify');
const isBinaryFile = require('isbinaryfile');

const alwaysIgnoredGlobs = [
    '**/node_modules/**',
    '**/bower_components/**'
];

module.exports = (eclinter, filePathArg) => {
    const filePath = filePathArg;

    if (!filePath) {
        return Promise.resolve(false);
    }

    return eclinter
        .getConfigForFile(filePath)
        .then((result) => {
            const { config } = result;
            const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
            const ignoreFiles = alwaysIgnoredGlobs.concat(config.ignoreFiles || []);

            if (micromatch(absoluteFilePath, ignoreFiles).length !== 0) {
                return true;
            }

            const ignorePatternsFilter = ignore().add(config.ignorePatterns).createFilter();
            const filepathRelativeToCwd = path.relative(process.cwd(), filePath);

            if (ignorePatternsFilter && !ignorePatternsFilter(filepathRelativeToCwd)) {
                return true;
            }

            return false;
        })
        .then((isIgnored) => {
            if (!isIgnored) {
                return pify(isBinaryFile)(filePath).then((result) => result);
            }

            return isIgnored;
        });
};
