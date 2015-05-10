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
      self.triggerSocket(task.i, task.state, callback);
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


  triggerSocket: function(i, state, callback) {
    var self = this;

    var socket = this.config.get("sockets")[i];
    if (!socket) {
      callback(new Error("undefined socket " + i));
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

    this.on("in.trigger", function(socketId, i, state) {
      self.queue.push({ i: i, state: state });
    });

    this.on("in.triggerAll", function(socketId, state) {
      for (var i in self.config.get("sockets")) {
        self.queue.push({ i: i, state: state });
      }
    });

    return this;
  },


  setupRoutes: function() {
    var self = this;

    this.GET("/sockets", function(req, res) {
      hc.send(res, self.config.get("sockets"));
    });

    return this;
  }

});
