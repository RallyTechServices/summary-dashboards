Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box' }
    ],
    config: {
        defaultSettings : { 
            features : true, 
            showScopeSelector :  false,
            featureReleaseState: "Done"
        }
    },
    chartColors: [ '#3498db','#f1c40f','#c0392b','#9b59b6','#2ecc71',
        '#2f7ed8', '#8bbc21', '#910000',
        '#492970', '#f28f43', '#145499','#77a1e5', '#c42525', '#a6c96a',
        '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9','#aa1925',
        '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1','#1aadce',
        '#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE',
        '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],

    launch: function() {

        console.log("launch");

        if (this.isExternal()){
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());
        }
    },

    _launch: function(settings) {
        console.log("_launch");
        var that = this;

        if ( settings.showScopeSelector === true || settings.showScopeSelector === "true" ) {
            this.down('#selector_box').add({
                xtype : 'timebox-selector',
                context : this.getContext(),
                listeners: {
                    releasechange: function(release){
                        this._changeRelease(release);
                    },
                    iterationchange: function(iteration){
                        this._changeIteration(iteration);
                    },
                    scope: this

                }
            });
        } else {
            this.subscribe(this, 'timeboxReleaseChanged', this._changeRelease, this);
            this.subscribe(this, 'timeboxIterationChanged', this._changeIteration, this);
            this.publish('requestTimebox', this);
        }

        // that.run(release,iteration);
    },

    _changeRelease: function(release) {
        this.run(release.get("Name"),null);
    },

    _changeIteration: function(iteration) {
        if ( ! Ext.isEmpty(iteration) ) {
            this.run(null,iteration.get("Name"),null);
        }
    },


    run : function(releaseName,iterationName) {
        console.log('run',releaseName,iterationName);
        
        this.setLoading('loading data...');
        
        var that = this;

        that.rallyFunctions = Ext.create("RallyFunctions");

        var chartFeatures = that.getSetting('features')===true;

        console.log('chartFeatures', chartFeatures);
        if (chartFeatures===true) {
            if (releaseName == null) { //Iteration changed
                Rally.ui.notify.Notifier.showWarning({message: 'Features are not explicitly associated with Iterations.  The iteration will be ignored and all features for the selected Release will be included in the Success Donut'});
                this.setLoading(false);
                return;
            }

            var pr = Ext.create( "ProjectStories", {
                ctx : that.getContext(),
                // filter : that.rallyFunctions.createFilter(releaseName, iterationName),
                featureFilter : that.rallyFunctions.createFeatureFilter(releaseName)
            });

            pr.readProjectWorkItems(function(error, workItems, projects, states){
                that.prepareFeatureChartData( workItems, projects, function(error,series,categories) {
                    //that.createChart(series,categories);
                    that.createAreaChart(series, categories);
                });              
            });          
        } else {
            var pr = Ext.create( "ProjectStories", {
                ctx : that.getContext(),
                filter : that.rallyFunctions.createFilter(releaseName, iterationName)
                // featureFilter : that.rallyFunctions.createFeatureFilter(releaseName)
            });

            pr.readProjectWorkItems(function(error, workItems, projects, states){
                that.prepareChartData( workItems, projects, states, function(error,series,categories) {
                    //that.createChart(series,categories);
                    that.createAreaChart(series, categories);
                });
            });
        }
    },

    _timeboxChanged : function(timebox) {
        var that = this;
        console.log("Pyramid Chart:_timeboxChanged received");
        if (timebox.get("_type")==='release') {
            that.releaseName = timebox.get("Name");
            that.run(that.releaseName,null);
        } else
            that.run(null,timebox.get("Name"));
    },


    getTimeboxScope : function() {
        var timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope) {
            return { type : timeboxScope.getType(), name : timeboxScope.getRecord().get("Name") };
        }
        return null;
    },

    onTimeboxScopeChange: function(newTimeboxScope) {
        
        this.callParent(arguments);
        if ((newTimeboxScope) && (newTimeboxScope.getType() === 'iteration')) {
            this.run(null,newTimeboxScope.getRecord().get("Name"));
        } else {
            if ((newTimeboxScope) && (newTimeboxScope.getType() === 'release')) {
                this.run(newTimeboxScope.getRecord().get("Name"),null);
            }
        }
    },

    prepareChartData : function(stories, projects, states, callback) {
        console.log('prepareChartData',stories,projects);
        
        var that = this;
        var categories = _.map( projects, function(p) { return p.get("Name"); });
        var acceptedStates = ["Accepted",_.last(states)],
            releasedStates = _.last(states) === "Accepted" ? [] : [_.last(states)];

        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, states ) {
            var stateTotal = _.reduce(  workItems, function(memo,workItem) {
                    return memo + ( _.indexOf(states,workItem.get("ScheduleState")) > -1 ? 
                            pointsValue(workItem.get("PlanEstimate")) : 0);
                },0);
            return stateTotal;
        };

        var data = _.map(categories,function(project,index){
            var total = summarize(stories[index],states),
                accepted = summarize(stories[index],acceptedStates),
                released = summarize(stories[index],releasedStates),
                label = this._getProjectLabel(project,total,accepted,released,'Accepted','Released');

            return [ label, total, accepted, released];

        }, this);

        var sortedData = data.sort(function(a,b) { return b[1] - a[1]; }) ;
        var seriesData = [{
            name : 'Accepted',
            data : _.map(sortedData, function(d){return d[2] }),
            dataLabels: {
                enabled: false
            }
        },{
            name: 'Released',
            data: _.map(sortedData, function(d){return d[3]-d[3]; }),
            dataLabels: {enabled: false}
        }];

        callback(null,_.map(sortedData, function(d){return d[0] }),seriesData);

    },
    _getProjectLabel: function(project, total, accepted, released,acceptedText, releasedText){
       var pct = Math.round( total > 0 ? (accepted/total)*100 : 0),
            pct_released = Math.round(total > 0 ? released/total * 100 : 0);

        if (accepted == 0){
            return Ext.String.format("<b>{0}</b><br/>No {1} items.",_.last(project.split(">")),acceptedText);
        }

        return Ext.String.format("<b>{7}</b><br/>[{0}/{1}] ({2}%) {3} <br/>[{4}/{1}] ({5}%) {6}",
            accepted,
            total,
            pct,
            acceptedText,
            released,
            pct_released,
            releasedText,
            _.last(project.split(">")));
    },
    prepareFeatureChartData : function(features, projects, callback) {

        var categories = _.map( projects, function(p) { return p.get("Name"); });
    
        var data = _.map(categories,function(project,index){
            var total = features[index].length,
                accepted = this._summarizeCompletedFeatures(features[index]),
                released = this._summarizeReleasedFeatures(features[index], this.getSetting('featureReleaseState')),
                words = this._getFeatureWords(features[index]),
                label = this._getProjectLabel(project,total,accepted,released,'Accepted','Released');

            console.log('words',words);
            return [ label, total, accepted, words, released];

        }, this);

         var sortedData = data.sort(function(a,b) { return b[1] - a[1]; }) ;

        var seriesData = [{
            name : 'Accepted',
            data : _.map(sortedData, function(d){return d[2]-d[4];}),
            featureWords : _.map(sortedData,function(d) { return d[3];}),
            dataLabels: {
                enabled: false
            }
        },{
            name: 'Released',
            data: _.map(sortedData, function(d, i){return d[4];}, this),
            dataLabels: {enabled: false}
        }];
        callback(null, _.map(sortedData, function(d){return d[0];}),seriesData);
    },
    _getFeatureWords: function(workItems){
        return _.map(workItems,function(feature){
            var kpi = feature.get("c_ValueMetricKPI");
            return (!_.isUndefined(kpi) && !_.isNull(kpi) && kpi !== "")
                ? feature.get("FormattedID") + " " + feature.get("c_ValueMetricKPI") /* ("c_ValueMetricKPI") */
                : null; });
    },
    _summarizeCompletedFeatures: function(workItems){
        return _.reduce(  workItems, function(memo,workItem) {
            return memo + ( workItem.get("PercentDoneByStoryCount") >= 1 ? 1 : 0);
        },0);
    },
    _summarizeReleasedFeatures: function(workItems, releaseState){

        return _.reduce(workItems, function(memo,workItem){
            var state = workItem.get('State') ? workItem.get('State').Name : null;
            console.log('state',workItem.get('FormattedID'),state, state==releaseState, workItem.get('PercentDoneByStoryCount'));
            return memo + ((state == releaseState && workItem.get("PercentDoneByStoryCount") >= 1) ? 1 : 0);
        },0);
    },
    _getTotalColor: function(index){
        return this._hexToRGBAColorString(this.chartColors[index], 0.33);
    },
    _getAcceptedColor: function(index){
        return this._hexToRGBAColorString(this.chartColors[index], 0.66);
    },
    _getReleasedColor: function(index){
        return this._hexToRGBAColorString(this.chartColors[index],1);
    },
    _hexToRGBAColorString: function(hex, alpha) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        if (result){
            return Ext.String.format("rgba({0},{1},{2},{3})",
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16),
                alpha
            );
        }
        return hex;
    },
    
    createPolarChart: function(categories, seriesData,callback){
        this.setLoading(false);
        console.log('createPolarChart', categories ,seriesData);
        var isEmpty = function(series) {
            var total = _.reduce(_.first(series).data,function(memo,d) {
                return memo + d[1];
            },0);
            return total === 0;
        };

        var that = this;
        var chart_width = this.container.getWidth() * .90;
        var chartConfig = {
            credits: { enabled: false },
            colors : this.chartColors,
            chart: {
                polar: true,
                type: 'column',
                spacingTop: 25,
                spacingBottom: 25,
                spacingRight: 25,
                spacingLeft: 25,
              //  width: chart_width,
                events : {
                    load : that.renderFeatureWords
                }
            },
            title: {
                text: ''
            },
            plotOptions: {
                column: {
                    tooltip: {
                        headerFormat: '',
                        pointFormat: '{series.name}: <b>{point.y}</b><br/>'
                    }
                },
                series: {
                    stacking: 'normal',
                    shadow: false,
                    groupPadding: 0,
                    pointPlacement: 'on'
                }
            },
            xAxis: {
                categories: categories,
                labels: {
                    style: {
                        width: '300px',
                        whiteSpace: 'nowrap'
                    },
                    useHTML: true
                }
            },
            legend : {
                enabled : false
            },
            series: seriesData
        };

        if (!_.isUndefined(that.x)) {
            that.remove(that.x);
        }

        that.x = Ext.widget('container',{
            autoShow: true ,shadow: false,title: "",resizable: false,margin: 10,
            html: '<div id="chart-container" class="chart-container"></div>',
            listeners: {
                resize: function(panel) {
                },
                afterrender : function(panel) {
                    console.log('afterrender');
                    var chart = $('#chart-container').highcharts(chartConfig);
                    console.log('chart',chart,panel);
                }
            }
        });

        if (!isEmpty(seriesData))
            that.add(that.x);
        else {
            console.log("no data",seriesData);
        }

    },
    
    createAreaChart: function(categories, seriesData,callback){
        this.setLoading(false);
        console.log('createAreaChart', categories ,seriesData);
        var isEmpty = function(series) {
            var total = _.reduce(_.first(series).data,function(memo,d) {
                return memo + d[1];
            },0);
            return total === 0;
        };

        var that = this;
        var chart_width = this.container.getWidth() * .90;
        var chartConfig = {
            credits: { enabled: false },
            colors : this.chartColors,
            chart: {
                type: 'area',
                spacingTop: 25,
                spacingBottom: 25,
                spacingRight: 25,
                spacingLeft: 25,
                width: chart_width,
                events : {
                    load : that.renderFeatureWords
                }
            },
            title: {
                text: ''
            },
            plotOptions: {
                column: {
                    tooltip: {
                        headerFormat: '',
                        pointFormat: '{series.name}: <b>{point.y}</b><br/>'
                    }
                },
                series: {
                    stacking: 'normal',
                    shadow: false,
                    groupPadding: 0,
                    pointPlacement: 'on'
                }
            },
            yAxis: [{
                title: { text: '' }
            }],
            xAxis: {
                categories: categories,
                labels: {
                    style: {
                        width: '300px',
                        whiteSpace: 'nowrap'
                    },
                    useHTML: true
                }
            },
            legend : {
                enabled : true
            },
            series: seriesData
        };

        if (!_.isUndefined(that.x)) {
            that.remove(that.x);
        }

        that.x = Ext.widget('container',{
            autoShow: true ,shadow: false,title: "",resizable: false,margin: 10,
            html: '<div id="chart-container" class="chart-container"></div>',
            listeners: {
                resize: function(panel) {
                },
                afterrender : function(panel) {
                    console.log('afterrender');
                    var chart = $('#chart-container').highcharts(chartConfig);
                    console.log('chart',chart,panel);
                }
            }
        });

        if (!isEmpty(seriesData))
            that.add(that.x);
        else {
            console.log("no data",seriesData);
        }

    },
    createDonutChart: function(categories, seriesData, statusData, callback){
        this.setLoading(false);
        console.log('createDonutChart', categories ,seriesData);
        var isEmpty = function(series) {
            var total = _.reduce(_.first(series).data,function(memo,d) {
                return memo + d[1];
            },0);
            return total === 0;
        };

        var that = this;

        var chartConfig = {
            credits: { enabled: false },

            colors : this.chartColors,
            chart: {
                type: 'pie',
              //  marginRight : 100,
                events : {
                    load : that.renderFeatureWords
                }
            },
            title: {
                text: ''
            },
            plotOptions: {
                pie : {
                    allowPointSelect : true
                   // width: '45%'
                },
                series: {

                }
            },
            legend : {
                enabled : false
            },
            series: seriesData
        };

        if (!_.isUndefined(that.x)) {
            that.remove(that.x);
        }

        that.x = Ext.widget('container',{
            autoShow: true ,shadow: false,title: "",resizable: false,margin: 10,
            html: '<div id="chart-container" class="chart-container"></div>',
            listeners: {
                resize: function(panel) {
                },
                afterrender : function(panel) {
                    $('#chart-container').highcharts(chartConfig);
                }
            }
        });

        if (!isEmpty(seriesData))
            that.add(that.x);
        else {
            console.log("no data",seriesData);
        }
    },

    createChart : function(categories,seriesData,callback) {
        this.setLoading(false);
        
        var isEmpty = function(series) {
            var total = _.reduce(_.first(series).data,function(memo,d) { 
                return memo + d[1];
            },0);
            return total === 0;
        };

        var that = this;

        var chartConfig = {
            credits: { enabled: false }, 
            
            colors : ["#3498db","#f1c40f","#c0392b","#9b59b6","#2ecc71"],
             chart: {
                type: 'pyramid',
                marginRight : 100,
                events : {
                    load : that.renderFeatureWords
                }
            },
            title: {
                text: ''
            },
            plotOptions: {
                pyramid : {
                    allowPointSelect : true,
                    width: '45%'
                },
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter : function() {
                            var scope = this.point.y;
                            var accepted = this.point.series.options.acceptedData[this.point.index];
                            var pct = Math.round( scope > 0 ? (accepted/scope)*100 : 0);
                            return " [" + accepted + "/" + scope + "] ("+pct+"%) <br/>" + 
                                _.last(this.point.name.split(">"));
                        },
                        softConnector: true,
                        distance : 5,
                        overflow: 'none',
                        crop: false/*,
                        style: { width: '100%' }*/
                    }
                }
            },
            legend : {
                enabled : false
            },
            series: seriesData
        };

        if (!_.isUndefined(that.x)) {
            that.remove(that.x);
        }

        that.x = Ext.widget('container',{
            autoShow: true ,shadow: false,title: "",resizable: false,margin: 10,
            html: '<div id="chart-container" class="chart-container"></div>',
            listeners: {
                resize: function(panel) {
                },
                afterrender : function(panel) {
                    $('#chart-container').highcharts(chartConfig);
                }
            }
        });

        if (!isEmpty(seriesData))
            that.add(that.x);
        else {
            console.log("no data",seriesData);
        }
    },

    renderFeatureWords : function() {
        console.log('renderfeaturestories',this);

        var ren = this.renderer;
        var wordHeight = 11;
        var series = _.first(this.series),
            featureWordsExist = false;

        _.each(series.points,function(point,index) {
            var numWords = series.length <= 6 ? 3 : 1;
            if (series.options.featureWords){
                featureWordsExist = true;
                console.log('featureworkds',series.options.featureWords[index]);
                var featureWords = [] || _.compact(series.options.featureWords[index]).slice(0,numWords) || [];  // || _.compact(series.options.featureWords[index]).slice(0,numWords);
                var y = point.plotY - (( featureWords.length * wordHeight)/2);
                _.each(featureWords,function(fw,x) {
                    var word = fw;
                    ren.label(word, 5, y + (x*wordHeight))
                        .css({
                            fontWeight: 'normal',
                            fontSize: '75%'
                        })
                        .attr({
                            zIndex : 9
                        })
                        .add();
                });
            }
        });

        if (featureWordsExist){
            ren.label("Only up to the first 3 top ranked KPIs are shown")
                .css({
                    'textAlign': 'left',
                    fontWeight: 'normal',
                    fontSize: '85%'
                })
                .add();
        }
    },


    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            fields: this.getSettingsFields(),
            settings: this.getSettings(),
            defaultSettings: this.getDefaultSettings(),
            context: this.getContext(),
            settingsScope: this.settingsScope,
            autoScroll: true
        }, options));

        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()){
            if (this.down('#settings_box').getComponent(this._appSettings.id)===undefined){
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved: function(settings){
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        Ext.apply(this, settings);
        this._launch(settings);
    },

    getSettingsFields: function() {
        var me = this;

        return [ 
            {
                name: 'showScopeSelector',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show Scope Selector<br/><span style="color:#999999;"><i>Tick to use this to broadcast settings.</i></span>'
            },
            { 
                name: 'features', 
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel : '% based on features (otherwise stories)'
            }
        ];
    }


});
