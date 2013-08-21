/* globals require:true, console:true, process:true */
'use strict';

var fs = require('fs')
  , path = require('path')
  , url = require('url')
  , unzip = require('unzip')
  , request = require('request')
  , yaml = require('js-yaml')
  , async = require('async');

var sitesFile = 'sites.yml'
  , outDir = 'data';

fs.exists(outDir, function (exists) {
  if (! exists) fs.mkdirSync(outDir);
});

fs.readFile(sitesFile, {encoding:'utf8'}, function (err, data) {
  if (err) {
    console.error('Error reading sites file ' + sitesFile + ': ' + err);
    process.exit(1);
  }

  var urlList = yaml.safeLoad(data);

  async.each(urlList
  , download
  , function done (err) {
      if (err) console.error(err);
    }
  );

})

function download (urlString, callback) {
  console.log('Downloading ' + urlString + '...');
  var fileName = url.parse(urlString).pathname.split('/').pop()
    , extension = path.extname(fileName)
    , outFile = path.join(outDir, fileName)
    , outStream = fs.createWriteStream(outFile, {encoding:'utf8'})
        .on('error', function (err) {
          callback(err);
        })
        .on('finish', function() {
          console.log('Downloaded ' + urlString);
          callback();
        });

  if (extension === '.zip') {
    outStream = unzip.Extract({ path: outDir })
      .on('error', function (err) {
        callback(err);
      })
      .on('close', function() {
        var error;
        fs.unlink(outFile, function(err) { error = err; });
        console.log('Downloaded and unzipped ' + urlString);
        callback(error);
      });
  }

  request(urlString).pipe(outStream);
}