/**
 * @file 一些AMD编译用到的功能函数集合
 * @author errorrik(errorrik@gmail.com)
 */

var path = require('path');
var esprima = require('esprima');
var estraverse = require('estraverse');
var SYNTAX = estraverse.Syntax;
var LITERAL_DEFINE = 'define';
var LITERAL_REQUIRE = 'require';

/**
 * 将相对的module id转换成绝对id
 *
 * @param {string} id 要转换的id
 * @param {string} baseId 基础id
 * @param {Object} requireConfig require配置
 * @return {string}
 */
exports.resolve = function (id, baseId, requireConfig) {
    if (/^\.{1,2}/.test(id)) {
        // if baseId is a package, make it equal main first
        requireConfig = requireConfig || {};
        var pkgs = requireConfig.packages || [];
        pkgs.forEach(function (pkg) {
            if (pkg.name === baseId) {
                baseId = baseId + '/' + (pkg.main || 'main');
            }
        });

        // do resolve
        var basePath = baseId.split('/');
        var namePath = id.split('/');
        var baseLen = basePath.length - 1;
        var nameLen = namePath.length;
        var cutBaseTerms = 0;
        var cutNameTerms = 0;

        pathLoop: for (var i = 0; i < nameLen; i++) {
            var term = namePath[i];
            switch (term) {
                case '..':
                    if (cutBaseTerms < baseLen) {
                        cutBaseTerms++;
                        cutNameTerms++;
                    }
                    else {
                        break pathLoop;
                    }
                    break;
                case '.':
                    cutNameTerms++;
                    break;
                default:
                    break pathLoop;
            }
        }

        basePath.length = baseLen - cutBaseTerms;
        namePath = namePath.slice(cutNameTerms);

        basePath.push.apply(basePath, namePath);
        return basePath.join('/');
    }

    return id;
};

/**
 * 获取模块对应的文件路径
 *
 * @param {string} id 模块id
 * @param {Object} requireConfig require配置
 * @return {string}
 */
exports.getPathById = function (id, requireConfig) {
    // try match packages
    var packages = requireConfig.packages || [];
    for (var i = 0; i < packages.length; i++) {
        var pkg = packages[i];
        var pkgName = pkg.name;

        if (id.split('/')[0] === pkgName) {
            if (id === pkgName) {
                id += '/' + (pkg.main || 'main');
            }

            var pkgPath = pkg.location;
            if (!isRelativePath(pkgPath)) {
                return null;
            }

            return path.resolve(
                requireConfig.baseUrl,
                pkgPath,
                id.replace(pkgName, '.')
            ) + '.js';
        }
    }

    // try match paths
    var pathKeys = Object.keys(requireConfig.paths || {}).slice(0);
    pathKeys.sort(function (a, b) {
        return b.length - a.length;
    });
    for (var j = 0; j < pathKeys.length; j++) {
        var key = pathKeys[j];

        if (id.indexOf(key) === 0) {
            var modulePath = requireConfig.paths[key];
            if (!isRelativePath(modulePath)) {
                return null;
            }

            return path.resolve(
                requireConfig.baseUrl,
                modulePath,
                id.replace(key, '.')
           ) + '.js';
        }
    }

    return path.resolve(
        requireConfig.baseUrl,
        id
    ) + '.js';
};

/**
 * 根据文件获取对应的模块id
 *
 * @param {string} file 文件路径
 * @param {Object} requireConfig require配置
 * @return {Array}
 */
exports.getIdsByPath = function (file, requireConfig) {
    var moduleIds = [];
    function addModule(relPath) {
        moduleIds.push(relPath
            .split(path.sep)
            .join('/')
            .replace(/\.js$/i, '')
        );
    }

    // try match packages
    var packages = requireConfig.packages || [];
    for (var i = 0; i < packages.length; i++) {
        var pkg = packages[i];
        var pkgName = pkg.name;
        var pkgMain = pkg.main || 'main';
        var pkgLoc = pkg.location;

        if (!isRelativePath(pkgLoc)) {
            continue;
        }

        pkgLoc = path.resolve(requireConfig.baseUrl, pkgLoc);
        if (file.indexOf(pkgLoc + path.sep) === 0) {
            if (file === path.resolve(pkgLoc, pkgMain + '.js')) {
                moduleIds.push(pkgName);
            }
            else {
                moduleIds.push(
                    pkgName + '/'
                    + path.relative(pkgLoc, file)
                        .split(path.sep)
                        .join('/')
                        .replace(/\.js$/i, '')
                );
            }

            break;
        }
    }

    // try match paths
    var paths = requireConfig.paths || {};
    var pathKeys = Object.keys(paths).slice(0);
    pathKeys.sort(function (a, b) {
        return paths[b].length - paths[a].length;
    });

    for (i = 0; i < pathKeys.length; i++) {
        var key = pathKeys[i];
        var modulePath = paths[key];

        if (!isRelativePath(modulePath)) {
            continue;
        }

        modulePath = path.resolve(requireConfig.baseUrl, modulePath);
        if (file.indexOf(modulePath + '.') === 0 || file.indexOf(modulePath + '/') === 0) {
            addModule(file.replace(modulePath, key));
        }
    }

    // try match baseUrl
    if (file.indexOf(requireConfig.baseUrl) === 0) {
        addModule(file.replace(requireConfig.baseUrl + path.sep, ''));
    }

    return moduleIds;
};

/**
 * 判断url是否相对路径
 *
 * @inner
 * @param {string} url 路径
 * @return {boolean}
 */
