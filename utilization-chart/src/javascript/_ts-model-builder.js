Ext.define('Rally.technicalservices.ModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName, field_cfgs) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function(model) {

                var default_fields = [{
                    name: '__startScope',
                    displayName: 'Start Stability'
                },{
                    name: '__endScope',
                    displayName: 'End Stability'
                },{
                    name: '__endAcceptance',
                    displayName: 'End Acceptance'
                },{
                    name: '__NDaysAfter',
                    defaultValue: 0
                },{
                    name: '__days',
                    convert: function(value, record){
                        // this is an array of dates (end of the day) that the daily fields correspond to
                        if ( Ext.isEmpty(record.get('StartDate')) ) {
                            return [];
                        }
                        if ( Ext.isEmpty(record.get('EndDate')) ) {
                            return [];
                        }
                        
                        var first_day = Rally.util.DateTime.add(Rally.util.DateTime.add(record.get('StartDate'),'day', 1),'second',-1);
                        var last_day = record.get('EndDate');
                        var array_of_days = [];
                        var check_day = first_day;
                        while ( check_day <= last_day ) {
                            array_of_days.push(check_day);
                            check_day = Rally.util.DateTime.add(check_day,'day',1);
                        }
                        return array_of_days;
                    },
                    displayName: 'Days'
                },{
                    name: '__dailyScope',
                    defaultValue:  [],
                    displayName: 'Daily Stability'
                },{
                    name: '__dailyAcceptance',
                    defaultValue: [],
                    displayName: 'Daily Acceptance'
                }];
                
                var fields = Ext.Array.merge(default_fields, field_cfgs);
                var new_model = Ext.define(newModelName, {
                    extend: model,
                    fields: fields,
                    setCFD: me._setCFD,
                    setStragglers: me._setStragglers
                });
                deferred.resolve(new_model);
            }
        });

        return deferred;
    },
    
    // sometimes, dates are provided as beginning of day, but we 
    // want to go to the end of the day
    shiftToEndOfDay: function(js_date) {
        return Rally.util.DateTime.add(Rally.util.DateTime.add(js_date,'day',1),'second',-1);
    },
    
    isAccepted: function(state) {
        return ( state == 'Accepted' );
    },
    
    _setCFD: function(cfd_array) {
        var days = this.get('__days');
        
        var my_oid = this.get('ObjectID');
        
        // set scope to nulls every day
        var daily_scope = Ext.Array.map( days, function(day){ return null; });
        var daily_acceptance = Ext.Array.map( days, function(day){ return null; });
        
        var total_by_day = {};
        var acceptance_by_day = {};
        
        Ext.Array.each(cfd_array, function(cfd){
            var cfd_oid = cfd.get('IterationObjectID');
            
            if ( Ext.isEmpty(cfd_oid) || Ext.isEmpty(my_oid) || my_oid == cfd_oid ) {
                
                var card_total = cfd.get('CardEstimateTotal') || 0;
                var day = Rally.technicalservices.ModelBuilder.shiftToEndOfDay(cfd.get('CreationDate'));
                
                if (!total_by_day[day]) { total_by_day[day] = 0; }
                
                total_by_day[day] += card_total;

                if ( Rally.technicalservices.ModelBuilder.isAccepted(cfd.get('CardState')) ) {
                    if (!acceptance_by_day[day]) { acceptance_by_day[day] = 0; }
                    acceptance_by_day[day] += card_total;
                }
            }
        });

        Ext.Array.each(days, function(day,idx){
            if ( total_by_day[day] ) {
                daily_scope[idx] = total_by_day[day];
            }
            if ( acceptance_by_day[day] ) {
                daily_acceptance[idx] = acceptance_by_day[day];
            }
        });
        
        this.set('__dailyScope',daily_scope);
        if ( daily_scope.length > 0 ) {
            this.set('__startScope',daily_scope[0]);
            this.set('__endScope',daily_scope[daily_scope.length - 1]);
        }
        
        this.set('__dailyAcceptance',daily_acceptance);
        if ( daily_acceptance.length > 0 ) {
            this.set('__endAcceptance',daily_acceptance[daily_acceptance.length - 1]);
        }
    },
    _setStragglers: function(artifacts, num_extra_days){
        var late_acceptance_points = 0,
            my_oid = this.get('ObjectID'),
            start_date = this.get('EndDate'),
            end_date = Rally.util.DateTime.add(start_date, 'day', num_extra_days);

        this.set('__NDaysAfter', num_extra_days || 0);

        Ext.Array.each(artifacts, function(a){
            if (a.get('Iteration').ObjectID ==  my_oid ){
                if (a.get('AcceptedDate') > start_date && a.get('AcceptedDate') <= end_date){
                    late_acceptance_points += (a.get('PlanEstimate') || 0);
                }
            }
        });

        if (late_acceptance_points > 0){
            var end_acceptance = this.get('__endAcceptance');
            this.set('__endAcceptance', end_acceptance + late_acceptance_points);
        }
    }
});