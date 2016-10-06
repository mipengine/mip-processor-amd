mip-processor-amd
===========

MIP Processor For AMD


### usage


```js
var Builder = require('mip-builder');

var amdProcessor = require('mip-processor-amd');
var AMDCompiler = amdProcessor.Compiler;
var AMDPacker = amdProcessor.Packer;


var requireConfig = {
    // bla bla
};

var amdCompiler = new AMDCompiler({
    config: requireConfig
});

var amdPacker = new AMDPacker({
    config: requireConfig,
    modules: ['main']
});

var builder = new Builder({
    // bla bla

    processor: [
        amdCompiler,
        amdPacker
    ]
});

builder.build();

```
