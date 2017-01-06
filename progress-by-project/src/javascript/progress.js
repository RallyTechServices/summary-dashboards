
Ext.define("TSProjectByProject", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box', layout: 'hbox' }
    ],
    config: {
        defaultSettings: {
            showScopeSelector :  true
        }
    },
    chart: null,
    
    launch: function() {
        var me = this;
        
        Deft.Chain.sequence([
            this._getPortfolioItemTypes,
            this._getAvailableStates
        ],this).then({
            scope: this,
            success: function(results) {
                var states = results[1],
                    types = results[0];
                    
                this.bottom_type_path = types[0].get('TypePath');

                this._launch(this.getSettings());
                
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
        
        if ( this.getSetting('filterField') ) {

            this.fieldValuePicker = this.down('#selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                fieldLabel: 'Restrict ' + this.getSetting('filterField') + ' to:',
                labelWidth: 225,
                labelAlign: 'right',
                margin: '7 0 0 25',
                minWidth: 300,
                value: ['zz'],
                allowClear: false,
                setUseNullForNoEntryValue: true,
                model: this.bottom_type_path,
                field: this.getSetting('filterField'),
                multiSelect: true,
                listeners: {
                    scope: this,
                    blur: function() {
                        this.run(this.release && this.release.get('Name'),this.iteration && this.iteration.get('Name'));
                    }
                }
            });
        }
    },

    _changeRelease: function(release) {
        this.release = release;
        this.run(release.get("Name"),null);
    },

    _changeIteration: function(iteration) {
        this.iteration = iteration;
        if ( !Ext.isEmpty(iteration) ) {
            this.run(null,iteration.get("Name"));
        }
    },

    run : function(releaseName,iterationName) {
        this.logger.log('release/iteration', releaseName, iterationName);
        
        var that = this;
        if ( ! Ext.isEmpty(this.chart) ) {
            this.chart.destroy();
        }
        
        var filter_values =  this.fieldValuePicker && this.fieldValuePicker.getValue() || [];
        var filter_field  = this.getSetting('filterField');

        this.setLoading("Loading Stories in Project...");
        
        var filter = that.rallyFunctions.createFilter(releaseName,iterationName);
        
        if ( filter_field && filter_values && filter_values.length > 0 ) {
            var feature_field = this._getFeatureFieldName();
            
            var filter_ors = Ext.Array.map(filter_values, function(value){
                if ( value == "None" ) { value = ""; }
                return {property: feature_field + "." + filter_field, value: value};
            });
            var or_filter = Rally.data.wsapi.Filter.or(filter_ors);
            filter = filter.and(or_filter);
        }
        
        var pr = Ext.create( "ProjectStories", {
            ctx : that.getContext(),
            filter : filter
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
        
        callback(null, projectKeys, seriesData );

    },

    createChart : function(categories,seriesData,callback) {
        var that = this;
        that.setLoading(false);

        var timebox_progress_plotline = this._getPlotLineForCurrentPoint(this.release,this.iteration);
        
//        that.chart = Ext.create('Rally.technicalservices.progressChart', {
//            itemId: 'rally-chart',
//            chartData: { series : seriesData, categories : categories },
//            title: 'Progress By Project',
//            plotLine: timebox_progress_plotline
//        });
        
        // for some reason the original approach of the subclassed chart wasn't replacing
        // the plotline when destroyed and recreated
        
        var yAxis = {
            min: 0,
            max: 100,
            title: {
                text: '% of Scheduled Stories by State by Points'
            }
        };
        
        if ( !Ext.isEmpty(timebox_progress_plotline) ) {
            yAxis.plotLines = [timebox_progress_plotline];
        }
        
        that.chart = Ext.create('Rally.ui.chart.Chart',{
            itemId: 'rally-chart',
            chartColors : ["#ee6c19","#FAD200","#3F86C9","#8DC63F", "#888", "#222"],
            chartData: { series : seriesData, categories : categories },
            chartConfig: {
                colors : ["#ee6c19","#FAD200","#3F86C9","#8DC63F", "#888", "#222"],
                chart: {
                    type: 'bar'
                },
                title: {
                    text: 'Progress by Project'
                },
                xAxis: {
                    tickInterval: 1,
                    title: {
                        text: ''
                    }
                },
                yAxis: [ yAxis ],
                legend: {
                    reversed: true
                },
                plotOptions: {
                    series: {
                        dataLabels: {
                            enabled: true,
                            align: 'center',
                            formatter : function() {
                                return (this.y !== 0) ? (Math.round(this.y) + " %") : "";
                            },
                            color: '#FFFFFF'
                        },
                        stacking: 'normal'
                    }        
                },
                tooltip: { enabled: false }
            }
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
        
    _getPortfolioItemTypes: function(workspace) {
        var deferred = Ext.create('Deft.Deferred');
                
        var store_config = {
            fetch: ['Name','ElementName','TypePath'],
            model: 'TypeDefinition',
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load types');
                    }
                }
            }
        };
        
        if ( !Ext.isEmpty(workspace) ) {            
            store_config.context = { 
                project:null,
                workspace: workspace._ref ? workspace._ref : workspace.get('_ref')
            };
        }
                
        var store = Ext.create('Rally.data.wsapi.Store', store_config );
                    
        return deferred.promise;
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

        // add initial and last states if necessary
        var first = _.first(that.scheduleStates);
        var last = _.last(that.scheduleStates);
        if (_.indexOf(summary[_.first(_.keys(summary))],first)===-1)
            summary[_.first(_.keys(summary))].push(_.first(that.scheduleStates));
        if (_.indexOf(summary[_.last(_.keys(summary))],last)===-1)
            summary[_.last(_.keys(summary))].push(_.last(that.scheduleStates));

        return summary;
    },
    
    _getPlotLineForCurrentPoint: function(release,iteration){
        if ( Ext.isEmpty(iteration) && Ext.isEmpty(release) ) {
            return null;
        }
                
        var timebox_start = null;
        var timebox_end = null;
        var timebox_type = null;
        
        if ( !Ext.isEmpty(release) ) {
            timebox_start = release.get('ReleaseStartDate');
            timebox_end = release.get('ReleaseDate');
            timebox_type = 'Release';
        }
        
        if ( !Ext.isEmpty(iteration) && !Ext.isEmpty(iteration.get('StartDate') ) ) {
            timebox_start = iteration.get('StartDate');
            timebox_end = iteration.get('EndDate');
            timebox_type = 'Iteration';
        }
        
        var today = new Date();
        
        var timebox_length = Rally.util.DateTime.getDifference(timebox_end, timebox_start, 'day');
        var time_since_start = Rally.util.DateTime.getDifference(today, timebox_start, 'day');
        
        var progress = time_since_start / timebox_length;
        
        if ( progress < 0 || progress > 1 ) {
            return null;
        }
        
        var plotline = {
            value: 100 * progress,
            color: 'green',
            dashStyle: 'shortdash',
            width: 2,
            label: {
                text: 'today'
            },
            zIndex: 5 // to put on top
        };

        return plotline;
    },

    _getFeatureFieldName: function() {
        var path = this.bottom_type_path || "Feature";
        path = path.replace(/^.*\//,'');
        return path;
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [ 
            {
                name: 'filterField',
                xtype: 'rallyfieldcombobox',
                fieldLabel: 'Filter Field',
                labelWidth: 85,
                labelAlign: 'left',
                minWidth: 175,
                margin: 25,
                autoExpand: false,
                alwaysExpanded: false,                
                model: this.bottom_type_path,
                _isNotHidden: function(field) {
                    if ( field.hidden ) { return false; }
                    var defn = field.attributeDefinition;
                    if ( Ext.isEmpty(defn) ) { return false; }
                    
                    return ( defn.Constrained && ( defn.AttributeType == 'STRING' || defn.AttributeType == 'RATING' ));
                }
            },
            
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
