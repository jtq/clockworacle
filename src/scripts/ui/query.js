var api = require('../api');
var Clump = require('../objects/clump');

function RouteNode(node) {
  this.node = node;
  this.children = [];
}

function pathsToNode() {

  var type = document.getElementById('type');
  type = type.options[type.selectedIndex].value;

  var operation = document.getElementById('operation');
  operation = operation.options[operation.selectedIndex].value;

  var id = prompt("Id of "+type);

  if(!id) {  // Cancelled dialogue
    return;
  }

  var item = api.library[type].id(id);

  if(!item) {
    alert("Could not find "+type+" "+id);
    return;
  }

  var root = document.getElementById("query-tree");
  root.innerHTML = "";

  var title = $('.pane.query .pane-title').text("Query: "+item.toString());

  var routes = pathsToNode_Recurse(item, {});

  console.log("All routes", routes);

  if(routes && routes.children.length) {

    // Filter routes by operation
    if(operation !== "any") {
      routes.children = routes.children.filter(function(route_node) {

        lump = route_node.node;

        if(operation === "additive") {
          return lump.isOneOf([api.types.QualityEffect, api.types.Availability]) && lump.isAdditive();
        }
        else if(operation === "subtractive") {
          return lump.isOneOf([api.types.QualityEffect, api.types.Availability]) && lump.isSubtractive();
        }
      });
    }

    console.log("Passing routes", routes);

    var top_children = document.createElement("ul");
    top_children.className += "clump-list small";

    routes.children.forEach(function(child_route) {
      var tree = pathsToNode_Render(child_route, []);
      top_children.appendChild(tree);
    });

    root.appendChild(top_children);
  }
  else {
    alert("This "+type+" is a root node with no parents that satisfy the conditions");
  }
  
}

function pathsToNode_Recurse(node, seen, parent) {

  if(seen[node.Id]) {   // Don't recurse into nodes we've already seen
    return false;
  }

  var ancestry = jQuery.extend({}, seen);
  ancestry[node.Id] = true;

  var this_node = new RouteNode(/*node.linkToEvent ? node.linkToEvent :*/ node); // If this node is just a link to another one, skip over the useless link

  if(node instanceof api.types.SpawnedEntity) {
    return this_node;   // Leaf node in tree
  }
  else if(node instanceof api.types.Event && node.tag === "use") {
    return this_node;   // Leaf node in tree
  }
  else if(node instanceof api.types.Event && parent instanceof api.types.Event && (parent.tag === "killed" || parent.tag === "pacified")) { // If this is an event that's reachable by killing a monster, don't recurse any other causes (as they're usually misleading/circular)
    return false;
  }
  else if (node instanceof api.types.Port) {
    return new RouteNode(node.area);
  }
  else if(node.limitedToArea && node.limitedToArea.Id !== 101956) {
    var area_name = node.limitedToArea.Name.toLowerCase();
    var event_name = node.Name.toLowerCase();
    if(area_name.indexOf(event_name) !== -1 || event_name.indexOf(area_name) !== -1) {  // If Area has similar name to Event, ignore the event and just substitute the area
      return new RouteNode(node.limitedToArea);
    }
    else {
      this_node.children.push(new RouteNode(node.limitedToArea));   // Else include both the Area and the Event
      return this_node;
    }
    
  }
  else {
    for(var i=0; i<node.parents.length; i++) {
      var the_parent = node.parents[i];
      var subtree = pathsToNode_Recurse(the_parent, ancestry, node);
      if(subtree) {
        this_node.children.push(subtree);
      }
    }
    if(!this_node.children.length) {
      return false;
    }
  }

  return this_node;
}

function pathsToNode_Render(routeNode, ancestry) {
  
  if(!(routeNode instanceof RouteNode)) {
    return null;
  }

  var element = routeNode.node.toDom("small", false);
  
  var child_list = document.createElement("ul");
  child_list.className += "clump-list small child-list";

  var new_ancestry = ancestry.slice();
  new_ancestry.push(routeNode.node);
  routeNode.children.forEach(function(child_route, index, children) {
    var child_content = pathsToNode_Render(child_route, new_ancestry);
    child_list.appendChild(child_content);
  });

  if(routeNode.children.length) {
    element.appendChild(child_list);
  }
  else {
    var description = document.createElement("li");
    description.innerHTML = "HINT: " + describe(new_ancestry);
    var total_requirements = requirements(new_ancestry);
    description.appendChild(total_requirements.toDom("small", false));
    element.appendChild(description);
  }

  return element;
}

function describe(ancestry) {
  var a = ancestry.slice().reverse();

  function lower(text) {
    return text.slice(0,1).toLowerCase()+text.slice(1);
  }
  
  var guide = "";
  if(a[0] instanceof api.types.Area) {
    if(a[1] instanceof api.types.Event) {
      guide = "Seek "+a[1].Name+" in "+a[0].Name;
      if(a[2] instanceof api.types.Interaction) {
        guide += " and ";
        if("\"'".indexOf(a[2].Name[0]) !== -1) {
          guide += "exclaim ";
        }
        guide += lower(a[2].Name);
      }
      guide += ".";
    }
    else {
      guide = "Travel to "+a[0].Name;

      if(a[1] instanceof api.types.Interaction) {
        guide += " and "+lower(a[1].Name);
      }
      else if(a[1] instanceof api.types.Exchange && a[2] instanceof api.types.Shop) {
        guide += " and look for "+a[2].Name+" in "+a[1].Name;
      }

      guide += ".";
    }
  }
  else if(a[0] instanceof api.types.SpawnedEntity) {
    guide = "Find and best a "+a[0].HumanName;
    if(a[2] instanceof api.types.Interaction) {
      guide += ", then " + lower(a[2].Name);
    }
    guide += ".";
  }
  else if(a[0] instanceof api.types.Event && a[0].tag === "use" && !(a[1] instanceof api.types.QualityRequirement)) {
    guide = "Acquire " + lower(a[0].Name) + " and " + lower(a[1].Name) + ".";
  }

  return guide;
}

function requirements(ancestry) {

  var reqs = {};

  // Ancestry is ordered from last->first, so iterate backwards from final effect -> initial cause
  ancestry.forEach(function(step) {
    /* Simplification: if an event modifies a quality then assume that later requirements
    on the same quality are probably satisfied by that modification (eg, when qualities
    are incremented/decremented to control story-quest progress). */
    if(step.qualitiesAffected) {
      step.qualitiesAffected.forEach(function(effect) {
        delete(reqs[effect.associatedQuality.Id]);
      });
    }
    // Now add any requirements for the current stage (earlier requirements overwrite later ones on the same quality)
    if(step.qualitiesRequired) {
      step.qualitiesRequired.forEach(function(req) {
        if(req.associatedQuality) { // Check this is a valid QualityRequirement, and not one of the half-finished debug elements referring to anon-existant Quality
          reqs[req.associatedQuality.Id] = req;
        }
      });
    }
  });

  var result = Object.keys(reqs).map(function(key) { return reqs[key]; });

  return new Clump(result, api.types.QualityRequirement);
}

module.exports = {
  RouteNode: RouteNode,
  pathsToNode: pathsToNode
};