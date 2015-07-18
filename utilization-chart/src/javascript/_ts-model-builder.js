Ext.define('Rally.technicalservices.ModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName, fields) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function(model) {

                var new_model = Ext.define(newModelName, {
                    extend: model,
                    fields: [{
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
                    },{
                        name: '__days',
                        convert: function(value, record){
                            // this is an array of dates (end of the day) that the daily fields correspond to
                            return [];
                        },
                        displayName: 'Days'
                    }]
                });
                deferred.resolve(new_model);
            }
        });

        return deferred;
    }
});