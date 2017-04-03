//Variables and other configuration
const DEBUG = false;
var config = require('./config');
var lookup = require('./lookups');
//REST Dependencies
var express    = require('express');
var app        = express();
var router     = express.Router();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

//Set port
var port = process.env.PORT || 8080;        // set our port

app.use(bodyParser.urlencoded({ extended: false }));

//Lookup callbacks are in the lookups.js file.
//A lookup
router.get('/:originalDomain/A', lookup.A);
//NS lookup
router.get('/:originalDomain/NS', lookup.NS);
//SOA lookup
router.get('/:originalDomain/SOA', lookup.SOA);

//Mount router on app
app.use('/api/lookup', router);

//Start server
app.listen(port);

console.log('Magic happens on port ' + port);