function isRelativePath(url) {
    return !/^([a-z]{2,10}:\/)?\//i.test(url);
}

/**
 * 编译模块
 *
 * @param {string} code 模块代码
 * @param {string} file 文件路径
 * @param {Object} requireConfig require配置
 * @return {Object} 包含ids、dependencies、code(编译后代码)
 */
exports.compile = function (code, file, requireConfig) {
    var ids = exports.getIdsByPath(file, requireConfig);
    var packages = requireConfig.packages || [];
    var moduleInfo;

    var ast = esprima.parse(code);
    ast = estraverse.replace(ast, {
        enter: function (node) {
            if (node.type === SYNTAX.CallExpression
                && node.callee.name === LITERAL_DEFINE
            ) {

                moduleInfo = analyseDefineExpr(node);
                if (moduleInfo.id) {
                    ids = [moduleInfo.id];
                }

                var replaceDefines = [];

                ids.forEach(function (id) {
                    var depElements = [];
                    moduleInfo.dependencies.forEach(function (dep) {
                        depElements.push({
                            type: 'Literal',
                            value: dep,
                            raw: '"' + dep + '"'
                        });
                    });

                    var realId = id;
                    var pkg = packages.find(function (item) {
                        return item.name === id;
                    });
                    if (pkg) {
                        realId = id + '/' + (pkg.main || 'main');
                    }


                    replaceDefines.push({
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'define'
                        },
                        'arguments': [
                            {
                                type: 'Literal',
                                value: realId,
                                raw: '"' + realId + '"'
                            },
                            {
                                type: 'ArrayExpression',
                                elements: depElements
                            },
                            moduleInfo.factoryAst
                        ]
                    });

                    if (pkg) {
                        replaceDefines.push({
                            type: 'CallExpression',
                            callee: {
                                type: 'Identifier',
                                name: 'define'
                            },
                            arguments: [
                                {
                                    type: 'Literal',
                                    value: id,
                                    raw: '"' + id + '"'
                                },
                                {
                                    type: 'ArrayExpression',
                                    elements: [
                                        {
                                            type: 'Literal',
                                            value: realId,
                                            raw: '"' + realId + '"'
                                        }
                                    ]
                                },
                                {
                                    type: 'FunctionExpression',
                                    id: null,
                                    params: [
                                        {
                                            type: 'Identifier',
                                            name: 'main'
                                        }
                                    ],
                                    body: {
                                        type: 'BlockStatement',
                                        body: [
                                            {
                                                type: 'ReturnStatement',
                                                argument: {
                                                    type: 'Identifier',
                                                    name: 'main'
                                                }
                                            }
                                        ]
                                    },
                                    generator: false,
                                    expression: false
                                }
                            ]
                        });
                    }
                });

                this.skip();

                if (replaceDefines.length > 1) {
                    return {
                        type: 'SequenceExpression',
                        expressions: replaceDefines
                    };
                }

                return replaceDefines[0] || node;
            }
        }
    });

    if (moduleInfo) {
        return {
            code: require('escodegen').generate(ast),
            ids: ids,
            dependencies: moduleInfo.dependencies
        };
    }

    return null;
};

/**
 * 判断结点是否字符串直接量
 *
 * @inner
 * @param {Object} node 语法树结点
 * @return {boolean}
 */
function isStringLiteral(node) {
    return node
        && node.type === SYNTAX.Literal
        && typeof node.value === 'string';
}

/**
 * 分析define调用
 * 获取模块信息
 *
 * @inner
 * @param {Object} expr define ast
 * @return {Object} 模块信息
 */
function analyseDefineExpr(expr) {
    var moduleId;
    var dependencies;
    var factoryAst;
    var args = expr['arguments'];

    // 解析参数
    for (var i = 0; i < args.length; i++) {
        var argument = args[i];

        if (!moduleId && isStringLiteral(argument)) {
            // 获取module id
            moduleId = argument.value;
        }
        else if (!dependencies && argument.type === SYNTAX.ArrayExpression) {
            // 获取依赖
            dependencies = [];
            argument.elements.forEach(function (item) {
                if (!isStringLiteral(item)) {
                    return;
                }

                dependencies.push(item.value);
            });
        }
        else {
            factoryAst = argument;
            break;
        }
    }


    // 计算factory function的形参个数
    var factoryParamCount = 0;
    if (factoryAst && factoryAst.type === SYNTAX.FunctionExpression) {
        factoryParamCount = factoryAst.params.length;
    }

    if (!dependencies) {
        dependencies = ['require', 'exports', 'module']
            .slice(0, factoryParamCount);

        // 解析模块定义函数，获取内部 require 的依赖
        if (factoryAst.type === SYNTAX.FunctionExpression) {
            var visitedDeps = {};

            estraverse.traverse(factoryAst, {
                enter: function (item) {
                    // require('xxx')
                    // new require('xxx')
                    if (item.type !== SYNTAX.CallExpression
                        && item.type !== SYNTAX.NewExpression
                    ) {
                        return;
                    }

                    if (item.callee.name === LITERAL_REQUIRE
                        && (argument = item['arguments'][0])
                        && isStringLiteral(argument)
                    ) {
                        var dep = argument.value;
                        if (!visitedDeps[dep]) {
                            visitedDeps[dep] = true;
                            dependencies.push(dep);
                        }
                    }
                }
            });
        }
    }


    return {
        id: moduleId,
        dependencies: dependencies,
        factoryAst: factoryAst
    };
}
