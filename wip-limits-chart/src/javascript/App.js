Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {

        var that = this;

        that.rallyFunctions = Ext.create("RallyFunctions");
        that.rallyFunctions.subscribe(that);
        
        var release = null;
        var iteration = "Iteration 1"; // this.getTimeboxScope();

        var tbs = that.getTimeboxScope();
        if (!_.isNull(tbs)) {
            release = tbs.type === "release" ? tbs.name : null;
            iteration = tbs.type === "iteration" ? tbs.name : null;
        }
        that.run(release,iteration);

    },

    config: {
        defaultSettings : {
            stacking : true
        }
    },

    getSettingsFields: function() {
        return [
            { 
                name: 'stacking',
                xtype: 'rallycheckboxfield',
                label : 'Stack bars on chart'
            }
        ];
    }, 

    run : function(releaseName,iterationName) {

        var that = this;

        var pr = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : that.rallyFunctions.createFilter(releaseName,iterationName)
        });

        pr.readProjectStories(function(error, stories, projects, states){
            that.readWipValues(projects,function(error,wipLimits) {
                that.prepareChartData(stories, projects, wipLimits, function(error, categories, series) {
                    that.createChart(categories,series);
                });
            });
        });
    },  

    _timeboxChanged : function(timebox) {
        var that = this;
        console.log("WIP Limits Chart:_timeboxChanged received");
        if (timebox.get("_type")==='release')
            that.run(timebox.get("Name"),null);
        else
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

    // project-wip:IA-Program > IM FT Client outcomes > CAP DELIVERY 2 Scrum Team:DefinedWIP
    // "project-wip:IA-Program > Big Data Analytics & Shared Services > BDASS:CompletedWIP"

    readWipValues : function(projects,callback) {

        var that = this;

        var projectKeys = _.map( projects, function(p) { return p.get("Name"); });

        var states = ["In-Progress","Completed"];

        var keys = _.flatten(_.map(projectKeys,function(pKey) {
            return _.map(states,function(state) {
                return "project-wip:" + pKey + ":" + state + "WIP";
            });
        }));

        var configs = _.map(keys,function(key) {
            return {
                model : "Preference",
                filters : [{property:"Name",operator:"=",value:key}],
                fetch : true
            };
        });

        async.map(configs, that.rallyFunctions._wsapiQuery, function(error,results){
            callback(null, _.flatten(results));
        });

    },

    prepareChartData : function(stories,projects,wipLimits,callback) {

        var that = this;

        var categories = _.map(projects, function(p) { return _.last(p.get("Name").split('>')); });

        var states = ["In-Progress","Completed"];

        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, states ) {
            var stateTotal = _.reduce(  workItems, function(memo,workItem) {
                    return memo + ( _.indexOf(states,workItem.get("ScheduleState")) > -1 ? 
                            1 : 0);
                },0);
            return stateTotal;
        };

        var wipForProjectAndState = function( project, state ) {
            var wip = _.find( wipLimits, function( limit ) {
                return limit.get("Name").indexOf(project.get("Name"))!==-1 &&
                    limit.get("Name").indexOf(state)!==-1;
            });
            if (!_.isUndefined(wip) && !_.isNull(wip)) {
                var val = wip.get("Value").replace(/"/g,"");
                return parseInt(val,10);
            } else {
                return 0;
            }
        };

        var seriesData = _.map( states, function( state ) {

            var counts = _.map( categories, function( project, index ) {
                return summarize( stories[index], [state]);
            });
            var wips = _.map( categories, function( project, index) {
                return wipForProjectAndState( projects[index], state);
            });

            return {
                name : state,
                data : _.map( categories, function( project, index) {
                    return counts[index] - wips[index];
                })
            };
        });

        callback(null,categories,seriesData);

    },

    createChart : function(categories,seriesData,callback) {

        var that = this;

        if (!_.isUndefined(that.chart)) {
            that.remove(that.chart);
        }

        that.chart = Ext.create('Rally.technicalservices.wipChart', {
            itemId: 'rally-chart',
            chartData: { series : seriesData, categories : categories },
            title: 'WIP Limits by Projecgt',
            stacking : that.getSetting('stacking')
        });

        that.add(that.chart);

        var chart = this.down("#rally-chart");
        var p = Ext.get(chart.id);
        elems = p.query("div.x-mask");
        _.each(elems, function(e) { e.remove(); });
        var elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { e.remove(); });
    }

});
