// declare the namespace for this example
var example = {};

/**
 *
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 *
 * @author Andreas Herz
 * @extends draw2d.ui.parts.GraphicalEditor
 */
example.Application = Class.extend({
    NAME: "example.Application",

    /**
     * @constructor
     *
     * @param {String} canvasId the id of the DOM element to use as paint container
     */
    init: function () {
        this.view = new example.View("canvas");
        var canvas = document.getElementById("canvas");

        var policy = new draw2d.policy.canvas.PanningSelectionPolicy;
        this.view.installEditPolicy(policy);
        canvas.style.cursor = "move";

        this.toolbar = new example.Toolbar("toolbar", this.view);
    }
});