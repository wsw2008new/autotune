'use strict';

var WebPage = require('webpage'),
    system = require('system'),
    finishedJobs = 0,
    TIMEOUT = 90,
	address, output, pixelRatio, width, height;

var screenshots = [
  {'dimensions' : [970,300],
    'filename': './screenshots/retina_screenshot_l.png'},
  {'dimensions' : [720,300],
    'filename': './screenshots/retina_screenshot_m.png'},
  {'dimensions' : [400,200],
    'filename': './screenshots/retina_screenshot_s.png'}
];

function done() {
  // finishedJobs++;
  if ( finishedJobs >= screenshots.length ) {
    console.log('Finished');
    phantom.exit(0);
  }
}

function captureScreen(opts){
  var page = WebPage.create();

  var args = Array.prototype.slice.call(system.args, 1);
  // if (args.length < 3 || args.length > 4) {
  //     console.log('Usage: pixelratio.js URL filename pixelRatio');
  //     phantom.exit();
  // }

  // address = args[0];
  address = System.args[1],
  output = opts.filename;
  pixelRatio = 2;

  page.onConsoleMessage = function(msg) {
      console.log(msg);
  };

  // Here we block the first (few) requests until we have set the correct window variables
  var resources = [];
  page.onResourceRequested = function(requestData, networkRequest) {
      if((requestData.url.match(/\.js/g) !== null || requestData.url.match(/\/js\//g) !== null)) {
          if(requestData.url.match(/_phantomLoadMe/g) === null && requestData.url.match(/typekit/gi) === null) {
              console.log('Temporarily blocking too soon request to ', requestData['url']);
              resources.push(requestData['url']);
              networkRequest.abort();
          }
      }

      var reqUrl = requestData.url;
      var newUrl = requestData.url.split(',%20')[0];

      if (newUrl != reqUrl) {
        networkRequest.changeUrl(newUrl);
      }
  };

  width = (opts.dimensions[0]*pixelRatio);
  height = (opts.dimensions[1]*pixelRatio);

  page.viewportSize = { width: width, height: height };
  page.settings.localToRemoteUrlAccessEnabled = true;
  page.settings.userAgent = 'Mozilla/5.0 (Windows NT 5.1; rv:8.0) Gecko/20100101 Firefox/7.0';

  page.open(address, function (status) {
      if (status !== 'success') {
          console.log('Unable to load the address!', address, status);
          phantom.exit();
      } else {
          // Manipulate the DOM
          page.evaluate(function (r, urls, width, height) {
              console.log('Setting window.devicePixelRatio to ' + r);
              window.devicePixelRatio = r;
              window.onload = false;
              window.innerWidth = (width/r);
              window.innerHeight = (height/r);
              document.documentElement.offsetWidth = (document.documentElement.offsetWidth/r);
              document.documentElement.offsetHeight = (document.documentElement.offsetHeight/r);
              document.documentElement.clientWidth = (document.documentElement.clientWidth/r);
              document.documentElement.clientHeight = (document.documentElement.clientHeight/r);
              screen.width = width;
              screen.height = height;
              document.body.style.webkitTransform = "scale(" + r + ")";
              document.body.style.webkitTransformOrigin = "0% 0%";
              document.body.style.width = (100 / r) + "%";

              // Now that we've set our window, let's get those scripts again
              var _phantomReexecute = [];
              var _phantomScripts = document.getElementsByTagName("script");
              _phantomScripts = Array.prototype.slice.call(_phantomScripts);
              if(_phantomScripts.length > 0) {
                  _phantomScripts.forEach(function(v) {
                      if('src' in v && v.src !== "" && v.src.match(/typekit/gi) === null) {
                          urls.push(v.src);
                      }
                      else {
                          _phantomReexecute.push({'script': v.innerHTML});
                      }
                  });
              }
              var _phantomAll = document.getElementsByTagName("script");
              for (var _phantomIndex = _phantomAll.length - 1; _phantomIndex >= 0; _phantomIndex--) {
                  if(_phantomAll[_phantomIndex].src.match(/typekit/gi) === null) {
                      _phantomAll[_phantomIndex].parentNode.removeChild(_phantomAll[_phantomIndex]);
                  }
              }
              var _phantomHead = document.getElementsByTagName("head")[0];
              if(urls.length > 0) {
                  urls.forEach(function(u) {
                      var _phantomScript = document.createElement("script");
                      _phantomScript.type = "text/javascript";
                      _phantomScript.src = u + '?_phantomLoadMe';
                      _phantomHead.appendChild(_phantomScript);
                  });
              }
              if(_phantomReexecute.length > 0) {
                  _phantomReexecute.forEach(function(s) {
                      var _phantomScript = document.createElement("script");
                      _phantomScript.type = "text/javascript";
                      _phantomScript.innerHTML = s.script;
                      _phantomHead.appendChild(_phantomScript);
                  });
              }

              // Make sure to execute onload scripts
              var _phantomCount = 0;
              var _phantomIntVal = setInterval(function() {
                  if(window.onload !== false && window.onload !== null) {
                      window.onload();
                      clearInterval(_phantomIntVal);
                  }
                  _phantomCount++;

                  if(_phantomCount > 10) {
                      clearInterval(_phantomIntVal);
                  }
              }, 100);
          }, pixelRatio, resources, width, height);

          // Make the screenshot
          window.setTimeout(function () {
              page.render(output);
              page.release();
              phantom.exit();
          }, 5000);
      }
  });
  done();
}

screenshots.forEach(function(s) {
  captureScreen(s);
  finishedJobs++;
});

// In case something hangs, kill it all after 90 seconds
// setTimeout(function() {
//   console.error("Waited " + TIMEOUT + " seconds, terminating");
//   phantom.exit(1);
// }, TIMEOUT*1000);
