angular.module('marketInsider.services', [])
.factory('encodeURIService', function(){
  var encode = function(str){
    return encodeURIComponent(str).replace("/\"/g", "%22").replace("/\ /", "%20").replace("/[!'{}]/g", escape);
  };
  return {
    encode: encode
  };
})
.factory('dateService', function($filter){
  var currentDate = function(){
    var d = new Date();
    return $filter('date')(d, 'yyyy-MM-dd');
  };
  var oneYearAgoDate = function(){
    var d = new Date(new Date().setDate(new Date().getDate() - 365));
    return $filter('date')(d, 'yyyy-MM-dd');
  };
  return {
    currentDate: currentDate,
    oneYearAgoDate: oneYearAgoDate
  };
})
.factory('stockDetailsCacheService', function(CacheFactory){
  var stockDetailsCache;
  if(!CacheFactory.get('stockDetailsCache')){
    stockDetailsCache = CacheFactory('stockDetailsCache', {
      maxAge: 60 * 60 * 8 * 1000,
      deleteOnExpire: 'aggressive',
      storageMode: 'localStorage'
    });
  } else {
    stockDetailsCache = CacheFactory.get('stockDetailsCache');
  }
  return stockDetailsCache;
})
.factory('stockDataService', function($q, $http, encodeURIService, stockDetailsCacheService){
  var getDetails = function(ticker){
    var deferred = $q.defer(),
    cacheKey = ticker,
    stockDetailsCache = stockDetailsCacheService.get(cacheKey),
    query = 'select * from yahoo.finance.quotes where symbol IN ("' + ticker + '")',
    url = 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIService.encode(query) + '&format=json&env=http://datatables.org/alltables.env';
    if(stockDetailsCache) {
      deferred.resolve(stockDetailsCache);
    } else {
      $http.get(url)
        .success(function(data){
          if(angular.isDefined(data.query.results.quote)){
            var quoteData = data.query.results.quote;
            deferred.resolve(quoteData);
            stockDetailsCacheService.put(cacheKey, quoteData);
          } else {
            deferred.reject();
          }
        })
        .error(function(error){
          console.error("GET Details failed ", error);
          deferred.reject();
        });
    }
    return deferred.promise;
  };

  var getPriceData = function(ticker){
    var deferred = $q.defer(),
    url = "http://finance.yahoo.com/webservice/v1/symbols/"+ ticker +"/quote?format=json&view=detail";
    $http.get(url)
    .success(function(data){
      if(angular.isDefined(data.list.resources[0].resource.fields)) {
        deferred.resolve(data.list.resources[0].resource.fields);
      } else {
        deferred.reject();
      }
    })
    .error(function(data, status){
      console.error("GET Price Data Failed " + status);
      deferred.reject();
    });
    return deferred.promise;
  };

  return {
    getPriceData: getPriceData,
    getDetails: getDetails
  };
})
.factory('chartDataCacheService', function(CacheFactory){
  var chartDataCache;
  if(!CacheFactory.get('chartDataCache')){
    chartDataCache = CacheFactory('chartDataCache', {
      maxAge: 60 * 60 * 8 * 1000,
      deleteOnExpire: 'aggressive',
      storageMode: 'localStorage'
    });
  } else {
    chartDataCache = CacheFactory.get('chartDataCache');
  }
  return chartDataCache;
})
.factory('chartDataService', function($q, $http, encodeURIService, chartDataCacheService){
  var getHistoricalData = function(ticker, fromDate, toDate){
    var deferred = $q.defer(),
    cacheKey = ticker,
    chartDataCache = chartDataCacheService.get(ticker),
    query = 'select * from yahoo.finance.historicaldata where symbol = "'+ ticker +'" and startDate = "'+ fromDate +'" and endDate = "'+ toDate +'"',
    url = 'http://query.yahooapis.com/v1/public/yql?q='+ encodeURIService.encode(query) +'&format=json&env=http://datatables.org/alltables.env';
    if(chartDataCache){
      deferred.resolve(chartDataCache);
    } else {
      $http.get(url)
        .success(function(data){
          if(angular.isDefined(data.query.results.quote)){
            var raw = data.query.results.quote;
            var priceData = [], volumeData = [];
            raw.forEach(function(entry){
              var dateToMillis = entry.Date,
              date = Date.parse(dateToMillis),
              price = parseFloat((Math.round(entry.Close * 100) / 100).toFixed(3)),
              volume = parseInt(entry.Volume),
              volumeDatum = [date, volume];
              priceDatum = [date, price];
              volumeData.unshift(volumeDatum);
              priceData.unshift(priceDatum);
            });
            var chartData = [
              {
                key: "volume" ,
                bar: true ,
                values: volumeData
              },{
                key: ticker ,
                values: priceData
              }
            ];
            deferred.resolve(chartData);
            chartDataCacheService.put(cacheKey, chartData);
          } else {
            deferred.reject();
          }
        })
        .error(function(error){
          console.error("GET Details failed ", error);
          deferred.reject();
        });
    }
    return deferred.promise;
  };

  return {
    getHistoricalData: getHistoricalData
  };
})
.factory('notesCacheService', function(CacheFactory){
  var notesCache;
  if(!CacheFactory.get('notesCache')){
    notesCache = CacheFactory('notesCache', {
      storageMode: 'localStorage'
    });
  } else {
    notesCache = CacheFactory.get('notesCache');
  }
  return notesCache;
})
.factory('notesService', function(notesCacheService){
  var getNotes = function(ticker){
    return notesCacheService.get(ticker);
  };
  var addNotes = function(ticker, note){
    var stockNotes = notesCacheService.get(ticker);
    stockNotes = stockNotes ? stockNotes : [];
    stockNotes.push(note);
    notesCacheService.put(ticker, stockNotes);
  };
  var deleteNotes = function(ticker, index){
    var stockNotes = notesCacheService.get(ticker);
    stockNotes.splice(index, 1);
    notesCacheService.put(ticker, stockNotes);
  };
  return {
    getNotes: getNotes,
    addNotes: addNotes,
    deleteNotes: deleteNotes
  };
})
.factory('newsService', function($q, $http){
  var getNewsData = function(ticker) {
    var deferred = $q.defer(),
    x2js = new X2JS(),
    url = "http://finance.yahoo.com/rss/headline?s=" + ticker;
    $http.get(url)
      .success(function(xml){
        var xmlDoc =  x2js.parseXmlString(xml),
        json = x2js.xml2json(xmlDoc),
        jsonData = json.rss.channel.item;
        deferred.resolve(jsonData);
      })
      .error(function(status){
        console.error("GetNewsData Failed ", status);
        deferred.reject();
      });
    return deferred.promise;
  };
  return {
    getNewsData: getNewsData
  };
})
.factory('fillMyStocksCacheService', function(CacheFactory){
  var myStocksCache;
  if(!CacheFactory.get('myStocksCache')){
    myStocksCache = CacheFactory('myStocksCache',{
      storageMode: 'localStorage'
    });
  } else {
    myStocksCache = CacheFactory.get('myStocksCache');
  }
  var fillMyStocksCache = function() {
    var myStocks = [
      { ticker: 'FXCM'},
      { ticker: 'GASX'},
      { ticker: 'ADPT'},
      { ticker: 'FIT'},
      { ticker: 'HDP'},
      { ticker: 'GASL'},
      { ticker: 'AAPL'}
    ];
    myStocksCache.put('myStocks', myStocks);
  };
  return {
    fillMyStocksCache: fillMyStocksCache
  };
})
.factory('myStocksCacheService', function(CacheFactory){
  var myStocksCache = CacheFactory.get('myStocksCache');
  return myStocksCache;
})
.factory('myStocksArrayService', function(fillMyStocksCacheService, myStocksCacheService){
  if(!myStocksCacheService.info('myStocks')){
    fillMyStocksCacheService.fillMyStocksCache();
  }
  var myStocks = myStocksCacheService.get('myStocks');
  return myStocks;
})
.factory('followStockService', function(){
  var follow = function(ticker){

  };
  var unfollow = function(ticker){};
  var checkFollowing = function(ticker){};
  return {
    follow: follow,
    unfollow: unfollow,
    checkFollowing: checkFollowing
  };
})
;
