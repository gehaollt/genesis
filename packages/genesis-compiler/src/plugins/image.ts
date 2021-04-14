import { Plugin, WebpackHookParams } from '@fmfe/genesis-core';

export class ImagePlugin extends Plugin {
    public chainWebpack({ config }: WebpackHookParams) {
        const { ssr } = this;
        config.module
            .rule('file')
            .test(/\.(png|jpe?g|gif|svg)$/i)
            .include.add(ssr.srcIncludes)
            .end()
            .use('file')
            .loader('file-loader')
            .options({
                esModule: false,
                name: ssr.isProd
                    ? 'images/[name].[contenthash:8].[ext]'
                    : 'images/[path][name].[ext]'
            });
    }
}
