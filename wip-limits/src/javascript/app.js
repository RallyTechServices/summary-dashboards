Ext.define('wip-limits', {
    extend : 'Rally.app.App',
    logger: new Rally.technicalservices.Logger(),
    layout : {
        type : "fit"
    },
    mixins : [
        'Rally.Messageable'
    ],
    
    launch : function() {
        var me = this;
        Deft.Promise.all([
            this._getAvailableStates(),
            this._getProjects()
        ]).then({
            scope: this,
            success: function(results) {
                this.states = results[0];
                this.projects = results[1];
                this.projects_by_oid = {};
                Ext.Array.each(this.projects, function(project){
                    var oid = project.get('ObjectID');
                    this.projects_by_oid[oid] = project.getData();
                },this);
                
                this._updateBoard();
            }
        }).always(function() { me.setLoading(false); });
    },
    
    _updateBoard : function() {
        this.setLoading('Finding Stories...');
        
        var store = Ext.create('Rally.data.wsapi.Store', {
            model : 'hierarchicalrequirement',
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
        
        console.log('summaries',me.summaries);
        
        this.setLoading('Loading WIP Limits...');
        var promises = [];
        
        Ext.Array.each(me.summaries, function(row) {
            Ext.Array.each(states, function(state) {
                var wipKey = state + 'WIP';
                promises.push(function() {
                    return me._getWipLimit(wipKey,row);
                });
            });
        });

        this.logger.log('promises:', promises.length);
        
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(rows) {
                this.logger.log('back:', me.summaries);
                
                var rolled_up_data = me._rollUpValues(me.summaries);
                
                me.newStore = Ext.create('Rally.data.custom.Store', {
                    data : rolled_up_data,
                    sorters : {
                        property : 'projectName',
                        direction : 'ASC'
                    }
                });
                
                // TODO: update calculations after change to wip
                // TODO: publish change so chart changes
                me.newStore.addListener('update', function(store, record, op, fieldNames, eOpts){
                    if (op == 'edit') {
                        var projectName = record.get('projectName');
                        var fieldName = _.first(fieldNames);
                        var value = record.get(fieldName);
                        if ( record.get('leaf') ) {
                            me._setWipLimit(projectName, fieldName, value);
                        } else {
                            me.logger.log("Can only set wip on children");
                        }
                    }
                }, store, {
                // single: true
                });
                me._displayGrid(me.newStore);
            },
            failure: function(msg) {
                alert(msg);
            }
        }).always(function() { me.setLoading(false); });
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
        values.leaf = ( !project.Children || project.Children.Count === 0 );
        
        return values;
    },
    
    _rollUpValues: function(summaries) {
        var me = this;
        
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
                    if ( /WIP/.test(field) || Ext.Array.contains(me.states, field) ) {
                        this._rollUpToParent(field, value, leaf, parent);
                    } 
                },this);
            } 
        },this);
        
        return Ext.Object.getValues(me.summaries_by_oid);
        
    },
 
    // TODO -- figure out what to do with middle node projects that have stories 
    _rollUpToParent: function(field, value, child, parent) {
        var me = this;
        if ( child.project.ObjectID !== this.getContext().getProject().ObjectID ) {
           
            if ( Ext.isEmpty(parent) ){
                var parent_oid = child.project.Parent.ObjectID;
                if ( ! me.summaries_by_oid[parent_oid] ) {
                    parent_project = this.projects_by_oid[parent_oid];
                    console.log('creating summary for:', parent_project.Name);
                    
                    me.summaries_by_oid[parent_oid] = this._getSummary([],parent_project);
                }
                parent = me.summaries_by_oid[parent_oid];
            }
            
            if ( parent ) {
                var child_value = value || 0;
                var parent_value = parent[field] || 0;
                        
                if ( parent.projectName == 'Very Top' && field == 'Defined' ) {
                    console.log("adding to top", parent_value, child_value);
                }
                parent[field] = child_value + parent_value;
                
                var grand_parent = parent.project.Parent;
                if ( !Ext.isEmpty(grand_parent) ) {
                    me._rollUpToParent(field, value, parent,me.summaries_by_oid[grand_parent.ObjectID]);
                }
            }
        }
        return;
    },
    
    _displayGrid : function(store) {
        var that = this;
        this.remove('workqueue');
        this.add({
            xtype : 'rallygrid',
            itemId : 'workqueue',
            store : store,
            columnCfgs : [
                {
                    text : 'Project',
                    dataIndex : 'projectName',
                    flex : 6,
                    align : 'center'
                },
                {
                    text : 'Defined',
                    dataIndex : 'Defined',
                    flex : 0.8,
                    align : 'center'
                },
                {
                    text : 'Defined Limit',
                    dataIndex : 'DefinedWIP',
                    flex : 0.8,
                    editor : {
                        xtype : 'numberfield'
                    },
                    renderer : that.renderLimit,
                    align : 'center'
                },
                {
                    text : 'In-Progress',
                    dataIndex : 'In-Progress',
                    flex : 0.8,
                    align : 'center'
                },
                {
                    text : 'In-Progress Limit',
                    dataIndex : 'In-ProgressWIP',
                    flex : 0.8,
                    editor : {
                        xtype : 'textfield'
                    },
                    renderer : that.renderLimit,
                    align : 'center'
                },
                {
                    text : 'Completed',
                    dataIndex : 'Completed',
                    flex : 0.8,
                    align : 'center'
                },
                {
                    text : 'Completed Limit',
                    dataIndex : 'CompletedWIP',
                    flex : 0.8,
                    editor : {
                        xtype : 'textfield'
                    },
                    renderer : that.renderLimit,
                    align : 'center'
                }
            ],
            editingConfig: {
                listeners: {
                    'beforeEdit': function(editor, evt) {
                        var record = evt.record;
                        
                        return record.get('leaf');
                    }
                }
            }
        });
    },
    
    renderLimit : function(value, meta, record, row, col, store, gridView) {
        meta.tdCls = 'limit';
        var display_value = value;
        
        if ( !record.get('leaf') ) {
            meta.tdCls = 'parentProject';
        }

        return display_value;
    },
    
    _setWipLimit : function(projectName, state, limit) {
        var me = this;
        var key = this._getWipKey(projectName, state);
        var settings = {};
        settings[key] = Ext.JSON.encode(limit);
        var workspace = this.getContext().getWorkspace();
        Rally.data.PreferenceManager.update({
            workspace : workspace,
            filterByName : key,
            settings : settings
        }).then({
            success : function(updatedRecords, notUpdatedRecord, options)
            {
                me.logger.log("Wrote WIP limit: ", key, settings, updatedRecords, notUpdatedRecord, options);
            },
            failure : function()
            {
                me.logger.log("Failed to write preference: ", key, settings);
            }
        });
    },
    _getWipKey : function(project, state)
    {
        return 'project-wip:' + project + ':' + state;
    },
    // TODO: get all prefs in one call and parcel out
    _getWipLimit : function(state, row) {
        var deferred = Ext.create('Deft.Deferred');
                
        var key = this._getWipKey(row.projectName, state);
        var workspace = this.getContext().getWorkspace();
        
        Rally.data.PreferenceManager.load({
            workspace : workspace,
            filterByName : key,
            success : function(prefs) {
                if (prefs && prefs[key]) {
                    var value = prefs[key];
                    
                    if ( row.leaf ) {
                        row[state] = parseInt( Ext.JSON.decode(value), 10 );
                    }
                    
                    deferred.resolve(row);
                } else {
                    deferred.resolve(row);
                }
            },
            failure : function(){
                promise.reject("Failed to get WIP limit: ", key);
            }
        });
        
        return deferred.promise;
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
    }
});