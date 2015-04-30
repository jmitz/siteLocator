// map.js
/*
 *  JavaScript used to aid in the use of Illinois EPA GIS Web Services
 *  Written by Jeff Mitzelfelt October, 2013
 */

/* Check for required elements */
dojo.require("esri.map"); // Required for ESRI Mapping
dojo.require("esri.tasks.identify"); // Required for Identify Task
dojo.require("esri.toolbars.navigation"); // Required for Navigation buttons and functions
dojo.require("esri.tasks.locator"); // Required for Location Service
dojo.require("dojo.window");

/* Set up global variables */
var mapApp = {}; // Global variable holder

/* Calculate precision to use for location measurements from scale */
function calcPrecision(scale) {
  precision = Math.round(8 - Math.log(scale) / 2.25);
  return (precision < 1) ? 1 : (precision > 7) ? 7 : precision;
}

function displayResults(identifyResults, evt){
  var infoBoxTemplate = "<table>" + ((mapApp.pointPrecision<4)?"<tr><td><button " +
        "type='button' alt='Zoom In' title='Zoom In' onclick=" +
        "'mapApp.map.centerAndZoom(mapApp.identifyParams.geometry,mapApp.map.getLevel()+4)' " +
        ">Zoom In</button></td></tr>":"");
  infoBoxTemplate += "<tr><td>Latitude</td><td><span id='latitude'>${y}</span></td></tr>" +
    "<tr><td>Longitude</td><td><span id='longitude'>${x}</span></td></tr>" +
    "${ejHtml}" +
    "${recordHtml}" +
    "</table>";
  var infoRowTemplate = "<tr><td>${field}</td><td>${value}</td></tr>";
  var geoPoint = esri.geometry.webMercatorToGeographic(mapApp.identifyParams.geometry);
  var recordHtmls = [];
  var ejStatusCalc = {1: {minority:0, poverty:0},
    11: {minority:0, poverty:0},
    checkEj: function (inEjStatus, accumulator){
      if (inEjStatus>=2){
        accumulator.poverty = 2;
      }
      if (inEjStatus%2===1){
        accumulator.minority = 1;
      } 
    },
    sumEj: function (accumulator){
      return accumulator.poverty + accumulator.minority;
    },
    htmlOut: function(){
      var returnValue="<tr><td>Environmental Justice</td><td><span id='ej'>" + (ejStatusCalc.sumEj(ejStatusCalc[11])===0?"No":"Yes") + "</span>" +
      "<span id='ejVal' style='visibility: hidden;'>" + ejStatusCalc.sumEj(ejStatusCalc[11]) + "</span>" +
      "<span id='ejInVal' style='visibility: hidden;'>" + ejStatusCalc.sumEj(ejStatusCalc[1]) + "</span></td></tr>";
      return returnValue;
    }
  };
  for (var record in identifyResults){
    var layerName = identifyResults[record].layerName;
    var fieldName = identifyResults[record].displayFieldName;
    var fieldValue = identifyResults[record].value;
    switch(identifyResults[record].layerId){
      case 1: // Environmental Justice
        ejStatusCalc.checkEj(identifyResults[record].feature.attributes.EJstatus, ejStatusCalc[1]);
        break;
      case 3: // State House
        fieldValue="<span id='stateHouse'>" + fieldValue + "</span>";
        break;
      case 4: // Environmental Justice
        fieldValue="<span id='stateSenate'>" + fieldValue + "</span>";
        break;
      case 5: // Environmental Justice
        fieldValue="<span id='congress'>" + fieldValue + "</span>";
        break;
      case 9: // Public Land Survey
        fieldValue = esri.substitute({
          township: identifyResults[record].feature.attributes.TOWNSHIP,
          range: identifyResults[record].feature.attributes.RANGE,
          section: identifyResults[record].feature.attributes.SECTION
        }, "T-<span id='township'>${township}</span><br>" +
        "R-<span id='range'>${range}</span><br>" +
        "S-<span id='section'>${section}</span>");
        break;
      case 10: // Counties
          var fipsStr = ""+identifyResults[record].feature.attributes.CO_FIPS;
          var pad = "000";
        fieldValue = identifyResults[record].feature.attributes.COUNTY_NAM + "<br>FIPS - <span id='fips'>" +  
          pad.substr(0, pad.length - fipsStr.length) + fipsStr + "</span>";
        break;
      case 11: // EJ buffers
        ejStatusCalc.checkEj(identifyResults[record].feature.attributes.EJstatus, ejStatusCalc[11]);
        break;
      case 12: // 12 Digit Watersheds
        fieldValue = "<span id='Watershed12'>" + fieldValue + "</span>";
 
    }
    if ((mapApp.pointPrecision>=4 || identifyResults[record].layerId === 10) && identifyResults[record].layerId!==1 && identifyResults[record].layerId!==11){
      recordHtmls.push(esri.substitute({
          field: layerName,
          value: fieldValue
        }, infoRowTemplate)
      );
    }
  }
  infoBoxText = esri.substitute({ 
      x: geoPoint.x.toFixed(mapApp.pointPrecision), 
      y: geoPoint.y.toFixed(mapApp.pointPrecision),
      ejHtml: mapApp.pointPrecision>=3?ejStatusCalc.htmlOut():"",
      recordHtml: recordHtmls.join("")
    },infoBoxTemplate
  );
  mapApp.map.infoWindow.setTitle("Identify Results");
  mapApp.map.infoWindow.setContent(infoBoxText);
  mapApp.map.infoWindow.show(evt.screenPoint);

}

