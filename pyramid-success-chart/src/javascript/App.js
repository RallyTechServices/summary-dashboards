Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    config: {
        defaultSettings : { features : true }
    },

    getSettingsFields: function() {
        return [
            { name: 'features', xtype: 'rallycheckboxfield', label : '% based on features (otherwise stories)' }
        ];
    }, 

    launch: function() {
        var that = this;
        var release = 'Release 1';
        var iteration = null; // "Iteration 1"; // this.getTimeboxScope();
        console.log(that.getSetting('features'));
        that.rallyFunctions = Ext.create("RallyFunctions");
        that.rallyFunctions.subscribe(that);
        
        var tbs = that.getTimeboxScope();

        if (!_.isNull(tbs)) {
            release = tbs.type === "release" ? tbs.name : null;
            iteration = tbs.type === "iteration" ? tbs.name : null;
        }

        that.run(release,iteration);
    },

    run : function(releaseName,iterationName) {

        var that = this;

        var chartFeatures = that.getSetting('features')===true;

        var pr = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : that.rallyFunctions.createFilter(releaseName, iterationName),
            featureFilter : that.rallyFunctions.createFeatureFilter(releaseName)
        });

        pr.readProjectStories(function(error, stories, projects, states,features){
            if (chartFeatures===true) {
                that.prepareFeatureChartData( features, projects, function(error,series,categories) {
                    that.createChart(series,categories);    
                });              
            } else {
                that.prepareChartData( stories, projects, states, function(error,series,categories) {
                    that.createChart(series,categories);    
                });
            }           
        });
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
            console.log(project,features[index]);
            return [ project, 
                summarize(features[index],false),
                summarize(features[index],true),
                _.map(features[index],function(feature){ return feature.get("Name") /* ("c_ValueMetricKPI") */; })
            ];
        });
        var sortedData = data.sort(function(a,b) { return b[1] - a[1]; });

        var seriesData = [{
            name : 'Project Scope',
            data : sortedData,
            completedData : _.map(sortedData,function(d) { return d[2];}),
            featureWords : _.map(sortedData,function(d) { return d[3];})
        }];

        console.log(categories,seriesData);

        callback(null,categories,seriesData);
    },


    createChart : function(categories,seriesData,callback) {

        var isEmpty = function(series) {
            var total = _.reduce(_.first(series).data,function(memo,d) { 
                return memo + d[1];
            },0);
            return total === 0;
        };

        var that = this;

        // draws the 'words' on the pyramid chart
        var load = function() {

            var ren = this.renderer;
            var wordHeight = 11;
            var series = _.first(this.series);
            console.log("series",series);

            _.each(series.points,function(point,index) {
                var featureWords = series.options.featureWords[index].slice(0,4);
                var y = point.plotY - (( featureWords.length * wordHeight)/2);
                _.each(featureWords,function(fw,x) {
                    var word = fw.split(' ').slice(0,2).join(' ');
                    ren.label(word, 5, y + (x*wordHeight))
                    .css({
                        fontWeight: 'normal',
                        fontSize: '75%'
                    })
                    .add();
                });
            });

            ren.label("Only first 3 features are shown", 5, 285)
            .css({
                fontWeight: 'normal',
                fontSize: '60%'
            })
            .add();

            // Separator, client from service
            // ren.path(['M', 120, 40, 'L', 120, 330])
            //     .attr({
            //         'stroke-width': 2,
            //         stroke: 'silver',
            //         dashstyle: 'dash'
            //     })
            //     .add();
            // // Headers
            // ren.label('Web client', 20, 40)
            //     .css({
            //         fontWeight: 'bold'
            //     })
            //     .add();
        };

        var chartConfig = {
            colors : ["#3498db","#f1c40f","#c0392b","#9b59b6","#2ecc71"],
             chart: {
                type: 'pyramid',
                marginRight : 100,
                events : {
                    load : load
                }
            },
            title: {
                text: ''
            },
            plotOptions: {
                pyramid : {
                    allowPointSelect : true
                },
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter : function() {
                            var scope = this.point.y;
                            var completed = this.point.series.options.completedData[this.point.index];
                            var pct = Math.round( scope > 0 ? (completed/scope)*100 : 0);
                            return " [" + completed + "/" + scope + "] ("+pct+"%) " + 
                                _.last(this.point.name.split(">"));
                        },
                        softConnector: true,
                        distance : 10
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
    }

});
