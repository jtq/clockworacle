var library = require('../library');
var Clump = require('./clump');

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
	library[this.constructor.name].items[this.Id] = this;
}

Lump.prototype = {
	wireUp: function(library) {
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
	}
};

module.exports = Lump;