function clickPoint(evt){
  if (mapApp.clickEnabled){
    mapApp.clickEnabled = false;
    mapApp.map.infoWindow.hide();
    mapApp.map.graphics.clear();
    mapApp.identifyParams.geometry = evt.mapPoint;
    mapApp.identifyParams.mapExtent = mapApp.map.extent;
    mapApp.locationTimer = new esri.Graphic(evt.mapPoint,mapApp.waitSymbol);
    mapApp.identifyTask.execute(mapApp.identifyParams, function(identifyResults){
      mapApp.map.graphics.remove(mapApp.locationTimer);
      if(identifyResults.length>1){
        displayResults(identifyResults, evt);
        mapApp.clickEnabled = true;
      }
    });
    mapApp.map.graphics.add(mapApp.locationTimer);
    mapApp.map.graphics.add(new esri.Graphic(evt.mapPoint,mapApp.markerSymbol));
  }
}

/* Provide coordinate information to mapLocation div */
function displayCoordinates(evt) {
  var mp = esri.geometry.webMercatorToGeographic(evt.mapPoint);
  //display mouse coordinates
//  dojo.byId("mapLatitude").innerHTML = mp.y.toFixed(mapApp.pointPrecision);
//  dojo.byId("mapLongitude").innerHTML = mp.x.toFixed(mapApp.pointPrecision);
}

/* Provide scale information to mapScale div */
function displayMapScale(scale){
  var magnitude = Math.floor(Math.log(scale)*Math.LOG10E*0.33333);
  var scaleVal = Math.round(scale/Math.pow(1000, magnitude));
  var scaleOut = scaleVal + " kMG".charAt(magnitude);
//  dojo.byId("scaleValue").innerHTML = scaleOut;
}

function findLocation(inputName) {
  mapApp.map.graphics.clear();
  mapApp.addressElement = dojo.byId(inputName);
  addressVal = mapApp.addressElement.value;
  var patContainsName = /\w{3}/;
  var patContainsState = /,?\s+[iI][lL][lL]?\s*[0-9]*\s*$/;
  if (patContainsName.test(addressVal)){
    addressVal += (patContainsState.test(addressVal))?"":", il";
    }

    mapApp.locateParams.address = {SingleLine: addressVal};

  mapApp.locator.addressToLocations(mapApp.locateParams);
}

