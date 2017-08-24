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
];

//Memcached settings
exports.MEMCACHED_HOSTS = ["192.168.0.238", "192.168.0.239"]; 
exports.POOL_SIZE = 25;


module.exports = exports;
