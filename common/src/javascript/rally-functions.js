/** this class is configured with { series : [] } where series is a single dimensional array of 
    data values that is filled to full extent of the date range with future values filled with 
    nulls.
**/
Ext.define("RallyFunctions", function() {

    var self;

    return {
        config : {
            ctx : {}
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
        },

        _wsapiQuery : function( config , callback ) {

            var storeConfig = {
                autoLoad : true,
                limit : "Infinity",
                model : config.model,
                fetch : config.fetch,
                filters : config.filters,
                listeners : {
                    scope : this,
                    load : function(store, data) {
                        callback(null,data);
                    }
                }
            };
            if (!_.isUndefined(config.context)) {
                storeConfig.context = config.context;
            }         
            Ext.create('Rally.data.WsapiDataStore', storeConfig);
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
            		filters.push({
                        property: featureFieldName + '.Release.Name',
                        value: releaseName
                    });
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
        },

        createFeatureFilter : function( releaseName ) { 
            var filter = null;

            if (!_.isNull(releaseName)) {
                filter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Release.Name',
                    operator: '=',
                    value: releaseName
                });
            }

            return filter;
        },

        subscribe : function(app) {
            app.subscribe(app, 'timeboxReleaseChanged', app._timeboxChanged, app);
            app.subscribe(app, 'timeboxIterationChanged', app._timeboxChanged, app);
        }
       
    };
   
});