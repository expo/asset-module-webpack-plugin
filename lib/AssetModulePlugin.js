'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var DEFAULT_FILE_SYSTEM_SYMBOL = Symbol('DefaultFileSystem');

class AssetModulePlugin {

  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    var _this = this;

    compiler.plugin('compilation', function (compilation, parameters) {
      var addedResources = new Set();
      compilation._modulesToEmit = [];
      compilation.plugin('succeed-module', function (module) {
        var resource = module.resource;

        if (addedResources.has(resource) || !_this._shouldEmit(module)) {
          return;
        }
        addedResources.add(resource);
        compilation._modulesToEmit.push(module);
      });
    });

    compiler.plugin('after-emit', function (compilation, callback) {
      Promise.all(compilation._modulesToEmit.map(function (module) {
        return _this._emitAssetModule(compiler, compilation, module);
      })).then(function (result) {
        callback(null, result);
      }, function (error) {
        console.warn(error.stack);
        callback(error);
      });
    });
  }

  _emitAssetModule(compiler, compilation, module) {
    var _this2 = this;

    var _options = this.options;
    var sourceBase = _options.sourceBase;
    var destinationBase = _options.destinationBase;
    var resource = module.resource;

    var relativePath = _path2.default.relative(sourceBase, resource);
    var destinationPath = _path2.default.resolve(destinationBase, relativePath);
    if (resource === destinationPath) {
      var message = `Destination path for ${ resource } matches the source path; skipping instead of overwriting the file`;
      compilation.warnings.push(new Error(message));
      return Promise.resolve(null);
    }

    var source = this._getAssetModuleSource(compilation, module);

    if (!this.options.fileSystems) {
      var fileSystem = compiler.outputFileSystem;
      return this._writeFile(destinationPath, source, fileSystem);
    }

    var fileSystems = this.options.fileSystems.map(function (fileSystem) {
      if (fileSystem === DEFAULT_FILE_SYSTEM_SYMBOL) {
        return compiler.outputFileSystem;
      }
      return fileSystem;
    });

    var promises = fileSystems.map(function (fileSystem) {
      return _this2._writeFile(destinationPath, source, fileSystem).catch(function (error) {
        compilation.errors.push(error);
        throw error;
      });
    });
    return Promise.all(promises);
  }

  _getAssetModuleSource(compilation, module) {
    var _options2 = this.options;
    var sourceBase = _options2.sourceBase;
    var destinationBase = _options2.destinationBase;
    var resource = module.resource;
    var assets = module.assets;

    var publicPath = compilation.mainTemplate.getPublicPath({
      hash: compilation.hash
    });

    var assetFilename;
    var assetFilenames = Object.keys(assets);
    if (assetFilenames.length === 0) {
      assetFilename = _path2.default.relative(sourceBase, resource);
    } else {
      if (assetFilenames.length > 1) {
        var message = `Module at ${ resource } generated more than one asset; using the first one`;
        compilation.warnings.push(new Error(message));
      }
      assetFilename = assetFilenames[0];
    }

    var fullAssetPath = publicPath + assetFilename;
    return `module.exports = ${ JSON.stringify(fullAssetPath) };\n`;
  }

  _writeFile(filename, content, fileSystem) {
    var makeDirectories = this._getMakeDirectoriesFunction(fileSystem);
    return new Promise(function (resolve, reject) {
      makeDirectories(_path2.default.dirname(filename), function (error) {
        if (error) {
          reject(error);
          return;
        }

        fileSystem.writeFile(filename, content, function (error) {
          if (error) {
            reject(error);
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  _getMakeDirectoriesFunction(fileSystem) {
    if (fileSystem.mkdirp) {
      return fileSystem.mkdirp.bind(fileSystem);
    }
    return function (path, callback) {
      return (0, _mkdirp2.default)(path, { fs: fileSystem }, callback);
    };
  }

  _shouldEmit(module) {
    var _options3 = this.options;
    var test = _options3.test;
    var include = _options3.include;
    var exclude = _options3.exclude;
    var resource = module.resource;

    if (test && !this._matches(test, resource)) {
      return false;
    }
    if (include && !this._matches(include, resource)) {
      return false;
    }
    if (exclude && this._matches(exclude, resource)) {
      return false;
    }

    return true;
  }

  _matches(pattern, string) {
    if (pattern instanceof RegExp) {
      return pattern.test(string);
    }

    if (typeof pattern === 'string') {
      var escapedPattern = '^' + pattern.replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&');
      var regex = new RegExp(escapedPattern);
      return regex.test(string);
    }

    if (typeof pattern === 'function') {
      return pattern(string);
    }

    throw new Error(`Unsupported pattern: ${ pattern }`);
  }
}

AssetModulePlugin.DefaultFileSystem = DEFAULT_FILE_SYSTEM_SYMBOL;

exports.default = AssetModulePlugin;
module.exports = exports.default;

/**
 * The base directory of the source assets. This is the portion of the asset
 * path that will be replaced with the destination base directory.
 *
 * For example, if `sourceBase` is `'src/web'` and `destinationBase` is
 * `'build/web'`, then an asset at `src/web/assets/icon.png` would produce a
 * module at `build/web/assets/icon.png`.
 *
 * The source assets don't need to reside in the source base directory. This
 * plugin computes the relative path from the source base directory to each
 * asset and applies the same relative path to the destination base directory.
 * For example, with the previous example's configuration, an asset at
 * `src/favicons/favicon.png` would result in a module at
 * `build/favicons/favicon.png`.
 */

/**
 * The base directory of the emitted modules. See the documentation for
 * `sourceBase`.
 */

/**
 * A test applied to each asset's resource path to determine if this plugin
 * should emit a module for the asset. The test can be any of the types that
 * webpack's loader patterns support.
 */

/**
 * A test applied to each asset's resource path to determine if this plugin
 * should emit a module for the asset.
 */

/**
 * A test applied to each asset's resource path to determine if this plugin
 * should not emit a module for the asset.
 */

/**
 * Overrides the file systems used to write the emitted modules. By default,
 * the plugin writes to the compiler's `outputFileSystem`, but you may want
 * to write the modules to another file system as well.
 *
 * Specify `AssetModulePlugin.DefaultFileSystem` in the array to write to the
 * compiler's `outputFileSystem`.
 */