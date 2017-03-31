'use strict';

const path = require('path');
const formatters = require('./formatters');
const createEclinter = require('./createEclinter');
const globby = require('globby');
const createThrottle = require('async-throttle');
const os = require('os');
const FileCache = require('./utils/FileCache');
const debug = require('debug')('eclinter:standalone');
const pkg = require('../package.json');
const hash = require('./utils/hash');

function handleError(error) {
    throw error;
}

module.exports = (options) => {
    const { formatter } = options;
    const { cacheLocation } = options;
    const useCache = options.cache || false;
    let fileCache = null;

    const startTime = Date.now();

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
        const returnValue = {
            errored,
            output: formatterFunction(eclinterResults),
            results: eclinterResults
        };

        if (useCache) {
            fileCache.reconcile();
        }

        debug(`Linting complete in ${Date.now() - startTime}ms`);

        return returnValue;
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

    if (useCache) {
        const stylelintVersion = pkg.version;
        // eslint-disable-next-line no-warning-comments
        // Todo config
        const hashOfConfig = hash(`${stylelintVersion}_${JSON.stringify({})}`);

        fileCache = new FileCache(cacheLocation, hashOfConfig);
    } else {
        // No need to calculate hash here, we just want to delete cache file.
        fileCache = new FileCache(cacheLocation);
        // Remove cache file if cache option is disabled
        fileCache.destroy();
    }

    const throttle = createThrottle(os.cpus().length);

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

            let absoluteFilePaths = filePaths.map(
                // eslint-disable-next-line no-extra-parens
                (filePath) => (!path.isAbsolute(filePath)
                    ? path.join(process.cwd(), filePath)
                    : path.normalize(filePath))
            );

            if (useCache) {
                absoluteFilePaths = absoluteFilePaths.filter(fileCache.hasFileChanged.bind(fileCache));
            }

            const getStylelintResults = absoluteFilePaths.map((absoluteFilepath) => throttle(() => {
                debug(`Processing ${absoluteFilepath}`);

                return eclinter._lintSource({
                    filePath: absoluteFilepath
                }).then((eclinterResult) => {
                    if (eclinterResult.eclinter.eclinterError && useCache) {
                        debug(`${absoluteFilepath} contains linting errors and will not be cached.`);
                        fileCache.removeEntry(absoluteFilepath);
                    }

                    return eclinter._createEclinterResult(eclinterResult, absoluteFilepath);
                }).catch(handleError);
            }));

            return Promise.all(getStylelintResults);
        })
        .then(prepareReturnValue);
};
