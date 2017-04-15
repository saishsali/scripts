//Variables and other configuration
const DEBUG = false;
var config = require('./config');
//Server Dependencies
var express    = require('express');
var app        = express();
var router     = express.Router();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
//REST Dependencies
var Promise = require('bluebird');
var config = require('./config');
var async = require('async');
//Memcached
var Memcached = require('memcached');
var memcached = Promise.promisifyAll(new Memcached('127.0.0.1'));
//Elasticsearch
var es     = require('elasticsearch');
var client = new es.Client({
  hosts: [
      "192.168.0.204:9200","192.168.0.21:9200","192.168.0.22:9200",
      "192.168.0.23:9200","192.168.0.205:9200","192.168.0.206:9200",
      "192.168.0.208:9200","192.168.0.209:9200","192.168.0.210:9200",
      "192.168.0.212:9200","192.168.0.213:9200","192.168.0.214:9200",
      "192.168.0.215:9200","192.168.0.216:9200","192.168.0.217:9200",
      "192.168.0.218:9200","192.168.0.219:9200","192.168.0.221:9200",
      "192.168.0.222:9200","192.168.0.223:9200","192.168.0.224:9200",
      "192.168.0.225:9200","192.168.0.226:9200","192.168.0.227:9200",
      "192.168.0.228:9200","192.168.0.229:9200"
  ],
  maxSockets: 20
});

function lookupSOA(req, res) {
  if(!config.DEBUG)
    console.log('SOA recieved: ' + req.params.originalDomain);
  //req.params.originalDomain contains the original domains.
  var domain = req.params.originalDomain;
  //Santize input request (only accept TLDs for SOA)
  if (domain === '.' || !domain.endsWith('.')) {
    return res_json(res, {result: false});
  }
  //Only TLDs will be searched.
  var tld = domain.substring(0, domain.length - 1);
  //QueryJSON for ES
  var queryJSON = {
    index: config.INDEX,
    q: config.ZONE_QUERY + tld,
    method: 'GET',
    size: 0,
    terminateAfter: 1
  };
  //Contact ES using promise.
  client.search(queryJSON).then( (resp) => { //Success
    if (resp.hits.total === 0) { //No hits found
      //Respond False
      return res_json(res, {result: false});
    }
    else { //Results found
      var result = {
        result: [{
            qtype: config.SOA_TYPE,
            qname: domain,
            content: config.DUMMY_SOA,
            ttl: config.TTL
          }]
      };
      if(!config.DEBUG)
        console.log('Responding with fake SOA');
      return res_json(res, result);
    }
  }).catch( (err) => { //Failure
    console.trace(err.message);
    //Respond False
    return res_json(res, {result: false});
  });
}

