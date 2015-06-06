/**
 * @flow
 */
import path from 'path';

type Pattern = string | RegExp | ((value: string) => bool) | Array<Pattern>;

type Options = {
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
  sourceBase: string;
  /**
   * The base directory of the emitted modules. See the documentation for
   * `sourceBase`.
   */
  destinationBase: string;
  /**
   * A test applied to each asset's resource path to determine if this plugin
   * should emit a module for the asset. The test can be any of the types that
   * webpack's loader patterns support.
   */
  test: Pattern;
  /**
   * A test applied to each asset's resource path to determine if this plugin
   * should emit a module for the asset.
   */
  include: Pattern;
  /**
   * A test applied to each asset's resource path to determine if this plugin
   * should not emit a module for the asset.
   */
  exclude: Pattern;
};

class AssetModulePlugin {
  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  apply(compiler: any) {
    var options = this.options;
    compiler.plugin('after-emit', (compilation, callback) => {
      var { sourceBase, destinationBase } = options;

      var emittedResources = new Set();
      var promises = compilation.modules.map(module => {
        var { resource } = module;
        if (emittedResources.has(resource) || !this._shouldEmit(module)) {
          return;
        }
        emittedResources.add(resource);

        var relativePath = path.relative(sourceBase, resource);
        var destinationPath = path.resolve(destinationBase, relativePath);
        if (resource === destinationPath) {
          console.warn(`Destination path for ${resource} matches the source path; skipping instead of overwriting the file`);
          return;
        }

        var outputFileSystem = compiler.outputFileSystem;
        return new Promise((resolve, reject) => {
          outputFileSystem.mkdirp(path.dirname(destinationPath), error => {
            if (error) {
              reject(error);
              return;
            }

            var source = module._source.source();
            outputFileSystem.writeFile(destinationPath, source, error => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        });
      });

      Promise.all(promises).then(
        () => callback(),
        error => callback(error)
      );
    });
  }

  _shouldEmit(module: Object): bool {
    var { test, include, exclude } = this.options;
    var { resource } = module;

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

  _matches(pattern: Pattern, string: string): bool {
    if (pattern instanceof RegExp) {
      return pattern.test(string);
    }

    if (typeof pattern === 'string') {
      var escapedPattern =
        '^' + pattern.replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&');
      var regex = new RegExp(escapedPattern);
      return regex.test(string);
    }

    if (typeof pattern === 'function') {
      return pattern(string);
    }

    throw new Error(`Unsupported pattern: ${pattern}`);
  }
}

export default AssetModulePlugin;
