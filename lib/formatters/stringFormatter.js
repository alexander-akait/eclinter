'use strict';

const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const stringWidth = require('string-width');
const symbols = require('log-symbols');
const table = require('table');

const MARGIN_WIDTHS = 9;

const levelColors = {
    error: 'red',
    info: 'blue',
    warning: 'yellow'
};

function deprecationsFormatter(results) {
    const allDeprecationWarnings = _.flatMap(results, 'deprecations');
    const uniqueDeprecationWarnings = _.uniqBy(allDeprecationWarnings, 'text');

    if (!uniqueDeprecationWarnings || uniqueDeprecationWarnings.length === 0) {
        return '';
    }

    return uniqueDeprecationWarnings.reduce((reduceOutput, warning) => {
        let output = reduceOutput;

        output += chalk.yellow('Deprecation Warning: ');
        output += warning.text;

        if (warning.reference) {
            output += chalk.dim(' See: ');
            output += chalk.dim.underline(warning.reference);
        }

        return `${output}\n`;
    }, '\n');
}

function invalidOptionsFormatter(results) {
    const allInvalidOptionWarnings = _.flatMap(
        results,
        (result) => result.invalidOptionWarnings.map((warning) => warning.text)
    );
    const uniqueInvalidOptionWarnings = _.uniq(allInvalidOptionWarnings);

    return uniqueInvalidOptionWarnings.reduce((reduceOutput, warning) => {
        let output = reduceOutput;

        output += chalk.red('Invalid Option: ');
        output += warning;

        return `${output}\n`;
    }, '\n');
}

function logFrom(fromValue) {
    if (fromValue.charAt(0) === '<') {
        return fromValue;
    }

    return path.relative(process.cwd(), fromValue).split(path.sep).join('/');
}

function getMessageWidth(columnWidths) {
    if (!process.stdout.isTTY) {
        return columnWidths[3];
    }

    const availableWidth = process.stdout.columns < 80 ? 80 : process.stdout.columns;
    const fullWidth = _.sum(_.values(columnWidths));

    // If there is no reason to wrap the text, we won't align the last column to the right
    if (availableWidth > fullWidth + MARGIN_WIDTHS) {
        return columnWidths[3];
    }

    return availableWidth - (fullWidth - columnWidths[3] + MARGIN_WIDTHS);
}

function formatter(messages, source) {
    if (messages.length === 0) {
        return '';
    }

    const orderedMessages = _.sortBy(
        messages,
        // eslint-disable-next-line no-extra-parens
        (m) => (m.line ? 2 : 1), // positionless first
        (m) => m.line, (m) => m.column
    );

    // Create a list of column widths, needed to calculate
    // the size of the message column and if needed wrap it.
    const columnWidths = {
        0: 1,
        1: 1,
        2: 1,
        3: 1,
        4: 1
    };

    const calculateWidths = (columns) => {
        _.forOwn(columns, (value, key) => {
            const normalisedValue = value ? value.toString() : value;

            columnWidths[key] = Math.max(columnWidths[key], stringWidth(normalisedValue));
        });

        return columns;
    };

    let output = '\n';

    if (source) {
        output += `${chalk.underline(logFrom(source))}\n`;
    }

    const cleanedMessages = orderedMessages.map((message) => {
        const location = message;
        const { severity } = message;
        const row = [
            location.line || '',
            location.column || '',
            symbols[severity] ? chalk[levelColors[severity]](symbols[severity]) : severity,
            message.text
                // Remove all control characters (newline, tab and etc)
                .replace(/[\x01-\x1A]+/g, ' ') // eslint-disable-line no-control-regex, unicorn/no-hex-escape
                .replace(/\.$/, '')
                .replace(
                    new RegExp(`${_.escapeRegExp(`(${message.rule})`)}$`),
                    ''
                ),
            chalk.dim(message.rule || '')
        ];

        calculateWidths(row);

        return row;
    });

    output += table.table(cleanedMessages, {
        border: table.getBorderCharacters('void'),
        columns: {
            0: {
                alignment: 'right',
                paddingRight: 0,
                width: columnWidths[0]
            },
            1: {
                alignment: 'left',
                width: columnWidths[1]
            },
            2: {
                alignment: 'center',
                width: columnWidths[2]
            },
            3: {
                alignment: 'left',
                width: getMessageWidth(columnWidths),
                wrapWord: true
            },
            4: {
                alignment: 'left',
                paddingRight: 0,
                width: columnWidths[4]
            }
        },
        drawHorizontalLine: () => false
    }).split('\n').map((el) => el.replace(/(\d+)\s+(\d+)/, (m, p1, p2) => chalk.dim(`${p1}:${p2}`))).join('\n');

    return output;
}

module.exports = (results) => {
    let output = invalidOptionsFormatter(results);

    output += deprecationsFormatter(results);

    output = results.reduce((reduceOutput, result) => {
        let resultOutput = reduceOutput;

        resultOutput += formatter(result.warnings, result.source);

        return resultOutput;
    }, output);

    // Ensure consistent padding
    output = output.trim();

    if (output !== '') {
        output = `\n${output}\n\n`;
    }

    return output;
};
