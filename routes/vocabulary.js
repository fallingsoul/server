var express = require('express');
var path = require('path');
var router = express.Router();
const assert = require('assert');
const con = require(path.join(__dirname,'../com/db'));
const ObjectId = require('mongodb').ObjectId;

const cheerio = require('cheerio');
const request = require('request');

router.get('/vocabulary/:offset/:limit', function(req, res, next) {
  var col = con.read.collection('vocabulary');
  var fo = {};
  for(var k in req.query){
    if(k=='_id'){
      fo[k] = ObjectId(req.query[k]);
      break;
    }
    fo[k] = new RegExp(req.query[k]);
  }
  console.log(fo);
  col = col.find(fo);
  col.skip(req.params.offset-0).limit(req.params.limit-0)
  .toArray(function (err,data) {
    assert.equal(null,err);
    res.json(data);
  });
});

router.post('/vocabulary', function(req, res, next) {
  var col = con.read.collection('vocabulary');
  res.send('waiting');
});

router.get('/youdao-dict', function(req, res, next) {
  var col = con.read.collection('vocabulary');
  var requestCount = 2;
  if(req.query.w && req.query._id){
    request('https://m.youdao.com/dict?le=eng&q='+req.query.w,
    function (err,response,body) {
      if(response.statusCode==200){
        const $ = cheerio.load(body);
        var i,j,k,l,tempCN = [],ud={},cns;
        if($('#ec').length == 0){
          ud.wrong = true;
          cns = $('#bd > div > .typo > ul > li');
          if(cns.length > 0){
            for(i=0,l=cns.length;i<l;i++){
              tempCN.push(cns.eq(i).text().replace(/\s+/,' '));
            }
            ud.maybe=tempCN;
          }
          col.updateMany({_id:ObjectId(req.query._id)},{$set:ud},function(err, r) {
            assert.equal(null, err);
          });
        }else{
          cns = $('#ec > ul > li');
          for(i=0,l=cns.length;i<l;i++){
            tempCN.push(cns.eq(i).text().replace(/\s+/,' '));
          }
          ud.CNS=tempCN;
          cns = $('#ec > .sub > *');
          tempCN = [];
          for(i=0,l=cns.length;i<l;i++){
            tempCN.push(cns.eq(i).text().replace(/\s+/,' '));
          }
          ud.subs=tempCN;
        }
        col.findOneAndUpdate({_id:ObjectId(req.query._id)},{$set:ud},function(err, r) {
          assert.equal(null, err);
          requestCount--;
          if(requestCount==0){
              res.json(r.value);
          }
        });
    }else{
        if(requestCount==0){
          res.send(response.statusCode);
        }
      }
    });
    request('https://m.youdao.com/singledict?dict=ee&le=eng&more=false&q='+req.query.w,function (err,response,body) {
        if(response.statusCode==200){
          const $ = cheerio.load(body);
          var cns = $('ul > li > ul > li > .col2 > span');
          var i,j,k,l,tempCN = [],ud={};
          for(i=0,l=cns.length;i<l;i++){
            tempCN.push(cns.eq(i).text().replace(/\s+/,' '));
          }
          ud.ENS=tempCN;

          col.findOneAndUpdate({_id:ObjectId(req.query._id)},{$set:ud},function(err, r) {
            assert.equal(null, err);
            requestCount--;
            if(requestCount==0){
                res.json(r.value);
            }
        });
      }else{
          if(requestCount==0){
          res.send(response.statusCode);
          }
        }
    });
  }
});
module.exports = router;
