/**
 * @flow
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

class AssetModulePlugin {
  // options: Options;

  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    var _this = this;

    var options = this.options;
    compiler.plugin('after-emit', function (compilation, callback) {
      var sourceBase = options.sourceBase;
      var destinationBase = options.destinationBase;

      var emittedResources = new Set();
      compilation.modules.forEach(function (module) {
        var resource = module.resource;

        if (emittedResources.has(resource) || !_this._shouldEmit(module)) {
          return;
        }
        emittedResources.add(resource);

        var relativePath = _path2.default.relative(sourceBase, resource);
        var destinationPath = _path2.default.resolve(destinationBase, relativePath);

        var outputFileSystem = compiler.outputFileSystem;
        outputFileSystem.mkdirp(_path2.default.dirname(destinationPath), function (error) {
          if (error) {
            callback(error);
            return;
          }

          outputFileSystem.writeFile(destinationPath, module._source.source(), callback);
        });
      });
    });
  }

  _shouldEmit(module) {
    var _options = this.options;
    var test = _options.test;
    var include = _options.include;
    var exclude = _options.exclude;
    var resource = module.resource;

    if (test && !this._matches(test, resource)) {
      return false;
    }
    if (include && !this._matches(include, resource)) {
      return false;
    }
    if (exclude && !this._matches(exclude, resource)) {
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