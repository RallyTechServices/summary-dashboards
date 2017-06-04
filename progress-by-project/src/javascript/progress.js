Ext.define("TSProgressByProject", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box', layout: 'hbox' }
    ],
    config: {
        defaultSettings: {
            showScopeSelector :  true,
            filterFieldName: 'Commitment for Release',
            iterationNoEntryText: 'PI Scope',
            considerVelocity: true
        }
    },
    chart: null,

    launch: function() {
        this.considerVelocity = this.getSetting('considerVelocity');
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
                iterationNoEntryText: this.getSetting('iterationNoEntryText'),
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
            var display_name = this.getSetting('filterFieldName') || this.getSetting('filterField');
        	var label = Ext.String.format('Restrict {0} to:', display_name);

            this.fieldValuePicker = this.down('#selector_box').add({
                xtype: 'rallyfieldvaluecombobox',
                fieldLabel: label,
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
        this.logger.log("Change release", release);
        this.release = release;
        this.iteration = null;
        if ( !Ext.isEmpty(this.release) ) {
            this.run(release.get("Name"),null);
        }
    },

    _changeIteration: function(iteration) {
        this.logger.log("Change Iteration", iteration);
        this.iteration = iteration;
        if ( !Ext.isEmpty(iteration) ) {
            if ( !Ext.isEmpty(this.release) ) {
                this.run(this.release.get('Name'), this.iteration.get('Name') );
            } else {
                this.run(null,iteration.get("Name"));
            }
            return;
        } else if (!Ext.isEmpty(this.release) ) {
            this.run(this.release.get('Name'),null);
        }
    },

    run: function(releaseName,iterationName) {
        if ( ! Ext.isEmpty(this.chart) ) {
            this.chart.destroy();
        }
        this._findItemsAndMakeChart(releaseName,iterationName);
    },

    _findItemsAndMakeChart: function(releaseName,iterationName) {
        var that = this;
        var feature_field = this._getFeatureFieldName();

        var filter_values =  this.fieldValuePicker && this.fieldValuePicker.getValue() || [];
        var filter_field  = this.getSetting('filterField');

        this.setLoading("Loading Stories in Project...");

        this.logger.log("Making filter for ", releaseName, iterationName);

        var filter = that.rallyFunctions.createFilter(releaseName,iterationName, feature_field);

        if ( filter_field && filter_values && filter_values.length > 0 ) {

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
            that._getVelocitiesByProjectName(projects).then({
                success: function(velocities_by_project_name) {
                    that.prepareChartData( stories, projects, states, velocities_by_project_name, function(error, categories, series) {
                        that.createChart( categories, series );
                    });
                },
                failure: function(msg) {
                    Ext.Msg.alert("Problem gathering data", msg);
                }
            });

        });
    },

    _getVelocitiesByProjectName: function(projects) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');

        var promises = [];
        Ext.Array.each(projects, function(project) {
            promises.push( function() { return me._getVelocityForProject(project); });
        });

        Deft.Chain.sequence(promises,this).then({
            success: function(velocities) {
                var velocities_by_project_name = {};
                Ext.Array.each(velocities, function(velocity,idx) {
                    var project_name = projects[idx].get('Name');
                    velocities_by_project_name[project_name] = velocity;
                });

                deferred.resolve(velocities_by_project_name);
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _getVelocityForProject: function(project){
        var deferred = Ext.create('Deft.Deferred');
        // get last six iterations
        this._getLastSixIterations(project).then({
            scope: this,
            success: function(iterations) {
                this.logger.log("six iterations:", iterations);
                var filter = [];
                Ext.Array.each(iterations, function(iteration){
                    filter.push({property:'Iteration.Name',value: iteration.get('Name')});
                });
                if ( iterations.length === 0 ) {
                    deferred.resolve(0);
                    return;
                }
                var filters = Rally.data.wsapi.Filter.or(filter);

                filters = filters.and(Ext.create('Rally.data.wsapi.Filter',{
                    property:'AcceptedDate',
                    operator: '!=',
                    value: null
                }));
                var config = {
                    //models: ['HierarchicalRequirement','Defect','TestSet','DefectSuite'],
                    models: ['HierarchicalRequirement'],
                    fetch: ['PlanEstimate'],
                    filters: filters,
                    limit: Infinity,
                    pageSize: 2000
                };

                this.rallyFunctions.loadWsapiRecords(config).then({
                    success: function(artifacts) {
                        var pe = 0;
                        Ext.Array.each(artifacts, function(artifact) {
                            var estimate = artifact.get('PlanEstimate') || 0;
                            pe = pe + estimate;
                        });
                        var average = pe / iterations.length;
                        //deferred.resolve(average);
                        deferred.resolve(pe);
                    },
                    failure: function(msg) {
                        deferred.reject(msg);
                    }
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _getLastSixIterations: function(project) {
        var today_iso = Rally.util.DateTime.toIsoString(new Date());
        var config = {
            limit: 6,
            pageSize: 6,
            model:'Iteration',
            fetch: ['Name'],
            sorters: { property: 'EndDate', direction: 'DESC' },
            filters: [
                {property: 'EndDate', operator: '<', value: today_iso},
                {property: 'Project.ObjectID', value: project.get('ObjectID') }
            ]
        };

        return this.rallyFunctions.loadWsapiRecords(config);
    },

    _timeboxChanged : function(timebox) {
        this.logger.log('_timeboxChanged', timebox);

        if (timebox.get("_type")==='release') {
            this.run(timebox.get("Name"),null);
        } else {
            this.run(null,timebox.get("Name"));
        }
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
                this.release = newTimeboxScope.getRecord();
                this.publish('timeboxReleaseChanged', this.release);

                this.run(this.release.getName(),null);
            }
        }
    },

    prepareChartData : function(stories, projects, states, velocities_by_project_name, callback) {
        var that = this;

        var projectKeys = _.map(projects,function(project) { return _.last(project.get("Name").split('>')); });

        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, states, past_velocity ) {
            // calc total points
            var total = _.reduce(workItems, function(memo,workItem) {
                    return memo + pointsValue(workItem.get("PlanEstimate"));
            },0);

            //console.log( 'total, past velocity', total, past_velocity);

            var denominator = total;
            if ( total <= past_velocity && that.considerVelocity && !that.iteration ) {
                denominator = past_velocity;
            }
            // totals points for a set of work items based on if they are in a set of states
            var stateTotal = _.reduce(  workItems, function(memo,workItem) {
                return memo + ( _.indexOf(states,workItem.get("ScheduleState")) > -1 ?
                            pointsValue(workItem.get("PlanEstimate")) : 0);
            },0);

            var p = ( denominator > 0 ? ((stateTotal/denominator)*100) : 0);
            var summary = { p: p, total: total };
            return summary;
        };

        var summary = that.createSummaryRecord();

        var seriesData = _.map( _.keys(summary), function( summaryKey ) {
            return {
                name : summaryKey,
                data : _.map( projectKeys, function( projectKey, index ) {
                    return  {
                        _total: summarize( stories[index] , summary[summaryKey], velocities_by_project_name[projectKey]).total,
                        y: summarize( stories[index] , summary[summaryKey], velocities_by_project_name[projectKey]).p,
                        _velocity: velocities_by_project_name[projectKey]
                    };
                })
            };
        });

        callback(null, projectKeys, seriesData );

    },

    formatter: function(args) {
        return this.series.name + ': ' + Math.round(this.y) + '%' +
            '<br/>Total: ' + Math.round(this.point._total) + ' points' +
            '<br/>Velocity: ' + Math.round(this.point._velocity) + ' points';

//        var this_point_index = this.series.data.indexOf( this.point );
//        var this_series_index = this.series.index;
//        var that_series_index = this.series.index == 0 ? 1 : 0; // assuming 2 series
//        var that_series = args.chart.series[that_series_index];
//        var that_point = that_series.data[this_point_index];
//        return 'Client: ' + this.point.name +
//               '<br/>Client Health: ' + this.x +
//               '<br/>' + this.series.name + ' Bandwidth: ' + this.y + 'Kbps' +
//               '<br/>' + that_series.name + ' Bandwidth: ' + that_point.y + 'Kbps';
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

        var ytext = '% of Scheduled Stories by State by Points';
        if ( that.considerVelocity && !that.iteration ) {
            ytext = 'Scheduled Stories by State by Points (as a % of 6 Sprint Velocity Total)'
        }
        var yAxis = {
            min: 0,
            max: 100,
            title: {
                text: ytext
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
                                if ( this.y === 0 ) { return ""; }
                                var value = Math.round(this.y);
                                if ( this.point._total > this.point._velocity ) {
                                    return "<span class='icon-warning'></span>" + value + " %";
                                }
                                return value + " %";

                            },
                            useHTML: true,
                            color: '#FFFFFF'
                        },
                        stacking: 'normal'
                    }
                },
                tooltip: {
                    enabled: true,
                    formatter: that.formatter
                }
            }
        });
        if ( that.down('#rally-chart') ) {
            that.down('#rally-chart').destroy();
        }
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
            	name: 'filterFieldName',
            	xtype:'rallytextfield',
            	hidden: true
            },
            {
                name: 'filterField',
                xtype: 'rallyfieldcombobox',
                fieldLabel: 'Filter Field',
                labelWidth: 80,
                labelAlign: 'left',
                width: 250,
                margin: 25,
                autoExpand: false,
                alwaysExpanded: false,
                model: this.bottom_type_path,
                _isNotHidden: function(field) {
                    if ( field.hidden ) { return false; }
                    var defn = field.attributeDefinition;
                    if ( Ext.isEmpty(defn) ) { return false; }

                    return ( defn.Constrained && ( defn.AttributeType == 'STRING' || defn.AttributeType == 'RATING' ));
                },
                listeners: {
                	change: function(cb) {
                		var display_name = "";
                		var field = cb.getRecord();
                		if ( field ) {
                			name = field.get('name');
                		}
                		var name_holders = Ext.ComponentQuery.query('[name=filterFieldName]');
                		if ( name_holders && name_holders[0] ) {
                			name_holders[0].setValue(name);
                		} else {
                			console.log('nope');
                		}
                	}
                }
            },
            {
                name: 'iterationNoEntryText',
                xtype: 'rallytextfield',
                fieldLabel: 'Text for No Selection Iteration',
                labelWidth: 80,
                labelAlign: 'left',
                width: 250,
                margin: 25
            },
            {
                name: 'considerVelocity',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Consider Velocity<br/><span style="color:#999999;"><i>Tick to make display bars a percentage of historical velocity</i></span>'
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
