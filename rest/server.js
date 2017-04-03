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

//Log time for every request recieved and filer unsupported responses
router.use(function(req, res, next){
if(config.LOG_TIME)
  console.log('Time: ', Date.now());
var url_sep = req.url.split("/");
var type = url_sep[url_sep.length - 1];
if(type !== config.SOA_TYPE && type !== config.NS_TYPE && type !== config.A_TYPE) {
  //Unsupported type
  return res.json({result: false});
} else {
  //Handle the request appropriately
  if(type == config.A_TYPE)
    console.log(req.url);
  next();
}
});

//Lookup callbacks are in the lookups.js file.
//A lookup
router.get('api/lookup/:originalDomain/A', lookup.A);
//NS lookup
router.get('/api/lookup/:originalDomain/NS', lookup.NS);
//SOA lookup
router.get('/api/lookup/:originalDomain/SOA', lookup.SOA);

//Mount router on app
app.use('/', router);

//Start server
app.listen(port);

console.log('Magic happens on port ' + port);
