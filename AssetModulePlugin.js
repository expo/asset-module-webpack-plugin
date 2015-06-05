/**
 * @flow
 */
'use strict';

import path from 'path';

type Pattern = string | RegExp | (value: string) => bool | Array<Pattern>;

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
}

export default class AssetModulePlugin {
  constructor(options: Options) {
    this.options = options;
  }

  apply(compiler: any) {
    let options = this.options;
    this.plugin('after-emit', (compilation, callback) => {
      let { sourceBase, destinationBase } = options;

      let emittedResources = new Set();
      compilation.modules.forEach(module => {
        let { resource } = module;
        if (emittedResources.has(resource) || !this._shouldEmit(module)) {
          return;
        }
        emittedResources.add(resource);

        let relativePath = path.relative(sourceBase, resource);
        let destinationPath = path.resolve(destinationBase, relativePath);

        let outputFileSystem = compiler.outputFileSystem;
        outputFileSystem.mkdirp(path.dirname(destinationPath), error => {
          if (error) {
            callback(error);
            return;
          }

          outputFileSystem.writeFile(
            destinationPath,
            module._source.source(),
            callback
          );
        });
      });
    });
  }

  _shouldEmit(module: Object): bool {
    let { test, include, exclude } = this.options;
    let { resource } = module;

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

  _matches(pattern: Pattern, string: string): bool {
    if (pattern instanceof RegExp) {
      return pattern.test(string);
    }

    if (typeof pattern === 'string') {
      let escapedPattern =
        '^' + pattern.replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&');
      let regex = new RegExp(escapedPattern);
      return regex.test(string);
    }

    if (typeof pattern === 'function') {
      return pattern(string);
    }

    throw new Error(`Unsupported pattern: ${pattern}`);
  }
}
