/* globals phantom, window, document */
var WebPage = require('webpage'),
    System = require('system'),
    address = System.args[1],
    finishedJobs = 0,
    TIMEOUT = 90;

// All the sizes to screenshot.
// Note: PhantomJs uses the heights specified here as a min-height criteria
var screenshots = [
  {'dimensions' : [970,300],
    'filename': './screenshots/retina_screenshot_l.png'},
  {'dimensions' : [720,300],
    'filename': './screenshots/retina_screenshot_m.png'},
  {'dimensions' : [400,200],
    'filename': './screenshots/retina_screenshot_s.png'}
];

function done() {
  finishedJobs++;
  if ( finishedJobs >= screenshots.length ) {
    console.log('Finished');
    phantom.exit(0);
  }
}

function consoleMessageCB(msg, lineNum, sourceId) {
  console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
}

function errorCB(msg, trace) {

  var msgStack = ['ERROR: ' + msg];

  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
    });
  }

  console.error(msgStack.join('\n'));

}

function resourceTimeoutCB(request) {
  console.error('Request timeout (#' + request.id + '): ' + JSON.stringify(request, null, 4));
}

function resourceErrorCB(resourceError) {
  console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
  console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
}

function resourceRecievedCB(response) {
  var url = response.url;
  if ( response.url.substr(0, 4) === 'data' ) {
    url = 'data-uri hidden';
  }
  console.debug('Response (#' + response.id + ', stage "' + response.stage +
              '"): ' + response.status + ' ' + url);
  //console.debug('Response (#' + response.id + ', stage "' + response.stage +
              //'"): ' + JSON.stringify(response, null, 4));
}

function resourceRequestedCB(requestData, networkRequest) {
  var url = requestData.url;
  if ( response.url.substr(0, 4) === 'data' ) {
    url = 'data-uri hidden';
  }
  console.debug('Request (#' + requestData.id + '): ' +
              requestData.method + ' ' + url);
  //console.debug('Request (#' + requestData.id + '): ' +
              //JSON.stringify(requestData, null, 4));
}

function captureScreen(opts){
  var page = WebPage.create(),
      finished = false,
      pixelRatio = 2,
      width = (opts.dimensions[0]*pixelRatio),
      height = (opts.dimensions[1]*pixelRatio);

  page.viewportSize = {
    width: width,
    height: height
  };
  // page.devicePixelRatio = 2.0;
  page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.0; WOW64) AppleWebKit/535.7 (KHTML, like Gecko) Chrome/16.0.912.75 Safari/535.7';
  page.customHeaders = {'Referer': address};

  console.log('Capture ' + opts.dimensions.join('x'));
  //
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

  page.open(address, function(status){
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
        }, 1000);

    }, pixelRatio, resources, width, height);

    // Make the screenshot
    window.setTimeout(function () {
      Chart(autotune);
        page.render(output);
        page.release();
        phantom.exit();
    }, 10000);
  });

  page.onConsoleMessage = consoleMessageCB;
  page.onError = errorCB;
  page.onResourceError = resourceErrorCB;
  page.onResourceTimeout = resourceTimeoutCB;
  //page.onResourceReceived = resourceRecievedCB;
  //page.onResourceRequested = resourceRequestedCB;

  page.onCallback = function(data) {
    if ( data === 'gtg' ) {
      console.log('Saving image ' + opts.filename);
      page.render(opts.filename);
      page.close();
      done();
    }
  };
  page.onLoadFinished = function(status){
    if ( finished ) { return; }

    if ( status === 'fail' ) {
      console.error('Failed to load '+opts.dimensions.join('x'));
      done();
    } else {
      finished = true;
      console.log('Page loaded at '+opts.dimensions.join('x'));
      page.evaluate(function() {
        function _phantomLoadCB() {
          if (document.readyState === 'complete') {
            window.callPhantom('gtg');
          }
        }
        document.onreadystatechange = _phantomLoadCB;
        _phantomLoadCB();
      });
    }
  };
}

screenshots.forEach(function(s) {
  captureScreen(s);
});

// In case something hangs, kill it all after 90 seconds
setTimeout(function() {
  console.error("Waited " + TIMEOUT + " seconds, terminating");
  phantom.exit(1);
}, TIMEOUT*1000);
