Ext.define("TSUtilization", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
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
        var settings = this.getSettings();
        this.logger.log("Release Changed:", release);
        
        if ( settings.zoomToIteration == false || settings.zoomToIteration == "false" ) {
            zoom = 'release'; 
            
            var name = release.get('Name');

            var filter = [{property:'Name',value:name}];
                        
            me._loadAStoreWithAPromise('Release', ['ReleaseStartDate','ReleaseDate','Name'], filter ).then({
                scope: me,
                success: function(releases) {
                    if (releases.length == 0) {
                        me.down('#display_box').add({ xtype:'container', html:'No releases in scope'});
                    } else {
                        me._gatherData(releases[0]);
                    }
                }
            });
                    
        }
    },
    
    _changeIteration: function(iteration) {
        var me = this;
        var settings = this.getSettings();
        this.logger.log("Iteration changed:", iteration);
        
        if ( settings.zoomToIteration == true || settings.zoomToIteration == "true" ) {
            zoom = 'iteration';
        
            var name = iteration.get('Name');

            var filter = [{property:'Name',value: name}];
            
            me._loadAStoreWithAPromise('Iteration', ['StartDate','EndDate','Name'], filter ).then({
                scope: me,
                success: function(iterations) {
                    if (iterations.length == 0) {
                        me.down('#display_box').add({ xtype:'container', html:'No iterations in scope'});
                    } else {
                        me._gatherData(iterations[0]);
                    }
                }
            });
        }

    },
    _gatherData: function(timebox) {
        var me = this;
        var timebox_type = timebox.get('_type');
        var end_field_name = "EndDate";
        var start_field_name = "StartDate";
        
        
        if ( timebox_type == 'release' ) {
            end_field_name = 'ReleaseDate';
            start_field_name = 'ReleaseStartDate';
        }
        
        var project_filter = Ext.create('Rally.data.wsapi.Filter',
            {property:'ObjectID',value:this.getContext().getProject().ObjectID}).or( 
            Ext.create('Rally.data.wsapi.Filter',
                {property:'Parent.ObjectID',value:this.getContext().getProject().ObjectID})
        );
        
        var release_filter = [];
        var iteration_filter = [{property:'Name', value:timebox.get('Name')}];
        
        if (timebox_type == 'iteration' ) {
            release_filter = [
                {property: 'ReleaseStartDate', operator: '<=', value: Rally.util.DateTime.toIsoString(timebox.get('StartDate'))},
                {property: 'ReleaseDate', operator: '>=', value: Rally.util.DateTime.toIsoString(timebox.get('EndDate'))}
            ];
        }
        
        if ( timebox_type == 'release' ) {
            release_filter = [{property:'Name', value:timebox.get('Name')}];
            iteration_filter = [
                {property: 'StartDate', operator: '>=', value: Rally.util.DateTime.toIsoString(timebox.get('ReleaseStartDate'))},
                {property: 'EndDate', operator: '<=', value: Rally.util.DateTime.toIsoString(timebox.get('ReleaseDate'))}
            ];
        }
        
        Deft.Chain.sequence([
            function() { return me._getIterationCumulativeFlowData(project_filter,iteration_filter); },
            function() { return me._getReleaseCumulativeFlowData(project_filter,release_filter); },
            function() { return me._getIterationsWithPoints(project_filter, iteration_filter); }
        ]).then({
            scope: this,
            success: function(cfd) {
                me.logger.log('cfd:', cfd);
                var icfd = cfd[0];
                var rcfd = cfd[1];
                var iterations = cfd[2];

                var array_of_days = this._getArrayOfDaysFromRange(timebox.get(start_field_name),timebox.get(end_field_name));
                this.logger.log("For days in Timebox:", array_of_days);

                var planned_each_day = [];
                if ( timebox_type != 'iteration' ) {
                    array_of_days = Ext.Object.getKeys(iterations);
                    planned_each_day = this._getPlannedFromIterationHash(iterations);
                }
                
                var iteration_total_each_day = this._getTotalsFromCFD(array_of_days,icfd);
                this.logger.log("Total each day:", iteration_total_each_day);
                
                var release_total_each_day = this._getTotalsFromCFD(array_of_days,rcfd);
                this.logger.log("Total each day:", release_total_each_day);
                
                var total_each_day = release_total_each_day;
                if ( timebox_type == 'iteration' ) { total_each_day = iteration_total_each_day; }
                
                var ideal_each_day = this._getIdealFromDailyHash(total_each_day);
                this.logger.log("Ideal each day:", ideal_each_day);
                
                var iteration_remaining_each_day = this._getTotalsFromCFD(array_of_days,icfd,["Accepted"]);
                this.logger.log("Remaining each day:", iteration_remaining_each_day);

                var release_remaining_each_day = this._getTotalsFromCFD(array_of_days,rcfd,["Accepted"]);
                this.logger.log("Remaining each day:", release_remaining_each_day);
                
                var chart_series = [];
                
                if ( timebox_type == 'iteration' ) {
                    chart_series.push(this._getSeriesFromDailyHash('Total / Stability', iteration_total_each_day ));
                    chart_series.push(this._getSeriesFromDailyHash('Ideal Burn', ideal_each_day));
                    chart_series.push(this._getSeriesFromDailyHash('Actual Burn', iteration_remaining_each_day ));
                } else {
                    chart_series.push(this._getSeriesFromDailyHash('Total / Stability', release_total_each_day ));
                    chart_series.push(this._getSeriesFromDailyHash('Ideal Burn', ideal_each_day));
                    chart_series.push(this._getSeriesFromDailyHash('Actual Burn', release_remaining_each_day ));
                    chart_series.push(this._getSeriesFromDailyHash('Potential', planned_each_day ));
                }

                
                var chart_categories = Ext.Array.map(array_of_days, function(day,idx) {
                    return idx+1;
                });
                
                this._makeChart(chart_categories, chart_series);
            },
            failure: function(error_message){
                console.log("oops:",error_message);
                
               // alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
     
    },
    _getPlannedFromIterationHash: function(iterations) {
        var planned = {};
        var total = 0;
        
        Ext.Object.each(iterations, function(day,iteration){
            var value = iteration.get('PlannedVelocity') || 0;
            total += value;
        });
        
        
        Ext.Object.each(iterations, function(day,iteration){
            var value = iteration.get('PlannedVelocity') || 0;
            total = total - value;
            planned[day] = total;
        });
        return planned;       
    },
    
    _getIdealFromDailyHash: function(total_each_day) {
        var ideal_hash = {};
        var days = Ext.Object.getKeys(total_each_day);
        
        var start_total = null;
        // find the first day on which there was a value and make it the starting value
        Ext.Array.each(days.reverse(), function(day) {
            var total_for_day = total_each_day[day];
            
            if ( total_for_day && total_for_day > 0 ) { 
                start_total = total_for_day;
            }
        });
        
        var decrement = null;
        
        if ( start_total ) {
            decrement = start_total / ( days.length - 1 );
        }

        var value = start_total;
        
        Ext.Object.each(total_each_day, function(day,total_for_day){
            ideal_hash[day] = value;
            if ( start_total ) {
                value = value - decrement;
                if ( value < 0 ) { value = 0 }
            }
        });
        
        return ideal_hash;
    },
    
    _getTotalsFromCFD: function(array_of_days,cfd, values_to_remove) {
        var me = this;
        var day_hash = {};
        if ( ! values_to_remove ) { values_to_remove = []; }
        
        Ext.Array.each(array_of_days, function(day){
            day_hash[day] = null;
        });
        
        Ext.Array.each(cfd,function(card){
            var card_date  = card.get('CreationDate');
            var card_state = card.get('CardState');
            
            var current_day_value = day_hash[card_date] || 0;
            
            if (!Ext.Array.contains(values_to_remove, card_state) ) {
                if ( Ext.isDefined(day_hash[card_date]) ) {
                    day_hash[card_date] += card.get('CardEstimateTotal');
                } else {
                    me.logger.log("A date that doesn't fit:", card_date);
                }
            }
        });
        
        return day_hash;
    },
    
    _getArrayOfDaysFromRange: function(startJS,endJS) {
        this.logger.log("From/To", startJS, endJS);
        
        var array_of_days = [];
        
        var new_day = startJS;
        while ( new_day < endJS ) {
            array_of_days.push(new_day);
            new_day = Rally.util.DateTime.add(new_day,'day',1);
        }
        
        return array_of_days;
    },
    
    _getIterationsWithPoints: function(project_filter,iteration_filter) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        Deft.Chain.pipeline([
            function() { return me._loadAStoreWithAPromise('Project', ['ObjectID','Name'], project_filter) ; },
            function(projects) { return me._getTimeboxes(projects, iteration_filter, 'iteration'); }
        ]).then({
            success: function(iterations) {
                var iterations_by_start = {};
                Ext.Array.each(iterations, function(iteration){
                    var name = iteration.get('Name');
                    var planned = iteration.get('PlannedVelocity') || 0;
                    var end_date = iteration.get('EndDate');
                    var start_date = iteration.get('StartDate');
                    
                    if ( !iterations_by_start[start_date] ) {
                        iteration.set('PlannedVelocity', 0);
                        iterations_by_start[start_date] = iteration;
                    }
                    
                    var saved_plan =  iterations_by_start[start_date].get('PlannedVelocity') || 0 ;
                    iterations_by_start[start_date].set('PlannedVelocity',saved_plan+planned);
                });
                
                deferred.resolve(iterations_by_start);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _getIterationCumulativeFlowData: function(project_filter,iteration_filter) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        Deft.Chain.pipeline([
            function() { return me._loadAStoreWithAPromise('Project', ['ObjectID','Name'], project_filter) ; },
            function(projects) { return me._getTimeboxes(projects, iteration_filter, 'iteration'); }
        ]).then({
            success: function(iterations) {
                if ( iterations.length > 0 ) {
                    var filtered_iteration_array = Ext.Array.map(iterations, function(iteration) {
                        return { property:'IterationObjectID', value: iteration.get('ObjectID') };
                    });
                    
                    var cfd_fields = ['IterationObjectID','CardCount','CardEstimateTotal','CardState','CreationDate'];
                    var cfd_filter = Rally.data.wsapi.Filter.or(filtered_iteration_array);
                    
                    me._loadAStoreWithAPromise('IterationCumulativeFlowData',cfd_fields ,cfd_filter).then({
                        success: function(cfd) {
                            deferred.resolve(cfd);
                        },
                        failure: function(msg) {
                            deferred.reject(msg);
                        }
                    });
                } else {
                    me.down('#display_box').add({xtype:'container',html:'No iterations'});
                    
                    deferred.reject("No iterations available for timebox");
                }
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _getReleaseCumulativeFlowData: function(project_filter,release_filter) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        Deft.Chain.pipeline([
            function() { return me._loadAStoreWithAPromise('Project', ['ObjectID','Name'], project_filter) ; },
            function(projects) { return me._getTimeboxes(projects, release_filter,'release'); }
        ]).then({
            success: function(releases) {
                if ( releases.length > 0 ) {
                    var filtered_release_array = Ext.Array.map(releases, function(release) {
                        return { property:'ReleaseObjectID', value: release.get('ObjectID') };
                    });
                    
                    var cfd_fields = ['ReleaseObjectID','CardCount','CardEstimateTotal','CardState','CreationDate'];
                    var cfd_filter = Rally.data.wsapi.Filter.or(filtered_release_array);
                    
                    me._loadAStoreWithAPromise('ReleaseCumulativeFlowData',cfd_fields ,cfd_filter).then({
                        success: function(cfd) {
                            deferred.resolve(cfd);
                        },
                        failure: function(msg) {
                            deferred.reject(msg);
                        }
                    });
                } else {
                    console.log('no releases');
                    deferred.resolve([]);
                }
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },    
    _getTimeboxes: function(projects,filter,timebox_type) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this._loadAStoreWithAPromise(timebox_type,['Project','ObjectID','PlannedVelocity','EndDate','StartDate','Name'], filter).then({
            success: function(timeboxes) {
                // got all iterations back, reduce them to just ones in the parent and child projects
                var project_oids = Ext.Array.map(projects, function(project) {
                    return project.get('ObjectID');
                });
                                
                var filtered_timeboxes = Ext.Array.filter(timeboxes, function(timebox) {
                    var timebox_project_oid = timebox.get('Project').ObjectID;
                    return Ext.Array.contains(project_oids, timebox_project_oid);
                });
                
                deferred.resolve(filtered_timeboxes);
                
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _loadAStoreWithAPromise: function(model_name, model_fields, filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.setLoading("Loading " + model_name + " items");
        
        this.logger.log("Starting load:",model_name,model_fields, filters);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters,
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
    
    _getSeriesFromDailyHash: function(series_name, value_each_day ){
        // expect that value_each_day is hash 'date/time': value
        return {
            type:'line',
            name: series_name,
            data: Ext.Object.getValues(value_each_day),
            connectNulls: true
        }
    },
    
    _makeChart: function(categories, chart_series) {
        this.down('#display_box').removeAll();
        
        this.down('#display_box').add({
            xtype:'rallychart',
            loadMask: false,
            chartData: {
                series: chart_series
            },
            chartConfig: {
                chart: {
                    height: 300
                },
                title: {
                    text: '',
                    align: 'center'
                },
                xAxis: [{
                    categories:  categories/*,
                    labels: {
                        align: 'left',
                        rotation: 70
                    }*/
                }],
                yAxis: [{
                    title: 'Points',
                    min: 0
                }],
                plotOptions: {
//                    series: {
//                        stacking: 'normal'
//                    }
                }
            }
        });
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
