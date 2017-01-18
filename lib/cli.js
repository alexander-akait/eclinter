'use strict';

const meow = require('meow');
const path = require('path');
const getStdin = require('get-stdin');
const standalone = require('./standalone');

const minimistOptions = {
    alias: {
        /* eslint-disable id-length */
        aei: 'allow-empty-input',
        f: 'formatter',
        h: 'help',
        i: 'ignore-path',
        v: 'version'
        /* eslint-enable id-length */
    },
    boolean: [
        'allow-empty-input',
        'color',
        'help',
        'no-color',
        'version'
    ],
    default: {
        /* eslint-disable id-length */
        f: 'string'
        /* eslint-enable id-length */
    }
};

const meowOptions = {
    help: `
    Usage: eclinter [input] [options]

    Input: Files(s), glob(s), or nothing to use stdin.
        If an input argument is wrapped in quotation marks, it will be passed to
        node-glob for cross-platform glob support. node_modules and
        bower_components are always ignored. You can also pass no input and use
        stdin, instead.

    Options:

        -n, --newline

            Require newline at end of file

        -g, --guessindentation

            Tries to guess the indention of a line depending on previous lines.

        -b, --skiptrailingonblank

            Skip blank lines in trailingspaces check.

        -it, --trailingspacestoignores

            Ignore trailing spaces in ignores.

        -l, --maxnewlines <n>

            Specify max number of newlines between blocks.

        -t, --trailingspaces

            Tests for useless whitespaces (trailing whitespaces) at each lineending of all files.

        -d, --indentation <s>

            Check indentation is "tabs" or "spaces".

        -s, --spaces <n>

            Used in conjunction with -d to set number of spaces.

        -i, --ignores <items>

            Comma separated list of ignores built in ignores.

        -e, --editorconfig <s>

            Use editorconfig specified at this file path for settings.

        -o, --allowsBOM

            Sets the allowsBOM option to true.

        -v, --verbose

            Be verbose when processing files.

        --endOfLine <s>

            Check end of line is correct.

        --ignore-path, -i

            Path to a file containing patterns that describe files to ignore. The
            path can be absolute or relative to process.cwd(). By default, eclinter
            looks for .eclinterignore in process.cwd().

        --formatter, -f               [default: "string"]

            The output formatter: "json", "string" or "verbose".

        --color
        --no-color

            Force enabling/disabling of color.
            
        --allow-empty-input, -aei

            If no files match glob pattern, exits without throwing an error.
    `,
    pkg: '../package.json'
};

const cli = meow(meowOptions, minimistOptions);

let { formatter } = cli.flags;

if (cli.flags.customFormatter) {
    const customFormatter = path.isAbsolute(cli.flags.customFormatter)
        ? cli.flags.customFormatter
        : path.join(process.cwd(), cli.flags.customFormatter);

    formatter = require(customFormatter); // eslint-disable-line global-require, import/no-dynamic-require
}

const optionsBase = {
    formatter
};

if (cli.flags.newline) {
    optionsBase.newline = cli.flags.newline;
}

if (cli.flags.guessindentation) {
    optionsBase.guessindentation = cli.flags.guessindentation;
}

if (cli.flags.skiptrailingonblank) {
    optionsBase.skiptrailingonblank = cli.flags.skiptrailingonblank;
}

if (cli.flags.trailingspacestoignores) {
    optionsBase.trailingspacestoignores = cli.flags.trailingspacestoignores;
}

if (cli.flags.maxnewlines) {
    optionsBase.maxnewlines = cli.flags.maxnewlines;
}

if (cli.flags.trailingspaces) {
    optionsBase.trailingspaces = cli.flags.trailingspaces;
}

if (cli.flags.indentation) {
    optionsBase.indentation = cli.flags.indentation;
}

if (cli.flags.spaces) {
    optionsBase.spaces = cli.flags.spaces;
}

if (cli.flags.ignores) {
    optionsBase.ignores = cli.flags.ignores;
}

if (cli.flags.editorconfig) {
    optionsBase.editorconfig = cli.flags.editorconfig;
}

if (cli.flags.allowsBOM) {
    optionsBase.allowsBOM = cli.flags.allowsBOM;
}

if (cli.flags.verbose) {
    optionsBase.verbose = cli.flags.verbose;
}

if (cli.flags.endOfLine) {
    optionsBase.endOfLine = cli.flags.endOfLine;
}

if (cli.flags.ignorePath) {
    optionsBase.ignorePath = cli.flags.ignorePath;
}

if (cli.flags.allowEmptyInput) {
    optionsBase.allowEmptyInput = cli.flags.allowEmptyInput;
}

Promise
    .resolve()
    .then(() => {
        // Add input/code into options
        if (cli.input.length !== 0) {
            return Object.assign({}, optionsBase, {
                files: cli.input
            });
        }

        return getStdin().then((stdin) => Object.assign({}, optionsBase, {
            code: stdin
        }));
    })
    .then((options) => {
        if (!options.files && !options.code) {
            cli.showHelp();
        }

        return standalone(options);
    })
    .then((linted) => {
        if (!linted.output) {
            return linted;
        }

        process.stdout.write(linted.output);

        if (linted.errored) {
            process.exitCode = 2;
        }

        return linted;
    })
    .catch((error) => {
        console.log(error.stack); // eslint-disable-line no-console

        const exitCode = typeof error.code === 'number' ? error.code : 1;

        process.exit(exitCode); // eslint-disable-line no-process-exit
    });
