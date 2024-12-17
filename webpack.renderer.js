const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const makeConfig = require('./webpack.makeConfig.js');

// Fixed the issue that when using link to local gui package in node16, an error message appears saying that the
// blocks vm package in gui cannot be found.
const getModulePath = moduleName => {
    try {
        return path.dirname(require.resolve(`${moduleName}/package.json`));
    } catch (e) {
        try {
            const openblockGuiPath = path.dirname(require.resolve('openblock-gui/package.json'));
            return path.resolve(openblockGuiPath, 'node_modules', moduleName);
        } catch (err) {
            throw new Error(`Module ${moduleName} could not be resolved. Ensure it is installed or linked properly.`);
        }
    }
};

module.exports = defaultConfig =>
    makeConfig(
        defaultConfig,
        {
            name: 'renderer',
            useReact: true,
            disableDefaultRulesForExtensions: ['js', 'jsx', 'css', 'svg', 'png', 'wav', 'gif', 'jpg', 'ttf'],
            babelPaths: [
                path.resolve(__dirname, 'src', 'renderer'),
                /node_modules[\\/]+scratch-[^\\/]+[\\/]+src/,
                /node_modules[\\/]+openblock-[^\\/]+[\\/]+src/,
                /node_modules[\\/]+pify/,
                /node_modules[\\/]+@vernier[\\/]+godirect/
            ],
            plugins: [
                new CopyWebpackPlugin([{
                    from: path.join(getModulePath('openblock-blocks'), 'media'),
                    to: 'static/blocks-media'
                }]),
                new CopyWebpackPlugin([{
                    from: 'extension-worker.{js,js.map}',
                    context: path.join(getModulePath('openblock-vm'), 'dist', 'web')
                }]),
                new CopyWebpackPlugin([{
                    from: path.join(getModulePath('openblock-gui'), 'src', 'lib', 'libraries', '*.json'),
                    to: 'static/libraries',
                    flatten: true
                }])
            ]
        }
    );
