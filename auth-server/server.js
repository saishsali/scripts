var asynclib = require('async');
var config = require('./config');
//DNS Auth server
var named = require('./node-named/lib/index');
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

function AQuery(query) {
  var domain_original = query.name();
  var domain = domain_original.toUpperCase() + '.';
  var original_query = JSON.parse(JSON.stringify(query));
  //Check cache if A record is present
  memcached.get(domain, (err, data) => {
    if (err) { console.trace(err.message); return server.send(original_query); }
    if(!config.DEBUG)
      console.log(domain + ' memcached resp1: ' + data);
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
        if(!config.DEBUG) console.log(resp);
        if(resp.found) {
          var record = resp.fields;
          switch(resp._type) {
            case 'A':
              var dns_record = new named.ARecord(record.ip_address[0]);
              //var dns_record = new named.ARecord('192.168.0.91');
              query.addAnswer(domain_original, dns_record, 300, 'an');
              //Cache A record
              memcached.set(resp._id, record.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                if(err) throw err;
                if(!config.DEBUG) console.log('memcached - ' + data.domain_name_exact)
              });
              return server.send(query);
              break;
            case 'NS':
              record.name_servers.map( (ns) => {
                // Get rid of pesky trailing "."
                var dns_record = new named.NSRecord(ns.substring(0, ns.length-1));
                if(!config.DEBUG) console.log(dns_record);
                return query.addAnswer(domain_original, dns_record, 300, 'ns');
              });
              domains_to_query = [];
              //Find the IP for each name server (if possible)
              asynclib.each(record.name_servers, (nameserver, callback) => {
                //Check memcached
                memcached.get(nameserver, (err, data) => { //Result
                  if (err) { console.trace(err.message); throw err; }
                  if(data == undefined) { //Need to query for this domain
                    domains_to_query.push(nameserver);
                  }
                  else { //Increase TTL
                    //Put glue A record in response
                    var dns_record = new named.ARecord(data);
                    //var dns_record = new named.ARecord('192.168.0.91');
                    // Get rid of pesky trailing "."
                    var domain_name_exact = nameserver.substring(0, nameserver.length-1);
                    query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                    memcached.touch(nameserver, config.CACHE_TIMEOUT, (err) => { if (err) console.trace(err.message); });
                  }
                  callback();
                });
              },
              (err) => { //All records processed
                if (err) { console.trace(err.message); return server.send(original_query); }
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
                    body: { docs: docs }
                  };
                  client.mget(queryJSON).then( (es_resp) => {
                    for (let i = 0; i < es_resp.docs.length; i++) {
                      var record = es_resp.docs[i];
                      if(!config.DEBUG) console.log(record)
                      if (record.found) {
                        var data = record.fields;
                        //Put glue A record in response
                        var dns_record = new named.ARecord(data.ip_address[0]);
                        //var dns_record = new named.ARecord('192.168.0.91');
                        // Get rid of pesky trailing "."
                        var domain_name_exact = data.domain_name_exact[0].substring(0, data.domain_name_exact[0].length-1);
                        query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                        // Add to cache
                        memcached.set(data.domain_name_exact[0], data.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                          if(err) console.trace(err.message);
                        });
                      }
                    }
                    if (!config.DEBUG) console.log(query);
                    return server.send(query);
                  }).catch( (err) => { if(err) { console.trace(err.message); return server.send(original_query); } } );
                }
                else {
                  return server.send(query);
                }
              });
              break;
            default:
              if(!config.DEBUG) console.log('A - ES resp _type was not NS or A');
              return server.send(original_query);
              break;
          }
        }
        else {
          if(!config.DEBUG) console.log('Not found in ES: ' + domain);
          return server.send(original_query);
        }
      }).catch( (err) => {
        if (!config.DEBUG && err.status == 404)  console.log('Not found in ES: ' + domain);
        else if (err.status != 404)  console.trace(err.message);
        return server.send(query);
      });
    }
    else  {
      var dns_record = new named.ARecord(data);
      //var dns_record = new named.ARecord('192.168.0.91');
      query.addAnswer(domain_original, dns_record, 300, 'an');
      //Increase TTL
      memcached.touch(domain, config.CACHE_TIMEOUT, (err) => {
        if (err) console.trace(err.message);
      });
      return server.send(query);
    }
  });
}

