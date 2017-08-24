//Configuration file for REST API
//Dummy response for SOA
exports.DUMMY_SOA = 'a.myownserver. b.myownserver. 1465277297 3600 900 604800 86400';

//Request Type
exports.A_TYPE = 'A';
exports.NS_TYPE = 'NS';
exports.SOA_TYPE = 'SOA';

//Index
exports.INDEX = 'dns-data';
exports.NS_SEARCH = exports.INDEX + '/' + exports.NS_TYPE + '/_search';
exports.A_SEARCH = exports.INDEX + '/' + exports.A_TYPE + '/_search';

//Queries
exports.ZONE_QUERY = 'zone:';
exports.DOMAIN_QUERY = 'domain_name_exact:';

//Time settings
exports.CACHE_TIMEOUT = 90;
exports.TTL = 60;

//Debug settings
exports.DEBUG = true;
exports.LOG_TIME = true;

//Auth-server settings
exports.PORT = 1053;
exports.IP = '::ffff:192.168.0.17';
//exports.IP = '::ffff:192.168.0.239';

//ES settings
exports.MAX_SOCKETS = 20;

exports.ES_HOSTS = [
    "192.168.0.104",
    "192.168.0.105",
    "192.168.0.106",
    "192.168.0.107",
    "192.168.0.108",
    "192.168.0.109",
    "192.168.0.110",
    "192.168.0.111",
    "192.168.0.112",
    "192.168.0.113",
    "192.168.0.114",
    "192.168.0.117",
    "192.168.0.119",
    "192.168.0.120",
    "192.168.0.121",
    "192.168.0.122",
    "192.168.0.123",
    "192.168.0.124",
    "192.168.0.125",
    "192.168.0.127",
    "192.168.0.128",
    "192.168.0.129",
    "192.168.0.13 ",
    "192.168.0.130",
    "192.168.0.131"
];

//Memcached settings
exports.MEMCACHED_HOSTS = ["192.168.0.238", "192.168.0.239"]; 
exports.POOL_SIZE = 25;


module.exports = exports;
