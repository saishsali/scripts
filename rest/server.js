//Variables and other configuration
const DEBUG = false;
var config = require('./config');
//Server Dependencies
var express    = require('express');
var app        = express();
var lookup_api = require('./lookups');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

//Mount router on app
app.use('/api/lookup', lookup_api);
//Set port
var port = process.env.PORT || 8080;        // set our port
app.use(bodyParser.urlencoded({ extended: false }));
//Start server
app.listen(port);

console.log('Magic happens on port ' + port);
