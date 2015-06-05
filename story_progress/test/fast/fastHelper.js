var useObjectID = function(value,record) {
    if ( record.get('ObjectID') ) {
        return record.get('ObjectID');
    } 
    return 0;
};

var shiftDayBeginningToEnd = function(day) {
    return Rally.util.DateTime.add(Rally.util.DateTime.add(Rally.util.DateTime.add(day,'hour',23), 'minute',59),'second',59);
};

Ext.define('mockStory',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int', defaultValue:10},
        {name:'FormattedID',type:'string',defaultValue:'US1'},
        {name:'Name',type:'string',defaultValue:'Story'},
        {name:'PlanEstimate',type:'int',defaultValue:13},
        {name:'id',type:'int',convert:useObjectID},
        {name:'Blocked',type:'boolean',defaultValue: false},
        {name:'ScheduleState',type:'string',defaultValue:'Defined'}
    ]
});

Ext.define('mockTask',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int', defaultValue:10},
        {name:'FormattedID',type:'string',defaultValue:'TA37'},
        {name:'Name',type:'string',defaultValue:'Task'},
        {name:'Estimate',type:'int',defaultValue:8},
        {name:'id',type:'int',convert:useObjectID},
        {name:'State',type:'string',defaultValue:'Defined'},
        {name:'Blocked',type:'boolean',defaultValue: false},
        {name:'WorkProduct',type:'auto'}
    ]
});

Ext.define('mockIteration',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'StartDate',type:'auto'},
        {name:'EndDate',type:'auto'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