function identifyPoint(inPoint){
  var dIdentifyInfo = new dojo.Deferred();
  mapApp.identifyParams.geometry = inPoint;
  mapApp.identifyParams.mapExtent = mapApp.map.extent;
  mapApp.identifyParams.layerIds = mapApp.visibleLayers;
  var identifyInfo = mapApp.identifyTask.execute(mapApp.identifyParams, function(identifyResults){
    console.log(identifyResults);
    var returnObj = {};
    dojo.forEach(identifyResults, function(item){
      switch (item.layerId)
      {
        case 9:
          returnObj.township = item.feature.attributes.TOWNSHIP;
          returnObj.range = item.feature.attributes.RANGE;
          returnObj.section = item.feature.attributes.SECTION;
          break;
        case 10:
          returnObj.countyName = item.feature.attributes.COUNTY_NAM;
          returnObj.countyFips = item.feature.attributes.FIPS_COUNT;
          break;
      }
    });
    console.log(returnObj);
    dIdentifyInfo.callback(returnObj);
    return dIdentifyInfo;
  });
  return identifyInfo;
}

function locatorResult(results){
  if (results.addresses.length>0){
    var curAddress = results.addresses[0];
    mapApp.addressElement.value = curAddress.address;
    var mapPoint = esri.geometry.geographicToWebMercator(curAddress.location);
    if (mapApp.stateExtent.contains(mapPoint)){
      var viewExtent = new esri.geometry.Extent(
      {
        xmin : curAddress.attributes.Xmin,
        ymin : curAddress.attributes.Ymin,
        xmax : curAddress.attributes.Xmax,
        ymax : curAddress.attributes.Ymax,
        spatialReference : {
          wkid : 4326
        }
      });
      mapApp.map.setExtent(esri.geometry.geographicToWebMercator(viewExtent));
      mapApp.map.graphics.add(new esri.Graphic(mapPoint,mapApp.geoCodeSymbol));
      var pointInfo = identifyPoint(mapPoint);
      displayPointInfo(mapPoint, pointInfo);
    }
    else {
      console.log("Location not valid for map service.");
    } 
  }
}

function setMapBusy() {
  $("#busy").css({
    "visibility" : "visible"
  });
}

function setMapNotBusy() {
  $("#busy").css({
    "visibility" : "hidden"
  });
}

function toggleBaseMap() {
  var newBase = ($.inArray(mapApp.map.getBasemap(), mapApp.basemaps) + 1) % 2;
  if (newBase === 0) {
    dojo.byId("btnBaseMap").innerHTML = "Satellite";
  } else {
    dojo.byId("btnBaseMap").innerHTML = "Streets";
  }
  mapApp.map.setBasemap(mapApp.basemaps[newBase]);
}

/* Zoom Map to Full Extent */
function zoomFull() {
  mapApp.map.setExtent(mapApp.baseExtent);
}

/* Zoom Map to Next Extent */
function zoomNext() {
  if (!mapApp.navToolBar.isLastExtent()) {
    mapApp.navToolBar.zoomToNextExtent();
  }
}

/* Zoom Map to Previous Extent */
function zoomPrevious() {
  if (!mapApp.navToolBar.isFirstExtent()) {
    mapApp.navToolBar.zoomToPrevExtent();
  }
}

/* Update information dependent on map extent */
function updateExtent(evt) {
  var extent = mapApp.map.extent;
  var center = extent.getCenter();
  if (mapApp.stateExtent.contains(center)) {
  } else {
    zoomPrevious();
  }
  displayMapScale(mapApp.map.getScale());
  mapApp.pointPrecision = calcPrecision(mapApp.map.getScale());
}

