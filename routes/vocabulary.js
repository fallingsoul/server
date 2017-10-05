var express = require('express');
var path = require('path');
var router = express.Router();
const assert = require('assert');
const con = require(path.join(__dirname,'../com/db'));
const ObjectId = require('mongodb').ObjectId;

const cheerio = require('cheerio');
const request = require('request');
const async = require('async');

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
  col.skip(req.params.offset-0).limit(req.params.limit-0).sort({g0:1,w:1})
  .toArray(function (err,data) {
    if(err==null){
      res.json(data);
    }
  });
});

router.get('/vocabulary/group', function(req, res, next) {
  var col = con.read.collection('vocabulary');
  col.find({},{g0:1}).sort({g0:1})
  .toArray(function (err,data) {
    var map = {},r = [],t;
    for(var i=0,l=data.length;i<l;i++){
      t = data[i].g0;
      if(t && !map[t]){
        map[t] = true;
        r.push(t);
      }
    }
    if(err==null){
      res.json(r);
    }
  });
});

router.get('/vocabulary/replace', function(req, res, next) {
  var col = con.read.collection('vocabulary');
  col.find().sort({w:1}).toArray(function (err,list) {
    var last;
    list.forEach((v) => {
      if(last === v.w){
        col.deleteOne({_id:ObjectId(v._id)},(err,r) => {
          if(err){
            console.log(err);
            res.sendStatus(500,err);
            return;
          }
          console.log(v.w+':'+r.deletedCount);
        });
      }else{
        last = v.w;
      }
    });
    res.sendStatus(200);
  });
});

router.delete('/vocabulary', function(req, res, next) {
  if(req.query._id===undefined){
    res.sendStatus(400,"_id must offer");
    return;
  }
  var col = con.read.collection('vocabulary');
  col.deleteOne({_id:ObjectId(req.query._id)},(err,r) => {
    if(err){
      console.log(err);
      res.sendStatus(500,err);
      return;
    }
    res.sendStatus(200);
  });
});

router.get('/youdao-dict', function(req, res, next) {
  if(req.query.w && req.query._id){
    var col = con.read.collection('vocabulary');
    async.parallel([(callback)=>{
      request('https://m.youdao.com/dict?le=eng&q='+req.query.w,
      function (err,response,body) {
        if(err){
          console.log(err);
          callback(true);
          return;
        }
        if(response.statusCode!==200){
          console.log(body);
          callback(true);
          return;
        }
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
            if(err){
              console.log(err);
              callback(true);
            }else{
              callback(false);
            }
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
          cns = $('#ec > h2 > div > span > .phonetic');
          if(cns.length > 1){
            ud.phonetic = cns.eq(1).text().replace(/\s+/,' ');
          }else if(cns.length == 1){
            ud.phonetic = cns.eq(0).text().replace(/\s+/,' ');
          }
        }
        col.updateOne({_id:ObjectId(req.query._id)},{$set:ud},function(err, r) {
            if(err){
              console.log(err);
              callback(true);
            }else{
              callback(false);
            }
        });
      });
    },(callback)=>{
      request('https://m.youdao.com/singledict?dict=ee&le=eng&more=false&q='+req.query.w,function (err,response,body) {
        if(err){
          console.log(err);
          callback(true);
          return;
        }
        if(response.statusCode!==200){
          console.log(body);
          callback(true);
          return;
        }
        const $ = cheerio.load(body);
        var cns = $('ul > li > ul > li > .col2 > span');
        var i,j,k,l,tempCN = [],ud={};
        for(i=0,l=cns.length;i<l;i++){
          tempCN.push(cns.eq(i).text().replace(/\s+/,' '));
        }
        ud.ENS=tempCN;
        col.updateOne({_id:ObjectId(req.query._id)},{$set:ud},function(err, r) {
          if(err){
            console.log(err);
            callback(true);
            return;
          }
          callback(false);
        });
      });
    }],(err,results)=>{
      if(err){
        console.log(err);
        res.sendStatus(500,err);
        return;
      }
      col.findOne({_id:ObjectId(req.query._id)},(err,r)=>{
        if(err){
          console.log(err);
          res.sendStatus(500,err);
          return;
        }
        res.json(r);
      });
    });
  }
});
module.exports = router;
