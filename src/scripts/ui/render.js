var api = require('../sunless-sea');

function renderLists() {
  Object.keys(api.loaded).forEach(function(type) {
    renderList(api.loaded[type]); // Only display directly loaded (root-level) Lumps, to prevent the list becoming unwieldy
  });
}

function renderList(clump) {
	var root = document.getElementById(clump.type.name.toLowerCase()+"-list");
  if(root) {
	 root.appendChild(clump.toDom());
  }
}

module.exports = {
	list: renderList,
	lists: renderLists
};