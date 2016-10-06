/**
 * @file MIP Processor For AMD Module Pack
 * @author errorrik(errorrik@gmail.com)
 */

var MipProcessor = require('mip-processor');
var util = require('./util');

module.exports = exports = MipProcessor.derive({
    name: 'AMDPacker',
    modules: [],

    /**
     * 处理模块合并行为
     *
     * @param {Builder} builder 构建器对象
     * @return {Promise}
     */
    process: function (builder) {
        var requireConfig = this.config;
        this.modules.forEach(function (moduleId) {
            var code = [];
            var existsModule = {};

            /**
             * 添加模块代码
             *
             * @inner
             * @param {string} id 模块id
             */
            function pushModuleCode(id) {
                if (!existsModule[id]) {
                    var filePath = util.getPathById(id, requireConfig);
                    var fileInfo = builder.getFile(filePath);
                    if (!fileInfo) {
                        return;
                    }

                    code.push(fileInfo.data);
                    existsModule[id] = true;

                    fileInfo.amdDependencies.forEach(function (dep) {
                        dep = util.resolve(dep, id, requireConfig);
                        pushModuleCode(dep);
                    });

                    if (id === moduleId) {
                        fileInfo.setData(code.join('\n\n'));
                    }
                }
            }

            pushModuleCode(moduleId);
        }, this);

        return Promise.resolve();
    }
});
