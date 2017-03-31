'use strict';

const fs = require('fs');

function readFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (error, content) => {
            if (error) {
                return reject(error);
            }

            return resolve(content);
        });
    });
}

module.exports = function (eclinter, options) {
    let getCode = null;

    if (typeof options.code !== 'undefined') {
        getCode = Promise.resolve(options.code);
    } else if (options.filePath) {
        getCode = readFile(options.filePath);
    }

    if (!getCode) {
        throw new Error('code or filePath required');
    }

    return getCode
        .then((code) => {
            const fileInformation = {
                messages: []
            };

            fileInformation.source = options.filePath;

            const source = options.code ? options.codeFilename : options.filePath;

            let preProcessedCode = code;

            if (options.codeProcessors) {
                options.codeProcessors.forEach((codeProcessor) => {
                    preProcessedCode = codeProcessor(preProcessedCode, source);
                });
            }

            fileInformation.contents = preProcessedCode;

            return Promise.resolve(fileInformation);
        });
};
