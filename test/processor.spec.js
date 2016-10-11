var fs = require('fs');

var Compiler = require('../index').Compiler;
var Packer = require('../index').Packer;

function MockFile(options) {
    this.setData(options.data);
    this.relativePath = options.relativePath;
    this.fullPath = options.fullPath;
    this.outputPath = this.relativePath;
}

MockFile.prototype.setData = function (data) {
    this.data = data;
};

MockFile.prototype.getData = function () {
    return this.data;
};

function MockBuilder() {
    this.files = [];
}

MockBuilder.prototype.getFiles = function () {
    return this.files;
};

MockBuilder.prototype.addFile = function (file) {
    return this.files.push(file);
};

MockBuilder.prototype.getFile = function (path) {
    return this.files.find(function (file) {
        return file.fullPath === path;
    });
};

function regexpLiteral(source) {
    return source.replace(/[\^\[\]\$\(\)\{\}\?\*\.\+]/g, function (c) {
        return '\\' + c;
    });
}

function genDefinePattern(id, dependencies, extra) {
    var patternSource = 'define\\([\'"]' + regexpLiteral(id) + '[\'"],\\s*\\[\\s*';
    var depsPatternSource = dependencies
        .map(function (dep) {
            return '[\'"]' + regexpLiteral(dep) + '[\'"]';
        })
        .join(',\\s*');

    patternSource += depsPatternSource;
    patternSource += '\\s*\\],\\s*function\\s*\\(';
    if (extra) {
        patternSource += extra;
    }

    return new RegExp(patternSource);
}

describe("AMD Compiler", function () {

    it("only factory module, add id and dependencies", function (done) {
        var processor = new Compiler({
            config: {
                baseUrl: '/project/src'
            }
        });

        var file = new MockFile({
            data: 'define(function (require) {require("./b");require("pkg");require("../c")})',
            fullPath: '/project/src/a/main.js',
            relativePath: 'src/a/main.js'
        });
        var builder = new MockBuilder();
        builder.addFile(file);

        processor.process(builder).then(function () {
            expect(file.getData()).toMatch(
                genDefinePattern('a/main', ['require', './b', 'pkg', '../c'])
            );

            done();
        });
    });

    it("miss id module, add id", function (done) {
        var processor = new Compiler({
            config: {
                baseUrl: '/project/src'
            }
        });

        var file = new MockFile({
            data: 'define(["./b","pkg","../c"], function (b,pkg,c) {})',
            fullPath: '/project/src/a/main.js',
            relativePath: 'src/a/main.js'
        });
        var builder = new MockBuilder();
        builder.addFile(file);

        processor.process(builder).then(function () {
            expect(file.getData()).toMatch(
                genDefinePattern('a/main', ['./b', 'pkg', '../c'])
            );

            done();
        });
    });

    it("miss dependencies module, add dependencies, id not be changed", function (done) {
        var processor = new Compiler({
            config: {
                baseUrl: '/project/src'
            }
        });

        var file = new MockFile({
            data: 'define("a/gap/main",function (require) {require("./b");require("pkg");require("../c")})',
            fullPath: '/project/src/a/main.js',
            relativePath: 'src/a/main.js'
        });
        var builder = new MockBuilder();
        builder.addFile(file);

        processor.process(builder).then(function () {
            expect(file.getData()).toMatch(
                genDefinePattern('a/gap/main', ['require', './b', 'pkg', '../c'])
            );

            done();
        });
    });

    it("package normal module, add id correctly", function (done) {
        var processor = new Compiler({
            config: {
                baseUrl: '/project/src',
                packages: [
                    {
                        name: 'ui',
                        location: '../dep/ui'
                    }
                ]
            }
        });

        var file = new MockFile({
            data: 'define(function (require) {require("./b");require("pkg");})',
            fullPath: '/project/dep/ui/util.js',
            relativePath: 'dep/ui/util.js'
        });
        var builder = new MockBuilder();
        builder.addFile(file);

        processor.process(builder).then(function () {
            expect(file.getData()).toMatch(
                genDefinePattern('ui/util', ['require', './b', 'pkg'])
            );

            done();
        });
    });

    it("package main module, gen two define", function (done) {
        var processor = new Compiler({
            config: {
                baseUrl: '/project/src',
                packages: [
                    {
                        name: 'ui',
                        location: '../dep/ui'
                    }
                ]
            }
        });

        var file = new MockFile({
            data: 'define(function (require) {require("./b");require("pkg");})',
            fullPath: '/project/dep/ui/main.js',
            relativePath: 'dep/ui/main.js'
        });
        var builder = new MockBuilder();
        builder.addFile(file);

        processor.process(builder).then(function () {
            expect(file.getData()).toMatch(
                genDefinePattern('ui/main', ['require', './b', 'pkg'])
            );
            expect(file.getData()).toMatch(
                genDefinePattern('ui', ['ui/main'])
            );

            done();
        });
    });

});

describe("AMD Packer", function () {

    it("combine all dependencies module", function (done) {
        var requireConfig = {
            baseUrl: '/project/src',
            packages: [
                {
                    name: 'ui',
                    location: '../dep/ui'
                },
                {
                    name: 'pkg',
                    location: '../dep/pkg',
                    main: 'index'
                }
            ]
        };
        var processor = new Compiler({
            config: requireConfig
        });
        var packer = new Packer({
            config: requireConfig,
            modules: ['ui']
        });

        var mainFile = new MockFile({
            data: 'define(function (require) {require("./b");require("pkg");})',
            fullPath: '/project/dep/ui/main.js',
            relativePath: 'dep/ui/main.js'
        });
        var bFile = new MockFile({
            data: 'define(function (require) {require("conf")})',
            fullPath: '/project/dep/ui/b.js',
            relativePath: 'dep/ui/b.js'
        });
        var confFile = new MockFile({
            data: 'define(function () {alert(1)})',
            fullPath: '/project/src/conf.js',
            relativePath: 'src/conf.js'
        });
        var pkgFile = new MockFile({
            data: 'define(function (require) {require("./b");})',
            fullPath: '/project/dep/pkg/index.js',
            relativePath: 'dep/pkg/index.js'
        });
        var builder = new MockBuilder();
        builder.addFile(mainFile);
        builder.addFile(bFile);
        builder.addFile(confFile);
        builder.addFile(pkgFile);

        processor.process(builder)
            .then(function () {
                return packer.process(builder);
            })
            .then(function () {
                expect(mainFile.getData()).toMatch(
                    genDefinePattern('ui/main', ['require', './b', 'pkg'])
                );
                expect(mainFile.getData()).toMatch(
                    genDefinePattern('ui', ['ui/main'])
                );
                expect(mainFile.getData()).toMatch(
                    genDefinePattern('conf', [])
                );
                expect(mainFile.getData()).toMatch(
                    genDefinePattern('pkg/index', ['require', './b'])
                );
                expect(mainFile.getData()).toMatch(
                    genDefinePattern('pkg', ['pkg/index'])
                );

                done();
            });
    });
});

