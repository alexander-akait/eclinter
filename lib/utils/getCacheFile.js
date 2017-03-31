'use strict';

const hash = require('./hash');
const path = require('path');
const fs = require('fs');

/**
 * Return the cacheFile to be used by stylelint, based on whether the provided parameter is
 * a directory or looks like a directory (ends in `path.sep`), in which case the file
 * name will be `cacheFile/.cache_hashOfCWD`.
 *
 * If cacheFile points to a file or looks like a file, then it will just use that file.
 *
 * @param {string} nameCacheFile - The name of file to be used to store the cache
 * @param {string} cwd - Current working directory. Used for tests
 * @returns {string} Resolved path to the cache file
 */
module.exports = function getCacheFile(nameCacheFile, cwd) {
    /*
     * Make sure path separators are normalized for environment/os.
     * Also, keep trailing path separator if present.
     */
    const cacheFile = path.normalize(nameCacheFile);

    const resolvedCacheFile = path.resolve(cwd, cacheFile);
    // If the last character passed is a path separator, we assume is a directory.
    const looksLikeADirectory = cacheFile[cacheFile.length - 1] === path.sep;

    /**
     * Return the default cache file name when provided parameter is a directory.
     * @returns {string} - Resolved path to the cacheFile
     */
    function getCacheFileForDirectory() {
        return path.join(resolvedCacheFile, `.eclintercache_${hash(cwd)}`);
    }

    let fileStats = null;

    try {
        // eslint-disable-next-line no-sync
        fileStats = fs.lstatSync(resolvedCacheFile);
    } catch (error) { // eslint-disable-line no-unused-vars
        fileStats = null;
    }

    if (looksLikeADirectory || (fileStats && fileStats.isDirectory())) {
        // Return path to provided directory with generated file name.
        return getCacheFileForDirectory();
    }

    // Return normalized path to cache file.
    return resolvedCacheFile;
};
