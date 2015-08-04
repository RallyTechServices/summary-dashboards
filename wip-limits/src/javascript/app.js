Ext.define('wip-limits', {
    extend : 'Rally.app.App',
    layout : {
        type : "fit"
    },
    mixins : [
        'Rally.Messageable'
    ],
    launch : function()
    {
        this._getAvailableStates().then({
            scope: this,
            success: function(states) {
                this.states = states;
                this._updateBoard();
            }
        });
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
        
        var projects_by_oid = {};
        Ext.Array.each(stories, function(story){
            var project = story.get('Project');
            var oid = project.ObjectID;
            projects_by_oid[oid] = project;
        });
        
        var projectGroup = _.groupBy(stories, function(t){
            return t.get("Project") ? t.get("Project").ObjectID : "none";
        });
        
        me.summaries = _.map(_.keys(projectGroup), function(project_oid) {
            var stories = projectGroup[project_oid];
            var project = projects_by_oid[project_oid] || "none";
            
            var counts = _.countBy(stories, function(story) {
                return story.get('ScheduleState');
            });
            
            var values = {};
            
            _.each(states, function(state){
                values[state] = _.isUndefined(counts[state]) ? 0 : counts[state];
                var wipKey = state + 'WIP';
                values[wipKey] = 0;
            });
            values.project = project;
            values.projectName = project.Name;
            values.leaf = ( !project.Children || project.Children.Count === 0 );
            
            return values;
        }, this);
        
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

        console.log('promises:', promises.length);
        
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(rows) {
                console.log('back:', me.summaries);
                me.newStore = Ext.create('Rally.data.custom.Store', {
                    data : me.summaries,
                    sorters : {
                        property : 'projectName',
                        direction : 'ASC'
                    }
                });
                
                me.newStore.addListener('update', function(store, record, op, fieldNames, eOpts){
                    if (op == 'edit') {
                        var projectName = record.get('projectName');
                        var fieldName = _.first(fieldNames);
                        var value = record.get(fieldName);
                        if ( record.get('leaf') ) {
                            me._setWipLimit(projectName, fieldName, value);
                        } else {
                            console.log("Can only set wip on children");
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
    
    _displayGrid : function(store) {
        var that = this;
        this.remove('workqueue');
        this.add({
            xtype : 'rallygrid',
            itemId : 'workqueue',
            enablebulkeditable : false,
            enableEditing : true,
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
            display_value = "--";
            meta.tdCls = 'parentProject';
        }
        
        console.log(record.get('projectName'), record.get('leaf'));

        return display_value;
    },
    
    _setWipLimit : function(projectName, state, limit)
    {
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
                console.log("Wrote WIP limit: ", key, settings, updatedRecords, notUpdatedRecord, options);
            },
            failure : function()
            {
                console.log("Failed to write preference: ", key, settings);
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
        
        console.log('_getWipLimit', row.projectName, state);
        
        var key = this._getWipKey(row.projectName, state);
        var workspace = this.getContext().getWorkspace();
        
        Rally.data.PreferenceManager.load({
            workspace : workspace,
            filterByName : key,
            success : function(prefs) {
                if (prefs && prefs[key]) {
                    var value = prefs[key];
                    row[state] = Ext.JSON.decode(value);
                    
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