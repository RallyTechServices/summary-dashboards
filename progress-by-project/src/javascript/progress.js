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
            considerVelocity: true,
            groupByFeatureInsteadOfProject: false
        }
    },
    chart: null,

    launch: function() {
        this.considerVelocity = this.getSetting('considerVelocity');
        this.groupByFeatureInsteadOfProject = this.getSetting('groupByFeatureInsteadOfProject') || false;
        if ( this.groupByFeatureInsteadOfProject ) {
            this.considerVelocity = false;
            this.updateSettingsValues({'considerVelocity': false});
        }
        this.setLoading('Loading...');

        Deft.Chain.sequence([
            CArABU.TSUtils.getPortfolioItemTypes,
            CArABU.TSUtils.getScheduleStates
        ],this).then({
            scope: this,
            success: function(results) {
                this.states = results[1];
                this.types = results[0];
                this.logger.log("Found states/types", this.states, this.types);

                var settings = this.getSettings();
                this.bottom_type_path = this.types[0].get('TypePath');
                this.show_scope_selector = false;
                if ( settings.showScopeSelector === true || settings.showScopeSelector === "true" ) {
                    this.show_scope_selector = true;
                }
                this._prepareSelectors();
            }
        });
    },

    _prepareSelectors: function() {
        if ( this.show_scope_selector ) {
            this.down('#selector_box').add({
                xtype : 'tstimeboxselector',
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
                        this._findItemsAndMakeChart(this.release && this.release.get('Name'),this.iteration && this.iteration.get('Name'));
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
            this._findItemsAndMakeChart(release.get("Name"),null);
        }
    },

    _changeIteration: function(iteration) {
        this.logger.log("Change Iteration", iteration);
        this.iteration = iteration;
        if ( !Ext.isEmpty(iteration) ) {
            if ( !Ext.isEmpty(this.release) ) {
                this._findItemsAndMakeChart(this.release.get('Name'), this.iteration.get('Name') );
            } else {
                this._findItemsAndMakeChart(null,iteration.get("Name"));
            }
            return;
        } else if (!Ext.isEmpty(this.release) ) {
            this._findItemsAndMakeChart(this.release.get('Name'),null);
        }
    },

    _defineFilter: function(releaseName,iterationName) {
        this.logger.log("Making filter for ", releaseName, iterationName);
        var feature_field = this._getFeatureFieldName();
        var filter_values =  this.fieldValuePicker && this.fieldValuePicker.getValue() || [];
        var filter_field  = this.getSetting('filterField');
        var filter = CArABU.TSUtils.createFilter(releaseName,iterationName, feature_field);

        if ( filter_field && filter_values && filter_values.length > 0 ) {
            var filter_ors = Ext.Array.map(filter_values, function(value){
                if ( value == "None" ) { value = ""; }
                return {property: feature_field + "." + filter_field, value: value};
            });
            var or_filter = Rally.data.wsapi.Filter.or(filter_ors);
            filter = filter.and(or_filter);
        }
        this.logger.log('filter:', filter);
        return filter;
    },

    _findItemsAndMakeChart: function(releaseName,iterationName) {
        var that = this,
            deferred = Ext.create('Deft.Deferred');

        var filter = this._defineFilter(releaseName,iterationName);

        var promises = [
            function() { return this._getBuckets(releaseName,iterationName); },
            function(buckets) { return this._getStoriesByBucket(filter,buckets); },
            function(buckets_and_current_stories) {
                var buckets = buckets_and_current_stories[0],
                    current_stories = buckets_and_current_stories[1];
                if ( this.groupByFeatureInsteadOfProject ) {
                    return [buckets,current_stories,{}];
                } else {
                    return this._getVelocitiesByProject(buckets,current_stories);
                }
            }
        ];

        Deft.Chain.pipeline(promises,this).then({
            success: function(results) {
                var buckets = results[0],
                    current_stories = results[1],
                    velocities = results[2];

                var chart_data = this.prepareChartData(buckets,current_stories,velocities);
                console.log('chart data:', chart_data);
                this.createChart(chart_data);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred.promise;
    },

    // get the appropriate buckets -- either projects right under
    // the current project (or selected features)
    _getBuckets: function(release_name) {
        if ( this.groupByFeatureInsteadOfProject ) {
            return this._getFeatures(release_name);
        }
        return this._getProjects();
    },

    _getFeatures: function(release_name) {
        var config = {
            model: this.bottom_type_path || "PortfolioItem/Feature",
            fetch: ['ObjectID','Name','FormattedID' ],
            filters: [{
                property: 'Release.Name',
                value: release_name
            }]
        };

        return CArABU.TSUtils.loadWsapiRecords(config);
    },

    _getProjects: function() {
        var deferred = Ext.create('Deft.Deferred');
        var current_project_oid = this.getContext().getProject().ObjectID;
        Rally.data.ModelFactory.getModel({
            type: 'Project',
            success: function(model) {
                model.load(current_project_oid, {
                    fetch: ["_ref","Parent","Children"],
                    callback: function(project, operation) {
                        if(!operation.wasSuccessful()) {
                            deferred.reject(operation);
                        }
                        // if the current project is a leaf just use it
                        if (project.get('Children').Count === 0){
                            deferred.resolve([project]);
                        } else {
                            project.getCollection('Children').load({
                                fetch : ["ObjectID","Name","_ref","Parent","State"],
                                callback: function(records, operation, success) {
                                    var projects = Ext.Array.filter(records, function(r){
                                        return r.get('State') !== 'Closed';
                                    });
                                    deferred.resolve(projects);
                                }
                            });
                        }
                    }
                });
            }
        });
        return deferred.promise;
    },

    _getStoriesByBucket: function(filter,buckets) {
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('_getStoriesByBucket',filter,buckets);
        var promises = Ext.Array.map(buckets, function(bucket){
            var config = {
                model: 'HierarchicalRequirement',
                fetch: ['ObjectID','ScheduleState','PlanEstimate','Project','Name','FormattedID' ],
                filters: filter,
                context: { project: null },
                limit: Infinity,
                pageSize: 2000
            };

            if ( buckets[0].get('_type') == "project" ) {
                config.context = {
                    project: bucket.get('_ref'),
                    projectScopeUp: false,
                    projectScopeDown: true
                };
            } else {
                config.filters = filter.and({
                    property:this._getFeatureFieldName() + ".FormattedID",
                    value: bucket.get('FormattedID')
                });
            }
            return function() {
                return CArABU.TSUtils.loadWsapiRecords(config);
            }
        },this);

        Deft.Chain.sequence(promises,this).then({
            success: function(stories) {
                var stories_by_bucket_id = {};
                Ext.Array.each(buckets, function(bucket,index) {
                    var name = bucket.get(this._getIdField());
                    stories_by_bucket_id[name] = stories[index] || [];
                },this);
                deferred.resolve([buckets,stories_by_bucket_id]);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
            scope: this
        });

        return deferred.promise;
    },

    _getIdField: function() {
        if ( this.groupByFeatureInsteadOfProject ) {
            return "FormattedID";
        }

        return "_refObjectName";
    },

    _getVelocitiesByProject: function(projects,current_stories) {
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
                    var project_name = projects[idx].get('_refObjectName');
                    velocities_by_project_name[project_name] = velocity;
                });
                console.log(velocities_by_project_name);
                deferred.resolve([projects,current_stories,velocities_by_project_name]);
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
                var filter = [];
                Ext.Array.each(iterations, function(iteration){
                    console.log('    iteration: ', iteration.get('Name'), iteration.get('EndDate'));
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
                    fetch: ['PlanEstimate','FormattedID','ScheduleState','Name'],
                    filters: filters,
                    context: {
                        project: { _ref: project.get('_ref') },
                        projectScopeDown: true,
                        projectScopeUp: false
                    },
                    limit: Infinity,
                    pageSize: 2000
                };

                CArABU.TSUtils.loadWsapiRecords(config).then({
                    success: function(artifacts) {
                        var pe = 0;
                        Ext.Array.each(artifacts, function(artifact) {
                            var estimate = artifact.get('PlanEstimate') || 0;
                            pe = pe + estimate;
                        });
                        //var average = pe / iterations.length;
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
        this.logger.log("Get Last Six Iterations for ", project.get('_refObjectName'));
        var today_iso = Rally.util.DateTime.toUtcIsoString(new Date());
        var filters = Rally.data.wsapi.Filter.and([
            {property: 'EndDate', operator: '<=', value: today_iso}
        ]);
        var config = {
            limit: 6,
            pageSize: 6,
            model:'Iteration',
            context: {
                project: { _ref: project.get('_ref') },
                projectScopeDown: true,
                projectScopeUp: false
            },
            fetch: ['Name','EndDate'],
            sorters: { property: 'EndDate', direction: 'DESC' },
            filters: filters
        };
        this.logger.log("Get Last Six Iterations using query: ", filters.toString());


        return CArABU.TSUtils.loadWsapiRecords(config);
    },

    _timeboxChanged : function(timebox) {
        this.logger.log('_timeboxChanged', timebox);

        if (timebox.get("_type")==='release') {
            this._findItemsAndMakeChart(timebox.get("Name"),null);
        } else {
            this._findItemsAndMakeChart(null,timebox.get("Name"));
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
            this._findItemsAndMakeChart(null,newTimeboxScope.getRecord().get("Name"));
        } else {
            if ((newTimeboxScope) && (newTimeboxScope.getType() === 'release')) {
                this.release = newTimeboxScope.getRecord();
                this.publish('timeboxReleaseChanged', this.release);

                this._findItemsAndMakeChart(this.release.getName(),null);
            }
        }
    },

    getPointsByState: function(artifacts,states,past_velocity) {
        var total = _.reduce(artifacts, function(memo,artifact) {
            var points = artifact.get('PlanEstimate') || 0;
            return memo + points;
        },0);

        var denominator = total;
        if ( total <= past_velocity && this.considerVelocity && !this.iteration ) {
            denominator = past_velocity;
        }

        // totals points for a set of work items based on if they are in a set of states
        var stateTotal = _.reduce(artifacts, function(memo,artifact) {
            var points = artifact.get('PlanEstimate') || 0;
            return memo + ( _.indexOf(states,artifact.get("ScheduleState")) > -1 ? points : 0);
        },0);

        var p = ( denominator > 0 ? ((stateTotal/denominator)*100) : 0);
        var summary = { p: p, total: total };
        return summary;
    },

    prepareChartData : function(buckets, stories, velocities_by_project_name) {
        var states = this.states,
            me = this;
        var bucket_keys = Ext.Array.map(buckets, function(bucket){
            return bucket.get(this._getIdField());
        },this);

        var summary = this.createSummaryRecord();

        var seriesData = _.map( _.keys(summary), function( summaryKey ) {
            return {
                name : summaryKey,
                data : _.map( bucket_keys, function( bucket_key, index ) {
                    return  {
                        _total: me.getPointsByState( stories[bucket_key] , summary[summaryKey], velocities_by_project_name[bucket_key]).total,
                        y: me.getPointsByState( stories[bucket_key] , summary[summaryKey], velocities_by_project_name[bucket_key]).p,
                        _velocity: velocities_by_project_name[bucket_key],
                        events: {
                            click: function() {
                                me._showDetailsDialog(bucket_key,stories[bucket_key],summaryKey);
                            }
                        }
                    };
                })
            };
        });
        return { series: seriesData, categories: bucket_keys};
    },

    createChart : function(chart_data) {
        this.setLoading(false);
        var me = this;

        var timebox_progress_plotline = this._getPlotLineForCurrentPoint(this.release,this.iteration);

        // for some reason the original approach of the subclassed chart wasn't replacing
        // the plotline when destroyed and recreated

        var ytext = '% of Scheduled Stories by State by Points';
        if ( this.considerVelocity && !this.iteration ) {
            ytext = 'Scheduled Stories by State by Points (as a % of 6 Sprint Velocity Total)'
        }
        var title = "Progress by Project";
        if ( this.groupByFeatureInsteadOfProject ) {
            title = "Progress by " + this._getFeatureFieldName();
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

        this.chart = Ext.create('Rally.ui.chart.Chart',{
            itemId: 'rally-chart',
            chartColors : ["#ee6c19","#FAD200","#3F86C9","#8DC63F", "#888", "#222"],
            chartData: chart_data,
            chartConfig: {
                colors : ["#ee6c19","#FAD200","#3F86C9","#8DC63F", "#888", "#222"],
                chart: {
                    type: 'bar'
                },
                title: {
                    text: title
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
                    formatter: function(args) {
                        var format = this.series.name + ': ' + Math.round(this.y) + '%' +
                            '<br/>Total: ' + Math.round(this.point._total) + ' points';

                            if (me.considerVelocity) {
                                format = format + '<br/>Velocity: ' + Math.round(this.point._velocity) + ' points';
                            }
                            return format;
                        },
                }
            }
        });
        if ( this.down('#rally-chart') ) {
            this.down('#rally-chart').destroy();
        }
        this.add(this.chart);
    },

    // utilities below here ...
    createSummaryRecord : function() {

        var that = this;
        var summary = {};

        Ext.Array.each(this.states, function(state){
            summary[state] = [ state ];
        });

        // add initial and last states if necessary
        var first = _.first(this.states);
        var last = _.last(this.states);
        if (_.indexOf(summary[_.first(_.keys(summary))],first)===-1)
            summary[_.first(_.keys(summary))].push(_.first(this.states));
        if (_.indexOf(summary[_.last(_.keys(summary))],last)===-1)
            summary[_.last(_.keys(summary))].push(_.last(this.states));

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
                name: 'groupByFeatureInsteadOfProject',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Group by Feature<br/><span style="color:#999999;"><i>Tick to display bars for each lowest-level PI instead of each project</i></span>'
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
    },

    _showDetailsDialog: function(project,workItems,state){
        var title = Ext.String.format('Stories for {0} ({1})',project,state);

        Ext.create('Rally.ui.dialog.Dialog',{
            id: 'detail',
            title: title,
            width: Ext.getBody().getWidth() - 50,
            height: Ext.getBody().getHeight() - 50,
            closable: true,
            layout: 'fit',
            items: [
                {
                    xtype:'rallygrid',
                    model: 'UserStory',
                    showPagingToolbar: false,
                    showRowActionsColumn: false,
                    disableSelection: true,
                    columnCfgs: [
                        { text: 'id', dataIndex: 'FormattedID' },
                        { text: 'Name', dataIndex: 'Name', flex: 1 },
                        { text: 'State', dataIndex: 'ScheduleState' },
                        { text: 'Size', dataIndex: 'PlanEstimate' },
                        { text: 'Project', dataIndex: 'Project', renderer: function(value){ return value._refObjectName }}
                    ],
                    store: Ext.create('Rally.data.custom.Store',{
                        pageSize: 100000,
                        data: workItems,
                        sorters: [{property:'ObjectID',direction:'ASC'}],
                        filters: [{property:'ScheduleState',value:state}]
                    })
                }
            ]
        }).show();
    }

})
