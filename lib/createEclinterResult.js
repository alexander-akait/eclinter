'use strict';

const _ = require('lodash');

module.exports = (eclinter, fileResult, filePath) => {
    const { source } = fileResult;

    // Strip out deprecation warnings from the messages
    const deprecationMessages = _.remove(
        fileResult.messages,
        {
            eclinterType: 'deprecation'
        }
    );
    const deprecations = deprecationMessages.map((deprecationMessage) => ({
        reference: deprecationMessage.eclinterReference,
        text: deprecationMessage.text
    }));

    // Also strip out invalid options
    const invalidOptionMessages = _.remove(
        fileResult.messages,
        {
            eclinterType: 'invalidOption'
        }
    );
    const invalidOptionWarnings = invalidOptionMessages.map((invalidOptionMessage) => ({
        text: invalidOptionMessage.text
    }));

    // This defines the eclinter result object that formatters receive
    let eclinterResult = {
        _fileResult: fileResult,
        deprecations,
        errored: fileResult.eclinter.eclinterError,
        ignored: fileResult.eclinter.ignored,
        invalidOptionWarnings,
        source,
        warnings: fileResult.messages.map((message) => ({
            column: message.column,
            line: message.line,
            rule: message.rule,
            severity: message.severity,
            text: message.text
        }))
    };

    return eclinter.getConfigForFile(filePath).then((result) => {
        const { config } = result;

        if (config.resultProcessors) {
            config.resultProcessors.forEach((resultProcessor) => {
                // Result processors might just mutate the result object,
                // or might return a new one
                const returned = resultProcessor(fileResult, source);

                if (returned) {
                    eclinterResult = returned;
                }
            });
        }

        return eclinterResult;
    });
};
