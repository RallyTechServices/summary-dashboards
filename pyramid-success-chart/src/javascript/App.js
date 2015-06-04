Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        var that = this;
        var release = null;
        var iteration = "Iteration 1"; // this.getTimeboxScope();

        that.rallyFunctions = Ext.create("RallyFunctions");
        
        var tbs = that.getTimeboxScope();

        if (!_.isNull(tbs)) {
            release = tbs.type === "release" ? tbs.name : null;
            iteration = tbs.type === "iteration" ? tbs.name : null;
        }

        that.run(release,iteration);
    },

    run : function(releaseName,iterationName) {

        var that = this;

        var pr = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : that.rallyFunctions.createFilter(releaseName, iterationName)
        });

        pr.readProjectStories(function(error, stories, projects, states){
            that.prepareChartData( stories, projects, states, function(error,series,categories) {
                that.createChart(series,categories);    
            });
            
        });
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

    createChart : function(categories,seriesData,callback) {

        var that = this;

        var chartConfig = {
            colors : ["#3498db","#f1c40f","#c0392b","#9b59b6","#2ecc71"],
             chart: {
                type: 'pyramid',
                marginRight : 100
            },
            title: {
                text: 'Success Chart'
            },
            plotOptions: {
                pyramid : {
                    allowPointSelect : true
                },
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter : function() {
                            console.log(this);
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
        that.add(that.x);
    }

});
