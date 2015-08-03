/**
 * the loading mask wasn't going away!
 */

Ext.override(Rally.ui.chart.Chart,{
    onRender: function () {
        this.callParent(arguments);
        this._unmask();
    }
});

Ext.define("TSProjectByProject", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box' }
    ],
    config: {
        defaultSettings: {
            showScopeSelector :  false
        }
    },

    launch: function() {
        var me = this;
        this._getAvailableStates().then({
            scope: this,
            success: function(results) {
                if (this.isExternal()){
                    this.showSettings(this.config);
                } else {
                    this.onSettingsUpdate(this.getSettings());
                }
            }
        });
        
    },

    _launch: function(settings) {
        var that = this;

        that.rallyFunctions = Ext.create("RallyFunctions");
        
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
        
        //that.run(release,iteration);
       
    },

    _changeRelease: function(release) {
        this.run(release.get("Name"),null);
    },

    _changeIteration: function(iteration) {
        if ( !Ext.isEmpty(iteration) ) {
            this.run(null,iteration.get("Name"),null);
        }
    },

    run : function(releaseName,iterationName) {

        var that = this;
        
        this.setLoading("Loading Stories in Project...");
        
        var pr = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : that.rallyFunctions.createFilter(releaseName,iterationName)
        });

        pr.readProjectWorkItems(function(error, stories, projects, states) {
            that.prepareChartData( stories, projects, states, function(error, categories, series) {
                that.createChart( categories, series );
            });
        });

    },

    _timeboxChanged : function(timebox) {
        var that = this;
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

    prepareChartData : function(stories, projects, states, callback) {
        this.logger.log('states', states);
        var that = this;

        var projectKeys = _.map(projects,function(project) { return _.last(project.get("Name").split('>')); });

        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, states ) {

            // calc total points
            var total = _.reduce(workItems, function(memo,workItem) {
                    return memo + pointsValue(workItem.get("PlanEstimate"));
            },0);

            // totals points for a set of work items based on if they are in a set of states
            var stateTotal = _.reduce(  workItems, function(memo,workItem) {
                return memo + ( _.indexOf(states,workItem.get("ScheduleState")) > -1 ? 
                            pointsValue(workItem.get("PlanEstimate")) : 0);
            },0);

            var p = ( total > 0 ? ((stateTotal/total)*100) : 0);
            return p;
        };

        var summary = that.createSummaryRecord();

        var seriesData = _.map( _.keys(summary), function( summaryKey ) {
            return {
                name : summaryKey,
                data : _.map( projectKeys, function( projectKey, index ) {
                    return summarize( stories[index] , summary[summaryKey]);
                })
            };
        });

        this.logger.log('seriesData:', seriesData);
        
        callback(null, projectKeys, seriesData );

    },

    createChart : function(categories,seriesData,callback) {

        var that = this;
        that.setLoading(false);
        
        if (!_.isUndefined(that.chart)) {
            that.remove(that.chart);
        }

        that.chart = Ext.create('Rally.technicalservices.progressChart', {
            itemId: 'rally-chart',
            chartData: { series : seriesData, categories : categories },
            title: 'Progress By Project'
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
    
    _getAvailableStates: function() {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this.scheduleStates = [];
        
        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function(model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        Ext.Array.each(records, function(allowedValue) {
                            me.scheduleStates.push(allowedValue.get('StringValue'));
                        });
                        
                        deferred.resolve(me.scheduleStates);
                    }
                });
            }
        });
        return deferred.promise;
    },

    // utilities below here ... 
    createSummaryRecord : function() { 

        var that = this;
        var summary = {};
        
        Ext.Array.each(this.scheduleStates, function(state){
            summary[state] = [ state ];
        });
//        var summary = {
//            "Backlog" : ["Defined"],
//            "In-Progress" : ["In-Progress"],
//            "Complete":  ["Completed"],
//            "Accepted" : ["Accepted"],
//            "Released" : ["Released"]
//        };

        // add initial and last states if necessary
        var first = _.first(that.scheduleStates);
        var last = _.last(that.scheduleStates);
        if (_.indexOf(summary[_.first(_.keys(summary))],first)===-1)
            summary[_.first(_.keys(summary))].push(_.first(that.scheduleStates));
        if (_.indexOf(summary[_.last(_.keys(summary))],last)===-1)
            summary[_.last(_.keys(summary))].push(_.last(that.scheduleStates));

        return summary;
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {
        this.logger.log('showSettings');
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
        this.logger.log('onSettingsUpdate',settings);
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
            }
        ];
    }
});
