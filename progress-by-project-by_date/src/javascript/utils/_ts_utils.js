Ext.define('CArABU.TSUtils',{
    singleton: true,
    getPortfolioItemTypes: function() {
        var config = {
            fetch: ['Name','ElementName','TypePath'],
            model: 'TypeDefinition',
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ]
        };
        return CArABU.TSUtils.loadWsapiRecords(config);
    },

    getScheduleStates: function() {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function(model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        var schedule_states = Ext.Array.map(records, function(allowedValue) {
                            return allowedValue.get('StringValue');
                        });
                        deferred.resolve(schedule_states);
                    }
                });
            }
        });
        return deferred.promise;
    },

    loadWsapiRecords: function(config,returnOperation){
        var deferred = Ext.create('Deft.Deferred');

        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };

        var full_config =  Ext.Object.merge(default_config,config);
        var store_class_name = 'Rally.data.wsapi.Store';
        if ( full_config.models ) {
            store_class_name = 'Rally.data.wsapi.artifact.Store';
        }
        Ext.create(store_class_name, full_config).load({
            callback : function(records, operation, successful) {
                if (successful){
                    if ( returnOperation ) {
                        deferred.resolve(operation);
                    } else {
                        deferred.resolve(records);
                    }
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    // create a filter based on a combination of release and/or iteration
    createFilter : function( releaseName, iterationName, featureFieldName ) {
        var filter = Rally.data.wsapi.Filter.and([{property:'DirectChildrenCount',value:0}]);

        if (!_.isNull(releaseName)) {
            var filters = [{
                property: 'Release.Name',
                value: releaseName
            }];

            if ( featureFieldName ) {
                //filters.push({
                filters = [{
                    property: featureFieldName + '.Release.Name',
                    value: releaseName
                }];
                //});
            }
            filter = filter.and( Rally.data.wsapi.Filter.or(filters) );
        }

        if (!_.isNull(iterationName)) {
            var ifilter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'Iteration.Name',
                operator: '=',
                value: iterationName
            });

            filter = _.isNull(filter) ? ifilter : filter.and(ifilter);
        }
        return filter;
    }
});
