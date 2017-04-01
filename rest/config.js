//Configuration file for REST API
//Dummy response for SOA
exports.DUMMY_SOA = 'a.myownserver. b.myownserver. 1465277297 1800 900 604800 86400';

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
exports.TTL = 30;

//Debug settings
exports.DEBUG = true;
exports.LOG_TIME = true;

module.exports = exports;
