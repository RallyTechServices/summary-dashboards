Ext.define("utilization-chart", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'chart_box', margin: 5, padding: 10, flex: 1},
        {xtype:'container',itemId:'grid_box',  margin: 5, padding: 10, flex: 1},
        {xtype:'tsinfolink'}
    ],

    config: {
        defaultSettings: {
            zoomToIteration:  true,
            includeItemsAcceptedAfterNDays: 0
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
        
        this.logger.log("Settings:", settings);
        
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
        var me = this;
        var settings = this.getSettings(),
            zoom_to_iteration = settings.zoomToIteration;
        this.logger.log("Release Changed:", release);

        if ( zoom_to_iteration == false || zoom_to_iteration == "false" ) {
            var startDate = Rally.util.DateTime.toIsoString(release.get('ReleaseStartDate')),
                endDate = Rally.util.DateTime.toIsoString(release.get('ReleaseDate'));

            Rally.technicalservices.ModelBuilder.build('Iteration','Utilization',[]).then({
                scope: this,
                success: function(model){

                    var filter = [{property:'StartDate', operator: "<", value: endDate},
                                    {property: 'EndDate', operator: ">", value: startDate}];
                    var fields = ['Name','EndDate','StartDate','PlannedVelocity','Project','Parent','Children','ObjectID'];

                    Deft.Chain.pipeline([
                        function() {
                            return me._loadAStoreWithAPromise(model, fields, filter );
                        },
                        function(iterations) {
                            me.setLoading('Loading Cumulative Flow Data...');
                            return me._associateCFDsWithIterations(iterations);
                        }
                    ]).then({
                        scope: me,
                        success: function(calculated_iterations) {
                            me.logger.log('Iterations: ', calculated_iterations);
                            var rolled_up_iterations = Rally.technicalservices.RollupToolbox.rollUpData(calculated_iterations);
                            var filtered_iterations = this._filterOutDistantProjects(rolled_up_iterations);

                            me.setLoading(false);

                            me._buildChart(filtered_iterations, zoom_to_iteration);
                            me._buildGrid(filtered_iterations, zoom_to_iteration);
                        },
                        failure: function(msg) {
                            Ext.Msg.alert('!', msg);
                        }
                    });
                }
            }).always(function() { me.setLoading(false); });

            //me.down('#chart_box').add({ xtype:'container', html:'No releases in scope'});

        }
    },
    
    _changeIteration: function(iteration) {
        var me = this;
        var settings = this.getSettings(),
            zoom_to_iteration = settings.zoomToIteration == true || settings.zoomToIteration == "true" ;
        this.logger.log("Iteration changed:", iteration);
        
        if ( !Ext.isEmpty(iteration) && zoom_to_iteration) {
            
            me.setLoading('Loading iteration ' + iteration.get('Name') );
            
            Rally.technicalservices.ModelBuilder.build('Iteration','Utilization',[]).then({
                scope: this,
                success: function(model){
                    var name = iteration.get('Name');
                    var filter = [{property:'Name',value: name}];
                    var fields = ['Name','EndDate','StartDate','PlannedVelocity','Project','Parent','Children','ObjectID'];

                    Deft.Chain.pipeline([
                        function() { 
                            return me._loadAStoreWithAPromise(model, fields, filter ); 
                        }, 
                        function(iterations) { 
                            me.setLoading('Loading Cumulative Flow Data...');
                            return me._associateCFDsWithIterations(iterations);
                        }
                    ]).then({
                        scope: me,
                        success: function(calculated_iterations) {
                            me.logger.log('Iterations: ', calculated_iterations);
                            var rolled_up_iterations = Rally.technicalservices.RollupToolbox.rollUpData(calculated_iterations);
                            var filtered_iterations = this._filterOutDistantProjects(rolled_up_iterations);

                            me.setLoading(false);
                            
                            me._buildChart(filtered_iterations, zoom_to_iteration);
                            me._buildGrid(filtered_iterations, zoom_to_iteration);
                        },
                        failure: function(msg) {
                            Ext.Msg.alert('!', msg);
                        }
                    });
                }
            }).always(function() { me.setLoading(false); });
        }
    },
    getChart: function(){
        return this.down('tsutilizationchart');
    },
    _buildChart: function(iterations, zoom_to_iteration){
        var me = this;

        this.down('#chart_box').removeAll();
        this.down('#grid_box').removeAll();

        this.down('#chart_box').add({
            xtype: 'tsutilizationchart',
            records: iterations,
            zoomToIteration: zoom_to_iteration
        });
    },
    _buildGrid: function(iterations, zoom_to_iteration){
        var grid = this.down('#grid_box').add({
            xtype: 'tslegendgrid',
            records: iterations,
            listeners: {
                scope: this,
                colorclicked: function(record){
                    this.getChart().toggleColor(record.get('__color'))
                },
                shapeclicked: function(shape ) {
                    this.getChart().toggleShape(shape);
                }
            }
        });
    },
    
    _associateCFDsWithIterations: function(iterations) {
        var deferred = Ext.create('Deft.Deferred');
        
        var fetch_fields =  ['CardEstimateTotal','CardState','CreationDate','IterationObjectID'];
        var start_date = Rally.util.DateTime.toIsoString(iterations[0].get('StartDate'));
        var end_date   = Rally.util.DateTime.toIsoString(iterations[0].get('EndDate'));
        
        var filters = [
            {property: 'CreationDate', operator: '>=', value:start_date},
            {property: 'CreationDate', operator: '<=', value:  end_date}
        ];
        
        this._loadAStoreWithAPromise('IterationCumulativeFlowData', fetch_fields, filters ).then({
            success: function(cfds) {
                Ext.Array.each(iterations, function(iteration){
                    iteration.setCFD(cfds);
                });
                deferred.resolve(iterations);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _filterOutDistantProjects: function(iterations){
        var current_project_oid = this.getContext().getProject().ObjectID;

        var filtered_iterations = Ext.Array.filter(iterations, function(iteration){
            var parent = iteration.get('Project').Parent,
                project_oid = iteration.get('Project').ObjectID;

            if (current_project_oid == project_oid){ return true; }

            if ( !parent ) { return false; }
            
            return (parent.ObjectID == current_project_oid ) ;
        });
        
        if ( filtered_iterations.length > 0 ) {
            return filtered_iterations;
        }
        return iterations;
    },

    _loadAStoreWithAPromise: function(model, model_fields, filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this.logger.log("Starting load:",model,model_fields, filters);
          
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: model,
            fetch: model_fields,
            filters: filters,
            limit: 'Infinity'
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
            },
            {
                name: 'zoomToIteration',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show by Iteration<br/><span style="color:#999999;"><i>If <strong>not</strong> ticked, show by iterations in the selected release.</i></span>'
            },
            {
                name: 'includeItemsAcceptedAfterNDays',
                xtype: 'rallynumberfield',
                fieldLabel: 'Include Stories Accepted within N days after the timebox end',
                labelAlign: 'top',
                margin: '0 0 25 200',
                labelWidth: 300
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
