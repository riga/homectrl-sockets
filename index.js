// load modules
var hc    = require("homectrl");
var exec  = require("child_process").exec;
var async = require("async");


// define and export our plugin
module.exports = hc.Plugin._extend({

  setup: function setup() {
    setup._super.call(this);

    var self = this;

    // an async queue with concurrency 1
    this.queue = async.queue(function(task, callback) {
      self.triggerSocket(task.id, task.state, callback);
    }, 1);

    // define an agenda job processor
    this.server.agenda.define(this.prefix("trigger"), function(job, done) {
      self.queue.push(job.attrs.data, done);
    });

    // setup messages and routes
    this.setupMessages();
    this.setupRoutes();

    var logData = this.config.get("sockets").map(function(socket) {
      return socket.label + " (" + socket.descr + ")";
    });
    this.logger.info("setup: %s", logData.join(", "));

    return this;
  },


  triggerSocket: function(id, state, callback) {
    var self = this;

    var socket = this.config.get("sockets")[id];
    if (!socket) {
      callback(new Error("undefined socket " + id));
      return this;
    }

    var tasks    = [];
    var cmd      = [this.config.get("command"), socket.code, state ? "1" : "0"].join(" ");
    var nSignals = this.config.get("nSignals");

    for (var i = 0; i < nSignals; ++i) {
      tasks.push(function(callback) {
        exec(cmd, callback);
      });
    }

    async.series(tasks, function(err) {
      if (err) {
        self.logger.error(err);
        return callback(err);
      }

      self.logger.debug("switch %s %s(%s)",
        state ? "on" : "off", socket.label, socket.descr);

      callback(null);
    });

    return this;
  },


  setupMessages: function() {
    var self = this;

    this.on("in.trigger", function(socketId, id, state) {
      self.queue.push({ id: id, state: state });
    });

    this.on("in.triggerAll", function(socketId, state) {
      for (var id in self.config.get("sockets")) {
        self.queue.push({ id: id, state: state });
      }
    });

    return this;
  },


  setupRoutes: function() {
    var self = this;

    var socketData = this.config.get("sockets");
    socketData.forEach(function(data, i) {
      data.id = i;
    });

    var parseState = function(state) {
      return {
        1    : true,
        0    : false,
        on   : true,
        off  : false,
        true : true,
        false: false
      }[state];
    };

    this.GET("sockets", function(req, res) {
      hc.send(res, socketData);
    });

    this.GET("socket/:id", function(req, res) {
      var id = parseInt(req.params.id);

      if (isNaN(id) || id >= socketData.length) {
        hc.send(res, 404, "invalid id");
      } else {
        hc.send(res, socketData[id]);
      }
    });

    this.POST("socket/:id/:state", function(req, res) {
      var id    = parseInt(req.params.id);
      var state = parseState(req.params.state);

      if (isNaN(id) || id >= socketData.length) {
        hc.send(res, 500, "invalid id");
      } else if (state == null) {
        hc.send(res, 500, "invalid state");
      } else {
        self.queue.push({ id: id, state: state });

        hc.send(res);
      }
    });

    this.POST("sockets/:state", function(req, res) {
      var state = parseState(req.params.state);

      if (state == null) {
        hc.send(res, 500, "invalid state");
      } else {
        for (var id in socketData) {
          self.queue.push({ id: id, state: state });
        }

        hc.send(res);
      }
    });

    return this;
  }

});
