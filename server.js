var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const request = require('request');
var qs = require('qs');
var RateLimiter = require('request-rate-limiter');
var limiter = new RateLimiter({ rate: 1, interval: 0.5});


PORT = process.env.PORT || 8080;

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json());

var errorArray = [];
var responseArray = [];
var encoded_api_key = "";
var tf_account_name = "";

function getErrors(req, callback) {
  var api_key = req.body.api_key;
    base_64_encoded = new Buffer('tfclaimtool' + ":" + api_key).toString('base64');
    var options = {
      url: req.body.URL,
      headers: {
          'Accept': 'application/json',
          'Authorization': 'Basic ' + base_64_encoded
      }
    }
    encoded_api_key = base_64_encoded  
    request(options, function (error, response, body) {
      var lead_id = [];
      var trustedform_cert_url = [];
      var reason = [];
      var timestamp = [];
      var account = [];
      var body = [];
      var tf_object_array = [];
      var empty_array = [];
      if (error) {
        callback(error);
        return;
      }
      if (response.statusCode !== 200) {
        callback(response.statusCode);
        return;
      }
      var json_object = JSON.parse(response.body)
      if (json_object.length > 1) {
        var tf_account_name = json_object[0].vars.account.name;
      }
      
      if (json_object.length > 0) {
        for (var i = 0; i < json_object.length; i++) {
          lead_id.push(json_object[i].vars.lead.id);
          trustedform_cert_url.push("https://cert.trustedform.com" + json_object[i].vars.lead.trustedform_cert_url.path);
          reason.push(json_object[i].reason);
          timestamp.push(json_object[i].vars.submission.timestamp);
          account.push(json_object[i].vars.account.name);
          body.push(json_object[i].transactions[0].request.body)
        };
        for (var i = 0; i < trustedform_cert_url.length; i++) {
          var tf_object = {};
          tf_object['lead_id'] = lead_id[i]
          tf_object['trustedform_cert_url'] = trustedform_cert_url[i];
          tf_object['reason'] = reason[i];
          tf_object['timestamp'] = timestamp[i];
          tf_object['account'] = account[i];
          tf_object['body'] = body[i];
          tf_object_array.push(tf_object)
        }
        errorArray = tf_object_array;
        account = tf_object_array[0].account;
        callback(null, tf_object_array);
        return;
      } else {
        errorArray = empty_array;
        callback();
        return;
      }
  });  
}

var accountName = "";

function createResubmissionArray(certArray, callback) {
  var length = certArray.length;
  var resubmissionArray = [];
    if (length > 0) {
      for (var i=0; i < (length); i++) {
        var json_post_body = qs.parse("api_key_apis=" + encoded_api_key + "&" + "campaign_id=" + certArray[i].account + "&" + "trustedform_cert_url=" + certArray[i].trustedform_cert_url + "&" + certArray[i].body);
        var options = {
            url: "https://app.leadconduit.com/flows/59aec194803f022c4f000000/sources/59aec2571486a71874fb82ac/submit",
            headers: {
                "accept": "application/json",
                "content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(json_post_body)
        }
        resubmissionArray.push(options);
      }
    }
    accountName = certArray[0].account;
    callback(null, resubmissionArray)
    return;
}

var responses = [];

function resubmissionLoop(certArray, callback) {
  for (i=0; i < certArray.length; i++) {
    if (i < certArray.length) {
      resubmitCertificate(certArray[i], certArray.length, function() {
        if (responses.length === certArray.length) {
          responses.push(accountName);
          callback(null, responses);
          responses = [];
          accountName = "";
          return;
        }
      })
    }
  }
}

function resubmitCertificate(lead, certArray, callback) {
  limiter.request(lead, function (error, response) {
    responses.push(response.body);
    if (responses.length === certArray) {
      callback();
    } 
  })
}


app.post('/', function(req, res, next) {
  var request_url = req.body.get_url;
  var username = req.body.username;
  var api_key = req.body.api_key;

  request(request_url, function (error, response, body) {
      var fields = []
      var regex = /<input[\s\S]*?name="(.*?)"/g
    var item
    while (item = regex.exec(body))
      fields.push(item[1]);
      fields = fields.join(',');
      res.send(fields);
  });
  
});

app.post('/test-tool', function(req, res, next) {
  var flow_id = req.body.posting_url.split('/')[4];
  var api_key = req.body.api_key;
  base_64_encoded  = new Buffer('gettingstarted' + ":" + api_key).toString('base64');
  
  var options = {
    url: "https://next.leadconduit.com/flows/" + flow_id + "/fields",
    headers: {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + base_64_encoded
    }
  }

  request(options, function (error, response, body) {
    var field_pairs = {};
    var field_names = [];
    var field_ids = [];
    var json_object = JSON.parse(body);

    if (json_object.length > 0) {
      for (var i = 0; i < json_object.length; i++) {
        field_ids.push(json_object[i].id)
        field_names.push(json_object[i].name)
      };
      for (var i = 0; i < field_names.length; i++) {
        field_pairs[field_names[i]] = field_ids[i];
      }
      res.send(field_pairs);
    } else {
      res.send({response: 'none'})
    }
    
  });
});

app.post('/flow-name', function(req, res, next) {
  var flow_id = req.body.posting_url.split('/')[4];
  var api_key = req.body.api_key;
  base_64_encoded  = new Buffer('gettingstarted' + ":" + api_key).toString('base64');
  
  var options = {
    url: "https://next.leadconduit.com/flows/" + flow_id,
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Basic ' + base_64_encoded
    }
  }
  
  request(options, function (error, response, body) {

    var json_object = JSON.parse(body);
    if ( json_object.hasOwnProperty("name")) {
      var flow_name = json_object.name
      console.log(json_object.name)
      res.send(flow_name);
    } else {
      res.send({response: 'no name'})
    }
    
  });
})

app.post('/trusted-form-errors', function(req, res, next) {
  getErrors(req, function (err, data) {
    if (err === 401) {
      res.write("bad_api_key");
      res.end();
      return;
    } else if (data === undefined) {
        res.write("none");
        res.end();
        return;
    } else if (err) {
        res.write("unknown_error")
        res.end();
        return;
    } else {
      createResubmissionArray(data, function (err, data) {
        if (err) {
            res.write(err);
            res.end();
            return;
        } else {
          resubmissionLoop(data, function (err, data) {
            if (err) {
              res.write(err);
              return;
            } else {
                res.send(data);
                res.end();
                return;
            }
          })
        }
      });
      
    }
  });
})


app.listen(PORT, function () {
    console.log('Listening');
});