function NSQuery(query) {
  var domain_original = query.name();
  var domain = domain_original.toUpperCase() + '.';
  var original_query = JSON.parse(JSON.stringify(query));
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
    if(!config.DEBUG) console.log(resp);
    if(resp.found) {
      var record = resp.fields;
      switch(resp._type) {
        case 'NS':
          record.name_servers.map( (ns) => {
            // Get rid of pesky trailing "."
            var dns_record = new named.NSRecord(ns.substring(0, ns.length-1));
            if(!config.DEBUG) console.log(dns_record);
            return query.addAnswer(domain_original, dns_record, 300, 'an');
          });
          domains_to_query = [];
          //Find the IP for each name server (if possible)
          asynclib.each(record.name_servers, (nameserver, callback) => {
            //Check memcached
            memcached.get(nameserver, (err, data) => { //Result
              if (err) { console.trace(err.message); throw err; }
              if(data == undefined) { //Need to query for this domain
                domains_to_query.push(nameserver);
              }
              else { //Increase TTL
                //Put glue A record in response
                var dns_record = new named.ARecord(data);
                // Get rid of pesky trailing "."
                var domain_name_exact = nameserver.substring(0, nameserver.length-1);
                query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                memcached.touch(nameserver, config.CACHE_TIMEOUT, (err) => { if (err) console.trace(err.message); });
              }
              callback();
            });
          },
          (err) => { //All records processed
            if (err) { console.trace(err.message); return server.send(original_query); }
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
                body: { docs: docs }
              };
              client.mget(queryJSON).then( (es_resp) => {
                for (let i = 0; i < es_resp.docs.length; i++) {
                  var record = es_resp.docs[i];
                  if(!config.DEBUG) console.log(record)
                  if (record.found) {
                    var data = record.fields;
                    //Put glue A record in response
                    var dns_record = new named.ARecord(data.ip_address[0]);
                    // Get rid of pesky trailing "."
                    var domain_name_exact = data.domain_name_exact[0].substring(0, data.domain_name_exact[0].length-1);
                    query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                    // Add to cache
                    memcached.set(data.domain_name_exact[0], data.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                      if(err) console.trace(err.message);
                    });
                  }
                }
                if (!config.DEBUG) console.log(query);
                return server.send(query);
              }).catch( (err) => { if(err) { console.trace(err.message); return server.send(original_query); } } );
            }
            else {
              return server.send(query);
            }
          });
          break;
        default:
          if(!config.DEBUG) console.log('NS - ES resp _type was not NS');
          return server.send(original_query);
          break;
      }
    }
    else {
      if(!config.DEBUG) console.log('Not found in ES: ' + domain);
      return server.send(original_query);
    }
  }).catch( (err) => {
    if (!config.DEBUG && err.status == 404)  console.log('Not found in ES: ' + domain);
    else  console.trace(err.message);
    return server.send(original_query);
  });
}

function SOAQuery(query) {
  var domain = query.name();
  var original_query = JSON.parse(JSON.stringify(query));
  //Santize input request (only accept TLDs for SOA)
  if (domain.length == 0 || (domain.match(/\./g) || []).length > 0 ) {
    //Respond False
    server.send(original_query);
  }
  //Only TLDs will be searched.
  var tld = domain.toLowerCase();
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
      return server.send(original_query);
    }
    else { //Result found
      if(!config.DEBUG)
        console.log('Responding with fake SOA');
      var dns_record = new named.SOARecord('a.myownserver');
      query.addAnswer(domain, dns_record, 300, 'an');
      return server.send(query);
    }
  }).catch( (err) => { //Failure
    console.trace(err.message);
    //Respond False
    return server.send(original_query);
  });
}

server.on('query', (query) => {
  var domain = query.name();
  var type = query.type();
  if(!config.DEBUG) console.log(query.type() + ' Query: ' + domain);
  switch (type) {
    case 'A':
      //var a_record = new named.ARecord('192.168.0.91');
      //var ns_record = new named.NSRecord('A.NS.MYOWNSERVER.NET');
      //query.addAnswer(domain, ns_record, 300, 'ns');
      //query.addAnswer('A.NS.MYOWNSERVER.NET', a_record, 300, 'ar');
      //a_record = new named.ARecord('130.245.169.69');
      //ns_record = new named.NSRecord('B.NS.MYOWNSERVER.NET');
      //query.addAnswer(domain, ns_record, 300, 'ns');
      //query.addAnswer('B.NS.MYOWNSERVER.NET', a_record, 300, 'ar');
      //server.send(query);
      AQuery(query);
      break;
    case 'NS':
      NSQuery(query);
      break;
    case 'SOA':
      SOAQuery(query);
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
});

server.listen(config.PORT, config.IP, function() {
  console.log('DNS server started on port ' + config.PORT);
});
