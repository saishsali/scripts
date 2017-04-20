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

//ES settings
exports.MAX_SOCKETS = 20;
exports.HOSTS = [
    "192.168.0.204:9200","192.168.0.21:9200","192.168.0.22:9200",
    "192.168.0.23:9200","192.168.0.205:9200","192.168.0.206:9200",
    "192.168.0.208:9200","192.168.0.209:9200","192.168.0.210:9200",
    "192.168.0.212:9200","192.168.0.213:9200","192.168.0.214:9200",
    "192.168.0.215:9200","192.168.0.216:9200","192.168.0.217:9200",
    "192.168.0.218:9200","192.168.0.219:9200","192.168.0.221:9200",
    "192.168.0.222:9200","192.168.0.223:9200","192.168.0.224:9200",
    "192.168.0.225:9200","192.168.0.226:9200","192.168.0.227:9200",
    "192.168.0.228:9200","192.168.0.229:9200"
];
//Memcached settings
exports.POOL_SIZE = 25;


module.exports = exports;
