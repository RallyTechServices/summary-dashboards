Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box' }
    ],

    release: null,
    iteration: null,
    
    config: {
        defaultSettings : { 
            stacking : true,
            showScopeSelector :  false
        }
    },

    launch: function() {
        if (this.isExternal()){
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());
        }
    },

    _launch: function(settings) {
        var that = this;

        console.log("Settings:", settings);
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

        that.run(release,iteration);

    },

    _changeRelease: function(release) {
        if ( this.release !== release ) {
            this.release = release;
            this.run(release.get("Name"),null);
        }
    },

    _changeIteration: function(iteration) {
        if ( iteration !== this.iteration ) {
            this.iteration = iteration;
            this.run(null,iteration.get("Name"),null);
        }
    },


    run : function(releaseName,iterationName) {

        var that = this;

        this.setLoading("Loading...");
        
        that.rallyFunctions = Ext.create("RallyFunctions");

        that.projectStories = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : that.rallyFunctions.createFilter(releaseName,iterationName)
        });

        that.projectStories.readProjectWorkItems(function(error, stories, projects, states){
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

        that.projectStories.readPreferenceValues(keys).then( {
            success: function(values) {
                callback(null,_.flatten(values));
            },
            failure: function() {
                //handle error
            },
            scope: this
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
        this.setLoading(false);
        
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
        var elems = p.query("div.x-mask");
        _.each(elems, function(e) { 
            if ( Ext.isIE9 ) { 
                e.removeNode(); 
            } else { 
                e.remove(); 
            }
        });
        elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { 
            if ( Ext.isIE9 ) { 
                e.removeNode(); 
            } else { 
                e.remove(); 
            }
        });
        
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
        console.log('onSettingsUpdate',settings);
        Ext.apply(this, settings);
        this._launch(settings);
    },

    getSettingsFields: function() {
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
                name: 'stacking', 
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel : 'If true the chart values will be stacked, otherwise shown side by side'
            }
        ];
    }

});
