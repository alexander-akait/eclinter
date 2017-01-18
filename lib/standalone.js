'use strict';

const path = require('path');
const formatters = require('./formatters');
const createEclinter = require('./createEclinter');
const globby = require('globby');

function handleError(error) {
    throw error;
}

module.exports = (options) => {
    const { formatter } = options;

    const isValidCode = typeof options.code === 'string';

    if ((!options.files && !isValidCode) || (options.files && (options.code || isValidCode))) {
        throw new Error('You must pass eclinter a `files` glob or a `code` string, though not both');
    }

    let formatterFunction = null;

    if (typeof formatter === 'string') {
        formatterFunction = formatters[formatter];

        if (typeof formatterFunction === 'undefined') {
            return Promise.reject(
                new Error("You must use a valid formatter option: 'json', 'string', 'verbose', or a function")
            );
        }
    } else if (typeof formatter === 'function') {
        formatterFunction = formatter;
    } else {
        formatterFunction = formatters.json;
    }

    const eclinter = createEclinter(options);

    const prepareReturnValue = (eclinterResults) => {
        const errored = eclinterResults.some((result) => result.errored);

        return {
            errored,
            output: formatterFunction(eclinterResults),
            results: eclinterResults
        };
    };

    if (!options.files) {
        const absoluteCodeFilename = typeof options.codeFilename !== 'undefined'
            && !path.isAbsolute(options.codeFilename)
            ? path.join(process.cwd(), options.codeFilename)
            : options.codeFilename;

        return eclinter
            ._lintSource({
                code: options.code,
                codeFilename: absoluteCodeFilename
            })
            .then((eclinterResult) => eclinter._createEclinterResult(eclinterResult))
            .catch(handleError)
            .then((eclinterResult) => prepareReturnValue([eclinterResult]));
    }

    return globby(
        options.files,
        Object.assign(
            {},
            options,
            {
                nodir: true
            }
        )
    )
        .then((filePaths) => {
            if (filePaths.length === 0) {
                if (typeof options.allowEmptyInput === 'undefined' || !options.allowEmptyInput) {
                    const error = new Error('Files glob patterns specified did not match any files');

                    error.code = 80;
                    throw error;
                } else {
                    return Promise.all([]);
                }
            }

            const getEclinterResults = filePaths.map((filePath) => {
                const absoluteFilepath = !path.isAbsolute(filePath)
                    ? path.join(process.cwd(), filePath)
                    : filePath;

                return eclinter
                    ._lintSource({
                        filePath: absoluteFilepath
                    })
                    .then((eclinterResult) => eclinter._createEclinterResult(eclinterResult, filePath))
                    .catch(handleError);
            });

            return Promise.all(getEclinterResults);
        })
        .then(prepareReturnValue);
};
