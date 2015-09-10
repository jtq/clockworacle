var dragndrop = require('./ui/dragndrop');
var query = require('./ui/query');


$("#tabs .buttons li").on("click", function(e) {

  var type = $(this).attr("data-type");

  $("#tabs .panes .pane").hide(); // Hide all panes
  $("#tabs .buttons li").removeClass("active"); // Deactivate all buttons

  $("#tabs .panes ."+type.toLowerCase()).show();
  $("#tabs .buttons [data-type="+type+"]").addClass("active");
});

// Setup the dnd listeners.
var dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragenter', dragndrop.handlers.dragOver, false);
dropZone.addEventListener('dragleave', dragndrop.handlers.dragEnd, false);
dropZone.addEventListener('dragover', dragndrop.handlers.dragOver, false);

dropZone.addEventListener('drop', dragndrop.handlers.dragDrop, false);

document.getElementById('paths-to-node').addEventListener('click', query.pathsToNode, false);

