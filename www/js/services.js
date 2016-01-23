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
.factory('stockDataService', function($q, $http, encodeURIService){
  var getDetails = function(ticker){
    var deferred = $q.defer(),
      query = 'select * from yahoo.finance.quotes where symbol IN ("' + ticker + '")',
      url = 'http://query.yahooapis.com/v1/public/yql?q='+ encodeURIService.encode(query) +'&format=json&env=http://datatables.org/alltables.env';
    $http.get(url)
      .success(function(data){
        if(angular.isDefined(data.query.results.quote)){
          deferred.resolve(data.query.results.quote);
        } else {
          deferred.reject();
        }
      })
      .error(function(error){
        console.error("GET Details failed ", error);
        deferred.reject();
      });
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
.factory('chartDataService', function($q, $http, encodeURIService){
  var getHistoricalData = function(ticker, fromDate, toDate){
    var deferred = $q.defer(),
    query = 'select * from yahoo.finance.historicaldata where symbol = "'+ ticker +'" and startDate = "'+ fromDate +'" and endDate = "'+ toDate +'"',
    url = 'http://query.yahooapis.com/v1/public/yql?q='+ encodeURIService.encode(query) +'&format=json&env=http://datatables.org/alltables.env';

    $http.get(url)
      .success(function(data){
        if(angular.isDefined(data.query.results.quote)){
          var raw = data.query.results.quote;
          var priceData = [], volumeData = [];
          raw.forEach(function(entry){
            var dateToMillis = entry.Date,
            date = Date.parse(dateToMillis),
            price = parseFloat(Math.round(entry.Close * 100) / 100).toFixed(3),
            volume = entry.Volume,
            volumeDatum = '['+ date + ',' + volume +']',
            priceDatum = '['+ date + ',' + price +']';
            volumeData.unshift(volumeDatum);
            priceData.unshift(priceDatum);
          });
          // var chartData = [
          //   {
          //     key: "volume" ,
          //     bar: true ,
          //     values: volumeData
          //   },{
          //     key: ticker ,
          //     bar: true ,
          //     values: priceData
          //   }
          // ];

          var chartData = '[{"key":"volume", "bar": true, "values":['+ volumeData +']},{"key":"'+ ticker +'", "bar": true, "values":['+ priceData +']}]';
          deferred.resolve(chartData);
        } else {
          deferred.reject();
        }
      })
      .error(function(error){
        console.error("GET Details failed ", error);
        deferred.reject();
      });

    return deferred.promise;
  };

  return {
    getHistoricalData: getHistoricalData
  };
})
;
