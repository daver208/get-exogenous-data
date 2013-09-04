/*global module:true, require:true, console:true, process:true */

'use strict';

var fs = require('fs')
  , path = require('path')
  , url = require('url')
  , unzip = require('unzip')
  , request = require('request')
  , yaml = require('js-yaml')
  , async = require('async')
  , check = require('validator').validators
  , testFileName = /^[0-9a-zA-Z\^\&\'\@\{\}\[\]\,\$\=\!\-\#\(\)\.\%\+\~\_ ]+$/ // Excludes \ / : * ? \" < > |
  , outDir;


function parse(urlItem, callback){
  if(typeof urlItem === 'string'){
    if(check.isUrl(urlItem)){
      download(urlItem.toString(),callback);  
    }
    else
    {
      console.log(urlItem + ' is not a valid URL');
    }
  }
  else if(typeof urlItem === 'object'){
    downloadObject(urlItem, callback);
  }
  else{
    console.log('Unable to parse item');
    console.log(urlItem);
  }
}

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

function downloadObject (urlObject, callback) {
  var srcUrl = ''
    , dstFile='';

  if(Object.keys(urlObject).length >2){
  //If we have more than two properties we can't determine which property is the output file without
  //defining a naming convention convention
    console.log('Ignoring : '+ Object.keys(urlObject)[0] + ' ' + Object.keys(urlObject)[1] + ' too many properties');
    return;
  }
  else if(Object.keys(urlObject).length == 1){
  //Assume they mean to send in a list of URLS
    if(check.isUrl(urlObject[Object.keys(urlObject)[0]])){
      srcUrl = urlObject[Object.keys(urlObject)[0]];
      dstFile=path.delimiter;
    }
    else{
      console.log('Ignoring : '+ Object.keys(urlObject)[0] + ' : ' + urlObject[Object.keys(urlObject)[0]] + ' invalid URL');
      return;
    }
  }
  else{
  //If we have a src URL and a path lets use it
  //It might be worth validating the path in the future
    if(check.isUrl(urlObject[Object.keys(urlObject)[0]]) && testFileName.test(urlObject[Object.keys(urlObject)[1]])){
      srcUrl = urlObject[Object.keys(urlObject)[0]];
      dstFile = urlObject[Object.keys(urlObject)[1]];
    }
    else if(check.isUrl(urlObject[Object.keys(urlObject)[1]]) && testFileName.test(urlObject[Object.keys(urlObject)[0]])){
      srcUrl = urlObject[Object.keys(urlObject)[1]];
      dstFile = urlObject[Object.keys(urlObject)[0]];
    }
    else{
      console.log('\nIgnoring Object:\n\t{'+ Object.keys(urlObject)[0] + ' : ' + urlObject[Object.keys(urlObject)[0]] + '\n\t, ' + Object.keys(urlObject)[1] + ' : ' +urlObject[Object.keys(urlObject)[1]] + ' }\nInvalid URL or Filename\n');
      return;
    }
  }
  //dstFile = dstFile.replace('/^\\\/:/g)' , '');

  var fileName = url.parse(srcUrl).pathname.split('/').pop()
    , extension = path.extname(fileName)
    , outFile
    , outStream;

  if(dstFile !== path.delimiter){
    //renaming the original file
     outFile = path.join(outDir, dstFile)
  }
  else{
    //keeping the original name
    outFile = path.join(outDir,fileName);
  }

  if (extension === '.zip') {
  //if this is a zip file assume they wish to unzip into a new directory in outDir
    var zipTemp = outFile;
    if(dstFile !== path.delimiter){
      //if we are extracting into a new directory, we need to temporarily
      //download it as newName.zip so we can extract it into newName
      zipTemp = outFile + extension;
    }
    outStream = fs.createWriteStream(zipTemp, {encoding:'utf8'})
      .on('error', function (err) {
        callback(err);
      })
      .on('finish', function() {
        console.log('Downloaded ' + srcUrl);
        callback();
    });    
    console.log('Downloading ' + srcUrl + ' and extracting to: ' + outFile);
    if(!fs.existsSync(outFile)){
      fs.mkdirSync(outFile);
      console.log('Creating directory: '+ outFile);
    }
    else if(fs.statSync(outFile).isFile()){
    //default back to the original directory, as we cant have a directory with the same name as the file
      console.log('file : '+ outFile + ' already exists reverting to '+ outDir);
      outFile = outDir;
    }
    outStream = unzip.Extract({ path: outFile})
      .on('error', function (err) {
        callback(err);
      })
      .on('close', function() {
        var error;
        fs.unlink(zipTemp, function(err) { error = err; });
        console.log('Downloaded and unzipped ' + srcUrl + ' into ' + dstFile);
        callback(error);
      });
  }
  else{
    outStream = fs.createWriteStream(outFile, {encoding:'utf8'})
      .on('error', function (err) {
        console.log('Error:' +srcUrl +' =>' + outFile);
        callback(err);
      })
      .on('finish', function() {
        console.log('Downloaded ' + srcUrl + ' to ' + outFile);
        callback();
    });      
    if(dstFile !== path.delimiter){
      console.log('Downloading ' + srcUrl + ' and saving as: ' + dstFile);  
    }
    else{
      console.log('Downloading ' + srcUrl + '...');
    }

  }

  request(srcUrl).pipe(outStream);
}


/**
 * Reads the specified file for datasets to download
 *
 * @public
 * @param {String} sitesFile A path to an existing configuration file
 * @param {String} dataDir the directory to store downloaded data in
 * @param {Function} callback The callback function, returns (err)
 */
var startDownload = function(sitesFile, dataDir, callback) {
  
  fs.exists(dataDir, function (exists) {
    if (! exists) fs.mkdirSync(dataDir);
  });
  outDir = dataDir;
  fs.readFile(sitesFile, {encoding:'utf8'}, function (err, data) {
    if (err) {
      console.error('Error reading sites file ' + sitesFile + ': ' + err);
      process.exit(1);
    }
    var urlList = yaml.safeLoad(data);
    async.each(urlList
    , parse
    , function done (err) {
        if (err) callback(err);
      }
    );  
  });
};

function run () {

  startDownload('sites.yml', 'data', function(err){
    console.log(err);
  });
  
}

module.exports.startDownload = startDownload;
run();


