var util = require('../lib/util');

describe("Util", function () {

    var requireConfig = {
        baseUrl: '/project/src',
        paths: {
            foo: '../dep/foo',
            'foo-oof': '../dep/foo-oof'
        },
        packages: [
            {
                name: 'pkg',
                location: '../dep/pkg',
                main: 'pkg'
            }
        ]
    }

    it("getIdsByPath, baseUrl", function () {
        var ids = util.getIdsByPath('/project/src/app.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('app');
    });

    it("getIdsByPath, baseUrl", function () {
        var ids = util.getIdsByPath('/project/dep/foo.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('foo');

        var ids = util.getIdsByPath('/project/dep/foo-oof.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('foo-oof');


        var ids = util.getIdsByPath('/project/dep/foo2.js', requireConfig);
        expect(ids.length).toBe(0);


        var ids = util.getIdsByPath('/project/dep/foo/test.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('foo/test');
    });

    it("getIdsByPath, package", function () {
        var ids = util.getIdsByPath('/project/dep/pkg/pkg.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('pkg');

        var ids = util.getIdsByPath('/project/dep/pkg/main.js', requireConfig);
        expect(ids.length).toBe(1);
        expect(ids[0]).toBe('pkg/main');
    });
});
