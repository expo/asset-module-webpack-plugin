# AssetModulePlugin
A webpack plugin that emits JS modules for your assets such as images. This allows Node to load the modules that webpack generated for your assets without having to run webpack's bundle on the server.

## Purpose

This plugin was written to facilitate server-side rendering of React components. The traditional approach is to build two webpack bundles, one for the browser and one for the server. This works, but there a few things about it that are unappealing:

 - You need to write a second webpack config for the server-side bundle
 - The generated bundle is harder to debug and requires configuring Node to use source maps
 - Node has to read and parse the entire bundle the first time it is required, rather than lazily parsing components as needed

What we really wanted to do was run our JS files on Node directly instead of a bundle. The [enhanced-require](https://github.com/webpack/enhanced-require) package looks like the most comprehensive solution, as it polyfills webpack for the server. However, it is unmaintained, and we needed only two features anyway: We wanted to be able to require CSS/LESS files without throwing an error, and we wanted `require('./icon.png')` to return the full CDN path to the icon. My goal was for this code to run:

```js
import './Button.less';

class Button extends React.Component {
  render() {
    return (
      <button className="button">
        <img src={require('./icon.png')} className="button-icon" />
        {this.props.text}
      </button>
    );
  }
}
```

## How it works

The plugin runs after compilation and translates the path of the source asset to a destination path (you configure this with the `sourceBase` and `destinationBase` options). It then writes the transformed source of the module to the destination path. This lets you emit files like this:

```js
// build/icon.png
// It's actually a JS module with a png extension, which Node can evaluate
module.exports = __webpack_public_path__ + "eelZITCY0q9Gbj00z8HI.png"
```

Note that since the emitted module accesses `__webpack_public_path__` you must define this globally yourself.

## How to use it

In your webpack configuration file, add this to your list of plugins:

```js
new AssetModulePlugin({
  sourceBase: 'src',
  destinationBase: 'build',
  test: /\.(?!js)$/,
  exclude: /node_modules/,
})
```

This takes your assets whose filenames don't end in ".js" and aren't under "node_modules" and moves them from "src" to "build". The original asset's path relative to "src" will be the same as the emitted module's path relative to "build".

## Requirements

We use the `class` keyword so io.js 2.0+ is required.

## Ideas

If you have ideas for how to improve server-side rendering we'd be happy to chat. Open up a GitHub issue or join our Slack chat at http://exp.host/community.

## Contributing

Run `npm run-script build` to build `lib` from `src`.
