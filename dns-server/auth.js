var asynclib = require('async');
var config = require('./config');
//DNS Auth server
var named = require('./lib/index');
var server = named.createServer();
//Memcached
var Memcached = require('memcached');
Memcached.config.poolSize = config.POOL_SIZE;
var memcached = new Memcached(config.MEMCACHED_HOSTS);
//Elasticsearch
var es     = require('elasticsearch');
var client = new es.Client({
  hosts: config.ES_HOSTS,
  maxSockets: config.MAX_SOCKETS
});

server.on('query', (query) => {
  var domain = query.name();
  var type = query.type();
  console.log('DNS Query: (%s) %s', type, domain);
  switch (type) {
    case 'A':
    case 'NS':
      lookupNSorA(query);
      break;
    case 'SOA':
      lookupSOA(query);
      break;
    default:
      // If we do not add any answers to the query then the
      // result will be a 'null-answer' message. This is how
      // you send a "404" to a DNS client
      server.send(query);
      break;
  }
});

server.on('clientError', (error) => {
  console.log("there was a clientError: %s", error);
});

server.on('uncaughtException', (error) => {
  console.log("there was an excepton: %s", error.message());

//Look up SOA Record
function lookupSOA(query) {
  var domain = query.name();
  if(!config.DEBUG)
    console.log('SOA recieved: ' + domain);
  //req.params.originalDomain contains the original domains.
  //REVIEW: Temporary for com net and org
  if (domain === 'com' || domain === 'net' || domain === 'org') {
    var dns_record = new named.SOARecord('a.myownserver');
    query.addAnswer(domain, dns_record, 300);
    return server.send(query);
  } else {
    return server.send(query);
  }
  //Santize input request (only accept TLDs for SOA)
  if (domain === '.' || !domain.endsWith('.') || (domain.match(/\./g) || []).length > 1 ) {
    return res_json(res, {result: false});
  }
  //Only TLDs will be searched.
  var tld = domain.substring(0, domain.length - 1).toLowerCase();
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

function lookupNSorA(query) {
  var domain_original = query.name();
  if(!config.DEBUG)
    console.log(query.type() + ' recieved: ' + domain_original);
  //Domain
  var domain = domain_original.toUpperCase();
  //Check memcached first
  memcached.get(domain, (err, data) => {
    if (err) throw err;
    if(data == undefined) { //Need to query ES for this domain
      //QueryJSON for ES
      var queryJSON = {
        index: config.INDEX,
        type: '_all',
        storedFields: ['name_servers', 'ip_address'],
        _source: false,
        id: domain,
        routing: domain
      };
      //Query ES
      client.get(queryJSON).then( (resp) => {
        if(!config.DEBUG)
          console.log(resp);
        if(resp.found) {
          //TODO: Glue records
          var record = resp.fields;
          //Type A
          if(resp.type == 'A') {
            var dns_record = new named.ARecord(record.ip_address[0]);
            query.addAnswer(domain_original, dns_record, 300);
          }
          //Type NS
          else {
            record.name_servers.map( (ns) => {
              var dns_record = new named.NSRecord(ns);
              return query.addAnswer(domain_original, dns_record, 300);
            });
          }
          return server.send(query);
        }
        else {
          if(!config.DEBUG)
            console.log('Not found in ES: ' + domain);
          // Add to negative cache
          memcached.set(domain, 'ENOTFOUND', config.CACHE_TIMEOUT, (err) => {
            if(err) throw err;
            if(!config.DEBUG)
              console.log('memcached - ' + data.domain_name_exact)
          });
          return server.send(query);
        }
      }).catch( (err) => {
        if (err.status == 404) {
          if(!config.DEBUG)
            console.log('Not found in ES: ' + domain);
          // Add to negative cache
          memcached.set(domain, 'ENOTFOUND', config.CACHE_TIMEOUT, (err) => {
            if(err) throw err;
            if(!config.DEBUG)
              console.log('memcached - ' + data.domain_name_exact)
          });
        } else {
          throw err;
        }
      });
    } else  {
      if (data != 'ENOTFOUND') {
        var dns_record = new named.ARecord(data);
        query.addAnswer(domain_original, dns_record, 300);
      }
      //Increase TTL
      memcached.touch(domain, config.CACHE_TIMEOUT, (err) => {
        if (err) throw err;
      });
      return server.send(query);
    }
  });
}
