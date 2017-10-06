Date.prototype.addDays = function(days) {
    var dat = new Date(this.valueOf())
    dat.setDate(dat.getDate() + days);
    return dat;
}

Date.prototype.yyyymmdd = function() {
   var yyyy = this.getFullYear().toString();
   var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   var dd  = this.getDate().toString();
   return [yyyy,(mm[1]?mm:"0"+mm[0]),(dd[1]?dd:"0"+dd[0])].join('-'); // padding
};

var yyyymmdd = function(date) {
  var yyyy = date.getFullYear().toString();
  var mm = (date.getMonth()+1).toString(); // getMonth() is zero-based
  var dd  = date.getDate().toString();
  return [yyyy,(mm[1]?mm:"0"+mm[0]),(dd[1]?dd:"0"+dd[0])].join('-'); // padding
}

var getPreviousDaysDate = function(date) {
  date = date.addDays(-1);
  return date.yyyymmdd();
}

//Returns an array of dates from startDate ip through endDate
var getDateRange = function(startDate, stopDate) {
    var dateStringsArray = new Array();
    var currentDate = startDate;
    while (currentDate <= stopDate) {
        dateStringsArray.push(currentDate.yyyymmdd())
        currentDate = currentDate.addDays(1);
    }
    return dateStringsArray;
}

var isValidDate = function(date) {
  if ( Object.prototype.toString.call(date) !== "[object Date]" )
    return false;
  return !isNaN(date.getTime());
}

exports.getPreviousDaysDate = getPreviousDaysDate;
exports.getDateRange = getDateRange;
exports.isValidDate = isValidDate;
exports.yyyymmdd = yyyymmdd;