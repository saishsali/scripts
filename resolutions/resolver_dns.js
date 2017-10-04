const QUEUE_ASYNC = 20000;
const CARGO_ASYNC = 20000;
const SATURATED = 20000;
const RABBIT_PREFETCH = 2;

var maxmind = require('maxmind');
var cityLookup = maxmind.openSync('GeoLite2-City.mmdb', { cache: {
    max: 1000, // max items in cache
    maxAge: 1000 * 60 // life time in milliseconds
  }
});
var countryLookup = maxmind.openSync('GeoLite2-Country.mmdb', { cache: {
    max: 1000, // max items in cache
    maxAge: 1000 * 60 // life time in milliseconds
  }
});

var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
    hosts: [
        "192.168.0.104:9200",
        "192.168.0.105:9200",
        "192.168.0.106:9200",
        "192.168.0.107:9200",
        "192.168.0.108:9200",
        "192.168.0.109:9200",
        "192.168.0.110:9200",
        "192.168.0.111:9200",
        "192.168.0.112:9200",
        "192.168.0.113:9200",
        "192.168.0.114:9200",
        "192.168.0.117:9200",
        "192.168.0.119:9200",
        "192.168.0.120:9200",
        "192.168.0.121:9200",
        "192.168.0.122:9200",
        "192.168.0.123:9200",
        "192.168.0.124:9200",
        "192.168.0.125:9200",
        "192.168.0.127:9200",
        "192.168.0.128:9200",
        "192.168.0.129:9200",
        "192.168.0.13:9200",
        "192.168.0.130:9200",
        "192.168.0.131:9200"
    ]
});

var amqp = require('amqplib/callback_api');
var dns = require('dns');
var deasync = require('deasync')
var async = require('async');

if (process.argv.length !== 4) {
    console.log("ERROR: Improper arguments provided.");
    console.log("Usage: node " + __filename.split("/").pop() + "<rabbit_master_ip> <input_queue>\n\n" +
        "1. Performs function in Javascript to append to record and sends it back to ES for \n" +
        "reindexing via a rabbitmq queue to be picked up by logstash. \n");
    process.exit(1);
}

var rabbit_master_ip;
var input_queue;

rabbit_master_ip = process.argv[2];
input_queue = process.argv[3];

var q, cargo, rmq, done = 0, failed = 0;

function getASandGeoIP(addresses) {
    var geoiplist = [];
    var geoiploc = [];
    var asnlist = [];
    for (var i = 0; i < addresses.length; i++) {
        var done = false;
        //AS Lookup
        asquery = addresses[i] + ".originas."
        dns.resolveTxt(asquery, function(err, addresses) {
            if (!err)
                for (var i = 0; i < addresses.length; i++)
                    if(asnlist.indexOf(addresses[i][0]) != -1)
                        asnlist.push(addresses[i][0]);
            done = true;
        });
        //variables
        var continent = null;
        var country = null;
        var location = null;
        var geoip = cityLookup.get(addresses[i]);
        //if city wasn't found
        if (geoip === null) {
            geoip = countryLookup.get(addresses[i]);
            //if country was found
            if (geoip) {
                if (geoip.continent) continent = geoip.continent.code;
                if (geoip.country) country = geoip.country.iso_code;
            }
        }
        //if city was found
        else {
            if (geoip.continent) continent = geoip.continent.code;
            if (geoip.country) country = geoip.country.iso_code;
            if (geoip.location) location = {lat: geoip.location.latitude, lon: geoip.location.longitude};
        }
        //add to the geo_ips array
        var res = {
            ip_address: addresses[i],
            continent: continent,
            country: country,
            location: location
        };

        geoiplist.push(res);
        geoiploc.push(location);
        //Wait for AS lookup to finish before continuting.
        deasync.loopWhile(() => { return !done; });
    }

    return [geoiplist, geoiploc, asnlist];
}

function resolve_task(data, cb) {
    //Ack message
    if(data.m) {
        data.ch.ack(data.m);
        return cb();
    }
    //this is what gets done to each record, in parallel
    dns.resolve4(data, (err, addresses) => {
        ++done;

        if (!done%100)  console.log(failed + '/' + done + '\r');
        if (err) ++failed;
        // maybe this?
        // you can actually just add ",cb" as an argument to cargo.push(), the callback will occur when processing of this element is actually "completely done"
        cargo.push({[data]: (err ? err.code : addresses)}, cb);
    });
}

function commit_task(data, cb) {
    docs = [];
    var payload = {};
    for (var i = 0; i < data.length; i++) {
      var domain = data[i];
      let key = Object.keys(domain)[0];
      payload[key] = domain[key];
      docs.push({ _id: key, _routing: key });
    }
    client.mget({
        index: 'ip-resolution',
        type: 'A',
        _source: false,
        storedFields: ['ip_address', 'asn'],
        body: { docs: docs }
    }, (err, body) => {
        if (err) {
            console.trace(JSON.stringify(err));
            console.log(JSON.stringify(body));
            //done populating rabbit after comparing ip addresses
            cb();
        }
        else {
            async.each(body.docs, (doc, callback_resq) => {
                var res_addrs = payload[doc._id];
                if (!doc.found || res_addrs && doc.fields.ip_address.toString() !== res_addrs.toString()) {
                    var update = {};
                    //TODO: geo location update
                    // var info = getASandGeoIP(res_addrs);
                    // if (doc.found) {
                    //     if (body.geo_ip.location && body.geo_ip.location.toString() !== info[0].toString())
                    //         update.geo_ip = info[0];
                    //
                    //     if (body.geo_ip.continent && body.geo_ip.continent.toString() )
                    // }
                    //
                    // update.geo_loc = info[1];
                    // //ASN Changed
                    // if (body.fields.asn && body.fields.asn.toString() !== info[2].toString())
                    //   update.asn = info[2];        // AS changed
                    update.ip_address = res_addrs;
                    // console.log(doc)
                    if (doc.found) {
                        client.update({
                            index: 'ip-resolution',
                            type: 'A',
                            id: doc._id,
                            body: { doc: update }
                        }, (err, res) => {
                            if (err) console.trace(JSON.stringify(err));
                            //done populating rabbit after comparing ip addresses
                            callback_resq();
                        });
                    } else {
                        client.index({
                            index: 'ip-resolution',
                            type: 'A',
                            id: doc._id,
                            body: update
                        }, (err, res) => {
                            if (err) console.trace(JSON.stringify(err));
                            //done populating rabbit after comparing ip addresses
                            callback_resq();
                        });
                    }
                } else {
                  //done populating rabbit after comparing ip addresses
                  callback_resq();
                }
            }, (err) => {
                if (err) console.trace(JSON.stringify(err));
                cb();
            });
        }
    });
}

q = async.queue(resolve_task, QUEUE_ASYNC);
cargo = async.cargo(commit_task, CARGO_ASYNC);

amqp.connect('amqp://rabbitmqadmin:rabbitmqadmin@' + rabbit_master_ip, (err, conn) => {
    conn.createChannel( (err, ch) => {
        rmq = ch;
        ch.prefetch(RABBIT_PREFETCH);
        ch.consume(input_queue, (m) => {
            var msg = JSON.parse(m.content.toString('utf8'));
            q.push(msg);
            q.push({ m: m, ch: ch });
        });
    }, {
        noAck: false
    });
});
