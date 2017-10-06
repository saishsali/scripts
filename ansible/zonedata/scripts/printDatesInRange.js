var dateFunctions = require('dateFunctions.js');

var start_date;
var end_date;

if (process.argv.length !== 4) {
    console.log("ERROR: Improper arguments provided.");
    printUsage();
    process.exit(1);
}
else {
    var start_date_string = process.argv[2];
    var end_date_string = process.argv[3];

    var start_parts = start_date_string.split("-");
    var end_parts = end_date_string.split("-");
    start_date = new Date(start_parts[0], start_parts[1] - 1, start_parts[2]);
    end_date = new Date(end_parts[0], end_parts[1] - 1, end_parts[2]);

    if (!dateFunctions.isValidDate(start_date)) {
        console.log("ERROR: Improper start_date: " + start_date_string);
        printUsage();
        process.exit(1);
    }
    else if (!dateFunctions.isValidDate(end_date)) {
        console.log("ERROR: Improper end_date: " + end_date_string);
        printUsage();
        process.exit(1); 
    }
}

var dateStrings = dateFunctions.getDateRange(start_date, end_date);
for (var i = 0; i < dateStrings.length; i++) {
    console.log(dateStrings[i]);
}

function printUsage() {
    console.log("Usage: node " + __filename.split("/").pop() + " <start_date> <end_date> \n\n" + 
                "1. Returns the range of dates from start_date up through end_date. \n" +
                "Dates MUST be of the ISO format yyyy-MM-dd");
}
