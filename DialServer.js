const dial = require("peer-dial");
const http = require('http');
const express = require('express');
const { spawn } = require('cross-spawn');
const { IpcClient } = require('./ipc.js');

const app = express();
const server = http.createServer(app);
const PORT = 8569;
const MANUFACTURER = "Kevin Townsend";
const MODEL_NAME = "DIAL Server";
let child = null;

const apps = {
  "YouTube": {
    name: "YouTube",
    state: "stopped",
    allowStop: true,
    pid: null,
    launch: function (launchData, config) {
      let url = "http://www.youtube.com/tv?"+launchData;
      
      child = spawn('npm', ['start'], {
        cwd: 'modules/MMM-Screencast'
      });

      this.ipc = new IpcClient((self) => {
        self.on('connect', (data) => {
          self.emit('SEND_CONFIG', { ...config, url: "http://www.youtube.com/tv?"+launchData });
        });
      });

      child.stdout.on('data', function(data) {
         console.log('screencast stdout: ' + data);
      });

      child.stderr.on('data', function(data) {
         console.log('screencast stderr: ' + data);
      });

      child.on('close', function(code) {
         console.log('closing code: ' + code);
      });
    }
  }
};

var dialServer = new dial.Server({
  corsAllowOrigins: true,
  expressApp: app,
  port: PORT,
  prefix: "/dial",
  manufacturer: MANUFACTURER,
  modelName: MODEL_NAME,
  launchFunction: null,
  electronConfig: {},
  delegate: {
    getApp: function(appName) {
      return apps[appName];
    },
    
    launchApp: function(appName, lauchData, callback){
      const app = apps[appName];
      if (app) {
        app.pid = "run";
        app.state = "starting";
        app.launch(lauchData, dialServer.electronConfig);
        app.state = "running";
      }

      callback(app.pid);
    },

    stopApp: function(appName, pid, callback) {
      console.log("Got request to stop", appName," with pid: ", pid);
      const app = apps[appName];
      
      if (app && app.pid == pid) {
        app.pid = null;
        app.state = "stopped";
        app.ipc.on('quit', (data) => {
          app.ipc.disconnect();
        });
        app.ipc.emit('quit');

        child = null;
        callback(true);
      }
      else {
        callback(false);
      }
    }
  }
});

var App = function() {
  this.config = {};
  this.server = http.createServer(app);

  this.start = function(config) {
    dialServer.electronConfig = config;

    this.server.listen(PORT, function() {
      dialServer.start();
      console.log("DIAL Server is running on PORT "+PORT);
    });
  };

};

module.exports = new App();
