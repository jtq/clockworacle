
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

	all[this.constructor.name].items[this.Id] = this;
}

Lump.prototype = {
	wireUp: function() {
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

	get: function(Type, id, parent) {
		var typename = Type.name;	// Event, Quality, Interaction, etc

		var existingThingWithThisId = all[typename].id(id);
  	if(existingThingWithThisId) {
  		//console.log("Attached existing " + existingThingWithThisId + " to " + this.toString())
  		var newParent = true;
			existingThingWithThisId.parents.forEach(function(p) {
				if(p.Id === parent.Id && p.constructor.name === parent.constructor.name) {
					newParent = false;
				}
			});
			if(newParent){
				existingThingWithThisId.parents.push(parent);
			}

  		if(!existingThingWithThisId.wired) {
  			existingThingWithThisId.wireUp();
  		}
  		return existingThingWithThisId;
  	}
  	else {
  		return null;
  	}
	},

	getOrCreate: function(Type, possNewThing, parent) {	// If an event already exists with this ID, use that.  Otherwise create a new event from the supplied details hash
		var typename = Type.name;	// Event, Quality, Interaction, etc
		if(possNewThing) {
	  	var existingThingWithThisId = this.get(Type, possNewThing.Id, parent);
	  	if(existingThingWithThisId) {
	  		return existingThingWithThisId;
	  	}
	  	else {
				var newThing = new Type(possNewThing, parent);
				newThing.wireUp();
				//console.log("Recursively created " + newThing + " for " + this.toString());
				return newThing;
			}
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

	describeAdvancedExpression: function(expr) {
		if(expr) {
			expr = expr.replace(/\[d:(\d+)\]/gi, "RANDOM[1-$1]");	// [d:x] = random number from 1-x(?)
			expr = expr.replace(/\[q:(\d+)\]/gi, function(match, backref, pos, whole_str) {
  			return "["+all.Quality.id(backref).Name+"]";
			});

			return expr;
		}
		return null;
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

exports = Lump;