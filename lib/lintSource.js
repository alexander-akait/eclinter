'use strict';

const path = require('path');

function createEmptyResult(filePath) {
    return {
        eclinter: {
            eclinterError: null
        },
        messages: [],
        source: filePath
    };
}

function lintResult(
    eclinter,
    fileInformation,
    config
) {
    fileInformation.eclinter = fileInformation.eclinter || {};
    fileInformation.eclinter.ruleSeverities = {};
    fileInformation.eclinter.customMessages = {};
    fileInformation.eclinter.quiet = config.quiet;

    eclinter._validator.validate(fileInformation.source);

    const validatorResult = eclinter._validator.getInvalidLines(fileInformation.source);

    if (validatorResult && Object.keys(validatorResult).length !== 0) {
        fileInformation.eclinter.eclinterError = true;

        Object.keys(validatorResult).forEach((line) => {
            const validatorLineMessages = validatorResult[line];

            validatorLineMessages.forEach((validatorMessage) => {
                fileInformation.messages.push({
                    column: null,
                    line: validatorMessage.line,
                    rule: validatorMessage.code,
                    severity: validatorMessage.type,
                    text: validatorMessage.message
                });
            });
        });
    }

    return Promise.resolve(fileInformation);
}

module.exports = (eclinter, inputOptions) => {
    const options = inputOptions || {};

    if (!options.filePath && typeof options.code === 'undefined') {
        return Promise.reject(new Error('You must provide filePath or code'));
    }

    const isCodeNotFile = typeof options.code !== 'undefined';

    const inputFilePath = isCodeNotFile ? options.codeFilename : options.filePath;

    if (typeof inputFilePath !== 'undefined' && !path.isAbsolute(inputFilePath)) {
        if (isCodeNotFile) {
            return Promise.reject(new Error('codeFilename must be an absolute path'));
        }

        return Promise.reject(new Error('filePath must be an absolute path'));
    }

    const getIsIgnored = eclinter.isPathIgnored(inputFilePath).catch((error) => {
        if (isCodeNotFile && error.code === 'ENOENT') {
            return false;
        }

        throw error;
    });

    return getIsIgnored
        .then((isIgnored) => {
            if (isIgnored) {
                const fileResult = createEmptyResult(inputFilePath);

                fileResult.eclinter = fileResult.eclinter || {};
                fileResult.eclinter.ignored = true;
                fileResult.standaloneIgnored = true;

                return fileResult;
            }

            const configSearchPath = eclinter._options.configFile || inputFilePath;

            const getConfig = eclinter.getConfigForFile(configSearchPath).catch((error) => {
                if (isCodeNotFile && error.code === 'ENOENT') {
                    return eclinter.getConfigForFile(process.cwd());
                }

                throw error;
            });

            return getConfig.then((result) => {
                const { config } = result;

                return eclinter
                    ._getFileInformation({
                        code: options.code,
                        codeFilename: options.codeFilename,
                        codeProcessors: config.codeProcessors,
                        filePath: inputFilePath
                    })
                    .then((fileResult) => lintResult(eclinter, fileResult, config).then(() => fileResult));
            });
    });
};
