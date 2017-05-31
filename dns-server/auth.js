var asynclib = require('async');
var deasync = require('deasync');
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
  var done = false;
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
        if(config.DEBUG)
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
            if(config.DEBUG)
              console.log(resp);
            if(resp.found) {
              //TODO: Glue records
              var record = resp.fields;
              //Type A
              if(resp.type == 'A') {
                var dns_record = new named.ARecord(record.ip_address[0]);
                query.addAnswer(domain_original, dns_record, 300);
                //Cache A record
                memcached.set(record._id, record.ip_address[0], config.CACHE_TIMEOUT, (err) => {
                  if(err) throw err;
                  if(!config.DEBUG)
                    console.log('memcached - ' + data.domain_name_exact)
                });
              }
              //Type NS
              else {
                record.name_servers.map( (ns) => {
                  var dns_record = new named.NSRecord(ns);
                  if(config.DEBUG)
                    console.log(dns_record);
                  return query.addAnswer(domain_original, dns_record, 300);
                });
              }
              server.send(query);
              done = true;
            }
            else {
              if(!config.DEBUG)
                console.log('Not found in ES: ' + domain);
              // // Add to negative cache
              // memcached.set(domain, 'ENOTFOUND', config.CACHE_TIMEOUT, (err) => {
              //   if(err) throw err;
              //   if(!config.DEBUG)
              //     console.log('memcached - ' + data.domain_name_exact)
              // });
              server.send(query);
              done = true;
            }
          }).catch( (err) => {
            if (err.status == 404) {
              if(config.DEBUG)
                console.log('Not found in ES: ' + domain);
              // // Add to negative cache
              // memcached.set(domain, 'ENOTFOUND', config.CACHE_TIMEOUT, (err) => {
              //   if(err) throw err;
              //   if(!config.DEBUG)
              //     console.log('memcached - ' + data.domain_name_exact)
              // });
            }
            else {
              throw err;
            }
            server.send(query);
            done = true;
          });
        }
        else  {
          if (data != 'ENOTFOUND') {
            var dns_record = new named.ARecord(data);
            query.addAnswer(domain_original, dns_record, 300);
            //Increase TTL
            memcached.touch(domain, config.CACHE_TIMEOUT, (err) => {
              if (err) throw err;
            });
          }
          server.send(query);
          done = true;
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
        query.addAnswer(domain, dns_record, 300);
        server.send(query);
        done = true;
      }
      else {
        server.send(query);
        done = true;
      }
      break;
    default:
      // If we do not add any answers to the query then the
      // result will be a 'null-answer' message. This is how
      // you send a "404" to a DNS client
      server.send(query);
      done = true;
      break;
  }
  deasync.loopWhile(function(){return !done;});
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
