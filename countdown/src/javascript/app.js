Ext.define("TSCountdown", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'tscountdown',itemId:'release_counter',cls:'border-bottom'},
        {xtype:'tscountdown',itemId:'iteration_counter'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        var today = Rally.util.DateTime.toIsoString(new Date());
        
        var iteration_filters = [
            {property:'StartDate',operator:'<',value: today},
            {property:'EndDate',  operator:'>',value: today}
        ];
        
        var release_filters = [
            {property:'ReleaseStartDate',operator:'<',value: today},
            {property:'ReleaseDate',  operator:'>',value: today}
        ];
        
        Deft.Chain.sequence([
            function() { return me._loadAStoreWithAPromise('Iteration', ['StartDate','EndDate','Name'], iteration_filters); },
            function() { return me._loadAStoreWithAPromise('Release', ['ReleaseStartDate','ReleaseDate','Name'], release_filters); }
        ]).then({
            scope: this,
            success: function(results) {
                var iteration = results[0][0];
                var release = results[1][0];
                
                this.logger.log("iteration,release", iteration, release);
                
                this.down('#release_counter').setEndDate( release.get('ReleaseDate') );
                this.down('#release_counter').text = release.get('Name') + ": " + release.get('ReleaseDate');
                
                this.down('#iteration_counter').setEndDate( iteration.get('EndDate') );
                this.down('#iteration_counter').text = iteration.get('Name') + ": " + iteration.get('EndDate');
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },
    _loadAStoreWithAPromise: function(model_name, model_fields, filters){
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
    }
});
