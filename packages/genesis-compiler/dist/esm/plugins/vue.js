import path from 'path';
import webpack from 'webpack';
import VueSSRClientPlugin from 'vue-server-renderer/client-plugin';
import VueLoaderPlugin from 'vue-loader/lib/plugin';
import { Plugin } from '@fmfe/genesis-core';
const isJS = (file) => {
    return /\.js(\?[^.]+)?$/.test(file);
};
class VueServerPlugin {
    constructor(options) {
        this.options = options;
    }
    get filename() {
        return this.options.filename || 'vue-ssr-server-bundle.json';
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('vue-server-plugin', async (compilation) => {
            const stats = compilation.getStats().toJson();
            const entryName = Object.keys(stats.entrypoints)[0];
            const entryInfo = stats.entrypoints[entryName];
            if (!entryInfo)
                return;
            const entryAssets = entryInfo.assets.filter((item) => isJS(item.name));
            if (entryAssets.length > 1) {
                throw new Error(`Server-side bundle should have one single entry file. Avoid using CommonsChunkPlugin in the server config.`);
            }
            const entry = entryAssets[0];
            if (typeof entry?.name !== 'string') {
                throw new Error(`Entry "${entryName}" not found. Did you specify the correct entry option?`);
            }
            const bundle = {
                entry: entry.name,
                files: {},
                maps: {}
            };
            const toString = (text) => {
                if (Buffer.isBuffer(text)) {
                    return Buffer.from(text).toString();
                }
                return text;
            };
            stats.assets.forEach((asset) => {
                const name = asset.name;
                if (!isJS(name))
                    return;
                bundle.files[name] = toString(compilation.assets[name].source());
                const sourceMap = asset.info?.related?.sourceMap;
                if (typeof sourceMap === 'string') {
                    bundle.maps[sourceMap.replace(/\.map$/, '')] = JSON.parse(toString(compilation.assets[sourceMap].source()));
                    console.log('>>>>>>>', asset.info?.related);
                    delete asset.info?.related?.sourceMap;
                }
                delete compilation.assets[name];
            });
            const json = JSON.stringify(bundle, null, 4);
            const filename = this.options.filename;
            compilation.assets[filename] = {
                name: filename,
                source: () => json,
                size: () => json.length
            };
        });
    }
}
export class VuePlugin extends Plugin {
    chainWebpack({ target, config }) {
        const { ssr } = this;
        switch (target) {
            case 'client':
                config.plugin('vue-ssr-client').use(VueSSRClientPlugin, [
                    {
                        filename: path.relative(ssr.outputDirInClient, ssr.outputClientManifestFile)
                    }
                ]);
                break;
            case 'server':
                config.plugin('vue-ssr-server').use(new VueServerPlugin({
                    filename: path.relative(ssr.outputDirInServer, ssr.outputServerBundleFile)
                }));
                break;
        }
        config.resolve.extensions.add('.vue');
        config.module
            .rule('vue')
            .test(/\.vue$/)
            .include.add(this.ssr.srcIncludes)
            .end()
            .use('vue')
            .loader('vue-loader')
            .options(target === 'client'
            ? {}
            : {
                optimizeSSR: true
            });
        config.plugin('vue').use(VueLoaderPlugin);
        config.plugin('define').use(webpack.DefinePlugin, [
            {
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
                'process.env.VUE_ENV': JSON.stringify(target),
                'process.env.GENESIS_NAME': JSON.stringify(ssr.name)
            }
        ]);
    }
}
