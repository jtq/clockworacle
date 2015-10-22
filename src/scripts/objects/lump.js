var library = require('../library');
var Clump = require('./clump');

var api;

function Lump(raw, parent) {
	if(parent) {
		this.parents = parent instanceof Array ? parent : [parent];
	}
	else {
		this.parents = [];
	}

	if(!this.straightCopy) {
		this.straightCopy = [];
	}
	this.straightCopy.unshift('Id');

	this.attribs = raw;

	var self = this;
	this.straightCopy.forEach(function(attrib) {
		self[attrib] = raw[attrib];
		if(typeof self[attrib] === "undefined") {
			self[attrib] = null;
		}
	});
	delete(this.straightCopy);

	this.wired = false;

	if(!library[this.constructor.name]) {
		library[this.constructor.name] = new Clump([], this);
	}

	if(library[this.constructor.name].items[this.Id]) {	// Something with this ID already exists!

		var existingObject = library[this.constructor.name].items[this.Id];

		if(!isFunctionallySame(this.attribs, existingObject.attribs)) {	// Was it a functionally-identical redefinition of this object?
			console.warn("Duplicate ID", this.constructor.name+" "+this.Id+" already exists in the library - replacing", existingObject, "with redefinition", this);
		}
	}
	library[this.constructor.name].items[this.Id] = this;
}

var isFunctionallySame = function(obj1, obj2) {

	if(obj1 === obj2) {
		return true;
	}

	if(obj1 instanceof Object) {
		if(!(obj2 instanceof Object) || obj1.constructor !== obj2.constructor) {
			return false;
		}

		var allKeys = Object.keys(obj1).concat(Object.keys(obj2)).filter(function (value, index, self) { 
    	return self.indexOf(value) === index;
		});

		return allKeys.map(function(key) {
			return isFunctionallySame(obj1[key], obj2[key]);
		}).reduce(function(previousValue, currentValue) {
			return previousValue && currentValue;
		}, true);
	}

	return false;

};

Lump.prototype = {
	wireUp: function(theApi) {
		api = theApi;
		this.wired = true;
	},

	getStates: function(encoded) {
		if(typeof encoded === "string" && encoded !== "") {
			var map = {};
			encoded.split("~").forEach(function(state) {
				var pair = state.split("|");
				map[pair[0]] = pair[1];
			});
			return map;
		}
		else {
			return null;
		}
	},

	getExoticEffect: function(encoded) {
		if(typeof encoded === "string") {
			var effect={}, fields=["operation", "first", "second"];
			encoded.split(",").forEach(function(val, index) {
				effect[fields[index]] = val;
			});
			return effect;
		}
		else {
			return null;
		}
	},

	evalAdvancedExpression: function(expr) {
		expr = expr.replace(/\[d:(\d+)\]/gi, "Math.floor((Math.random()*$1)+1)");	// Replace [d:x] with JS to calculate random number on a Dx die
		/*jshint -W061 */
		return eval(expr);
		/*jshint +W061 */
	},

	isA: function(type) {
		return this instanceof type;
	},

	isOneOf: function(types) {
		var self = this;
		return types.map(function(type) {
			return self.isA(type);
		}).reduce(function(previousValue, currentValue, index, array){
			return previousValue || currentValue;
		}, false);
	},

	toString: function() {
		return this.constructor.name + " (#" + this.Id + ")";
	},

	isFunctionallySame: isFunctionallySame	// Convenience utility function
};

module.exports = Lump;