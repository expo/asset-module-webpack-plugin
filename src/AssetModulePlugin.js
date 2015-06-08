/**
 * @flow
 */
import mkdirp from 'mkdirp';
import path from 'path';

var DEFAULT_FILE_SYSTEM_SYMBOL = Symbol('DefaultFileSystem');

type Pattern = string | RegExp | ((value: string) => bool) | Array<Pattern>;

type FileSystem = {
  mkdir: Function;
  stat: Function;
  writeFile: Function;
  mkdirp?: Function;
};

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
  test?: Pattern;
  /**
   * A test applied to each asset's resource path to determine if this plugin
   * should emit a module for the asset.
   */
  include?: Pattern;
  /**
   * A test applied to each asset's resource path to determine if this plugin
   * should not emit a module for the asset.
   */
  exclude?: Pattern;
  /**
   * Overrides the file systems used to write the emitted modules. By default,
   * the plugin writes to the compiler's `outputFileSystem`, but you may want
   * to write the modules to another file system as well.
   *
   * Specify `AssetModulePlugin.DefaultFileSystem` in the array to write to the
   * compiler's `outputFileSystem`.
   */
  fileSystems?: Array<FileSystem | Symbol>;
};

class AssetModulePlugin {
  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  apply(compiler: any) {
    compiler.plugin('compilation', (compilation, parameters) => {
      var addedResources = new Set();
      compilation._modulesToEmit = [];
      compilation.plugin('succeed-module', module => {
        var { resource } = module;
        if (addedResources.has(resource) || !this._shouldEmit(module)) {
          return;
        }
        addedResources.add(resource);
        compilation._modulesToEmit.push(module);
      });
    });

    compiler.plugin('after-emit', (compilation, callback) => {
      Promise.all(compilation._modulesToEmit.map(module => {
        return this._emitAssetModule(compiler, compilation, module);
      })).then(result => {
        callback(null, result);
      }, error => {
        console.warn(error.stack);
        callback(error);
      });
    });
  }

  _emitAssetModule(compiler: any, compilation: any, module: any) {
    var { sourceBase, destinationBase } = this.options;
    var { resource } = module;

    var relativePath = path.relative(sourceBase, resource);
    var destinationPath = path.resolve(destinationBase, relativePath);
    if (resource === destinationPath) {
      var message = `Destination path for ${resource} matches the source path; skipping instead of overwriting the file`;
      compilation.warnings.push(new Error(message));
      return Promise.resolve(null);
    }

    var source = this._getAssetModuleSource(compilation, module);

    if (!this.options.fileSystems) {
      var fileSystem = compiler.outputFileSystem;
      return this._writeFile(destinationPath, source, fileSystem);
    }

    var fileSystems = this.options.fileSystems.map(fileSystem => {
      if (fileSystem === DEFAULT_FILE_SYSTEM_SYMBOL) {
        return compiler.outputFileSystem;
      }
      return fileSystem;
    });

    var promises = fileSystems.map(fileSystem => {
      return this._writeFile(destinationPath, source, fileSystem).catch(error => {
        compilation.errors.push(error);
        throw error;
      });
    });
    return Promise.all(promises);
  }

  _getAssetModuleSource(compilation: any, module: any) {
    var { sourceBase, destinationBase } = this.options;
    var { resource, assets } = module;

    var publicPath = compilation.mainTemplate.getPublicPath({
      hash: compilation.hash,
    });

    var assetFilename;
    var assetFilenames = Object.keys(assets);
    if (assetFilenames.length === 0) {
      assetFilename = path.relative(sourceBase, resource);
    } else {
      if (assetFilenames.length > 1) {
        var message = `Module at ${resource} generated more than one asset; using the first one`;
        compilation.warnings.push(new Error(message));
      }
      assetFilename = assetFilenames[0];
    }

    var fullAssetPath = publicPath + assetFilename;
    return `module.exports = ${JSON.stringify(fullAssetPath)};\n`;
  }

  _writeFile(filename: string, content: string, fileSystem: FileSystem) {
    var makeDirectories = this._getMakeDirectoriesFunction(fileSystem);
    return new Promise((resolve, reject) => {
      makeDirectories(path.dirname(filename), error => {
        if (error) {
          reject(error);
          return;
        }

        fileSystem.writeFile(filename, content, error => {
          if (error) {
            reject(error);
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  _getMakeDirectoriesFunction(fileSystem: FileSystem) {
    if (fileSystem.mkdirp) {
      return fileSystem.mkdirp.bind(fileSystem);
    }
    return (path, callback) => mkdirp(path, { fs: fileSystem }, callback);
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

AssetModulePlugin.DefaultFileSystem = DEFAULT_FILE_SYSTEM_SYMBOL;

export default AssetModulePlugin;
