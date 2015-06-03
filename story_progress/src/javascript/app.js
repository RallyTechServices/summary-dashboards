Ext.define("TSStoryProgressPie", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        
        var base_filter = [{property:'ObjectID',operator:'>',value:0}];
        
        var team_story_filters = Ext.Array.push([],base_filter);
        team_story_filters.push({property:'ScheduleState',value:'In-Progress'});

        var team_task_filters = Ext.Array.push([],base_filter);
        var task_fields = ['Estimate','FormattedID','WorkProduct','PlanEstimate','Blocked','State'];
        Deft.Chain.sequence([
            function() { return me._loadAStoreWithAPromise('UserStory', ['PlanEstimate','FormattedID','Blocked'], team_story_filters); },
            function() { return me._loadAStoreWithAPromise('Task', task_fields, team_task_filters); }
            
        ]).then({
            scope: this,
            success: function(results) {
                var stories = results[0];
                var tasks = results[1];
                
                this._makePie(stories,tasks);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    _loadAStoreWithAPromise: function(model_name, model_fields,filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters
        }).load({
            callback : function(records, operation, successful) {
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

    _makePie: function(inside_records,outside_records){
        var container =  this.down('#display_box');
        
        container.removeAll();
        container.add({
            xtype: 'tsdoughnut',
            title: 'Team',
            inside_records: inside_records,
            inside_size_field: 'PlanEstimate',
            outside_records: outside_records,
            outside_size_field: 'Estimate'
        });
    }
});
