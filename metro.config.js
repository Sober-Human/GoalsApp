const { getDefaultConfig } = require('@expo/metro-config');
const config = getDefaultConfig(__dirname);

config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

module.exports = config;
