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

server.on('query', (query) => {
  var domain = query.name();
  var type = query.type();
  //console.log('DNS Query: (%s) %s', type, domain);
  switch (type) {
    case 'A':
    case 'NS':
      var domain_original = query.name();
      if(config.DEBUG)
        console.log(query.type() + ' recieved: ' + domain_original);
      //Domain
      var domain = domain_original.toUpperCase() + '.';
      //Check memcached first
      memcached.get(domain, (err, data) => {
        if (err) throw err;
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
              //TODO: Glue records
              var record = resp.fields;
              //Type A
              if(resp._type == 'A') {
                var dns_record = new named.ARecord(record.ip_address[0]);
                query.addAnswer(domain_original, dns_record, 300, 'an');
                //Cache A record
                memcached.set(record._id, record.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                  if(err) throw err;
                  if(!config.DEBUG)
                    console.log('memcached - ' + data.domain_name_exact)
                });
                server.send(query);
              }
              //Type NS
              else {
                record.name_servers.map( (ns) => {
                  // Get rid of pesky trailing "."
                  var dns_record = new named.NSRecord(ns.substring(0, ns.length-1));
                  if(!config.DEBUG) console.log(dns_record);
                  return query.addAnswer(domain_original, dns_record, 300, 'ns');
                });
                domains_to_query = [];
                asynclib.each(record.name_servers, (nameserver, callback) => {
                  //Check memcached
                  memcached.get(nameserver, (err, data) => { //Result
                    if (err) throw err;
                    if(data == undefined) { //Need to query for this domain
                      domains_to_query.push(nameserver);
                    }
                    else { //Increase TTL
                      //Put glue A record in response
                      var dns_record = new named.ARecord(data);
                      // Get rid of pesky trailing "."
                      var domain_name_exact = nameserver.substring(0, nameserver.length-1);
                      query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                      memcached.touch(nameserver, config.CACHE_TIMEOUT, (err) => { if (err) throw err; });
                    }
                    callback();
                  });
                },
                (err) => { //All records processed
                  if (err) throw err;
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
                          var dns_record = new named.ARecord(data.ip_address[0]);
                          // Get rid of pesky trailing "."
                          var domain_name_exact = data.domain_name_exact[0].substring(0, data.domain_name_exact[0].length-1);
                          query.addAnswer(domain_name_exact, dns_record, 300, 'ar');
                          // Add to cache
                          memcached.set(data.domain_name_exact[0], data.ip_address[0], config.CACHE_TIMEOUT, (err) => { if(err) throw err; });
                        }
                      }
                      if (!config.DEBUG)
                        console.log(query);
                      server.send(query);
                    }).catch( (err) => { if(err) throw err; } );
                  }
                });
              }
            }
            else {
              if(!config.DEBUG)
                console.log('Not found in ES: ' + domain);
              server.send(query);
            }
          }).catch( (err) => {
            if (err.status == 404) {
              if(config.DEBUG)
                console.log('Not found in ES: ' + domain);
            }
            else {
              throw err;
            }
            server.send(query);
          });
        }
        else  {
          var dns_record = new named.ARecord(data);
          query.addAnswer(domain_original, dns_record, 300, 'an');
          //Increase TTL
          memcached.touch(domain, config.CACHE_TIMEOUT, (err) => {
            if (err) throw err;
          });
          server.send(query);
        }
      });
      break;
    case 'SOA':
      if(!config.DEBUG)
        console.log('SOA recieved: ' + domain);
      //req.params.originalDomain contains the original domains.
      //REVIEW: Temporary for com net and org
      if (domain === 'com' || domain === 'net' || domain === 'org') {
        var dns_record = new named.SOARecord('a.myownserver');
        query.addAnswer(domain, dns_record, 300, 'an');
        server.send(query);
      }
      else {
        server.send(query);
      }
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


server.listen(1053, '::ffff:192.168.0.239', function() {
  console.log('DNS server started on port 9999');
});
