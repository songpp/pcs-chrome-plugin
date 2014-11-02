

var clientId = "LGnsSZ73jGySDOjcW7wrMtLo";
var appPath = '/apps/chrome';
var redirectUri = chrome.identity.getRedirectURL("pcs_cb");
var redirectRe = new RegExp(redirectUri + '[#\?](.*)');

function parseRedirectFragment(fragment) {
  var pairs = fragment.split(/&/);
  var values = {};

  pairs.forEach(function(pair) {
    var nameval = pair.split(/=/);
    values[nameval[0]] = nameval[1];
  });

  return values;
}

var auth_opts = {
    'interactive': true,
    'url': 'http://openapi.baidu.com/oauth/2.0/authorize?client_id=' +
            clientId +
          '&response_type=token' +
          '&scope=basic%20netdisk' +
          '&redirect_uri=' + encodeURIComponent(redirectUri)
};

var currentAccessToken;

function authorize(callback) {

    if(currentAccessToken) {
        callback(currentAccessToken);
        return;
    }

    chrome.identity.launchWebAuthFlow(auth_opts, function(redirectUri) {
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError["message"]);
      }

      var matches = redirectUri.match(redirectRe);
      if (matches && matches.length > 1) {
        var kvs = parseRedirectFragment(matches[1]);
        currentAccessToken = kvs.access_token;
        callback(currentAccessToken);
      } else {
        throw new Error('Invalid redirect URI');
      }
    });

}

function capturePage(access_token) {

    chrome.tabs.getSelected(function(tab) {
        if(!tab || !tab.id)
            return;

        var param = {
            'access_token' : access_token,
            'tab' : tab,
            'callback' : uploadToPCS,
            'fileName' : cutFileName(tab.url, tab.url)
        };
        // console.log(param);
        downloadContent(param);
    });

}

function cutFileName(url, defaultFileName) {
    var file = encodeURIComponent(url.substring(url.lastIndexOf('/') + 1));
    if(file.length == 0) {
        return encodeURIComponent(defaultFileName);
    }

    return file;
}

function downloadContent(param) {
    var tab = param.tab;
    var callback = param.callback;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', tab.url, true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = function(event) {
        if(xhr.readyState == 2) {
            var ct = xhr.getResponseHeader('Content-Type')
            if(ct.lastIndexOf('pdf') < 0) {
                alert('目前只允许pdf。');
                throw new Error('目前只允许pdf。');
            }
        }

        if(xhr.readyState == 4) {
            param.xhr = event.target;
            // console.log(xhr.getAllResponseHeaders());
            // console.log(xhr.response);
            callback(param);
        }
    };
    xhr.send()
}

function uploadToPCS(param) {
    var url = 'https://c.pcs.baidu.com/rest/2.0/pcs/file?' + join({
        'method' : 'upload',
        'access_token': param.access_token,
        'path': encodeURIComponent(appPath + '/' + param.fileName),
        'ondup': 'newcopy'
    });
    // console.log(url);

    function doUploadPCS() {
        var formData = new FormData();
        formData.append('file', param.xhr.response);
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.send(formData);
    }

    doUploadPCS();
}

function join(obj) {
    var arr = [];
    for(var p in obj) {
        arr.push(p + '=' + obj[p]);
    }
    return arr.join('&')
}

function run() {
    authorize(capturePage);
}

chrome.browserAction.onClicked.addListener(run);