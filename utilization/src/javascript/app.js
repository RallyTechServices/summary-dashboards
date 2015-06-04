Ext.define("TSUtilization", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
    {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        
        this.down('#selector_box').add({
            xtype:'rallyiterationcombobox',
            listeners: {
                change: function(combo) {
                    var iteration_name = combo.getRecord().get('Name');
        
                    var filter = [{property:'Name',value:iteration_name}];
                    
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
            }
        });
        
    },
    _gatherData: function(iteration) {
        var me = this;
        var project_filter = Ext.create('Rally.data.wsapi.Filter',
            {property:'ObjectID',value:this.getContext().getProject().ObjectID}).or( 
            Ext.create('Rally.data.wsapi.Filter',
                {property:'Parent.ObjectID',value:this.getContext().getProject().ObjectID})
        );
        
        var iteration_filter = [{property:'Name', value:iteration.get('Name')}];
        
        Deft.Chain.pipeline([
            function() { return me._loadAStoreWithAPromise('Project', ['ObjectID','Name'], project_filter) ; },
            function(projects) { return me._getIterations(projects, iteration_filter); },
            function(iterations) { return me._getIterationCumulativeFlowData(iterations); }
        ]).then({
            scope: this,
            success: function(cfd) {
                me.logger.log('cfd:', cfd);
                
                var array_of_days = this._getArrayOfDaysFromRange(iteration.get("StartDate"),iteration.get("EndDate"));
                this.logger.log("For days in Sprint:", array_of_days);

                var total_each_day = this._getTotalsFromCFD(array_of_days,cfd);
                this.logger.log("Total each day:", total_each_day);
                
                var ideal_each_day = this._getIdealFromDailyHash(total_each_day);
                this.logger.log("Ideal each day:", ideal_each_day);
                
                var remaining_each_day = this._getTotalsFromCFD(array_of_days,cfd,["Accepted"]);
                this.logger.log("Remaining each day:", remaining_each_day);
                
                var chart_series = [
                    this._getSeriesFromDailyHash('Total / Stability', total_each_day ),
                    this._getSeriesFromDailyHash('Ideal Burn', ideal_each_day),
                    this._getSeriesFromDailyHash('Actual Burn', remaining_each_day )
                ];
                
                var chart_categories = Ext.Array.map(array_of_days, function(day,idx) {
                    return idx+1;
                });
                this._makeChart(chart_categories, chart_series);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
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
        var day_hash = {};
        if ( ! values_to_remove ) { values_to_remove = []; }
        
        Ext.Array.each(array_of_days, function(day){
            day_hash[day] = null;
        });
        
        Ext.Array.each(cfd,function(card){ 
            var card_date = card.get('CreationDate');
            var card_state = card.get('CardState');
            
            var current_day_value = day_hash[card_date] || 0;
            
            if (!Ext.Array.contains(values_to_remove, card_state) ) {
                day_hash[card_date] += card.get('CardEstimateTotal');
            }
        });
        
        return day_hash;
    },
    
    _getArrayOfDaysFromRange: function(startJS,endJS) {
        var array_of_days = [];
        
        var new_day = startJS;
        while ( new_day < endJS ) {
            array_of_days.push(new_day);
            new_day = Rally.util.DateTime.add(new_day,'day',1);
        }
        
        return array_of_days;
    },
    
    _getIterationCumulativeFlowData: function(iterations) {
        var me = this;
        var iteration_filter_array = Ext.Array.map(iterations, function(iteration) {
            return { property:'IterationObjectID', value: iteration.get('ObjectID') };
        });
        
        var cfd_fields = ['IterationObjectID','CardCount','CardEstimateTotal','CardState','CreationDate'];
        var cfd_filter = Rally.data.wsapi.Filter.or(iteration_filter_array);
        
        return this._loadAStoreWithAPromise('IterationCumulativeFlowData',cfd_fields ,cfd_filter);
    },
    
    _getIterations: function(projects,iteration_filter) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this._loadAStoreWithAPromise('Iteration',['Project','ObjectID','PlannedVelocity'], iteration_filter).then({
            success: function(iterations) {
                // got all iterations back, reduce them to just ones in the parent and child projects
                var project_oids = Ext.Array.map(projects, function(project) {
                    return project.get('ObjectID');
                });
                
                me.logger.log('project oids:', project_oids);
                
                var filtered_iterations = Ext.Array.filter(iterations, function(iteration) {
                    var iteration_project_oid = iteration.get('Project').ObjectID;
                    return Ext.Array.contains(project_oids, iteration_project_oid);
                });
                
                deferred.resolve(filtered_iterations);
                
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
        
        this.logger.log("Starting load:",model_name,model_fields);
          
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
    
    _getSeriesFromDailyHash: function(series_name, value_each_day ){
        // expect that value_each_day is hash 'date/time': value
        return {
            type:'line',
            name: series_name,
            data: Ext.Object.getValues(value_each_day)
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
                chart: {},
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
    }
});