var assert = require("assert");
var Lump = require("../../../src/scripts/objects/lump");

describe('Lump', function() {
	
  describe('#getStates()', function () {

    it('should split states string into a map of id:description', function () {
      var lump = new Lump({ Id:null });
      var result = lump.getStates("0|Zero~1|One~2|Two");
      
      expect(result).toEqual({
        '0':'Zero',
        '1':'One',
        '2':'Two'
      });
    });

    it('should return null for empty strings', function () {
      var lump = new Lump({ Id:null });
      var result = lump.getStates("");
      
      expect(result).toBe(null);
    });

    it('should return null for non-strings', function () {
      var lump = new Lump({ Id:null });
      var result = lump.getStates({});
      
      expect(result).toBe(null);
    });
  });

});