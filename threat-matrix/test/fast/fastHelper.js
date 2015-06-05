var useObjectID = function(value,record) {
    if ( record.get('ObjectID') ) {
        return record.get('ObjectID');
    } 
    return 0;
};

var shiftDayBeginningToEnd = function(day) {
    return Rally.util.DateTime.add(Rally.util.DateTime.add(Rally.util.DateTime.add(day,'hour',23), 'minute',59),'second',59);
};

var getMockData = function(){

}

var projects_program_stream = [];
var projects_stream_team = [];


Ext.define('mockStory',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'c_Risk',type:'boolean'},
        {name:'PlanEstimate',type:'int'},
        {name:'id',type:'int',convert:useObjectID},
        {name:'ScheduleState',type:'string',defaultValue:'Defined'},
        {name: 'PlanEstimate', type: 'int'},
        {name: 'Project'},
        {name: 'InProgressDate', type: 'date'},
        {name: 'Blocked', type: 'boolean'},
        {name: 'Feature'},
        {name: '_ref', type: 'string'}
    ]
});

Ext.define('mockFeature',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name: 'Project'},
        {name:'c_Risk',type:'boolean'},
        {name: 'ActualStartDate', type: 'date'},
        {name: 'ActualEndDate', type: 'date'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});

Ext.define('mockProject',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'Name',type:'string'},
        {name:'Parent'},
        {name:'id',type:'int',convert:useObjectID},
        {name:'ObjectID',type:'int'}
    ]
});