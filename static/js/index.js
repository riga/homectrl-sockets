define([
  "homectrl",
  "jquery",
  "async",
  "css!../css/styles"
], function(hc, $, async) {

  // define and return our plugin
  return hc.Plugin._extend({

    setup: function setup() {
      setup._super.call(this);


      // set the label and bootstrap icon class
      this.label = "Sockets";
      this.iconClass = "flash";

      // setup the UI
      this.setupUI();
    },


    setupUI: function() {
      var self = this;


      // parallel loading of socket data our template
      async.parallel([
        function(callback) {
          self.ajax("get", "sockets", callback);
        },
        function(callback) {
          self.getTemplate("index.jade", callback);
        }
      ], function(err, results) {
        if (err) {
          return self.logger.error(err) && self.alert(err);
        }

        var sockets = results[0][0];
        var tmpl    = results[1][0];

        var directives = {
          "socket": {
            action: function(data) {
              $(data.element).attr("id", data.index);
            }
          }
        };

        // render the bootstrap button groups
        self.nodes.$content.append(tmpl).find("#sockets").render(sockets, directives);

        // events
        self.nodes.$content.find("#all-on").click(function() {
          self.emit("out.triggerAll", true);
        });

        self.nodes.$content.find("#all-off").click(function() {
          self.emit("out.triggerAll", false);
        });

        // loop through sockets and add events to buttons
        sockets.forEach(function(_, i) {
          var $on = self.nodes.$content.find("#sockets > .socket#" + i + " #on");
          $on.click(function() {
            self.emit("out.trigger", i, true);
          });

          var $off = self.nodes.$content.find("#sockets > .socket#" + i + " #off");
          $off.click(function() {
            self.emit("out.trigger", i, false);
          });
        });
      });


      return this;
    }
  });

});
