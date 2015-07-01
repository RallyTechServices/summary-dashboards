Ext.define("wip-limits", {
    extend: 'Rally.app.App',
    layout : {
        type : "fit"
    },
    mixins : [
        'Rally.Messageable'
    ],
    launch : function()
    {
        this._updateBoard();
    },
    _updateBoard : function(portfolioTimeboxFilter, storyTimeboxFilter)
    {
        var store = Ext.create('Rally.data.wsapi.Store', {
            model : 'hierarchicalrequirement',
            fetch : [
                'Name',
                'FormattedID',
                'Project',
                'ScheduleState'
            ],
            limit : Infinity
        });
        store.on('load', this._onStoriesLoaded, this);
        store.load();
    },
    _onStoriesLoaded : function(store, stories)
    {
        var me = this;
        var states = [
            'Backlog',
            'Defined',
            'In-Progress',
            'Completed',
            'Accepted'
        ];
        var projectGroup = _.groupBy(stories, function(t)
        {
            return t.get("Project") ? t.get("Project")._refObjectName : "none";
        });
        me.summaries = _.map(_.keys(projectGroup), function(project)
        {
            var stories = projectGroup[project];
            this.currentProject = project;
            var counts = _.countBy(stories, function(story)
            {
                return story.get('ScheduleState');
            });
            var values = {};
            _.each(states, function(state)
            {
                values[state] = _.isUndefined(counts[state]) ? 0 : counts[state];
                var wipKey = state + 'WIP';
                values[wipKey] = 0;
            });
            values.project = this.currentProject;
            return values;
        }, this);
        me.newStore = Ext.create('Rally.data.custom.Store', {
            data : me.summaries,
            sorters : {
                property : 'project',
                direction : 'ASC'
            }
        });
        _.each(me.summaries, function(row)
        {
            _.each(states, function(state)
            {
                var wipKey = state + 'WIP';
                me._getWipLimit(row.project, wipKey);
            });
        });
        me.newStore.addListener('update', function(store, record, op, fieldNames, eOpts)
        {
            if (op == 'edit')
            {
                var project = record.get('project');
                var fieldName = _.first(fieldNames);
                var value = record.get(fieldName);
                me._setWipLimit(project, fieldName, value);
            }
        }, store, {
            // single: true
        });
        this._displayGrid(me.newStore);
    },
    _displayGrid : function(store)
    {
        var that = this;
        this.remove('workqueue');
        this.add({
            xtype : 'rallygrid',
            itemId : 'workqueue',
            enablebulkeditable : true,
            enableEditing : true,
            store : store,
            columnCfgs : [
                {
                    text : 'Project',
                    dataIndex : 'project',
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
                        xtype : 'numberfield',
                        minValue: 0,

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
            ]
        });
    },
    renderLimit : function(value, meta, record, row, col, store, gridView)
    {
        // var field = null;
        // switch (col) {
        // case 2:
        // field = "DefinedWIP";
        // break;
        // case 4:
        // field = "In-ProgressWIP";
        // break;
        // case 6:
        // field = "CompletedWIP";
        // break;
        // }
        // if (value > record.get(field)) {
        meta.tdCls = 'limit';
        // }
        return value;
    },
    _setWipLimit : function(project, state, limit)
    {
        var key = this._getWipKey(project, state);
        var settings = {};
        settings[key] = Ext.JSON.encode(limit);
        var workspace = this.getContext().getWorkspace();
        Rally.data.PreferenceManager.update({
            workspace : workspace,
            settings : settings
        }).then({
            success : function(updatedRecords, notUpdatedRecord, options)
            {
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
    _getWipLimit : function(project, state)
    {
        var me = this;
        var key = this._getWipKey(project, state);
        var workspace = this.getContext().getWorkspace();
        console.log('workspace: ', workspace);
        Rally.data.PreferenceManager.load({
            workspace : workspace,
            filterByName : key,
            success : function(prefs)
            {
                if (prefs && prefs[key])
                {
                    var value = prefs[key];
                    var row = _.find(me.summaries, function(r)
                    {
                        return r.project === project;
                    });
                    row[state] = Ext.JSON.decode(value);
                    me.newStore.load();
                }
            },
            failure : function()
            {
                console.log("Failed to get WIP limit: ", key);
            }
        });
    }
});
