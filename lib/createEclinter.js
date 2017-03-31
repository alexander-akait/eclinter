'use strict';

const _ = require('lodash');
const createEclinterResult = require('./createEclinterResult');
const getFileResult = require('./getFileResult');
const isPathIgnored = require('./isPathIgnored');
const lintSource = require('./lintSource');
const fs = require('fs');
const path = require('path');
const Validator = require('lintspaces');

const DEFAULT_IGNORE_FILENAME = '.eclinterignore';
const FILE_NOT_FOUND_ERROR_CODE = 'ENOENT';

function addIgnorePatterns(eclinter, config) {
    const ignoreFilePath = eclinter._options.ignorePath || DEFAULT_IGNORE_FILENAME;
    const absoluteIgnoreFilePath = path.isAbsolute(ignoreFilePath)
        ? ignoreFilePath
        : path.resolve(process.cwd(), ignoreFilePath);

    return new Promise((resolve, reject) => {
        fs.readFile(absoluteIgnoreFilePath, 'utf8', (error, data) => {
            if (error) {
                // If the file's not found, fine, we'll just
                // consider it an empty array of globs
                if (error.code === FILE_NOT_FOUND_ERROR_CODE) {
                    return resolve(config);
                }

                return reject(error);
            }
            // Add an ignorePatterns property to the config, containing the
            // .gitignore-patterned globs loaded from .eclinterignore
            const augmentedConfig = Object.assign({}, config);

            augmentedConfig.config.ignorePatterns = data;

            return resolve(augmentedConfig);
        });
    });
}

function resolveEditorConfig(editorConfigPath) {
    let resolvededitorConfigPath = editorConfigPath;

    if (resolvededitorConfigPath) {
        resolvededitorConfigPath = path.resolve(resolvededitorConfigPath);

        // eslint-disable-next-line no-sync
        if (!fs.existsSync(resolvededitorConfigPath)) {
            // eslint-disable-next-line no-console
            console.log('Error: Specified .editorconfig "%s" doesn\'t exist'.red, editorConfigPath);
            // eslint-disable-next-line no-process-exit
            process.exit(1);
        }

        return resolvededitorConfigPath;
    }

    resolvededitorConfigPath = path.join(path.resolve(process.cwd()), '.editorconfig');

    // eslint-disable-next-line no-sync
    if (fs.existsSync(resolvededitorConfigPath)) {
        return resolvededitorConfigPath;
    }

    return resolvededitorConfigPath;
}

function validator(options) {
    return new Validator({
        allowsBOM: options.allowsBOM,
        editorconfig: resolveEditorConfig(options.editorconfig),
        endOfLine: options.endOfLine,
        ignores: options.ignores || [
            'js-comments',
            'c-comments',
            'java-comments',
            'as-comments',
            'xml-comments',
            'html-comments',
            'python-comments',
            'ruby-comments',
            'applescript-comments'
        ],
        indentation: options.indentation,
        indentationGuess: options.guessindentation,
        newline: options.newline,
        newlineMaximum: options.maxnewlines,
        spaces: options.spaces,
        trailingspaces: options.trailingspaces,
        trailingspacesSkipBlanks: options.skiptrailingonblank,
        trailingspacesToIgnores: options.trailingspacesToIgnores,
        verbose: options.verbose
    });
}

module.exports = (inputOptions) => {
    const options = inputOptions || {};
    const eclinter = {
        _options: options
    };

    eclinter._validator = _.partial(validator, eclinter)(options);
    eclinter._createEclinterResult = _.partial(createEclinterResult, eclinter);
    eclinter._getFileInformation = _.partial(getFileResult, eclinter);
    eclinter._lintSource = _.partial(lintSource, eclinter);

    eclinter.getConfigForFile = _.partial(() => addIgnorePatterns(
        eclinter,
        {
            config: options
        }
    ), eclinter);
    eclinter.isPathIgnored = _.partial(isPathIgnored, eclinter);

    return eclinter;
};
