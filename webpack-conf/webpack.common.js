const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: {
      client: './js/main.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../chat/dist'),
  },
  plugins: [
    new CleanWebpackPlugin()
  ],
  node: {
    fs: 'empty'
  }
};
