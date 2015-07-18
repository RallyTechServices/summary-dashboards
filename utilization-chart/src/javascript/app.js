Ext.define("utilization-chart", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var fetchList = ['Name','ObjectID','StartDate','EndDate','PlannedVelocity'];
        Rally.technicalservices.ModelBuilder.build('Iteration','Utilization',[]).then({
            scope: this,
            success: function(model){
                var store = Ext.create('Rally.data.wsapi.Store',{
                    model: model,
                    fetch: fetchList,
                    limit: 'Infinity'
                });

                store.load({
                    scope: this,
                    callback: function(records, operation, success){
                        console.log(records, operation, success);
                    }
                });
            }
        });
    }
});
