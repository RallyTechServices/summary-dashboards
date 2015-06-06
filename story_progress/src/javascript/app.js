Ext.define("TSWorkQueue", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [ 
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box'},
        {xtype:'tsinfolink', minHeight: 18},
        {xtype:'container',itemId:'display_box', layout: { type: 'hbox' } }
    ],
    config: {
        defaultSettings: {
            zoomToIteration:  false
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
        var me = this;
        this.logger.log("launch",settings);
        if ( settings.showScopeSelector == true || settings.showScopeSelector == "true" ) {
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
    },
    
    _changeRelease: function(release) {
        // do nothing yet
    },
    
    _changeIteration: function(iteration) {
        var me = this;
        this.logger.log("Iteration changed:", iteration);
        
        this._setInfo(); 
                
        var base_filter = [{property:'Iteration.Name',value:iteration.get('Name')}];
        
        var team_story_filters = Ext.Array.push([],base_filter);
        team_story_filters.push({property:'ScheduleState',value:'In-Progress'});

        var team_task_filters = Ext.Array.push([],base_filter);
        var task_fields = ['Estimate','FormattedID','WorkProduct','PlanEstimate','Blocked','State','Owner','ObjectID'];
        var story_fields = ['PlanEstimate','FormattedID','Blocked','Owner','ObjectID'];
        
        Deft.Chain.sequence([
            function() { return me._loadAStoreWithAPromise('UserStory', story_fields, team_story_filters); },
            function() { return me._loadAStoreWithAPromise('Task', task_fields, team_task_filters); }
            
        ]).then({
            scope: this,
            success: function(results) {
                var stories = results[0];
                var tasks = results[1];
                this.setLoading(false);
                
                this._makePies(stories,tasks);
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
        this.setLoading("Finding " + model_name + " records");
                  
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters
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

    _makePies: function(inside_records,outside_records){
        var container =  this.down('#display_box');

        this.logger.log("_makePies", inside_records, outside_records);
        
        container.removeAll();
        
        if ( inside_records.length == 0 && outside_records.length == 0 ) {
            container.add({xtype:'container',html:'No items in selection'});
        } else {
    
            container.add({
                xtype: 'tsdoughnut',
                title: 'Self',
                itemId: 'selfie',
                margin: '0 10 0 0',
                highlight_owner: this.getContext().getUser().ObjectID,
                remove_non_highlighted: true,
                inside_records: inside_records,
                inside_size_field: 'PlanEstimate',
                outside_records: outside_records,
                outside_size_field: 'Estimate'
            });
            container.add( {
                xtype: 'tsdoughnut',
                title: 'Team',
                margin: '0 10 0 5',
                itemId: 'team',
                inside_records: inside_records,
                inside_size_field: 'PlanEstimate',
                outside_records: outside_records,
                outside_size_field: 'Estimate'
            });
            
            //container.getBody().setSize(this.getWidth() * 0.95, container.getHeight() * 0.75);
        }
    },
    
    _setInfo: function() {
        var chart_info = [];
        
        chart_info.push("These charts show stories in the In Progress state with their tasks.");
        chart_info.push("Gray tasks on the Self chart represent tasks that belong to someone other than the current user");
        chart_info.push("The 'lightness' of tasks represents progress from Defined (darkest) to Completed (brightest)");
        chart_info.push("White tasks on either chart represent a story not having any tasks");
        chart_info.push("Size of story slices is based upon Plan Estimate");
        chart_info.push("Size of task slices is based on Estimate. (If none of the tasks on a story have Estimates, they are distributed evenly across the story.)")
        
        this.down('tsinfolink').informationHtml = chart_info.join('<br/>');
    },
    
     /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
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
            if (this.down('#settings_box').getComponent(this._appSettings.id)==undefined){
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
    }

            
});
