var api = require('./sunless-sea');

var library = require('./library');
var Clump = require('./objects/clump');
var dragndrop = require('./ui/dragndrop');
var query = require('./ui/query');


    $("#tabs .buttons li").on("click", function(je) {

      var type = $(this).attr("data-type");

      $("#tabs .panes .pane").hide(); // Hide all panes
      $("#tabs .buttons li").removeClass("active"); // Deactivate all buttons

      $("#tabs .panes ."+type.toLowerCase()).show();
      $("#tabs .buttons [data-type="+type+"]").addClass("active");
    });

    // Setup the dnd listeners.
    window.object_types_to_load = 0;
    var dropZone = document.getElementById('drop-zone');

    dropZone.addEventListener('dragenter', dragndrop.handlers.dragOver, false);
    dropZone.addEventListener('dragleave', dragndrop.handlers.dragEnd, false);
    dropZone.addEventListener('dragover', dragndrop.handlers.dragOver, false);

    dropZone.addEventListener('drop', dragndrop.handlers.dragDrop, false);

    document.getElementById('paths-to-node').addEventListener('click', query.pathsToNode, false);

    var whatIs = function(id) {
      var possibilities = [];
      Object.keys(api.library).forEach(function(key) {
        if(api.library[key] instanceof Clump && api.library[key].id(id)) {
          possibilities.push(key);
        }
      });
      return possibilities;
    };
    
    window.onload = function() {
      window.all = {  // Master lookup of all discovered elements
        Quality: new Clump([], api.types.Quality),
        Event: new Clump([], api.types.Event),
        Interaction: new Clump([], api.types.Interaction),
        QualityEffect: new Clump([], api.types.QualityEffect),
        QualityRequirement: new Clump([], api.types.QualityRequirement),
        Area: new Clump([], api.types.Area),
        SpawnedEntity: new Clump([], api.types.SpawnedEntity),
        CombatAttack: new Clump([], api.types.CombatAttack),
        Exchange: new Clump([], api.types.Exchange),
        Shop: new Clump([], api.types.Shop),
        Availability: new Clump([], api.types.Availability),
        Tile: new Clump([], api.types.Tile),
        TileVariant: new Clump([], api.types.TileVariant),
        Port: new Clump([], api.types.Port)
      };

      window.loaded = { // All elements loaded directly from the root of a file (ie, not embedded in any other element).  Each member is overwritten when loading a new file of that type
        Quality: new Clump([], api.types.Quality),
        Event: new Clump([], api.types.Event),
        Interaction: new Clump([], api.types.Interaction),
        QualityEffect: new Clump([], api.types.QualityEffect),
        QualityRequirement: new Clump([], api.types.QualityRequirement),
        Area: new Clump([], api.types.Area),
        SpawnedEntity: new Clump([], api.types.SpawnedEntity),
        CombatAttack: new Clump([], api.types.CombatAttack),
        Exchange: new Clump([], api.types.Exchange),
        Shop: new Clump([], api.types.Shop),
        Availability: new Clump([], api.types.Availability),
        Tile: new Clump([], api.types.Tile),
        TileVariant: new Clump([], api.types.TileVariant),
        Port: new Clump([], api.types.Port)
      };
    };