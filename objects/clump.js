function Clump(raw, Type, parent) {
	this.type = Type;
	this.items = {};
	var self = this;
	raw.forEach(function(item, index, all) {
		if(!(item instanceof Type)) {
			item = new Type(item, parent);
		}
		else if(parent) {
			var newParent = true;
			item.parents.forEach(function(p) {
				if(p.Id === parent.Id && p.constructor.name === parent.constructor.name) {
					newParent = false;
				}
			});
			if(newParent){
				item.parents.push(parent)
			}
		}
		self.items[item.Id] = item;
	});
}

Clump.prototype.empty = function() {
	return !!this.size();
};

Clump.prototype.size = function() {
	return Object.keys(this.items).length;
};

Clump.prototype.get = function(index) {
	for(var id in this.items) {
		if(index === 0) {
			return this.items[id];
		}
		index--;
	}
};

Clump.prototype.id = function(id) {
	return this.items[id];
}

Clump.prototype.each = function() {
	var args = Array.prototype.slice.call(arguments);
	return this.map(function(item) {

		if(args[0] instanceof Array) {	// Passed in array of fields, so return values concatenated with optional separator
			var separator = (typeof args[1] === "undefined") ? "-" : args[1];
			return args[0].map(function(f) { return item[f]; }).join(separator);
		}
		else if(args.length > 1) {	// Passed in separate fields, so return array of values
			return args.map(function(f) { return item[f]; });
		}
		else {
			return item[args[0]];
		}
	});
}

Clump.prototype.forEach = function(callback) {
	for(var id in this.items) {
		var item = this.items[id];
		callback(item, id, this.items);
	}
};

Clump.prototype.map = function(callback) {
	var self = this;
	var arrayOfItems = Object.keys(this.items).map(function(key) {
		return self.items[key];
	});
	return arrayOfItems.map.call(arrayOfItems, callback);
};

Clump.prototype.sortBy = function(field, reverse) {
	var self = this;
	var objs = Object.keys(this.items).map(function(key) {
		return self.items[key];
	}).sort(function(a, b) {
		if(a[field] < b[field]) {
			return -1;
		}
		if(a[field] === b[field]) {
			return 0;
		}
		if(a[field] > b[field]) {
			return 1;
		}
	});

	return reverse ? objs.reverse() : objs;
};

Clump.prototype.same = function() {
	var self = this;

	var clone = function(obj) {
    var target = {};
    for (var i in obj) {
    	if (obj.hasOwnProperty(i)) {
    		if(typeof obj[i] === "object") {
    			target[i] = clone(obj[i]);
    		}
    		else {
      		target[i] = obj[i];
      	}
      }
    }
    return target;
  }

	var template = clone(this.get(0).attribs);

	for(var id in this.items) {
		var otherObj = this.items[id].attribs;
		for(var key in template) {
			if(template[key] !== otherObj[key]) {
				delete(template[key]);
			}
		}
	}

	return template;
};

Clump.prototype.distinct = function(field) {
	var sampleValues = {};
	this.forEach(function(item) {
		var value = item[field]
		sampleValues[value] = value;	// Cheap de-duping with a hash
	});
	return Object.keys(sampleValues).map(function(key) { return sampleValues[key]; });
}

Clump.prototype.distinctRaw = function(field) {
	var sampleValues = {};
	this.forEach(function(item) {
		var value = item.attribs[field]
		sampleValues[value] = value;	// Cheap de-duping with a hash
	});
	return Object.keys(sampleValues).map(function(key) { return sampleValues[key]; });
}

Clump.prototype.query = function(field, value) {
	var matches = [];
	var test;

	// Work out what sort of comparison to do:

	if(typeof value === "function") {	// If value is a function, pass it the candidate and return the result
		test = function(candidate) {
			return !!value(candidate);
		};;
	}
	else if(typeof value === "object") {
		if(value instanceof RegExp) {
			test = function(candidate) {
				return value.test(candidate);
			};
		}
		else if(value instanceof Array) {	// If value is an array, test for the presence of the candidate value in the array
			test = function(candidate) {
				return value.indexOf(candidate) !== -1;
			};
		}
		else {
			test = function(candidate) {
				return candidate === value;	// Handle null, undefined or object-reference comparison
			};
		}
	}
	else {	// Else if it's a simple type, try a strict equality comparison
		test = function(candidate) {
			return candidate === value;
		};
	}
	
	// Now iterate over the items, filtering using the test function we defined
	this.forEach(function(item) {
		if(
			(field !== null && test(item[field])) ||
			(field === null && test(item))
		) {
			matches.push(item);
		}
	});
	return new Clump(matches, this.type);	// And wrap the resulting array of objects in a new Clump object for sexy method chaining like x.query().forEach() or x.query().query()
};

Clump.prototype.queryRaw = function(field, value) {
	var matches = [];
	var test;

	// Work out what sort of comparison to do:

	if(typeof value === "function") {	// If value is a function, pass it the candidate and return the result
		test = function(candidate) {
			return !!value(candidate);
		}
	}
	else if(typeof value === "object") {
		if(value instanceof RegExp) {
			test = function(candidate) {
				return value.test(candidate);
			}
		}
		else if(value instanceof Array) {	// If value is an array, test for the presence of the candidate value in the array
			test = function(candidate) {
				return value.indexOf(candidate) !== -1;
			}
		}
		else {	// If value is a hash... what do we do?
			// Check the candidate for each field in the hash in turn, and include the candidate if any/all of them have the same value as the corresponding value-hash field?
			throw "No idea what to do with an object as the value";
		}
	}
	else {	// Else if it's a simple type, try a strict equality comparison
		test = function(candidate) {
			return candidate === value;
		};
	}
	
	// Now iterate over the all, filtering using the test function we defined
	this.forEach(function(item) {
		if(
			(field !== null && test(item.attribs[field])) ||
			(field === null && test(item.attribs))
		) {
			matches.push(item);
		}
	});
	return new Clump(matches, this.type);	// And wrap the resulting array of objects in a new Clump object for sexy method chaining like x.query().forEach() or x.query().query()
};

Clump.prototype.toString = function() {
	return this.type.name + " Clump (" + this.size() + " items)";
};

Clump.prototype.toDom = function(size, includeChildren, tag, firstChild) {

	size = size || "normal";
	tag = tag || "ul";

	var element = document.createElement(tag);
	element.className = this.constructor.name.toLowerCase()+"-list "+size;
	if(firstChild) {
		element.appendChild(firstChild);
	}
	this.sortBy("Name").forEach(function(i) {
		element.appendChild(i.toDom(size, includeChildren));
	});
	return element;
}

Clump.prototype.describe = function() {
	var self = this;
	return Object.keys(this.items).map(function(i) { return self.items[i].toString() }).join(" and ")
};