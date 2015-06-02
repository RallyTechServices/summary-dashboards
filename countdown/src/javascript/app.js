Ext.define("TSCountdown", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'tscountdown',itemId:'iteration_counter'},
        {xtype:'tscountdown',itemId:'release_counter'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        this.setLoading("Loading stuff...");
        
        this.down('#iteration_counter').setEndDate( Rally.util.DateTime.add(new Date(), 'day', 2));
        this.down('#iteration_counter').text = "Hi";

        var model_name = 'Defect',
            field_names = ['Name','State'];
        
        this._loadAStoreWithAPromise(model_name, field_names).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store,field_names);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    }
});
