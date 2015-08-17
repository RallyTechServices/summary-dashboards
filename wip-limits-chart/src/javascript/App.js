Ext.define("TSWIPLimitsChart", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    keyPrefix: 'project-wip:',

    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box' }
    ],
    logger: new Rally.technicalservices.Logger(),

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
        this.subscribe(this, 'ts-wip-change', this._updateWip, this);

    },

    _changeRelease: function(release) {
        if ( this.release !== release ) {
            this.release = release;
            this._getData(release.get("Name"),null);
        }
    },

    _changeIteration: function(iteration) {
        if ( iteration !== this.iteration ) {
            this.iteration = iteration;
            this._getData(null,iteration.get("Name"));
        }
    },

    _updateWip: function(store) {
        this.logger.log('got new values!',store);
        var releaseName = null;
        var iterationName = null;
        if ( this.release ) { releaseName = this.release.get('Name'); }
        if ( this.iteration ) { iterationName = this.iteration.get('Name'); }
        
        this.wipStore = store;
        
        this._getData(releaseName, iterationName);
    },

    _getData: function(releaseName, iterationName) {
        var me = this;
        Deft.Promise.all([
            this._getAvailableStates(),
            this._getProjects(),
            this._getPrefs()
        ]).then({
            scope: this,
            success: function(results) {
                this.states = results[0];
                this.projects = results[1];
                this.preferences = results[2];
                
                this.projects_by_oid = {};
                Ext.Array.each(this.projects, function(project){
                    var oid = project.get('ObjectID');
                    this.projects_by_oid[oid] = project.getData();
                },this);
                
                this.prefs_by_name = {};
                Ext.Array.each(this.preferences, function(preference){
                    var name = preference.get('Name');
                    this.prefs_by_name[name] = preference;
                },this);
                
                this._getStories(releaseName,iterationName);
            }
        }).always(function() { me.setLoading(false); });
    },
    
    _getStories: function(releaseName,iterationName) {
        this.setLoading('Finding Stories...');
        
        var filters = [];
        if ( releaseName ) { 
            filters = { property:'Release.Name', value: releaseName };
        }
        if ( iterationName ) { 
            filters = { property:'Iteration.Name', value: iterationName };
        }
        
        var store = Ext.create('Rally.data.wsapi.Store', {
            model : 'hierarchicalrequirement',
            filters: filters,
            fetch : [
                'ObjectID',
                'Name',
                'FormattedID',
                'Project',
                'ScheduleState',
                'Parent',
                'Children'
            ],
            limit : Infinity
        });
        store.on('load', this._onStoriesLoaded, this);
        store.load();
    },
    
    _onStoriesLoaded : function(store, stories) {
        var me = this;
        var states = this.states;
        
        this.setLoading(false);
        
        var projectGroup = _.groupBy(stories, function(t){
            return t.get("Project") ? t.get("Project").ObjectID : "none";
        });
        
        me.summaries = _.map(_.keys(projectGroup), function(project_oid) {
            var stories = projectGroup[project_oid];
            var project = me.projects_by_oid[project_oid] || "none";
            return me._getSummary(stories, project);
        }, this);
        
        // set wip limits from memory
        Ext.Array.each(me.summaries, function(row) {
            Ext.Array.each(states, function(state) {
                var wipKey = state + 'WIP';
                me._getWipLimit(wipKey,row);
            });
        });
       
        // roll up data through tree
        var rolled_up_data = me._rollUpValues(me.summaries);
        
        var chart_data = me.prepareChartData(rolled_up_data);
        this.createChart(chart_data);
        
    },
    
    _getSummary: function(stories, project){
        var me = this;
        var counts = _.countBy(stories, function(story) {
            return story.get('ScheduleState');
        });
        
        var values = {};
        
        _.each(me.states, function(state){
            values[state] = _.isUndefined(counts[state]) ? 0 : counts[state];
            var wipKey = state + 'WIP';
            values[wipKey] = 0;
        });
        values.project = project;
        values.projectName = project.Name;
        values.ObjectID = project.ObjectID;
        
        values.leaf = ( !project.Children || project.Children.Count === 0 );
        
        return values;
    },
    
    _rollUpValues: function(summaries) {
        var me = this;
        this.logger.log('_rollUpValues');
        
        var leaves = Ext.Array.filter(summaries, function(summary) {
            return ( summary.leaf );
        });
        
        me.summaries_by_oid = {};
        Ext.Array.each(summaries, function(summary){
            me.summaries_by_oid[summary.project.ObjectID] = summary;
        });
        
        Ext.Array.each( leaves, function(leaf){
            if (! Ext.isEmpty( leaf.project.Parent ) ) {
                Ext.Object.each(leaf, function(field, value){
                    var parent = me.summaries_by_oid[leaf.project.Parent.ObjectID];
                    if ( /WIP/.test(field) ) {
                        this._rollUpToParent(field, value, leaf, parent);
                    } 
                },this);
            } 
        },this);
        
        var updated_summaries = Ext.Object.getValues(me.summaries_by_oid);
        
        var tops = Ext.Array.filter(updated_summaries, function(summary){ 
            return (!summary.project.Parent); 
        } );
        
        me.children_by_parent_oid = {};
        Ext.Array.each(updated_summaries, function(summary){
            var parent = summary.project.Parent;
            if ( !Ext.isEmpty(parent) ) {
                var parent_oid = parent.ObjectID;
                if ( !me.children_by_parent_oid[parent_oid] ){
                    me.children_by_parent_oid[parent_oid] = [];
                }
                me.children_by_parent_oid[parent_oid].push(summary);
            }
        });
        
        // go top down for when every node level can have a value
        // (not just built up from the bottom like wip limits
        Ext.Array.each(tops, function(top){
            Ext.Object.each(top, function(field, value){
                if ( Ext.Array.contains(me.states,field) ) {
                    me._rollUpFromChildren(top,field);
                } 
            },this);
        });
        
        return updated_summaries;
        
    },
    
    _rollUpFromChildren: function(parent, field){
        var me = this;
        var parent_oid = parent.project.ObjectID;
        
        var parent_value = me.summaries_by_oid[parent_oid][field] || 0;
        var children = me.children_by_parent_oid[parent_oid];
        var total_value = parent_value;
        
        Ext.Array.each(children, function(child){
            var child_value = child[field] || 0;
            if ( ! Ext.isEmpty( me.children_by_parent_oid[child.project.ObjectID] ) ) {
                child_value = me._rollUpFromChildren(child,field);
            }
            total_value = child_value + total_value;
        });
        me.summaries_by_oid[parent_oid][field] = total_value;
        return total_value;
    },
    
    _rollUpToParent: function(field, value, child, parent) {
        var me = this;
        
        if ( child.project.ObjectID !== this.getContext().getProject().ObjectID ) {
           
            if ( Ext.isEmpty(parent) ){
                var parent_oid = child.project.Parent.ObjectID;
                if ( ! me.summaries_by_oid[parent_oid] ) {
                    parent_project = this.projects_by_oid[parent_oid];                    
                    me.summaries_by_oid[parent_oid] = this._getSummary([],parent_project);
                }
                parent = me.summaries_by_oid[parent_oid];
            }
            
            if ( parent ) {
                var child_value = value || 0;
                var parent_value = parent[field] || 0;

                parent[field] = child_value + parent_value;
                
                var grand_parent = parent.project.Parent;
                if ( !Ext.isEmpty(grand_parent) ) {
                    me._rollUpToParent(field, value, parent,me.summaries_by_oid[grand_parent.ObjectID]);
                }
            }
        }
        return me.summaries_by_oid;
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

    prepareChartData : function(data) {
        var that = this;
        
        var states = ["In-Progress","Completed"];

        var current_project = this.getContext().getProject();

        var current_project_oids = Ext.Array.map(
            Ext.Array.filter(that.projects, function(project){
                var parent = project.get('Parent');
                return (parent && parent.ObjectID == current_project.ObjectID );
            }), function(project) {
                return project.get('ObjectID');
            }
        );
        
        var filtered_data = Ext.Array.filter(data, function(datum){
            return ( Ext.Array.contains(current_project_oids, datum.ObjectID) );
        });
        
        var categories = Ext.Array.map( filtered_data, function(datum) {
            var name_array = datum.projectName.split('>');
            return name_array[name_array.length - 1];
        });
        
        
        var seriesData = Ext.Array.map(states, function(state){
            var counts = Ext.Array.map(filtered_data, function(datum){
                return datum[state] - datum[state + "WIP"];
            });
            return {
                name: state,
                data: counts
            }
        });
        
        return [ categories, seriesData ];
    },
    
    _getWipKey : function(project, state) {
        return this.keyPrefix + project + ':' + state;
    },
    
    _getWipLimit : function(state, row) {
        var key = this._getWipKey(row.projectName, state);
        
        var pref = this.prefs_by_name[key];
        if (pref && pref.get('Value') && row.leaf ) {
            row[state] = parseInt( Ext.JSON.decode(pref.get('Value')), 10 );
        }
        return row;
    },
    
    _getProjects: function() {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.setLoading("Loading projects");
                  
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['ObjectID','Name','Parent','Children'],
            filters: [{property:'State',value:'Open'}],
            limit: 'Infinity'
        }).load({
            callback : function(records, operation, successful) {
                me.setLoading(false);
                
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _getPrefs: function() {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.setLoading("Loading prefs");
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Preference',
            fetch: ['Name','Value','ObjectID'],
            filters: [{property:'Name',operator:'contains',value:me.keyPrefix}],
            limit: 'Infinity'
        }).load({
            callback : function(records, operation, successful) {
                me.setLoading(false);
                
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
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

    createChart : function(chart_data) {

        var that = this;
        
        var categories = chart_data[0];
        var seriesData = chart_data[1];
        
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