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
            showScopeSelector :  false
        }
    },

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
        this.run(null,iteration.get("Name"),null);
    },


    run : function(releaseName,iterationName) {
        
        this.setLoading('loading data...');
        
        var that = this;

        that.rallyFunctions = Ext.create("RallyFunctions");

        var chartFeatures = that.getSetting('features')===true;

        if (chartFeatures===true) {
            var pr = Ext.create( "ProjectStories", {
                ctx : that.getContext(),
                // filter : that.rallyFunctions.createFilter(releaseName, iterationName),
                featureFilter : that.rallyFunctions.createFeatureFilter(releaseName)
            });

            pr.readProjectWorkItems(function(error, workItems, projects, states){
                that.prepareFeatureChartData( workItems, projects, function(error,series,categories) {
                    that.createChart(series,categories);    
                });              
            });          
        } else {
            var pr = Ext.create( "ProjectStories", {
                ctx : that.getContext(),
                filter : that.rallyFunctions.createFilter(releaseName, iterationName),
                // featureFilter : that.rallyFunctions.createFeatureFilter(releaseName)
            });

            pr.readProjectWorkItems(function(error, workItems, projects, states){
                that.prepareChartData( workItems, projects, states, function(error,series,categories) {
                    that.createChart(series,categories);    
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

        var that = this;
        var categories = _.map( projects, function(p) { return p.get("Name"); });
        var completedStates = ["Accepted",_.last(states)];

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
            return [ project, 
                summarize(stories[index],states),
                summarize(stories[index],completedStates)
            ];
        });
        var sortedData = data.sort(function(a,b) { return b[1] - a[1]; });

        var seriesData = [{
            name : 'Project Scope',
            data : sortedData,
            completedData : _.map(sortedData,function(d) { return d[2];})
        }];

        callback(null,categories,seriesData);

    },

    prepareFeatureChartData : function(features, projects, callback) {

        var that = this;
        var categories = _.map( projects, function(p) { return p.get("Name"); });
    
        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, completed ) {

            if (completed===false)
                return workItems.length;
            else { 
                return _.reduce(  workItems, function(memo,workItem) {
                    return memo + ( workItem.get("PercentDoneByStoryCount") >= 1 ? 1 : 0);
                },0);
            }
        };

        var data = _.map(categories,function(project,index){
            return [ project, 
                summarize(features[index],false),
                summarize(features[index],true),
                _.map(features[index],function(feature){ 
                    var kpi = feature.get("c_ValueMetricKPI");
                    return (!_.isUndefined(kpi) && !_.isNull(kpi) && kpi !== "")
                        ? feature.get("FormattedID") + " " + feature.get("c_ValueMetricKPI") /* ("c_ValueMetricKPI") */
                        : null; })
            ];
        });
        var sortedData = data.sort(function(a,b) { return b[1] - a[1]; }) ;

        var seriesData = [{
            name : 'Project Scope',
            data : sortedData,
            completedData : _.map(sortedData,function(d) { return d[2];}),
            featureWords : _.map(sortedData,function(d) { return d[3];})
        }];


        callback(null,categories,seriesData);
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
                            var completed = this.point.series.options.completedData[this.point.index];
                            var pct = Math.round( scope > 0 ? (completed/scope)*100 : 0);
                            return " [" + completed + "/" + scope + "] ("+pct+"%) <br/>" + 
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

        var ren = this.renderer;
        var wordHeight = 11;
        var series = _.first(this.series);

        _.each(series.points,function(point,index) {
            var numWords = series.length <= 6 ? 3 : 1;
            var featureWords = [] || _.compact(series.options.featureWords[index]).slice(0,numWords);
            var y = point.plotY - (( featureWords.length * wordHeight)/2);
            _.each(featureWords,function(fw,x) {
                // var word = fw.split(' ').slice(0,2).join(' ');
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
        });

        ren.label("Only up to the first 3 top ranked kpi's are shown", 5, 285)
        .css({
            'textAlign': 'center',
            fontWeight: 'normal',
            fontSize: '85%'
        })
        .add();

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