function lookupNS(req, res) {
  if(!config.DEBUG)
    console.log('NS recieved: ' + req.params.originalDomain);
  //Domain
  var domain = req.params.originalDomain.toUpperCase();
  //QueryJSON for ES
  var queryJSON = {
    index: config.INDEX,
    type: config.NS_TYPE,
    storedFields: ['name_servers'],
    _source: false,
    id: domain,
    routing: domain
  };
  //Contact ES using promise.
  client.get(queryJSON).then( (resp) => {
    if(!config.DEBUG)
      console.log(resp);
    //Response found
    if(resp.found) {
      var result = {result: null};
      var record = resp.fields;
      //Generate response for PDNS
      result.result = record.name_servers.map( ns => {
        return {qtype: config.NS_TYPE, qname: req.params.originalDomain, content: ns, ttl: config.TTL};
      });
      var domains_to_query = [];
      async.each(record.name_servers, (nameserver, callback) => {
        //Check memcached
        memcached.getAsync(nameserver).then( (data) => { //Result
          if(data == undefined) {
            //Need to query for this domain
            domains_to_query.push(nameserver);
          } else {
            //Put glue A record in response
            if (data != 'NOTFOUND') {
              result.result.push({
                qtype: config.A_TYPE,
                qname: nameserver,
                content: data,
                ttl: config.TTL
              });
            }
            //Increase TTL
            memcached.touch(nameserver, config.CACHE_TIMEOUT, (err) => {
              if (err) {
                console.error(err);
                console.trace(err);
                throw err;
              }
            });
          }
          callback();
        }).catch( (err) => { //Error
          console.error(err);
          console.trace(err);
          throw err;
        });
      },
      (err) => { //Async competed/failed
        if(err) {
          return err_resp(res, err);
        }
        if(!config.DEBUG)
          console.log(domains_to_query);
        if(domains_to_query.length != 0) {
          docs = [];
          for (let i = 0; i < domains_to_query.length; i++) {
            docs.push({
              _id: domains_to_query[i],
              _routing: domains_to_query[i]
            });
          }
          var queryJSON = {
            index: config.INDEX,
            type: config.A_TYPE,
            storedFields: ['domain_name_exact', 'ip_address'],
            _source: false,
            body: {
              docs: docs
            }
          };
          client.mget(queryJSON).then( (es_resp) => {
            for (let i = 0; i < es_resp.docs.length; i++) {
              var record = es_resp.docs[i];
              if(!config.DEBUG)
                console.log(record)
              if (record.found) {
                var data = record.fields;
                //Put glue A record in response
                result.result.push({
                  qtype: config.A_TYPE,
                  qname: data.domain_name_exact[0],
                  content: data.ip_address[0],
                  ttl: config.TTL
                });
                // Add to cache
                memcached.set(data.domain_name_exact[0], data.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                  if(err) {
                    console.error(error);
                    console.trace(err);
                    throw err;
                  }
                  if(!config.DEBUG)
                    console.log('memcached - ' + data.domain_name_exact)
                });
              }
              else {
                // Add to negative cache
                memcached.set(record._id, 'NOTFOUND', config.CACHE_TIMEOUT, (err) => {
                  if(err) {
                    console.error(error);
                    console.trace(err);
                    throw err;
                  }
                  if(!config.DEBUG)
                    console.log('memcached + ' + data.domain_name_exact)
                });
              }
            }
            if(!config.DEBUG)
              console.log(result);
            return res_json(res, result);
          }).catch( (es_err) => { //ES Get Error
            return err_resp(res, es_err);
          });
        }
        else {
          if(!config.DEBUG)
            console.log(result);
          return res_json(res, result);
        }
      });
    }
    else {
      return res_json(res, {result: false});
    }
  }).catch( (err) => {
    if(err.status !== 404) {
      console.trace(err.message);
    }
    if (!config.DEBUG) {
      console.log('Not Found: ' + domain);
    }
    //Respond false
    return res_json(res, {result: false});
  });
}

function lookupA(req, res) {
  if(!config.DEBUG)
    console.log('A recieved: ' + req.params.originalDomain);
  var domain = req.params.originalDomain.toUpperCase();
  memcached.getAsync(domain).then( (data) => {
    if (data === undefined) {
      var queryJSON = {
        index: config.INDEX,
        type: config.A_TYPE,
        id: domain,
        storedFields: ["ip_address"],
        _source: false,
        routing: domain
      };
      client.get(queryJSON).then( (resp) => { // ES get response
        if (resp.found) {
          var record = resp.fields;
          var result = {
            result: [{
              qtype: config.A_TYPE,
              qname: domain,
              content: record.ip_address[0],
              ttl: config.TTL
            }]
          };
          if(!config.DEBUG) {
            console.log("A - Cache miss - Found");
            console.log(result);
          }
          return res_json(res, result);
        } else {
          //No result found.
          res_json(res, {result: false});
          if (!config.DEBUG)
            console.log("A - Cache miss - Not Found");
        }
      }).catch( (err) => { // ES get error
        if (!config.DEBUG)
          console.log("A - Cache miss - Error");
        return err_resp(res, err);
      });
    }
    else if (data !== 'NOTFOUND') { //Positive cache hit.
      var result = {
        result: [{
          qtype: config.A_TYPE,
          qname: domain,
          content: data,
          ttl: config.TTL
        }]
      };
      if(!config.DEBUG) {
        console.log(result);
        console.log("A - Cache hit - Positive");
      }
      return res_json(res, result);
    }
    else { //Negative cache hit.
      if (!config.DEBUG)
        console.log("A - Cache hit - Negative");
      return res_json(res, {result: false});
    }
  }).catch( (err) => {
    return err_resp(res, err);
  });
}

function err_resp(res, err) {
  res.json({result: false});
  console.trace(err);
}

function res_json(res, json) {
  return res.json(json);
}

//Lookup callbacks are in the lookups.js file.
//A lookup
router.get('/:originalDomain/A', lookupA);
//NS lookup
router.get('/:originalDomain/NS', lookupNS);
//SOA lookup
router.get('/:originalDomain/SOA', lookupSOA);

//Mount router on app
app.use('/api/lookup', router);
//Set port
var port = process.env.PORT || 8080;        // set our port
app.use(bodyParser.urlencoded({ extended: false }));
//Start server
app.listen(port);

console.log('Magic happens on port ' + port);