/* Page initialzation */
function init() {
  mapApp.spatialReference = new esri.SpatialReference({
    wkid : 102100
  });

  mapApp.stateExtent = new esri.geometry.Extent(// Define base extent of map
  {
    xmin : -10200000,
    ymin : 4430000,
    xmax : -9740000,
    ymax : 5240000,
    spatialReference : {
      wkid : 102100
    }
  });

  mapApp.baseExtent = new esri.geometry.Extent(// Define base extent of map
  {
    xmin : -10200000,
    ymin : 4430000,
    xmax : -9740000,
    ymax : 5240000,
    spatialReference : {
      wkid : 102100
    }
  });

  mapApp.minMapHeightPx = 600;

    /* Define Symbols used on map */
  mapApp.geoCodeSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 13, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 0, 0.75]), 2), new dojo.Color([0, 255, 0]));
  mapApp.markerSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0, 0.75]), 2), new dojo.Color([0, 0, 0, 0]));
  mapApp.waitSymbol = new esri.symbol.PictureMarkerSymbol("img/busy.gif",40,40);

  /* Define Map Services */
  mapApp.basemaps = ["topo", "satellite"];

  mapApp.dynamicMapService = {
  //  url : "http://epa084tgis01.iltest.illinois.gov/ArcGIS/rest/services/SWAP/Location/MapServer"
    url : "http://geoservices.epa.illinois.gov/ArcGIS/rest/services/SWAP/Location/MapServer"
  };
  mapApp.dynamicMapService.layer = new esri.layers.ArcGISDynamicMapServiceLayer(mapApp.dynamicMapService.url);
  mapApp.initCenter = [-89, 40];
  mapApp.initZoom = 7;
  if (!!QueryString.latitude && !!QueryString.longitude){
    mapApp.initCenter = [QueryString.longitude, QueryString.latitude];
    mapApp.initZoom = 15;
  }
  
  mapApp.map = new esri.Map("map", {
    autoResize: true,
    basemap: mapApp.basemaps[0],
    extent : mapApp.baseExtent,
    fitExtent : true,
    slider: false,
    minZoom: 6,
    maxZoom: 18,
    center: mapApp.initCenter,
    zoom: mapApp.initZoom
  });

  mapApp.locator = new esri.tasks.Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
  mapApp.locator.on("address-to-locations-complete", locatorResult);
  mapApp.locateParams = { 
      outFields: ["Shape", 
        "Score", 
        "Address", 
        "Addr_type", 
        "Ymax", 
        "Ymin", 
        "Xmax", 
        "Xmin", 
        "DisplayX", 
        "DisplayY"
      ],
      searchExtent: mapApp.stateExtent
    };

  /* Parameter required for zoom tools */
  mapApp.navToolBar = new esri.toolbars.Navigation(mapApp.map);

  /* Parameters required for Identify Task */
  mapApp.identifyTask = new esri.tasks.IdentifyTask(mapApp.dynamicMapService.url);
  mapApp.identifyParams = new esri.tasks.IdentifyParameters();
  mapApp.identifyParams.tolerance = 0;
  mapApp.identifyParams.returnGeometry = false;
  mapApp.identifyParams.layerIds = [];
  mapApp.identifyParams.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_ALL;
  mapApp.identifyParams.width = mapApp.map.width;
  mapApp.identifyParams.height = mapApp.map.height;
  mapApp.clickEnabled = true;

  mapApp.map.on("load", function() {
    //after map loads, connect to listen to mouse move & drag events
    //mapApp.map.on("mouse-move", displayCoordinates);
    mapApp.map.on("extent-change", updateExtent);
    mapApp.map.on("update-start", setMapBusy);
    mapApp.map.on("update-end", setMapNotBusy);
    mapApp.map.on("click", clickPoint);
//    dojo.connect(window, 'resize', mapResize);
    mapApp.pointPrecision = calcPrecision(mapApp.map.getScale());
    if (!!QueryString.latitude && !!QueryString.longitude){
      var geoPoint = esri.geometry.geographicToWebMercator(esri.geometry.Point(mapApp.initCenter));
      mapApp.map.graphics.add(new esri.Graphic(geoPoint,mapApp.markerSymbol));
    }
  });
//  mapApp.map.addLayer(mapApp.baseMapService);
  mapApp.map.addLayer(mapApp.dynamicMapService.layer);
  mapApp.map.initialLevel = mapApp.map.getLevel();
}

dojo.addOnLoad(init);