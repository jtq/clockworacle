var assert = require("assert");
var Clump = require("../../../src/scripts/objects/clump");

describe('Clump', function() {

  describe('#constructor()', function () {

    var StubType = function(raw, parent) {
      var self = this;
      Object.keys(raw).forEach(function(key) {
        self[key] = raw[key];
      });

      this.parents = [];
      if(parent) {
        this.parents.push(parent);
      }
    };

    it('reads array of untyped objects into items', function () {

      var raw = [{ Id:1 }, { Id:2 }, { Id:3 }];

      var clump = new Clump(raw, StubType);

      expect(Object.keys(clump.items).length).toBe(3);
      expect(clump.size()).toBe(3);
    });

    it('reads array of type-objects into items', function () {

      var typeArray = [
        new StubType({ Id:1 }),
        new StubType({ Id:2 }),
        new StubType({ Id:3 })
      ];

      var clump = new Clump(typeArray, StubType);

      expect(Object.keys(clump.items).length).toBe(3);
      expect(clump.size()).toBe(3);
    });

    it('passes parent param through to new clump items\' constructor', function () {

      var sampleParent = { Id:"sampleParent" };
      var raw = [{ Id:"Plain POJO" }, new StubType({ Id:"Prebuild StubType" }), { Id:"POJO w/ empty parent", parents:[] }, { Id:"POJO w/ sample parent", parents:[sampleParent] } ];
      
      var clump = new Clump(raw, StubType, sampleParent);

      expect(clump.items["Plain POJO"].parents[0]).toBe(sampleParent);
      expect(clump.items["Prebuild StubType"].parents[0]).toBe(sampleParent);
      expect(clump.items["POJO w/ empty parent"].parents[0]).toBe(sampleParent);
      expect(clump.items["POJO w/ sample parent"].parents.length).toBe(1);
    });

  });

});