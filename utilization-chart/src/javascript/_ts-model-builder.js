Ext.define('Rally.technicalservices.ModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName, field_cfgs) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function(model) {

                var default_fields = [{
                    name: '__startScope',
                    convert: function (value, record) {
                        return 1;
                    },
                    displayName: 'Start Stability'
                },{
                    name: '__endScope',
                    convert: function(value, record){
                        return 2;
                    },
                    displayName: 'End Stability'
                },{
                    name: '__endAcceptance',
                    convert: function(value, record){
                        return 2;
                    },
                    displayName: 'End Acceptance'
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
                    convert: function(value, record){
                        return [1,1,2]
                    },
                    displayName: 'Daily Stability'
                },{
                    name: '__dailyAcceptance',
                    convert: function(value, record){
                        return [0,1,2];
                    },
                    displayName: 'Daily Acceptance'
                }];
                
                var fields = Ext.Array.merge(default_fields, field_cfgs);
                var new_model = Ext.define(newModelName, {
                    extend: model,
                    fields: fields
                });
                deferred.resolve(new_model);
            }
        });

        return deferred;
    }
});