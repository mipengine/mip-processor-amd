/**
 * @file MIP Processor For AMD Module Compile
 * @author errorrik(errorrik@gmail.com)
 */

var MipProcessor = require('mip-processor');
var util = require('./util');

module.exports = exports = MipProcessor.derive({
    name: 'AMDCompiler',
    files: ['*.js'],

    /**
     * 单一文件处理
     *
     * @param {FileInfo} 文件信息实例
     * @param {Builder} 构建器实例
     */
    processFile: function (file, builder) {
        var result = util.compile(file.data, file.fullPath, this.config);
        if (!result) {
            return;
        }

        file.setData(result.code);
        file.amdDependencies = result.dependencies.filter(function (dep) {
            return dep !== 'require' && dep !== 'module' && dep !== 'exports';
        });
    }
});

