var assert = require("assert");
var Lump = require("../../../src/scripts/objects/lump");

describe('Lump', function() {
	
  describe('#getStates()', function () {
    beforeAll(function() {
      
		});

    it('should split states string into a map of id:description', function () {
      var lump = new Lump({ Id:null });
      var result = lump.getStates("0|Zero~1|One~2|Two");
      
      expect(result).toEqual({
        '0':'Zero',
        '1':'One',
        '2':'Two'
      });
    });
  });
});