'use strict';

$(document).ready(function () {
    $('[data-toggle="tooltip"]').tooltip();

});

function legendLabelClickHandler(obj) {
    var scope = angular.element($('body')).scope();
    scope.chartState[obj.id].selected = !scope.chartState[obj.id].selected;
    scope.enableChartByName(obj.id);
    scope.safeApply();
}


var app = angular.module('HLSPlayer', ['HLSSourcesService', 'angular-flot']);

angular.module('HLSSourcesService', ['ngResource']).factory('sources', function ($resource) {
    return $resource('app/sources.json', {}, {
        query: {method: 'GET', isArray: false}
    });
});

app.controller('HLSController', function ($scope, sources) {

    $scope.selectedItem = {url: "http://multiplatform-f.akamaihd.net/i/multi/will/bunny/big_buck_bunny_,640x360_400,640x360_700,640x360_1000,950x540_1500,.f4v.csmil/master.m3u8"};

    //charting
    $scope.chartOptions = {
        legend: {

            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper',
            labelFormatter: function(label, series) {
                return '<div  style="cursor: pointer;" id="'+ series.id +'" onclick="legendLabelClickHandler(this)">'+ label +'</div>';
            }
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false,
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid:{
            clickable: false,
            hoverable: false,
            autoHighlight:true,
            color:'#ffffff',
            backgroundColor:'#525252'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.controlbar.convertToTimeCode(value);
            },
            tickDecimals: 0,
            min:0,
            color: 'white'
        },
        yaxis: {
            min:0,
            tickLength:0,
            tickDecimals: 0,
            autoscaleMargin: true,
            color: 'white',
            position: 'right',
            axisLabelPadding: 20
        },
        yaxes: []
    };


    $scope.chartEnabled = true;
    $scope.maxPointsToChart = 50;
    $scope.chartData = [];
    $scope.chartState = {
        buffer: {selected: true, color: '#004E64', label: 'Buffer Level'},
        index: {selected: false, color: '#006341', label: 'Current Quality'},
        max: {selected: false, color: '#8DC9B4', label: 'Max Quality'},
        pendingIndex: {selected: false, color: '#073022', label: 'Pending Index'},
        bitrate: {selected: false, color: '#e0c96b', label: 'Bitrate (Mbps)'},
        bandwidth: {selected: true, color: '#00CCBE', label: 'Bandwidth (Mbps)'},
        download: {selected: true, color: '#FF6700', label: 'Download Rate (Mbps)'},
        latency: {selected: false, color: '#003865', label: 'Latency (ms)'},
        droppedFPS: {selected: false, color: '#0006c4', label: 'Dropped FPS'}
    }

    //metrics
    $scope.metricsCollaection = {
        buffer: [],
        index: [],
        max: [],
        pendingIndex: [],
        bitrate: [],
        bandwidth: [],
        download: [],
        latency: [],
        droppedFPS: []
    };

    $scope.videoBitrate = 0;
    $scope.videoIndex = 0;
    $scope.videoPendingIndex = 0;
    $scope.videoMaxIndex = 0;
    $scope.videoBufferLength = 0;
    $scope.videoDroppedFrames = 0;
    $scope.videoLatency = 0
    $scope.videoDownload = 0
    $scope.videoBandwidth = 0

    //UI
    $scope.video = document.querySelector("video");
    $scope.controlbar = new ControlBar($scope.player, $scope.video);
    $scope.controlbar.hide();
    $scope.optionsGutter = false;
    //$scope.version = 'v' + $scope.player.getVersion();

    sources.query(function (data) {
        $scope.availableStreams = data.items;
    });


    $scope.setStream = function (item) {
        $scope.selectedItem = item;
    }


    $scope.initSession = function () {
        $scope.sessionStartTime = new Date().getTime() / 1000;
        $scope.clearChartData();
    }

    $scope.clearChartData = function() {
        for (var key in $scope.metricsCollaection) {
            $scope.metricsCollaection[key] = [];
        }
        $scope.chartData.forEach(function (el) {
            el.data = $scope.metricsCollaection[el.id]
        })
    };



    $scope.doLoad = function () {
        //move this to new directive
        $scope.initSession();
        $scope.player = null;
        $scope.controlbar = null;

        var hlsConfig = {
            autoStartLoad: $('#autoplay-cb').is(':checked'),
            debug: $('#debug-cb').is(':checked'),
            maxBufferLength: parseInt($('#buffer-length-input').val().length > 0 ? $('#buffer-length-input').val() : $('#buffer-length-input').attr('placeholder')),
            liveSyncDurationCount: parseInt($('#live-sync-input').val().length > 0 ? $('#live-sync-input').val() : $('#live-sync-input').attr('placeholder')),
            maxMaxBufferLength: parseInt($('#max-buffer-length-input').val().length > 0 ? $('#max-buffer-length-input').val() : $('#max-buffer-length-input').attr('placeholder')),
            startFragPrefetch: $('#prefetch-cb').is(':checked'),
            //enableCEA708Captions: $('#captions-embedded-cb').is(':checked'),
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = $('#credentials-cb').is(':checked');
            }
        }

        $scope.player = new Hls(hlsConfig);
        $scope.player.startLevel = 0;

        $scope.controlbar = new ControlBar($scope.player, $scope.video);
        $scope.controlbar.initialize();


        $scope.player.attachMedia($scope.video);
        $scope.player.on(Hls.Events.MEDIA_ATTACHED, function () {
            $scope.player.loadSource($scope.selectedItem.url);
            $scope.controlbar.show();
        });

        $scope.player.on(Hls.Events.FRAG_BUFFERED, function (event, data) {
            $scope.videoLatency = Math.round(data.stats.tfirst - data.stats.trequest) + " m/secs"
            $scope.videoDownload = Math.round(data.stats.tload - data.stats.tfirst) + " kbps";
            $scope.videoBandwidth = Math.round(8 * data.stats.length / (data.stats.tbuffered - data.stats.tfirst)) + " kbps";

            var v = $scope.video;
            var r = v.buffered;
            var currentTime = v.currentTime;
            for (var i = 0; i < r.length; i++) {
                if (currentTime >= r.start(i) && currentTime < r.end(i)) {
                    $scope.videoBufferLength = ($scope.video.buffered.end(i) - currentTime).toFixed(2);
                }
            }
            $scope.updateMetrics('buffer', Math.round(parseFloat($scope.videoBufferLength)));
            $scope.updateMetrics('bandwidth', parseFloat($scope.videoBandwidth) / 1000);
            $scope.updateMetrics('latency', parseFloat($scope.videoLatency));
            $scope.updateMetrics('download', parseFloat($scope.videoDownload) / 1000);
        })

        $scope.player.on(Hls.Events.LEVEL_SWITCH, function (e) {
            $scope.updateMetrics('index', $scope.videoIndex);
            //Not fired in manual mode switch??? Would rather get event in manual mode vs poll or connect controls stats updates
        });

        //$scope.player.on(Hls.Events.LEVEL_LOADING, function (e) {
        //Not fired in manual mode switch???
        //});

        $scope.player.on(Hls.Events.FPS_DROP, function (e) {
            $scope.videoDroppedFrames = data.totalDroppedFrames + "/" + data.currentDropped + "/" + data.currentDecoded;
            $scope.updateMetrics('droppedFPS', data.currentDropped);
        });

        //$scope.player.on(Hls.Events.ERROR, function (e) {}, $scope); // check hls object has error stuff
        //$scope.player.on(Hls.Events.PLAYBACK_ENDED, function(e) {
        //    if ($('#loop-cb').is(':checked') &&
        //    }
        //});
    }

    $scope.onChartEnableButtonClick = function () {
        $scope.chartEnabled = !$scope.chartEnabled;
        $('#chart-wrapper').fadeTo(500, $scope.chartEnabled ? 1 : .3);
    }

    $scope.enableChartByName = function (id) {
        //enable stat item
        if ($scope.chartState[id].selected) {
            var data = {
                id: id,
                data: $scope.metricsCollaection[id],
                label: $scope.chartState[id].label,
                color: $scope.chartState[id].color,
                yaxis: $scope.chartData.length + 1
            }
            $scope.chartData.push(data);
            $scope.chartOptions.yaxes.push({axisLabel: data.label})
        } else { //remove stat item from charts
            for (var i = 0; i < $scope.chartData.length; i++) {
                if ($scope.chartData[i].id === id) {
                    $scope.chartData.splice(i, 1);
                    $scope.chartOptions.yaxes.splice(i, 1);
                }
                if ($scope.chartData.length > i) {
                    $scope.chartData[i].yaxis = i + 1;
                }
            }
        }
        $scope.chartOptions.legend.noColumns = Math.min($scope.chartData.length, 5);
    }

    $scope.updateMetrics = function (type, value) {

        // SHould be event driven but HLS is not giving correct events yet so on a poll.
        var levels = $scope.player.levels;
        var currentLevel = $scope.player.currentLevel;
        var nextLevel = $scope.player.nextLevel;

        if (currentLevel >= 0) {
            $scope.videoIndex = $scope.player.currentLevel + 1;
            $scope.videoBitrate = Math.round(levels[currentLevel].bitrate / 1000);
            $scope.plotPoint("index", $scope.videoIndex);
            $scope.plotPoint("bitrate", parseFloat($scope.videoBitrate) / 1000);
        }
        if (nextLevel > 0) {
            $scope.videoPendingIndex = $scope.player.nextLevel + 1;
            $scope.plotPoint("pendingIndex", $scope.videoPendingIndex);
        }

        $scope.videoMaxIndex = levels.length;
        $scope.plotPoint("max", $scope.videoMaxIndex);
        // end hack

        $scope.plotPoint(type, value)
        $scope.safeApply();
    };


    $scope.plotPoint = function(type, value) {
        if ($scope.chartEnabled) {
            var chartTime = (new Date().getTime() / 1000 ) - $scope.sessionStartTime;
            var point = [parseInt(chartTime).toFixed(1), value];
            $scope.metricsCollaection[type].push(point);
            if ($scope.metricsCollaection[type].length > $scope.maxPointsToChart) {
                $scope.metricsCollaection[type].splice(0, 1);
            }
        }
    }

    $scope.toggleOptionsGutter = function (bool) {
        $scope.optionsGutter = bool;
    }

    $scope.hasLogo = function (item) {
        return (item.hasOwnProperty("logo") && item.logo !== null && item.logo !== undefined && item.logo !== "");
    }

    $scope.getChartButtonLabel = function () {
        return $scope.chartEnabled ? "Disable" : "Enable";
    }

    $scope.getOptionsButtonLabel = function () {
        return $scope.optionsGutter ? "Hide Options" : "Show Options";
    }

    // from: https://gist.github.com/siongui/4969449
    $scope.safeApply = function (fn) {
        var phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest')
            this.$eval(fn);
        else
            this.$apply(fn);
    };
    ////////////////////////////////////////
    //
    // Init
    //
    ////////////////////////////////////////
    (function init() {

        //init charting
        for (var key in $scope.chartState) {
            var obj = $scope.chartState[key]
            if (obj.selected) {
                $scope.enableChartByName(key);
            }
        }

        //handle page query args for share url.
        function getUrlVars() {
            var vars = {};
            var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
                vars[key] = decodeURIComponent(value);;
            });
            return vars;
        }

        var vars = getUrlVars();
        var paramUrl = null;

        if (vars && vars.hasOwnProperty("url")) {
            paramUrl = vars.url;
        }

        if (vars && vars.hasOwnProperty("source")) {
            paramUrl = vars.source;
        }

        if (paramUrl !== null) {
            var autoplay = false;

            $scope.selectedItem = {};
            $scope.selectedItem.url = paramUrl;

            if (vars.hasOwnProperty("autoplay")) {
                autoplay = (vars.autoplay === 'true');
            }

            if (autoplay) {
                $scope.doLoad();
            }
        }
    })();

});